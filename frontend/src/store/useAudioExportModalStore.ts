import { create } from "zustand";

export interface AudioExportModalData {
  isOpen: boolean;
  title: string;
  filename: string;
  filePath: string;
  dirPath: string;
  fileSizeMb?: number;
  openModal: (data: {
    title?: string;
    filename: string;
    filePath: string;
    dirPath: string;
    fileSizeMb?: number;
  }) => void;
  closeModal: () => void;
}

export const useAudioExportModalStore = create<AudioExportModalData>((set) => ({
  isOpen: false,
  title: "Xuất Audio Thành Công!",
  filename: "",
  filePath: "",
  dirPath: "",
  fileSizeMb: 0,
  openModal: (data) =>
    set({
      isOpen: true,
      title: data.title || "Xuất Audio Thành Công!",
      filename: data.filename,
      filePath: data.filePath,
      dirPath: data.dirPath,
      fileSizeMb: data.fileSizeMb || 0,
    }),
  closeModal: () => set({ isOpen: false }),
}));
