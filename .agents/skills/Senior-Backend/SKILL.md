---
name: "senior-backend"
description: Designs and implements backend systems for Next.js Fullstack applications including Server Actions, Route Handlers, MongoDB Atlas architectures (Mongoose singleton caching), Zod validation, authentication flows, and security hardening. Use when designing backend logic, optimizing MongoDB queries, implementing Server Actions, or securing Next.js endpoints with pnpm.
---

# Senior Backend Engineer (Next.js & MongoDB Atlas)

Thiết kế kiến trúc backend, luồng dữ liệu Server Actions, tối ưu MongoDB Atlas và bảo mật cho ứng dụng Next.js Fullstack (App Router). Quản lý 100% bằng `pnpm`.

---

## Quick Start (Bắt buộc dùng `pnpm`)

```bash
# Cài đặt các gói backend cốt lõi
pnpm add mongoose zod
pnpm add -D @types/mongoose

# Kiểm tra tính toàn vẹn typecheck
pnpm tsc --noEmit
```

---

## Tools Overview

### 1. API Scaffolder

Generates API route handlers, middleware, and OpenAPI specifications from schema definitions.

**Input:** OpenAPI spec (YAML/JSON) or database schema
**Output:** Route handlers, validation middleware, TypeScript types

**Usage:**
```bash
# Generate Express routes from OpenAPI spec
python scripts/api_scaffolder.py openapi.yaml --framework express --output src/routes/
# Output: Generated 12 route handlers, validation middleware, and TypeScript types

# Generate from database schema
python scripts/api_scaffolder.py --from-db postgres://localhost/mydb --output src/routes/

# Generate OpenAPI spec from existing routes
python scripts/api_scaffolder.py src/routes/ --generate-spec --output openapi.yaml
```

**Supported Frameworks:**
- Express.js (`--framework express`)
- Fastify (`--framework fastify`)
- Koa (`--framework koa`)

---

### 2. Database Migration Tool

Analyzes database schemas, detects changes, and generates migration files with rollback support.

**Input:** Database connection string or schema files
**Output:** Migration files, schema diff report, optimization suggestions

**Usage:**
```bash
# Analyze current schema and suggest optimizations
python scripts/database_migration_tool.py --connection postgres://localhost/mydb --analyze
# Output: Missing indexes, N+1 query risks, and suggested migration files

# Generate migration from schema diff
python scripts/database_migration_tool.py --connection postgres://localhost/mydb \
  --compare schema/v2.sql --output migrations/

# Dry-run a migration
python scripts/database_migration_tool.py --connection postgres://localhost/mydb \
  --migrate migrations/20240115_add_user_indexes.sql --dry-run
```

---

### 3. API Load Tester

Performs HTTP load testing with configurable concurrency, measuring latency percentiles and throughput.

**Input:** API endpoint URL and test configuration
**Output:** Performance report with latency distribution, error rates, throughput metrics

**Usage:**
```bash
# Basic load test
python scripts/api_load_tester.py https://api.example.com/users --concurrency 50 --duration 30
# Output: Throughput (req/sec), latency percentiles (P50/P95/P99), error counts, and scaling recommendations

# Test with custom headers and body
python scripts/api_load_tester.py https://api.example.com/orders \
  --method POST \
  --header "Authorization: Bearer token123" \
  --body '{"product_id": 1, "quantity": 2}' \
  --concurrency 100 \
  --duration 60

# Compare two endpoints
python scripts/api_load_tester.py https://api.example.com/v1/users https://api.example.com/v2/users \
  --compare --concurrency 50 --duration 30
```

---

## Backend Development Workflows (Next.js Fullstack)

### Next.js Server Action Workflow (Khuyên dùng cho Web App)

Use when creating mutations (tạo, cập nhật, xóa dữ liệu).

**Step 1: Define Zod validation schema**
```typescript
import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email("Email không hợp lệ").max(255),
  name: z.string().min(2, "Tên phải từ 2 ký tự trở lên").max(100),
});
```

**Step 2: Implement Server Action with Singleton DB Connection**
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/server/models/User";
import { CreateUserSchema } from "@/types/user";

export async function createUserAction(formData: FormData) {
  try {
    const raw = {
      email: formData.get("email"),
      name: formData.get("name"),
    };

    const validated = CreateUserSchema.safeParse(raw);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    await connectToDatabase();
    const newUser = await User.create(validated.data);
    revalidatePath("/users");

    return { success: true, data: JSON.parse(JSON.stringify(newUser)) };
  } catch (error) {
    console.error("Action error:", error);
    return { success: false, error: "Đã có lỗi xảy ra trên máy chủ." };
  }
}
```

### Route Handler Workflow (`src/app/api/.../route.ts`)

Chỉ sử dụng khi cần Webhooks hoặc API mở cho bên thứ ba / Mobile apps:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/server/models/User";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const users = await User.find({}).limit(50).lean();
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
```

---

### Database Optimization Workflow

Use when queries are slow or database performance needs improvement.

**Step 1: Analyze current performance**
```bash
python scripts/database_migration_tool.py --connection $DATABASE_URL --analyze
```

**Step 2: Identify slow queries**
```sql
-- Check query execution plans
EXPLAIN ANALYZE SELECT * FROM orders
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 10;

-- Look for: Seq Scan (bad), Index Scan (good)
```

**Step 3: Generate index migrations**
```bash
python scripts/database_migration_tool.py --connection $DATABASE_URL \
  --suggest-indexes --output migrations/
```

**Step 4: Test migration (dry-run)**
```bash
python scripts/database_migration_tool.py --connection $DATABASE_URL \
  --migrate migrations/add_indexes.sql --dry-run
```

**Step 5: Apply and verify**
```bash
# Apply migration
python scripts/database_migration_tool.py --connection $DATABASE_URL \
  --migrate migrations/add_indexes.sql

# Verify improvement
python scripts/database_migration_tool.py --connection $DATABASE_URL --analyze
```

---

### Security Hardening Workflow

Use when preparing an API for production or after a security review.

**Step 1: Review authentication setup**
```typescript
// Verify JWT configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET,  // Must be from env, never hardcoded
  expiresIn: '1h',                 // Short-lived tokens
  algorithm: 'RS256'               // Prefer asymmetric
};
```

**Step 2: Add rate limiting**
```typescript
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
```

**Step 3: Validate all inputs**
```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  name: "zstringmin1max100"
  age: z.number().int().positive().optional()
});

// Use in route handler
const data = CreateUserSchema.parse(req.body);
```

**Step 4: Load test with attack patterns**
```bash
# Test rate limiting
python scripts/api_load_tester.py https://api.example.com/login \
  --concurrency 200 --duration 10 --expect-rate-limit

# Test input validation
python scripts/api_load_tester.py https://api.example.com/users \
  --method POST \
  --body '{"email": "not-an-email"}' \
  --expect-status 400
```

**Step 5: Review security headers**
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

---

## Reference Documentation

| File | Contains | Use When |
|------|----------|----------|
| `references/api_design_patterns.md` | REST vs GraphQL, versioning, error handling, pagination | Designing new APIs |
| `references/database_optimization_guide.md` | Indexing strategies, query optimization, N+1 solutions | Fixing slow queries |
| `references/backend_security_practices.md` | OWASP Top 10, auth patterns, input validation | Security hardening |

---

## Common Patterns Quick Reference

### REST API Response Format
```json
{
  "data": { "id": 1, "name": "John" },
  "meta": { "requestId": "abc-123" }
}
```

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [{ "field": "email", "message": "must be valid email" }]
  },
  "meta": { "requestId": "abc-123" }
}
```

### HTTP Status Codes
| Code | Use Case |
|------|----------|
| 200 | Success (GET, PUT, PATCH) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Validation error |
| 401 | Authentication required |
| 403 | Permission denied |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

### Database Index Strategy
```sql
-- Single column (equality lookups)
CREATE INDEX idx_users_email ON users(email);

-- Composite (multi-column queries)
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- Partial (filtered queries)
CREATE INDEX idx_orders_active ON orders(created_at) WHERE status = 'active';

-- Covering (avoid table lookup)
CREATE INDEX idx_users_email_name ON users(email) INCLUDE (name);
```

---

## Common Commands

```bash
# API Development
python scripts/api_scaffolder.py openapi.yaml --framework express
python scripts/api_scaffolder.py src/routes/ --generate-spec

# Database Operations
python scripts/database_migration_tool.py --connection $DATABASE_URL --analyze
python scripts/database_migration_tool.py --connection $DATABASE_URL --migrate file.sql

# Performance Testing
python scripts/api_load_tester.py https://api.example.com/endpoint --concurrency 50
python scripts/api_load_tester.py https://api.example.com/endpoint --compare baseline.json
```
