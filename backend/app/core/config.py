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

SYSTEM_PRESETS_DIR = BASE_DIR / "presets"
PRESETS_DIR = DATA_DIR / "presets"
PRESETS_DIR.mkdir(parents=True, exist_ok=True)

CUSTOM_VOICES_DIR = PRESETS_DIR / "custom"
CUSTOM_VOICES_DIR.mkdir(parents=True, exist_ok=True)

CUSTOM_VOICES_JSON = PRESETS_DIR / "custom_voices.json"


def sync_system_presets() -> None:
    """
    Đồng bộ và sao chép đầy đủ các preset hệ thống (voices.json, custom_voices.json, các file .pt/.wav, custom/ và bgm/)
    từ SYSTEM_PRESETS_DIR sang thư mục dữ liệu người dùng (PRESETS_DIR).
    Đảm bảo mọi giọng mặc định (Nhật Phong, Ngọc Huyền, Nam Điềm Đạm...) và file nghe thử luôn sẵn sàng.
    """
    if not SYSTEM_PRESETS_DIR.exists():
        return

    try:
        import shutil
        import json

        # 1. Đồng bộ voices.json nếu chưa có
        system_voices_json = SYSTEM_PRESETS_DIR / "voices.json"
        target_voices_json = PRESETS_DIR / "voices.json"
        if system_voices_json.exists() and not target_voices_json.exists():
            try:
                shutil.copy2(system_voices_json, target_voices_json)
            except Exception as e:
                logging.warning(f"Không thể sao chép voices.json: {e}")

        # 2. Đồng bộ các file audio / prompt gốc trong presets/ (male_1.pt, male_1.wav, female_1.wav...)
        for src_file in SYSTEM_PRESETS_DIR.iterdir():
            if src_file.is_file() and src_file.suffix.lower() in (".pt", ".wav", ".mp3", ".json"):
                dst_file = PRESETS_DIR / src_file.name
                if not dst_file.exists():
                    try:
                        shutil.copy2(src_file, dst_file)
                    except Exception as e:
                        logging.warning(f"Không thể sao chép {src_file.name}: {e}")

        # 3. Đồng bộ thư mục presets/custom/ (chứa các giọng mẫu như Nhật Phong, Ngọc Huyền...)
        system_custom_dir = SYSTEM_PRESETS_DIR / "custom"
        if system_custom_dir.exists():
            for src_file in system_custom_dir.iterdir():
                if src_file.is_file():
                    dst_file = CUSTOM_VOICES_DIR / src_file.name
                    if not dst_file.exists():
                        try:
                            shutil.copy2(src_file, dst_file)
                        except Exception as e:
                            logging.warning(f"Không thể sao chép custom voice {src_file.name}: {e}")

        # 4. Đồng bộ thư mục presets/bgm/
        system_bgm_dir = SYSTEM_PRESETS_DIR / "bgm"
        target_bgm_dir = PRESETS_DIR / "bgm"
        target_bgm_dir.mkdir(parents=True, exist_ok=True)
        if system_bgm_dir.exists():
            for src_file in system_bgm_dir.iterdir():
                if src_file.is_file():
                    dst_file = target_bgm_dir / src_file.name
                    if not dst_file.exists():
                        try:
                            shutil.copy2(src_file, dst_file)
                        except Exception as e:
                            logging.warning(f"Không thể sao chép BGM {src_file.name}: {e}")

        # 5. Đồng bộ và hợp nhất custom_voices.json
        system_cv_json = SYSTEM_PRESETS_DIR / "custom_voices.json"
        if system_cv_json.exists():
            if not CUSTOM_VOICES_JSON.exists():
                try:
                    shutil.copy2(system_cv_json, CUSTOM_VOICES_JSON)
                except Exception:
                    with open(CUSTOM_VOICES_JSON, "w", encoding="utf-8") as f:
                        f.write("[]")
            else:
                try:
                    with open(CUSTOM_VOICES_JSON, "r", encoding="utf-8") as f:
                        user_cv = json.load(f)
                    with open(system_cv_json, "r", encoding="utf-8") as f:
                        system_cv = json.load(f)

                    if not isinstance(user_cv, list):
                        user_cv = []

                    user_ids = {item.get("id") for item in user_cv if isinstance(item, dict)}
                    changed = False
                    for sys_item in system_cv:
                        if isinstance(sys_item, dict) and sys_item.get("id") not in user_ids:
                            user_cv.append(sys_item)
                            changed = True

                    if changed:
                        with open(CUSTOM_VOICES_JSON, "w", encoding="utf-8") as f:
                            json.dump(user_cv, f, ensure_ascii=False, indent=2)
                except Exception as e:
                    logging.warning(f"Lỗi khi kiểm tra và hợp nhất custom_voices.json: {e}")
        elif not CUSTOM_VOICES_JSON.exists():
            with open(CUSTOM_VOICES_JSON, "w", encoding="utf-8") as f:
                f.write("[]")

    except Exception as exc:
        logging.warning(f"Lỗi khi đồng bộ system presets: {exc}")


sync_system_presets()

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
