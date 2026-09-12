"""
model_handler.py
────────────────
Chứa toàn bộ logic liên quan đến OmniVoice (k2-fsa):
  - Load mô hình OmniVoice (gọi 1 lần khi startup).
  - create_voice_prompt(): trích xuất và lưu embedding VoiceClonePrompt (.pt).
  - generate_audio(): sinh âm thanh chất lượng cao 24,000 Hz với 3 chế độ:
      + Voice Cloning: dùng file .pt đã cache hoặc reference audio.
      + Voice Design: tạo giọng nói từ mô tả instruct.
      + Auto Voice: mô hình tự động chọn giọng phù hợp.
"""

import os
import gc
import re
import logging
from pathlib import Path
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
# pyrefly: ignore [missing-import]
import soundfile as sf
# pyrefly: ignore [missing-import]
import numpy as np
# pyrefly: ignore [missing-import]
import torch
# pyrefly: ignore [missing-import]
import librosa

# pyrefly: ignore [missing-import]
from omnivoice import OmniVoice, VoiceClonePrompt

# Tự động tải biến môi trường từ file .env
load_dotenv()

logger = logging.getLogger(__name__)

# ─── Global model holder ────────────────────────────────────────────────────
_model: OmniVoice | None = None

# Chuẩn sample rate của OmniVoice là 24,000 Hz
SAMPLE_RATE = 24_000

# Đọc cấu hình từ .env
OMNIVOICE_DEVICE = os.getenv("OMNIVOICE_DEVICE", "cuda").lower()
OMNIVOICE_DTYPE = os.getenv("OMNIVOICE_DTYPE", "float16").lower()
OMNIVOICE_MODEL_ID = os.getenv("OMNIVOICE_MODEL_ID", "k2-fsa/OmniVoice")
DEFAULT_NUM_STEP = int(os.getenv("DEFAULT_NUM_STEP", "10"))
MAX_CHUNK_CHARS = int(os.getenv("MAX_CHUNK_CHARS", "450"))
ENABLE_WARMUP_ONCE = os.getenv("ENABLE_WARMUP_ONCE", "false").lower() in ("true", "1", "yes")
ENABLE_EMPTY_CACHE = os.getenv("ENABLE_EMPTY_CACHE", "false").lower() in ("true", "1", "yes")
CUDNN_BENCHMARK = os.getenv("CUDNN_BENCHMARK", "true").lower() in ("true", "1", "yes")
AUDIO_MP3_BACKEND = os.getenv("AUDIO_MP3_BACKEND", "auto").lower().strip()

# Backend mã hóa khi lưu file MP3: 'auto', 'soundfile', 'torchaudio'
AUDIO_MP3_BACKEND = os.getenv("AUDIO_MP3_BACKEND", "auto").strip().lower()

_has_warmed_up = False


def load_model() -> None:
    """
    Load OmniVoice vào VRAM / RAM.
    Gọi hàm này duy nhất một lần trong FastAPI lifespan startup.
    """
    global _model
    if _model is not None:
        logger.info("Mô hình OmniVoice đã được tải trước đó, bỏ qua.")
        return

    # Xác định thiết bị tính toán
    if OMNIVOICE_DEVICE == "cuda" and torch.cuda.is_available():
        device_map = "cuda:0"
        dtype_val = torch.float16 if OMNIVOICE_DTYPE == "float16" else torch.float32
        if CUDNN_BENCHMARK:
            torch.backends.cudnn.benchmark = True
            logger.info("⚡ Đã bật torch.backends.cudnn.benchmark để tối ưu tốc độ tính toán ma trận.")
    else:
        device_map = "cpu"
        dtype_val = torch.float32

    logger.info(
        f"🚀 Đang tải mô hình {OMNIVOICE_MODEL_ID} (Device={device_map}, Dtype={dtype_val}) …"
    )

    _model = OmniVoice.from_pretrained(
        OMNIVOICE_MODEL_ID,
        device_map=device_map,
        dtype=dtype_val,
    )

    # Cấu hình hệ số đệm độ dài token (mặc định 1.0 = chuẩn gốc của OmniVoice)
    # Tuyệt đối không tự ý nhân > 1.0 (như 1.20) vì sẽ làm dư thừa token diffusion,
    # khiến mô hình bị vấp, lặp từ, ậm ừ hoặc kéo dài âm vô lý ở cuối câu.
    token_padding_factor = float(os.getenv("TOKEN_PADDING_FACTOR", "1.0"))
    if token_padding_factor != 1.0:
        orig_est = _model._estimate_target_tokens

        def calibrated_estimate_target_tokens(text, ref_text, num_ref_audio_tokens, speed=1.0):
            est = orig_est(text, ref_text, num_ref_audio_tokens, speed=1.0)
            est = est * token_padding_factor
            if speed > 0 and speed != 1.0:
                est = est / (speed ** 0.8)
            return max(20, int(est))

        _model._estimate_target_tokens = calibrated_estimate_target_tokens
        logger.info(f"⚙️ Áp dụng TOKEN_PADDING_FACTOR = {token_padding_factor}")

    logger.info("✅ OmniVoice đã sẵn sàng phục vụ!")


def get_model() -> OmniVoice:
    """Trả về OmniVoice instance đã load. Raise RuntimeError nếu chưa load."""
    if _model is None:
        raise RuntimeError("Mô hình OmniVoice chưa được khởi tạo. Vui lòng kiểm tra startup.")
    return _model


def create_voice_prompt(ref_audio: str, ref_text: str | None = None) -> VoiceClonePrompt:
    """
    Trích xuất đặc trưng âm thanh và tạo VoiceClonePrompt.
    Nếu ref_text là None hoặc rỗng, OmniVoice sẽ tự động dùng Whisper ASR để bóc băng.
    """
    model = get_model()
    logger.info(f"Đang tạo VoiceClonePrompt từ ref_audio='{ref_audio}', ref_text={ref_text}")
    prompt = model.create_voice_clone_prompt(
        ref_audio=ref_audio,
        ref_text=ref_text if (ref_text and ref_text.strip()) else None,
        preprocess_prompt=True,
    )
    return prompt


def clean_vietnamese_text(text: str) -> str:
    """
    Làm sạch văn bản tiếng Việt để tránh hiện tượng vấp, ngắt quãng hoặc lặp từ trong OmniVoice:
    - Thay dấu hai chấm ':' và chấm phẩy ';' bằng dấu chấm/phẩy để mô hình ngắt nhịp tự nhiên.
    - Loại bỏ các loại dấu ngoặc kép, ngoặc đơn lạ.
    - Chuẩn hóa khoảng trắng và dấu câu liên tiếp.
    """
    if not text:
        return ""
    # Thay dấu hai chấm và chấm phẩy bằng dấu phẩy để mô hình ngắt nhịp nhẹ nhàng, tự nhiên
    text = re.sub(r":\s*", ", ", text)
    text = re.sub(r";\s*", ", ", text)
    # Loại bỏ ngoặc kép và ngoặc đơn lạ
    text = re.sub(r'["“”\'‘’«»]', '', text)
    # Chuẩn hóa nhiều dấu chấm, gạch ngang liên tiếp
    text = re.sub(r"\.{2,}", ".", text)
    text = re.sub(r"-{2,}", "-", text)
    # Chuẩn hóa khoảng trắng
    text = re.sub(r"[ \t]+", " ", text).strip()
    return text


def split_into_chunks(text: str, max_chars: int | None = None) -> list[str]:
    """
    Chia nhỏ văn bản thành các đoạn tự nhiên và mạch lạc:
    - Luôn phân tách theo đoạn văn (xuống dòng \n) để giữ nhịp thở và cấu trúc văn bản.
    - Nếu đoạn văn dài hơn max_chars, ngắt tiếp theo dấu câu (. ? ! …).
    - Đảm bảo mỗi chunk luôn có dấu kết câu để mô hình hạ giọng dứt câu tự nhiên.
    """
    if max_chars is None:
        max_chars = MAX_CHUNK_CHARS
    cleaned = clean_vietnamese_text(text)
    paragraphs = [p.strip() for p in re.split(r"\n+", cleaned) if p.strip()]

    chunks: list[str] = []
    for p in paragraphs:
        if len(p) <= max_chars:
            chunks.append(p)
            continue

        # Phân tách theo ranh giới câu (. ? ! …)
        sentences = re.split(r"(?<=[.?!…])\s+", p)
        cur = ""
        for s in sentences:
            s = s.strip()
            if not s:
                continue
            if not cur:
                cur = s
            elif len(cur) + len(s) + 1 <= max_chars:
                cur += " " + s
            else:
                chunks.append(cur)
                cur = s
        if cur:
            chunks.append(cur)

    # Đảm bảo mỗi chunk kết thúc bằng dấu chấm ngắt câu nếu chưa có
    final_chunks: list[str] = []
    for c in chunks:
        c = c.strip()
        if c and not c.endswith((".", "!", "?", "…")):
            c += "."
        if c:
            final_chunks.append(c)

    return final_chunks or [cleaned]


VALID_INSTRUCT_TAGS = {
    "female", "male",
    "child", "teenager", "young adult", "middle-aged", "elderly",
    "very low pitch", "low pitch", "moderate pitch", "high pitch", "very high pitch",
    "whisper",
    "american accent", "australian accent", "british accent", "canadian accent",
    "chinese accent", "indian accent", "japanese accent", "korean accent",
    "portuguese accent", "russian accent",
}

INSTRUCT_SYNONYMS = {
    "gentle": "moderate pitch",
    "soft": "moderate pitch",
    "soft tone": "moderate pitch",
    "deep": "low pitch",
    "deep voice": "low pitch",
    "calm": "moderate pitch",
    "sweet": "high pitch",
    "energetic": "high pitch",
    "news": "moderate pitch",
    "broadcast news": "moderate pitch",
    "mysterious": "whisper",
}


def sanitize_instruct(instruct: str | None) -> str | None:
    """Lọc và chuẩn hóa instruct theo đúng bộ từ vựng OmniVoice hỗ trợ."""
    if not instruct or not instruct.strip():
        return None
    raw_tags = [t.strip().lower() for t in re.split(r"[,，]", instruct) if t.strip()]
    cleaned_tags: list[str] = []

    for tag in raw_tags:
        if tag in VALID_INSTRUCT_TAGS:
            if tag not in cleaned_tags:
                cleaned_tags.append(tag)
        elif tag in INSTRUCT_SYNONYMS:
            syn = INSTRUCT_SYNONYMS[tag]
            if syn not in cleaned_tags:
                cleaned_tags.append(syn)
        else:
            logger.warning(f"Bỏ qua instruct tag không hỗ trợ: '{tag}'")

    if not cleaned_tags:
        return "female, young adult, moderate pitch"

    return ", ".join(cleaned_tags)


def _save_audio_file(
    output_path: Path,
    audio: np.ndarray,
    sample_rate: int = SAMPLE_RATE,
    audio_format: str = "mp3",
) -> None:
    """
    Xuất file âm thanh ra đĩa với cơ chế fallback đa tầng (soundfile <-> torchaudio <-> pydub).

    Thứ tự ưu tiên được quyết định theo biến môi trường AUDIO_MP3_BACKEND:
      - 'auto'       : Thử 'soundfile' trước -> fallback 'torchaudio' -> fallback 'pydub'
      - 'soundfile'  : Thử 'soundfile' trước -> fallback 'torchaudio' -> fallback 'pydub'
      - 'torchaudio' : Thử 'torchaudio' trước -> fallback 'soundfile' -> fallback 'pydub'

    Đảm bảo luôn xuất được file âm thanh (đặc biệt là MP3) ngay cả khi môi trường
    không hỗ trợ TorchCodec hoặc gặp lỗi backend torchaudio trên Windows/CPU.
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fmt = (audio_format or "mp3").lower().strip()

    def _via_soundfile() -> None:
        sf_format = "MP3" if fmt == "mp3" else None
        sf.write(str(path), audio, sample_rate, format=sf_format)

    def _via_torchaudio() -> None:
        # pyrefly: ignore [missing-import]
        import torchaudio

        tensor_audio = torch.from_numpy(audio)
        if tensor_audio.ndim == 1:
            tensor_audio = tensor_audio.unsqueeze(0)
        torchaudio.save(str(path), tensor_audio, sample_rate, format=fmt)

    def _via_pydub() -> None:
        # pyrefly: ignore [missing-import]
        import pydub

        audio_int16 = (np.clip(audio, -1.0, 1.0) * 32767.0).astype(np.int16)
        channels = 1 if audio.ndim == 1 else audio.shape[1]
        segment = pydub.AudioSegment(
            audio_int16.tobytes(),
            frame_rate=sample_rate,
            sample_width=2,
            channels=channels,
        )
        segment.export(str(path), format=fmt)

    # Nếu là định dạng không phải MP3 (ví dụ WAV, FLAC, OGG...)
    if fmt != "mp3":
        try:
            _via_soundfile()
            return
        except Exception as err:
            logger.warning(f"⚠️ Xuất định dạng '{fmt}' bằng soundfile thất bại ({err}), thử torchaudio...")
            try:
                _via_torchaudio()
                return
            except Exception as terr:
                logger.warning(f"⚠️ Fallback torchaudio cũng thất bại ({terr}), thử pydub...")
                _via_pydub()
                return

    # Đối với MP3: Quyết định thứ tự backend dựa theo cấu hình AUDIO_MP3_BACKEND
    backend_pref = os.getenv("AUDIO_MP3_BACKEND", AUDIO_MP3_BACKEND).lower().strip()
    if backend_pref == "torchaudio":
        backends = [
            ("torchaudio", _via_torchaudio),
            ("soundfile", _via_soundfile),
            ("pydub", _via_pydub),
        ]
    else:  # "auto", "soundfile", hoặc mặc định
        backends = [
            ("soundfile", _via_soundfile),
            ("torchaudio", _via_torchaudio),
            ("pydub", _via_pydub),
        ]

    errors: list[str] = []
    for idx, (name, exporter) in enumerate(backends):
        try:
            exporter()
            if idx > 0:
                logger.info(f"✅ Fallback thành công! Đã xuất file MP3 bằng '{name}': {path.name}")
            return
        except Exception as err:
            err_msg = f"{name}: {type(err).__name__} ({err})"
            errors.append(err_msg)
            if idx < len(backends) - 1:
                next_backend = backends[idx + 1][0]
                logger.warning(
                    f"⚠️ Xuất MP3 bằng '{name}' không thành công [{type(err).__name__}: {err}]. "
                    f"Tự động chuyển fallback sang '{next_backend}'..."
                )

    raise RuntimeError(
        f"Không thể xuất file MP3 '{path.name}' sau khi thử tất cả backends: {'; '.join(errors)}"
    )


def generate_audio(
    text: str,
    output_path: Path,
    mode: str = "clone",
    voice_clone_prompt: VoiceClonePrompt | None = None,
    ref_audio: str | None = None,
    ref_text: str | None = None,
    instruct: str | None = None,
    cfg_value: float = 2.0,
    num_step: int | None = None,
    seed: int | None = 42,
    speed: float = 1.0,
    pitch: float = 0.0,
    audio_format: str = "mp3",
) -> None:
    """
    Gọi OmniVoice.generate() và lưu file âm thanh 24kHz đầu ra.

    Các chế độ (mode):
      - 'clone' : Voice Cloning (dùng voice_clone_prompt đã cache hoặc ref_audio).
      - 'design': Voice Design (dùng câu lệnh mô tả instruct, tự động neo giọng giữa các chunk).
    """
    if num_step is None:
        num_step = int(os.getenv("DEFAULT_NUM_STEP", str(DEFAULT_NUM_STEP)))

    model = get_model()

    if seed is not None:
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)

    cleaned_full_text = clean_vietnamese_text(text)
    chunks = split_into_chunks(text, max_chars=MAX_CHUNK_CHARS)

    logger.info(
        f"OmniVoice synthesis | Mode={mode} | num_step={num_step} | Chunks={len(chunks)} | max_chars={MAX_CHUNK_CHARS} | Text: '{cleaned_full_text[:60]}…'"
    )

    all_audios: list[np.ndarray] = []
    design_voice_clone_prompt: VoiceClonePrompt | None = None
    clean_inst = sanitize_instruct(instruct) if mode == "design" else None

    # ─── [Voice Cloning] GPU Warmup Phase (Chỉ chạy 1 lần nếu được bật) ──────
    global _has_warmed_up
    if ENABLE_WARMUP_ONCE and not _has_warmed_up and mode == "clone":
        try:
            logger.info("🔥 [Voice Cloning] Đang warmup GPU 1 lần duy nhất...")
            warmup_kwargs: dict = {
                "text": "Xin chào.",
                "language": "vi",
                "num_step": min(8, num_step),
                "guidance_scale": cfg_value,
                "normalize_text": False,
                "speed": speed,
            }
            if voice_clone_prompt is not None:
                warmup_kwargs["voice_clone_prompt"] = voice_clone_prompt
            elif ref_audio:
                warmup_kwargs["ref_audio"] = ref_audio
                if ref_text and ref_text.strip():
                    warmup_kwargs["ref_text"] = clean_vietnamese_text(ref_text)
            model.generate(**warmup_kwargs)
            _has_warmed_up = True
            logger.info("✅ [Voice Cloning] GPU warmup lần đầu hoàn tất!")
        except Exception as e:
            logger.warning(f"⚠️ GPU warmup thất bại (không ảnh hưởng kết quả): {e}")

    # ─── [Voice Design] Warmup Phase ─────────────────────────────────────────
    # Trong mode "design", sinh trước câu ngắn để trích xuất prompt cho các chunk sau
    if mode == "design" and clean_inst and len(chunks) > 1:
        try:
            logger.info("🎙️ [Voice Design] Đang sinh warmup để trích xuất VoiceClonePrompt cho toàn bộ audio…")
            warmup_text = "Xin chào, đây là giọng đọc thử nghiệm."
            warmup_list = model.generate(
                text=warmup_text,
                language="vi",
                num_step=min(8, num_step),
                guidance_scale=cfg_value,
                normalize_text=False,
                speed=speed,
                instruct=clean_inst,
            )
            if warmup_list and len(warmup_list) > 0:
                warmup_np = np.array(warmup_list[0], dtype=np.float32)
                if warmup_np.ndim > 1:
                    warmup_np = warmup_np.squeeze()
                warmup_tensor = torch.from_numpy(warmup_np)
                design_voice_clone_prompt = model.create_voice_clone_prompt(
                    ref_audio=(warmup_tensor, SAMPLE_RATE),
                    ref_text=warmup_text,
                    preprocess_prompt=True,
                )
                logger.info("✅ [Voice Design] Warmup hoàn tất — toàn bộ chunks sẽ dùng giọng nhất quán!")
        except Exception as e:
            logger.warning(f"⚠️ Warmup thất bại, fallback về mode instruct cho chunk 1: {e}")

    try:
        with torch.inference_mode():
            for idx, chunk in enumerate(chunks):
                logger.info(f"Đang sinh chunk [{idx + 1}/{len(chunks)}]: '{chunk[:50]}...'")

                gen_kwargs = {
                    "text": chunk,
                    "language": "vi",
                    "num_step": num_step,
                    "guidance_scale": cfg_value,
                    "normalize_text": False,
                    "speed": speed,
                }

                if mode == "clone":
                    if voice_clone_prompt is not None:
                        gen_kwargs["voice_clone_prompt"] = voice_clone_prompt
                    elif ref_audio:
                        gen_kwargs["ref_audio"] = ref_audio
                        if ref_text and ref_text.strip():
                            gen_kwargs["ref_text"] = clean_vietnamese_text(ref_text)
                elif mode == "design":
                    if design_voice_clone_prompt is not None:
                        gen_kwargs["voice_clone_prompt"] = design_voice_clone_prompt
                    elif clean_inst:
                        gen_kwargs["instruct"] = clean_inst

                audio_list = model.generate(**gen_kwargs)
                if audio_list and len(audio_list) > 0:
                    audio_np = np.array(audio_list[0], dtype=np.float32)
                    if audio_np.ndim > 1:
                        audio_np = audio_np.squeeze()

                    all_audios.append(audio_np)

                if ENABLE_EMPTY_CACHE and torch.cuda.is_available():
                    torch.cuda.empty_cache()

    finally:
        if ENABLE_EMPTY_CACHE:
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()


    if not all_audios:
        raise ValueError("Không có âm thanh nào được tạo ra từ mô hình.")

    # Ghép các đoạn audio lại với khoảng lặng 0.22s giữa các câu
    silence_samples = int(SAMPLE_RATE * 0.22)
    silence_array = np.zeros(silence_samples, dtype=np.float32)

    final_pieces: list[np.ndarray] = []
    for i, a in enumerate(all_audios):
        # Mờ dần 10ms ở đầu và đuôi câu để khử tiếng click nổ
        fade_len = int(SAMPLE_RATE * 0.01)
        if len(a) > fade_len * 2:
            fade_in = np.linspace(0, 1, fade_len, dtype=np.float32)
            fade_out = np.linspace(1, 0, fade_len, dtype=np.float32)
            a[:fade_len] *= fade_in
            a[-fade_len:] *= fade_out

        final_pieces.append(a)
        if i < len(all_audios) - 1:
            final_pieces.append(silence_array)

    audio = np.concatenate(final_pieces)

    # Xử lý hiệu ứng DSP: Cao độ (Pitch) nếu người dùng có yêu cầu
    # Lưu ý: Tốc độ (Speed) đã được OmniVoice xử lý tự nhiên trực tiếp trong diffusion tokens,
    # không dùng librosa.effects.time_stretch để tránh méo pha (phase distortion/metallic reverb).
    if pitch != 0.0:
        # pyrefly: ignore [missing-import]
        import librosa
        audio = librosa.effects.pitch_shift(audio, sr=SAMPLE_RATE, n_steps=pitch)

    # Lưu file âm thanh với cơ chế fallback tự động theo AUDIO_MP3_BACKEND
    save_audio_file(
        output_path=output_path,
        audio=audio,
        sample_rate=SAMPLE_RATE,
        audio_format=audio_format,
    )

    logger.info(
        f"💾 Đã lưu: {output_path.name} | {len(audio) / SAMPLE_RATE:.2f}s | {SAMPLE_RATE}Hz | Format: {audio_format}"
    )
