"""
model_handler.py
────────────────
Chứa toàn bộ logic liên quan đến VoxCPM2:
  - Load mô hình vào VRAM (gọi 1 lần khi startup).
  - generate_audio(): wrapper gọn gàng cho model.generate().
"""

import logging
import soundfile as sf
from pathlib import Path
from voxcpm import VoxCPM

logger = logging.getLogger(__name__)

# ─── Global model holder ────────────────────────────────────────────────────
_model: VoxCPM | None = None

# Sample rate thực tế của VoxCPM2 = 16000 Hz (xác nhận qua model.tts_model.sample_rate)
# KHÔNG dùng 48000 — audio sẽ bị phát nhanh gấp 3x
SAMPLE_RATE = 16_000

# Tên model trên HuggingFace Hub (hoặc thay bằng đường dẫn local nếu cần)
MODEL_ID = "openbmb/VoxCPM2"


def load_model() -> None:
    """
    Load VoxCPM2 vào VRAM.
    Gọi hàm này duy nhất một lần trong FastAPI startup event.
    load_denoiser=False → tiết kiệm VRAM, phù hợp RTX 3060 12 GB.
    """
    global _model
    if _model is not None:
        logger.info("Model đã được load, bỏ qua.")
        return

    logger.info(f"Đang load model {MODEL_ID} vào VRAM …")
    _model = VoxCPM.from_pretrained(MODEL_ID, load_denoiser=False)
    logger.info("✅ Model load thành công!")


def get_model() -> VoxCPM:
    """Trả về model instance đã load. Raise RuntimeError nếu chưa load."""
    if _model is None:
        raise RuntimeError("Model chưa được khởi tạo. Kiểm tra startup event.")
    return _model


def generate_audio(
    text: str,
    output_path: Path,
    cfg_value: float = 2.0,
    inference_timesteps: int = 10,
    prompt_wav_path: str | None = None,
    prompt_text: str | None = None,
    normalize: bool = True,
) -> None:
    """
    Goi model.generate() va luu ket qua ra file WAV.

    VoxCPM2 (v2.0.3) co 2 che do hoat dong:
    - Voice Design: Khong truyen prompt (chi dung text thuan tuy).
    - Voice Cloning: Truyen prompt_wav_path + prompt_text.
      Model se clone giong noi trong file WAV tham chieu.

    Parameters
    ----------
    text              : Van ban can chuyen thanh giong noi.
    output_path       : Duong dan file .wav dau ra.
    cfg_value         : Guidance scale (1.0-3.0). Mac dinh 2.0.
    inference_timesteps: So buoc diffusion (4-30). Cao hon = chat luong hon.
    prompt_wav_path   : (Tuy chon) File WAV tham chieu de clone giong.
    prompt_text       : (Tuy chon) Transcript chinh xac cua prompt_wav_path.
    normalize         : Bat text normalization (so, ngay thang...).
    """
    model = get_model()

    kwargs = dict(
        text=text,
        cfg_value=cfg_value,
        inference_timesteps=inference_timesteps,
        normalize=normalize,
        denoise=False,
        retry_badcase=True,
    )

    if prompt_wav_path and prompt_text:
        kwargs["prompt_wav_path"] = prompt_wav_path
        kwargs["prompt_text"] = prompt_text
        logger.info(f"Mode: Voice Cloning  |  ref='{prompt_wav_path}'")
    else:
        logger.info("Mode: Voice Design (Zero-shot)")

    logger.info(f"Đang tổng hợp: '{text[:60]}…'")
    wav = model.generate(**kwargs)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    import numpy as np

    # Ép về float32 1D (khớp với output type của model.generate())
    audio = np.array(wav, dtype=np.float32)
    if audio.ndim > 1:
        audio = audio.squeeze()

    # Lấy sample rate thực tế từ model (16000 Hz)
    actual_sr = model.tts_model.sample_rate

    # Ghi WAV — khớp 100% với cách CLI chính thức của voxcpm:
    # sf.write(output_path, audio_array, model.tts_model.sample_rate)
    sf.write(str(output_path), audio, actual_sr)
    logger.info(f"Saved: {output_path.name} | {len(audio)/actual_sr:.2f}s | sr={actual_sr}")

