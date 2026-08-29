@echo off
echo ===================================================
echo        Khởi động hệ thống VoxCPM2 TTS
echo ===================================================
echo.
echo Dang khoi dong ca Backend va Frontend...
echo Xin doi giay lat...
echo.
echo ===================================================
echo - Backend AI se chay tai: http://localhost:8000
echo - Giao dien Web se chay tai: http://localhost:5173
echo.
echo Bam to hop phim Ctrl+C (va go Y) de tat toan bo.
echo ===================================================
echo.

npx concurrently "cd backend && .\venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000" "cd frontend && pnpm dev" --names "BACKEND,WEB" --prefix-colors "blue,magenta"
