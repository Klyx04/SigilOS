"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Compass, ChevronDown, ChevronUp } from "lucide-react";
import type { RushSequence } from "@/types/rush-guide-types";
import { getSequenceCoord } from "@/lib/rush-guide-utils";
import { RushCoordinateChip } from "./RushCoordinateChip";
import { cn } from "@/lib/utils";

interface RushCurrentObjectiveProps {
  sequence: RushSequence;
  milestoneTitle?: string;
  variant?: "dashboard" | "overlay";
  className?: string;
  onNavigate?: () => void;
  /** Active le bouton replier / déplier (utile en overlay étroit pour libérer l'espace). */
  collapsible?: boolean;
  /** État initial replié. */
  defaultCollapsed?: boolean;
}

export function RushCurrentObjective({
  sequence,
  milestoneTitle,
  variant = "dashboard",
  className,
  onNavigate,
  collapsible = false,
  defaultCollapsed = false,
}: RushCurrentObjectiveProps) {
  const isOverlay = variant === "overlay";
  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);

  // Repli/dépli réactif à la taille de l'overlay (ex: petit panneau → replié).
  useEffect(() => {
    setCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);
  const name = sequence.subGuideName || sequence.subGuideRef;
  // Coordonnée source : pos_tags (édition GOD) > titre > tips > note.
  const parsedCoord = getSequenceCoord(sequence);

  return (
    <div
      className={cn(
        "relative rounded-xl border transition-all select-none overflow-hidden",
        "border-[#d5a94e]/40 bg-gradient-to-r from-[#d5a94e]/15 via-[#d5a94e]/5 to-transparent",
        isOverlay ? "p-3" : "p-3.5 sm:p-4",
        className
      )}
    >
      {/* En-tête Doré */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#e5c16e]">
          <Sparkles className="w-3.5 h-3.5 text-[#d5a94e] animate-pulse" />
          <span>À FAIRE MAINTENANT</span>
        </div>
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          {milestoneTitle && !collapsed && (
            <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[160px]">
              {milestoneTitle}
            </span>
          )}
          {collapsible && (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Développer l'objectif courant" : "Réduire l'objectif courant"}
              title={collapsed ? "Développer" : "Réduire"}
              className="shrink-0 p-1 rounded-md text-zinc-400 hover:text-[#e5c16e] hover:bg-white/5 transition-colors"
            >
              {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {collapsed ? (
        /* Mode replié : une ligne compacte (titre + coordonnées) pour libérer l'espace. */
        <div className="flex items-center justify-between gap-2">
          <p className={cn("font-bold text-[#f3e8cc] leading-snug truncate min-w-0", isOverlay ? "text-xs" : "text-sm")}>
            {name}
          </p>
          {parsedCoord ? (
            <RushCoordinateChip coordText={parsedCoord.raw} showIcon className="shrink-0" />
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn("font-bold text-[#f3e8cc] leading-snug", isOverlay ? "text-xs" : "text-sm")}>
              {name}
            </p>
            {sequence.tips && (
              <p className="text-[11px] text-zinc-300/90 mt-1 line-clamp-2 leading-relaxed">
                💡 {sequence.tips}
              </p>
            )}
          </div>

          {/* Action rapide : coordonnées — les liens Noobs/DofusDB sont dans la modale de détails */}
          <div className="flex items-center gap-1.5 shrink-0 mt-1 sm:mt-0">
            {parsedCoord && (
              <RushCoordinateChip coordText={parsedCoord.raw} showIcon />
            )}
          </div>
      </div>
      )}
    </div>
  );
}
