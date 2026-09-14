# 📖 CẨM NANG HƯỚNG DẪN SỬ DỤNG HỆ THỐNG SELF-TTS

Chào mừng bạn đến với bộ tài liệu hướng dẫn triển khai và vận hành hệ thống **Self-TTS (OmniVoice Vietnamese Text-to-Speech)**. Dự án được thiết kế linh hoạt với kiến trúc **Hybrid Compute**, cho phép bạn chạy mô hình AI trên nhiều môi trường khác nhau tùy theo cấu hình phần cứng của bạn.

---

## 🗺️ Ma Trận Lựa Chọn Phương Án Vận Hành

| Tiêu chí | 🖥️ 1. GPU Local (Máy Bàn/Laptop) | ☕ 2. Google Colab + Ngrok | 🤗 3. Hugging Face Space (ZeroGPU) |
| :--- | :--- | :--- | :--- |
| **Phần cứng yêu cầu** | Card NVIDIA RTX (>= 6GB VRAM) | Mọi máy tính (chỉ cần trình duyệt) | Mọi máy tính (chỉ cần trình duyệt) |
| **Phần cứng AI chạy** | GPU máy bạn (CUDA) | NVIDIA Tesla T4 16GB VRAM | NVIDIA A100 40GB/80GB VRAM |
| **Tốc độ sinh âm thanh** | Siêu nhanh (0.5s - 1.5s/câu) | Rất nhanh (1s - 2s/câu) | Cực nhanh (0.8s - 1.5s/câu) |
| **Chi phí** | 100% Miễn phí | 100% Miễn phí | 100% Miễn phí |
| **Tính tiện lợi** | Bật là chạy, không cần mạng | Cần bấm Play trên Colab mỗi ngày | Chạy ngầm 24/7 trên Cloud, tự kết nối |
| **Độ ổn định** | Tuyệt đối (không phụ thuộc cloud) | Chạy 4 - 12 tiếng/phiên | Rất cao (có thể ngủ đông nếu 48h không dùng) |
| **Tài liệu chi tiết** | [👉 Xem hướng dẫn GPU Local](./01_GPU_LOCAL.md) | [👉 Xem hướng dẫn Colab + Ngrok](./02_GOOGLE_COLAB_NGROK.md) | [👉 Xem hướng dẫn HuggingFace](./03_HUGGINGFACE_ZEROGPU.md) |

---

## 📁 Danh Sách Các Tài Liệu Chi Tiết

1. **[01_GPU_LOCAL.md](./01_GPU_LOCAL.md)**: Hướng dẫn cài đặt và cấu hình chạy trực tiếp trên card đồ họa NVIDIA của máy tính (Offline 100%).
2. **[02_GOOGLE_COLAB_NGROK.md](./02_GOOGLE_COLAB_NGROK.md)**: Hướng dẫn tạo tài khoản Ngrok, lấy Static Domain cố định vĩnh viễn, chạy Colab T4 16GB và kết nối tự động về máy.
3. **[03_HUGGINGFACE_ZEROGPU.md](./03_HUGGINGFACE_ZEROGPU.md)**: Hướng dẫn tạo Space ZeroGPU A100 trên Hugging Face, đưa code lên và cấu hình làm server AI đám mây 24/7.

---

## ⚡ Khởi Chạy Nhanh Ứng Dụng Sau Khi Cấu Hình

Dù bạn chọn phương án nào ở trên, khi đã cấu hình xong file `backend/.env`, việc khởi động ứng dụng trên máy bạn luôn chỉ gồm 2 lệnh:

```bash
# Terminal 1: Chạy Backend API (FastAPI)
cd backend
venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Chạy Frontend Studio (React + Vite)
cd frontend
pnpm dev
```
👉 Sau đó mở trình duyệt tại: `http://localhost:5173` để bắt đầu lồng tiếng!
