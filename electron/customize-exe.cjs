const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const ELECTRON_DIST = path.join(ROOT_DIR, "node_modules", "electron", "dist");
const ELECTRON_EXE = path.join(ELECTRON_DIST, "electron.exe");
const CUSTOM_EXE = path.join(ELECTRON_DIST, "OmniVoice Studio.exe");
const ICON_PATH = path.join(ROOT_DIR, "assets", "app.ico");
const RCEDIT_EXE = path.join(ROOT_DIR, "node_modules", "rcedit", "bin", "rcedit-x64.exe");

async function customize() {
  if (!fs.existsSync(ELECTRON_DIST)) {
    console.error("Không tìm thấy thư mục electron dist:", ELECTRON_DIST);
    return;
  }

  if (!fs.existsSync(RCEDIT_EXE)) {
    console.error("Không tìm thấy rcedit:", RCEDIT_EXE);
    return;
  }

  // Tạo file OmniVoice Studio.exe từ electron.exe
  if (fs.existsSync(ELECTRON_EXE)) {
    console.log("[Setup] Sao chép electron.exe -> OmniVoice Studio.exe...");
    fs.copyFileSync(ELECTRON_EXE, CUSTOM_EXE);
  }

  const targets = [CUSTOM_EXE, ELECTRON_EXE].filter((p) => fs.existsSync(p));

  for (const target of targets) {
    console.log(`[Setup] Đang cập nhật metadata & icon cho: ${path.basename(target)}...`);
    try {
      const args = [
        target,
        "--set-version-string", "FileDescription", "OmniVoice Studio",
        "--set-version-string", "ProductName", "OmniVoice Studio",
        "--set-version-string", "InternalName", "OmniVoice Studio",
        "--set-version-string", "CompanyName", "OmniVoice Studio",
        "--set-version-string", "LegalCopyright", "Copyright © 2026 OmniVoice Studio",
        "--set-version-string", "OriginalFilename", "OmniVoice Studio.exe",
      ];

      if (fs.existsSync(ICON_PATH)) {
        args.push("--set-icon", ICON_PATH);
      }

      execFileSync(RCEDIT_EXE, args, { stdio: "inherit" });
      console.log(`[Setup] ✅ Đã cập nhật thành công: ${path.basename(target)}`);
    } catch (err) {
      console.error(`[Setup] Lỗi khi chỉnh sửa ${path.basename(target)}:`, err.message);
    }
  }
}

customize();
