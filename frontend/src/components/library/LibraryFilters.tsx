import React from "react";
import {
  Search,
  X,
  Filter,
  Calendar,
  Layers,
  ArrowUpDown,
  LayoutGrid,
  List,
  RotateCcw,
} from "lucide-react";
import type { Project } from "../../store/useTTSStore";
import { CustomDropdown } from "../common/CustomDropdown";

export interface LibraryFilterState {
  keyword: string;
  voiceName: string;
  projectId: string;
  dateRange: "all" | "today" | "7days" | "30days" | "custom";
  customStartDate?: string;
  customEndDate?: string;
  sortBy: "newest" | "oldest" | "longest" | "shortest";
  viewMode: "list" | "grid";
}

interface LibraryFiltersProps {
  filters: LibraryFilterState;
  onFilterChange: (updates: Partial<LibraryFilterState>) => void;
  onResetFilters: () => void;
  availableVoices: { name: string; count: number }[];
  projects: Project[];
  totalCount: number;
  filteredCount: number;
}

export function LibraryFilters({
  filters,
  onFilterChange,
  onResetFilters,
  availableVoices,
  projects,
  totalCount,
  filteredCount,
}: LibraryFiltersProps) {
  const isFiltered =
    filters.keyword.trim() !== "" ||
    filters.voiceName !== "all" ||
    filters.projectId !== "all" ||
    filters.dateRange !== "all" ||
    filters.sortBy !== "newest";

  return (
    <div className="flex flex-col gap-3.5 p-4 rounded-2xl bg-surface-variant/30 border border-white/5 backdrop-blur-md">
      {/* Hàng 1: Ô tìm kiếm từ khoá & Nút chuyển List/Grid */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Ô Tìm kiếm Từ khoá */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-on-surface-variant absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.keyword}
            onChange={(e) => onFilterChange({ keyword: e.target.value })}
            placeholder="Tìm kiếm theo từ khoá văn bản hoặc mã ID..."
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-surface-dim/80 text-sm text-on-surface placeholder:text-on-surface-variant/50 border border-white/5 focus:outline-none focus:border-primary/50 transition-colors"
          />
          {filters.keyword && (
            <button
              type="button"
              onClick={() => onFilterChange({ keyword: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-0.5 rounded cursor-pointer"
              title="Xoá từ khoá"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Nút chuyển chế độ hiển thị List / Grid */}
        <div className="flex items-center gap-1 bg-surface-dim/80 p-1 rounded-xl border border-white/5 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => onFilterChange({ viewMode: "list" })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filters.viewMode === "list"
                ? "bg-primary/20 text-primary border border-primary/30 shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
            title="Xem dạng Danh sách chi tiết"
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Danh sách</span>
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ viewMode: "grid" })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filters.viewMode === "grid"
                ? "bg-primary/20 text-primary border border-primary/30 shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
            title="Xem dạng Thẻ lưới"
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Lưới thẻ</span>
          </button>
        </div>
      </div>

      {/* Hàng 2: Các Dropdown Lọc chi tiết */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* 1. Lọc theo Giọng đọc */}
        <CustomDropdown
          value={filters.voiceName}
          onChange={(val) => onFilterChange({ voiceName: val })}
          icon={<Filter className="w-3.5 h-3.5" />}
          className="w-full bg-surface-dim/80 hover:bg-white/5 border-white/5 hover:border-amber-500/30"
          options={[
            {
              value: "all",
              label: "Tất cả giọng đọc",
              badge: availableVoices.reduce((sum, v) => sum + v.count, 0),
            },
            ...availableVoices.map((v) => ({
              value: v.name,
              label: v.name,
              badge: v.count,
            })),
          ]}
        />

        {/* 2. Lọc theo Dự án */}
        <CustomDropdown
          value={filters.projectId}
          onChange={(val) => onFilterChange({ projectId: val })}
          icon={<Layers className="w-3.5 h-3.5" />}
          className="w-full bg-surface-dim/80 hover:bg-white/5 border-white/5 hover:border-amber-500/30"
          options={[
            { value: "all", label: "Tất cả dự án" },
            { value: "unassigned", label: "Thư viện chung (Chưa gán)" },
            ...projects.map((p) => ({
              value: p.id,
              label: p.name,
            })),
          ]}
        />

        {/* 3. Lọc theo Ngày tháng */}
        <CustomDropdown
          value={filters.dateRange}
          onChange={(val) =>
            onFilterChange({
              dateRange: val as LibraryFilterState["dateRange"],
            })
          }
          icon={<Calendar className="w-3.5 h-3.5" />}
          className="w-full bg-surface-dim/80 hover:bg-white/5 border-white/5 hover:border-amber-500/30"
          options={[
            { value: "all", label: "Tất cả thời gian" },
            { value: "today", label: "Hôm nay" },
            { value: "7days", label: "7 ngày gần nhất" },
            { value: "30days", label: "30 ngày gần nhất" },
            { value: "custom", label: "Tùy chọn khoảng ngày..." },
          ]}
        />

        {/* 4. Sắp xếp kết quả */}
        <CustomDropdown
          value={filters.sortBy}
          onChange={(val) =>
            onFilterChange({
              sortBy: val as LibraryFilterState["sortBy"],
            })
          }
          icon={<ArrowUpDown className="w-3.5 h-3.5" />}
          className="w-full bg-surface-dim/80 hover:bg-white/5 border-white/5 hover:border-amber-500/30"
          options={[
            { value: "newest", label: "Mới nhất trước" },
            { value: "oldest", label: "Cũ nhất trước" },
            { value: "longest", label: "Văn bản dài nhất" },
            { value: "shortest", label: "Văn bản ngắn nhất" },
          ]}
        />
      </div>

      {/* Khoảng ngày tùy chọn (khi chọn custom dateRange) */}
      {filters.dateRange === "custom" && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-surface-dim/50 border border-white/5 animate-in fade-in duration-200">
          <span className="text-xs text-on-surface-variant font-medium">Từ ngày:</span>
          <input
            type="date"
            value={filters.customStartDate || ""}
            onChange={(e) => onFilterChange({ customStartDate: e.target.value })}
            className="px-2.5 py-1 rounded-lg bg-surface-dim text-xs text-on-surface border border-white/10 focus:outline-none focus:border-primary/50"
            style={{ colorScheme: "dark" }}
          />
          <span className="text-xs text-on-surface-variant font-medium">Đến ngày:</span>
          <input
            type="date"
            value={filters.customEndDate || ""}
            onChange={(e) => onFilterChange({ customEndDate: e.target.value })}
            className="px-2.5 py-1 rounded-lg bg-surface-dim text-xs text-on-surface border border-white/10 focus:outline-none focus:border-primary/50"
            style={{ colorScheme: "dark" }}
          />
        </div>
      )}

      {/* Dòng tóm tắt trạng thái lọc & Nút Đặt lại */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5 text-xs text-on-surface-variant">
        <div className="flex items-center gap-2">
          <span>
            Hiển thị <strong className="text-amber-400 font-semibold">{filteredCount}</strong> / {totalCount} bản ghi
          </span>
          {isFiltered && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-medium">
              Đang áp dụng bộ lọc
            </span>
          )}
        </div>

        {isFiltered && (
          <button
            type="button"
            onClick={onResetFilters}
            className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Đặt lại bộ lọc</span>
          </button>
        )}
      </div>
    </div>
  );
}
