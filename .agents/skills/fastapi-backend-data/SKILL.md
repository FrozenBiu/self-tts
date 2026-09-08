---
name: fastapi-backend-data
description: >-
  Thiết kế và xây dựng backend bằng Python FastAPI kết hợp MongoDB Atlas (Motor async driver / Beanie ODM),
  Pydantic v2 validation, CORS middleware và kiến trúc async hiện đại.
  Sử dụng khi dự án chọn kiến trúc tách biệt Next.js Frontend + Python FastAPI Backend.
---

# Python FastAPI Backend & MongoDB Atlas Skill

Subagent này chịu trách nhiệm xây dựng hệ thống Backend API hiệu năng cao bằng **Python FastAPI**, tích hợp cơ sở dữ liệu **MongoDB Atlas** thông qua driver bất đồng bộ **Motor**, tuân thủ nghiêm ngặt chuẩn **Pydantic v2**.

---

## 1. Khởi Tạo Môi Trường & Cài Đặt Thư Viện

Khuyến khích sử dụng **`uv`** (cực nhanh) hoặc `venv` chuẩn của Python:

```bash
# Tạo và kích hoạt môi trường ảo
python -m venv .venv

# Trên Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Trên Linux/macOS:
source .venv/bin/activate

# Cài đặt các gói cốt lõi
pip install fastapi "uvicorn[standard]" motor pydantic pydantic-settings python-dotenv
```

---

## 2. Cấu Trúc Thư Mục Chuẩn (`backend/`)

```text
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── auth.py         # Login, Register, JWT
│   │       │   └── items.py        # CRUD endpoints
│   │       └── router.py           # Gom tất cả routers v1
│   ├── core/
│   │   ├── config.py               # Pydantic BaseSettings (.env)
│   │   └── database.py             # Motor AsyncIOMotorClient + Lifespan
│   ├── models/                     # Database models / Collections
│   ├── schemas/                    # Pydantic v2 request/response schemas
│   │   └── item.py
│   ├── services/                   # Business logic layer
│   └── main.py                     # Khởi tạo FastAPI app, CORS, Lifespan
├── .env.example
├── .gitignore
└── requirements.txt
```

---

## 3. Cấu Hình Kết Nối MongoDB Atlas (`app/core/database.py`)

Sử dụng `AsyncIOMotorClient` cùng cơ chế `lifespan` hiện đại:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings

class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None

db_instance = Database()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo kết nối khi server khởi động
    db_instance.client = AsyncIOMotorClient(
        settings.MONGODB_URI,
        maxPoolSize=50,
        minPoolSize=10
    )
    db_instance.db = db_instance.client[settings.DATABASE_NAME]
    print("✅ Đã kết nối thành công tới MongoDB Atlas")
    
    yield
    
    # Đóng kết nối an toàn khi shutdown
    db_instance.client.close()
    print("🛑 Đã ngắt kết nối MongoDB Atlas")

def get_database() -> AsyncIOMotorDatabase:
    return db_instance.db
```

---

## 4. Cấu Hình Ứng Dụng & CORS Cho Next.js (`app/main.py`)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import lifespan
from app.api.v1.router import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Cấu hình CORS cho phép Next.js (port 3000) gọi API
origins = [
    "http://localhost:3000",
    settings.FRONTEND_URL,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký API v1
app.include_router(api_router, prefix="/api/v1")

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME}
```

---

## 5. Mẫu Schema Pydantic v2 & Endpoint CRUD

### `app/schemas/item.py`
```python
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class ItemBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = Field(default="")

class ItemCreate(ItemBase):
    pass

class ItemResponse(ItemBase):
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        json_encoders={datetime: lambda dt: dt.isoformat()}
    )
```

### `app/api/v1/endpoints/items.py`
```python
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.core.database import get_database
from app.schemas.item import ItemCreate, ItemResponse
from datetime import datetime
from bson import ObjectId

router = APIRouter()

@router.post("/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    item_in: ItemCreate,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    now = datetime.utcnow()
    doc = item_in.model_dump()
    doc["created_at"] = now
    doc["updated_at"] = now
    
    result = await db["items"].insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc

@router.get("/", response_model=list[ItemResponse])
async def list_items(
    limit: int = 50,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    cursor = db["items"].find({}).limit(limit)
    items = []
    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        items.append(doc)
    return items
```

---

## 6. Lệnh Chạy Server & Kiểm Thử

```bash
# Chạy development server với auto-reload
uvicorn app.main:app --reload --port 8000

# Xem tài liệu API tự động tại trình duyệt:
# http://localhost:8000/docs
```
