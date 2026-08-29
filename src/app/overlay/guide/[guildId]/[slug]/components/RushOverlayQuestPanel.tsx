"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { RushCurrentObjective } from "@/components/dofus-quests/rush/RushCurrentObjective";
import { RushOverlayDungeonCard } from "./RushOverlayDungeonCard";
import { RushOverlayResourceList } from "./RushOverlayResourceList";
import { RushOverlayTagSection } from "./RushOverlayTagSection";
import { classifyTags, getDungeons, getItemTags } from "./overlay-utils";

interface RushOverlayQuestPanelProps {
  milestone: RushMilestone;
  seq: RushSequence;
  isDone: boolean;
  isLightMode?: boolean;
  className?: string;
}

/**
 * Panneau de détail d'une séquence (accordéon) dans l'overlay.
 * - Objectif courant doré (si non terminé).
 * - Donjons requis (carte bleu acier, jamais rouge).
 * - Ressources "À PRÉVOIR" (liste verticale).
 * - Tags classifiés A / B / C.
 * - Liens DofusPourLesNoobs / DofusDB + conseils dans "Détails utiles".
 */
export function RushOverlayQuestPanel({
  milestone,
  seq,
  isDone,
  isLightMode = false,
  className,
}: RushOverlayQuestPanelProps) {
  const tags = useMemo(() => classifyTags(seq.activityTags), [seq.activityTags]);
  const dungeons = useMemo(() => getDungeons(seq), [seq]);
  const resources = useMemo(() => getItemTags(seq.activityTags), [seq.activityTags]);

  const noobsUrl = seq.dofuspourlesnoobsUrl;
  const dbUrl = seq.dofusdbUrl;
  const hasDetails = !!(seq.tips || seq.note || noobsUrl || dbUrl);

  return (
    <div
      className={cn(
        "px-3 pb-3 pt-1 border-t space-y-2",
        isLightMode ? "border-slate-100 bg-slate-50/70" : "border-[#1e2530] bg-[#0d1117]",
        className
      )}
    >
      {!isDone && <RushCurrentObjective sequence={seq} milestoneTitle={milestone.title} variant="overlay" />}

      <RushOverlayDungeonCard dungeons={dungeons} isLightMode={isLightMode} />

      <RushOverlayResourceList items={resources} isLightMode={isLightMode} />

      <RushOverlayTagSection tags={tags} isLightMode={isLightMode} />

      {hasDetails && (
        <details className="group">
          <summary
            className={cn(
              "flex cursor-pointer items-center gap-1 text-[10px] font-semibold transition-colors list-none",
              isLightMode ? "text-slate-500 hover:text-slate-700" : "text-[#6e7784] hover:text-[#969daa]"
            )}
          >
            <span className="group-open:rotate-90 transition-transform">›</span>
            Détails utiles
          </summary>

          <div className="mt-1.5 space-y-2">
            {seq.tips && (
              <p
                className={cn(
                  "text-[10px] leading-relaxed p-2 rounded-lg border",
                  isLightMode
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : "bg-[#141a22] border-[#28303a]/60 text-[#b9c4cf]"
                )}
              >
                💡 {seq.tips}
              </p>
            )}
            {seq.note && (
              <p
                className={cn(
                  "text-[10px] leading-relaxed p-2 rounded-lg border",
                  isLightMode ? "bg-slate-50 border-slate-200 text-slate-700" : "bg-[#10141a] border-[#28303a]/50 text-[#929aa5]"
                )}
              >
                📝 {seq.note}
              </p>
            )}
            {(noobsUrl || dbUrl) && (
              <div className="flex flex-wrap items-center gap-3 pt-0.5">
                {noobsUrl && (
                  <a
                    href={noobsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=16" alt="" className="w-3 h-3 rounded-sm" />
                    DofusPourLesNoobs ↗
                  </a>
                )}
                {dbUrl && (
                  <a
                    href={dbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:underline"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=16" alt="" className="w-3 h-3 rounded-sm" />
                    DofusDB ↗
                  </a>
                )}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
