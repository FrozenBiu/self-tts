import { useState, useEffect } from "react";
import { X, Sparkles, Split, Check, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import type { ScriptBlock } from "../../store/useTTSStore";

interface SmartSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (newBlocks: ScriptBlock[], mode: "replace" | "append") => void;
  defaultVoiceId?: string | null;
  defaultVoiceName?: string;
  initialText?: string;
}

export function SmartSplitModal({
  isOpen,
  onClose,
  onApply,
  defaultVoiceId,
  defaultVoiceName,
  initialText = "",
}: SmartSplitModalProps) {
  const [rawText, setRawText] = useState(initialText);
  const [splitMode, setSplitMode] = useState<"sentence" | "paragraph">("sentence");
  const [minWords, setMinWords] = useState(3);
  const [defaultPause, setDefaultPause] = useState(0.5);
  const [applyMode, setApplyMode] = useState<"replace" | "append">("append");

  useEffect(() => {
    if (isOpen && initialText) {
      setRawText(initialText);
    }
  }, [isOpen, initialText]);

  if (!isOpen) return null;

  // Thuật toán bóc tách câu/đoạn
  const parseBlocks = (): string[] => {
    if (!rawText.trim()) return [];

    let segments: string[] = [];
    if (splitMode === "paragraph") {
      // Tách theo dòng mới / đoạn văn
      segments = rawText
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      // Tách theo dấu câu thông minh (dấu chấm, hỏi, than, hoặc xuống dòng)
      const rawSentences = rawText
        .replace(/([.?!…]+)["']?\s+/g, "$1\n")
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);

      // Gộp các câu quá ngắn vào câu liền kề để giọng đọc mượt mà hơn
      let currentAcc = "";
      for (const sent of rawSentences) {
        if (currentAcc === "") {
          currentAcc = sent;
        } else if (currentAcc.split(/\s+/).length < minWords) {
          currentAcc += " " + sent;
        } else {
          segments.push(currentAcc);
          currentAcc = sent;
        }
      }
      if (currentAcc) {
        if (segments.length > 0 && currentAcc.split(/\s+/).length < minWords) {
          segments[segments.length - 1] += " " + currentAcc;
        } else {
          segments.push(currentAcc);
        }
      }
    }

    return segments.filter((s) => s.trim().length > 0);
  };

  const previewSegments = parseBlocks();

  const handleConfirm = () => {
    if (previewSegments.length === 0) {
      toast.error("Vui lòng nhập văn bản cần phân tách");
      return;
    }

    const createdBlocks: ScriptBlock[] = previewSegments.map((text, idx) => ({
      id: "block_" + Math.random().toString(36).substring(2, 9) + "_" + idx,
      text,
      voiceId: defaultVoiceId || null,
      voiceName: defaultVoiceName || "Mặc định",
      speed: 1.0,
      pitch: 0.0,
      pauseAfter: defaultPause,
      status: "idle",
    }));

    onApply(createdBlocks, applyMode);
    toast.success(`Đã phân tách thành công ${createdBlocks.length} phân đoạn kịch bản!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="glass-card w-full max-w-2xl bg-surface border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-surface-variant/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Split className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-label-caps text-base font-semibold text-on-surface">
                Tách Kịch bản Thông minh (Smart Split)
              </h3>
              <p className="text-xs text-on-surface-variant">
                Tự động phân đoạn kịch bản dài theo quy chuẩn ElevenLabs Projects
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          {/* Input Textarea */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-on-surface flex items-center justify-between">
              <span>Dán toàn bộ văn bản kịch bản</span>
              <span className="font-mono-data text-on-surface-variant text-[11px]">
                {rawText.length} ký tự · {rawText.trim() ? rawText.trim().split(/\s+/).length : 0} từ
              </span>
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Dán nội dung sách nói, kịch bản video, podcast, bài báo vào đây...&#10;Hệ thống sẽ tự động tách thành từng khối độc lập để dễ dàng chọn giọng và render."
              className="w-full h-36 bg-surface-dim border border-white/10 rounded-xl p-3.5 text-sm text-on-surface focus:outline-none focus:border-primary/50 transition-colors resize-none placeholder:text-on-surface-variant/50 font-body-md"
            />
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface-dim p-4 rounded-xl border border-white/5">
            {/* Chế độ tách */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface-variant flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Kiểu phân đoạn
              </label>
              <div className="grid grid-cols-2 gap-2 bg-surface p-1 rounded-lg border border-white/5">
                <button
                  type="button"
                  onClick={() => setSplitMode("sentence")}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                    splitMode === "sentence"
                      ? "bg-primary text-black font-semibold shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Theo câu (. ? !)
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode("paragraph")}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                    splitMode === "paragraph"
                      ? "bg-primary text-black font-semibold shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Theo đoạn (\n)
                </button>
              </div>
            </div>

            {/* Khoảng nghỉ mặc định */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-on-surface-variant flex items-center justify-between">
                <span>Khoảng lặng sau câu</span>
                <span className="text-primary font-mono-data font-bold">{defaultPause.toFixed(1)}s</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.1"
                  value={defaultPause}
                  onChange={(e) => setDefaultPause(parseFloat(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-surface rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Ngưỡng gộp câu ngắn */}
            {splitMode === "sentence" && (
              <div className="flex flex-col gap-1.5 sm:col-span-2 pt-1 border-t border-white/5">
                <label className="text-xs font-semibold text-on-surface-variant flex items-center justify-between">
                  <span>Ngưỡng gộp câu ngắn (tránh câu quá cụt)</span>
                  <span className="text-primary font-mono-data font-bold">{minWords} từ</span>
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={minWords}
                    onChange={(e) => setMinWords(parseInt(e.target.value))}
                    className="w-full accent-primary h-1.5 bg-surface rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Áp dụng vào kịch bản hiện tại */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-on-surface-variant">
                Hình thức cập nhật vào dự án
              </label>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="applyMode"
                    value="append"
                    checked={applyMode === "append"}
                    onChange={() => setApplyMode("append")}
                    className="accent-primary"
                  />
                  <span>Thêm tiếp vào cuối kịch bản hiện tại</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="applyMode"
                    value="replace"
                    checked={applyMode === "replace"}
                    onChange={() => setApplyMode("replace")}
                    className="accent-primary"
                  />
                  <span>Thay thế toàn bộ kịch bản cũ</span>
                </label>
              </div>
            </div>
          </div>

          {/* Preview list */}
          {previewSegments.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-400" />
                  Xem trước kết quả: {previewSegments.length} phân đoạn
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-white/5 border border-white/10 rounded-xl bg-surface-dim/70">
                {previewSegments.map((seg, i) => (
                  <div key={i} className="p-2.5 text-xs text-on-surface flex items-start gap-2.5 hover:bg-white/5">
                    <span className="font-mono-data text-[11px] px-1.5 py-0.5 rounded bg-surface-variant text-primary font-bold shrink-0">
                      #{i + 1}
                    </span>
                    <span className="line-clamp-2 leading-relaxed">{seg}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-surface-variant/30 flex items-center justify-between">
          <div className="text-xs text-on-surface-variant flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            Có thể chỉnh sửa từng đoạn riêng lẻ sau khi tạo
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-label-caps text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleConfirm}
              disabled={previewSegments.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-label-caps bg-primary text-black font-semibold hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Tạo {previewSegments.length} phân đoạn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
