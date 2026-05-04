from __future__ import annotations

import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.bicep_curl_service import get_bicep_curl_service


def frame_for_angle(angle_degrees: float) -> list[list[float]]:
    """Build a synthetic 8x4 landmark frame with the requested right-elbow angle."""

    landmarks = [[0.0, 0.0, 0.0, 1.0] for _ in range(8)]
    shoulder = [0.0, 0.0, 0.0, 1.0]
    elbow = [1.0, 0.0, 0.0, 1.0]
    theta = math.radians(180.0 - angle_degrees)
    wrist = [1.0 + math.cos(theta), math.sin(theta), 0.0, 1.0]

    landmarks[2] = shoulder
    landmarks[4] = elbow
    landmarks[6] = wrist
    return landmarks


def main() -> None:
    service = get_bicep_curl_service()
    service.load()
    session_id = service.create_session()

    responses = []
    for angle in [140.0] * 3 + [60.0] * 3 + [70.0] * 12 + [140.0] * 3:
        responses.append(service.process_frame(session_id, frame_for_angle(angle)))

    final = responses[-1]
    print("loaded:", service.health()["loaded"])
    print("max_sequence_length:", service.health()["max_sequence_length"])
    print("session_id:", session_id)
    print("final_status:", final["status"])
    print("rep_completed:", final["rep_completed"])
    print("rep_count:", final["rep_count"])
    print("prediction:", final["last_prediction"])


if __name__ == "__main__":
    main()
