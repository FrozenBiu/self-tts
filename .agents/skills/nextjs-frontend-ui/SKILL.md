---
name: nextjs-frontend-ui
description: >-
  Xây dựng giao diện frontend hiện đại với Tailwind CSS, Shadcn UI, HeroUI, MagicUI,
  Motion-Primitives. Tuân thủ kỷ luật thông báo bắt buộc dùng Sonner (cấm alert)
  và phân tách chuẩn giữa Server Components và Client Components.
---

# Next.js Frontend UI Skill

Subagent này chịu trách nhiệm hiện thực hóa các bản thiết kế thành các React/Next.js components sống động, responsive, tương tác mượt mà và thẩm mỹ cao.

---

## 1. Kỷ Luật Bắt Buộc (Strict UI Mandates)

1. **Tuyệt đối KHÔNG sử dụng `alert()`, `confirm()`, `prompt()`**:
   - Sử dụng **`sonner`** cho mọi thông báo.
   - Luôn import: `import { toast } from "sonner";`
   - Ví dụ:
     ```typescript
     // ✅ Đúng:
     toast.success("Cập nhật dữ liệu thành công!");
     toast.error("Không thể lưu thay đổi, vui lòng thử lại.");
     
     // ❌ Sai (Bị cấm hoàn toàn):
     // alert("Thành công!");
     ```
2. **Bộ Thư Viện UI Hiện Đại**:
   - **Shadcn UI**: Cung cấp các headless primitives vững chắc (Dialog, Dropdown, Table, Form).
   - **HeroUI / MagicUI**: Các hiệu ứng vi mô (micro-interactions), dynamic borders, animated text, bento grid.
   - **Motion-Primitives / Framer Motion**: Chuyển động mượt mà, layout animation.
3. **Cài đặt component bằng `pnpm`**:
   - Sử dụng: `pnpm dlx shadcn@latest add <component-name>`

---

## 2. Quy Tắc Server vs Client Component

- **Server Components (Mặc định)**:
  - Dùng để fetch dữ liệu từ Database (MongoDB) hoặc Server Actions.
  - Render tĩnh hoặc động trên máy chủ, tối ưu SEO, không tăng JS bundle.
  - **Không** sử dụng: `useState`, `useEffect`, `onClick`, browser APIs.
- **Client Components (`'use client'`)**:
  - Đặt `'use client';` ở dòng đầu tiên của file.
  - Chỉ tạo khi cần tương tác: Forms với React Hook Form, Modals, Buttons có sự kiện click, Dropdowns, Animations.
  - Đưa xuống vị trí sâu nhất trong cây component (Leaf Components) để giữ cho phần lớn trang là Server Component.

---

## 3. Mẫu Form Xử Lý Tương Tác Chuẩn (Kèm Sonner)

```tsx
"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createItemAction } from "@/server/actions/items";

export function CreateItemForm() {
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createItemAction(formData);
      if (result.success) {
        toast.success("Tạo mục mới thành công!");
      } else {
        toast.error(result.error || "Đã có lỗi xảy ra");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input
        name="title"
        required
        placeholder="Nhập tiêu đề..."
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Đang lưu..." : "Xác nhận"}
      </Button>
    </form>
  );
}
```

---

## 4. Tối Ưu Hóa & Thẩm Mỹ
- **Responsive**: Thiết kế Mobile-First (`sm:`, `md:`, `lg:`, `xl:`).
- **Typography & Assets**:
  - Dùng `next/font/google` (Inter, Plus Jakarta Sans, Outfit).
  - Dùng `next/image` thay cho thẻ `<img>` truyền thống để tối ưu WebP và chống layout shift.
- **Hiệu ứng giao diện**: Thêm các lớp tinh tế như backdrop blur (`backdrop-blur-md bg-white/70 dark:bg-zinc-900/70`), subtle borders và shadows hiện đại.
