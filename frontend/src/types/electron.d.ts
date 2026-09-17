export interface ElectronAPI {
  isElectron: boolean;
  openExternal: (url: string) => Promise<void>;
  openPath: (path: string) => Promise<string>;
  showItemInFolder: (fullPath: string) => Promise<void>;

  minimizeToTray: () => void;
  quitApp: () => void;
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (callback: (isMax: boolean) => void) => void;
  selectDirectory: (defaultPath?: string) => Promise<string | null>;
  openEnvFile: () => Promise<boolean>;
  restartBackend: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
