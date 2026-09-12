import os
import json
import uuid
import shutil
import hashlib
import random as _random
from pathlib import Path
from fastapi import HTTPException, UploadFile, BackgroundTasks

import librosa
import soundfile as sf

from app.core.config import (
    BASE_DIR,
    OUTPUTS_DIR,
    PRESETS_DIR,
    CUSTOM_VOICES_DIR,
    CUSTOM_VOICES_JSON,
    logger,
)
from app.services.tts_service import cleanup_old_files
from model_handler import (
    SAMPLE_RATE,
    create_voice_prompt,
    generate_audio,
)

_RANDOM_GENDER = ["male", "female"]
_RANDOM_AGE = ["child", "teenager", "young adult", "middle-aged", "elderly"]
_RANDOM_PITCH = [
    "very low pitch", "low pitch", "moderate pitch", "high pitch", "very high pitch",
]
_RANDOM_STYLE = [None, None, None, "whisper"]


async def fetch_all_voices() -> list[dict]:
    voices = []
    voices_json = PRESETS_DIR / "voices.json"
    if voices_json.exists():
        with open(voices_json, "r", encoding="utf-8") as f:
            voices.extend(json.load(f))

    if CUSTOM_VOICES_JSON.exists():
        with open(CUSTOM_VOICES_JSON, "r", encoding="utf-8") as f:
            custom_voices = json.load(f)
            voices.extend(custom_voices)

    return voices


async def clone_custom_voice(
    file: UploadFile,
    name: str,
    transcript: str | None,
    description: str,
    gender: str,
    icon: str,
) -> dict:
    if not file.filename.lower().endswith((".wav", ".mp3", ".m4a", ".webm", ".ogg")):
        raise HTTPException(
            status_code=400, detail="Chỉ hỗ trợ file wav, mp3, m4a, webm, ogg"
        )

    custom_id = f"custom_{uuid.uuid4().hex[:8]}"
    temp_path = BASE_DIR / f"temp_{custom_id}_{file.filename}"

    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        y, sr = librosa.load(temp_path, sr=SAMPLE_RATE, duration=15.0)

        wav_path = CUSTOM_VOICES_DIR / f"{custom_id}.wav"
        sf.write(str(wav_path), y, sr)

        pt_path = CUSTOM_VOICES_DIR / f"{custom_id}.pt"
        has_pt = False
        try:
            prompt = create_voice_prompt(
                ref_audio=str(wav_path),
                ref_text=transcript if (transcript and transcript.strip()) else None,
            )
            prompt.save(str(pt_path))
            has_pt = True
            logger.info(f"✅ Đã tạo và lưu cache VoiceClonePrompt: {pt_path.name}")
        except Exception as pe:
            logger.warning(f"⚠️ Không thể tạo trước prompt .pt (sẽ tạo lại khi gọi tts): {pe}")

        custom_voices = []
        if CUSTOM_VOICES_JSON.exists():
            with open(CUSTOM_VOICES_JSON, "r", encoding="utf-8") as f:
                custom_voices = json.load(f)

        new_voice = {
            "id": custom_id,
            "name": name,
            "gender": gender,
            "description": description,
            "icon": icon,
            "url": f"http://localhost:8000/presets/custom/{custom_id}.wav",
            "prompt_text": transcript or "",
            "type": "custom",
            "has_cache_pt": has_pt,
        }
        custom_voices.append(new_voice)

        with open(CUSTOM_VOICES_JSON, "w", encoding="utf-8") as f:
            json.dump(custom_voices, f, ensure_ascii=False, indent=2)

        return {
            "message": "Clone giọng đọc thành công!",
            "voice": new_voice,
            "pt_cached": has_pt,
        }

    except Exception as e:
        logger.exception("Lỗi khi clone giọng đọc")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path.exists():
            temp_path.unlink()


async def remove_custom_voice(voice_id: str) -> dict:
    if not voice_id.startswith("custom_"):
        raise HTTPException(status_code=400, detail="Chỉ được phép xoá giọng tự tạo")

    if CUSTOM_VOICES_JSON.exists():
        with open(CUSTOM_VOICES_JSON, "r", encoding="utf-8") as f:
            custom_voices = json.load(f)

        filtered_voices = [v for v in custom_voices if v["id"] != voice_id]

        if len(filtered_voices) < len(custom_voices):
            with open(CUSTOM_VOICES_JSON, "w", encoding="utf-8") as f:
                json.dump(filtered_voices, f, ensure_ascii=False, indent=2)

            wav_path = CUSTOM_VOICES_DIR / f"{voice_id}.wav"
            wav_path.unlink(missing_ok=True)

            pt_path = CUSTOM_VOICES_DIR / f"{voice_id}.pt"
            pt_path.unlink(missing_ok=True)

            return {"message": "Đã xoá giọng đọc và bộ đệm thành công"}

    raise HTTPException(status_code=404, detail="Không tìm thấy giọng đọc")


async def generate_random_preview(background_tasks: BackgroundTasks) -> dict:
    gender = _random.choice(_RANDOM_GENDER)
    age = _random.choice(_RANDOM_AGE)
    pitch = _random.choice(_RANDOM_PITCH)
    style = _random.choice(_RANDOM_STYLE)

    parts = [gender, age, pitch]
    if style:
        parts.append(style)
    instruct_str = ", ".join(parts)

    preview_text = (
        "Xin chào, đây là giọng đọc thử nghiệm. "
        "Chất lượng giọng này được tổng hợp bởi OmniVoice hai mươi bốn kilohertz. "
        "Hy vọng bạn thích nó."
    )

    seed = _random.randint(0, 99999)
    cache_str = f"random_{instruct_str}_{seed}"
    file_hash = hashlib.md5(cache_str.encode()).hexdigest()
    filename = f"random_preview_{file_hash}.mp3"
    output_path = OUTPUTS_DIR / filename

    try:
        generate_audio(
            text=preview_text,
            output_path=output_path,
            mode="design",
            instruct=instruct_str,
            cfg_value=2.0,
            num_step=int(os.getenv("DEFAULT_NUM_STEP", "32")),
            seed=seed,
            speed=1.0,
            pitch=0.0,
            audio_format="mp3",
        )
    except Exception as e:
        logger.exception("Lỗi khi sinh giọng ngẫu nhiên")
        raise HTTPException(status_code=500, detail=str(e))

    background_tasks.add_task(cleanup_old_files)

    return {
        "message": "Tạo giọng ngẫu nhiên thành công!",
        "audio_url": f"http://localhost:8000/outputs/{filename}",
        "filename": filename,
        "instruct": instruct_str,
        "seed": seed,
    }


async def discard_preview_voice(filename: str) -> dict:
    safe_filename = os.path.basename(filename)
    file_path = OUTPUTS_DIR / safe_filename
    if file_path.exists() and file_path.is_file():
        file_path.unlink()
        logger.info(f"🗑️ Đã xoá file preview ngẫu nhiên bị huỷ: {safe_filename}")
        return {"message": f"Đã xoá file preview {safe_filename}"}

    return {"message": "File không tồn tại hoặc đã được xoá trước đó"}


async def save_preview_as_custom_voice(
    name: str,
    description: str,
    gender: str,
    icon: str,
    filename: str,
    instruct: str,
) -> dict:
    src_path = OUTPUTS_DIR / Path(filename).name
    if not src_path.exists():
        raise HTTPException(
            status_code=404,
            detail="File preview không còn tồn tại. Hãy tạo lại giọng ngẫu nhiên.",
        )

    custom_id = f"custom_{uuid.uuid4().hex[:8]}"
    wav_path = CUSTOM_VOICES_DIR / f"{custom_id}.wav"
    pt_path = CUSTOM_VOICES_DIR / f"{custom_id}.pt"

    try:
        y, sr_loaded = librosa.load(str(src_path), sr=SAMPLE_RATE, duration=15.0)
        sf.write(str(wav_path), y, sr_loaded)

        has_pt = False
        try:
            prompt = create_voice_prompt(ref_audio=str(wav_path), ref_text=None)
            prompt.save(str(pt_path))
            has_pt = True
            logger.info(f"✅ Đã tạo VoiceClonePrompt từ giọng random: {pt_path.name}")
        except Exception as pe:
            logger.warning(f"⚠️ Không thể tạo .pt cho giọng random: {pe}")

        custom_voices_list = []
        if CUSTOM_VOICES_JSON.exists():
            with open(CUSTOM_VOICES_JSON, "r", encoding="utf-8") as f:
                custom_voices_list = json.load(f)

        new_voice = {
            "id": custom_id,
            "name": name,
            "gender": gender,
            "description": description or "Giọng ngẫu nhiên",
            "icon": icon or "casino",
            "url": f"http://localhost:8000/presets/custom/{custom_id}.wav",
            "prompt_text": "",
            "type": "custom",
            "instruct": instruct,
            "has_cache_pt": has_pt,
        }
        custom_voices_list.append(new_voice)

        with open(CUSTOM_VOICES_JSON, "w", encoding="utf-8") as f:
            json.dump(custom_voices_list, f, ensure_ascii=False, indent=2)

        try:
            src_path.unlink(missing_ok=True)
            logger.info(f"🗑️ Đã xoá file preview tạm sau khi lưu thành công: {src_path.name}")
        except Exception:
            pass

        return {
            "message": "Đã lưu giọng ngẫu nhiên thành custom voice!",
            "voice": new_voice,
            "pt_cached": has_pt,
        }

    except Exception as e:
        logger.exception("Lỗi khi lưu giọng ngẫu nhiên")
        raise HTTPException(status_code=500, detail=str(e))
