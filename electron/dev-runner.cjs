const { spawn } = require("child_process");
const path = require("path");
const waitOn = require("wait-on");
const kill = require("tree-kill");

const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "frontend");

console.log("🚀 [DevRunner] Đang khởi chạy Vite Dev Server cho giao diện Frontend...");

// 1. Chạy Vite dev server
const viteProcess = spawn(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["dev", "--host", "127.0.0.1", "--port", "5173"],
  {
    cwd: FRONTEND_DIR,
    stdio: "inherit",
    shell: true,
  }
);

// 2. Chờ cổng 5173 sẵn sàng
waitOn({
  resources: ["tcp:5173"],
  timeout: 30000,
})
  .then(() => {
    console.log("✨ [DevRunner] Frontend Vite đã sẵn sàng! Đang mở cửa sổ Electron...");

    // 3. Khởi chạy Electron
    const electronBin = require("electron");
    const electronProcess = spawn(
      electronBin,
      [path.join(__dirname, "main.cjs")],
      {
        cwd: ROOT_DIR,
        stdio: "inherit",
        env: {
          ...process.env,
          NODE_ENV: "development",
          VITE_DEV_SERVER_URL: "http://127.0.0.1:5173",
        },
      }
    );

    electronProcess.on("close", (code) => {
      console.log(`🛑 [DevRunner] Electron đóng với mã: ${code}. Dọn dẹp tiến trình...`);
      if (viteProcess && viteProcess.pid) {
        kill(viteProcess.pid, "SIGKILL");
      }
      process.exit(code || 0);
    });
  })
  .catch((err) => {
    console.error("❌ [DevRunner] Lỗi chờ Vite dev server:", err);
    if (viteProcess && viteProcess.pid) {
      kill(viteProcess.pid, "SIGKILL");
    }
    process.exit(1);
  });

process.on("SIGINT", () => {
  if (viteProcess && viteProcess.pid) {
    kill(viteProcess.pid, "SIGKILL");
  }
  process.exit(0);
});
