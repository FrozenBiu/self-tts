# 🤗 HƯỚNG DẪN SỬ DỤNG GPU CLOUD VỚI HUGGING FACE SPACES (ZEROGPU A100)

**Hugging Face Spaces ZeroGPU** là phương án tiện lợi và mạnh mẽ nhất nếu bạn muốn có một máy chủ AI trên đám mây chạy **24/7**, sử dụng card đồ họa khủng **NVIDIA A100 (40GB/80GB VRAM)** hoàn toàn **miễn phí**.

Bạn **không cần phải mở trình duyệt giữ kết nối** như Google Colab, máy tính của bạn chỉ việc gọi API đến Space bất cứ khi nào cần lồng tiếng.

---

## 1. Đăng Ký Tài Khoản Hugging Face (Miễn Phí)

1. Truy cập: [https://huggingface.co/join](https://huggingface.co/join)
2. Điền Email, Mật khẩu và xác nhận email kích hoạt tài khoản.

---

## 2. Tạo Một Space Mới Với Phần Cứng ZeroGPU

1. Sau khi đăng nhập, bấm vào ảnh đại diện góc trên bên phải ➔ Chọn **+ New Space** (hoặc truy cập trực tiếp: [https://huggingface.co/new-space](https://huggingface.co/new-space)).
2. Điền các thông số khởi tạo Space:
   - **Space name:** Đặt tên cho worker của bạn (ví dụ: `self-tts-worker` hoặc `my-tts-gpu`).
   - **License:** Chọn `apache-2.0` hoặc `mit`.
   - **Select the Space SDK:** Chọn **Gradio** (Rất quan trọng).
   - **Space hardware:** Chọn **ZeroGPU** (NVIDIA A100 - Free).
   - **Privacy:** Chọn **Public** (Khuyên dùng để backend kết nối dạng Public API không lo phân quyền phức tạp).
3. Bấm nút **Create Space**.

---

## 3. Tải Mã Nguồn Lên Space

Trong thư mục dự án trên máy tính của bạn, toàn bộ mã nguồn cho Space đã được chuẩn bị sẵn trong thư mục [`hf_space/`](file:///d:/Coding/VSCode/self-tts/hf_space/):
- `app.py`: Mã nguồn worker Gradio hỗ trợ API OmniVoice với ZeroGPU decorator (`@spaces.GPU`).
- `requirements.txt`: Danh sách các thư viện cần thiết.
- `README.md`: Cấu hình metadata cho Space của Hugging Face.

### Cách 1: Tải trực tiếp qua trình duyệt web (Đơn giản nhất)
1. Trên giao diện Space bạn vừa tạo, bấm vào tab **Files** (nằm cạnh tab App).
2. Bấm vào nút **Add file ➔ Upload files**.
3. Kéo và thả toàn bộ 3 file trong thư mục `hf_space/` trên máy tính của bạn vào:
   - `app.py`
   - `requirements.txt`
   - `README.md`
4. Cuộn xuống dưới cùng và bấm nút xanh: **Commit changes to main**.

### Cách 2: Đẩy lên bằng Git (Dành cho lập trình viên)
```bash
# Clone Space về máy
git clone https://huggingface.co/spaces/<tên-user-của-bạn>/<tên-space> temp_space

# Copy toàn bộ file trong hf_space/ vào temp_space
cp hf_space/* temp_space/

# Push lên Hugging Face
cd temp_space
git add .
git commit -m "Deploy OmniVoice ZeroGPU Worker"
git push
```

---

## 4. Lấy Đường Link Trực Tiếp (Direct URL) Của Space

1. Sau khi upload file xong, Hugging Face sẽ tự động cài đặt và khởi động (mất khoảng 2 – 3 phút).
2. Khi trạng thái chuyển sang màu xanh **Running**:
   - Nhìn sang góc trên bên phải của khung ứng dụng, bấm vào biểu tượng **dấu 3 chấm `⋮`** (nằm cạnh nút Embed this Space / Like).
   - Chọn **Embed this Space**.
   - Tìm mục **Direct URL** và copy link đó lại.
   - Link Direct URL sẽ có định dạng chuẩn:
     ```text
     https://<tên-tài-khoản>-<tên-space>.hf.space
     ```
     *(Ví dụ: `https://khanhtieu-self-tts-worker.hf.space`)*.

---

## 5. Cấu Hình File `backend/.env` Trên Máy Tính Của Bạn

Mở file `backend/.env` trên máy tính và điền link bạn vừa copy:

```env
# ==============================================================================
# CHẾ ĐỘ MÁY CHỦ GPU TỪ XA (REMOTE WORKER)
# ==============================================================================
USE_REMOTE_GPU=true

# Dán link Direct URL của Hugging Face Space (kèm https:// ở đầu)
REMOTE_GPU_URL=https://khanhtieu-self-tts-worker.hf.space
```

Lưu file lại. Thế là xong!

---

## 6. Khởi Động & Tận Hưởng

Bây giờ bạn chỉ cần khởi động backend và frontend trên máy tính:
```bash
# Terminal 1: Backend
cd backend
venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend
cd frontend
pnpm dev
```
Mỗi khi bạn bấm tạo âm thanh trong Studio:
- Backend máy bạn sẽ gửi request tới Hugging Face Space.
- ZeroGPU tự động cấp phát card đồ hoạ **NVIDIA A100** trong 1 – 2 giây để sinh giọng nói rồi trả file về cho bạn.

---

## 7. Giải Đáp Các Thắc Mắc Thường Gặp Về ZeroGPU

### ❓ Tôi có bị tính phí tiền khi dùng ZeroGPU không?
> **Hoàn toàn KHÔNG!** ZeroGPU là chương trình tài trợ cộng đồng miễn phí của Hugging Face. Toàn bộ quá trình gọi API đều không phát sinh bất kỳ khoản phí nào.

### ❓ Tại sao trong trang Billing của tôi mục ZeroGPU vẫn là `0/5 minutes`?
> Con số `0/5 minutes` là hạn mức cá nhân (Personal Quota) khi bạn đăng nhập tài khoản HF và bấm trên trình duyệt. Khi app của bạn gọi qua API từ máy tính, nó sử dụng **Space Shared Compute**, hoàn toàn không trừ vào 5 phút cá nhân của bạn.

### ❓ Hiện tượng "Ngủ đông" (Space Sleeping) là gì?
> Nếu bạn không dùng app trong khoảng 48 – 72 giờ, Space sẽ tự động chuyển sang trạng thái "Sleeping" để tiết kiệm điện. Khi bạn quay lại tạo câu đầu tiên, Space sẽ mất khoảng **30s – 1 phút** để khởi động lại, từ câu thứ 2 trở đi sẽ lại siêu tốc (1–2s/câu).

### ❓ Khi nào Space báo "Waiting for a GPU to become available"?
> Đó là lúc hệ thống ZeroGPU toàn cầu đang có nhiều người sử dụng, Space của bạn sẽ xếp hàng đợi khoảng 3 – 10 giây để được cấp GPU A100 rồi xử lý bình thường.
