"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { RushMilestone } from "@/types/rush-guide-types";

interface RushOverlayChapterTreeProps {
  chapters: RushMilestone[];
  activeMsId: string | undefined;
  onSelectChapter: (msId: string) => void;
  completedMsIds: Set<string>;
  doneByMs: Map<string, Set<string>>;
  isLightMode?: boolean;
  className?: string;
}

/**
 * Navigation de l'overlay entre les chapitres (milestones).
 * Rangée horizontale scrollable de "puces" de chapitre (contrainte largeur ~400px) :
 * - Le chapitre actif est mis en avant (teinte dorée + barre de progression).
 * - Un clic sélectionne le chapitre (remonte dans GuideOverlayClient).
 * - Le compteur N / M reflète les étapes terminées du chapitre.
 */
export function RushOverlayChapterTree({
  chapters,
  activeMsId,
  onSelectChapter,
  completedMsIds,
  doneByMs,
  isLightMode = false,
  className,
}: RushOverlayChapterTreeProps) {
  if (chapters.length === 0) return null;

  return (
    <nav
      aria-label="Chapitres du guide"
      className={cn(
        "flex shrink-0 items-center gap-1.5 overflow-x-auto px-3 py-2 border-b",
        isLightMode ? "bg-slate-50 border-slate-200" : "bg-[#0d1014] border-[#28303a]/70",
        className
      )}
    >
      {chapters.map((ms, idx) => {
        const isActive = ms.id === activeMsId;
        const done = doneByMs.get(ms.id)?.size ?? 0;
        const total = ms.sequences.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : completedMsIds.has(ms.id) ? 100 : 0;

        return (
          <button
            key={ms.id}
            type="button"
            onClick={() => onSelectChapter(ms.id)}
            aria-pressed={isActive}
            title={`${ms.title || `Chapitre ${idx + 1}`} — ${done} / ${total} étapes terminées`}
            className={cn(
              "relative flex flex-col items-start gap-0.5 shrink-0 min-w-[118px] px-2.5 py-1.5 rounded-lg border text-left transition-all",
              isActive
                ? isLightMode
                  ? "bg-amber-50 border-amber-300"
                  : "bg-[#d5a94e]/12 border-[#d5a94e]/35"
                : isLightMode
                  ? "bg-white border-slate-200 hover:border-slate-300"
                  : "bg-[#13161b] border-[#1e2530] hover:border-[#2a3646]"
            )}
          >
            <span
              className={cn(
                "max-w-[150px] truncate text-[9px] font-black uppercase tracking-wide",
                isActive ? "text-[#d5a94e]" : isLightMode ? "text-slate-400" : "text-[#6e7784]"
              )}
            >
              {ms.title || `Chapitre ${idx + 1}`}
            </span>
            <span
              className={cn(
                "text-[10px] font-bold tabular-nums",
                isActive
                  ? isLightMode
                    ? "text-amber-800"
                    : "text-[#f3e8cc]"
                  : isLightMode
                    ? "text-slate-600"
                    : "text-[#969daa]"
              )}
            >
              {done} / {total}
            </span>
            {isActive && (
              <div className="w-full h-0.5 rounded-full bg-[#d5a94e]/30 overflow-hidden">
                <div className="h-full bg-[#d5a94e] transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
            )}
          </button>
        );
      })}
    </nav>
  );
}
