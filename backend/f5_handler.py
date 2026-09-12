import os
import sys
import gc
import logging
import torch
import numpy as np
import builtins
from pathlib import Path
from typing import Optional, Tuple
from huggingface_hub import hf_hub_download

# Đảm bảo môi trường console trên Windows không bao giờ bị crash UnicodeEncodeError
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Bảo vệ an toàn cho hàm print khi các thư viện bên thứ 3 in ký tự tiếng Việt
_orig_builtin_print = builtins.print

def _safe_builtin_print(*args, **kwargs):
    try:
        _orig_builtin_print(*args, **kwargs)
    except UnicodeEncodeError:
        try:
            safe_args = [str(a).encode("ascii", "replace").decode("ascii") for a in args]
            _orig_builtin_print(*safe_args, **kwargs)
        except Exception:
            pass

builtins.print = _safe_builtin_print

from f5_tts.model import DiT, CFM
from f5_tts.infer.utils_infer import (
    load_vocoder,
    infer_process,
    preprocess_ref_audio_text,
    load_model,
)

# Import module DSP Studio Hi-Fi đã tối ưu
from audio_processor import enhance_vocal_audio

logger = logging.getLogger(__name__)

# Hằng số cấu hình F5-TTS tiếng Việt
F5_REPO_ID = "hynt/F5-TTS-Vietnamese-ViVoice"
LOCAL_MODELS_DIR = Path(__file__).resolve().parent / "local_models" / "f5_tts"
LOCAL_MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Singleton model instances
_f5_model = None
_f5_vocoder = None
_f5_vocab_file = None
_current_device = "cuda" if torch.cuda.is_available() else "cpu"


def ensure_f5_vietnamese_checkpoint() -> Tuple[str, str]:
    """
    Đảm bảo checkpoint và file từ vựng (vocab.txt) của F5-TTS tiếng Việt sẵn sàng.
    Xử lý đặc thù của repo hynt/F5-TTS-Vietnamese-ViVoice:
    - Tác giả đặt nhầm tên file vocab.txt thành config.json trên HuggingFace.
    - Hàm này sẽ tải về và đổi tên/sử dụng đúng chuẩn vocab_file cho F5-TTS.
    """
    vocab_path = LOCAL_MODELS_DIR / "vocab.txt"
    ckpt_path = LOCAL_MODELS_DIR / "model_last.pt"

    # 1. Tải và xử lý file vocab nếu chưa có
    if not vocab_path.exists():
        logger.info(f"📥 Đang tải file từ vựng từ {F5_REPO_ID}...")
        downloaded_config = hf_hub_download(
            repo_id=F5_REPO_ID,
            filename="config.json",
            local_dir=str(LOCAL_MODELS_DIR),
        )
        # Đổi tên hoặc copy config.json thành vocab.txt
        if os.path.exists(downloaded_config):
            with open(downloaded_config, "r", encoding="utf-8") as f_in:
                vocab_content = f_in.read()
            with open(vocab_path, "w", encoding="utf-8") as f_out:
                f_out.write(vocab_content)
            logger.info("✅ Đã chuẩn hóa file vocab.txt cho tiếng Việt.")

    # 2. Tải checkpoint model_last.pt (5.39 GB) nếu chưa có
    if not ckpt_path.exists():
        logger.info(f"📥 Đang tải checkpoint F5-TTS tiếng Việt (model_last.pt ~5.39GB) từ {F5_REPO_ID}...")
        logger.info("Quá trình này có thể mất vài phút tùy vào tốc độ mạng của bạn...")
        hf_hub_download(
            repo_id=F5_REPO_ID,
            filename="model_last.pt",
            local_dir=str(LOCAL_MODELS_DIR),
        )
        logger.info("✅ Đã tải xong checkpoint F5-TTS tiếng Việt!")

    return str(ckpt_path), str(vocab_path)


def unload_f5_model() -> None:
    """Giải phóng mô hình F5-TTS khỏi VRAM để nhường chỗ cho mô hình khác."""
    global _f5_model, _f5_vocoder
    if _f5_model is not None:
        logger.info("🧹 Đang giải phóng F5-TTS khỏi bộ nhớ GPU VRAM...")
        del _f5_model
        _f5_model = None
    if _f5_vocoder is not None:
        del _f5_vocoder
        _f5_vocoder = None
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    logger.info("✅ Đã dọn dẹp bộ nhớ đệm VRAM của F5-TTS.")


def get_f5_model():
    """Tải và trả về model F5-TTS cùng Vocos vocoder (Singleton)."""
    global _f5_model, _f5_vocoder, _f5_vocab_file

    if _f5_model is not None and _f5_vocoder is not None:
        return _f5_model, _f5_vocoder

    logger.info(f"🚀 Đang khởi tạo F5-TTS tiếng Việt trên thiết bị: {_current_device}...")
    ckpt_file, vocab_file = ensure_f5_vietnamese_checkpoint()
    _f5_vocab_file = vocab_file

    # Cấu hình F5-TTS Base
    model_cfg = dict(
        dim=1024,
        depth=22,
        heads=16,
        ff_mult=2,
        text_dim=512,
        conv_layers=4,
    )

    # 1. Load DiT Base model
    _f5_model = load_model(
        model_cls=DiT,
        model_cfg=model_cfg,
        ckpt_path=ckpt_file,
        mel_spec_type="vocos",
        vocab_file=vocab_file,
        device=_current_device,
    )

    # 2. Load Vocos vocoder
    _f5_vocoder = load_vocoder(
        vocoder_name="vocos",
        is_local=False,
        device=_current_device,
    )

    logger.info("✅ F5-TTS tiếng Việt đã sẵn sàng phục vụ!")
    return _f5_model, _f5_vocoder


def generate_f5_audio(
    text: str,
    ref_audio: str,
    ref_text: str = "",
    speed: float = 1.0,
    nfe_step: int = 32,
    cfg_strength: float = 2.0,
    enhance_audio: bool = True,
) -> Tuple[np.ndarray, int]:
    """
    Tổng hợp âm thanh Voice Cloning bằng mô hình F5-TTS tiếng Việt:
    - text: Văn bản cần tổng hợp
    - ref_audio: Đường dẫn file âm thanh mẫu (WAV/MP3)
    - ref_text: Nội dung của file âm thanh mẫu (nếu rỗng, F5-TTS sẽ tự suy đoán hoặc bỏ qua)
    - speed: Tốc độ nói (0.5x - 2.0x)
    - nfe_step: Số bước suy luận Flow Matching (mặc định 32)
    - cfg_strength: Độ bám sát hướng dẫn Classifier-Free Guidance (mặc định 2.0)
    - enhance_audio: Bật/tắt bộ lọc Studio Hi-Fi DSP (44.1kHz, 320kbps)
    """
    model, vocoder = get_f5_model()

    logger.info(
        f"🎙️ F5-TTS Synthesis | Text: '{text[:60]}…' | Speed={speed} | NFE={nfe_step} | CFG={cfg_strength} | Enhance={enhance_audio}"
    )

    # Đảm bảo ref_text không rỗng để tránh kích hoạt Whisper ASR (vốn lỗi torchcodec trên Windows)
    clean_ref_text = (ref_text or "").strip()
    if not clean_ref_text:
        clean_ref_text = "Đôi khi, việc chậm lại một nhịp giữa cuộc sống hối hả này mới là cách tốt nhất."

    # Tiền xử lý audio mẫu
    ref_audio_proc, ref_text_proc = preprocess_ref_audio_text(
        ref_audio_orig=ref_audio,
        ref_text=clean_ref_text,
    )

    # Chạy suy luận Flow Matching bằng F5-TTS
    audio_segment, final_sample_rate, _ = infer_process(
        ref_audio=ref_audio_proc,
        ref_text=ref_text_proc,
        gen_text=text,
        model_obj=model,
        vocoder=vocoder,
        mel_spec_type="vocos",
        speed=speed,
        nfe_step=nfe_step,
        cfg_strength=cfg_strength,
        device=_current_device,
    )

    # audio_segment là numpy array dạng float32
    audio_np = np.array(audio_segment, dtype=np.float32)
    if audio_np.ndim > 1:
        audio_np = audio_np.squeeze()

    # Áp dụng bộ lọc Studio Hi-Fi (Low-cut, EQ, Soft Compressor, Resample 44.1kHz) nếu được bật
    if enhance_audio:
        audio_np, final_sample_rate = enhance_vocal_audio(
            audio_np,
            sr=final_sample_rate,
            target_sr=44100,
        )

    return audio_np, final_sample_rate
