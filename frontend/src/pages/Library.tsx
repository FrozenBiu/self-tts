import React, { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderOpen,
  Trash2,
  Download,
  Film,
  Copy,
  FileText,
  CheckSquare,
  Square,
  Mic,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FolderSymlink,
} from "lucide-react";
import { useTTSStore, type AudioRecord } from "../store/useTTSStore";
import { toast } from "sonner";
import { downloadAudioFile } from "../utils/download";
import { AudioPlayerBar } from "../components/library/AudioPlayerBar";
import {
  LibraryFilters,
  type LibraryFilterState,
} from "../components/library/LibraryFilters";
import { ConfirmModal } from "../components/common/ConfirmModal";
import { CustomDropdown } from "../components/common/CustomDropdown";

export { AudioRecordItem } from "../components/library/AudioRecordItem";

export default function Library() {
  const navigate = useNavigate();
  const {
    history,
    projects,
    removeHistory,
    removeMultipleHistory,
    updateRecordProject,
    updateMultipleRecordProjects,
    setPendingVoiceForVideo,
    cleanupJunkFiles,
  } = useTTSStore();

  // ── Trạng thái Bộ lọc & Hiển thị ──────────────────────────────────────────
  const [filters, setFilters] = useState<LibraryFilterState>({
    keyword: "",
    voiceName: "all",
    projectId: "all",
    dateRange: "all",
    sortBy: "newest",
    viewMode: "list",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCleaning, setIsCleaning] = useState(false);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(new Set());

  // Trạng thái Modal xác nhận xóa
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Cập nhật bộ lọc
  const handleFilterChange = (updates: Partial<LibraryFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setCurrentPage(1); // Reset về trang đầu khi lọc
  };

  const handleResetFilters = () => {
    setFilters({
      keyword: "",
      voiceName: "all",
      projectId: "all",
      dateRange: "all",
      sortBy: "newest",
      viewMode: filters.viewMode, // Giữ nguyên viewMode người dùng thích
    });
    setCurrentPage(1);
  };

  // ── Thống kê danh sách giọng đọc có trong lịch sử ────────────────────────
  const availableVoices = useMemo(() => {
    const voiceCountMap = new Map<string, number>();
    for (const item of history) {
      const vName = item.voiceName || "Mặc định";
      voiceCountMap.set(vName, (voiceCountMap.get(vName) || 0) + 1);
    }
    return Array.from(voiceCountMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [history]);

  // ── Thống kê tổng quan (Summary Metrics) ──────────────────────────────────
  const stats = useMemo(() => {
    const totalAudios = history.length;
    const uniqueVoices = new Set(history.map((h) => h.voiceName).filter(Boolean)).size;
    const assignedCount = history.filter((h) => Boolean(h.projectId)).length;
    const totalChars = history.reduce((sum, h) => sum + (h.text?.length || 0), 0);
    return { totalAudios, uniqueVoices, assignedCount, totalChars };
  }, [history]);

  // ── Lọc và Sắp xếp danh sách ────────────────────────────────────────────
  const filteredHistory = useMemo(() => {
    let list = [...history];

    // 1. Lọc theo Từ khoá (trong text hoặc id)
    if (filters.keyword.trim()) {
      const q = filters.keyword.trim().toLowerCase();
      list = list.filter(
        (item) =>
          item.text.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q) ||
          (item.voiceName && item.voiceName.toLowerCase().includes(q)),
      );
    }

    // 2. Lọc theo Tên giọng đọc
    if (filters.voiceName !== "all") {
      list = list.filter((item) => (item.voiceName || "Mặc định") === filters.voiceName);
    }

    // 3. Lọc theo Dự án
    if (filters.projectId !== "all") {
      if (filters.projectId === "unassigned") {
        list = list.filter((item) => !item.projectId);
      } else {
        list = list.filter((item) => item.projectId === filters.projectId);
      }
    }

    // 4. Lọc theo Ngày tháng tạo
    if (filters.dateRange !== "all") {
      const now = Date.now();
      if (filters.dateRange === "today") {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        list = list.filter((item) => item.timestamp >= startOfToday.getTime());
      } else if (filters.dateRange === "7days") {
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        list = list.filter((item) => item.timestamp >= sevenDaysAgo);
      } else if (filters.dateRange === "30days") {
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        list = list.filter((item) => item.timestamp >= thirtyDaysAgo);
      } else if (filters.dateRange === "custom") {
        if (filters.customStartDate) {
          const start = new Date(filters.customStartDate).setHours(0, 0, 0, 0);
          list = list.filter((item) => item.timestamp >= start);
        }
        if (filters.customEndDate) {
          const end = new Date(filters.customEndDate).setHours(23, 59, 59, 999);
          list = list.filter((item) => item.timestamp <= end);
        }
      }
    }

    // 5. Sắp xếp
    if (filters.sortBy === "newest") {
      list.sort((a, b) => b.timestamp - a.timestamp);
    } else if (filters.sortBy === "oldest") {
      list.sort((a, b) => a.timestamp - b.timestamp);
    } else if (filters.sortBy === "longest") {
      list.sort((a, b) => (b.text?.length || 0) - (a.text?.length || 0));
    } else if (filters.sortBy === "shortest") {
      list.sort((a, b) => (a.text?.length || 0) - (b.text?.length || 0));
    }

    return list;
  }, [history, filters]);

  // ── Phân trang ────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const pagedItems = filteredHistory.slice(startIndex, startIndex + itemsPerPage);

  // ── Thao tác từng Audio ──────────────────────────────────────────────────
  const handleEditVideo = useCallback((record: AudioRecord) => {
    setPendingVoiceForVideo(record);
    toast.success("Đã nạp audio! Đang chuyển sang Auto Caption Studio...");
    navigate("/autocaption");
  }, [setPendingVoiceForVideo, navigate]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã sao chép văn bản vào bộ nhớ tạm!");
  };

  const handleDownload = (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    if (!url) return;
    downloadAudioFile(url);
    toast.success("Đang tải file âm thanh về máy...");
  };

  // Mở thư mục và trỏ đúng file trong Windows Explorer
  const handleLocateFile = async (record: AudioRecord) => {
    try {
      toast.info("Đang định vị file trên máy tính...");
      const res = await fetch("http://127.0.0.1:8000/api/tts/locate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: record.url }),
      }).catch(() =>
        fetch("http://localhost:8000/api/tts/locate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: record.url }),
        })
      );

      if (!res.ok) {
        throw new Error("Không tìm thấy đường dẫn file âm thanh cục bộ.");
      }

      const data = await res.json();
      if (window.electronAPI?.showItemInFolder && data.file_path) {
        await window.electronAPI.showItemInFolder(data.file_path);
        toast.success("Đã mở thư mục và chọn đúng file âm thanh!");
      } else if (data.file_path) {
        toast.info(`Đường dẫn file: ${data.file_path}`);
      }
    } catch (err: any) {
      toast.error(`Lỗi định vị file: ${err.message}`);
    }
  };

  const toggleExpandText = (id: string) => {
    setExpandedTextIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Thao tác Hàng loạt (Batch Actions) ─────────────────────────────────────
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllCurrent = () => {
    if (selectedIds.size === pagedItems.length && pagedItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pagedItems.map((item) => item.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setConfirmModal({
      isOpen: true,
      title: "Xác nhận xóa hàng loạt",
      message: `Bạn có chắc chắn muốn xóa ${count} file audio đã chọn khỏi thư viện và bộ nhớ máy tính không?`,
      onConfirm: async () => {
        const idsToDelete = Array.from(selectedIds);
        await removeMultipleHistory(idsToDelete);
        setSelectedIds(new Set());
        toast.success(`Đã xóa thành công ${idsToDelete.length} audio khỏi thư viện!`);
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleDeleteSingle = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Xác nhận xóa audio",
      message: "Bạn có chắc chắn muốn xóa bản ghi âm thanh này khỏi thư viện và bộ nhớ máy tính?",
      onConfirm: async () => {
        await removeHistory(id);
        toast.success("Đã xóa bản ghi khỏi thư viện!");
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleAssignSelectedProject = (projectId?: string) => {
    if (selectedIds.size === 0) return;
    const idsToAssign = Array.from(selectedIds);
    updateMultipleRecordProjects(idsToAssign, projectId);
    toast.success(
      projectId
        ? `Đã gán ${idsToAssign.length} audio vào dự án thành công!`
        : `Đã đưa ${idsToAssign.length} audio về Thư viện chung!`,
    );
  };

  const handleDownloadSelected = () => {
    if (selectedIds.size === 0) return;
    const items = history.filter((h) => selectedIds.has(h.id));
    items.forEach((item, idx) => {
      setTimeout(() => {
        downloadAudioFile(item.url);
      }, idx * 250);
    });
    toast.success(`Đang tải xuống ${items.length} file âm thanh...`);
  };

  // Dọn dẹp file rác mồ côi
  const handleCleanJunk = async () => {
    setIsCleaning(true);
    const toastId = toast.loading("Đang quét và dọn dẹp các file âm thanh rác...");
    try {
      const res = await cleanupJunkFiles(true);
      if (res.deleted_count > 0) {
        toast.success(
          `Đã dọn dẹp ${res.deleted_count} file rác, giải phóng ${res.freed_mb} MB bộ nhớ!`,
          { id: toastId },
        );
      } else {
        toast.success("Hệ thống sạch sẽ! Không có file rác mồ côi nào.", {
          id: toastId,
        });
      }
    } catch (e: any) {
      toast.error(`Lỗi dọn dẹp: ${e.message}`, { id: toastId });
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pt-4 sm:pt-6 pb-20 animate-in fade-in duration-300">
      {/* ── 1. HEADER TRANG THƯ VIỆN ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              Thư viện Audio
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono">
                {history.length} mục
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
              Quản lý toàn bộ tệp âm thanh đã tổng hợp, nghe lại, phân loại dự án và làm phụ đề video.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleCleanJunk}
            disabled={isCleaning}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-variant hover:bg-white/10 text-on-surface border border-white/10 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            title="Quét và xóa các file audio mồ côi không còn lưu trong lịch sử"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isCleaning ? "animate-spin" : ""}`} />
            <span>{isCleaning ? "Đang dọn..." : "Dọn rác bộ nhớ"}</span>
          </button>
        </div>
      </div>

      {/* ── 2. THANH THỐNG KÊ TỔNG QUAN (METRICS BAR) ────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-surface-variant/20 border border-white/5 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
              Tổng Audio
            </p>
            <p className="text-lg font-bold text-white mt-0.5">{stats.totalAudios}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface-variant/20 border border-white/5 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
              Giọng đã dùng
            </p>
            <p className="text-lg font-bold text-white mt-0.5">{stats.uniqueVoices}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface-variant/20 border border-white/5 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
              Đã gán dự án
            </p>
            <p className="text-lg font-bold text-white mt-0.5">{stats.assignedCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface-variant/20 border border-white/5 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
              Tổng số ký tự
            </p>
            <p className="text-lg font-bold text-white mt-0.5">
              {stats.totalChars.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. KHU VỰC BỘ LỌC TÌM KIẾM ĐA TIÊU CHÍ ──────────────────────────── */}
      <LibraryFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        availableVoices={availableVoices}
        projects={projects}
        totalCount={history.length}
        filteredCount={filteredHistory.length}
      />

      {/* ── 4. THANH THAO TÁC HÀNG LOẠT (BATCH ACTIONS BAR) ────────────────── */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-amber-400">
              Đã chọn {selectedIds.size} mục
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-on-surface-variant hover:text-on-surface underline cursor-pointer"
            >
              Bỏ chọn
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Gán dự án hàng loạt */}
            <CustomDropdown
              value=""
              onChange={(val) => handleAssignSelectedProject(val || undefined)}
              placeholder="Gán vào dự án..."
              icon={<FolderSymlink className="w-3.5 h-3.5" />}
              className="bg-surface-dim hover:bg-white/10 border-white/10"
              options={[
                { value: "", label: "Gỡ khỏi dự án (Thư viện chung)" },
                ...projects.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />

            {/* Tải xuống hàng loạt */}
            <button
              type="button"
              onClick={handleDownloadSelected}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-dim hover:bg-white/10 hover:border-amber-500/30 text-on-surface hover:text-amber-300 border border-white/10 font-medium transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Tải {selectedIds.size} file</span>
            </button>

            {/* Xóa hàng loạt */}
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 font-medium transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa {selectedIds.size} mục</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 5. DANH SÁCH BẢN GHI (CHẾ ĐỘ LIST HOẶC GRID) ────────────────────── */}
      {filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-14 rounded-2xl bg-surface-variant/20 border border-dashed border-white/10 text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-surface-dim flex items-center justify-center text-on-surface-variant">
            <FolderOpen className="w-6 h-6 opacity-60" />
          </div>
          <p className="text-sm font-medium text-on-surface">
            Không tìm thấy bản ghi âm thanh nào phù hợp
          </p>
          <p className="text-xs text-on-surface-variant max-w-sm">
            Hãy thử thay đổi từ khoá tìm kiếm hoặc nhấn nút "Đặt lại bộ lọc" bên trên.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-2 px-4 py-1.5 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 text-xs font-semibold cursor-pointer transition-colors"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : filters.viewMode === "list" ? (
        /* ── CHẾ ĐỘ HIỂN THỊ DANH SÁCH (LIST VIEW) ────────────────────────── */
        <div className="flex flex-col gap-3">
          {/* Header chọn tất cả */}
          <div className="flex items-center justify-between px-4 py-2 text-xs text-on-surface-variant border-b border-white/5">
            <button
              type="button"
              onClick={handleSelectAllCurrent}
              className="flex items-center gap-2 hover:text-on-surface cursor-pointer"
            >
              {selectedIds.size === pagedItems.length && pagedItems.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-primary" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>Chọn tất cả trang này ({pagedItems.length})</span>
            </button>
            <div className="flex items-center gap-2">
              <span>Hiển thị mỗi trang:</span>
              <CustomDropdown
                value={String(itemsPerPage)}
                onChange={(val) => {
                  setItemsPerPage(Number(val));
                  setCurrentPage(1);
                }}
                className="bg-surface-dim px-2.5 py-1"
                options={[
                  { value: "5", label: "5 mục" },
                  { value: "10", label: "10 mục" },
                  { value: "20", label: "20 mục" },
                  { value: "50", label: "50 mục" },
                ]}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {pagedItems.map((record) => {
              const isSelected = selectedIds.has(record.id);
              const isExpanded = expandedTextIds.has(record.id);
              const isLongText = record.text.length > 150;

              return (
                <div
                  key={record.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col gap-3.5 ${
                    isSelected
                      ? "bg-amber-500/[0.04] border-amber-500/40 shadow-sm"
                      : "bg-surface-variant/25 hover:bg-surface-variant/40 border-white/5"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Checkbox & Nội dung text */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(record.id)}
                        className="mt-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer shrink-0"
                        title={isSelected ? "Bỏ chọn" : "Chọn audio này"}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                        <p
                          className={`text-sm text-on-surface leading-relaxed ${
                            !isExpanded ? "line-clamp-2" : ""
                          }`}
                        >
                          "{record.text}"
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-on-surface-variant">
                          {isLongText && (
                            <button
                              type="button"
                              onClick={() => toggleExpandText(record.id)}
                              className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                            >
                              {isExpanded ? "Thu gọn" : "Xem toàn bộ"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopy(record.text)}
                            className="flex items-center gap-1 hover:text-on-surface transition-colors cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy văn bản</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bộ nút hành động nhanh */}
                    <div className="flex items-center gap-1.5 self-end sm:self-start shrink-0">
                      {/* Gán dự án dropdown */}
                      <CustomDropdown
                        value={record.projectId || ""}
                        onChange={(val) => {
                          updateRecordProject(record.id, val || undefined);
                          toast.success(
                            val
                              ? "Đã gán vào dự án thành công!"
                              : "Đã chuyển về Thư viện chung",
                          );
                        }}
                        placeholder="-- Thư viện chung --"
                        className="h-8.5 bg-surface-dim hover:bg-white/10 text-on-surface-variant hover:text-white border-white/10 max-w-[155px]"
                        options={[
                          { value: "", label: "-- Thư viện chung --" },
                          ...projects.map((p) => ({
                            value: p.id,
                            label: p.name,
                          })),
                        ]}
                      />

                      {/* Làm Video (Auto Caption) */}
                      <button
                        type="button"
                        onClick={() => handleEditVideo(record)}
                        className="h-8.5 px-3 flex items-center gap-1.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/50 font-semibold text-xs border border-amber-500/30 transition-all shadow-sm cursor-pointer group"
                        title="Tạo video với giọng đọc này trong Auto Caption Studio"
                      >
                        <Film className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        <span>Làm Video</span>
                      </button>

                      {/* Định vị file trong Windows Explorer */}
                      <button
                        type="button"
                        onClick={() => handleLocateFile(record)}
                        className="w-8.5 h-8.5 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
                        title="Mở thư mục chứa file trong Windows Explorer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>

                      {/* Tải xuống */}
                      <button
                        type="button"
                        onClick={(e) => handleDownload(e, record.url)}
                        className="w-8.5 h-8.5 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-amber-400 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-colors cursor-pointer"
                        title="Tải file âm thanh về máy"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* Xóa */}
                      <button
                        type="button"
                        onClick={() => handleDeleteSingle(record.id)}
                        className="w-8.5 h-8.5 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-red-400 hover:bg-red-500/15 border border-transparent hover:border-red-500/25 transition-colors cursor-pointer"
                        title="Xóa khỏi lịch sử"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Badges tham số & Player */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                    <div className="flex flex-wrap items-center gap-2">
                      {record.voiceName && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400 border border-amber-500/20">
                          <Mic className="w-3 h-3" />
                          {record.voiceName}
                        </span>
                      )}
                      {record.speed !== undefined && (
                        <span className="inline-flex items-center rounded-md bg-surface-dim px-2 py-0.5 text-[10px] font-mono-data text-on-surface-variant border border-white/5">
                          Speed: {record.speed.toFixed(2)}x
                        </span>
                      )}
                      {record.pitch !== undefined && (
                        <span className="inline-flex items-center rounded-md bg-surface-dim px-2 py-0.5 text-[10px] font-mono-data text-on-surface-variant border border-white/5">
                          Pitch: {record.pitch > 0 ? "+" : ""}
                          {record.pitch.toFixed(1)}
                        </span>
                      )}
                      {record.cfg_value !== undefined && (
                        <span className="inline-flex items-center rounded-md bg-surface-dim px-2 py-0.5 text-[10px] font-mono-data text-on-surface-variant border border-white/5">
                          CFG: {record.cfg_value}
                        </span>
                      )}
                      {record.seed !== undefined && (
                        <span className="inline-flex items-center rounded-md bg-surface-dim px-2 py-0.5 text-[10px] font-mono-data text-on-surface-variant border border-white/5">
                          Seed: {record.seed}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-mono-data text-on-surface-variant/60">
                      {new Date(record.timestamp).toLocaleString("vi-VN")}
                    </span>
                  </div>

                  {/* Audio Player Bar */}
                  <AudioPlayerBar
                    url={record.url}
                    recordId={record.id}
                    activePlayingId={activePlayingId}
                    onPlayStateChange={(id, isPlaying) => {
                      setActivePlayingId(isPlaying ? id : null);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ── CHẾ ĐỘ HIỂN THỊ THẺ LƯỚI (GRID VIEW) ─────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pagedItems.map((record) => {
            const isSelected = selectedIds.has(record.id);
            const isExpanded = expandedTextIds.has(record.id);

            return (
              <div
                key={record.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                  isSelected
                    ? "bg-amber-500/[0.05] border-amber-500/40 shadow-md"
                    : "bg-surface-variant/25 hover:bg-surface-variant/40 border-white/5"
                }`}
              >
                {/* Header Thẻ: Checkbox, Giọng đọc & Menu hành động */}
                <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(record.id)}
                      className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    {record.voiceName ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20 truncate">
                        <Mic className="w-3 h-3 shrink-0" />
                        <span className="truncate">{record.voiceName}</span>
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-on-surface-variant">
                        Audio
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLocateFile(record)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      title="Mở trong Windows Explorer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDownload(e, record.url)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                      title="Tải về"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSingle(record.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-red-500/15 transition-colors cursor-pointer"
                      title="Xóa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Nội dung text */}
                <div className="flex-1 flex flex-col gap-2">
                  <p
                    className={`text-xs sm:text-sm text-on-surface leading-relaxed italic ${
                      !isExpanded ? "line-clamp-3" : ""
                    }`}
                  >
                    "{record.text}"
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant mt-auto pt-1">
                    {record.text.length > 120 && (
                      <button
                        type="button"
                        onClick={() => toggleExpandText(record.id)}
                        className="text-amber-400 hover:text-amber-300 font-medium cursor-pointer"
                      >
                        {isExpanded ? "Thu gọn" : "Xem thêm"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopy(record.text)}
                      className="flex items-center gap-1 hover:text-on-surface cursor-pointer ml-auto"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </button>
                  </div>
                </div>

                {/* Audio Player Bar */}
                <AudioPlayerBar
                  url={record.url}
                  recordId={record.id}
                  activePlayingId={activePlayingId}
                  onPlayStateChange={(id, isPlaying) => {
                    setActivePlayingId(isPlaying ? id : null);
                  }}
                />

                {/* Footer Thẻ: Nút Làm Video & Chọn Dự án */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                  <CustomDropdown
                    value={record.projectId || ""}
                    onChange={(val) => {
                      updateRecordProject(record.id, val || undefined);
                      toast.success(
                        val ? "Đã gán vào dự án!" : "Đã chuyển về Thư viện chung",
                      );
                    }}
                    placeholder="-- Thư viện chung --"
                    className="h-8 bg-surface-dim hover:bg-white/10 text-on-surface-variant hover:text-white border-white/10 max-w-[140px]"
                    options={[
                      { value: "", label: "-- Thư viện chung --" },
                      ...projects.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />

                  <button
                    type="button"
                    onClick={() => handleEditVideo(record)}
                    className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 font-semibold text-xs border border-amber-500/30 transition-all cursor-pointer group"
                    title="Làm video với giọng đọc này trong Auto Caption Studio"
                  >
                    <Film className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    <span>Làm Video</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 6. ĐIỀU HƯỚNG PHÂN TRANG (PAGINATION) ────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-surface-variant/20 border border-white/5 text-xs text-on-surface-variant">
          <div className="font-medium">
            Hiển thị từ{" "}
            <strong className="text-white">{startIndex + 1}</strong> đến{" "}
            <strong className="text-white">
              {Math.min(startIndex + itemsPerPage, filteredHistory.length)}
            </strong>{" "}
            trong tổng số <strong className="text-amber-400">{filteredHistory.length}</strong> kết quả
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-dim hover:bg-white/10 text-on-surface border border-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Trang trước</span>
            </button>

            <span className="px-3 py-1 font-mono-data text-xs text-on-surface">
              <span className="text-amber-400 font-bold">{currentPage}</span> / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-dim hover:bg-white/10 text-on-surface border border-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Trang sau</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── 7. MODAL XÁC NHẬN XÓA HIỆN ĐẠI (KHÔNG DÙNG WINDOW.CONFIRM) ────── */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
