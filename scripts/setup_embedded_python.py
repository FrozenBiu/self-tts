"""
setup_embedded_python.py
─────────────────────────
Tự động thiết lập môi trường Python 3.10 Embeddable siêu nhẹ (~40MB nén)
để nhúng trực tiếp vào bộ cài OmniVoice Studio Setup (.exe).
"""

import os
import sys
import shutil
import urllib.request
import zipfile
import subprocess
from pathlib import Path

# Đảm bảo in tiếng Việt không bị lỗi cp1252 trên Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
RUNTIME_DIR = ROOT_DIR / "python_runtime"
ZIP_URL = "https://www.python.org/ftp/python/3.10.11/python-3.10.11-embed-amd64.zip"
GET_PIP_URL = "https://bootstrap.pypa.io/get-pip.py"

PACKAGES = [
    "fastapi>=0.110.0",
    "uvicorn>=0.28.0",
    "requests>=2.31.0",
    "httpx>=0.27.0",
    "python-dotenv>=1.0.1",
    "pydantic>=2.6.0",
    "pydantic-settings>=2.2.0",
    "motor>=3.4.0",
    "boto3>=1.34.0",
    "soundfile>=0.12.1",
    "numpy>=1.26.0,<2.0.0",
    "scipy>=1.12.0",
    "python-multipart>=0.0.9",
]

def log(msg: str):
    print(f"[Python-Embed] {msg}", flush=True)

def main():
    log(f"Thư mục đích: {RUNTIME_DIR}")

    python_exe = RUNTIME_DIR / "python.exe"
    if python_exe.exists():
        log("✅ Thư mục python_runtime đã tồn tại. Kiểm tra tính toàn vẹn...")
        test = subprocess.run([str(python_exe), "-c", "import _socket, fastapi, uvicorn, httpx; print('OK')"], capture_output=True, text=True)
        if test.returncode == 0 and "OK" in test.stdout:
            log("✅ Python runtime đã sẵn sàng và hoạt động hoàn hảo!")
            return

    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    zip_path = ROOT_DIR / "python-3.10.11-embed-amd64.zip"

    # 1. Tải zip nếu chưa có
    if not zip_path.exists():
        log(f"Đang tải Python 3.10 Embeddable từ {ZIP_URL}...")
        urllib.request.urlretrieve(ZIP_URL, str(zip_path))
        log("✅ Tải hoàn tất.")

    # 2. Giải nén vào RUNTIME_DIR
    log(f"Đang giải nén vào {RUNTIME_DIR}...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(RUNTIME_DIR)

    # 3. Sửa file python310._pth để cho phép nạp site-packages
    pth_file = RUNTIME_DIR / "python310._pth"
    if pth_file.exists():
        content = pth_file.read_text(encoding="utf-8")
        # Bỏ comment 'import site'
        new_content = content.replace("#import site", "import site").replace("# import site", "import site")
        if "import site" not in new_content:
            new_content += "\nimport site\n"
        # Thêm Lib/site-packages, ../backend, backend nếu chưa có
        for p in ["Lib/site-packages", ".", "../backend", "backend"]:
            if p not in new_content.splitlines():
                new_content = f"{p}\n" + new_content
        pth_file.write_text(new_content, encoding="utf-8")
        log("✅ Đã cấu hình python310._pth cho phép nạp site-packages và backend.")

    # 4. Tải get-pip.py
    get_pip_path = RUNTIME_DIR / "get-pip.py"
    log("Đang tải get-pip.py...")
    urllib.request.urlretrieve(GET_PIP_URL, str(get_pip_path))

    # 5. Cài đặt pip
    log("Đang cài đặt pip...")
    res = subprocess.run([str(python_exe), str(get_pip_path), "--no-warn-script-location"], capture_output=True, text=True)
    if res.returncode != 0:
        log(f"❌ Lỗi cài đặt pip: {res.stderr}")
        sys.exit(1)
    if get_pip_path.exists():
        get_pip_path.unlink()
    log("✅ Cài đặt pip thành công.")

    # 6. Cài đặt các gói cần thiết
    log("Đang cài đặt các thư viện Web nhẹ (FastAPI, Uvicorn, Soundfile, HTTPX...)...")
    cmd = [
        str(python_exe), "-m", "pip", "install",
        "--force-reinstall",
        "--no-warn-script-location",
        "--prefer-binary",
        *PACKAGES
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        log(f"❌ Lỗi cài đặt thư viện: {res.stderr}")
        sys.exit(1)
    log("✅ Đã cài đặt thành công các thư viện cần thiết!")

    # 7. Dọn dẹp cache
    subprocess.run([str(python_exe), "-m", "pip", "cache", "purge"], capture_output=True)
    if zip_path.exists():
        zip_path.unlink()

    # 8. Test runtime
    log("Đang kiểm thử bộ Python Portable...")
    test = subprocess.run([str(python_exe), "-c", "import fastapi, uvicorn, requests, httpx, soundfile, numpy, scipy; print('PORTABLE PYTHON READY!')"], capture_output=True, text=True)
    if test.returncode == 0 and "PORTABLE PYTHON READY!" in test.stdout:
        log("🎉 THÀNH CÔNG: Python Portable siêu nhẹ đã sẵn sàng để nhúng vào Installer!")
    else:
        log(f"❌ Kiểm thử thất bại: {test.stderr}")
        sys.exit(1)

if __name__ == "__main__":
    main()
