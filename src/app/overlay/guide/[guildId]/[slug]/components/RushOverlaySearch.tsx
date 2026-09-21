"use client";

import React, { forwardRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RushOverlaySearchProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isLightMode?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Barre de recherche de l'overlay.
 * - Icône loupe + champ contrôlé + bouton effacer + raccourci `/`.
 * - Le raccourci clavier `/` et la gestion `Escape` sont gérés par le parent
 *   (GuideOverlayClient) qui détient l'état et le focus.
 */
export const RushOverlaySearch = forwardRef<HTMLInputElement, RushOverlaySearchProps>(
  function RushOverlaySearch(
    { value, onChange, onClear, isLightMode = false, placeholder = "Rechercher une quête, zone, donjon…", className },
    ref
  ) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 h-9 mx-3 mt-3 mb-2.5 px-3 rounded-lg border transition-colors",
          isLightMode ? "bg-white border-slate-200" : "bg-[#181c22] border-[#28303a]",
          className
        )}
      >
        <Search className={cn("w-3.5 h-3.5 shrink-0", isLightMode ? "text-slate-400" : "text-[#6e7783]")} />

        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Rechercher"
          className={cn(
            "flex-1 min-w-0 bg-transparent text-xs outline-none",
            isLightMode ? "text-slate-900 placeholder:text-slate-400" : "text-[#f2f0e9] placeholder:text-[#6e7784]"
          )}
        />

        {value && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Effacer la recherche"
            className={cn(
              "p-0.5 rounded transition-colors",
              isLightMode ? "text-slate-400 hover:text-slate-700" : "text-[#6e7784] hover:text-[#f2f0e9]"
            )}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <kbd
          className={cn(
            "px-1.5 py-0.5 rounded border text-[9px] font-bold",
            isLightMode ? "border-slate-300 text-slate-400" : "border-[#343b45] text-[#6e7784]"
          )}
        >
          /
        </kbd>
      </div>
    );
  }
);
