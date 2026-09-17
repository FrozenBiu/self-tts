"""
Module Audio Cleaner: Tách nhạc nền (Vocal Isolation qua Demucs) và Khử ồn (Denoise)
Được tối ưu cho quá trình tiền xử lý mẫu âm thanh tham chiếu trước khi Clone giọng (OmniVoice).
"""

import logging
import gc
from pathlib import Path
from typing import Union
import numpy as np
import soundfile as sf

try:
    import torch
except ImportError:
    torch = None

try:
    import librosa
except ImportError:
    librosa = None

try:
    import noisereduce as nr
except ImportError:
    nr = None

logger = logging.getLogger(__name__)

_demucs_model = None
_demucs_device = None


def get_demucs_model():
    """Nạp singleton mô hình Demucs (htdemucs) lên thiết bị tối ưu (CUDA nếu có, ngược lại CPU)."""
    global _demucs_model, _demucs_device
    if _demucs_model is None:
        import demucs.pretrained
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"🎙️ [AudioCleaner] Đang nạp mô hình Demucs (htdemucs) trên [{device.upper()}]...")
        model = demucs.pretrained.get_model("htdemucs")
        model.to(device)
        model.eval()
        _demucs_model = model
        _demucs_device = device
        logger.info("✅ [AudioCleaner] Nạp Demucs thành công!")
    return _demucs_model, _demucs_device


def isolate_vocals(
    audio: np.ndarray,
    sr: int,
    target_sr: int = 24000,
) -> np.ndarray:
    """
    Tách vocal khỏi nhạc nền BGM sử dụng mô hình Demucs.
    Input: Audio mono (1D ndarray) hoặc stereo (2D ndarray) với tần số lấy mẫu sr.
    Output: Audio mono (1D ndarray) chứa giọng nói đã lọc sạch nhạc nền ở target_sr.
    """
    try:
        model, device = get_demucs_model()
        from demucs.apply import apply_model

        # 1. Đảm bảo audio ở dạng float32
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)

        # 2. Resample sang samplerate của Demucs (44,100 Hz) nếu khác
        demucs_sr = model.samplerate
        if sr != demucs_sr:
            audio_44k = librosa.resample(audio, orig_sr=sr, target_sr=demucs_sr)
        else:
            audio_44k = audio

        # 3. Chuẩn hóa về dạng stereo tensor (1, 2, samples)
        if audio_44k.ndim == 1:
            tensor_mix = torch.from_numpy(audio_44k).unsqueeze(0).repeat(2, 1).unsqueeze(0)
        elif audio_44k.shape[0] == 2:
            tensor_mix = torch.from_numpy(audio_44k).unsqueeze(0)
        else:
            tensor_mix = torch.from_numpy(audio_44k.T).unsqueeze(0)

        tensor_mix = tensor_mix.to(device)

        # 4. Áp dụng mô hình tách stem
        with torch.no_grad():
            # sources shape: [batch, sources_count, channels, samples]
            # htdemucs sources: ['drums', 'bass', 'other', 'vocals']
            sources = apply_model(model, tensor_mix, device=device, split=True, progress=False)

        vocal_idx = model.sources.index("vocals")
        vocal_tensor = sources[0, vocal_idx]  # shape: [2, samples]

        # 5. Chuyển stereo về mono bằng trung bình cộng 2 kênh
        vocal_np = vocal_tensor.mean(dim=0).cpu().numpy()

        # Dọn dẹp bộ nhớ GPU
        del tensor_mix, sources, vocal_tensor
        if device == "cuda":
            torch.cuda.empty_cache()
            gc.collect()

        # 6. Resample về tần số mục tiêu (mặc định 24,000 Hz cho OmniVoice)
        if demucs_sr != target_sr:
            vocal_final = librosa.resample(vocal_np, orig_sr=demucs_sr, target_sr=target_sr)
        else:
            vocal_final = vocal_np

        logger.info(f"✨ [AudioCleaner] Đã tách vocal thành công: thời lượng {len(vocal_final)/target_sr:.2f}s")
        return vocal_final.astype(np.float32)

    except Exception as e:
        logger.error(f"❌ [AudioCleaner] Lỗi khi tách vocal qua Demucs: {e}")
        # Nếu lỗi Demucs, fallback trả về audio gốc resample
        if sr != target_sr:
            return librosa.resample(audio, orig_sr=sr, target_sr=target_sr).astype(np.float32)
        return audio.astype(np.float32)


def denoise_audio(
    audio: np.ndarray,
    sr: int,
    prop_decrease: float = 0.85,
) -> np.ndarray:
    """
    Khử tạp âm tĩnh (tiếng quạt, ù nền, tiếng sôi mic) bằng Spectral Gating.
    """
    try:
        if len(audio) == 0:
            return audio

        # Áp dụng noisereduce
        cleaned = nr.reduce_noise(
            y=audio,
            sr=sr,
            prop_decrease=prop_decrease,
            stationary=True,
            n_fft=1024,
            win_length=1024,
            hop_length=512,
        )
        logger.info(f"✨ [AudioCleaner] Đã khử tạp âm nền thành công (prop={prop_decrease})")
        return cleaned.astype(np.float32)
    except Exception as e:
        logger.warning(f"⚠️ [AudioCleaner] Không thể khử ồn qua noisereduce: {e}")
        return audio


def clean_audio_pipeline(
    input_data: Union[str, Path, np.ndarray],
    sr: int | None = None,
    target_sr: int = 24000,
    isolate_vocal: bool = True,
    denoise: bool = True,
    normalize: bool = True,
) -> np.ndarray:
    """
    Pipeline toàn diện làm sạch audio:
    1. Đọc file hoặc nạp mảng numpy
    2. (Tuỳ chọn) Tách vocal khỏi beat/nhạc nền BGM
    3. (Tuỳ chọn) Khử tạp âm, tiếng xì xào
    4. (Tuỳ chọn) Peak normalize & Micro fade 10ms
    """
    # 1. Nạp audio
    if isinstance(input_data, (str, Path)):
        audio_np, loaded_sr = librosa.load(str(input_data), sr=None, mono=True)
    else:
        audio_np = input_data
        loaded_sr = sr or target_sr

    if audio_np.ndim > 1:
        audio_np = audio_np.mean(axis=0)

    current_sr = loaded_sr

    # 2. Tách nhạc nền nếu được yêu cầu
    if isolate_vocal:
        audio_np = isolate_vocals(audio_np, sr=current_sr, target_sr=target_sr)
        current_sr = target_sr
    elif current_sr != target_sr:
        audio_np = librosa.resample(audio_np, orig_sr=current_sr, target_sr=target_sr)
        current_sr = target_sr

    # 3. Khử tạp âm nếu được yêu cầu
    if denoise:
        audio_np = denoise_audio(audio_np, sr=current_sr, prop_decrease=0.85)

    # 4. Chuẩn hóa âm lượng Peak và Micro-fade chống click
    if normalize and len(audio_np) > 0:
        peak = np.max(np.abs(audio_np))
        if peak > 0:
            audio_np = (audio_np / peak) * 0.90

        fade_samples = min(int(current_sr * 0.01), len(audio_np) // 4)
        if fade_samples > 0:
            fade_in = np.linspace(0.0, 1.0, fade_samples, dtype=np.float32)
            fade_out = np.linspace(1.0, 0.0, fade_samples, dtype=np.float32)
            audio_np[:fade_samples] *= fade_in
            audio_np[-fade_samples:] *= fade_out

    return audio_np.astype(np.float32)
