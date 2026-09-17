@echo off
setlocal
cd /d "%~dp0"

:: Khởi chạy OmniVoice Studio trực tiếp (Windows GUI thuần, không treo cửa sổ terminal)
if exist "%~dp0node_modules\electron\dist\OmniVoice Studio.exe" (
    start "" "%~dp0node_modules\electron\dist\OmniVoice Studio.exe" .
) else (
    start "" "%~dp0node_modules\electron\dist\electron.exe" .
)
exit
