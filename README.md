# self-tts (VoxCPM2 Studio)

Hệ thống tổng hợp giọng nói AI chất lượng cao (Text-to-Speech) sử dụng model VoxCPM2 với giao diện web quản lý hiện đại (Aureum Design System).

Dự án được chia làm 2 phần độc lập: **Backend (Python/FastAPI)** và **Frontend (React/Vite)**.

## 🛠️ Yêu cầu hệ thống

- **Python 3.10+** (dành cho Backend)
- **Node.js 18+** (dành cho Frontend)
- **pnpm** (Trình quản lý package cho Frontend)

### 💻 Yêu cầu phần cứng (Hardware Requirements)
Dự án sử dụng mô hình AI (PyTorch + VoxCPM2), nên phần cứng đóng vai trò quan trọng:
- **Card đồ họa (VGA):** 
  - **Khuyến nghị:** NVIDIA RTX (từ 2060, 3060, 4060 trở lên) với VRAM >= 6GB. Hệ thống sẽ sử dụng kiến trúc CUDA để sinh âm thanh cực kỳ nhanh (2-3 giây).
  - **Laptop hoặc VGA AMD/Intel:** Các máy tính dùng VGA AMD (như Radeon 780M) hoặc không có card rời NVIDIA vẫn **chạy được bình thường**. Hệ thống sẽ tự động chuyển sang tính toán bằng **CPU**. Việc cài đặt không có gì thay đổi, tuy nhiên thời gian xử lý (Generate) sẽ lâu hơn một chút (khoảng 10-20 giây) tùy thuộc vào sức mạnh của CPU.
- **Bộ nhớ (RAM):** Tối thiểu **16GB** (Khuyến nghị 24GB+). Rất quan trọng khi chạy bằng CPU hoặc khi load mô hình vào bộ nhớ.
- **Ổ cứng:** Bắt buộc sử dụng **SSD** (ưu tiên NVMe) để có thể nạp mô hình `.safetensors` nặng vài GB một cách nhanh chóng.

---

## 🚀 Hướng dẫn cài đặt và chạy dự án

### 1. Khởi động Backend (FastAPI / AI Model)

Mở terminal mới và thực hiện các lệnh sau:

```bash
# 1. Di chuyển vào thư mục backend
cd backend

# 2. Tạo môi trường ảo (Virtual Environment)
python -m venv venv

# 3. Kích hoạt môi trường ảo (trên Windows)
.\venv\Scripts\activate

# 4. Cài đặt các thư viện cần thiết
# Lưu ý: Cần sử dụng voxcpm==2.0.3 để tránh lỗi nhiễu âm thanh trên Windows
pip install -r requirements.txt

# 5. Khởi chạy Server
uvicorn main:app --host 0.0.0.0 --port 8000
```

_Server Backend sẽ chạy tại địa chỉ: `http://localhost:8000`_

### 2. Khởi động Frontend (Giao diện Web)

Mở một cửa sổ terminal **khác** (để chạy song song với backend) và thực hiện:

```bash
# 1. Di chuyển vào thư mục frontend
cd frontend

# 2. Cài đặt các thư viện phụ thuộc bằng pnpm
pnpm install

# 3. Khởi chạy Development Server
pnpm dev
```

_Giao diện Web sẽ chạy tại địa chỉ: `http://localhost:5173`_

---

## 🎯 Hướng dẫn sử dụng

1. Sau khi cả Backend và Frontend đều đã báo chạy thành công, hãy mở trình duyệt web.
2. Truy cập vào **[http://localhost:5173](http://localhost:5173)**.
3. Trong lần tổng hợp giọng nói đầu tiên, Backend có thể sẽ mất một chút thời gian để load model VoxCPM2 vào RAM/VRAM. Các lần tạo giọng nói tiếp theo sẽ nhanh hơn rất nhiều.
4. Quản lý các file âm thanh đã tạo tại mục **Thư viện** ở thanh menu bên trái.
