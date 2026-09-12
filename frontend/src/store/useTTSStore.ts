import { create } from "zustand";

export interface AudioRecord {
  id: string;
  text: string;
  url: string;
  timestamp: number;
  projectId?: string;
  voiceId?: string | null;
  voiceName?: string;
  mode?: "clone" | "design" | "auto";
  instruct?: string;
  num_step?: number;
  cfg_value?: number;
  inference_timesteps?: number;
  seed?: number;
  speed?: number;
  pitch?: number;
  engine?: "omnivoice" | "f5tts";
}

export interface ScriptBlock {
  id: string;
  text: string;
  voiceId?: string | null;
  voiceName?: string;
  speed: number;
  pitch: number;
  pauseAfter: number; // Khoảng lặng sau đoạn tính bằng giây (vd: 0.5)
  status: "idle" | "rendering" | "ready" | "error";
  audioUrl?: string;
  filename?: string;
  duration?: number;
  error?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  blocks?: ScriptBlock[];
  masterAudioUrl?: string;
  masterFilename?: string;
  masterSrtUrl?: string;
  masterDuration?: number;
}

export interface Voice {
  id: string;
  name: string;
  gender: string;
  description: string;
  icon: string;
  prompt_text: string;
  url: string;
  type?: "preset" | "custom";
}

export interface PauseSettings {
  period: number; // Dấu chấm (. ! ? …): mặc định 0.45s
  comma: number; // Dấu phẩy (,): mặc định 0.25s
  semicolon: number; // Dấu chấm phẩy (;): mặc định 0.30s
  newline: number; // Xuống dòng (\n): mặc định 0.60s
}

export const DEFAULT_PAUSE_SETTINGS: PauseSettings = {
  period: 0.45,
  comma: 0.25,
  semicolon: 0.3,
  newline: 0.6,
};

export interface PronunciationWord {
  id: string;
  original: string;
  pronunciation: string;
  enabled: boolean;
  createdAt: number;
}

export const DEFAULT_PRONUNCIATION_WORDS: PronunciationWord[] = [
  {
    id: "sample-1",
    original: "năm hai một bốn",
    pronunciation: "năm, hai, một, bốn",
    enabled: true,
    createdAt: 1710000000000,
  },
  {
    id: "sample-2",
    original: "TP.HCM",
    pronunciation: "Thành phố Hồ Chí Minh",
    enabled: true,
    createdAt: 1710000000001,
  },
  {
    id: "sample-3",
    original: "AI",
    pronunciation: "Ây Ai",
    enabled: true,
    createdAt: 1710000000002,
  },
  {
    id: "sample-4",
    original: "ChatGPT",
    pronunciation: "Chát Gờ Pê Tê",
    enabled: true,
    createdAt: 1710000000003,
  },
];

export function applyPronunciationDictionary(text: string, words: PronunciationWord[]): string {
  if (!text || !words || words.length === 0) return text;
  
  const activeWords = words
    .filter((w) => w.enabled && w.original.trim())
    .sort((a, b) => b.original.length - a.original.length);

  let result = text;
  for (const item of activeWords) {
    const orig = item.original.trim();
    const pron = item.pronunciation.trim();
    if (!orig || !pron) continue;

    const escaped = orig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Nếu từ gốc là chữ hoa hoàn toàn và ngắn (ví dụ: "AI", "USD", "TP.HCM", "CSKH"),
    // thì BẮT BUỘC phân biệt hoa thường để tránh thay nhầm từ tiếng Việt thường như "ai", "ai đó"!
    const isAllUpperShort = orig === orig.toUpperCase() && orig.length <= 5 && /[A-Z]/.test(orig);
    const flags = isAllUpperShort ? "gu" : "giu";

    // Sử dụng Unicode Word Boundary: trước và sau từ không được là chữ cái hoặc số (\p{L}\p{N})
    // Giúp tránh nuốt từ như "hai" -> "h + Ây Ai" khi có từ khóa "AI"
    try {
      const regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, flags);
      result = result.replace(regex, pron);
    } catch {
      // Fallback nếu môi trường không hỗ trợ lookbehind
      const regex = new RegExp(`\\b${escaped}\\b`, flags.replace("u", ""));
      result = result.replace(regex, pron);
    }
  }
  return result;
}

interface TTSState {
  pauseSettings: PauseSettings;
  setPauseSettings: (settings: Partial<PauseSettings>) => void;
  resetPauseSettings: () => void;
  text: string;
  mode: "clone" | "design";
  instruct: string;
  num_step: number;
  cfg_value: number;
  inference_timesteps: number;
  seed: number;
  speed: number;
  pitch: number;
  isLoading: boolean;
  audioUrl: string | null;
  audioFormat: string;
  enhanceAudio: boolean;
  setEnhanceAudio: (enhanceAudio: boolean) => void;
  engine: "omnivoice" | "f5tts";
  setEngine: (engine: "omnivoice" | "f5tts") => void;
  history: AudioRecord[];
  pronunciationWords: PronunciationWord[];
  addPronunciationWord: (word: { original: string; pronunciation: string }) => void;
  updatePronunciationWord: (id: string, updates: Partial<PronunciationWord>) => void;
  deletePronunciationWord: (id: string) => void;
  togglePronunciationWord: (id: string) => void;
  voices: Voice[];
  selectedVoiceId: string | null;
  pinnedVoices: string[];
  projects: Project[];
  pendingVoiceForVideo: AudioRecord | null;
  setPendingVoiceForVideo: (record: AudioRecord | null) => void;
  setMode: (mode: "clone" | "design") => void;
  setInstruct: (instruct: string) => void;
  setNumStep: (num_step: number) => void;
  addProject: (name: string, description?: string, initialData?: Partial<Project>) => Project;
  deleteProject: (id: string) => void;
  updateRecordProject: (recordId: string, projectId?: string) => void;
  togglePin: (id: string) => void;
  setText: (text: string) => void;
  setCfgValue: (val: number) => void;
  setTimesteps: (val: number) => void;
  setSeed: (val: number) => void;
  setSpeed: (val: number) => void;
  setPitch: (val: number) => void;
  setIsLoading: (val: boolean) => void;
  setAudioUrl: (url: string | null) => void;
  setAudioFormat: (format: string) => void;
  addHistory: (record: Omit<AudioRecord, "id" | "timestamp">) => void;
  removeHistory: (id: string) => void;
  fetchVoices: () => Promise<void>;
  setSelectedVoiceId: (id: string | null) => void;
  deleteCustomVoice: (id: string) => Promise<void>;
  updateProjectBlocks: (projectId: string, blocks: ScriptBlock[]) => void;
  updateProjectMaster: (
    projectId: string,
    master: {
      masterAudioUrl?: string;
      masterFilename?: string;
      masterSrtUrl?: string;
      masterDuration?: number;
    },
  ) => void;
  cleanupJunkFiles: (force?: boolean) => Promise<{
    deleted_count: number;
    freed_mb: number;
    message: string;
  }>;
}

export const useTTSStore = create<TTSState>((set, get) => {
  // Đọc cấu hình mô hình đã lưu từ localStorage
  const _savedConfig = JSON.parse(
    localStorage.getItem("tts_model_config") || "{}",
  );
  return {
    pauseSettings: (() => {
    try {
      const saved = localStorage.getItem("tts_pause_settings");
      return saved ? { ...DEFAULT_PAUSE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_PAUSE_SETTINGS;
    } catch {
      return DEFAULT_PAUSE_SETTINGS;
    }
  })(),
  setPauseSettings: (newSettings) =>
    set((state) => {
      const updated = { ...state.pauseSettings, ...newSettings };
      localStorage.setItem("tts_pause_settings", JSON.stringify(updated));
      return { pauseSettings: updated };
    }),
  resetPauseSettings: () =>
    set(() => {
      localStorage.setItem("tts_pause_settings", JSON.stringify(DEFAULT_PAUSE_SETTINGS));
      return { pauseSettings: DEFAULT_PAUSE_SETTINGS };
    }),
  text: "",
  mode: "clone",
  instruct: "",
  num_step: 32,
  cfg_value: typeof _savedConfig.cfg_value === "number" ? _savedConfig.cfg_value : 2.0,
  inference_timesteps: 32,
  seed: 42,
  speed: typeof _savedConfig.speed === "number" ? _savedConfig.speed : 1.0,
  pitch: typeof _savedConfig.pitch === "number" ? _savedConfig.pitch : 0.0,
  isLoading: false,
  audioUrl: null,
  audioFormat: typeof _savedConfig.audioFormat === "string" ? _savedConfig.audioFormat : "mp3",
  enhanceAudio: typeof _savedConfig.enhanceAudio === "boolean" ? _savedConfig.enhanceAudio : true,
  engine: (localStorage.getItem("tts_selected_engine") as "omnivoice" | "f5tts") || "omnivoice",
  setEngine: (engine) =>
    set((state) => {
      localStorage.setItem("tts_selected_engine", engine);
      // F5-TTS chỉ hỗ trợ chế độ clone giọng, nếu đang ở design thì tự động chuyển sang clone
      const newMode = engine === "f5tts" && state.mode === "design" ? "clone" : state.mode;
      return { engine, mode: newMode };
    }),
  history: JSON.parse(localStorage.getItem("tts_history") || "[]"),
  pronunciationWords: (() => {
    try {
      const saved = localStorage.getItem("tts_pronunciation_dict");
      return saved ? JSON.parse(saved) : DEFAULT_PRONUNCIATION_WORDS;
    } catch {
      return DEFAULT_PRONUNCIATION_WORDS;
    }
  })(),
  addPronunciationWord: (word) =>
    set((state) => {
      const newWord: PronunciationWord = {
        id: Math.random().toString(36).substring(2, 9),
        original: word.original.trim(),
        pronunciation: word.pronunciation.trim(),
        enabled: true,
        createdAt: Date.now(),
      };
      const updated = [newWord, ...state.pronunciationWords];
      localStorage.setItem("tts_pronunciation_dict", JSON.stringify(updated));
      return { pronunciationWords: updated };
    }),
  updatePronunciationWord: (id, updates) =>
    set((state) => {
      const updated = state.pronunciationWords.map((w) =>
        w.id === id ? { ...w, ...updates } : w,
      );
      localStorage.setItem("tts_pronunciation_dict", JSON.stringify(updated));
      return { pronunciationWords: updated };
    }),
  deletePronunciationWord: (id) =>
    set((state) => {
      const updated = state.pronunciationWords.filter((w) => w.id !== id);
      localStorage.setItem("tts_pronunciation_dict", JSON.stringify(updated));
      return { pronunciationWords: updated };
    }),
  togglePronunciationWord: (id) =>
    set((state) => {
      const updated = state.pronunciationWords.map((w) =>
        w.id === id ? { ...w, enabled: !w.enabled } : w,
      );
      localStorage.setItem("tts_pronunciation_dict", JSON.stringify(updated));
      return { pronunciationWords: updated };
    }),
  voices: [],
  selectedVoiceId: null,
  pinnedVoices: JSON.parse(localStorage.getItem("tts_pinned_voices") || "[]"),
  projects: JSON.parse(localStorage.getItem("tts_projects") || "[]"),
  pendingVoiceForVideo: null,
  setPendingVoiceForVideo: (record) => set({ pendingVoiceForVideo: record }),
  addProject: (name, description, initialData = {}) => {
    const newProject: Project = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      description,
      createdAt: Date.now(),
      ...initialData,
    };
    set((state) => {
      const newProjects = [newProject, ...state.projects];
      localStorage.setItem("tts_projects", JSON.stringify(newProjects));
      return { projects: newProjects };
    });
    return newProject;
  },
  deleteProject: (id) => {
    const proj = get().projects.find((p) => p.id === id);
    if (proj) {
      // Xoá các file audio của blocks trên backend
      if (proj.blocks) {
        for (const b of proj.blocks) {
          const fn = b.filename || (b.audioUrl ? b.audioUrl.split("/").pop() : null);
          if (fn) {
            fetch(`http://localhost:8000/api/tts/${fn}`, { method: "DELETE" }).catch(() => {});
          }
        }
      }
      // Xoá master audio và srt nếu có
      const mFn = proj.masterFilename || (proj.masterAudioUrl ? proj.masterAudioUrl.split("/").pop() : null);
      if (mFn) {
        fetch(`http://localhost:8000/api/tts/${mFn}`, { method: "DELETE" }).catch(() => {});
      }
      if (proj.masterSrtUrl) {
        const srtFn = proj.masterSrtUrl.split("/").pop();
        if (srtFn) {
          fetch(`http://localhost:8000/api/tts/${srtFn}`, { method: "DELETE" }).catch(() => {});
        }
      }
    }

    set((state) => {
      // Xoá tất cả các record thuộc project này
      const newHistory = state.history.filter((h) => h.projectId !== id);

      const newProjects = state.projects.filter((p) => p.id !== id);
      localStorage.setItem("tts_projects", JSON.stringify(newProjects));
      localStorage.setItem("tts_history", JSON.stringify(newHistory));
      return { projects: newProjects, history: newHistory };
    });
  },
  updateRecordProject: (recordId, projectId) => {
    set((state) => {
      const newHistory = state.history.map((h) =>
        h.id === recordId ? { ...h, projectId } : h,
      );
      localStorage.setItem("tts_history", JSON.stringify(newHistory));
      return { history: newHistory };
    });
  },
  togglePin: (id) =>
    set((state) => {
      const isPinned = state.pinnedVoices.includes(id);
      const newPinned = isPinned
        ? state.pinnedVoices.filter((vId) => vId !== id)
        : [...state.pinnedVoices, id];
      localStorage.setItem("tts_pinned_voices", JSON.stringify(newPinned));
      return { pinnedVoices: newPinned };
    }),
  setMode: (mode) => set({ mode }),
  setInstruct: (instruct) => set({ instruct }),
  setNumStep: (num_step) => set({ num_step, inference_timesteps: num_step }),
  setText: (text) => set({ text }),
  setCfgValue: (cfg_value) => set({ cfg_value }),
  setTimesteps: (inference_timesteps) =>
    set({ inference_timesteps, num_step: inference_timesteps }),
  setSeed: (seed) => set({ seed }),
  setSpeed: (speed) => set({ speed }),
  setPitch: (pitch) => set({ pitch }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setAudioUrl: (audioUrl) => set({ audioUrl }),
  setAudioFormat: (audioFormat) => set({ audioFormat }),
  setEnhanceAudio: (enhanceAudio) => {
    try {
      const cur = JSON.parse(localStorage.getItem("tts_model_config") || "{}");
      localStorage.setItem("tts_model_config", JSON.stringify({ ...cur, enhanceAudio }));
    } catch {
      // ignore
    }
    set({ enhanceAudio });
  },
  addHistory: (record) =>
    set((state) => {
      const newRecord: AudioRecord = {
        ...record,
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
      };
      const newHistory = [newRecord, ...state.history];
      localStorage.setItem("tts_history", JSON.stringify(newHistory));
      return { history: newHistory };
    }),
  removeHistory: async (id) => {
    const record = get().history.find((h) => h.id === id);
    if (record && record.url) {
      const filename = record.url.split("/").pop();
      if (filename) {
        try {
          await fetch(`http://localhost:8000/api/tts/${filename}`, {
            method: "DELETE",
          });
        } catch (e) {
          console.error("Lỗi xoá file", e);
        }
      }
    }
    set((state) => {
      const newHistory = state.history.filter((h) => h.id !== id);
      localStorage.setItem("tts_history", JSON.stringify(newHistory));
      return { history: newHistory };
    });
  },
  fetchVoices: async () => {
    try {
      const res = await fetch("http://localhost:8000/api/voices");
      if (res.ok) {
        const data = await res.json();
        set({ voices: data });
        if (data.length > 0 && !get().selectedVoiceId) {
          set({ selectedVoiceId: data[0].id });
        }
      }
    } catch (e) {
      console.error("Lỗi khi tải danh sách giọng mẫu:", e);
    }
  },
  deleteCustomVoice: async (id) => {
    try {
      const res = await fetch(`http://localhost:8000/api/voices/custom/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        set((state) => ({
          voices: state.voices.filter((v) => v.id !== id),
          selectedVoiceId:
            state.selectedVoiceId === id ? null : state.selectedVoiceId,
        }));
      } else {
        throw new Error("Không thể xoá giọng đọc");
      }
    } catch (e) {
      console.error("Lỗi khi xoá giọng:", e);
      throw e;
    }
  },
  setSelectedVoiceId: (id) => set({ selectedVoiceId: id }),
  updateProjectBlocks: (projectId, blocks) => {
    set((state) => {
      const newProjects = state.projects.map((p) =>
        p.id === projectId ? { ...p, blocks } : p,
      );
      localStorage.setItem("tts_projects", JSON.stringify(newProjects));
      return { projects: newProjects };
    });
  },
  updateProjectMaster: (projectId, master) => {
    set((state) => {
      const newProjects = state.projects.map((p) =>
        p.id === projectId ? { ...p, ...master } : p,
      );
      localStorage.setItem("tts_projects", JSON.stringify(newProjects));
      return { projects: newProjects };
    });
  },
  cleanupJunkFiles: async (force = false) => {
    const state = get();
    const activeFiles = new Set<string>();

    // 1. Từ lịch sử Audio (history)
    for (const h of state.history) {
      if (h.url) {
        const fn = h.url.split("/").pop();
        if (fn) activeFiles.add(fn);
      }
    }

    // 2. Từ các dự án (projects: blocks + master audio + srt)
    for (const p of state.projects) {
      if (p.blocks) {
        for (const b of p.blocks) {
          if (b.filename) activeFiles.add(b.filename);
          else if (b.audioUrl) {
            const fn = b.audioUrl.split("/").pop();
            if (fn) activeFiles.add(fn);
          }
        }
      }
      if (p.masterFilename) activeFiles.add(p.masterFilename);
      else if (p.masterAudioUrl) {
        const fn = p.masterAudioUrl.split("/").pop();
        if (fn) activeFiles.add(fn);
      }
      if (p.masterSrtUrl) {
        const fn = p.masterSrtUrl.split("/").pop();
        if (fn) activeFiles.add(fn);
      }
    }

    try {
      const res = await fetch("http://localhost:8000/api/tts/cleanup-orphans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_filenames: Array.from(activeFiles),
          max_age_minutes: force ? 0 : 15,
          force,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Không thể dọn dẹp file rác");
      }

      return await res.json();
    } catch (e: any) {
      console.error("Lỗi khi dọn dẹp file rác:", e);
      throw e;
    }
  },
  }; // end return
}); // end create
