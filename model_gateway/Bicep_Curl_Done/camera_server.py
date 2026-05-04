from pathlib import Path
import sys

MODEL_GATEWAY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(MODEL_GATEWAY_ROOT))

from app.main import app
