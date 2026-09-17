const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const CUSTOM_EXE = path.join(
  ROOT_DIR,
  "node_modules",
  "electron",
  "dist",
  "OmniVoice Studio.exe",
);
const DEFAULT_EXE = path.join(
  ROOT_DIR,
  "node_modules",
  "electron",
  "dist",
  "electron.exe",
);

const exe = fs.existsSync(CUSTOM_EXE) ? CUSTOM_EXE : DEFAULT_EXE;

const child = spawn(exe, ["."], {
  cwd: ROOT_DIR,
  stdio: "inherit",
  windowsHide: false,
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
