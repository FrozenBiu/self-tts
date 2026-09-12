import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  useTTSStore,
} from "../store/useTTSStore";
import {
  X,
  Plus,
  Trash2,
  Search,
  Lightbulb,
  ChevronLeft,
  ChevronRight,
  BookA,
} from "lucide-react";

interface PronunciationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIPS = [
  {
    title: "Thêm gạch nối giữa các tiếng với cách đọc từ nước ngoài",
    example: "Ví dụ: information (in-pho-mây-sừn), pronunciation (p-rô-năn-xi-ây-xừn)",
  },
  {
    title: "Thêm dấu phẩy giữa các chữ số để đọc rời từng số",
    example: "Ví dụ: năm hai một bốn (năm, hai, một, bốn), 1900 (một, chín, không, không)",
  },
  {
    title: "Chuyển đổi tên viết tắt cơ quan, tổ chức, địa danh",
    example: "Ví dụ: UBND (Ủy ban nhân dân), TP.HCM (Thành phố Hồ Chí Minh), CSKH (Chăm sóc khách hàng)",
  },
  {
    title: "Đơn vị tiền tệ, đơn vị đo và ký hiệu đặc biệt",
    example: "Ví dụ: $ (đô la), % (phần trăm), km/h (ki-lô-mét trên giờ), VND (Việt Nam đồng)",
  },
  {
    title: "Tên thương hiệu và thuật ngữ công nghệ phổ biến",
    example: "Ví dụ: AI (Ây Ai), ChatGPT (Chát Gờ Pê Tê), Facebook (Phây Búc), TikTok (Tích Tóc)",
  },
  {
    title: "Tự động chuyển đổi thông minh khi tổng hợp",
    example: "Mọi từ đang ở trạng thái BẬT sẽ tự động áp dụng vào kịch bản khi bạn bấm Bắt đầu tổng hợp.",
  },
];

export const PronunciationModal: React.FC<PronunciationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    pronunciationWords,
    addPronunciationWord,
    deletePronunciationWord,
    togglePronunciationWord,
  } = useTTSStore();

  const [original, setOriginal] = useState("");
  const [pronunciation, setPronunciation] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Lọc theo tìm kiếm
  const filteredWords = useMemo(() => {
    if (!searchQuery.trim()) return pronunciationWords;
    const q = searchQuery.toLowerCase().trim();
    return pronunciationWords.filter(
      (w) =>
        w.original.toLowerCase().includes(q) ||
        w.pronunciation.toLowerCase().includes(q),
    );
  }, [pronunciationWords, searchQuery]);

  if (!isOpen) return null;

  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    const origTrim = original.trim();
    const pronTrim = pronunciation.trim();

    if (!origTrim) {
      toast.error("Vui lòng nhập từ gốc hoặc từ viết tắt");
      return;
    }
    if (!pronTrim) {
      toast.error("Vui lòng nhập cách đọc mong muốn");
      return;
    }

    // Kiểm tra xem từ này đã tồn tại chưa
    const existing = pronunciationWords.find(
      (w) => w.original.toLowerCase() === origTrim.toLowerCase(),
    );
    if (existing) {
      toast.error(`Từ "${origTrim}" đã có trong từ điển.`);
      return;
    }

    addPronunciationWord({ original: origTrim, pronunciation: pronTrim });
    toast.success(`Đã thêm từ: "${origTrim}" ➔ "${pronTrim}"`);
    setOriginal("");
    setPronunciation("");
  };

  const handlePrevTip = () => {
    setCurrentTipIndex((prev) => (prev === 0 ? TIPS.length - 1 : prev - 1));
  };

  const handleNextTip = () => {
    setCurrentTipIndex((prev) => (prev === TIPS.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="glass-card rounded-2xl w-full max-w-lg md:max-w-xl max-h-[92vh] flex flex-col border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-surface/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <BookA className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-display font-semibold text-on-surface">
              Cách đọc
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex flex-col gap-5 text-sm custom-scrollbar">
          {/* Thông báo hướng dẫn */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300">
            <Lightbulb className="w-5 h-5 shrink-0 text-blue-400 mt-0.5" />
            <p className="text-xs sm:text-[13px] leading-relaxed">
              Hệ thống sẽ tự động phát âm các từ theo cách đọc mà bạn đã thiết lập khi bấm tổng hợp âm thanh.
            </p>
          </div>

          {/* Form thêm từ mới */}
          <form onSubmit={handleAddWord} className="flex flex-col gap-4">
            {/* Input 1: Từ gốc */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-label-caps text-on-surface-variant flex items-center justify-between">
                <span>Từ viết tắt/từ nước ngoài</span>
                <span className="text-[11px] font-mono-data opacity-60">
                  {original.length}/50
                </span>
              </label>
              <input
                type="text"
                maxLength={50}
                value={original}
                onChange={(e) => setOriginal(e.target.value)}
                placeholder="QL4H, H2T, PSG, pronunciation, năm hai một bốn..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-dim border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/50 text-on-surface placeholder:text-on-surface-variant/40 text-sm outline-none transition-all font-body-md"
              />
            </div>

            {/* Input 2: Cách đọc */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-label-caps text-on-surface-variant flex items-center justify-between">
                <span>Cách đọc</span>
                <span className="text-[11px] font-mono-data opacity-60">
                  {pronunciation.length}/100
                </span>
              </label>
              <input
                type="text"
                maxLength={100}
                value={pronunciation}
                onChange={(e) => setPronunciation(e.target.value)}
                placeholder="Quốc lộ bốn hát, hoa học trò, năm, hai, một, bốn..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface-dim border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary/50 text-on-surface placeholder:text-on-surface-variant/40 text-sm outline-none transition-all font-body-md"
              />
            </div>

            {/* Nút Thêm từ */}
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-black font-semibold text-xs font-label-caps shadow-md transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Thêm từ
              </button>
            </div>
          </form>

          {/* Danh sách từ điển hiện tại */}
          <div className="flex flex-col gap-3 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-label-caps text-on-surface-variant">
                  Từ điển của bạn
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-mono-data text-primary font-semibold">
                  {pronunciationWords.length}
                </span>
              </div>

              {/* Ô tìm kiếm từ */}
              {pronunciationWords.length > 3 && (
                <div className="relative w-44">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm từ..."
                    className="w-full pl-8 pr-3 py-1 text-xs rounded-lg bg-surface-dim border border-white/10 focus:border-primary text-on-surface outline-none"
                  />
                </div>
              )}
            </div>

            {/* Danh sách items */}
            {filteredWords.length === 0 ? (
              <div className="py-6 text-center text-xs text-on-surface-variant/50 border border-dashed border-white/10 rounded-xl">
                {searchQuery
                  ? "Không tìm thấy từ nào khớp với từ khóa tìm kiếm"
                  : "Chưa có từ nào trong từ điển. Hãy thêm từ ở trên."}
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {filteredWords.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                      item.enabled
                        ? "bg-surface-dim/90 border-white/10 hover:border-primary/30"
                        : "bg-surface-dim/40 border-white/5 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="font-semibold text-xs text-on-surface truncate">
                        {item.original}
                      </span>
                      <span className="text-on-surface-variant/40 text-xs">➔</span>
                      <span className="text-xs text-primary font-medium truncate">
                        {item.pronunciation}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Switch bật/tắt */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={item.enabled}
                        onClick={() => togglePronunciationWord(item.id)}
                        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          item.enabled ? "bg-primary" : "bg-white/20"
                        }`}
                        title={item.enabled ? "Đang bật" : "Đang tắt"}
                      >
                        <span
                          className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-surface shadow ring-0 transition duration-200 ease-in-out ${
                            item.enabled
                              ? "translate-x-3 bg-black"
                              : "translate-x-0 bg-on-surface-variant"
                          }`}
                        />
                      </button>

                      {/* Nút xóa */}
                      <button
                        type="button"
                        onClick={() => {
                          deletePronunciationWord(item.id);
                          toast.success(`Đã xoá từ "${item.original}"`);
                        }}
                        className="p-1 rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Xoá từ này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mẹo hay (Carousel giống Vbee) */}
          <div className="p-4 rounded-2xl bg-surface-dim/80 border border-white/10 flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500 text-white font-bold text-[11px]">
                <Lightbulb className="w-3.5 h-3.5 fill-white" />
                Mẹo hay
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-data text-on-surface-variant">
                  {currentTipIndex + 1}/{TIPS.length}
                </span>
                <div className="inline-flex rounded-lg border border-white/10 overflow-hidden bg-surface">
                  <button
                    type="button"
                    onClick={handlePrevTip}
                    className="p-1 hover:bg-white/10 text-on-surface-variant hover:text-white transition-colors border-r border-white/10"
                    title="Mẹo trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextTip}
                    className="p-1 hover:bg-white/10 text-on-surface-variant hover:text-white transition-colors"
                    title="Mẹo tiếp theo"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <h4 className="text-xs sm:text-sm font-semibold text-on-surface">
              {TIPS[currentTipIndex].title}
            </h4>
            <p className="text-xs text-on-surface-variant/80 leading-relaxed">
              {TIPS[currentTipIndex].example}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
