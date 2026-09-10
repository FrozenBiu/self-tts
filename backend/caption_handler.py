"""
caption_handler.py
──────────────────
Xử lý toàn bộ logic cho tính năng Auto Kinetic Caption & Video Editing:
  1. Tách audio WAV từ video bằng FFmpeg.
  2. Bóc tách phụ đề chi tiết từng từ (Word-level timestamps) bằng Faster-Whisper & Silero VAD.
  3. Sinh file phụ đề Karaoke ASS (.ass) với styling tùy biến cao.
  4. Ghép phụ đề cứng và hòa âm nhạc nền (BGM) ra video MP4 thành phẩm qua FFmpeg.
"""

import os
import re
import logging
import subprocess
from pathlib import Path
from typing import Any

# pyrefly: ignore [missing-import]
import torch
# pyrefly: ignore [missing-import]
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

# ─── Singleton Whisper Model ────────────────────────────────────────────────
_whisper_model: WhisperModel | None = None
_current_model_size: str | None = None

# Đọc cấu hình Whisper từ .env
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base").strip().lower()


def get_whisper_model(model_size: str | None = None) -> WhisperModel:
    """Khởi tạo hoặc trả về instance Faster-Whisper đã cache."""
    global _whisper_model, _current_model_size

    target_size = model_size or WHISPER_MODEL_SIZE
    if _whisper_model is not None and _current_model_size == target_size:
        return _whisper_model

    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"

    logger.info(
        f"🎙️ Đang tải Faster-Whisper model '{target_size}' trên {device} (compute={compute_type}) …"
    )
    _whisper_model = WhisperModel(target_size, device=device, compute_type=compute_type)
    _current_model_size = target_size
    logger.info("✅ Tải Faster-Whisper thành công.")
    return _whisper_model


def extract_audio(video_path: Path, output_audio_path: Path) -> Path:
    """
    Trích xuất âm thanh từ video sang định dạng WAV 16kHz Mono (chuẩn tối ưu cho Whisper).
    """
    output_audio_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        str(output_audio_path),
    ]
    logger.info(f"Trích xuất âm thanh từ {video_path.name} -> {output_audio_path.name}")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        logger.error(f"Lỗi khi trích xuất âm thanh: {res.stderr}")
        raise RuntimeError(f"FFmpeg extract audio thất bại: {res.stderr}")

    return output_audio_path


SENTENCE_ENDINGS = re.compile(r"[.!?]+['\"]?$")
CLAUSE_ENDINGS = re.compile(r"[,;:\-–—]+['\"]?$")


def resegment_words(
    all_words: list[dict[str, Any]],
    max_words: int = 9,
    max_chars: int = 46,
    min_silence_split: float = 0.38,
) -> list[dict[str, Any]]:
    """
    Chia nhỏ toàn bộ danh sách từ thành các câu phụ đề ngắn, chuẩn độ dài cho Shorts/Reels/Video (4-9 từ).
    Thuật toán ngắt thông minh:
    1. Ngắt ngay khi kết thúc câu bằng dấu chấm, hỏi chấm, chấm than (. ? !)
    2. Ngắt ở dấu phẩy hoặc dấu gạch nối khi câu đã đủ dài (>= 4 từ)
    3. Ngắt ở khoảng lặng tự nhiên giữa 2 từ >= 0.38s khi câu đã có từ 4 từ trở lên
    4. Giới hạn độ dài tối đa 9 từ hoặc 46 ký tự
    5. Chống từ mồ côi (orphan word prevention): nếu chỉ còn 1-2 từ là hết câu thì gộp nốt thay vì ngắt lơ lửng.
    """
    valid_words = [w for w in all_words if w.get("word", "").strip()]
    if not valid_words:
        return []

    new_segments: list[dict[str, Any]] = []
    current_words: list[dict[str, Any]] = []
    seg_id = 1

    for i, w in enumerate(valid_words):
        current_words.append(w)
        word_text = w.get("word", "").strip()
        has_next = i < len(valid_words) - 1
        next_w = valid_words[i + 1] if has_next else None

        # Kiểm tra khoảng cách tới dấu chấm hết câu gần nhất (lookahead)
        words_until_sentence_end = 999
        for lookahead in range(1, 3):
            if i + lookahead < len(valid_words):
                if SENTENCE_ENDINGS.search(valid_words[i + lookahead].get("word", "").strip()):
                    words_until_sentence_end = lookahead
                    break

        should_split = False

        if not has_next:
            should_split = True
        else:
            # 1. Kết thúc câu bằng dấu câu (. ! ?)
            if SENTENCE_ENDINGS.search(word_text):
                should_split = True

            # Nếu chỉ còn 1-2 từ nữa là kết thúc câu, gộp nốt thay vì ngắt lơ lửng (cho phép dãn max_words lên 11 từ)
            elif words_until_sentence_end <= 2 and len(current_words) < 11:
                should_split = False

            # 2. Khoảng lặng tự nhiên giữa 2 từ >= min_silence_split khi đã có ít nhất 4 từ
            elif (
                len(current_words) >= 4
                and next_w
                and (next_w["start"] - w["end"] >= min_silence_split)
            ):
                should_split = True

            # 3. Dấu phẩy khi câu đã có từ 4 từ trở lên
            elif len(current_words) >= 4 and CLAUSE_ENDINGS.search(word_text):
                should_split = True

            # 4. Quá giới hạn từ hoặc ký tự
            elif len(current_words) >= max_words:
                should_split = True
            elif (
                sum(len(cw.get("word", "")) for cw in current_words) + len(current_words) - 1 >= max_chars
                and len(current_words) >= 4
            ):
                should_split = True

        if should_split and current_words:
            seg_start = current_words[0]["start"]
            seg_end = current_words[-1]["end"]
            seg_text = " ".join(cw.get("word", "").strip() for cw in current_words)
            new_segments.append(
                {
                    "id": seg_id,
                    "start": round(seg_start, 2),
                    "end": round(seg_end, 2),
                    "text": seg_text,
                    "words": current_words,
                }
            )
            seg_id += 1
            current_words = []

    return new_segments


def align_words_with_reference(
    segments: list[dict[str, Any]], reference_text: str
) -> list[dict[str, Any]]:
    """
    So khớp danh sách từ nhận diện bởi Whisper với kịch bản gốc của người dùng bằng difflib.
    Tự động sửa các lỗi nghe nhầm chính tả trong khi bảo toàn 100% mốc thời gian start & end của từ.
    Sau đó tự động chia nhỏ thành các câu phụ đề 4-9 từ chuẩn ngắn gọn, không bị tràn màn hình.
    """
    import difflib

    if not reference_text or not reference_text.strip():
        return segments

    ref_words = reference_text.strip().split()
    if not ref_words:
        return segments

    # Thu thập toàn bộ từ từ các segments
    all_words: list[dict[str, Any]] = []
    current_global_idx = 0
    for seg in segments:
        for w in seg.get("words", []):
            all_words.append(dict(w))
            current_global_idx += 1

    if not all_words:
        return segments

    def clean_token(w: str) -> str:
        return re.sub(r"[^\w\s]", "", w.lower()).strip()

    whisper_clean = [clean_token(w["word"]) for w in all_words]
    ref_clean = [clean_token(w) for w in ref_words]

    matcher = difflib.SequenceMatcher(None, whisper_clean, ref_clean)

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for idx in range(i2 - i1):
                all_words[i1 + idx]["word"] = ref_words[j1 + idx]
        elif tag == "replace":
            w_len = i2 - i1
            r_len = j2 - j1
            if w_len == r_len:
                for idx in range(w_len):
                    all_words[i1 + idx]["word"] = ref_words[j1 + idx]
            elif w_len == 1 and r_len > 1:
                all_words[i1]["word"] = " ".join(ref_words[j1:j2])
            elif w_len > 1 and r_len == 1:
                all_words[i1]["word"] = ref_words[j1]
                for idx in range(i1 + 1, i2):
                    all_words[idx]["word"] = ""
            elif w_len > 1 and r_len > 1:
                min_len = min(w_len, r_len)
                for idx in range(min_len):
                    if idx == min_len - 1 and r_len > w_len:
                        all_words[i1 + idx]["word"] = " ".join(ref_words[j1 + idx:j2])
                    else:
                        all_words[i1 + idx]["word"] = ref_words[j1 + idx]
                if w_len > r_len:
                    for idx in range(i1 + r_len, i2):
                        all_words[idx]["word"] = ""

    valid_words = [w for w in all_words if w.get("word", "").strip()]
    if not valid_words:
        return segments

    # Tự động chia nhỏ lại các câu thành các đoạn 4-9 từ chuẩn ngắn gọn
    new_segments = resegment_words(valid_words, max_words=9, max_chars=46)
    logger.info(f"✨ Đã đối chiếu và chia nhỏ thành {len(new_segments)} câu phụ đề chuẩn ngắn gọn ({len(ref_words)} từ).")
    return new_segments


def transcribe_video_audio(
    audio_path: Path,
    language: str = "vi",
    model_size: str | None = None,
    reference_script: str | None = None,
) -> list[dict[str, Any]]:
    """
    Phân tích âm thanh và trích xuất mốc thời gian chi tiết từng từ (Word-level timestamps).
    Hỗ trợ kịch bản đối chiếu (reference_script) để Whisper nhận diện chính xác 100% chính tả.
    """
    model = get_whisper_model(model_size)
    logger.info(f"Bắt đầu nhận diện giọng nói cho: {audio_path.name} (Lang={language})")

    prompt_snippet = None
    if reference_script and reference_script.strip():
        prompt_snippet = reference_script.strip()[:450]

    segments_gen, info = model.transcribe(
        str(audio_path),
        language=language if language != "auto" else None,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=400),
        initial_prompt=prompt_snippet,
    )

    result_segments: list[dict[str, Any]] = []
    seg_id = 1

    for seg in segments_gen:
        words_data: list[dict[str, Any]] = []
        if seg.words:
            for w in seg.words:
                cleaned_word = w.word.strip()
                if not cleaned_word:
                    continue
                words_data.append(
                    {
                        "word": cleaned_word,
                        "start": round(w.start, 2),
                        "end": round(w.end, 2),
                        "probability": round(getattr(w, "probability", 1.0), 2),
                    }
                )

        if not words_data and not seg.text.strip():
            continue

        result_segments.append(
            {
                "id": seg_id,
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": seg.text.strip(),
                "words": words_data,
            }
        )
        seg_id += 1

    # Nếu có kịch bản đối chiếu, tự động so khớp và chia nhỏ câu
    if reference_script and reference_script.strip():
        result_segments = align_words_with_reference(result_segments, reference_script)
    else:
        # Nếu không có kịch bản, vẫn tự động chia nhỏ các câu quá dài của Whisper thành câu ngắn chuẩn Shorts/Reels
        all_words_flat = []
        for s in result_segments:
            all_words_flat.extend(s.get("words", []))
        if all_words_flat:
            result_segments = resegment_words(all_words_flat, max_words=9, max_chars=46)

    logger.info(f"Nhận diện hoàn tất: {len(result_segments)} câu có phụ đề chi tiết.")
    return result_segments


def rgb_to_ass_color(hex_color: str, alpha: int = 0) -> str:
    """
    Chuyển đổi mã màu hex thông dụng (#RRGGBB) sang định dạng màu ASS BGR (&H<AA><BB><GG><RR>).
    """
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join(c * 2 for c in hex_color)
    if len(hex_color) != 6:
        hex_color = "FFFFFF"

    r = hex_color[0:2]
    g = hex_color[2:4]
    b = hex_color[4:6]
    aa = f"{alpha:02X}"
    return f"&H{aa}{b}{g}{r}".upper()


def seconds_to_ass_time(seconds: float) -> str:
    """Chuyển đổi giây thành format thời gian của ASS (H:MM:SS.cs)."""
    if seconds < 0:
        seconds = 0.0
    hrs = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs >= 100:
        cs = 99
    return f"{hrs}:{mins:02d}:{secs:02d}.{cs:02d}"


def get_video_dimensions(video_path: Path) -> tuple[int, int]:
    """Lấy độ phân giải thực tế (Width x Height) của video qua ffprobe."""
    try:
        cmd = [
            "ffprobe",
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "csv=s=x:p=0",
            str(video_path),
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        out = res.stdout.strip()
        if "x" in out:
            parts = out.split("x")
            return int(parts[0]), int(parts[1])
    except Exception as e:
        logger.warning(f"Không thể đọc kích thước video ({e}), dùng mặc định 1920x1080")
    return 1920, 1080


def generate_ass_subtitles(
    segments: list[dict[str, Any]],
    style_config: dict[str, Any],
    output_ass_path: Path,
    video_path: Path | None = None,
) -> Path:
    """
    Tạo file phụ đề ASS (.ass) với hiệu ứng Karaoke (\\k<centiseconds>) cho từng từ.
    Tự động chuẩn hóa kích thước chữ và viền theo đúng tỉ lệ xem trước trên Web và độ phân giải video gốc.
    """
    # 1. Xác định kích thước canvas theo video gốc
    video_w, video_h = (1920, 1080)
    if video_path and video_path.exists():
        video_w, video_h = get_video_dimensions(video_path)

    # 2. Tính tỉ lệ scale giữa khung hình video gốc và chiều cao hiển thị trên web
    preview_h = float(style_config.get("preview_height", 0))
    if preview_h > 50:
        scale_factor = video_h / preview_h
    else:
        scale_factor = video_h / 450.0  # fallback

    raw_font_size = float(style_config.get("font_size", 36))
    raw_outline = float(style_config.get("outline_size", 3))

    # Cỡ chữ và độ dày viền được scale chính xác để khi render lên video gốc sẽ khớp 100% mắt nhìn trên web
    ass_font_size = max(14, int(round(raw_font_size * scale_factor)))
    ass_outline_size = max(1, int(round(raw_outline * scale_factor)))

    font_name = style_config.get("font_name", "Montserrat")
    primary_color = rgb_to_ass_color(style_config.get("primary_color", "#FFFFFF"))
    highlight_color = rgb_to_ass_color(style_config.get("highlight_color", "#FFFF00"))
    outline_color = rgb_to_ass_color(style_config.get("outline_color", "#000000"))
    back_color = "&H80000000"
    
    # Tính toán vị trí hiển thị: hỗ trợ position_y (phần trăm từ đỉnh 0-100%)
    position_y = float(style_config.get("position_y", 80))
    if position_y >= 50:
        alignment = 2  # Bottom Center
        margin_v = max(10, int(round((100 - position_y) * video_h / 100)))
    else:
        alignment = 8  # Top Center
        margin_v = max(10, int(round(position_y * video_h / 100)))

    ass_content = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {video_w}",
        f"PlayResY: {video_h}",
        "ScaledBorderAndShadow: yes",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        # ASS Karaoke \k: SecondaryColour là màu chữ TRƯỚC khi đọc (chưa đọc), PrimaryColour là màu chữ KHI/SAU khi đọc (được highlight)
        f"Style: KineticStyle,{font_name},{ass_font_size},{highlight_color},{primary_color},{outline_color},{back_color},1,0,0,0,100,100,0,0,1,{ass_outline_size},2,{alignment},20,20,{margin_v},1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    for seg in segments:
        words = seg.get("words", [])
        start_time = seconds_to_ass_time(seg["start"])
        end_time = seconds_to_ass_time(seg["end"])

        if words:
            karaoke_parts = []
            for i, w in enumerate(words):
                w_start = w["start"]
                # Kéo dài mốc kết thúc tới mốc bắt đầu của từ kế tiếp để hiệu ứng highlight chạy liền mạch
                if i < len(words) - 1:
                    next_start = words[i + 1]["start"]
                    effective_end = max(w["end"], next_start)
                else:
                    effective_end = max(w["end"], seg["end"])

                dur_cs = max(1, int(round((effective_end - w_start) * 100)))
                word_clean = w["word"].strip()
                karaoke_parts.append(f"{{\\k{dur_cs}}}{word_clean}")

            text_line = " ".join(karaoke_parts)
        else:
            # Fallback nếu câu không có word-level
            text_line = seg.get("text", "")

        ass_content.append(
            f"Dialogue: 0,{start_time},{end_time},KineticStyle,,0,0,0,,{text_line}"
        )

    output_ass_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write("\n".join(ass_content) + "\n")

    logger.info(f"Đã tạo file phụ đề ASS: {output_ass_path.name}")
    return output_ass_path


def render_video_with_captions(
    video_path: Path,
    ass_path: Path,
    output_path: Path,
    bgm_path: Path | None = None,
    bgm_volume: float = 0.25,
    fonts_dir: Path | None = None,
) -> Path:
    """
    Sử dụng FFmpeg để ép cứng phụ đề ASS và hòa âm nhạc nền (BGM) thành video MP4 hoàn chỉnh.
    Hỗ trợ tùy chọn thư mục font tùy biến (fontsdir).
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Escape đường dẫn file ASS trên Windows cho FFmpeg filter
    escaped_ass = str(ass_path.resolve()).replace("\\", "/").replace(":", "\\:")
    ass_filter_str = f"ass='{escaped_ass}'"
    if fonts_dir and fonts_dir.exists():
        escaped_fonts = str(fonts_dir.resolve()).replace("\\", "/").replace(":", "\\:")
        ass_filter_str = f"ass='{escaped_ass}':fontsdir='{escaped_fonts}'"

    if bgm_path and bgm_path.exists():
        # Hòa âm audio gốc + BGM
        filter_complex = (
            f"[1:a]volume={bgm_volume:.2f}[bgm_low]; "
            f"[0:a][bgm_low]amix=inputs=2:duration=first[a_mixed]; "
            f"[0:v]{ass_filter_str}[v_sub]"
        )
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-i",
            str(bgm_path),
            "-filter_complex",
            filter_complex,
            "-map",
            "[v_sub]",
            "-map",
            "[a_mixed]",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "18",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
    else:
        # Chỉ ép phụ đề ASS
        filter_complex = f"[0:v]{ass_filter_str}[v_sub]"
        cmd = [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-filter_complex",
            filter_complex,
            "-map",
            "[v_sub]",
            "-map",
            "0:a?",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "18",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            str(output_path),
        ]

    logger.info(f"Đang render video đầu ra: {output_path.name} …")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        logger.error(f"FFmpeg render lỗi: {res.stderr}")
        raise RuntimeError(f"FFmpeg render video thất bại: {res.stderr}")

    logger.info(f"✅ Render thành công video: {output_path.name}")
    return output_path
