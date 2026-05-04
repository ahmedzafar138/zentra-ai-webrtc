from __future__ import annotations

import base64
from dataclasses import dataclass, field
from io import BytesIO
import logging
import pickle
from pathlib import Path
from threading import Lock
import time
from typing import Any
from uuid import uuid4

import numpy as np

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)

BICEP_SELECTED_LANDMARKS = (
    "right_hip",
    "left_hip",
    "right_shoulder",
    "left_shoulder",
    "right_elbow",
    "left_elbow",
    "right_wrist",
    "left_wrist",
)
FRAME_FEATURES = len(BICEP_SELECTED_LANDMARKS) * 4
RIGHT_SHOULDER_INDEX = 2
RIGHT_ELBOW_INDEX = 4
RIGHT_WRIST_INDEX = 6
MAX_POSE_IMAGE_DIMENSION = 640


@dataclass
class BicepCurlPrediction:
    label: str
    probability: float
    confidence: float


@dataclass
class BicepCurlSessionState:
    direction: int = 0
    up_count: int = 0
    down_count: int = 0
    frame_buffer: list[np.ndarray] = field(default_factory=list)
    rep_count: int = 0
    correct_reps: int = 0
    incorrect_reps: int = 0
    last_prediction: BicepCurlPrediction | None = None

    @property
    def phase(self) -> str:
        if self.direction == 0:
            return "waiting_for_down_position"
        if self.direction == 1:
            return "waiting_for_curl_up"
        return "recording_rep"


class BicepCurlService:
    """Stateful bicep-curl inference service.

    The Keras model and sequence metadata are loaded once. Each camera session has
    its own rep-counting state so multiple clients do not overwrite one another.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.model: Any | None = None
        self.max_len: int | None = None
        self.reference_rep_len: int | None = None
        self.sessions: dict[str, BicepCurlSessionState] = {}
        self._model_lock = Lock()
        self._pose_lock = Lock()
        self._session_lock = Lock()
        self._pose: Any | None = None
        self._pose_landmarks: tuple[Any, ...] | None = None

    @property
    def is_loaded(self) -> bool:
        return self.model is not None and self.max_len is not None

    def load(self) -> None:
        with self._model_lock:
            if self.is_loaded:
                logger.info("Bicep curl model already loaded; skipping reload")
                return

            model_path = self.settings.bicep_curl_model_path
            reps_path = self.settings.bicep_curl_reps_path
            self._validate_artifact(model_path, "model")
            self._validate_artifact(reps_path, "training sequence metadata")

            load_started = time.perf_counter()
            logger.info("Importing TensorFlow runtime for bicep curl inference")
            tf = self._import_tensorflow()
            logger.info(
                "TensorFlow imported successfully in %.2fs",
                time.perf_counter() - load_started,
            )

            model_started = time.perf_counter()
            logger.info("Loading bicep curl model from %s", model_path)
            self.model = tf.keras.models.load_model(model_path)
            logger.info(
                "Bicep curl Keras model loaded in %.2fs",
                time.perf_counter() - model_started,
            )

            metadata_started = time.perf_counter()
            logger.info("Loading bicep curl sequence metadata from %s", reps_path)
            with reps_path.open("rb") as file:
                training_reps = pickle.load(file)
            logger.info(
                "Bicep curl sequence metadata loaded in %.2fs",
                time.perf_counter() - metadata_started,
            )

            training_lengths = sorted(len(rep["frames"]) for rep in training_reps)
            self.max_len = training_lengths[-1]
            self.reference_rep_len = training_lengths[len(training_lengths) // 2]
            logger.info(
                "Bicep curl model ready with max sequence length %s, reference rep length %s in %.2fs total",
                self.max_len,
                self.reference_rep_len,
                time.perf_counter() - load_started,
            )

    def health(self) -> dict[str, Any]:
        return {
            "loaded": self.is_loaded,
            "model_path": str(self.settings.bicep_curl_model_path),
            "reps_path": str(self.settings.bicep_curl_reps_path),
            "max_sequence_length": self.max_len,
            "reference_rep_length": self.reference_rep_len,
            "active_sessions": len(self.sessions),
            "landmarks": BICEP_SELECTED_LANDMARKS,
            "frame_features": FRAME_FEATURES,
            "thresholds": {
                "up": self.settings.bicep_curl_up_threshold,
                "down": self.settings.bicep_curl_down_threshold,
                "min_frames": self.settings.bicep_curl_min_frames,
                "min_rep_frames": self.settings.bicep_curl_min_rep_frames,
            },
        }

    def create_session(self) -> str:
        session_id = str(uuid4())
        with self._session_lock:
            self.sessions[session_id] = BicepCurlSessionState()
        logger.info("Created bicep curl inference session %s", session_id)
        return session_id

    def reset_session(self, session_id: str) -> BicepCurlSessionState:
        with self._session_lock:
            self.sessions[session_id] = BicepCurlSessionState()
            state = self.sessions[session_id]
        logger.info("Reset bicep curl inference session %s", session_id)
        return state

    def delete_session(self, session_id: str) -> bool:
        with self._session_lock:
            existed = self.sessions.pop(session_id, None) is not None
        if existed:
            logger.info("Deleted bicep curl inference session %s", session_id)
        return existed

    def process_frame(self, session_id: str, landmarks: Any) -> dict[str, Any]:
        self._ensure_loaded()
        state = self._get_session(session_id)
        frame = self._normalize_frame(landmarks)
        points = frame.reshape(len(BICEP_SELECTED_LANDMARKS), 4)
        angle = self.calculate_angle(
            points[RIGHT_SHOULDER_INDEX],
            points[RIGHT_ELBOW_INDEX],
            points[RIGHT_WRIST_INDEX],
        )

        rep_completed = False
        status = "tracking"
        prediction: BicepCurlPrediction | None = None

        if state.direction == 0 and angle > self.settings.bicep_curl_down_threshold:
            state.down_count += 1
            if state.down_count >= self.settings.bicep_curl_min_frames:
                state.direction = 1
                state.down_count = 0
                status = "down_position_detected"
        elif state.direction == 0:
            state.down_count = 0

        if state.direction == 1 and angle < self.settings.bicep_curl_up_threshold:
            state.up_count += 1
            if state.up_count >= self.settings.bicep_curl_min_frames:
                state.direction = 2
                state.frame_buffer = []
                state.up_count = 0
                status = "curl_up_detected"
        elif state.direction == 1:
            state.up_count = 0

        if state.direction == 2:
            state.frame_buffer.append(frame)

        if state.direction == 2 and angle > self.settings.bicep_curl_down_threshold:
            state.down_count += 1
            if state.down_count >= self.settings.bicep_curl_min_frames:
                rep_completed = True
                if len(state.frame_buffer) >= self.settings.bicep_curl_min_rep_frames:
                    prediction = self.predict_rep(state.frame_buffer)
                    state.last_prediction = prediction
                    state.rep_count += 1
                    if prediction.label == "correct":
                        state.correct_reps += 1
                    else:
                        state.incorrect_reps += 1
                    status = "rep_completed"
                    logger.info(
                        "Bicep curl rep completed session=%s rep=%s label=%s probability=%.4f",
                        session_id,
                        state.rep_count,
                        prediction.label,
                        prediction.probability,
                    )
                else:
                    status = "rep_too_short"
                    logger.info(
                        "Ignored short bicep curl rep session=%s frames=%s",
                        session_id,
                        len(state.frame_buffer),
                    )

                state.frame_buffer = []
                state.direction = 0
                state.down_count = 0
        elif state.direction == 2:
            state.down_count = 0

        return self._frame_response(
            session_id=session_id,
            state=state,
            angle=angle,
            status=status,
            rep_completed=rep_completed,
            prediction=prediction,
            landmarks=points,
        )

    def process_image_frame(self, session_id: str, image_base64: str) -> dict[str, Any]:
        self._ensure_loaded()
        frame = self._decode_image(image_base64)
        landmarks, pose_detected = self._extract_landmarks_from_image(frame)
        response = self.process_frame(session_id, landmarks)
        if not pose_detected:
            response["status"] = "no_pose_detected"
            response["landmarks"] = None
        return response

    def predict_rep(self, frames: list[Any]) -> BicepCurlPrediction:
        self._ensure_loaded()
        normalized_frames = [self._normalize_frame(frame) for frame in frames]
        normalized_frames = self._resample_short_rep(normalized_frames)
        pad_sequences = self._import_pad_sequences()
        sequence = pad_sequences(
            [normalized_frames],
            maxlen=self.max_len,
            dtype="float32",
            padding="post",
        )

        with self._model_lock:
            probability = float(self.model.predict(sequence, verbose=0)[0][0])

        if probability > 0.5:
            return BicepCurlPrediction(
                label="correct",
                probability=probability,
                confidence=probability,
            )
        return BicepCurlPrediction(
            label="incorrect",
            probability=probability,
            confidence=1.0 - probability,
        )

    def _resample_short_rep(self, frames: list[np.ndarray]) -> list[np.ndarray]:
        if not frames or self.reference_rep_len is None or len(frames) >= self.reference_rep_len:
            return frames

        frame_array = np.asarray(frames, dtype=np.float32)
        source_positions = np.linspace(0.0, 1.0, num=len(frames), dtype=np.float32)
        target_positions = np.linspace(0.0, 1.0, num=self.reference_rep_len, dtype=np.float32)
        resampled = np.empty((self.reference_rep_len, FRAME_FEATURES), dtype=np.float32)

        for feature_index in range(FRAME_FEATURES):
            resampled[:, feature_index] = np.interp(
                target_positions,
                source_positions,
                frame_array[:, feature_index],
            )

        return [frame for frame in resampled]

    @staticmethod
    def calculate_angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
        a, b, c = np.array(a[:2]), np.array(b[:2]), np.array(c[:2])
        ba, bc = a - b, c - b
        cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-6)
        return float(np.degrees(np.arccos(np.clip(cos_angle, -1, 1))))

    def _frame_response(
        self,
        session_id: str,
        state: BicepCurlSessionState,
        angle: float | None,
        status: str,
        rep_completed: bool,
        prediction: BicepCurlPrediction | None,
        landmarks: np.ndarray | None = None,
    ) -> dict[str, Any]:
        return {
            "session_id": session_id,
            "status": status,
            "phase": state.phase,
            "angle": round(angle, 2) if angle is not None else None,
            "rep_completed": rep_completed,
            "rep_count": state.rep_count,
            "correct_reps": state.correct_reps,
            "incorrect_reps": state.incorrect_reps,
            "buffered_frames": len(state.frame_buffer),
            "prediction": self._prediction_to_dict(prediction),
            "last_prediction": self._prediction_to_dict(state.last_prediction),
            "landmarks": self._landmarks_to_dict(landmarks),
        }

    def _normalize_frame(self, landmarks: Any) -> np.ndarray:
        frame = np.asarray(landmarks, dtype=np.float32)
        if frame.shape == (len(BICEP_SELECTED_LANDMARKS), 4):
            return frame.reshape(FRAME_FEATURES)
        if frame.shape == (FRAME_FEATURES,):
            return frame
        raise ValueError(
            "Bicep curl landmarks must be 8 landmarks shaped [x,y,z,visibility] "
            f"or a flat {FRAME_FEATURES}-value array."
        )

    def _get_session(self, session_id: str) -> BicepCurlSessionState:
        with self._session_lock:
            state = self.sessions.get(session_id)
        if state is None:
            raise KeyError(f"Unknown bicep curl session_id: {session_id}")
        return state

    def _ensure_loaded(self) -> None:
        if not self.is_loaded:
            self.load()

    @staticmethod
    def _prediction_to_dict(prediction: BicepCurlPrediction | None) -> dict[str, Any] | None:
        if prediction is None:
            return None
        return {
            "label": prediction.label,
            "probability": round(prediction.probability, 4),
            "confidence": round(prediction.confidence, 4),
        }

    @staticmethod
    def _landmarks_to_dict(landmarks: np.ndarray | None) -> list[dict[str, float | str]] | None:
        if landmarks is None:
            return None
        return [
            {
                "name": name,
                "x": round(float(point[0]), 5),
                "y": round(float(point[1]), 5),
                "z": round(float(point[2]), 5),
                "visibility": round(float(point[3]), 5),
            }
            for name, point in zip(BICEP_SELECTED_LANDMARKS, landmarks)
        ]

    @staticmethod
    def _validate_artifact(path: Path, name: str) -> None:
        if not path.exists():
            raise FileNotFoundError(f"Bicep curl {name} file not found: {path}")

    def _decode_image(self, image_base64: str) -> np.ndarray:
        try:
            encoded = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
            image_bytes = base64.b64decode(encoded, validate=True)
        except (ValueError, IndexError) as exc:
            raise ValueError("image_base64 must contain valid base64 image data") from exc

        cv2, _ = self._import_vision_runtime()
        try:
            from PIL import Image, ImageOps

            with Image.open(BytesIO(image_bytes)) as pil_image:
                pil_image = ImageOps.exif_transpose(pil_image).convert("RGB")
                image_rgb = np.asarray(pil_image)
            return cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)
        except Exception:
            buffer = np.frombuffer(image_bytes, dtype=np.uint8)
            image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
            if image is None:
                raise ValueError("image_base64 could not be decoded as an image")
            return image

    def _extract_landmarks_from_image(self, image_bgr: np.ndarray) -> tuple[list[list[float]], bool]:
        cv2, _ = self._import_vision_runtime()
        pose = self._get_pose()
        height, width = image_bgr.shape[:2]
        max_dimension = max(width, height)
        if max_dimension > MAX_POSE_IMAGE_DIMENSION:
            scale = MAX_POSE_IMAGE_DIMENSION / max_dimension
            image_bgr = cv2.resize(
                image_bgr,
                (int(width * scale), int(height * scale)),
                interpolation=cv2.INTER_AREA,
            )
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)

        with self._pose_lock:
            results = pose.process(image_rgb)

        if not results.pose_landmarks:
            return [[0.0] * 4 for _ in BICEP_SELECTED_LANDMARKS], False

        selected_landmarks = self._get_pose_landmarks()
        landmarks = results.pose_landmarks.landmark
        return (
            [
                [
                    landmarks[landmark].x,
                    landmarks[landmark].y,
                    landmarks[landmark].z,
                    landmarks[landmark].visibility,
                ]
                for landmark in selected_landmarks
            ],
            True,
        )

    def _get_pose(self) -> Any:
        if self._pose is None:
            _, mp = self._import_vision_runtime()
            self._pose = mp.solutions.pose.Pose(
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        return self._pose

    def _get_pose_landmarks(self) -> tuple[Any, ...]:
        if self._pose_landmarks is None:
            _, mp = self._import_vision_runtime()
            pose_landmark = mp.solutions.pose.PoseLandmark
            self._pose_landmarks = (
                pose_landmark.RIGHT_HIP,
                pose_landmark.LEFT_HIP,
                pose_landmark.RIGHT_SHOULDER,
                pose_landmark.LEFT_SHOULDER,
                pose_landmark.RIGHT_ELBOW,
                pose_landmark.LEFT_ELBOW,
                pose_landmark.RIGHT_WRIST,
                pose_landmark.LEFT_WRIST,
            )
        return self._pose_landmarks

    @staticmethod
    def _import_vision_runtime() -> tuple[Any, Any]:
        try:
            import cv2
            import mediapipe as mp
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "OpenCV and MediaPipe are required for image-based bicep curl inference. "
                "Install model gateway dependencies with: python -m pip install -r "
                "model_gateway/requirements.txt"
            ) from exc
        return cv2, mp

    @staticmethod
    def _import_tensorflow() -> Any:
        try:
            import tensorflow as tf
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "TensorFlow is required for bicep curl inference. Install model gateway "
                "dependencies with: python -m pip install -r model_gateway/requirements.txt"
            ) from exc
        except (ImportError, OSError) as exc:
            raise RuntimeError(
                "TensorFlow is installed but its native Windows runtime could not load. "
                "This is usually caused by an outdated/missing Microsoft Visual C++ "
                "Redistributable, an unsupported CPU instruction set, or an incompatible "
                "TensorFlow wheel. Install/repair Microsoft Visual C++ Redistributable "
                "2015-2022 x64 first, then retry the gateway."
            ) from exc
        return tf

    @staticmethod
    def _import_pad_sequences() -> Any:
        try:
            from tensorflow.keras.preprocessing.sequence import pad_sequences
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                "TensorFlow/Keras is required for sequence padding during bicep curl inference."
            ) from exc
        return pad_sequences


_bicep_curl_service: BicepCurlService | None = None


def get_bicep_curl_service() -> BicepCurlService:
    global _bicep_curl_service
    if _bicep_curl_service is None:
        _bicep_curl_service = BicepCurlService(get_settings())
    return _bicep_curl_service
