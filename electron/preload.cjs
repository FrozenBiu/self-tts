const { contextBridge, ipcRenderer, shell } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  openPath: (path) => ipcRenderer.invoke("open-path", path),
  showItemInFolder: (fullPath) => ipcRenderer.invoke("show-item-in-folder", fullPath),
  minimizeToTray: () => ipcRenderer.send("minimize-to-tray"),
  quitApp: () => ipcRenderer.send("quit-app"),
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),
  isMaximized: () => ipcRenderer.invoke("is-window-maximized"),
  onMaximizeChange: (callback) => {
    ipcRenderer.on("window-maximized-change", (_event, isMax) => callback(isMax));
  },
  selectDirectory: (defaultPath) => ipcRenderer.invoke("select-directory", defaultPath),
  openEnvFile: () => ipcRenderer.invoke("open-env-file"),
  restartBackend: () => ipcRenderer.invoke("restart-backend"),
});


