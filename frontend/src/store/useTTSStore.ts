import { create } from 'zustand'

export interface AudioRecord {
  id: string
  text: string
  url: string
  timestamp: number
  voiceId?: string | null
  voiceName?: string
  cfg_value?: number
  inference_timesteps?: number
  seed?: number
  speed?: number
  pitch?: number
}

export interface Voice {
  id: string
  name: string
  gender: string
  description: string
  icon: string
  prompt_text: string
  url: string
  type?: 'preset' | 'custom'
}

interface TTSState {
  text: string
  cfg_value: number
  inference_timesteps: number
  seed: number
  speed: number
  pitch: number
  isLoading: boolean
  audioUrl: string | null
  audioFormat: string
  history: AudioRecord[]
  voices: Voice[]
  selectedVoiceId: string | null
  setText: (text: string) => void
  setCfgValue: (val: number) => void
  setTimesteps: (val: number) => void
  setSeed: (val: number) => void
  setSpeed: (val: number) => void
  setPitch: (val: number) => void
  setIsLoading: (val: boolean) => void
  setAudioUrl: (url: string | null) => void
  setAudioFormat: (format: string) => void
  addHistory: (record: Omit<AudioRecord, 'id' | 'timestamp'>) => void
  removeHistory: (id: string) => void
  fetchVoices: () => Promise<void>
  setSelectedVoiceId: (id: string | null) => void
  deleteCustomVoice: (id: string) => Promise<void>
}

export const useTTSStore = create<TTSState>((set, get) => ({
  text: '',
  cfg_value: 2.0,
  inference_timesteps: 10,
  seed: 42,
  speed: 1.0,
  pitch: 0.0,
  isLoading: false,
  audioUrl: null,
  audioFormat: 'mp3',
  history: JSON.parse(localStorage.getItem('tts_history') || '[]'),
  voices: [],
  selectedVoiceId: null,
  setText: (text) => set({ text }),
  setCfgValue: (cfg_value) => set({ cfg_value }),
  setTimesteps: (inference_timesteps) => set({ inference_timesteps }),
  setSeed: (seed) => set({ seed }),
  setSpeed: (speed) => set({ speed }),
  setPitch: (pitch) => set({ pitch }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setAudioUrl: (audioUrl) => set({ audioUrl }),
  setAudioFormat: (audioFormat) => set({ audioFormat }),
  addHistory: (record) => set((state) => {
    const newRecord: AudioRecord = {
      ...record,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now()
    }
    const newHistory = [newRecord, ...state.history]
    localStorage.setItem('tts_history', JSON.stringify(newHistory))
    return { history: newHistory }
  }),
  removeHistory: async (id) => {
    const record = get().history.find(h => h.id === id);
    if (record && record.url) {
      const filename = record.url.split('/').pop();
      if (filename) {
        try {
          await fetch(`http://localhost:8000/api/tts/${filename}`, { method: 'DELETE' });
        } catch (e) {
          console.error("Lỗi xoá file", e);
        }
      }
    }
    set((state) => {
      const newHistory = state.history.filter(h => h.id !== id)
      localStorage.setItem('tts_history', JSON.stringify(newHistory))
      return { history: newHistory }
    });
  },
  fetchVoices: async () => {
    try {
      const res = await fetch('http://localhost:8000/api/voices')
      if (res.ok) {
        const data = await res.json()
        set({ voices: data })
        if (data.length > 0 && !get().selectedVoiceId) {
          set({ selectedVoiceId: data[0].id })
        }
      }
    } catch (e) {
      console.error("Lỗi khi tải danh sách giọng mẫu:", e)
    }
  },
  deleteCustomVoice: async (id) => {
    try {
      const res = await fetch(`http://localhost:8000/api/voices/custom/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        set((state) => ({
          voices: state.voices.filter(v => v.id !== id),
          selectedVoiceId: state.selectedVoiceId === id ? null : state.selectedVoiceId
        }))
      } else {
        throw new Error('Không thể xoá giọng đọc')
      }
    } catch (e) {
      console.error("Lỗi khi xoá giọng:", e)
      throw e
    }
  },
  setSelectedVoiceId: (id) => set({ selectedVoiceId: id }),
}))
