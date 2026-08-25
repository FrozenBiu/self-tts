import { create } from 'zustand'

export interface AudioRecord {
  id: string
  text: string
  url: string
  timestamp: number
}

interface TTSState {
  text: string
  cfg_value: number
  inference_timesteps: number
  isLoading: boolean
  audioUrl: string | null
  history: AudioRecord[]
  setText: (text: string) => void
  setCfgValue: (val: number) => void
  setTimesteps: (val: number) => void
  setIsLoading: (val: boolean) => void
  setAudioUrl: (url: string | null) => void
  addHistory: (record: Omit<AudioRecord, 'id' | 'timestamp'>) => void
  removeHistory: (id: string) => void
}

export const useTTSStore = create<TTSState>((set) => ({
  text: '',
  cfg_value: 2.0,
  inference_timesteps: 10,
  isLoading: false,
  audioUrl: null,
  history: JSON.parse(localStorage.getItem('tts_history') || '[]'),
  setText: (text) => set({ text }),
  setCfgValue: (cfg_value) => set({ cfg_value }),
  setTimesteps: (inference_timesteps) => set({ inference_timesteps }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setAudioUrl: (audioUrl) => set({ audioUrl }),
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
  removeHistory: (id) => set((state) => {
    const newHistory = state.history.filter(h => h.id !== id)
    localStorage.setItem('tts_history', JSON.stringify(newHistory))
    return { history: newHistory }
  }),
}))
