import cv2
import numpy as np
import tensorflow as tf
import pickle
from pathlib import Path
import mediapipe as mp
from tensorflow.keras.preprocessing.sequence import pad_sequences

MODEL_PATH = Path("Try_2.keras")
PKL_PATH   = Path("reps2.pkl")

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

SELECTED_LANDMARKS = [
    mp_pose.PoseLandmark.RIGHT_HIP,
    mp_pose.PoseLandmark.LEFT_HIP,
    mp_pose.PoseLandmark.RIGHT_SHOULDER,
    mp_pose.PoseLandmark.LEFT_SHOULDER,
    mp_pose.PoseLandmark.RIGHT_ELBOW,
    mp_pose.PoseLandmark.LEFT_ELBOW,
    mp_pose.PoseLandmark.RIGHT_WRIST,
    mp_pose.PoseLandmark.LEFT_WRIST
]

def extract_keypoints(results):
    if results.pose_landmarks:
        return [[results.pose_landmarks.landmark[lm].x,
                 results.pose_landmarks.landmark[lm].y,
                 results.pose_landmarks.landmark[lm].z,
                 results.pose_landmarks.landmark[lm].visibility] 
                for lm in SELECTED_LANDMARKS]
    else:
        return [[0]*4 for _ in SELECTED_LANDMARKS]

def calculate_angle(a, b, c):
    a, b, c = np.array(a[:2]), np.array(b[:2]), np.array(c[:2])
    ba, bc = a-b, c-b
    cos_angle = np.dot(ba, bc)/(np.linalg.norm(ba)*np.linalg.norm(bc)+1e-6)
    return np.degrees(np.arccos(np.clip(cos_angle, -1, 1)))

print("Loading model...")
model = tf.keras.models.load_model(MODEL_PATH)

with open(PKL_PATH, 'rb') as f:
    data = pickle.load(f)
max_len = max(len(d['frames']) for d in data)
print("Max sequence length from training:", max_len)

cap = cv2.VideoCapture(0)

direction = 0
UP_THRESHOLD, DOWN_THRESHOLD, MIN_FRAMES = 80, 130, 3
up_count, down_count = 0, 0
frame_buffer, reps = [], []
rep_counter = 0
last_prediction = ""

with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose.process(rgb)
        keypoints = extract_keypoints(results)

        shoulder, elbow, wrist = keypoints[2], keypoints[4], keypoints[6]
        angle = calculate_angle(shoulder, elbow, wrist)

        if direction == 0 and angle > DOWN_THRESHOLD:
            down_count += 1
            if down_count >= MIN_FRAMES:
                direction = 1
                down_count = 0
        else:
            if direction == 0:
                down_count = 0

        if direction == 1 and angle < UP_THRESHOLD:
            up_count += 1
            if up_count >= MIN_FRAMES:
                direction = 2
                frame_buffer = []
                up_count = 0
        else:
            if direction == 1:
                up_count = 0

        if direction == 2:
            frame_buffer.append(np.array(keypoints).flatten())

        if direction == 2 and angle > DOWN_THRESHOLD:
            down_count += 1
            if down_count >= MIN_FRAMES:
                if len(frame_buffer) > 10:
                    reps.append(np.array(frame_buffer))
                    rep_counter += 1

                    X = pad_sequences([frame_buffer], maxlen=max_len, dtype='float32', padding='post')
                    prob = model.predict(X, verbose=0)[0][0]

                    if prob > 0.5:
                        last_prediction = f"Correct ({prob:.2f})"
                    else:
                        last_prediction = f"Incorrect ({1-prob:.2f})"

                frame_buffer = []
                direction = 0
                down_count = 0
        else:
            if direction == 2:
                down_count = 0

        if results.pose_landmarks:
            mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

        cv2.putText(frame, f"Reps: {rep_counter}", (20, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 255), 3)
        cv2.putText(frame, f"{last_prediction}", (20, 100),
                    cv2.FONT_HERSHEY_SIMPLEX, 1,
                    (0, 255, 0) if "Correct" in last_prediction else (0, 0, 255), 3)

        cv2.imshow("Bicep Curl Real-time Inference", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

cap.release()
cv2.destroyAllWindows()








# This code is correct but not mirrored and without feedback
# import cv2
# import numpy as np
# import tensorflow as tf
# import pickle
# from pathlib import Path
# import mediapipe as mp
# from tensorflow.keras.preprocessing.sequence import pad_sequences

# # ======================
# # Paths
# # ======================
# MODEL_PATH = Path("Try_2.keras")   # trained model
# PKL_PATH   = Path("reps2.pkl")   # for max_len reference

# # ======================
# # Pose setup
# # ======================
# mp_pose = mp.solutions.pose
# mp_drawing = mp.solutions.drawing_utils

# SELECTED_LANDMARKS = [
#     mp_pose.PoseLandmark.RIGHT_HIP,
#     mp_pose.PoseLandmark.LEFT_HIP,
#     mp_pose.PoseLandmark.RIGHT_SHOULDER,
#     mp_pose.PoseLandmark.LEFT_SHOULDER,
#     mp_pose.PoseLandmark.RIGHT_ELBOW,
#     mp_pose.PoseLandmark.LEFT_ELBOW,
#     mp_pose.PoseLandmark.RIGHT_WRIST,
#     mp_pose.PoseLandmark.LEFT_WRIST
# ]

# def extract_keypoints(results):
#     if results.pose_landmarks:
#         return [[results.pose_landmarks.landmark[lm].x,
#                  results.pose_landmarks.landmark[lm].y,
#                  results.pose_landmarks.landmark[lm].z,
#                  results.pose_landmarks.landmark[lm].visibility] 
#                 for lm in SELECTED_LANDMARKS]
#     else:
#         return [[0]*4 for _ in SELECTED_LANDMARKS]

# def calculate_angle(a, b, c):
#     a, b, c = np.array(a[:2]), np.array(b[:2]), np.array(c[:2])
#     ba, bc = a-b, c-b
#     cos_angle = np.dot(ba, bc)/(np.linalg.norm(ba)*np.linalg.norm(bc)+1e-6)
#     return np.degrees(np.arccos(np.clip(cos_angle, -1, 1)))

# # ======================
# # Load Model & Params
# # ======================
# print("Loading model...")
# model = tf.keras.models.load_model(MODEL_PATH)

# with open(PKL_PATH, 'rb') as f:
#     data = pickle.load(f)
# max_len = max(len(d['frames']) for d in data)
# print("Max sequence length from training:", max_len)

# # ======================
# # Real-time Inference
# # ======================
# cap = cv2.VideoCapture(0)  # webcam


# direction = 0   # 0 = waiting for down, 1 = waiting for up, 2 = recording until down
# UP_THRESHOLD, DOWN_THRESHOLD, MIN_FRAMES = 80, 130, 3
# up_count, down_count = 0, 0
# frame_buffer, reps = [], []
# rep_counter = 0
# last_prediction = ""

# with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
#     while cap.isOpened():
#         ret, frame = cap.read()
#         if not ret:
#             break

#         rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
#         results = pose.process(rgb)
#         keypoints = extract_keypoints(results)

#         shoulder, elbow, wrist = keypoints[2], keypoints[4], keypoints[6]
#         angle = calculate_angle(shoulder, elbow, wrist)

#         # --- waiting for DOWN ---
#         if direction == 0 and angle > DOWN_THRESHOLD:
#             down_count += 1
#             if down_count >= MIN_FRAMES:
#                 direction = 1; down_count = 0
#         else:
#             if direction == 0: down_count = 0

#         # --- detect UP ---
#         if direction == 1 and angle < UP_THRESHOLD:
#             up_count += 1
#             if up_count >= MIN_FRAMES:
#                 direction = 2; frame_buffer = []; up_count = 0
#         else:
#             if direction == 1: up_count = 0

#         # --- recording frames ---
#         if direction == 2:
#             frame_buffer.append(np.array(keypoints).flatten())

#         # --- detect DOWN (rep complete) ---
#         if direction == 2 and angle > DOWN_THRESHOLD:
#             down_count += 1
#             if down_count >= MIN_FRAMES:
#                 if len(frame_buffer) > 10:
#                     reps.append(np.array(frame_buffer))
#                     rep_counter += 1

#                     # run inference
#                     X = pad_sequences([frame_buffer], maxlen=max_len, dtype='float32', padding='post')
#                     prob = model.predict(X, verbose=0)[0][0]
#                     if prob > 0.5:
#                         last_prediction = f"✅ Correct ({prob:.2f})"
#                     else:
#                         last_prediction = f"❌ Incorrect ({1-prob:.2f})"

#                 frame_buffer = []; direction = 0; down_count = 0
#         else:
#             if direction == 2: down_count = 0

#         # ======================
#         # Drawing
#         # ======================
#         if results.pose_landmarks:
#             mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

#         cv2.putText(frame, f"Reps: {rep_counter}", (20, 50),
#                     cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 255), 3)
#         cv2.putText(frame, f"{last_prediction}", (20, 100),
#                     cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0) if "Correct" in last_prediction else (0,0,255), 3)

#         cv2.imshow("Bicep Curl Real-time Inference", frame)

#         if cv2.waitKey(1) & 0xFF == ord('q'):
#             break

# cap.release()
# cv2.destroyAllWindows()
# print("Inference session ended.")

# This code is correct but not mirrored and has feedback

# import cv2
# import numpy as np
# import tensorflow as tf
# import pickle
# from pathlib import Path
# import mediapipe as mp
# from tensorflow.keras.preprocessing.sequence import pad_sequences

# # ======================
# # Paths
# # ======================
# MODEL_PATH = Path("Try_2.keras")   # trained model
# PKL_PATH   = Path("reps2.pkl")     # for max_len reference

# # ======================
# # Pose setup
# # ======================
# mp_pose = mp.solutions.pose
# mp_drawing = mp.solutions.drawing_utils

# SELECTED_LANDMARKS = [
#     mp_pose.PoseLandmark.RIGHT_HIP,
#     mp_pose.PoseLandmark.LEFT_HIP,
#     mp_pose.PoseLandmark.RIGHT_SHOULDER,
#     mp_pose.PoseLandmark.LEFT_SHOULDER,
#     mp_pose.PoseLandmark.RIGHT_ELBOW,
#     mp_pose.PoseLandmark.LEFT_ELBOW,
#     mp_pose.PoseLandmark.RIGHT_WRIST,
#     mp_pose.PoseLandmark.LEFT_WRIST
# ]

# def extract_keypoints(results):
#     if results.pose_landmarks:
#         return [[results.pose_landmarks.landmark[lm].x,
#                  results.pose_landmarks.landmark[lm].y,
#                  results.pose_landmarks.landmark[lm].z,
#                  results.pose_landmarks.landmark[lm].visibility] 
#                 for lm in SELECTED_LANDMARKS]
#     else:
#         return [[0]*4 for _ in SELECTED_LANDMARKS]

# def calculate_angle(a, b, c):
#     a, b, c = np.array(a[:2]), np.array(b[:2]), np.array(c[:2])
#     ba, bc = a - b, c - b
#     cos_angle = np.dot(ba, bc)/(np.linalg.norm(ba)*np.linalg.norm(bc)+1e-6)
#     return np.degrees(np.arccos(np.clip(cos_angle, -1, 1)))

# # ======================
# # Form feedback functions
# # ======================
# def compute_velocity(angle_seq, fps=30):
#     return np.diff(angle_seq) * fps

# def compute_jerk(velocity_seq, fps=30):
#     return np.diff(velocity_seq) * fps

# def check_rom(angle_seq, min_angle=40, max_angle=160):
#     min_val, max_val = np.min(angle_seq), np.max(angle_seq)
#     if min_val > min_angle:
#         return f"Joint did not fully bend ({min_val:.1f}° < {min_angle}°)"
#     if max_val < max_angle:
#         return f"Joint did not fully extend ({max_val:.1f}° < {max_angle}°)"
#     return None

# def check_speed(angle_seq, vel_thresh=200, jerk_thresh=500, fps=30):
#     vel = compute_velocity(angle_seq, fps)
#     jerk = compute_jerk(vel, fps)
#     feedback = []
#     if np.max(np.abs(vel)) > vel_thresh:
#         feedback.append("Movement too fast")
#     if np.max(np.abs(jerk)) > jerk_thresh:
#         feedback.append("Jerk detected, move smoother")
#     return feedback if feedback else None

# def check_swing(keypoints_seq, joint_idx1, joint_idx2, max_dev=0.1):
#     seq = np.array(keypoints_seq)[:, joint_idx1, :2] - np.array(keypoints_seq)[:, joint_idx2, :2]
#     lateral_dev = np.max(np.abs(seq[:,0]))
#     if lateral_dev > max_dev:
#         return "Swinging detected"
#     return None

# def analyze_rep(frame_buffer):
#     feedback = []
#     seq = np.array(frame_buffer).reshape(len(frame_buffer), len(SELECTED_LANDMARKS), 4)
#     shoulder, elbow, wrist = 2, 4, 6
#     angle_seq = [calculate_angle(f[shoulder], f[elbow], f[wrist]) for f in seq]

#     # ROM
#     rom_feedback = check_rom(angle_seq)
#     if rom_feedback: feedback.append(rom_feedback)

#     # Speed / jerk
#     speed_feedback = check_speed(angle_seq)
#     if speed_feedback: feedback.extend(speed_feedback)

#     # Swing
#     swing_feedback = check_swing(seq, wrist, shoulder)
#     if swing_feedback: feedback.append(swing_feedback)

#     return feedback if feedback else ["Good form!"]

# # ======================
# # Load model & max_len
# # ======================
# print("Loading model...")
# model = tf.keras.models.load_model(MODEL_PATH)
# with open(PKL_PATH, 'rb') as f:
#     data = pickle.load(f)
# max_len = max(len(d['frames']) for d in data)
# print("Max sequence length from training:", max_len)

# # ======================
# # Real-time inference
# # ======================
# cap = cv2.VideoCapture(0)

# direction = 0   # 0=down, 1=up, 2=recording
# UP_THRESHOLD, DOWN_THRESHOLD, MIN_FRAMES = 80, 130, 3
# up_count, down_count = 0, 0
# frame_buffer, reps = [], []
# rep_counter = 0
# last_prediction = ""
# feedback_text = ""

# with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
#     while cap.isOpened():
#         ret, frame = cap.read()
#         if not ret: break

#         rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
#         results = pose.process(rgb)
#         keypoints = extract_keypoints(results)

#         shoulder, elbow, wrist = keypoints[2], keypoints[4], keypoints[6]
#         angle = calculate_angle(shoulder, elbow, wrist)

#         # --- waiting for DOWN ---
#         if direction == 0 and angle > DOWN_THRESHOLD:
#             down_count += 1
#             if down_count >= MIN_FRAMES: direction = 1; down_count = 0
#         else:
#             if direction == 0: down_count = 0

#         # --- detect UP ---
#         if direction == 1 and angle < UP_THRESHOLD:
#             up_count += 1
#             if up_count >= MIN_FRAMES: direction = 2; frame_buffer = []; up_count = 0
#         else:
#             if direction == 1: up_count = 0

#         # --- recording frames ---
#         if direction == 2:
#             frame_buffer.append(np.array(keypoints).flatten())

#         # --- detect DOWN (rep complete) ---
#         if direction == 2 and angle > DOWN_THRESHOLD:
#             down_count += 1
#             if down_count >= MIN_FRAMES:
#                 if len(frame_buffer) > 10:
#                     reps.append(np.array(frame_buffer))
#                     rep_counter += 1

#                     # Classifier
#                     X = pad_sequences([frame_buffer], maxlen=max_len, dtype='float32', padding='post')
#                     prob = model.predict(X, verbose=0)[0][0]
#                     if prob > 0.5:
#                         last_prediction = f"✅ Correct ({prob:.2f})"
#                     else:
#                         last_prediction = f"❌ Incorrect ({1-prob:.2f})"

#                     # Form feedback
#                     rep_feedback = analyze_rep(frame_buffer)
#                     feedback_text = "; ".join(rep_feedback)
#                     print(f"Rep {rep_counter} feedback: {feedback_text}")

#                 frame_buffer = []; direction = 0; down_count = 0
#         else:
#             if direction == 2: down_count = 0

#         # ======================
#         # Drawing
#         # ======================
#         if results.pose_landmarks:
#             mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

#         cv2.putText(frame, f"Reps: {rep_counter}", (20, 50),
#                     cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 255, 255), 3)
#         cv2.putText(frame, f"{last_prediction}", (20, 100),
#                     cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0) if "Correct" in last_prediction else (0,0,255), 3)
#         cv2.putText(frame, f"{feedback_text}", (20, 150),
#                     cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)

#         cv2.imshow("Bicep Curl Real-time Feedback", frame)

#         if cv2.waitKey(1) & 0xFF == ord('q'): break

# cap.release()
# cv2.destroyAllWindows()



# import cv2
# import numpy as np
# import tensorflow as tf
# import pickle
# from pathlib import Path
# import mediapipe as mp
# from tensorflow.keras.preprocessing.sequence import pad_sequences

# # ======================
# # Paths
# # ======================
# MODEL_PATH = Path("Try_2.keras")
# PKL_PATH   = Path("reps2.pkl")

# # ======================
# # Pose setup
# # ======================
# mp_pose = mp.solutions.pose
# mp_drawing = mp.solutions.drawing_utils

# SELECTED_LANDMARKS = [
#     mp_pose.PoseLandmark.RIGHT_HIP,
#     mp_pose.PoseLandmark.LEFT_HIP,
#     mp_pose.PoseLandmark.RIGHT_SHOULDER,
#     mp_pose.PoseLandmark.LEFT_SHOULDER,
#     mp_pose.PoseLandmark.RIGHT_ELBOW,
#     mp_pose.PoseLandmark.LEFT_ELBOW,
#     mp_pose.PoseLandmark.RIGHT_WRIST,
#     mp_pose.PoseLandmark.LEFT_WRIST
# ]

# def extract_keypoints(results):
#     if results.pose_landmarks:
#         return [[results.pose_landmarks.landmark[lm].x,
#                  results.pose_landmarks.landmark[lm].y,
#                  results.pose_landmarks.landmark[lm].z,
#                  results.pose_landmarks.landmark[lm].visibility] 
#                 for lm in SELECTED_LANDMARKS]
#     else:
#         return [[0]*4 for _ in SELECTED_LANDMARKS]

# def calculate_angle(a, b, c):
#     a, b, c = np.array(a[:2]), np.array(b[:2]), np.array(c[:2])
#     ba, bc = a-b, c-b
#     cos_angle = np.dot(ba, bc)/(np.linalg.norm(ba)*np.linalg.norm(bc)+1e-6)
#     return np.degrees(np.arccos(np.clip(cos_angle, -1, 1)))

# # ======================
# # Load Model & Params
# # ======================
# print("Loading model...")
# model = tf.keras.models.load_model(MODEL_PATH)

# with open(PKL_PATH, 'rb') as f:
#     data = pickle.load(f)
# max_len = max(len(d['frames']) for d in data)
# print("Max sequence length from training:", max_len)

# # ======================
# # Real-time Inference
# # ======================
# cap = cv2.VideoCapture(0)

# direction = 0
# UP_THRESHOLD, DOWN_THRESHOLD, MIN_FRAMES = 80, 130, 3
# up_count, down_count = 0, 0
# frame_buffer, reps = [], []
# rep_counter = 0
# classification_text = "none"
# prob_display = 0.0

# with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
#     while cap.isOpened():
#         ret, frame = cap.read()
#         if not ret:
#             break

#         rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
#         results = pose.process(rgb)
#         keypoints = extract_keypoints(results)

#         shoulder, elbow, wrist = keypoints[2], keypoints[4], keypoints[6]
#         angle = calculate_angle(shoulder, elbow, wrist)

#         # ==== DOWN Detection ====
#         if direction == 0 and angle > DOWN_THRESHOLD:
#             down_count += 1
#             if down_count >= MIN_FRAMES:
#                 direction = 1; down_count = 0
#         else:
#             if direction == 0: down_count = 0

#         # ==== UP Detection ====
#         if direction == 1 and angle < UP_THRESHOLD:
#             up_count += 1
#             if up_count >= MIN_FRAMES:
#                 direction = 2; frame_buffer = []; up_count = 0
#         else:
#             if direction == 1: up_count = 0

#         # ==== Recording ====
#         if direction == 2:
#             frame_buffer.append(np.array(keypoints).flatten())

#         # ==== BACK DOWN = Rep Completed ====
#         if direction == 2 and angle > DOWN_THRESHOLD:
#             down_count += 1
#             if down_count >= MIN_FRAMES:
#                 if len(frame_buffer) > 10:

#                     # Run model inference
#                     X = pad_sequences([frame_buffer], maxlen=max_len, dtype='float32', padding='post')
#                     prob = model.predict(X, verbose=0)[0][0]
#                     prob_display = prob

#                     if prob > 0.5:
#                         classification_text = "Correct"
#                     else:
#                         classification_text = "Incorrect"

#                     rep_counter += 1

#                 frame_buffer = []; direction = 0; down_count = 0
#         else:
#             if direction == 2: down_count = 0

#         # ======================
#         # GUI DRAWING LIKE YOUR SCREENSHOT
#         # ======================
#         h, w, _ = frame.shape

#         # Blue top bar background
#         cv2.rectangle(frame, (0, 0), (w, 100), (255, 255, 255), -1)

#         # --- Classification Box ---
#         cv2.rectangle(frame, (20, 20), (220, 90), (255,0,0), -1)
#         cv2.putText(frame, "CLASSIFICATION", (30, 40),
#                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2)
#         cv2.putText(frame, classification_text, (30, 80),
#                     cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2)

#         # --- Reps Box ---
#         cv2.rectangle(frame, (250, 20), (420, 90), (255,0,0), -1)
#         cv2.putText(frame, "REPS", (260, 40),
#                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2)
#         cv2.putText(frame, str(rep_counter), (260, 80),
#                     cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2)

#         # --- Probability Box ---
#         cv2.rectangle(frame, (460, 20), (620, 90), (255,0,0), -1)
#         cv2.putText(frame, "PROB", (470, 40),
#                     cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2)
#         cv2.putText(frame, f"{prob_display:.2f}", (470, 80),
#                     cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255,255,255), 2)

#         # Draw pose
#         if results.pose_landmarks:
#             mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

#         cv2.imshow("Zentra - Real-time Classification", frame)

#         if cv2.waitKey(1) & 0xFF == ord('q'):
#             break

# cap.release()
# cv2.destroyAllWindows()
