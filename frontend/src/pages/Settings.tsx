import React, { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  CloudLightning,
  Folder,
  Database,
  Sliders,
  RotateCw,
  FileCode,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  HardDrive,
  Save,
  Radio,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface SettingsData {
  use_remote_gpu: boolean;
  remote_gpu_url: string;
  remote_concurrency: number;
  default_num_step: number;
  audios_dir: string;
  videos_dir: string;
  mongodb_uri: string;
  mongodb_db_name: string;
  r2_account_id: string;
  r2_access_key_id: string;
  r2_secret_access_key: string;
  r2_bucket_name: string;
  r2_public_url: string;
  default_audios_dir?: string;
  default_videos_dir?: string;
}

interface GpuTestResult {
  success: boolean;
  message: string;
  latency_ms?: number;
  gpu_name?: string;
  vram?: string;
}

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingGpu, setTestingGpu] = useState(false);
  const [gpuResult, setGpuResult] = useState<GpuTestResult | null>(null);
  const [testingDb, setTestingDb] = useState(false);
  const [dbResult, setDbResult] = useState<{ success: boolean; message: string; latency_ms?: number } | null>(null);

  const [form, setForm] = useState<SettingsData>({
    use_remote_gpu: false,
    remote_gpu_url: "",
    remote_concurrency: 2,
    default_num_step: 32,
    audios_dir: "",
    videos_dir: "",
    mongodb_uri: "",
    mongodb_db_name: "omnivoice_tts",
    r2_account_id: "",
    r2_access_key_id: "",
    r2_secret_access_key: "",
    r2_bucket_name: "",
    r2_public_url: "",
  });

  const isElectron = typeof window !== "undefined" && Boolean(window.electronAPI?.isElectron);

  // Tải cấu hình hiện tại từ backend
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://127.0.0.1:8000/api/settings");
      if (!res.ok) throw new Error("Không thể tải cấu hình từ máy chủ");
      const data = await res.json();
      if (data.success && data.data) {
        setForm(data.data);
      }
    } catch (err: any) {
      toast.error(`Lỗi khi tải cấu hình: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch("http://127.0.0.1:8000/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || "Không thể lưu cài đặt");
      }
      toast.success("Đã lưu thành công toàn bộ cấu hình hệ thống!");
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Kiểm tra kết nối Cloud GPU
  const handleTestGpu = async () => {
    if (!form.remote_gpu_url.trim()) {
      toast.error("Vui lòng nhập đường dẫn URL của Cloud GPU trước khi kiểm tra!");
      return;
    }
    try {
      setTestingGpu(true);
      setGpuResult(null);
      const res = await fetch("http://127.0.0.1:8000/api/settings/test-gpu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.remote_gpu_url }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || "Không thể kết nối tới Cloud GPU");
      }
      setGpuResult(data);
      toast.success(`Kết nối thành công! GPU: ${data.gpu_name} (${data.latency_ms}ms)`);
    } catch (err: any) {
      setGpuResult({ success: false, message: err.message });
      toast.error(`Kiểm tra Cloud GPU thất bại: ${err.message}`);
    } finally {
      setTestingGpu(false);
    }
  };

  // Kiểm tra kết nối MongoDB Atlas
  const handleTestDb = async () => {
    if (!form.mongodb_uri.trim()) {
      toast.error("Vui lòng nhập chuỗi kết nối MongoDB URI!");
      return;
    }
    try {
      setTestingDb(true);
      setDbResult(null);
      const res = await fetch("http://127.0.0.1:8000/api/settings/test-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mongodb_uri: form.mongodb_uri,
          mongodb_db_name: form.mongodb_db_name || "omnivoice_tts",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || "Không thể kết nối MongoDB Atlas");
      }
      setDbResult(data);
      toast.success(`Kết nối MongoDB Atlas thành công! (${data.latency_ms}ms)`);
    } catch (err: any) {
      setDbResult({ success: false, message: err.message });
      toast.error(`Kiểm tra MongoDB thất bại: ${err.message}`);
    } finally {
      setTestingDb(false);
    }
  };

  // Chọn thư mục lưu Audio qua Electron Native Dialog
  const handleSelectAudiosDir = async () => {
    if (window.electronAPI?.selectDirectory) {
      const selected = await window.electronAPI.selectDirectory(form.audios_dir);
      if (selected) {
        setForm((prev) => ({ ...prev, audios_dir: selected }));
        toast.success(`Đã chọn thư mục Audio: ${selected}`);
      }
    } else {
      toast.info("Tính năng chọn thư mục trực tiếp chỉ khả dụng trong ứng dụng Desktop.");
    }
  };

  // Chọn thư mục lưu Video Auto Caption qua Electron Native Dialog
  const handleSelectVideosDir = async () => {
    if (window.electronAPI?.selectDirectory) {
      const selected = await window.electronAPI.selectDirectory(form.videos_dir);
      if (selected) {
        setForm((prev) => ({ ...prev, videos_dir: selected }));
        toast.success(`Đã chọn thư mục Video: ${selected}`);
      }
    } else {
      toast.info("Tính năng chọn thư mục trực tiếp chỉ khả dụng trong ứng dụng Desktop.");
    }
  };

  // Mở thư mục trên máy tính bằng Windows Explorer
  const handleOpenPath = (path: string) => {
    if (window.electronAPI?.openPath) {
      window.electronAPI.openPath(path);
    } else {
      toast.info(`Đường dẫn thư mục: ${path}`);
    }
  };

  // Khởi động lại Backend AI
  const handleRestartBackend = async () => {
    if (window.electronAPI?.restartBackend) {
      toast.info("Đang khởi động lại Backend AI, vui lòng chờ...");
      const ok = await window.electronAPI.restartBackend();
      if (ok) {
        toast.success("Backend AI đã được khởi động lại thành công!");
        fetchSettings();
      } else {
        toast.error("Không thể khởi động lại Backend AI. Vui lòng kiểm tra lại tiến trình.");
      }
    } else {
      toast.info("Vui lòng khởi động lại ứng dụng để nạp lại Backend.");
    }
  };

  // Mở file .env trực tiếp bằng Notepad
  const handleOpenEnv = async () => {
    if (window.electronAPI?.openEnvFile) {
      const ok = await window.electronAPI.openEnvFile();
      if (!ok) toast.error("Không tìm thấy file .env để mở.");
    } else {
      toast.info("Vui lòng mở file backend/.env trong trình soạn thảo code.");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <RotateCw className="w-7 h-7 animate-spin text-amber-500" />
        <p className="text-sm font-medium">Đang nạp cấu hình hệ thống...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full pb-16 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Cài đặt Hệ thống
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono">
                Desktop v2.4
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Cấu hình điện toán Cloud GPU, thư mục lưu trữ Audio/Video và đồng bộ dữ liệu.
            </p>
          </div>
        </div>

        {/* Action Buttons Top */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Đang lưu..." : "Lưu thay đổi"}</span>
          </button>
        </div>
      </div>

      {/* ── SECTION 1: ĐIỆN TOÁN ĐÁM MÂY (CLOUD GPU) ────────────────────────── */}
      <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col gap-6 border border-white/5 relative overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <CloudLightning className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white">
                Điện toán Đám mây (Cloud GPU Acceleration)
              </h2>
              <p className="text-xs text-slate-400">
                Uỷ quyền sinh giọng nói sang Hugging Face Spaces (ZeroGPU A100) hoặc Google Colab (T4 16GB).
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.use_remote_gpu}
              onChange={(e) => setForm({ ...form, use_remote_gpu: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        {form.use_remote_gpu && (
          <div className="flex flex-col gap-5 pt-2 animate-in fade-in duration-300">
            {/* URL Input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Địa chỉ URL Cloud GPU (Public API Endpoint)</span>
                <span className="text-[11px] text-slate-400">
                  Hỗ trợ: Hugging Face Spaces / Ngrok / Localtunnel
                </span>
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={form.remote_gpu_url}
                  onChange={(e) => setForm({ ...form, remote_gpu_url: e.target.value })}
                  placeholder="Ví dụ: https://khanhtieu-self-tts-worker.hf.space"
                  className="flex-1 bg-surface-dim/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
                />
                <button
                  type="button"
                  onClick={handleTestGpu}
                  disabled={testingGpu}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  <Radio className={`w-3.5 h-3.5 ${testingGpu ? "animate-spin" : "text-amber-400"}`} />
                  <span>{testingGpu ? "Đang kiểm tra..." : "Kiểm tra kết nối"}</span>
                </button>
              </div>
            </div>

            {/* Test Result Card */}
            {gpuResult && (
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                  gpuResult.success
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : "bg-red-500/10 border-red-500/20 text-red-300"
                }`}
              >
                {gpuResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 flex flex-col gap-1">
                  <div className="font-semibold">{gpuResult.message}</div>
                  {gpuResult.success && (
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                      <span>
                        ⚡ Chip GPU: <strong className="text-white">{gpuResult.gpu_name}</strong>
                      </span>
                      <span>
                        💾 VRAM: <strong className="text-white">{gpuResult.vram}</strong>
                      </span>
                      <span>
                        📶 Độ trễ: <strong className="text-white">{gpuResult.latency_ms} ms</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Concurrency Slider */}
            <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Số luồng xử lý song song (Concurrency)
                </span>
                <span className="font-mono text-amber-400 font-bold">
                  {form.remote_concurrency} luồng đồng thời
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={form.remote_concurrency}
                onChange={(e) =>
                  setForm({ ...form, remote_concurrency: parseInt(e.target.value) || 1 })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                Mặc định 2 luồng. Với Hugging Face ZeroGPU A100 có thể tăng lên 3-4 luồng để tăng tốc độ xử lý nhiều câu cùng lúc.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION 2: LƯU TRỮ TỆP TIN (AUDIO & VIDEO OUTPUTS) ───────────────── */}
      <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col gap-6 border border-white/5">
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white">
              Thư mục Lưu trữ Tệp tin (Audio & Video Storage)
            </h2>
            <p className="text-xs text-slate-400">
              Chỉ định thư mục lưu trữ file âm thanh phòng thu và video xuất ra từ Auto Caption.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Audio Storage */}
          <div className="flex flex-col gap-3 p-4 rounded-xl bg-surface-dim/40 border border-white/5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span>🎵 Thư mục Âm thanh (Audio)</span>
              </label>
              {form.audios_dir && (
                <button
                  type="button"
                  onClick={() => handleOpenPath(form.audios_dir)}
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Mở Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={form.audios_dir}
                onChange={(e) => setForm({ ...form, audios_dir: e.target.value })}
                placeholder="Mặc định: backend/outputs/audios"
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 truncate"
              />
              <button
                type="button"
                onClick={handleSelectAudiosDir}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 font-medium text-xs flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                title="Chọn thư mục lưu file audio"
              >
                <Folder className="w-3.5 h-3.5 text-amber-400" />
                <span>Chọn</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Nơi lưu trữ các file thu âm .mp3, .wav từ Phòng thu, Thư viện và Cloning Voice.
            </p>
          </div>

          {/* 2. Video Storage (Auto Caption) */}
          <div className="flex flex-col gap-3 p-4 rounded-xl bg-surface-dim/40 border border-white/5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <span>🎬 Thư mục Video (Auto Caption)</span>
              </label>
              {form.videos_dir && (
                <button
                  type="button"
                  onClick={() => handleOpenPath(form.videos_dir)}
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Mở Explorer</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={form.videos_dir}
                onChange={(e) => setForm({ ...form, videos_dir: e.target.value })}
                placeholder="Mặc định: backend/outputs/captions"
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50 truncate"
              />
              <button
                type="button"
                onClick={handleSelectVideosDir}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 font-medium text-xs flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                title="Chọn thư mục lưu file video"
              >
                <Folder className="w-3.5 h-3.5 text-blue-400" />
                <span>Chọn</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Nơi lưu trữ các video hoàn chỉnh (.mp4) đã ghép phụ đề động từ module Auto Caption.
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: ĐỒNG BỘ ĐA THIẾT BỊ (MONGODB ATLAS & R2) ─────────────── */}
      <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col gap-6 border border-white/5">
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white">
              Đồng bộ Đa Thiết bị (Cloud Database & Storage)
            </h2>
            <p className="text-xs text-slate-400">
              Đồng bộ kịch bản, dự án và từ điển phát âm giữa nhiều máy tính qua MongoDB Atlas & Cloudflare R2.
            </p>
          </div>
        </div>

        {/* MongoDB Config */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Chuỗi kết nối MongoDB Atlas URI</span>
              <span className="text-[11px] text-slate-400">Để trống = Lưu cục bộ trong máy</span>
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="password"
                value={form.mongodb_uri}
                onChange={(e) => setForm({ ...form, mongodb_uri: e.target.value })}
                placeholder="mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
                className="flex-1 bg-surface-dim/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
              <button
                type="button"
                onClick={handleTestDb}
                disabled={testingDb}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
              >
                <Database className={`w-3.5 h-3.5 ${testingDb ? "animate-spin" : "text-emerald-400"}`} />
                <span>{testingDb ? "Đang thử..." : "Test kết nối"}</span>
              </button>
            </div>
          </div>

          {/* DB Result Card */}
          {dbResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs ${
                dbResult.success
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                  : "bg-red-500/10 border-red-500/20 text-red-300"
              }`}
            >
              {dbResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{dbResult.message}</span>
              {dbResult.latency_ms && (
                <span className="ml-auto font-mono text-[11px] text-slate-400">
                  {dbResult.latency_ms} ms
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 4: THAM SỐ MÔ HÌNH (MODEL PARAMETERS) ──────────────────── */}
      <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col gap-6 border border-white/5">
        <div className="flex items-center gap-3 border-b border-white/5 pb-4">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-white">
              Tham số Mô hình AI (Inference Parameters)
            </h2>
            <p className="text-xs text-slate-400">
              Cân chỉnh số bước khử nhiễu Diffusion mặc định cho các tác vụ tổng hợp giọng nói.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-200">
              Số bước Diffusion mặc định (num_step)
            </span>
            <p className="text-[11px] text-slate-400">
              16 bước: tốc độ cao, tiết kiệm tài nguyên. 32 bước: chuẩn Studio mượt mà, độ nét cao nhất.
            </p>
          </div>

          <div className="inline-flex bg-surface-dim border border-white/10 rounded-xl p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setForm({ ...form, default_num_step: 16 })}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                form.default_num_step === 16
                  ? "bg-amber-500 text-black font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              16 bước (Nhanh)
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, default_num_step: 32 })}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                form.default_num_step === 32
                  ? "bg-amber-500 text-black font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              32 bước (Studio)
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 5: TÁC VỤ HỆ THỐNG & BẢO TRÌ (SYSTEM ACTIONS) ──────────── */}
      <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col gap-5 border border-white/5 bg-gradient-to-br from-surface-variant/40 to-surface-dim/60">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Tác vụ Quản trị & Tiện ích Desktop
        </h3>

        <div className="flex flex-wrap items-center gap-3">
          {/* Nút lưu cấu hình */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs sm:text-sm transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Đang lưu..." : "Lưu tất cả cấu hình"}</span>
          </button>

          {/* Nút khởi động lại backend */}
          <button
            type="button"
            onClick={handleRestartBackend}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-medium text-xs transition-colors cursor-pointer border border-white/5"
            title="Khởi động lại dịch vụ Backend AI trên máy tính"
          >
            <RotateCw className="w-3.5 h-3.5 text-amber-400" />
            <span>Khởi động lại Backend AI</span>
          </button>

          {/* Nút mở file .env */}
          <button
            type="button"
            onClick={handleOpenEnv}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-medium text-xs transition-colors cursor-pointer border border-white/5"
            title="Mở file cấu hình .env gốc bằng Notepad"
          >
            <FileCode className="w-3.5 h-3.5 text-slate-400" />
            <span>Mở file .env gốc (Notepad)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
