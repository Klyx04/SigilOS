"use client";

import React, { useMemo } from "react";
import { X, Sparkles, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { RushOverlayDungeonCard } from "./RushOverlayDungeonCard";
import { RushOverlayResourceList } from "./RushOverlayResourceList";
import { RushOverlayTagSection } from "./RushOverlayTagSection";
import { RushCoordinateChip } from "@/components/dofus-quests/rush/RushCoordinateChip";
import { classifyTags, getDungeons, getItemTags, getSequenceCoord, type TagClassification } from "./overlay-utils";
import { resolveDofusLocalImage } from "@/lib/dofus-image-url";

interface RushOverlayQuestDetailModalProps {
  milestone: RushMilestone;
  seq: RushSequence;
  isDone: boolean;
  isLightMode: boolean;
  guildId?: string;
  onClose: () => void;
}

/**
 * Modale « Détails » d'une quête — remplace l'ancien accordéon.
 */
export function RushOverlayQuestDetailModal({
  milestone,
  seq,
  isDone,
  isLightMode,
  guildId,
  onClose,
}: RushOverlayQuestDetailModalProps) {
  const tags = useMemo(() => classifyTags(seq.activityTags), [seq.activityTags]);
  // Badges affichés sans les donjons (déjà listés dans la carte « Donjon requis »).
  const badgesTags = useMemo<TagClassification>(() => {
    const hide = (t: { type: string }) => ["donjon", "ocre_dungeon", "dofus_link"].includes(t.type);
    return {
      nature: (tags.nature || []).filter((t) => !hide(t as any)),
      condition: (tags.condition || []).filter((t) => !hide(t as any)),
      tool: (tags.tool || []).filter((t) => !hide(t as any)),
    };
  }, [tags]);
  const dungeons = useMemo(() => getDungeons(seq), [seq]);
  const resources = useMemo(() => getItemTags(seq.activityTags), [seq.activityTags]);
  const coord = useMemo(() => getSequenceCoord(seq), [seq]);
  const name = seq.subGuideName || seq.subGuideRef || milestone.title;
  const noobsUrl = seq.dofuspourlesnoobsUrl;
  const dbUrl = seq.dofusdbUrl;
  const dofusImg = resolveDofusLocalImage(milestone.title) || resolveDofusLocalImage(name);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className={cn("fixed inset-0 bg-black/70 backdrop-blur-md", isLightMode && "bg-slate-900/50")}
      />
      <div
        className={cn(
          "relative z-10 flex flex-col w-full max-w-[420px] max-h-[85vh] rounded-2xl border overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150",
          isLightMode ? "bg-white border-slate-200" : "bg-[#111419] border-[#2a3646]"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-start justify-between gap-3 px-4 py-3.5 border-b shrink-0",
            isLightMode ? "border-slate-200" : "border-[#28303a]/70"
          )}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {dofusImg && (
              <div className="relative shrink-0 w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center p-1 shadow-sm">
                <img
                  src={dofusImg}
                  alt={milestone.title}
                  className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(230,185,107,0.4)]"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#e5c16e]">
                {!isDone && <Sparkles className="w-3 h-3 text-[#d5a94e]" />}
                <span>{isDone ? "Quête validée" : "Détails de la quête"}</span>
              </div>
              <h2 className={cn("mt-0.5 text-sm font-bold leading-snug truncate", isLightMode ? "text-slate-900" : "text-[#f2f0e9]")}>{name}</h2>
              <p className={cn("mt-0.5 text-[10px] truncate", isLightMode ? "text-slate-500" : "text-[#6e7784]")}>{milestone.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className={cn(
              "shrink-0 p-1.5 rounded-lg transition-colors cursor-pointer",
              isLightMode ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-[#6e7784] hover:text-red-400 hover:bg-[#1c2129]"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-3">
          {coord && (
            <section className="mb-4">
              <p className={cn("mb-1.5 text-[9px] font-black uppercase tracking-[0.14em]", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>📍 Position de lancement</p>
              <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2", isLightMode ? "bg-blue-50 border-blue-200" : "bg-[#111d2e] border-[#2a4a7a]/60")}>
                <MapPin className={cn("w-3.5 h-3.5 shrink-0", isLightMode ? "text-blue-600" : "text-[#7baeff]")} />
                <RushCoordinateChip
                  coordText={`[${coord.x},${coord.y}]`}
                  className={cn("h-[22px] px-2 rounded-lg text-[11px] font-mono font-bold tabular-nums", isLightMode ? "bg-transparent border-0 shadow-none text-blue-900" : "bg-transparent border-0 shadow-none text-[#c5d8f5]")}
                />
              </div>
            </section>
          )}

          {dungeons.length > 0 && (
            <section className={cn("border-t pt-3 mb-4", isLightMode ? "border-slate-200" : "border-[#1e2530]")}>
              <RushOverlayDungeonCard dungeons={dungeons} guildId={guildId} isLightMode={isLightMode} />
            </section>
          )}

          {resources.length > 0 && (
            <section className={cn("border-t pt-3 mb-4", isLightMode ? "border-slate-200" : "border-[#1e2530]")}>
              <RushOverlayResourceList items={resources} isLightMode={isLightMode} maxVisible={4} />
            </section>
          )}

          {(badgesTags.nature.length > 0 || badgesTags.condition.length > 0 || badgesTags.tool.length > 0) && (
            <section className={cn("border-t pt-3 mb-4", isLightMode ? "border-slate-200" : "border-[#1e2530]")}>
              <p className={cn("mb-1.5 text-[9px] font-black uppercase tracking-[0.14em]", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>Badges</p>
              <RushOverlayTagSection tags={badgesTags} isLightMode={isLightMode} />
            </section>
          )}

          {(seq.tips || seq.note || noobsUrl || dbUrl) && (
            <section className={cn("border-t pt-3", isLightMode ? "border-slate-200" : "border-[#1e2530]")}>
              <p className={cn("mb-1.5 text-[9px] font-black uppercase tracking-[0.14em]", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>Conseils & liens</p>
              <div className="space-y-2">
                {seq.tips && (
                  <div className={cn("rounded-lg border p-2.5 text-[11px] leading-relaxed", isLightMode ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-[#141a22] border-[#28303a]/60 text-[#b9c4cf]")}>💡 {seq.tips}</div>
                )}
                {seq.note && (
                  <div className={cn("rounded-lg border p-2.5 text-[11px] leading-relaxed", isLightMode ? "bg-slate-50 border-slate-200 text-slate-700" : "bg-[#10141a] border-[#28303a]/50 text-[#929aa5]")}>📝 {seq.note}</div>
                )}
                {(noobsUrl || dbUrl) && (
                  <div className="flex flex-wrap items-center gap-3 pt-0.5">
                    {noobsUrl && (
                      <a href={noobsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-500 hover:underline">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="https://www.google.com/s2/favicons?domain=dofuspourlesnoobs.com&sz=16" alt="" className="w-3 h-3 rounded-sm" />
                        DofusPourLesNoobs ↗
                      </a>
                    )}
                    {dbUrl && (
                      <a href={dbUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 hover:underline">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="https://www.google.com/s2/favicons?domain=dofusdb.fr&sz=16" alt="" className="w-3 h-3 rounded-sm" />
                        DofusDB ↗
                      </a>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
