import { useState, useRef, useEffect } from "react";
import { useTTSStore } from "../store/useTTSStore";
import { toast } from "sonner";
import { convertToWav } from "../utils/audioUtils";

// Ánh xạ tên Tiếng Anh sang Tiếng Việt để hiển thị thẻ
const TAG_LABELS: Record<string, string> = {
  female: "Nữ",
  male: "Nam",
  child: "Trẻ em",
  teenager: "Thiếu niên",
  "young adult": "Thanh niên",
  "middle-aged": "Trung niên",
  elderly: "Cao tuổi",
  "very low pitch": "Rất trầm",
  "low pitch": "Trầm",
  "moderate pitch": "Vừa phải",
  "high pitch": "Cao",
  "very high pitch": "Rất cao",
  whisper: "Thì thầm",
  normal: "Bình thường",
};

interface RandomVoiceResult {
  audio_url: string;
  filename: string;
  instruct: string;
  gender: string;
  age: string;
  pitch: string;
  style: string;
  seed: number;
}

export default function CloningVoice() {
  const { voices, fetchVoices, deleteCustomVoice } = useTTSStore();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>("");

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl("");
    }
  }, [file]);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Metadata state
  const [name, setName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [description, setDescription] = useState("Giọng tự tạo");
  const [gender, setGender] = useState("all");

  // Random Voice state
  const [isGeneratingRandom, setIsGeneratingRandom] = useState(false);
  const [isSavingRandom, setIsSavingRandom] = useState(false);
  const [randomResult, setRandomResult] = useState<RandomVoiceResult | null>(
    null,
  );
  const [randomName, setRandomName] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchVoices();
  }, []);

  const customVoices = voices.filter((v) => v.type === "custom");

  // ── Tạo giọng ngẫu nhiên ──────────────────────────────────────────────────
  const handleGenerateRandom = async () => {
    setIsGeneratingRandom(true);
    setRandomResult(null);
    const toastId = toast.loading("🎲 Đang tạo giọng ngẫu nhiên...");
    try {
      const res = await fetch("http://localhost:8000/api/voices/random", {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Lỗi tạo giọng ngẫu nhiên");
      }
      const data: RandomVoiceResult = await res.json();
      setRandomResult(data);
      setRandomName(
        `Giọng ${data.gender === "female" ? "nữ" : "nam"} #${data.seed % 1000}`,
      );
      toast.success("Tạo thành công! Hãy nghe thử.", { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`, { id: toastId });
    } finally {
      setIsGeneratingRandom(false);
    }
  };

  const handleSaveRandom = async () => {
    if (!randomResult) return;
    if (!randomName.trim())
      return toast.error("Vui lòng nhập tên cho giọng này.");
    setIsSavingRandom(true);
    const toastId = toast.loading("Đang lưu giọng...");
    try {
      const formData = new FormData();
      formData.append("name", randomName.trim());
      formData.append(
        "description",
        `Giọng ngẫu nhiên (${randomResult.instruct})`,
      );
      formData.append("gender", randomResult.gender);
      formData.append("icon", "casino");
      formData.append("filename", randomResult.filename);
      formData.append("instruct", randomResult.instruct);

      const res = await fetch("http://localhost:8000/api/voices/save-random", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Lỗi lưu giọng");
      }
      toast.success(`Đã lưu giọng "${randomName.trim()}" thành công!`, {
        id: toastId,
      });
      setRandomResult(null);
      setRandomName("");
      await fetchVoices();
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`, { id: toastId });
    } finally {
      setIsSavingRandom(false);
    }
  };

  // ── Drag & Drop & File Upload ──────────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.size > 20 * 1024 * 1024) {
        return toast.error("File quá lớn! Vui lòng chọn file dưới 20MB.");
      }
      if (droppedFile.type.startsWith("audio/")) {
        setFile(droppedFile);
      } else {
        toast.error("Vui lòng chọn file âm thanh hợp lệ (wav, mp3, m4a)");
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 20 * 1024 * 1024) {
        return toast.error("File quá lớn! Vui lòng chọn file dưới 20MB.");
      }
      setFile(selectedFile);
    }
  };

  // Xử lý Ghi âm
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const recordFile = new File([audioBlob], "recording.webm", {
          type: "audio/webm",
        });
        setFile(recordFile);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast.info("Đang ghi âm... Nhấn dừng khi hoàn tất.");
    } catch (err) {
      toast.error("Không thể truy cập Microphone. Vui lòng cấp quyền.");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Vui lòng upload hoặc ghi âm mẫu giọng đọc.");
    if (!name.trim()) return toast.error("Vui lòng nhập tên giọng đọc.");

    setIsUploading(true);
    const toastId = toast.loading("Đang xử lý và tạo giọng...");

    try {
      // Convert audio (webm/mp3/m4a) to standardized 16kHz WAV in the browser
      toast.loading("Đang chuẩn hoá âm thanh...", { id: toastId });
      const wavBlob = await convertToWav(file);
      const wavFile = new File([wavBlob], "voice_sample.wav", {
        type: "audio/wav",
      });

      const formData = new FormData();
      formData.append("file", wavFile);
      formData.append("name", name);
      if (transcript.trim()) {
        formData.append("transcript", transcript.trim());
      }
      formData.append("description", description);
      formData.append("gender", gender);
      formData.append("icon", "record_voice_over");

      toast.loading(
        "Đang tải lên và trích xuất đặc trưng giọng (Whisper/OmniVoice)...",
        { id: toastId },
      );
      const res = await fetch("http://localhost:8000/api/voices/clone", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Lỗi tạo giọng đọc");
      }

      toast.success("Khởi tạo giọng đọc và lưu bộ đệm thành công!", {
        id: toastId,
      });

      // Reset form
      setFile(null);
      setName("");
      setTranscript("");
      setDescription("Giọng tự tạo");
      if (fileInputRef.current) fileInputRef.current.value = "";

      await fetchVoices();
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`, { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    toast("Bạn có chắc chắn muốn xoá giọng đọc này?", {
      action: {
        label: "Xác nhận xoá",
        onClick: async () => {
          try {
            await deleteCustomVoice(id);
            toast.success("Đã xoá giọng đọc và bộ đệm.");
          } catch (e) {
            toast.error("Lỗi khi xoá giọng đọc.");
          }
        },
      },
      cancel: {
        label: "Huỷ",
        onClick: () => {},
      },
    });
  };

  return (
    <div className="w-full max-w-7xl 2k:max-w-[1720px] mx-auto flex flex-col gap-6 md:gap-8 2k:gap-10 animate-in fade-in duration-500">
      <div className="flex items-center gap-4 2k:gap-5 px-2">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <span className="material-symbols-outlined text-primary text-2xl">
            voice_selection
          </span>
        </div>
        <div>
          <h1 className="font-display text-headline-sm md:text-headline-md text-on-surface tracking-tight">
            Cloning Voice
          </h1>
          <p className="text-on-surface-variant text-sm mt-0.5">
            Tự tạo giọng AI cá nhân hoá chuẩn 24kHz từ đoạn thu âm (khuyên dùng
            khoảng 3-15 giây, tự động trích xuất đặc trưng và bóc băng).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Form Area */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <form
            onSubmit={handleSubmit}
            className="glass-card rounded-2xl p-6 md:p-8 flex flex-col gap-8 shadow-2xl border border-white/5"
          >
            {/* Tải tệp lên / Ghi âm */}
            <div className="flex flex-col gap-4">
              <label className="font-label-caps text-label-caps text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">
                  audio_file
                </span>
                Mẫu giọng đọc (Reference Audio)
              </label>

              <div
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 transition-colors text-center ${isDragging ? "border-primary bg-primary/5" : "border-white/10 bg-surface-dim hover:bg-surface-variant/30 hover:border-white/20"}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {!file ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-3xl">
                        upload_file
                      </span>
                    </div>
                    <div>
                      <p className="text-on-surface font-body-md mb-1">
                        Kéo thả file âm thanh vào đây
                      </p>
                      <p className="text-on-surface-variant text-xs">
                        Hỗ trợ .wav, .mp3, .m4a. (Tối thiểu 5s, hệ thống sẽ cắt
                        lấy 10s)
                      </p>
                    </div>
                    <div className="flex gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-on-surface font-label-caps text-sm transition-colors border border-white/10"
                      >
                        Chọn file
                      </button>
                      <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`px-4 py-2 rounded-lg font-label-caps text-sm transition-colors border flex items-center gap-2 ${isRecording ? "bg-error/20 text-error border-error/30 animate-pulse" : "bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {isRecording ? "stop_circle" : "mic"}
                        </span>
                        {isRecording ? "Dừng ghi" : "Ghi âm trực tiếp"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-3xl">
                        check_circle
                      </span>
                    </div>
                    <p className="text-on-surface font-body-md">
                      Đã chọn:{" "}
                      <span className="font-bold text-primary">
                        {file.name}
                      </span>
                    </p>
                    <audio
                      src={audioUrl}
                      controls
                      className="w-full max-w-sm rounded-lg"
                      style={{ colorScheme: "dark" }}
                    ></audio>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-error hover:text-error/80 text-sm font-label-caps"
                    >
                      Xoá / Chọn file khác
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="audio/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>

            {/* Thông tin cấu hình */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2 col-span-2">
                <label className="font-label-caps text-xs text-on-surface-variant flex items-center justify-between">
                  <span>Nội dung văn bản đoạn thu âm (Transcript)</span>
                  <span className="text-primary text-[11px] lowercase">
                    Tùy chọn - tự động bóc băng nếu để trống
                  </span>
                </label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="VD: Chào mừng các bạn đến với video của mình... (Hoặc để trống, hệ thống sẽ tự động dùng Whisper để bóc băng)"
                  className="bg-surface-dim border border-white/10 rounded-lg px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none h-20"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-xs text-on-surface-variant">
                  Tên giọng đọc
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Giọng anh Minh..."
                  className="bg-surface-dim border border-white/10 rounded-lg px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-label-caps text-xs text-on-surface-variant">
                  Giới tính
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="bg-surface-dim border border-white/10 rounded-lg px-4 py-2.5 text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                >
                  <option value="all">Không xác định</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={isUploading || isRecording}
              className={`w-full py-4 px-6 font-label-caps text-label-caps rounded-xl flex items-center justify-center gap-2 overflow-hidden relative group transition-all duration-300 shadow-[0_4px_14px_0_rgba(245,158,11,0.2)] hover:shadow-[0_6px_20px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 ${isUploading || isRecording ? "bg-surface-variant text-on-surface-variant cursor-not-allowed shadow-none hover:translate-y-0" : "bg-primary text-on-primary glow-button"}`}
            >
              <span
                className={`relative z-10 flex items-center gap-2 ${isUploading ? "hidden" : ""}`}
              >
                <span className="material-symbols-outlined">auto_fix_high</span>
                KHỞI TẠO GIỌNG ĐỌC MỚI
              </span>
              <div
                className={`relative z-10 flex items-center gap-2 ${isUploading ? "" : "hidden"}`}
              >
                <span className="material-symbols-outlined animate-spin">
                  sync
                </span>
                ĐANG XỬ LÝ...
              </div>
            </button>
          </form>

          {/* ── Card Tạo Giọng Ngẫu Nhiên ─────────────────────────────── */}
          <div className="glass-card rounded-2xl p-6 md:p-7 flex flex-col gap-5 shadow-2xl border border-white/5 relative overflow-hidden">
            {/* Gradient trang trí */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-secondary/5 rounded-full blur-[80px] pointer-events-none" />

            <div className="flex items-center justify-between gap-4 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center border border-secondary/20">
                  <span className="material-symbols-outlined text-secondary text-[22px]">
                    casino
                  </span>
                </div>
                <div>
                  <h3 className="font-label-caps text-sm text-on-surface">
                    Tạo Giọng Ngẫu Nhiên
                  </h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">
                    OmniVoice tự xổ số thuộc tính giọng — nghe thử, ưng thì lưu
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateRandom}
                disabled={isGeneratingRandom}
                className={`px-4 py-2 rounded-xl font-label-caps text-xs flex items-center gap-2 transition-all duration-300 border shrink-0
                  ${
                    isGeneratingRandom
                      ? "bg-surface-variant text-on-surface-variant border-white/5 cursor-not-allowed"
                      : "bg-secondary/15 hover:bg-secondary/25 text-secondary border-secondary/20 hover:border-secondary/40 hover:shadow-[0_0_15px_rgba(124,58,237,0.2)]"
                  }`}
              >
                {isGeneratingRandom ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      sync
                    </span>
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">
                      casino
                    </span>
                    {randomResult ? "Tạo giọng khác" : "Tạo thử ngay"}
                  </>
                )}
              </button>
            </div>

            {/* Kết quả sau khi tạo */}
            {randomResult && (
              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 z-10">
                {/* Thẻ thuộc tính */}
                <div className="flex flex-wrap gap-1.5">
                  {randomResult.instruct.split(", ").map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-full text-[11px] font-label-caps bg-secondary/10 text-secondary border border-secondary/20"
                    >
                      {TAG_LABELS[tag] ?? tag}
                    </span>
                  ))}
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-mono-data bg-white/5 text-on-surface-variant border border-white/10">
                    seed #{randomResult.seed}
                  </span>
                </div>

                {/* Audio preview */}
                <audio
                  key={randomResult.audio_url}
                  src={randomResult.audio_url}
                  controls
                  autoPlay
                  className="w-full rounded-lg h-9"
                  style={{ colorScheme: "dark" }}
                />

                {/* Đặt tên và lưu */}
                <div className="flex flex-col gap-2.5 pt-1 border-t border-white/5">
                  <p className="text-xs font-label-caps text-on-surface-variant">
                    Ưng giọng này? Đặt tên và lưu lại:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={randomName}
                      onChange={(e) => setRandomName(e.target.value)}
                      placeholder='VD: "Giọng nữ trầm bí ẩn"'
                      className="flex-1 bg-surface-dim border border-white/10 rounded-lg px-3 py-2 text-sm text-on-surface focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary/50 transition-colors font-body-md"
                    />
                    <button
                      type="button"
                      onClick={handleSaveRandom}
                      disabled={isSavingRandom || !randomName.trim()}
                      className={`px-4 py-2 rounded-lg font-label-caps text-xs flex items-center gap-1.5 transition-all whitespace-nowrap border
                        ${
                          isSavingRandom || !randomName.trim()
                            ? "bg-surface-variant text-on-surface-variant border-white/5 cursor-not-allowed"
                            : "bg-secondary text-slate-700 font-semibold border-secondary/50 hover:bg-secondary/90 shadow-[0_2px_10px_rgba(124,58,237,0.3)]"
                        }`}
                    >
                      {isSavingRandom ? (
                        <span className="material-symbols-outlined text-[14px] animate-spin">
                          sync
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-[14px]">
                          save
                        </span>
                      )}
                      Lưu lại
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRandomResult(null);
                        setRandomName("");
                      }}
                      className="px-3 py-2 rounded-lg font-label-caps text-xs text-on-surface-variant hover:text-error hover:bg-error/10 border border-white/5 hover:border-error/30 transition-all"
                      title="Bỏ qua giọng này"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        close
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Trạng thái ban đầu khi chưa tạo */}
            {!randomResult && !isGeneratingRandom && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/3 border border-dashed border-white/10 z-10">
                <span className="material-symbols-outlined text-on-surface-variant/50 text-2xl">
                  shuffle
                </span>
                <p className="text-xs text-on-surface-variant">
                  Nhấn <strong className="text-secondary">Tạo thử ngay</strong>{" "}
                  để OmniVoice xổ số một bộ thuộc tính giọng nói ngẫu nhiên và
                  tổng hợp đoạn demo cho bạn nghe thử.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Danh sách giọng tự tạo */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-6 shadow-2xl border border-white/5 flex flex-col gap-6">
            <div className="flex items-center gap-2 border-b border-white/5 pb-4">
              <span className="material-symbols-outlined text-primary text-[20px]">
                library_music
              </span>
              <h3 className="font-label-caps text-label-caps text-on-surface">
                Giọng của tôi
              </h3>
            </div>

            <div className="flex flex-col gap-3">
              {customVoices.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant font-mono-data text-xs border border-dashed border-white/10 rounded-lg bg-surface-dim">
                  Bạn chưa tạo giọng nào.
                </div>
              ) : (
                customVoices.map((voice) => (
                  <div
                    key={voice.id}
                    className="flex flex-col gap-3 p-4 rounded-xl bg-surface-dim border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <span className="material-symbols-outlined text-[20px]">
                            {voice.icon || "person"}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-label-caps text-on-surface">
                            {voice.name}
                          </p>
                          <p className="text-xs text-on-surface-variant font-mono-data">
                            ID: {voice.id.replace("custom_", "")}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(voice.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                        title="Xoá giọng này"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          delete
                        </span>
                      </button>
                    </div>
                    <audio
                      src={voice.url}
                      controls
                      className="w-full h-8 rounded"
                      style={{ colorScheme: "dark" }}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
