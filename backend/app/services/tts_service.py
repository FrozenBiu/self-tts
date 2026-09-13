import os
import uuid
import hashlib
import time
import asyncio
from pathlib import Path
from fastapi import HTTPException, BackgroundTasks
from pydub import AudioSegment
from pydub.effects import normalize as pydub_normalize

from app.core.config import (
    BASE_DIR,
    OUTPUTS_DIR,
    PRESETS_DIR,
    CUSTOM_VOICES_DIR,
    CUSTOM_VOICES_JSON,
    DEFAULT_NUM_STEP,
    logger,
)
from app.schemas.tts import (
    TTSRequest,
    TTSResponse,
    CleanupOrphansRequest,
    CleanupOrphansResponse,
    StitchRequest,
    StitchResponse,
    StitchSegmentItem,
)
from model_handler import (
    generate_audio,
    create_voice_prompt,
    VoiceClonePrompt,
)
from audio_processor import apply_ebur128_loudnorm


def cleanup_old_files(keep_latest: int = 200) -> None:
    """
    Dọn dẹp outputs/:
    - Xoá các file preview ngẫu nhiên 'random_preview_*' không được lưu (> 10 phút).
    - Xoá các file TTS cũ nếu vượt quá keep_latest.
    """
    now = time.time()

    # Dọn sạch các file preview ngẫu nhiên chưa lưu có tuổi thọ > 10 phút
    for p in list(OUTPUTS_DIR.glob("random_preview_*")):
        try:
            if now - p.stat().st_mtime > 600:
                p.unlink(missing_ok=True)
                logger.info(f"🗑️ Tự động dọn dẹp file preview ngẫu nhiên hết hạn: {p.name}")
        except Exception:
            pass

    files = list(OUTPUTS_DIR.glob("*.wav")) + list(OUTPUTS_DIR.glob("*.mp3"))
    files = sorted(files, key=lambda f: f.stat().st_mtime)
    for old_file in files[:-keep_latest]:
        old_file.unlink(missing_ok=True)
        logger.info(f"🗑️ Đã xóa file cũ: {old_file.name}")


def format_srt_time(seconds: float) -> str:
    """Chuyển đổi số giây thành định dạng thời gian SRT: 00:00:00,000"""
    millis = int(round(seconds * 1000))
    hours = millis // 3600000
    millis %= 3600000
    minutes = millis // 60000
    millis %= 60000
    secs = millis // 1000
    millis %= 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


async def synthesize_speech(request: TTSRequest, background_tasks: BackgroundTasks) -> TTSResponse:
    env_step = int(os.getenv("DEFAULT_NUM_STEP", str(DEFAULT_NUM_STEP)))
    steps = request.inference_timesteps or request.num_step or env_step

    cache_str = (
        f"{request.engine}_{request.text}_{request.mode}_{request.instruct}_{request.voice_id}_"
        f"{request.cfg_value}_{steps}_{request.seed}_{request.speed}_{request.pitch}_{request.format}_{request.enhance_audio}"
    )
    file_hash = hashlib.md5(cache_str.encode("utf-8")).hexdigest()

    ext = ".mp3" if request.format == "mp3" else ".wav"
    filename = f"tts_{file_hash}{ext}"
    output_path = OUTPUTS_DIR / filename

    if output_path.exists():
        logger.info(f"⚡ CACHE HIT: Tái sử dụng {filename}")
        output_path.touch()
        return TTSResponse(
            message="Tổng hợp thành công (Cache Hit)!",
            filename=filename,
            audio_url=f"http://localhost:8000/outputs/{filename}",
        )

    logger.info(f"⏳ CACHE MISS: Bắt đầu sinh mới {filename}")

    voice_clone_prompt = None
    ref_audio = request.prompt_wav_path
    ref_text = request.prompt_text

    if request.mode == "clone":
        if request.voice_id:
            custom_pt = CUSTOM_VOICES_DIR / f"{request.voice_id}.pt"
            preset_pt = PRESETS_DIR / f"{request.voice_id}.pt"

            if custom_pt.exists():
                try:
                    voice_clone_prompt = VoiceClonePrompt.load(str(custom_pt))
                    logger.info(f"⚡ Đã nạp cache VoiceClonePrompt từ: {custom_pt.name}")
                except Exception as e:
                    logger.warning(f"Không thể nạp prompt .pt: {e}")

            elif preset_pt.exists():
                try:
                    voice_clone_prompt = VoiceClonePrompt.load(str(preset_pt))
                    logger.info(f"⚡ Đã nạp cache VoiceClonePrompt preset từ: {preset_pt.name}")
                except Exception as e:
                    logger.warning(f"Không thể nạp prompt .pt preset: {e}")

            if voice_clone_prompt is None:
                import json
                voices_json = PRESETS_DIR / "voices.json"
                all_voices = []
                if voices_json.exists():
                    with open(voices_json, "r", encoding="utf-8") as f:
                        all_voices.extend(json.load(f))
                if CUSTOM_VOICES_JSON.exists():
                    with open(CUSTOM_VOICES_JSON, "r", encoding="utf-8") as f:
                        all_voices.extend(json.load(f))

                for v in all_voices:
                    if v["id"] == request.voice_id:
                        if request.voice_id.startswith("custom_"):
                            wav_candidate = CUSTOM_VOICES_DIR / f"{v['id']}.wav"
                        else:
                            wav_candidate = PRESETS_DIR / f"{v['id']}.wav"

                        if wav_candidate.exists():
                            ref_audio = str(wav_candidate)
                            ref_text = v.get("prompt_text")

                            try:
                                prompt_save_path = (
                                    CUSTOM_VOICES_DIR / f"{v['id']}.pt"
                                    if request.voice_id.startswith("custom_")
                                    else PRESETS_DIR / f"{v['id']}.pt"
                                )
                                voice_clone_prompt = await asyncio.to_thread(
                                    create_voice_prompt,
                                    ref_audio=ref_audio,
                                    ref_text=ref_text,
                                )
                                voice_clone_prompt.save(str(prompt_save_path))
                                logger.info(f"✨ Đã tự động tạo và lưu cache {prompt_save_path.name}")
                            except Exception as pe:
                                logger.warning(f"Không thể tạo trước cache prompt: {pe}")
                        break

    try:
        await asyncio.to_thread(
            generate_audio,
            text=request.text,
            output_path=output_path,
            mode=request.mode,
            voice_clone_prompt=voice_clone_prompt,
            ref_audio=ref_audio,
            ref_text=ref_text,
            instruct=request.instruct,
            cfg_value=request.cfg_value,
            num_step=steps,
            seed=request.seed,
            speed=request.speed,
            pitch=request.pitch,
            audio_format=request.format,
            enhance_audio=request.enhance_audio,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("❌ Lỗi khi tổng hợp giọng nói")
        raise HTTPException(
            status_code=500,
            detail=f"Lỗi khi tổng hợp: {str(exc)}",
        ) from exc

    background_tasks.add_task(cleanup_old_files)

    duration_val = None
    try:
        duration_val = round(AudioSegment.from_file(str(out_path)).duration_seconds, 2)
    except Exception:
        pass

    return TTSResponse(
        message="Tổng hợp thành công!",
        filename=filename,
        audio_url=f"http://localhost:8000/outputs/{filename}",
        duration=duration_val,
    )


async def delete_single_audio(filename: str):
    safe_filename = os.path.basename(filename)
    file_path = OUTPUTS_DIR / safe_filename

    deleted = False
    if file_path.exists() and file_path.is_file():
        try:
            file_path.unlink()
            deleted = True
            logger.info(f"🗑️ Đã xóa file theo yêu cầu: {safe_filename}")
        except Exception as e:
            logger.error(f"Lỗi khi xóa file {safe_filename}: {e}")
            raise HTTPException(status_code=500, detail=f"Không thể xóa file: {str(e)}")

    # Xóa kèm file phụ đề .srt nếu có
    base_name = os.path.splitext(safe_filename)[0]
    srt_candidate = OUTPUTS_DIR / f"{base_name}.srt"
    if srt_candidate.exists() and srt_candidate.is_file():
        try:
            srt_candidate.unlink()
            logger.info(f"🗑️ Đã xóa kèm file phụ đề: {srt_candidate.name}")
        except Exception as e:
            logger.warning(f"Không thể xóa file SRT {srt_candidate.name}: {e}")

    if not deleted:
        return {"message": "File không tồn tại hoặc đã được xóa trước đó", "deleted": False}

    return {"message": f"Đã xóa thành công file {safe_filename}", "deleted": True}


async def cleanup_orphan_files(request: CleanupOrphansRequest) -> CleanupOrphansResponse:
    now = time.time()
    active_set = {os.path.basename(f) for f in request.active_filenames if f}
    protected_files = {"demo_voice.wav", ".gitkeep"}

    deleted_count = 0
    freed_bytes = 0

    for p in OUTPUTS_DIR.iterdir():
        if not p.is_file() or p.name in protected_files:
            continue

        if not p.name.lower().endswith((".mp3", ".wav", ".srt", ".ass", ".vtt")):
            continue

        if p.name not in active_set:
            file_age_sec = now - p.stat().st_mtime
            min_age_sec = request.max_age_minutes * 60

            if request.force or file_age_sec >= min_age_sec:
                try:
                    f_size = p.stat().st_size
                    p.unlink(missing_ok=True)
                    deleted_count += 1
                    freed_bytes += f_size
                    logger.info(f"🗑️ Đã dọn dẹp file rác: {p.name} ({f_size / 1024:.1f} KB)")
                except Exception as e:
                    logger.warning(f"Không thể xoá file {p.name}: {e}")

    freed_mb = round(freed_bytes / (1024 * 1024), 2)
    return CleanupOrphansResponse(
        message=f"Đã dọn dẹp {deleted_count} file rác, giải phóng {freed_mb} MB.",
        deleted_count=deleted_count,
        freed_bytes=freed_bytes,
        freed_mb=freed_mb,
    )


def _sync_stitch_audio(
    blocks,
    audio_format: str,
    crossfade_ms: int = 15,
    loudness_standard: str = "ebu_r128",
) -> tuple[str, str | None, str | None, float, list[dict]]:
    """Hàm đồng bộ xử lý ghép nối audio, khử pop/click bằng micro-fade/crossfade, chuẩn hóa âm lượng EBU R128 và xuất file SRT trên worker thread."""
    combined = AudioSegment.empty()
    srt_entries: list[str] = []
    segments: list[dict] = []
    current_time_sec = 0.0

    for idx, block in enumerate(blocks):
        safe_name = os.path.basename(block.filename)
        file_p = OUTPUTS_DIR / safe_name

        segment_audio = AudioSegment.from_file(str(file_p))
        duration_sec = len(segment_audio) / 1000.0

        # 1. Khử DC Offset & Zero-Crossing Impulse bằng micro fade-in/fade-out (10-20ms)
        edge_fade_ms = max(0, min(crossfade_ms, int(len(segment_audio) * 0.15)))
        if edge_fade_ms > 0:
            segment_audio = segment_audio.fade_in(edge_fade_ms).fade_out(edge_fade_ms)

        # 2. Ghép nối vào luồng chính (Crossfade hoặc Silent Gap)
        if len(combined) > 0 and block.pause_after <= 0 and crossfade_ms > 0:
            fade_overlap = min(crossfade_ms, len(combined), len(segment_audio))
            combined = combined.append(segment_audio, crossfade=fade_overlap)
            start_sec = max(0.0, current_time_sec - (fade_overlap / 1000.0))
            end_sec = start_sec + duration_sec
            current_time_sec = end_sec
        else:
            start_sec = current_time_sec
            end_sec = current_time_sec + duration_sec
            combined += segment_audio
            current_time_sec = end_sec

            if block.pause_after > 0:
                pause_ms = int(block.pause_after * 1000)
                combined += AudioSegment.silent(duration=pause_ms)
                current_time_sec += block.pause_after

        segments.append({
            "index": idx,
            "filename": safe_name,
            "start": round(start_sec, 2),
            "end": round(end_sec, 2),
            "duration": round(duration_sec, 2),
        })

        clean_text = block.text.strip()
        if clean_text:
            start_str = format_srt_time(start_sec)
            end_str = format_srt_time(end_sec)
            srt_entries.append(f"{len(srt_entries) + 1}\n{start_str} --> {end_str}\n{clean_text}\n")

    file_id = uuid.uuid4().hex[:10]
    out_ext = ".mp3" if audio_format.lower() == "mp3" else ".wav"
    export_format = "mp3" if audio_format.lower() == "mp3" else "wav"
    out_filename = f"master_{file_id}{out_ext}"
    out_path = OUTPUTS_DIR / out_filename

    combined = combined.set_frame_rate(44100)

    # 3. Chuẩn hóa âm lượng phát thanh quốc tế ITU-R BS.1770-4 / EBU R128 (-16 LUFS Podcast / -14 LUFS Web)
    norm_applied = False
    if loudness_standard in ("ebu_r128", "youtube"):
        target_i = -16.0 if loudness_standard == "ebu_r128" else -14.0
        temp_raw_path = OUTPUTS_DIR / f"temp_raw_{file_id}.wav"
        try:
            combined.export(str(temp_raw_path), format="wav")
            norm_applied = apply_ebur128_loudnorm(
                input_path=str(temp_raw_path),
                output_path=str(out_path),
                target_i=target_i,
                target_tp=-1.5,
                sample_rate=44100,
                export_format=export_format,
                bitrate="320k",
            )
        except Exception as e:
            logger.warning(f"⚠️ Lỗi khi áp dụng EBU R128 loudnorm ({e}), dùng fallback Peak Normalization")
        finally:
            temp_raw_path.unlink(missing_ok=True)

    if not norm_applied:
        # Fallback Peak Normalization (-1.0 dBFS)
        combined = pydub_normalize(combined, headroom=1.0)
        combined.export(
            str(out_path),
            format=export_format,
            bitrate="320k" if export_format == "mp3" else None,
        )
        logger.info(f"🎉 Ghép nối master audio thành công (Peak Normalization -1.0 dBFS, 44.1kHz 320k): {out_filename} (Thời lượng: {combined.duration_seconds:.2f}s)")
    else:
        logger.info(f"🎉 Ghép nối master audio thành công (Chuẩn phát thanh EBU R128 {loudness_standard}, 44.1kHz 320k): {out_filename} (Thời lượng: {combined.duration_seconds:.2f}s)")

    srt_filename = None
    srt_url = None
    if srt_entries:
        srt_filename = f"master_{file_id}.srt"
        srt_path = OUTPUTS_DIR / srt_filename
        with open(srt_path, "w", encoding="utf-8") as sf:
            sf.write("\n".join(srt_entries))
        srt_url = f"http://localhost:8000/outputs/{srt_filename}"
        logger.info(f"📝 Đã tạo file phụ đề SRT đồng bộ: {srt_filename}")

    return out_filename, srt_filename, srt_url, round(combined.duration_seconds, 2), segments


async def stitch_audio_blocks(request: StitchRequest, background_tasks: BackgroundTasks) -> StitchResponse:
    if not request.blocks:
        raise HTTPException(status_code=400, detail="Danh sách phân đoạn rỗng")

    for idx, block in enumerate(request.blocks):
        safe_name = os.path.basename(block.filename)
        file_p = OUTPUTS_DIR / safe_name
        if not file_p.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Không tìm thấy file audio ở phân đoạn {idx + 1}: {safe_name}",
            )

    try:
        out_filename, srt_filename, srt_url, total_dur, segments = await asyncio.to_thread(
            _sync_stitch_audio,
            request.blocks,
            request.format,
            request.crossfade_ms,
            request.loudness_standard,
        )
    except Exception as e:
        logger.error(f"Lỗi xuất file master audio: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi xuất audio: {str(e)}")

    background_tasks.add_task(cleanup_old_files)

    return StitchResponse(
        message="Ghép nối phân đoạn thành công!",
        filename=out_filename,
        audio_url=f"http://localhost:8000/outputs/{out_filename}",
        srt_filename=srt_filename,
        srt_url=srt_url,
        total_duration=total_dur,
        segments=[StitchSegmentItem(**s) for s in segments],
    )
