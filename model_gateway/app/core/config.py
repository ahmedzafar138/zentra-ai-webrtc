from functools import lru_cache
from pathlib import Path
import os

from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Runtime settings for the model gateway."""

    app_name: str = "Zentra Model Gateway"
    api_prefix: str = "/api/v1"
    cors_origins: list[str] = Field(default_factory=lambda: ["*"])
    bicep_curl_model_path: Path
    bicep_curl_reps_path: Path
    bicep_curl_up_threshold: float = 80.0
    bicep_curl_down_threshold: float = 130.0
    bicep_curl_min_frames: int = 3
    bicep_curl_min_rep_frames: int = 11
    load_models_on_startup: bool = False


def _gateway_root() -> Path:
    return Path(__file__).resolve().parents[2]


@lru_cache
def get_settings() -> Settings:
    root = _gateway_root()
    model_dir = root / "Bicep_Curl_Done"

    origins = os.getenv("MODEL_GATEWAY_CORS_ORIGINS", "*")
    cors_origins = [origin.strip() for origin in origins.split(",") if origin.strip()]

    return Settings(
        cors_origins=cors_origins or ["*"],
        bicep_curl_model_path=Path(
            os.getenv("BICEP_CURL_MODEL_PATH", model_dir / "Try_2.keras")
        ),
        bicep_curl_reps_path=Path(
            os.getenv("BICEP_CURL_REPS_PATH", model_dir / "reps2.pkl")
        ),
        bicep_curl_up_threshold=float(os.getenv("BICEP_CURL_UP_THRESHOLD", "80")),
        bicep_curl_down_threshold=float(os.getenv("BICEP_CURL_DOWN_THRESHOLD", "130")),
        bicep_curl_min_frames=int(os.getenv("BICEP_CURL_MIN_FRAMES", "3")),
        bicep_curl_min_rep_frames=int(os.getenv("BICEP_CURL_MIN_REP_FRAMES", "11")),
        load_models_on_startup=os.getenv("MODEL_GATEWAY_LOAD_MODELS_ON_STARTUP", "false").lower()
        in {"1", "true", "yes", "on"},
    )
