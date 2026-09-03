"use client";

import React from "react";
import { Sparkles, ExternalLink, Compass } from "lucide-react";
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
}

export function RushCurrentObjective({
  sequence,
  milestoneTitle,
  variant = "dashboard",
  className,
  onNavigate,
}: RushCurrentObjectiveProps) {
  const isOverlay = variant === "overlay";
  const name = sequence.subGuideName || sequence.subGuideRef;
  // Coordonnée source : pos_tags (édition GOD) > titre > tips > note.
  const parsedCoord = getSequenceCoord(sequence);

  // Lien DofusPourLesNoobs ou DofusDB
  const noobsUrl = sequence.dofuspourlesnoobsUrl || (sequence.activityTags?.find(t => t.type === "dofus_link" && t.url?.includes("dofuspourlesnoobs"))?.url);
  const dofusdbUrl = sequence.dofusdbUrl || (sequence.activityTags?.find(t => t.type === "dofus_link" && t.url?.includes("dofusdb"))?.url);

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
        {milestoneTitle && (
          <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[200px]">
            {milestoneTitle}
          </span>
        )}
      </div>

      {/* Titre & Étape */}
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

        {/* Actions Rapides : Coordonnées & Liens */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0 mt-1 sm:mt-0">
          {parsedCoord && (
            <RushCoordinateChip coordText={parsedCoord.raw} showIcon />
          )}

          {noobsUrl && (
            <a
              href={noobsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-white/10 transition-colors"
              title="Ouvrir le guide DofusPourLesNoobs"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=16"
                alt="Noobs"
                className="w-3 h-3 rounded-sm"
              />
              <span>Noobs</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}

          {dofusdbUrl && (
            <a
              href={dofusdbUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-white/10 transition-colors"
              title="Ouvrir la fiche DofusDB"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=16"
                alt="DofusDB"
                className="w-3 h-3 rounded-sm"
              />
              <span>DofusDB</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
