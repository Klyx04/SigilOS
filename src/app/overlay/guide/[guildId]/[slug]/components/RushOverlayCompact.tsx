"use client";

import React from "react";
import { Check, ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { RushCurrentObjective } from "@/components/dofus-quests/rush/RushCurrentObjective";

interface RushOverlayCompactProps {
  milestone: RushMilestone;
  objective: RushSequence | null;
  isDone: boolean;
  isLightMode?: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  onExpand: () => void;
  onClose: () => void;
  className?: string;
}

/**
 * Mode jeu compact — recommandé pendant une phase de combat.
 * Affiche uniquement : checkbox quête · nom · Étape n/m · objectif courant ·
 * précédent / suivant · agrandir · fermer.
 */
export function RushOverlayCompact({
  milestone,
  objective,
  isDone,
  isLightMode = false,
  onToggle,
  onPrev,
  onNext,
  canPrev,
  canNext,
  onExpand,
  onClose,
  className,
}: RushOverlayCompactProps) {
  const name = objective?.subGuideName || objective?.subGuideRef || milestone.title || "—";
  const stepIdx = objective ? milestone.sequences.findIndex((s) => s.id === objective.id) : -1;
  const stepLabel = stepIdx >= 0 ? `${stepIdx + 1} / ${milestone.sequences.length}` : "";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3",
        isLightMode ? "bg-white text-slate-900" : "bg-[#111419] text-[#f2f0e9]",
        className
      )}
    >
      {/* Ligne supérieure : checkbox · titre · actions */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onToggle}
          aria-label={isDone ? "Décocher la quête" : "Marquer comme terminée"}
          className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-[#39bc95] focus-visible:outline-offset-1"
        >
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-md border transition-all",
              isDone
                ? "bg-[#39bc95] border-[#39bc95] text-black"
                : isLightMode
                  ? "border-slate-300 bg-white"
                  : "border-[#3a4d60] bg-[#0f1419]"
            )}
          >
            {isDone && <Check className="h-2.5 w-2.5 stroke-[3]" />}
          </span>
        </button>

        <h2 className={cn("truncate text-sm font-bold leading-tight", isLightMode ? "text-slate-900" : "text-[#f2f0e9]")}>
          {name}
        </h2>

        <button
          type="button"
          onClick={onExpand}
          aria-label="Agrandir l'overlay"
          title="Agrandir"
          className={cn(
            "shrink-0 p-1.5 rounded-lg border transition-colors",
            isLightMode
              ? "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
              : "bg-[#181d23] border-[#2a3646] text-[#6e7784] hover:text-[#f2f0e9] hover:bg-[#1f2733]"
          )}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'overlay"
          title="Fermer"
          className={cn(
            "shrink-0 p-1 rounded-lg transition-colors",
            isLightMode ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-[#4a5568] hover:text-red-400 hover:bg-red-950/20"
          )}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Métadonnées : Étape n/m · Chapitre */}
      <p className={cn("text-[10px] tabular-nums", isLightMode ? "text-slate-500" : "text-[#929aa5]")}>
        {stepLabel}
        {milestone.title ? ` · ${milestone.title}` : ""}
      </p>

      {/* Objectif courant */}
      {objective ? (
        <RushCurrentObjective sequence={objective} milestoneTitle={milestone.title} variant="overlay" />
      ) : (
        <p className={cn("text-xs font-semibold", isLightMode ? "text-slate-500" : "text-[#929aa5]")}>
          {isDone ? "✓ Quête terminée" : "Toutes les étapes sont terminées."}
        </p>
      )}

      {/* Actions précédent / suivant */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-20 transition-colors",
            isLightMode
              ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              : "border-[#28303a] bg-[#181e25] text-[#c4cad2] hover:bg-[#202732]"
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all disabled:opacity-20",
            "border-[#39bc95]/40 bg-[#39bc95]/15 hover:bg-[#39bc95]/25 text-[#2b9f7d] dark:text-[#74d6b6]"
          )}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
