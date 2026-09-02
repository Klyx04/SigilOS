"use client";

import React, { useState } from "react";
import { ChevronDown, BookOpen, Check } from "lucide-react";
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
 * Navigation chapitres — DROPDOWN CUSTOM (fini le <select> natif).
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
  const [open, setOpen] = useState(false);
  if (chapters.length === 0) return null;

  const activeIdx = chapters.findIndex((ms) => ms.id === activeMsId);
  const activeMs = activeIdx >= 0 ? chapters[activeIdx] : chapters[0];
  const done = activeMs ? (doneByMs.get(activeMs.id)?.size ?? 0) : 0;
  const total = activeMs ? activeMs.sequences.length : 0;
  const pct = activeMs
    ? total > 0
      ? Math.round((done / total) * 100)
      : completedMsIds.has(activeMs.id)
        ? 100
        : 0
    : 0;

  return (
    <nav
      aria-label="Chapitres du guide"
      className={cn(
        "relative shrink-0 px-3 py-2 border-b z-30",
        isLightMode ? "bg-slate-50 border-slate-200" : "bg-[#0d1014] border-[#28303a]/70",
        className
      )}
    >
      {/* Déclencheur */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] font-semibold transition-colors cursor-pointer",
          isLightMode
            ? "bg-white border-slate-200 text-slate-800 hover:border-slate-300"
            : "bg-[#181c22] border-[#28303a] text-[#f2f0e9] hover:border-[#2a3646]"
        )}
      >
        <BookOpen className={cn("w-3.5 h-3.5 shrink-0", isLightMode ? "text-slate-400" : "text-[#d5a94e]/80")} />
        <span className="flex-1 min-w-0 truncate text-left">{activeMs?.title || `Chapitre ${activeIdx + 1}`}</span>
        <span className={cn("shrink-0 text-[9px] font-mono font-bold tabular-nums", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>
          {done}/{total}
        </span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 shrink-0 transition-transform",
            isLightMode ? "text-slate-400" : "text-[#6e7784]",
            open && "rotate-180"
          )}
        />
      </button>
      {/* PANEL */}
      {open && (
        <>
          <button
            type="button"
            aria-label="Fermer la liste des chapitres"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <ul
            role="listbox"
            className={cn(
              "absolute left-3 right-3 top-full mt-1.5 z-50 max-h-[42vh] overflow-y-auto rounded-xl border py-1 shadow-2xl",
              isLightMode ? "bg-white border-slate-200" : "bg-[#161b21] border-[#2a3646]"
            )}
          >
            {chapters.map((ms, idx) => {
              const msDone = doneByMs.get(ms.id)?.size ?? 0;
              const msTotal = ms.sequences.length;
              const isDone = msTotal > 0 && msDone >= msTotal;
              const isActive = ms.id === activeMsId;
              return (
                <li key={ms.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onSelectChapter(ms.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] transition-colors",
                      isActive
                        ? isLightMode
                          ? "bg-slate-100 text-slate-900"
                          : "bg-[#242c36] text-[#f2f0e9]"
                        : isLightMode
                          ? "text-slate-700 hover:bg-slate-50"
                          : "text-[#c4cad2] hover:bg-[#1f2733]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                        isDone
                          ? "bg-[#39bc95] text-black"
                          : isLightMode
                            ? "border border-slate-300"
                            : "border border-[#3a4d60]"
                      )}
                    >
                      {isDone && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </span>
                    <span className="shrink-0 opacity-70">{idx + 1}.</span>
                    <span className="min-w-0 flex-1 truncate">{ms.title || `Chapitre ${idx + 1}`}</span>
                    <span className={cn("shrink-0 text-[9px] font-mono font-bold tabular-nums", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>
                      {msDone}/{msTotal}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Progression du chapitre actif */}
      {activeMs && (
        <div className="mt-2 flex items-center gap-2">
          <span
            className={cn(
              "shrink-0 text-[9px] font-black uppercase tracking-[0.12em]",
              isLightMode ? "text-slate-400" : "text-[#6e7784]"
            )}
          >
            Chapitre {activeIdx + 1} / {chapters.length}
          </span>
          <div
            className={cn(
              "flex-1 h-1 rounded-full overflow-hidden",
              isLightMode ? "bg-slate-200" : "bg-[#1e2530]"
            )}
          >
            <div className="h-full bg-[#d5a94e] transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className={cn("shrink-0 text-[9px] font-mono font-bold tabular-nums", isLightMode ? "text-slate-600" : "text-[#969daa]")}>
            {done}/{total} · {pct}%
          </span>
        </div>
      )}
    </nav>
  );
}
