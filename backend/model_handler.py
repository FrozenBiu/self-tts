"""
model_handler.py
────────────────
Chứa toàn bộ logic liên quan đến VoxCPM2:
  - Load mô hình vào VRAM (gọi 1 lần khi startup).
  - generate_audio(): wrapper gọn gàng cho model.generate().
"""

import os
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
import logging
import soundfile as sf
from pathlib import Path
from voxcpm import VoxCPM

# Tự động tải biến môi trường từ file .env (nếu có)
load_dotenv()

logger = logging.getLogger(__name__)

# ─── Global model holder ────────────────────────────────────────────────────
_model: VoxCPM | None = None

# Sample rate thực tế của VoxCPM2 = 16000 Hz (xác nhận qua model.tts_model.sample_rate)
# KHÔNG dùng 48000 — audio sẽ bị phát nhanh gấp 3x
SAMPLE_RATE = 16_000

# Tên model trên HuggingFace Hub (hoặc thay bằng đường dẫn local nếu cần)
MODEL_ID = "openbmb/VoxCPM2"

# Lấy cấu hình tối ưu phần cứng từ .env
VOXCPM_HALF_PRECISION = os.getenv("VOXCPM_HALF_PRECISION", "False").lower() in ("true", "1", "yes")
VOXCPM_LOAD_DENOISER = os.getenv("VOXCPM_LOAD_DENOISER", "False").lower() in ("true", "1", "yes")
VOXCPM_FORCE_CPU = os.getenv("VOXCPM_FORCE_CPU", "False").lower() in ("true", "1", "yes")

def load_model() -> None:
    """
    Load VoxCPM2 vào VRAM.
    Gọi hàm này duy nhất một lần trong FastAPI startup event.
    Cấu hình half_precision và load_denoiser sẽ được lấy từ file .env
    """
    global _model
    if _model is not None:
        logger.info("Model đã được load, bỏ qua.")
        return

    device_val = "cpu" if VOXCPM_FORCE_CPU else None
    logger.info(f"Đang load model {MODEL_ID} vào VRAM (Half Precision={VOXCPM_HALF_PRECISION}, Denoiser={VOXCPM_LOAD_DENOISER}, Force CPU={VOXCPM_FORCE_CPU}) …")
    _model = VoxCPM.from_pretrained(
        MODEL_ID, 
        load_denoiser=VOXCPM_LOAD_DENOISER,
        device=device_val
    )
    
    if VOXCPM_HALF_PRECISION:
        try:
            logger.info("🔄 Đang ép mô hình chạy ở Half Precision (FP16) để tối ưu VRAM...")
            _model.tts_model.half()
            if hasattr(_model.tts_model, "config"):
                _model.tts_model.config.dtype = "float16"
                
                # Cấu hình lại bộ nhớ đệm (KV Cache) từ bfloat16 sang float16
                import torch
                max_len = getattr(_model.tts_model.config, "max_length", 4096)
                device_val = getattr(_model.tts_model, "device", "cuda")
                
                if hasattr(_model.tts_model, "base_lm"):
                    _model.tts_model.base_lm.setup_cache(1, max_len, device_val, torch.float16)
                if hasattr(_model.tts_model, "residual_lm"):
                    _model.tts_model.residual_lm.setup_cache(1, max_len, device_val, torch.float16)
        except Exception as e:
            logger.warning(f"⚠️ Không thể ép kiểu FP16: {e}")
            
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
    seed: int | None = 42,
    speed: float = 1.0,
    pitch: float = 0.0,
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
    
    if seed is not None:
        import torch
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
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
    
    import torch
    if VOXCPM_FORCE_CPU:
        device_type = "cpu"
    else:
        device_type = "cuda" if torch.cuda.is_available() else "cpu"
    
    if VOXCPM_HALF_PRECISION and device_type == "cuda":
        # Tự động đồng bộ kiểu dữ liệu (dtype) cho đầu vào để khớp với mô hình đã ép kiểu FP16
        with torch.autocast(device_type=device_type, dtype=torch.float16):
            wav = model.generate(**kwargs)
    else:
        wav = model.generate(**kwargs)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    import numpy as np

    # Ép về float32 1D (khớp với output type của model.generate())
    audio = np.array(wav, dtype=np.float32)
    if audio.ndim > 1:
        audio = audio.squeeze()

    # Lấy sample rate thực tế từ model (16000 Hz)
    actual_sr = model.tts_model.sample_rate

    # Audio DSP: Điều chỉnh Speed và Pitch trực tiếp trên NumPy array
    if speed != 1.0 or pitch != 0.0:
        import librosa
        if speed != 1.0:
            audio = librosa.effects.time_stretch(audio, rate=speed)
        if pitch != 0.0:
            audio = librosa.effects.pitch_shift(audio, sr=actual_sr, n_steps=pitch)

    # Ghi WAV — khớp 100% với cách CLI chính thức của voxcpm:
    sf.write(str(output_path), audio, actual_sr)
    logger.info(f"Saved: {output_path.name} | {len(audio)/actual_sr:.2f}s | sr={actual_sr}")
