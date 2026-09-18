import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  menuClassName?: string;
  align?: "left" | "right";
  disabled?: boolean;
  title?: string;
}

export function CustomDropdown({
  value,
  onChange,
  options,
  placeholder = "-- Chọn --",
  icon,
  className = "",
  menuClassName = "",
  align = "left",
  disabled = false,
  title,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left" title={title}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-dim/90 hover:bg-white/5 border border-white/10 hover:border-amber-500/30 text-on-surface transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none ${
          isOpen ? "border-amber-500/50 bg-white/5 ring-1 ring-amber-500/30" : ""
        } ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          {icon && <span className="shrink-0 text-amber-400">{icon}</span>}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge !== undefined && (
            <span className="shrink-0 px-1.5 py-0.2 rounded-md bg-white/10 text-[10px] text-zinc-400 font-mono">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-amber-400" : ""
          }`}
        />
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } mt-1.5 min-w-[180px] max-h-64 overflow-y-auto rounded-xl bg-[#18181b] border border-white/15 shadow-2xl p-1 z-50 backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150 ${menuClassName}`}
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.15) transparent",
          }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                  isSelected
                    ? "bg-amber-500/15 text-amber-400 font-semibold"
                    : "text-zinc-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 truncate">
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <span className="truncate">{opt.label}</span>
                  {opt.badge !== undefined && (
                    <span className="shrink-0 px-1.5 py-0.2 rounded-md bg-white/10 text-[10px] text-zinc-400 font-mono">
                      {opt.badge}
                    </span>
                  )}
                </div>

                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
