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
from dotenv import load_dotenv
import soundfile as sf
import numpy as np
import torch
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
DEFAULT_NUM_STEP = int(os.getenv("DEFAULT_NUM_STEP", "32"))


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

    # Nâng cấp thuật toán ước tính độ dài token cho tiếng Việt và tốc độ cao:
    # 1. Tiếng Việt đơn âm tiết kèm thanh điệu cần thêm ~20% token đệm để không nuốt âm đuôi.
    # 2. Khi speed > 1.0, không chia tuyến tính để tránh bóp nghẽn token sinh làm cụt chữ cuối câu.
    orig_est = _model._estimate_target_tokens

    def vietnamese_estimate_target_tokens(text, ref_text, num_ref_audio_tokens, speed=1.0):
        est = orig_est(text, ref_text, num_ref_audio_tokens, speed=1.0)
        # Thêm 20% token đệm cho tiếng Việt
        est = est * 1.20
        if speed > 0 and speed != 1.0:
            est = est / (speed ** 0.8)
        return max(20, int(est))

    _model._estimate_target_tokens = vietnamese_estimate_target_tokens

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
    # Thay dấu hai chấm và chấm phẩy bằng dấu ngắt câu tự nhiên
    text = re.sub(r":\s*", ". ", text)
    text = re.sub(r";\s*", ", ", text)
    # Loại bỏ ngoặc kép và ngoặc đơn lạ
    text = re.sub(r'["“”\'‘’«»]', '', text)
    # Chuẩn hóa nhiều dấu chấm, gạch ngang liên tiếp
    text = re.sub(r"\.{2,}", ".", text)
    text = re.sub(r"-{2,}", "-", text)
    # Chuẩn hóa khoảng trắng
    text = re.sub(r"[ \t]+", " ", text).strip()
    return text


def split_into_chunks(text: str, max_chars: int = 240) -> list[str]:
    """
    Chia nhỏ văn bản thành các đoạn tự nhiên và mạch lạc:
    - Luôn phân tách theo đoạn văn (xuống dòng \\n) để giữ nhịp thở và cấu trúc văn bản.
    - Nếu đoạn văn dài hơn max_chars, ngắt tiếp theo dấu câu (. ? ! …).
    - Đảm bảo mỗi chunk luôn có dấu kết câu để mô hình hạ giọng dứt câu tự nhiên.
    """
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
    chunks = split_into_chunks(text, max_chars=240)

    logger.info(
        f"OmniVoice synthesis | Mode={mode} | num_step={num_step} | Chunks={len(chunks)} | Text: '{cleaned_full_text[:60]}…'"
    )

    all_audios: list[np.ndarray] = []
    design_voice_clone_prompt: VoiceClonePrompt | None = None
    clean_inst = sanitize_instruct(instruct) if mode == "design" else None

    try:
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
                    # Từ chunk 2 trở đi: Sử dụng prompt clone từ Chunk 1 để giữ 100% cùng 1 người nói
                    gen_kwargs["voice_clone_prompt"] = design_voice_clone_prompt
                elif clean_inst:
                    # Chunk 1: Sinh giọng theo thuộc tính instruct người dùng đã thiết kế
                    gen_kwargs["instruct"] = clean_inst

            audio_list = model.generate(**gen_kwargs)
            if audio_list and len(audio_list) > 0:
                audio_np = np.array(audio_list[0], dtype=np.float32)
                if audio_np.ndim > 1:
                    audio_np = audio_np.squeeze()

                # Gọt sạch khoảng lặng thực sự ranh giới (dùng top_db=45 để không xén mất âm cuối nhỏ nhẹ)
                try:
                    trimmed_np, _ = librosa.effects.trim(audio_np, top_db=45)
                    if len(trimmed_np) > SAMPLE_RATE * 0.2:
                        audio_np = trimmed_np
                except Exception:
                    pass

                all_audios.append(audio_np)

                # Neo giọng cho mode design: Trích xuất VoiceClonePrompt từ chunk đầu tiên
                if mode == "design" and design_voice_clone_prompt is None and len(chunks) > 1:
                    try:
                        tensor_audio = torch.from_numpy(audio_np)
                        design_voice_clone_prompt = model.create_voice_clone_prompt(
                            ref_audio=(tensor_audio, SAMPLE_RATE),
                            ref_text=chunk,
                            preprocess_prompt=True,
                        )
                        logger.info("✨ [Voice Design] Đã neo giọng thành công từ Chunk 1 cho toàn bộ các chunk tiếp theo!")
                    except Exception as e:
                        logger.warning(f"Không thể tạo design_voice_clone_prompt từ chunk 1: {e}")

            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    finally:
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
        import librosa
        audio = librosa.effects.pitch_shift(audio, sr=SAMPLE_RATE, n_steps=pitch)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Lưu file
    if audio_format == "mp3":
        import torchaudio

        tensor_audio = torch.from_numpy(audio).unsqueeze(0)
        torchaudio.save(str(output_path), tensor_audio, SAMPLE_RATE, format="mp3")
    else:
        sf.write(str(output_path), audio, SAMPLE_RATE)

    logger.info(
        f"💾 Đã lưu: {output_path.name} | {len(audio) / SAMPLE_RATE:.2f}s | {SAMPLE_RATE}Hz | Format: {audio_format}"
    )
