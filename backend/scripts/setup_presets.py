import os
import json
import shutil
import urllib.request
import urllib.parse
from pathlib import Path

# Thư mục gốc của backend
BASE_DIR = Path(__file__).parent.parent
PRESETS_DIR = BASE_DIR / "presets"
OUTPUTS_DIR = BASE_DIR / "outputs"

PRESETS_DIR.mkdir(parents=True, exist_ok=True)

# URL API của FastAPI đang chạy (giả sử là port 8000)
API_URL = "http://localhost:8000/api/tts"

voices_json_path = PRESETS_DIR / "voices.json"
if voices_json_path.exists():
    with open(voices_json_path, 'r', encoding='utf-8') as f:
        voices_metadata = json.load(f)
else:
    print("Không tìm thấy voices.json")
    voices_metadata = []

print("Bắt đầu sinh các giọng mẫu (sử dụng API đang chạy tại http://localhost:8000)...")

for voice in voices_metadata:
    voice_id = voice["id"]
    text = voice["prompt_text"]
    
    dest_wav = PRESETS_DIR / f"{voice_id}.wav"
    if dest_wav.exists():
        print(f"[{voice_id}] Đã tồn tại, bỏ qua sinh audio.")
        voice["url"] = f"http://localhost:8000/presets/{voice_id}.wav"
        continue

    print(f"[{voice_id}] Đang sinh giọng: {voice['name']}...")
    
    # Payload cho API
    payload = {
        "text": text,
        "cfg_value": 2.0,
        "inference_timesteps": 25,  # Chất lượng cao
        "normalize": True
    }
    
    req = urllib.request.Request(
        API_URL, 
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            
            # API trả về: {"message": "...", "filename": "tts_xyz.wav", "audio_url": "..."}
            filename = res_data["filename"]
            source_wav = OUTPUTS_DIR / filename
            dest_wav = PRESETS_DIR / f"{voice_id}.wav"
            
            # Di chuyển file từ outputs sang presets
            shutil.move(str(source_wav), str(dest_wav))
            
            # Cập nhật URL trong metadata
            voice["url"] = f"http://localhost:8000/presets/{voice_id}.wav"
            print(f"[{voice_id}] -> Thành công!")
            
    except Exception as e:
        print(f"[{voice_id}] Lỗi: {str(e)}")

# Lưu voices.json
voices_json_path = PRESETS_DIR / "voices.json"
with open(voices_json_path, 'w', encoding='utf-8') as f:
    json.dump(voices_metadata, f, ensure_ascii=False, indent=2)
    
print(f"Đã lưu metadata tại {voices_json_path}")
print("Hoàn tất!")
