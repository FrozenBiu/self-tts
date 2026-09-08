---
name: nextjs-backend-data
description: >-
  Xây dựng kiến trúc backend, Server Actions, Route Handlers cho Next.js với
  MongoDB Atlas (Mongoose singleton caching) và Zod schema validation.
---

# Next.js Backend & Data Skill

Subagent này phụ trách thiết kế cơ sở dữ liệu, API, Server Actions, xác thực người dùng và bảo mật dữ liệu cho dự án Next.js Fullstack.

---

## 1. Ưu Tiên Cơ Sở Dữ Liệu: MongoDB Atlas

### Kỹ Thuật Bắt Buộc: Singleton Connection Cache
Trong môi trường Next.js (Fast Refresh lúc dev và Serverless Functions khi deploy), nếu khởi tạo kết nối Mongoose thông thường thì mỗi request sẽ tạo một kết nối mới, nhanh chóng làm cạn kiệt Connection Pool của MongoDB Atlas.

Tạo file chuẩn: `src/lib/mongodb.ts`

```typescript
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Vui lòng định nghĩa biến môi trường MONGODB_URI trong .env.local");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((m) => {
      return m;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
```

---

## 2. Định Nghĩa Mongoose Model Chuẩn với TypeScript

Ví dụ: `src/server/models/Project.ts`

```typescript
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProject extends Document {
  title: string;
  description?: string;
  status: "active" | "archived" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "archived", "completed"],
      default: "active",
    },
  },
  { timestamps: true }
);

// Ngăn chặn lỗi Re-compiling model khi hot-reload trong Next.js
export const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>("Project", ProjectSchema);
```

---

## 3. Server Actions Chuẩn với Zod Validation

Ví dụ: `src/server/actions/projects.ts`

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectToDatabase } from "@/lib/mongodb";
import { Project } from "@/server/models/Project";

// Định nghĩa schema validation
const CreateProjectSchema = z.object({
  title: z.string().min(3, "Tiêu đề phải từ 3 ký tự trở lên").max(100),
  description: z.string().max(500).optional(),
});

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createProjectAction(formData: FormData): Promise<ActionResult> {
  try {
    const rawData = {
      title: formData.get("title"),
      description: formData.get("description"),
    };

    // 1. Validate dữ liệu đầu vào
    const validated = CreateProjectSchema.safeParse(rawData);
    if (!validated.success) {
      return {
        success: false,
        error: validated.error.errors[0]?.message || "Dữ liệu không hợp lệ",
      };
    }

    // 2. Kết nối database
    await connectToDatabase();

    // 3. Thực hiện thao tác
    const newProject = await Project.create(validated.data);

    // 4. Revalidate cache
    revalidatePath("/dashboard/projects");

    return {
      success: true,
      data: JSON.parse(JSON.stringify(newProject)),
    };
  } catch (error) {
    console.error("Lỗi khi tạo dự án:", error);
    return {
      success: false,
      error: "Lỗi hệ thống khi tạo dự án, vui lòng thử lại.",
    };
  }
}
```

---

## 4. Route Handlers (`app/api/`)
Chỉ tạo Route Handlers khi cần cung cấp webhook bên ngoài (Stripe, GitHub), export file nhị phân, hoặc tích hợp API cho mobile app. Với các tương tác nội bộ của web app, luôn ưu tiên Server Actions.
