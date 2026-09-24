#!/bin/bash
# -------------------------------------------------------------
# OmniVoice Studio - macOS Helper & Runner Script
# -------------------------------------------------------------

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
cd "$DIR"

echo "🍎 [OmniVoice Studio] Đang kiểm tra môi trường macOS..."

# 1. Kiểm tra Node.js & pnpm
if ! command -v node &> /dev/null; then
    echo "❌ Node.js chưa được cài đặt. Vui lòng cài đặt Node.js từ https://nodejs.org hoặc dùng: brew install node"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "⚠️ pnpm chưa được cài đặt. Tiến hành cài đặt qua npm..."
    npm install -g pnpm
fi

echo "📦 Đang cài đặt thư viện JavaScript..."
pnpm install

echo "🛠️ Đang build ứng dụng cho macOS (.dmg)..."
pnpm run desktop:build:mac

echo "✅ Hoàn tất! File .dmg đã được tạo trong thư mục: $DIR/release/"
