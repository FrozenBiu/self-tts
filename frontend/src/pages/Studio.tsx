import { useTTSStore } from '../store/useTTSStore'
import { toast } from 'sonner'
import { useRef, useState, useEffect } from 'react'

export default function Studio() {
  const { 
    text, cfg_value, inference_timesteps, seed, speed, pitch, isLoading, audioUrl, voices, selectedVoiceId,
    setText, setCfgValue, setTimesteps, setSeed, setSpeed, setPitch, setIsLoading, setAudioUrl, addHistory, fetchVoices, setSelectedVoiceId
  } = useTTSStore()
  
  const carouselRef = useRef<HTMLDivElement>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const [isDown, setIsDown] = useState(false)
  const [startX, setStartX] = useState(0)
  const [gender, setGender] = useState<'all'|'male'|'female'>('all')
  const [playingPreviewUrl, setPlayingPreviewUrl] = useState<string | null>(null)

  // Lưu trữ vị trí scroll ban đầu khi bắt đầu kéo
  const [startScrollLeft, setStartScrollLeft] = useState(0)

  useEffect(() => {
    fetchVoices()
    
    // Khởi tạo Audio instance cho việc preview
    previewAudioRef.current = new Audio()
    previewAudioRef.current.onended = () => {
      setPlayingPreviewUrl(null)
    }
    
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
      }
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDown(true)
    if (carouselRef.current) {
      setStartX(e.pageX - carouselRef.current.offsetLeft)
      setStartScrollLeft(carouselRef.current.scrollLeft)
    }
  }

  const handleMouseLeave = () => setIsDown(false)
  const handleMouseUp = () => setIsDown(false)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown || !carouselRef.current) return
    e.preventDefault()
    const x = e.pageX - carouselRef.current.offsetLeft
    const walk = (x - startX) * 1.5 // giảm hệ số kéo để mượt hơn
    carouselRef.current.scrollLeft = startScrollLeft - walk
  }

  const handleScrollLeftArrow = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -300, behavior: 'smooth' })
    }
  }

  const handleScrollRightArrow = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' })
    }
  }

  const handlePlayPreview = (url: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!previewAudioRef.current) return

    if (playingPreviewUrl === url) {
      previewAudioRef.current.pause()
      previewAudioRef.current.currentTime = 0
      setPlayingPreviewUrl(null)
    } else {
      previewAudioRef.current.src = url
      previewAudioRef.current.play()
      setPlayingPreviewUrl(url)
    }
  }

  const filteredVoices = voices.filter(v => gender === 'all' || v.gender === gender)

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
          normalize: true,
          voice_id: selectedVoiceId,
          seed,
          speed,
          pitch
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
        url: data.audio_url,
        voiceId: selectedVoiceId,
        voiceName: voices.find(v => v.id === selectedVoiceId)?.name || 'Mặc định',
        cfg_value,
        inference_timesteps,
        seed,
        speed,
        pitch
      })
      
      if (data.message && data.message.includes("Cache Hit")) {
        toast.success('Thành công! Tái sử dụng âm thanh từ Cache (0ms).', { id: toastId, icon: '⚡' })
      } else {
        toast.success('Thành công! Đã tạo giọng nói mới.', { id: toastId })
      }
    } catch (error: any) {
      toast.error(`Thất bại: ${error.message}`, { id: toastId })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 md:gap-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 px-2">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <span className="material-symbols-outlined text-primary text-2xl">graphic_eq</span>
        </div>
        <div>
          <h1 className="font-display text-headline-sm md:text-headline-md text-on-surface tracking-tight">Tổng hợp giọng nói</h1>
          <p className="text-on-surface-variant text-sm mt-0.5">Sử dụng mô hình VoxCPM2 để tạo giọng nói AI chân thực</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
        {/* Left Column: Main Content */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col gap-8 shadow-2xl border border-white/5 relative overflow-hidden">
            {/* Background decorative gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>

            {/* Voice Selection Area */}
            <div className="flex flex-col gap-4 relative group/carousel z-10">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-caps text-label-caps text-on-surface-variant flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">record_voice_over</span>
                    Mẫu giọng đọc
                  </label>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <div className="inline-flex bg-surface-dim border border-white/5 rounded-lg p-1 w-fit shadow-inner">
                    <button 
                      className={`px-4 py-1.5 rounded-md font-label-caps text-xs transition-all duration-300 ${!gender || gender === 'all' ? 'bg-[#FFB74D] text-black shadow-md' : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'}`}
                      onClick={() => setGender('all')}
                    >
                      Tất cả
                    </button>
                    <button 
                      className={`px-4 py-1.5 rounded-md font-label-caps text-xs transition-all duration-300 ${gender === 'male' ? 'bg-[#FFB74D] text-black shadow-md' : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'}`}
                      onClick={() => setGender('male')}
                    >
                      Nam
                    </button>
                    <button 
                      className={`px-4 py-1.5 rounded-md font-label-caps text-xs transition-all duration-300 ${gender === 'female' ? 'bg-[#FFB74D] text-black shadow-md' : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'}`}
                      onClick={() => setGender('female')}
                    >
                      Nữ
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Carousel navigation arrows */}
              <div className="absolute left-0 top-[60%] -translate-y-1/2 z-20 hidden md:flex items-center -ml-4">
                <button 
                  onClick={handleScrollLeftArrow}
                  className="w-8 h-8 rounded-full bg-surface-variant/90 backdrop-blur text-on-surface flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all shadow-lg border border-white/20 hover:scale-110"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
              </div>
              <div className="absolute right-0 top-[60%] -translate-y-1/2 z-20 hidden md:flex items-center -mr-4">
                <button 
                  onClick={handleScrollRightArrow}
                  className="w-8 h-8 rounded-full bg-surface-variant/90 backdrop-blur text-on-surface flex items-center justify-center hover:bg-primary hover:text-on-primary transition-all shadow-lg border border-white/20 hover:scale-110"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>

              <div 
                ref={carouselRef}
                className={`flex gap-4 overflow-x-auto py-2 px-1 hide-scrollbar cursor-grab ${isDown ? 'active:cursor-grabbing snap-none' : 'snap-x snap-proximity'} scroll-smooth -mx-1`}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
              >
                {filteredVoices.map((voice) => (
                  <div key={voice.id} className="snap-start shrink-0 w-36 h-40 relative group">
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button 
                        onClick={(e) => handlePlayPreview(voice.url, e)}
                        className="w-7 h-7 rounded-full bg-primary/20 backdrop-blur text-primary flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                        title={playingPreviewUrl === voice.url ? "Dừng phát" : "Nghe thử"}
                      >
                        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {playingPreviewUrl === voice.url ? 'pause' : 'play_arrow'}
                        </span>
                      </button>
                    </div>
                    <button 
                      onClick={() => setSelectedVoiceId(voice.id)}
                      className={`w-full h-full flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-white/5 backdrop-blur-md transition-all duration-300 relative top-[1px] border ${selectedVoiceId === voice.id ? 'border-primary ring-1 ring-primary shadow-[0_0_15px_rgba(245,158,11,0.2)] bg-primary/10' : 'border-white/10 hover:border-primary/50 hover:bg-white/10'}`}
                    >
                      <span className={`material-symbols-outlined text-3xl ${selectedVoiceId === voice.id ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'}`}>{voice.icon}</span>
                      <div className="text-center mt-1 w-full">
                        <p className="font-label-caps text-sm text-on-surface truncate px-1">{voice.name}</p>
                        <p className="text-xs text-on-surface-variant mt-1 line-clamp-2 px-1">{voice.description}</p>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Input section */}
            <div className="flex flex-col gap-3 z-10">
              <label className="font-label-caps text-label-caps text-on-surface-variant flex items-center gap-2" htmlFor="script-input">
                <span className="material-symbols-outlined text-[18px]">edit_document</span>
                Văn bản đầu vào
              </label>
              <textarea 
                id="script-input"
                className="w-full h-56 bg-surface-dim/80 backdrop-blur border border-white/10 rounded-xl p-5 text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none placeholder:text-on-surface-variant/50 font-body-md shadow-inner" 
                placeholder="Nhập nội dung cần chuyển thành giọng nói tại đây... (Hỗ trợ tiếng Việt và Code-switching Việt-Anh)"
                value={text}
                onChange={(e) => setText(e.target.value)}
              ></textarea>
              <div className="flex justify-between items-center mt-1 px-1">
                <div className="flex gap-2">
                  <span className="inline-flex items-center rounded-md bg-secondary/10 px-2.5 py-1 font-label-caps text-[10px] uppercase text-secondary ring-1 ring-inset ring-secondary/20">Vietnamese</span>
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 font-label-caps text-[10px] uppercase text-primary ring-1 ring-inset ring-primary/20">VoxCPM2</span>
                </div>
                <span className={`font-mono-data text-mono-data text-xs ${text.length > 4500 ? 'text-error' : 'text-on-surface-variant'}`}>{text.length} / 5000 chars</span>
              </div>
            </div>

            {/* Output Area (in-place) */}
            {audioUrl && (
              <div className="flex flex-col gap-4 bg-primary/5 p-5 rounded-xl border border-primary/20 animate-in slide-in-from-bottom-4 fade-in duration-500 shadow-[0_0_20px_rgba(245,158,11,0.05)] mt-4">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-label-caps text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">headphones</span>
                    Âm thanh đầu ra
                  </span>
                  <a href={audioUrl} download className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-primary/30">
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    <span className="text-xs font-label-caps">Tải xuống</span>
                  </a>
                </div>
                <div className="flex items-center w-full mt-2">
                  <audio 
                    controls 
                    autoPlay 
                    src={audioUrl} 
                    className="w-full h-12 rounded-lg focus:outline-none" 
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Settings Sidebar */}
        <div className="lg:col-span-4 flex flex-col gap-6 sticky top-6">
          <div className="glass-card rounded-2xl p-6 shadow-2xl border border-white/5 flex flex-col gap-8 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none"></div>
            
            <div className="flex items-center gap-2 border-b border-white/5 pb-4">
              <span className="material-symbols-outlined text-primary text-[20px]">tune</span>
              <h3 className="font-label-caps text-label-caps text-on-surface">Cài đặt mô hình</h3>
            </div>
            
            <div className="flex flex-col gap-8">
              {/* CFG Scale */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <label className="font-label-caps text-sm text-on-surface-variant flex items-center gap-2" htmlFor="cfg-scale">
                    Tỉ lệ hướng dẫn (CFG)
                  </label>
                  <span className="font-mono-data text-mono-data text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shadow-inner">{cfg_value.toFixed(1)}</span>
                </div>
                <input 
                  className="w-full accent-primary" 
                  id="cfg-scale" 
                  max="3.0" min="1.0" step="0.1" 
                  type="range" 
                  value={cfg_value}
                  onChange={(e) => setCfgValue(parseFloat(e.target.value))}
                />
                <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                  Độ bám sát văn bản. Mặc định 2.0. Sử dụng 2.5 cho code-switching (tiếng Anh xen tiếng Việt).
                </p>
              </div>
              
              {/* Timesteps */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <label className="font-label-caps text-sm text-on-surface-variant flex items-center gap-2" htmlFor="timesteps">
                    Bước suy luận
                  </label>
                  <span className="font-mono-data text-mono-data text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shadow-inner">{inference_timesteps}</span>
                </div>
                <input 
                  className="w-full accent-primary" 
                  id="timesteps" 
                  max="30" min="4" step="1" 
                  type="range" 
                  value={inference_timesteps}
                  onChange={(e) => setTimesteps(parseInt(e.target.value))}
                />
                <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                  Số bước lấy mẫu (4-30). Giá trị càng cao cho chất lượng càng tốt nhưng thời gian xử lý lâu hơn. Đề xuất: 10-25.
                </p>
              </div>

              {/* Seed */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <label className="font-label-caps text-sm text-on-surface-variant flex items-center gap-2" htmlFor="seed">
                    Hạt giống ngẫu nhiên (Seed)
                  </label>
                  <span className="font-mono-data text-mono-data text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shadow-inner">{seed}</span>
                </div>
                <input 
                  className="w-full accent-primary" 
                  id="seed" 
                  max="9999" min="0" step="1" 
                  type="range" 
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value))}
                />
                <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                  Giữ cố định Seed sẽ giúp mô hình tạo ra giọng điệu nhất quán cho cùng một văn bản.
                </p>
              </div>

              {/* Speed */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <label className="font-label-caps text-sm text-on-surface-variant flex items-center gap-2" htmlFor="speed">
                    Tốc độ (Speed)
                  </label>
                  <span className="font-mono-data text-mono-data text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shadow-inner">{speed.toFixed(2)}x</span>
                </div>
                <input 
                  className="w-full accent-primary" 
                  id="speed" 
                  max="2.0" min="0.5" step="0.05" 
                  type="range" 
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                />
                <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                  Tốc độ phát (0.5x - 2.0x). 1.0x là tốc độ bình thường.
                </p>
              </div>

              {/* Pitch */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <label className="font-label-caps text-sm text-on-surface-variant flex items-center gap-2" htmlFor="pitch">
                    Cao độ (Pitch)
                  </label>
                  <span className="font-mono-data text-mono-data text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shadow-inner">{pitch > 0 ? '+' : ''}{pitch.toFixed(1)}</span>
                </div>
                <input 
                  className="w-full accent-primary" 
                  id="pitch" 
                  max="12.0" min="-12.0" step="0.5" 
                  type="range" 
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                />
                <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
                  Điều chỉnh tông giọng (bước âm - nửa cung). Tăng để giọng cao hơn, giảm để trầm hơn.
                </p>
              </div>
            </div>

            {/* Action Button */}
            <div className="mt-4">
              <button 
                id="generate-btn"
                className={`w-full py-4 px-6 font-label-caps text-label-caps rounded-xl flex items-center justify-center gap-2 overflow-hidden relative group transition-all duration-300 shadow-[0_4px_14px_0_rgba(245,158,11,0.2)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 ${isLoading ? 'bg-surface-variant text-on-surface-variant cursor-not-allowed shadow-none hover:translate-y-0' : 'bg-primary text-on-primary glow-button'}`}
                onClick={handleGenerate}
                disabled={isLoading}
              >
                <span className={`relative z-10 flex items-center gap-2 text-sm ${isLoading ? 'hidden' : ''}`}>
                  <span className="material-symbols-outlined">play_arrow</span>
                  BẮT ĐẦU TỔNG HỢP
                </span>
                <div className={`relative z-10 flex items-center gap-2 ${isLoading ? '' : 'hidden'}`}>
                  <span className="material-symbols-outlined animate-spin">sync</span>
                  ĐANG XỬ LÝ...
                </div>
                {!isLoading && <div className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"></div>}
              </button>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  )
}
