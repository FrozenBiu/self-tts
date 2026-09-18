const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  shell,
  dialog,
  nativeImage,
} = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
const ROOT_DIR = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");
const BACKEND_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "backend")
  : path.join(path.resolve(__dirname, ".."), "backend");
const ASSETS_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "assets")
  : path.join(path.resolve(__dirname, ".."), "assets");
const ICON_PATH = path.join(ASSETS_DIR, "app.ico");
const PNG_ICON_PATH = path.join(ASSETS_DIR, "app.png");

// Đặt tên ứng dụng và AppUserModelId cho Windows Taskbar & Task Manager
process.title = "OmniVoice Studio";
app.name = "OmniVoice Studio";
app.setName("OmniVoice Studio");
if (process.platform === "win32") {
  app.setAppUserModelId("com.omnivoice.studio");
}

// Thư mục dữ liệu người dùng khi đã cài đặt app
const USER_DATA_DIR = app.getPath("userData");
const ENV_PATH = app.isPackaged
  ? path.join(USER_DATA_DIR, ".env")
  : path.join(BACKEND_DIR, ".env");

// Tự động khởi tạo .env trong userData nếu chưa có (khi chạy từ bộ cài đặt)
if (app.isPackaged) {
  try {
    const fs = require("fs");
    if (!fs.existsSync(ENV_PATH)) {
      const srcEnv = path.join(BACKEND_DIR, ".env");
      const srcEnvExample = path.join(BACKEND_DIR, ".env.example");
      if (fs.existsSync(srcEnv)) {
        fs.copyFileSync(srcEnv, ENV_PATH);
      } else if (fs.existsSync(srcEnvExample)) {
        fs.copyFileSync(srcEnvExample, ENV_PATH);
      }
    }
  } catch (err) {
    console.warn("[Electron] Không thể copy .env vào userData:", err);
  }
}

let mainWindow = null;
let splashWindow = null;
let tray = null;
let pythonProcess = null;
let isQuitting = false;

// Đảm bảo chỉ chạy 1 phiên bản ứng dụng duy nhất
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── 1. Tìm đường dẫn Python ──────────────────────────────────────────────────
function getPythonExecutable() {
  const fs = require("fs");
  // 1. Kiểm tra python nhúng trong resources (khi chạy từ bộ cài Setup đã cài đặt)
  const bundledPython = path.join(process.resourcesPath, "python", "python.exe");
  if (fs.existsSync(bundledPython)) return bundledPython;

  // 2. Kiểm tra python_runtime portable ở thư mục gốc (nếu có)
  const localRuntimePython = path.join(path.resolve(__dirname, ".."), "python_runtime", "python.exe");
  if (fs.existsSync(localRuntimePython)) return localRuntimePython;

  // 3. Môi trường venv cục bộ trong backend
  const venvPythonWin = path.join(BACKEND_DIR, "venv", "Scripts", "python.exe");
  if (fs.existsSync(venvPythonWin)) {
    return venvPythonWin;
  }

  // 4. Fallback sang python trên máy người dùng
  return process.platform === "win32" ? "python.exe" : "python3";
}

// ── 2. Khởi chạy Backend FastAPI ─────────────────────────────────────────────
function startBackend() {
  if (pythonProcess) return;

  const pythonBin = getPythonExecutable();
  console.log(`[Electron] Khởi chạy backend với: ${pythonBin}`);

  pythonProcess = spawn(
    pythonBin,
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
    {
      cwd: BACKEND_DIR,
      stdio: "pipe",
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8",
        PYTHONPATH: BACKEND_DIR,
        ENV_FILE_PATH: ENV_PATH,
      },
    },
  );

  pythonProcess.stdout.on("data", (data) => {
    const text = data.toString();
    console.log(`[Backend AI] ${text.trim()}`);
  });

  pythonProcess.stderr.on("data", (data) => {
    const text = data.toString();
    console.warn(`[Backend AI Error] ${text.trim()}`);
  });

  pythonProcess.on("close", (code) => {
    console.log(`[Backend AI] Tiến trình đã dừng với mã: ${code}`);
    pythonProcess = null;
  });
}

// ── 3. Dừng Backend an toàn ──────────────────────────────────────────────────
function stopBackend() {
  if (pythonProcess && pythonProcess.pid) {
    const pid = pythonProcess.pid;
    console.log(`[Electron] Dọn dẹp tiến trình Python Backend PID: ${pid}...`);
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", pid.toString(), "/T", "/F"]);
      } else {
        pythonProcess.kill("SIGKILL");
      }
    } catch (e) {
      console.error("[Electron] Exception khi dọn dẹp:", e);
    }
    pythonProcess = null;
  }
}

// ── 4. Kiểm tra sức khỏe Backend ─────────────────────────────────────────────
function waitForBackend(retries = 40, delay = 500) {
  return new Promise((resolve) => {
    let attempt = 0;
    const check = () => {
      http
        .get("http://127.0.0.1:8000/api/health", (res) => {
          if (res.statusCode === 200) {
            console.log("[Electron] Backend AI đã sẵn sàng!");
            resolve(true);
          } else {
            retry();
          }
        })
        .on("error", () => {
          retry();
        });
    };

    const retry = () => {
      attempt++;
      if (attempt >= retries) {
        console.warn(
          "[Electron] Hết thời gian chờ backend, tiếp tục mở giao diện...",
        );
        resolve(false);
      } else {
        setTimeout(check, delay);
      }
    };

    check();
  });
}

// ── 5. Tạo Cửa Sổ Ứng Dụng (Main Window) ──────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 960,
    minWidth: 1560, // Kích thước tối thiểu rộng rãi, ngăn app bị co nhỏ
    minHeight: 940, // Chiều cao tối thiểu bảo đảm toàn bộ giao diện và nút bấm không bị cắt
    center: true,
    backgroundColor: "#09090b",
    icon: ICON_PATH,
    title: "OmniVoice Studio (24kHz)",
    frame: false, // Sử dụng thanh tiêu đề tùy biến sang trọng chuẩn Desktop
    show: false, // Ẩn cho đến khi sẵn sàng
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Thông báo renderer khi trạng thái maximize thay đổi
  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window-maximized-change", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window-maximized-change", false);
  });

  // Tải nội dung giao diện
  const fs = require("fs");
  const distIndexPath = path.join(ROOT_DIR, "frontend", "dist", "index.html");

  if (process.env.VITE_DEV_SERVER_URL) {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    const loadDev = () => {
      if (!mainWindow) return;
      mainWindow.loadURL(devUrl).catch((err) => {
        console.warn(
          "[Electron] Đang thử kết nối lại tới Vite Frontend...",
          err.message,
        );
        setTimeout(loadDev, 800);
      });
    };
    loadDev();
  } else if (fs.existsSync(distIndexPath)) {
    console.log("[Electron] Nạp giao diện tối ưu từ frontend/dist/index.html");
    mainWindow.loadFile(distIndexPath);
  } else {
    mainWindow.loadURL("http://127.0.0.1:5173");
  }

  // Khi trang đã sẵn sàng thì đóng splash, phóng to cửa sổ và ép nổi lên trên cùng
  mainWindow.once("ready-to-show", () => {
    const showAndFocus = () => {
      if (!mainWindow) return;
      mainWindow.maximize();
      mainWindow.show();
      mainWindow.focus();
      // Đảm bảo cửa sổ bật nổi lên trước mắt người dùng trên Windows
      mainWindow.setAlwaysOnTop(true);
      mainWindow.setAlwaysOnTop(false);
      mainWindow.focus();
    };

    if (splashWindow && !splashWindow.isDestroyed()) {
      setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.destroy();
          splashWindow = null;
        }
        showAndFocus();
      }, 400);
    } else {
      showAndFocus();
    }
  });

  // Chặn mở popup trình duyệt mặc định, dùng shell.openExternal
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Xử lý khi nhấn nút Đóng (X): Thoát ứng dụng hoàn toàn
  mainWindow.on("close", () => {
    isQuitting = true;
    app.quit();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── 6. Tạo Khay Hệ Thống (System Tray) ────────────────────────────────────────
function createTray() {
  try {
    let icon = null;
    const fs = require("fs");
    if (fs.existsSync(PNG_ICON_PATH)) {
      icon = nativeImage
        .createFromPath(PNG_ICON_PATH)
        .resize({ width: 16, height: 16 });
    } else if (fs.existsSync(ICON_PATH)) {
      icon = nativeImage.createFromPath(ICON_PATH);
    }
    if (!icon) return;

    tray = new Tray(icon);
    tray.setToolTip("OmniVoice Studio (TTS 24kHz)");

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "🎙️ Mở OmniVoice Studio",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: "📁 Mở thư mục Âm thanh (Outputs)",
        click: () => {
          shell.openPath(OUTPUTS_DIR);
        },
      },
      {
        label: "🔄 Khởi động lại Backend AI",
        click: async () => {
          stopBackend();
          startBackend();
          if (mainWindow) {
            mainWindow.reload();
          }
        },
      },
      { type: "separator" },
      {
        label: "❌ Thoát hoàn toàn",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setContextMenu(contextMenu);

    // Click đúp vào tray icon để mở/ẩn app
    tray.on("double-click", () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (err) {
    console.warn("[Electron] Không thể tạo tray icon:", err.message);
  }
}

// ── 7. IPC Handlers ──────────────────────────────────────────────────────────
ipcMain.on("minimize-to-tray", () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on("quit-app", () => {
  isQuitting = true;
  app.quit();
});

ipcMain.on("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on("window-close", () => {
  isQuitting = true;
  app.quit();
});

ipcMain.handle("is-window-maximized", () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Hộp thoại chọn thư mục lưu trữ (Audio / Video) chuẩn Windows
ipcMain.handle("select-directory", async (_event, defaultPath) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Chọn thư mục lưu trữ",
    defaultPath: defaultPath || undefined,
    properties: ["openDirectory", "createDirectory"],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Mở file .env trực tiếp bằng trình soạn thảo mặc định (Notepad)
ipcMain.handle("open-env-file", async () => {
  const fs = require("fs");
  if (fs.existsSync(ENV_PATH)) {
    shell.openPath(ENV_PATH);
    return true;
  }
  return false;
});

// Khởi động lại Backend AI từ giao diện cài đặt
ipcMain.handle("restart-backend", async () => {
  console.log("[Electron] Nhận lệnh khởi động lại Backend AI từ Settings...");
  stopBackend();
  startBackend();
  const ready = await waitForBackend(40, 500);
  return ready;
});

// Mở file hoặc thư mục trên Windows bằng ứng dụng mặc định
ipcMain.handle("open-path", async (_event, targetPath) => {
  if (!targetPath) return "";
  try {
    const norm = path.normalize(targetPath);
    console.log("[Electron IPC] open-path:", norm);
    const err = await shell.openPath(norm);
    if (err) {
      console.warn("[Electron IPC] Lỗi khi mở path:", norm, err);
    }
    return err;
  } catch (e) {
    console.error("[Electron IPC] Exception openPath:", e);
    return String(e);
  }
});

// Mở thư mục và highlight đúng file vừa xuất
ipcMain.handle("show-item-in-folder", async (_event, fullPath) => {
  if (!fullPath) return false;
  try {
    const norm = path.normalize(fullPath);
    console.log("[Electron IPC] show-item-in-folder:", norm);
    const fs = require("fs");
    if (fs.existsSync(norm)) {
      shell.showItemInFolder(norm);
      return true;
    } else {
      console.warn("[Electron IPC] File không tồn tại để show, mở thư mục cha:", path.dirname(norm));
      await shell.openPath(path.dirname(norm));
      return true;
    }
  } catch (e) {
    console.error("[Electron IPC] Exception showItemInFolder:", e);
    return false;
  }
});

// Mở URL ngoài trình duyệt
ipcMain.handle("open-external", async (_event, url) => {
  if (!url) return;
  try {
    await shell.openExternal(url);
  } catch (e) {
    console.error("[Electron] Exception openExternal:", e);
  }
});



function checkBackendRunning(port = 8000) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    icon: ICON_PATH,
    show: true,
    backgroundColor: "#00000000",
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"));
}

// ── 8. Vòng đời Ứng Dụng (App Lifecycle) ──────────────────────────────────────
app.whenReady().then(async () => {
  // 1. Mở ngay màn hình Splash Loading Screen cho người dùng thấy
  createSplashWindow();

  // 2. Kiểm tra Backend AI xem đã chạy chưa
  const isRunning = await checkBackendRunning(8000);
  if (!isRunning) {
    startBackend();
    await waitForBackend(60, 500);
  } else {
    console.log(
      "[Electron] Backend AI đã được khởi chạy từ trước trên cổng 8000.",
    );
  }

  // 3. Khởi tạo cửa sổ chính & System Tray
  createMainWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  stopBackend();
});

app.on("will-quit", () => {
  stopBackend();
});

app.on("window-all-closed", () => {
  // Không quit trên Windows nếu còn Tray
  if (process.platform !== "darwin" && isQuitting) {
    app.quit();
  }
});
