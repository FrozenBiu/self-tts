@echo off
title Tao Shortcut OmniVoice TTS ra Desktop
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create_desktop_shortcut.ps1"

echo.
pause
