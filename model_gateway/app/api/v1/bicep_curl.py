import asyncio
import json
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, ValidationError

from app.services.bicep_curl_service import get_bicep_curl_service

router = APIRouter(prefix="/bicep-curl", tags=["bicep-curl"])
_webrtc_peer_connections: set[Any] = set()


class SessionResponse(BaseModel):
    session_id: str
    message: str


class FrameRequest(BaseModel):
    landmarks: list[Any] = Field(
        ...,
        description=(
            "Eight selected pose landmarks in infer.py order. Accepts nested "
            "[[x,y,z,visibility], ...] or one flat 32-number frame."
        ),
    )
    timestamp_ms: int | None = None


class ImageFrameRequest(BaseModel):
    image_base64: str = Field(
        ...,
        description="JPEG/PNG image as raw base64 or a data:image/...;base64 URI.",
    )
    timestamp_ms: int | None = None


class RepPredictionRequest(BaseModel):
    frames: list[Any] = Field(
        ...,
        min_length=1,
        description="Completed rep frames, each nested 8x4 landmarks or flat 32 values.",
    )


class BicepCurlRealtimeMessage(BaseModel):
    type: str = Field(..., description="Message type: image_frame, landmarks_frame, reset, or ping.")
    image_base64: str | None = None
    landmarks: list[Any] | None = None
    timestamp_ms: int | None = None


class WebRtcOfferRequest(BaseModel):
    sdp: str
    type: str = "offer"


class WebRtcAnswerResponse(BaseModel):
    sdp: str
    type: str


def _validate_realtime_message(raw_message: Any) -> BicepCurlRealtimeMessage:
    if hasattr(BicepCurlRealtimeMessage, "model_validate"):
        return BicepCurlRealtimeMessage.model_validate(raw_message)
    return BicepCurlRealtimeMessage.parse_obj(raw_message)


async def _process_realtime_message(
    session_id: str,
    raw_message: Any,
) -> dict[str, Any]:
    service = get_bicep_curl_service()
    message = _validate_realtime_message(raw_message)

    if message.type == "image_frame":
        if not message.image_base64:
            raise ValueError("image_frame requires image_base64")
        result = await asyncio.to_thread(
            service.process_image_frame,
            session_id,
            message.image_base64,
        )
        return {
            "type": "frame_result",
            "timestamp_ms": message.timestamp_ms,
            **result,
        }

    if message.type == "landmarks_frame":
        if message.landmarks is None:
            raise ValueError("landmarks_frame requires landmarks")
        result = await asyncio.to_thread(
            service.process_frame,
            session_id,
            message.landmarks,
        )
        return {
            "type": "frame_result",
            "timestamp_ms": message.timestamp_ms,
            **result,
        }

    if message.type == "reset":
        await asyncio.to_thread(service.reset_session, session_id)
        return {
            "type": "session_reset",
            "session_id": session_id,
            "message": "Bicep curl session reset.",
        }

    if message.type == "ping":
        return {"type": "pong", "session_id": session_id}

    raise ValueError(f"Unsupported realtime message type: {message.type}")


@router.get("/health")
def bicep_curl_health() -> dict[str, Any]:
    return get_bicep_curl_service().health()


@router.post("/load")
def load_bicep_curl_model() -> dict[str, Any]:
    try:
        get_bicep_curl_service().load()
        return {
            "message": "Bicep curl model loaded.",
            "health": get_bicep_curl_service().health(),
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/session/start", response_model=SessionResponse)
def start_session() -> SessionResponse:
    session_id = get_bicep_curl_service().create_session()
    return SessionResponse(
        session_id=session_id,
        message="Bicep curl inference session started.",
    )


async def _wait_for_ice_gathering(peer_connection: Any) -> None:
    if peer_connection.iceGatheringState == "complete":
        return

    completed = asyncio.Event()

    @peer_connection.on("icegatheringstatechange")
    def on_ice_gathering_state_change() -> None:
        if peer_connection.iceGatheringState == "complete":
            completed.set()

    try:
        await asyncio.wait_for(completed.wait(), timeout=2)
    except asyncio.TimeoutError:
        pass


async def _close_webrtc_peer(peer_connection: Any, session_id: str) -> None:
    if peer_connection in _webrtc_peer_connections:
        _webrtc_peer_connections.discard(peer_connection)
    get_bicep_curl_service().delete_session(session_id)
    if peer_connection.connectionState != "closed":
        await peer_connection.close()


@router.post("/webrtc/offer", response_model=WebRtcAnswerResponse)
async def create_bicep_curl_webrtc_answer(payload: WebRtcOfferRequest) -> WebRtcAnswerResponse:
    try:
        from aiortc import RTCPeerConnection, RTCSessionDescription
    except ModuleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="WebRTC support requires aiortc. Install model gateway dependencies.",
        ) from exc

    service = get_bicep_curl_service()
    session_id = service.create_session()
    peer_connection = RTCPeerConnection()
    _webrtc_peer_connections.add(peer_connection)

    @peer_connection.on("connectionstatechange")
    async def on_connection_state_change() -> None:
        if peer_connection.connectionState in {"closed", "failed", "disconnected"}:
            await _close_webrtc_peer(peer_connection, session_id)

    @peer_connection.on("datachannel")
    def on_datachannel(channel: Any) -> None:
        def send_json(payload: dict[str, Any]) -> None:
            if channel.readyState == "open":
                channel.send(json.dumps(payload))

        @channel.on("open")
        def on_open() -> None:
            send_json(
                {
                    "type": "session_started",
                    "session_id": session_id,
                    "message": "Bicep curl inference WebRTC data channel started.",
                }
            )

        @channel.on("message")
        def on_message(raw_message: str | bytes) -> None:
            async def handle_message() -> None:
                try:
                    if isinstance(raw_message, bytes):
                        message_payload = json.loads(raw_message.decode("utf-8"))
                    else:
                        message_payload = json.loads(raw_message)
                    send_json(await _process_realtime_message(session_id, message_payload))
                except (RuntimeError, ValueError, ValidationError, json.JSONDecodeError) as exc:
                    send_json(
                        {
                            "type": "error",
                            "session_id": session_id,
                            "message": str(exc),
                        }
                    )

            asyncio.create_task(handle_message())

        if channel.readyState == "open":
            on_open()

    try:
        offer = RTCSessionDescription(sdp=payload.sdp, type=payload.type)
        await peer_connection.setRemoteDescription(offer)
        answer = await peer_connection.createAnswer()
        await peer_connection.setLocalDescription(answer)
        await _wait_for_ice_gathering(peer_connection)
    except Exception as exc:
        await _close_webrtc_peer(peer_connection, session_id)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid WebRTC offer: {exc}",
        ) from exc

    return WebRtcAnswerResponse(
        sdp=peer_connection.localDescription.sdp,
        type=peer_connection.localDescription.type,
    )


@router.post("/session/{session_id}/frame")
def process_frame(session_id: str, payload: FrameRequest) -> dict[str, Any]:
    try:
        return get_bicep_curl_service().process_frame(session_id, payload.landmarks)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/session/{session_id}/frame-image")
def process_image_frame(session_id: str, payload: ImageFrameRequest) -> dict[str, Any]:
    try:
        return get_bicep_curl_service().process_image_frame(session_id, payload.image_base64)
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/session/{session_id}/reset")
def reset_session(session_id: str) -> dict[str, Any]:
    get_bicep_curl_service().reset_session(session_id)
    return {"session_id": session_id, "message": "Bicep curl session reset."}


@router.delete("/session/{session_id}")
def delete_session(session_id: str) -> dict[str, Any]:
    deleted = get_bicep_curl_service().delete_session(session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown bicep curl session_id: {session_id}",
        )
    return {"session_id": session_id, "message": "Bicep curl session deleted."}


@router.post("/predict-rep")
def predict_rep(payload: RepPredictionRequest) -> dict[str, Any]:
    try:
        prediction = get_bicep_curl_service().predict_rep(payload.frames)
        return {
            "label": prediction.label,
            "probability": round(prediction.probability, 4),
            "confidence": round(prediction.confidence, 4),
        }
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
