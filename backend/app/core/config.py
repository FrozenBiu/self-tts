import os
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Đường dẫn thư mục gốc backend (thư mục chứa main.py)
BASE_DIR = Path(__file__).resolve().parent.parent.parent
OUTPUTS_DIR = BASE_DIR / "outputs"
OUTPUTS_DIR.mkdir(exist_ok=True)

CAPTIONS_DIR = OUTPUTS_DIR / "captions"
CAPTIONS_DIR.mkdir(exist_ok=True)

PRESETS_DIR = BASE_DIR / "presets"
PRESETS_DIR.mkdir(exist_ok=True)

CUSTOM_VOICES_DIR = PRESETS_DIR / "custom"
CUSTOM_VOICES_DIR.mkdir(exist_ok=True)

CUSTOM_VOICES_JSON = PRESETS_DIR / "custom_voices.json"
if not CUSTOM_VOICES_JSON.exists():
    with open(CUSTOM_VOICES_JSON, "w", encoding="utf-8") as f:
        f.write("[]")

DEFAULT_NUM_STEP = int(os.getenv("DEFAULT_NUM_STEP", "32"))

# Logging cấu hình chung
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("omnivoice")
