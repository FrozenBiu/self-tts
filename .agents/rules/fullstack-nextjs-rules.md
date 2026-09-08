# Quy Tắc Cốt Lõi Dự Án Fullstack (Next.js / React + FastAPI & MongoDB Atlas)

Tài liệu này áp dụng cho toàn bộ quá trình phát triển dự án. Mọi Subagent và thao tác phát triển bắt buộc phải tuân thủ nghiêm ngặt các quy tắc dưới đây.

---

## 1. Kỷ Luật Quản Lý Package (Strict Package Management)
- **Frontend & Node.js (Next.js hoặc React Vite)**: **Bắt buộc 100% sử dụng `pnpm`**. Mọi lệnh tạo dự án, cài đặt thư viện hay chạy script đều phải sử dụng `pnpm`.
  - Tuyệt đối KHÔNG sử dụng `npm`, `npx` (trừ khi dùng qua `pnpm dlx`) hay `yarn`.
  - Cài đặt dependency: `pnpm add <package>`
  - Chạy script: `pnpm run dev`, `pnpm run build`, `pnpm run lint`
- **Backend Python (FastAPI)**: Khuyến khích sử dụng **`uv`** hoặc `python -m venv .venv` kết hợp `pip`. Tuyệt đối chạy trong môi trường ảo độc lập.

---

## 2. Tiêu Chuẩn Giao Diện & Trải Nghiệm (UI/UX Mandates)
- **Quy trình Design-First**: Trước khi code giao diện các trang quan trọng, kích hoạt Subagent `stitch-uiux-designer` gọi **Stitch MCP** để tạo bản thiết kế trực quan và trích xuất bộ `style.css` / CSS variables chuẩn.
- **Thư viện UI chuẩn**:
  - Ưu tiên hàng đầu: **Shadcn UI**, **HeroUI**, **MagicUI**, **Motion-Primitives**, **Pattern Craft**.
  - Styling với **Tailwind CSS**, cấu trúc class rõ ràng, hỗ trợ đầy đủ Dark/Light mode và Responsive (Mobile-first).
- **Kỷ Luật Thông Báo (Sonner)**:
  - **Tuyệt đối KHÔNG sử dụng hàm `alert()` mặc định của Javascript** hay browser confirm/prompt.
  - Luôn sử dụng thư viện **`sonner`** (`toast.success()`, `toast.error()`, `toast.loading()`, `toast.info()`).
  - Đảm bảo component `<Toaster position="top-right" richColors />` đã được đặt trong `app/layout.tsx` (Next.js) hoặc `src/App.tsx` (React Vite).

---

## 3. Tiêu Chuẩn Cơ Sở Dữ Liệu & Backend (MongoDB Atlas)

Dự án hỗ trợ 2 kiến trúc Backend linh hoạt tùy theo nhu cầu:

### Tùy chọn A: Next.js Fullstack (Server Actions)
- Sử dụng Mongoose kết hợp TypeScript.
- **Bắt buộc áp dụng Singleton Connection Pattern** trong `src/lib/mongodb.ts` để cache kết nối, tránh cạn kiệt Connection Pool do cơ chế Serverless và Fast Refresh của Next.js.
- Sử dụng **Zod** để validate mọi input từ client trước khi xử lý.
- Mọi hàm Server Action phải trả về định dạng chuẩn:
  ```typescript
  type ActionResult<T> = 
    | { success: true; data: T }
    | { success: false; error: string };
  ```

### Tùy chọn B: Decoupled Backend với Python FastAPI
- Sử dụng **FastAPI** + driver bất đồng bộ **`motor`** để kết nối MongoDB Atlas.
- Quản lý vòng đời kết nối bằng **`lifespan` context manager** trong `app/core/database.py`.
- Sử dụng **Pydantic v2** (`BaseModel`, `ConfigDict`) để validate request/response.
- Bắt buộc cấu hình **CORS Middleware** cho phép `http://localhost:3000` (Next.js frontend) gọi API.
- Tự động sinh tài liệu chuẩn OpenAPI tại `/docs`.

---

## 4. Kiến Trúc Next.js Hiện Đại (App Router)
- Mặc định mọi component là **Server Component (RSC)** để tối ưu SEO và giảm kích thước bundle.
- Chỉ gắn `'use client'` ở mức component lá (leaf components) khi thực sự cần: state (`useState`), effect (`useEffect`), event listener hoặc tương tác DOM.
- Tách biệt rõ ràng:
  - `src/app/`: Routing, Pages, Layouts, Route Handlers.
  - `src/components/ui/`: Các UI component tái sử dụng (Shadcn/HeroUI).
  - `src/components/features/`: Các component logic theo từng module.
  - `src/server/actions/`: Chứa các Server Actions.
  - `src/server/models/`: Chứa các Mongoose/MongoDB models.
  - `src/lib/`: Các utility functions, client database, config.

---

## 5. Quy Chuẩn Code Delivery & Debugging
- Phân tích logic và cấu trúc dữ liệu trước khi code.
- Khi cập nhật file lớn, sử dụng `// ... existing code ...` cho phần giữ nguyên, chỉ hiển thị phần code thay đổi.
- Khi gặp lỗi, không đoán mò: yêu cầu log chi tiết từ terminal hoặc browser console trước khi sửa.
