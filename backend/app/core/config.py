import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Đường dẫn thư mục gốc backend (thư mục chứa main.py)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Tải cấu hình .env từ ENV_FILE_PATH nếu có
_env_path_str = os.getenv("ENV_FILE_PATH", "").strip()
ENV_FILE_PATH = Path(_env_path_str) if _env_path_str else (BASE_DIR / ".env")
if ENV_FILE_PATH.exists():
    load_dotenv(dotenv_path=ENV_FILE_PATH)
else:
    load_dotenv()

# Xác định thư mục lưu trữ có quyền ghi (USER_DATA_DIR khi chạy trên Desktop đã cài đặt)
_user_data_env = os.getenv("USER_DATA_DIR", "").strip()
if _user_data_env:
    DATA_DIR = Path(_user_data_env)
else:
    try:
        test_file = BASE_DIR / ".write_test"
        test_file.touch()
        test_file.unlink()
        DATA_DIR = BASE_DIR
    except (PermissionError, OSError):
        DATA_DIR = Path.home() / "Documents" / "OmniVoice Studio"

DATA_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR = DATA_DIR / "outputs"
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

# Thư mục lưu file âm thanh (Audio) - hỗ trợ cấu hình tùy biến
_custom_audios = os.getenv("CUSTOM_AUDIOS_DIR", "").strip()
AUDIOS_DIR = Path(_custom_audios) if _custom_audios else (OUTPUTS_DIR / "audios")
AUDIOS_DIR.mkdir(parents=True, exist_ok=True)

# Thư mục lưu video Auto Caption - hỗ trợ cấu hình tùy biến
_custom_videos = os.getenv("CUSTOM_VIDEOS_DIR", "").strip()
CAPTIONS_DIR = Path(_custom_videos) if _custom_videos else (OUTPUTS_DIR / "captions")
CAPTIONS_DIR.mkdir(parents=True, exist_ok=True)

PRESETS_DIR = DATA_DIR / "presets"
PRESETS_DIR.mkdir(parents=True, exist_ok=True)

CUSTOM_VOICES_DIR = PRESETS_DIR / "custom"
CUSTOM_VOICES_DIR.mkdir(parents=True, exist_ok=True)

CUSTOM_VOICES_JSON = PRESETS_DIR / "custom_voices.json"
if not CUSTOM_VOICES_JSON.exists():
    default_json = BASE_DIR / "presets" / "custom_voices.json"
    if default_json.exists():
        try:
            import shutil
            shutil.copy2(default_json, CUSTOM_VOICES_JSON)
        except Exception:
            with open(CUSTOM_VOICES_JSON, "w", encoding="utf-8") as f:
                f.write("[]")
    else:
        with open(CUSTOM_VOICES_JSON, "w", encoding="utf-8") as f:
            f.write("[]")

DEFAULT_NUM_STEP = int(os.getenv("DEFAULT_NUM_STEP", "32"))

# Cấu hình Đồng bộ Đa thiết bị (Cloud Storage & Database)
MONGODB_URI = os.getenv("MONGODB_URI", "").strip()
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "omnivoice").strip()

R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "").strip()
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "").strip()
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "").strip()
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "").strip()
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "").strip().rstrip("/")

import sys
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Logging cấu hình chung
_log_handler = logging.StreamHandler(sys.stdout)
_log_handler.setFormatter(
    logging.Formatter("%(asctime)s [%(levelname)s] %(name)s — %(message)s", datefmt="%H:%M:%S")
)
logging.basicConfig(
    level=logging.INFO,
    handlers=[_log_handler],
)
logger = logging.getLogger("omnivoice")
