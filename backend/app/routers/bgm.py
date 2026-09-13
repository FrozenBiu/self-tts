import os
import json
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydub import AudioSegment

from app.core.config import OUTPUTS_DIR, PRESETS_DIR, logger
from app.core.storage_r2 import upload_audio_to_r2
from app.schemas.bgm import BGMTrack, BGMListResponse, BGMMixRequest, BGMMixResponse, BGMUpdateRequest
from app.services.tts_service import slugify_vietnamese
from audio_processor import mix_voice_with_bgm_ducking


router = APIRouter(prefix="/api/bgm", tags=["Background Music"])

BGM_DIR = PRESETS_DIR / "bgm"
BGM_DIR.mkdir(parents=True, exist_ok=True)
BGM_CUSTOM_DIR = BGM_DIR / "custom"
BGM_CUSTOM_DIR.mkdir(parents=True, exist_ok=True)
BGM_META_FILE = BGM_DIR / "bgm_meta.json"


def _load_metadata() -> dict[str, dict]:
    """Tải từ điển metadata {bgm_id: track_dict}."""
    if not BGM_META_FILE.exists():
        return {}
    try:
        with open(BGM_META_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data
            elif isinstance(data, list):
                return {item["id"]: item for item in data if "id" in item}
    except Exception as e:
        logger.warning(f"Không thể đọc metadata BGM: {e}")
    return {}


def _save_metadata(meta: dict[str, dict]):
    """Ghi từ điển metadata vào file JSON."""
    try:
        with open(BGM_META_FILE, "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Lỗi khi lưu metadata BGM: {e}")


def _build_track(bgm_id: str, file_p: Path, meta_entry: dict | None = None) -> BGMTrack:
    dur = None
    try:
        audio = AudioSegment.from_file(str(file_p))
        dur = round(audio.duration_seconds, 1)
    except Exception:
        pass

    default_name = file_p.stem.replace("bgm_", "Bản nhạc ").replace("_", " ").title()
    name = (meta_entry and meta_entry.get("name")) or default_name
    category = (meta_entry and meta_entry.get("category")) or "Nhạc của bạn"

    rel_url = f"http://localhost:8000/presets/bgm/custom/{file_p.name}"

    return BGMTrack(
        id=bgm_id,
        name=name,
        filename=file_p.name,
        url=rel_url,
        duration=dur,
        is_preset=False,
        category=category,
    )


@router.get("/list", response_model=BGMListResponse, summary="Lấy danh sách nhạc nền người dùng đã tải lên")
async def list_bgm():
    meta = _load_metadata()
    tracks: list[BGMTrack] = []
    meta_dirty = False

    # Quét tất cả file trong BGM_CUSTOM_DIR
    existing_files = list(BGM_CUSTOM_DIR.glob("*.*"))
    existing_ids = set()

    for p in existing_files:
        if p.is_file() and p.suffix.lower() in (".mp3", ".wav"):
            bgm_id = p.stem
            existing_ids.add(bgm_id)
            meta_entry = meta.get(bgm_id)

            if not meta_entry:
                # Nếu chưa có trong metadata, tự động lưu tên file
                meta[bgm_id] = {
                    "id": bgm_id,
                    "name": p.stem.replace("bgm_", "Bản nhạc ").replace("_", " ").title(),
                    "filename": p.name,
                    "category": "Nhạc của bạn",
                }
                meta_entry = meta[bgm_id]
                meta_dirty = True

            tracks.append(_build_track(bgm_id, p, meta_entry))

    # Dọn dẹp id không còn file vật lý
    for k in list(meta.keys()):
        if k not in existing_ids:
            del meta[k]
            meta_dirty = True

    if meta_dirty:
        _save_metadata(meta)

    return BGMListResponse(tracks=tracks)


@router.post("/upload", response_model=BGMTrack, summary="Tải lên bản nhạc nền từ máy tính")
async def upload_bgm(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in (".mp3", ".wav"):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file nhạc định dạng .mp3 hoặc .wav")

    stem_id = f"bgm_{uuid.uuid4().hex[:8]}"
    safe_name = f"{stem_id}{ext}"
    dest_path = BGM_CUSTOM_DIR / safe_name

    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Lỗi khi lưu file BGM upload: {e}")
        raise HTTPException(status_code=500, detail=f"Không thể lưu file BGM: {str(e)}")

    # Lấy tên hiển thị ban đầu từ tên file gốc của người dùng
    original_stem = Path(file.filename or "").stem.strip()
    clean_name = original_stem if original_stem else f"Nhạc nền {stem_id[-4:]}"

    meta = _load_metadata()
    meta[stem_id] = {
        "id": stem_id,
        "name": clean_name,
        "filename": safe_name,
        "original_filename": file.filename or safe_name,
        "category": "Nhạc của bạn",
    }
    _save_metadata(meta)

    logger.info(f"🎵 Đã tải lên file BGM mới: '{clean_name}' ({safe_name})")
    return _build_track(stem_id, dest_path, meta[stem_id])


@router.patch("/{bgm_id}", response_model=BGMTrack, summary="Đổi tên bản nhạc nền")
async def update_bgm_title(bgm_id: str, request: BGMUpdateRequest):
    meta = _load_metadata()
    
    # Tìm file vật lý
    candidates = list(BGM_CUSTOM_DIR.glob(f"{bgm_id}.*"))
    valid_files = [p for p in candidates if p.is_file() and p.suffix.lower() in (".mp3", ".wav")]
    if not valid_files:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bản nhạc ID: {bgm_id}")

    file_p = valid_files[0]
    new_title = request.name.strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="Tên bài nhạc không được để trống")

    if bgm_id not in meta:
        meta[bgm_id] = {
            "id": bgm_id,
            "filename": file_p.name,
            "category": "Nhạc của bạn",
        }

    meta[bgm_id]["name"] = new_title
    _save_metadata(meta)

    logger.info(f"✏️ Đã đổi tên BGM [{bgm_id}] thành: '{new_title}'")
    return _build_track(bgm_id, file_p, meta[bgm_id])


@router.delete("/{bgm_id}", summary="Xóa bản nhạc nền khỏi hệ thống")
async def delete_bgm(bgm_id: str):
    candidates = list(BGM_CUSTOM_DIR.glob(f"{bgm_id}.*"))
    valid_files = [p for p in candidates if p.is_file() and p.suffix.lower() in (".mp3", ".wav")]
    
    if not valid_files:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bản nhạc ID: {bgm_id}")

    for p in valid_files:
        try:
            p.unlink(missing_ok=True)
        except Exception as e:
            logger.error(f"Lỗi khi xóa file {p}: {e}")

    meta = _load_metadata()
    if bgm_id in meta:
        del meta[bgm_id]
        _save_metadata(meta)

    logger.info(f"🗑️ Đã xóa bản nhạc BGM [{bgm_id}]")
    return {"message": f"Đã xóa thành công bản nhạc ID: {bgm_id}"}


@router.post("/mix", response_model=BGMMixResponse, summary="Lồng nhạc nền vào giọng đọc với Auto-Ducking")
async def mix_bgm(request: BGMMixRequest):
    # 1. Kiểm tra file giọng nói
    voice_p = OUTPUTS_DIR / os.path.basename(request.voice_filename)
    if not voice_p.exists():
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file giọng nói: {request.voice_filename}")

    # 2. Tìm file nhạc nền theo bgm_id trong BGM_CUSTOM_DIR
    bgm_candidates = list(BGM_CUSTOM_DIR.glob(f"{request.bgm_id}.*"))
    valid_bgm = [p for p in bgm_candidates if p.is_file() and p.suffix.lower() in (".mp3", ".wav")]

    if not valid_bgm:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bản nhạc nền ID: {request.bgm_id}")

    bgm_p = valid_bgm[0]

    # 3. Tính toán mức độ ducking
    depth_map = {
        "light": -8.0,
        "medium": -14.0,
        "deep": -20.0,
    }
    ducking_db = depth_map.get(request.ducking_depth.lower(), -14.0)

    # 4. Xuất file mixed
    voice_stem = Path(request.voice_filename).stem
    if "_bgm_" in voice_stem:
        voice_stem = voice_stem.split("_bgm_")[0]

    bgm_slug = slugify_vietnamese(request.bgm_id, max_chars=16) or "bgm"
    short_id = uuid.uuid4().hex[:6]
    out_name = f"{voice_stem}_bgm_{bgm_slug}_{short_id}.mp3"
    out_path = OUTPUTS_DIR / out_name

    success = mix_voice_with_bgm_ducking(
        voice_path=str(voice_p),
        bgm_path=str(bgm_p),
        output_path=str(out_path),
        bgm_volume=request.bgm_volume,
        ducking_depth_db=ducking_db,
        attack_ms=200,
        release_ms=500,
        export_format="mp3",
        bitrate="320k",
    )

    if not success or not out_path.exists():
        raise HTTPException(status_code=500, detail="Không thể hòa trộn nhạc nền vào giọng nói")

    dur = None
    try:
        audio = AudioSegment.from_file(str(out_path))
        dur = round(audio.duration_seconds, 2)
    except Exception:
        pass

    r2_url = upload_audio_to_r2(out_path)

    return BGMMixResponse(
        message="Đã lồng nhạc nền và kích hoạt Auto-Ducking thành công!",
        filename=out_name,
        audio_url=r2_url or f"http://localhost:8000/outputs/{out_name}",
        duration=dur,
    )

