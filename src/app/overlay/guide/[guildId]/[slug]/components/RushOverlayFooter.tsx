"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RushOverlayFooterProps {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  isLightMode?: boolean;
  /** Libellé central, ex : "1 / 5" */
  label?: string;
  onToggleCompact?: () => void;
  isCompact?: boolean;
  className?: string;
}

/**
 * Pied de page fixe : navigation Précédent / Suivant entre les chapitres,
 * libellé de position, et bouton "Réduire" (mode jeu compact).
 */
export function RushOverlayFooter({
  onPrev,
  onNext,
  canPrev,
  canNext,
  isLightMode = false,
  label,
  onToggleCompact,
  isCompact = false,
  className,
}: RushOverlayFooterProps) {
  const baseBtn = "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold disabled:opacity-20 transition-all shadow-sm";

  return (
    <footer
      className={cn(
        "flex shrink-0 items-center justify-between gap-3 px-4 py-2.5 border-t",
        isLightMode ? "border-slate-200 bg-slate-100" : "border-[#28303a]/70 bg-[#0d1014]",
        className
      )}
    >
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        className={cn(
          baseBtn,
          isLightMode
            ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            : "border-[#28303a] bg-[#181e25] hover:bg-[#202732] text-[#c4cad2] hover:text-white"
        )}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span>Précédent</span>
      </button>

      <div className="flex items-center gap-2">
        {label && (
          <span className={cn("text-[11px] font-mono font-bold", isLightMode ? "text-slate-500" : "text-[#929aa5]")}>
            {label}
          </span>
        )}
        {onToggleCompact && (
          <button
            type="button"
            onClick={onToggleCompact}
            aria-label={isCompact ? "Agrandir l'overlay" : "Passer en mode jeu compact"}
            title={isCompact ? "Agrandir" : "Mode compact"}
            className={cn(
              "p-1.5 rounded-lg border transition-colors",
              isCompact
                ? isLightMode
                  ? "bg-amber-50 border-amber-300 text-amber-700"
                  : "bg-[#d5a94e]/15 border-[#d5a94e]/30 text-[#d5a94e]"
                : isLightMode
                  ? "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                  : "bg-[#181d23] border-[#2a3646] text-[#6e7784] hover:text-[#f2f0e9] hover:bg-[#1f2733]"
            )}
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className={cn(
          baseBtn,
          "border-[#39bc95]/40 bg-[#39bc95]/15 hover:bg-[#39bc95]/25 text-xs font-bold text-[#2b9f7d] dark:text-[#74d6b6]"
        )}
      >
        <span>Suivant</span>
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </footer>
  );
}
