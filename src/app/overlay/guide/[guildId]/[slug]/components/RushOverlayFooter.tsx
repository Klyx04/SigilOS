"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface RushOverlayFooterProps {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  isLightMode?: boolean;
  /** Libellé central, ex : "1 / 5" */
  label?: string;
  className?: string;
}

/**
 * Pied de page fixe : navigation Précédent / Suivant entre les chapitres + libellé de
 * position. Le bouton « mode compact » (vue de jeu) **n'est plus ici** : c'est un réglage
 * d'affichage, il vit dans l'en-tête à côté du thème (retour user du 21/09/2026).
 */
export function RushOverlayFooter({
  onPrev,
  onNext,
  canPrev,
  canNext,
  isLightMode = false,
  label,
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
