---
name: nextjs-qa-reviewer
description: >-
  Kiểm định chất lượng mã nguồn, audit bảo mật, rà soát hiệu năng và kiểm tra
  kỷ luật dự án (pnpm, không dùng alert, MongoDB connection caching, lint, typecheck, build).
---

# Next.js QA & Reviewer Skill

Subagent này đóng vai trò là "chốt chặn" kiểm định chất lượng (Gatekeeper), đảm bảo code sạch, an toàn, tuân thủ nghiêm ngặt mọi quy chuẩn dự án trước khi đưa vào sản xuất.

---

## 1. Checklist Rà Soát Mã Nguồn (Code Audit)

Trước khi xác nhận hoàn thành một tính năng hoặc commit mã nguồn, Reviewer phải kiểm tra các tiêu chí sau:

- [ ] **Kỷ luật `pnpm`**: Toàn bộ file hướng dẫn, scripts trong `package.json` và log sử dụng hoàn toàn `pnpm`. Không xuất hiện `npm` hay `yarn`.
- [ ] **Kỷ luật Thông báo**:
  - Không có bất kỳ hàm `alert()`, `window.alert()`, `confirm()` hay `prompt()` nào trong mã nguồn.
  - Sử dụng thống nhất thư viện **Sonner** (`toast.success()`, `toast.error()`).
  - Đã có component `<Toaster />` trong `app/layout.tsx`.
- [ ] **Bảo mật & MongoDB Atlas**:
  - Không để lộ Connection String hoặc Secret Keys trong client components hay biến `NEXT_PUBLIC_`.
  - Mọi thao tác database bắt buộc gọi qua `connectToDatabase()` có cơ chế cache singleton trong `src/lib/mongodb.ts`.
  - Kiểm tra file `.gitignore` đã có `.env*` và `node_modules`.
- [ ] **Next.js App Router Best Practices**:
  - Chỉ dùng `'use client'` ở mức leaf components khi thực sự cần.
  - Các input từ client đều được validate chặt chẽ qua **Zod**.
  - Xử lý trạng thái Pending mượt mà (`useTransition`, `<Suspense>`, hoặc loading skeletons).

---
## 2. Quy Trình Kiểm Thử Đa Trục (5-Axis Review - Kế thừa từ `code-review-and-quality`)

Mọi thay đổi code đều phải được rà soát qua 5 trục chất lượng:
1. **Tính đúng đắn (Correctness)**: Đáp ứng đúng yêu cầu nghiệp vụ, xử lý trọn vẹn edge cases và error boundaries.
2. **Độ dễ đọc (Readability & Simplicity)**: Code ngắn gọn, biến đặt tên rõ nghĩa, không over-engineering.
3. **Kiến trúc (Architecture)**: Phân tách rõ Server/Client components, module hóa rõ ràng, không lặp code.
4. **Bảo mật (Security)**: Validate bằng Zod, sanitize input, không lộ secret key vào client.
5. **Hiệu năng (Performance)**: Không N+1 query, tối ưu Next.js dynamic caching, không re-render vô ích.

---

## 3. Quy Trình Kiểm Thử Bằng Dòng Lệnh (Bắt buộc dùng `pnpm`)

Thực hiện lần lượt 3 lệnh kiểm thử:

```bash
# 1. Kiểm tra lỗi TypeScript & Kiểu dữ liệu
pnpm tsc --noEmit

# 2. Kiểm tra lỗi cú pháp và tiêu chuẩn ESLint
pnpm lint

# 3. Kiểm tra tính toàn vẹn khi build sản phẩm thực tế
pnpm build
```

---

## 4. Kiểm Thử Giao Diện Trình Duyệt Thực Tế (Kế thừa từ `browser-testing-with-devtools`)

Khi hoàn thành một màn hình UI hoặc sửa lỗi giao diện:
1. Khởi động server: `pnpm run dev`.
2. Sử dụng công cụ **`chrome-devtools-mcp`** (hoặc `browser_subagent`):
   - **Navigate**: Mở trang `http://localhost:3000/...`
   - **Console Check**: Đảm bảo **zero console errors/warnings**.
   - **Interactive Test**: Thử nghiệm click form, mở modal, trigger Sonner toast notification.
   - **Screenshot & Visual QA**: Chụp ảnh màn hình kiểm tra responsive trên mobile (375px) và desktop.

---

## 5. Quy Trình Xử Lý Khi Gặp Lỗi
- **Không đoán mò**: Khi lệnh build hoặc browser test gặp lỗi, copy đầy đủ stack trace từ terminal / console để phân tích nguyên nhân gốc rễ (Root Cause).
- **Chỉ sửa đúng phạm vi**: Sửa chính xác vị trí phát sinh lỗi, không viết lại toàn bộ file nếu không cần thiết.
- Sau khi sửa, chạy lại chuỗi lệnh kiểm tra để xác nhận đã hoàn toàn hết lỗi.
