# HỆ THỐNG ĐIỀU PHỐI ĐA SUBAGENT - FULLSTACK (NEXT.JS / REACT + FASTAPI & MONGODB)

Tài liệu này định nghĩa hệ thống điều phối đa Subagent toàn diện cho các dự án Fullstack hiện đại, kết hợp 13 kỹ năng chuyên sâu (Skills) vào các Subagent cốt lõi, quản lý gói bằng `pnpm` (Frontend Next.js / React) và `uv`/`pip` (Backend Python), thiết kế bằng Stitch MCP & UI-UX Pro Max, cơ sở dữ liệu MongoDB Atlas, và kiểm định qua Chrome DevTools.

---

## 1. Bản Đồ Các Subagent Cốt Lõi & 13 Kỹ Năng Hỗ Trợ

| Subagent Chuyên Trách                   | Vai Trò & Nhiệm Vụ                                        | Các Skills Hỗ Trực Tiếp                                                              | Công Cụ & Kỷ Luật Trọng Tâm                                      |
| :-------------------------------------- | :-------------------------------------------------------- | :----------------------------------------------------------------------------------- | :--------------------------------------------------------------- |
| **`nextjs-architect`** _(FE Opt 1)_     | Khởi tạo dự án Next.js, App Router, TypeScript, alias     | `nextjs-architect`<br>`Senior-Frontend`                                              | `pnpm create next-app`<br>TypeScript strict, App Router          |
| **`react-vite-frontend`** _(FE Opt 2)_  | Khởi tạo dự án React thuần (SPA) với Vite, TanStack Query | `react-vite-frontend`<br>`Senior-Frontend`<br>`shadcn-ui`                            | `pnpm create vite`<br>React Router, TanStack Query               |
| **`stitch-uiux-designer`**              | Nghiên cứu UI/UX, tạo màn hình mẫu, trích xuất CSS tokens | `stitch-uiux-designer`<br>`ui-ux-pro-max`                                            | **Stitch MCP**<br>Design Tokens, Font Pairing                    |
| **`nextjs-frontend-ui`**                | Xây dựng components responsive, micro-interactions        | `nextjs-frontend-ui`<br>`shadcn-ui`<br>`Senior-Frontend`                             | Shadcn UI, HeroUI, MagicUI<br>**Sonner (Cấm `alert()`)**         |
| **`nextjs-backend-data`** _(BE Opt 1)_  | Server Actions, Mongoose Models, Zod validation           | `nextjs-backend-data`<br>`Senior-Backend`                                            | **MongoDB Atlas** (Singleton Cache)<br>Server Actions, Zod       |
| **`fastapi-backend-data`** _(BE Opt 2)_ | REST API bất đồng bộ, Pydantic v2, Motor driver           | `fastapi-backend-data`<br>`Senior-Backend`                                           | **Python FastAPI**, Motor, Pydantic v2<br>CORS, Lifespan         |
| **`nextjs-qa-reviewer`**                | 5-Axis Code Review, audit bảo mật, kiểm thử browser       | `nextjs-qa-reviewer`<br>`code-review-and-quality`<br>`browser-testing-with-devtools` | **Chrome DevTools MCP**<br>`pnpm tsc`, `pnpm lint`, `pnpm build` |

---

## 2. Ma Trận Kiến Trúc Dự Án (Architecture Matrix)

Bạn có thể kết hợp linh hoạt giữa Frontend và Backend tùy theo mục đích:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                    LỰA CHỌN FRONTEND                   │
                  │   - Tùy chọn 1: Next.js App Router (SSR, SEO, RSC)     │
                  │   - Tùy chọn 2: React + Vite (SPA cực nhanh, Client)   │
                  │   * Cả 2 đều dùng: Tailwind, Shadcn UI, Sonner, pnpm   │
                  └───────────────────────────┬────────────────────────────┘
                                              │
               ┌──────────────────────────────┴──────────────────────────────┐
               ▼                                                             ▼
    ┌──────────────────────┐                                      ┌──────────────────────┐
    │  BACKEND TÙY CHỌN 1  │                                      │  BACKEND TÙY CHỌN 2  │
    │  Next.js Actions     │                                      │  Python FastAPI      │
    │  (Chỉ cho Next.js)   │                                      │  (Cho cả Next & React│
    └──────────┬───────────┘                                      └──────────┬───────────┘
               │                                                             │
               └──────────────────────────────┬──────────────────────────────┘
                                              ▼
                                 ┌─────────────────────────┐
                                 │   MONGODB ATLAS CLOUD   │
                                 └─────────────────────────┘
```

---

## 3. Quy Trình Vận Hành 5 Giai Đoạn (5-Phase Production Lifecycle)

### Giai đoạn 1: Khởi Tạo Dự Án (Scaffolding)

- **Nếu chọn Next.js**:
  ```bash
  pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
  ```
- **Nếu chọn React + Vite**:
  ```bash
  pnpm create vite@latest . --template react-ts
  pnpm install
  pnpm add -D tailwindcss postcss autoprefixer
  pnpm add clsx tailwind-merge class-variance-authority lucide-react sonner @tanstack/react-query react-router-dom
  ```

### Giai đoạn 2: Thiết Kế UI/UX & Design System (`stitch-uiux-designer`)

- **Tra cứu trí tuệ thiết kế**: Dùng `ui-ux-pro-max` để chọn palette màu sắc chuẩn WCAG (độ tương phản >= 4.5:1) và font pairing hiện đại.
- **Sinh màn hình trực quan**: Gọi **Stitch MCP** (`create_project`, `generate_screen_from_text`) để sinh bản thiết kế trực quan.
- **Trích xuất Tokens**: Đưa các biến CSS hệ thống vào `globals.css` / `index.css`.

### Giai đoạn 3: Phát Triển Giao Diện (`nextjs-frontend-ui` hoặc `react-vite-frontend`)

- Cài đặt components qua lệnh: `pnpm dlx shadcn@latest add <component>`
- Kết hợp các hiệu ứng từ **HeroUI**, **MagicUI**, **Motion-Primitives**.
- **Kỷ Luật Thông Báo**: Bắt buộc dùng `toast.success()`, `toast.error()` từ **Sonner**. Tuyệt đối không dùng `alert()`.

### Giai đoạn 4: Xây Dựng Dữ Liệu & Backend

- **Tùy chọn A (Next.js Actions)**: Singleton connection cache tại `src/lib/mongodb.ts`, Server Actions với Zod validation.
- **Tùy chọn B (Python FastAPI)**: Thư mục `backend/app/`, kết nối MongoDB Atlas qua **Motor** với `lifespan`, Pydantic v2 schemas, CORS middleware cho `http://localhost:3000` hoặc `http://localhost:5173`.

### Giai đoạn 5: Kiểm Định Chất Lượng Đa Chiều (`nextjs-qa-reviewer`)

- **5-Axis Review**: Rà soát Correctness, Readability, Architecture, Security, Performance.
- **Kiểm tra tự động**:
  ```bash
  pnpm tsc --noEmit
  pnpm lint
  pnpm build
  ```
- **Kiểm thử trình duyệt thực tế**: Khởi chạy dev server, dùng **`chrome-devtools-mcp`** để xác nhận **zero console error**, test tương tác form/toast Sonner và chụp screenshot responsive.

---

## 4. Cách Tái Sử Dụng Cho Mọi Dự Án

1. Copy thư mục `.agents/` và file `AGENTS.md` (hoặc `GEMINI.md`) vào thư mục gốc của dự án mới.
2. Mọi Agent (như Antigravity) sẽ tự động nạp toàn bộ 13 skills và phân vai các Subagent theo đúng công nghệ bạn lựa chọn.
