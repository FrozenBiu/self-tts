@echo off
setlocal enabledelayedexpansion
title Dong Goi File Cai Dat - OmniVoice Studio (Setup.exe)
cd /d "%~dp0"

echo ===============================================================================
echo     OMNIVOICE STUDIO - TRINH DONG GOI BO CAI DAT WINDOWS (.EXE NSIS)
echo ===============================================================================
echo.

:: Dong cac tien trinh OmniVoice dang chay neu co de tranh khoa file
taskkill /F /IM "OmniVoice Studio.exe" >nul 2>nul
taskkill /F /IM "electron.exe" >nul 2>nul

:: 1. Kiem tra Node.js & pnpm
where pnpm >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay pnpm tren he thong. Vui long cai dat: npm install -g pnpm
    pause
    exit /b 1
)

:: 2. Kiem tra va khoi tao python_runtime neu chua co hoac bi loi
echo [1/4] Kiem tra tinh toan ven cua Python Portable runtime...
"%~dp0python_runtime\python.exe" -c "import _socket, fastapi, uvicorn" >nul 2>nul
if %errorlevel% neq 0 (
    echo [1/4] python_runtime chua hoan thien hoac thieu module. Dang thiet lap Python Portable...
    python scripts/setup_embedded_python.py
    if %errorlevel% neq 0 (
        echo [LOI] Thiet lap python_runtime that bai.
        pause
        exit /b 1
    )
) else (
    echo [1/4] Python Portable runtime da san sang va hoat dong tot!
)
echo.

:: 3. Build giao dien Frontend sang frontend/dist/
echo [2/4] Dang bien dich Frontend (React + Vite + Tailwind)...
call pnpm --filter frontend build
if %errorlevel% neq 0 (
    echo [LOI] Bien dich Frontend that bai.
    pause
    exit /b 1
)
echo [2/4] - Bien dich Frontend hoan tat!
echo.

:: 4. Chuan hoa Metadata va Icon cho Electron
echo [3/4] Dang cap nhat Icon va Thong tin Ban quyen vao tap tin thuc thi...
node electron/customize-exe.cjs
echo.

:: 5. Tien hanh dong goi file Setup bang electron-builder
echo [4/4] Dang khoi tao tien trinh dong goi bo cai NSIS Installer...
echo Qua trinh nay co the mat 1-3 phut tuy thuoc vao toc do may tinh...
echo.
set CSC_IDENTITY_AUTO_DISCOVERY=false
call pnpm exec electron-builder --win nsis
if %errorlevel% neq 0 (
    echo.
    echo [LOI] Dong goi that bai. Vui long kiem tra lai thong bao loi o tren.
    pause
    exit /b 1
)

echo.
echo ===============================================================================
echo   DONG GOI THANH CONG!
echo   Tap tin cai dat Windows da duoc tao tai thu muc: release\
echo ===============================================================================
echo.

:: Mo thu muc release chua file cai dat cho nguoi dung
if exist "%~dp0release" (
    explorer.exe "%~dp0release"
)

pause
