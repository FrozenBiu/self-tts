import { useTTSStore } from '../store/useTTSStore'
import { toast } from 'sonner'
import { useRef, useState } from 'react'

export default function Studio() {
  const { 
    text, cfg_value, inference_timesteps, isLoading, audioUrl,
    setText, setCfgValue, setTimesteps, setIsLoading, setAudioUrl, addHistory
  } = useTTSStore()
  
  const carouselRef = useRef<HTMLDivElement>(null)
  const [isDown, setIsDown] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDown(true)
    if (carouselRef.current) {
      setStartX(e.pageX - carouselRef.current.offsetLeft)
      setScrollLeft(carouselRef.current.scrollLeft)
    }
  }

  const handleMouseLeave = () => setIsDown(false)
  const handleMouseUp = () => setIsDown(false)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown || !carouselRef.current) return
    e.preventDefault()
    const x = e.pageX - carouselRef.current.offsetLeft
    const walk = (x - startX) * 2
    carouselRef.current.scrollLeft = scrollLeft - walk
  }

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast.error('Vui lòng nhập văn bản cần đọc')
      return
    }

    setIsLoading(true)
    setAudioUrl(null)
    const toastId = toast.loading('Đang xử lý...', { duration: 30000 })

    try {
      const response = await fetch('http://localhost:8000/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          cfg_value,
          inference_timesteps,
          normalize: true
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || 'Lỗi kết nối đến máy chủ API')
      }

      const data = await response.json()
      setAudioUrl(data.audio_url)
      
      addHistory({
        text,
        url: data.audio_url
      })
      
      toast.success('Thành công! Đã tạo giọng nói.', { id: toastId })
    } catch (error: any) {
      toast.error(`Thất bại: ${error.message}`, { id: toastId })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="glass-card rounded-xl w-full max-w-4xl p-6 md:p-8 flex flex-col gap-8 shadow-2xl">
      {/* Card Header */}
      <div className="flex items-center gap-3 border-b border-white/5 pb-4">
        <span className="material-symbols-outlined text-primary text-3xl">graphic_eq</span>
        <h1 className="font-display text-display md:text-display text-headline-lg-mobile text-on-surface">Tổng hợp giọng nói</h1>
      </div>

      {/* Text Input Area */}
      <div className="flex flex-col gap-4 mb-4 relative group/carousel">
        <label className="font-label-caps text-label-caps text-on-surface-variant">Mẫu giọng đọc</label>
        
        <div className="absolute left-0 top-[60%] -translate-y-1/2 z-10 hidden md:flex items-center">
          <button className="w-8 h-8 rounded-full bg-surface-variant/90 backdrop-blur text-on-surface flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors shadow-lg border border-white/20">
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
        </div>
        <div className="absolute right-0 top-[60%] -translate-y-1/2 z-10 hidden md:flex items-center">
          <button className="w-8 h-8 rounded-full bg-surface-variant/90 backdrop-blur text-on-surface flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors shadow-lg border border-white/20">
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>

        <div 
          ref={carouselRef}
          className={`flex gap-4 overflow-x-auto py-2 px-10 snap-x snap-mandatory hide-scrollbar cursor-grab ${isDown ? 'active:cursor-grabbing' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          {/* Calm Preset */}
          <div className="snap-start shrink-0 w-36 relative group">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button className="w-7 h-7 rounded-full bg-primary/20 backdrop-blur text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </button>
            </div>
            <button className="w-full flex flex-col items-center gap-2 p-5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-primary/50 transition-all duration-300 ring-1 ring-primary shadow-[0_0_15px_rgba(245,158,11,0.2)] relative top-[1px]">
              <span className="material-symbols-outlined text-primary text-3xl">air</span>
              <div className="text-center mt-1">
                <p className="font-label-caps text-sm text-on-surface">Trầm ấm</p>
                <p className="text-xs text-on-surface-variant mt-1">Nhẹ nhàng & ổn định</p>
              </div>
            </button>
          </div>

          {/* Energetic Preset */}
          <div className="snap-start shrink-0 w-36 relative group">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button className="w-7 h-7 rounded-full bg-primary/20 backdrop-blur text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </button>
            </div>
            <button className="w-full flex flex-col items-center gap-2 p-5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all duration-300 relative top-[1px]">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-3xl">bolt</span>
              <div className="text-center mt-1">
                <p className="font-label-caps text-sm text-on-surface">Năng động</p>
                <p className="text-xs text-on-surface-variant mt-1">Nhiều năng lượng</p>
              </div>
            </button>
          </div>

          {/* Broadcast Preset */}
          <div className="snap-start shrink-0 w-36 relative group">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button className="w-7 h-7 rounded-full bg-primary/20 backdrop-blur text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </button>
            </div>
            <button className="w-full flex flex-col items-center gap-2 p-5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all duration-300 relative top-[1px]">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-3xl">radio</span>
              <div className="text-center mt-1">
                <p className="font-label-caps text-sm text-on-surface">Phát thanh</p>
                <p className="text-xs text-on-surface-variant mt-1">Chuyên nghiệp</p>
              </div>
            </button>
          </div>

          {/* Narrative Preset */}
          <div className="snap-start shrink-0 w-36 relative group">
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button className="w-7 h-7 rounded-full bg-primary/20 backdrop-blur text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
              </button>
            </div>
            <button className="w-full flex flex-col items-center gap-2 p-5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-primary/50 hover:bg-white/10 transition-all duration-300 relative top-[1px]">
              <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-3xl">groups</span>
              <div className="text-center mt-1">
                <p className="font-label-caps text-sm text-on-surface">Kể chuyện</p>
                <p className="text-xs text-on-surface-variant mt-1">Diễn cảm</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Input section */}
      <div className="flex flex-col gap-2">
        <label className="font-label-caps text-label-caps text-on-surface-variant" htmlFor="script-input">Văn bản đầu vào</label>
        <textarea 
          id="script-input"
          className="w-full h-48 bg-surface-dim border border-white/10 rounded-lg p-4 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors resize-none placeholder:text-on-surface-variant/50 font-body-md" 
          placeholder="Nhập văn bản cần đọc vào đây..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        ></textarea>
        <div className="flex justify-between items-center mt-1">
          <div className="flex gap-2">
            <span className="inline-flex items-center rounded-md bg-secondary/10 px-2 py-1 font-label-caps text-label-caps text-secondary ring-1 ring-inset ring-secondary/20">Vietnamese</span>
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-1 font-label-caps text-label-caps text-primary ring-1 ring-inset ring-primary/20">v2.4-fast</span>
          </div>
          <span className="font-mono-data text-mono-data text-on-surface-variant text-xs">{text.length} / 5000 chars</span>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-surface-container-low/50 p-6 rounded-lg border border-white/5">
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <label className="font-label-caps text-label-caps text-on-surface-variant" htmlFor="cfg-scale">Tỉ lệ hướng dẫn (CFG)</label>
            <span className="font-mono-data text-mono-data text-primary bg-primary/10 px-2 py-0.5 rounded">{cfg_value.toFixed(1)}</span>
          </div>
          <input 
            className="w-full" 
            id="cfg-scale" 
            max="3.0" min="1.0" step="0.1" 
            type="range" 
            value={cfg_value}
            onChange={(e) => setCfgValue(parseFloat(e.target.value))}
          />
        </div>
        
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <label className="font-label-caps text-label-caps text-on-surface-variant" htmlFor="timesteps">Bước suy luận</label>
            <span className="font-mono-data text-mono-data text-primary bg-primary/10 px-2 py-0.5 rounded">{inference_timesteps}</span>
          </div>
          <input 
            className="w-full" 
            id="timesteps" 
            max="30" min="4" step="1" 
            type="range" 
            value={inference_timesteps}
            onChange={(e) => setTimesteps(parseInt(e.target.value))}
          />
        </div>
      </div>

      {/* Action Button */}
      <button 
        id="generate-btn"
        className={`w-full py-4 font-label-caps text-label-caps rounded-lg flex items-center justify-center gap-2 overflow-hidden relative group transition-all duration-300 ${isLoading ? 'bg-surface-variant text-on-surface-variant cursor-not-allowed' : 'bg-primary text-on-primary glow-button'}`}
        onClick={handleGenerate}
        disabled={isLoading}
      >
        <span className={`relative z-10 flex items-center gap-2 ${isLoading ? 'hidden' : ''}`}>
          <span className="material-symbols-outlined">play_arrow</span>
          Tạo giọng nói
        </span>
        <div className={`relative z-10 flex items-center gap-2 ${isLoading ? '' : 'hidden'}`}>
          <span className="material-symbols-outlined animate-spin">sync</span>
          Đang xử lý...
        </div>
        {!isLoading && <div className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>}
      </button>

      {/* Output Area */}
      {audioUrl && (
        <div className="flex flex-col gap-4 bg-surface-container-high/40 p-4 rounded-lg border border-primary/20 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <span className="font-label-caps text-label-caps text-primary">Âm thanh đầu ra</span>
            <a href={audioUrl} download className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-[20px]">download</span>
            </a>
          </div>
          <div className="flex items-center gap-4">
            {/* The audio element replaces the fake UI to be functional */}
            <audio 
              controls 
              autoPlay 
              src={audioUrl} 
              className="w-full h-12 [&::-webkit-media-controls-panel]:bg-surface-dim [&::-webkit-media-controls-current-time-display]:text-white [&::-webkit-media-controls-time-remaining-display]:text-white rounded" 
            />
          </div>
        </div>
      )}
    </div>
  )
}
