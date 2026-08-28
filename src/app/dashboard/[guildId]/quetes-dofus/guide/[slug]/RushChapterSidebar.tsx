"use client";

import React, { useState, useMemo } from "react";
import { 
  Package, Sword, Users, Sparkles, ExternalLink, 
  Layers, Check, Copy, CheckCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

type Sequence = {
  id: string;
  subGuideRef: string;
  subGuideName: string;
  isOptional: boolean;
  dungeon?: { id: string; name: string } | null;
  dungeons?: { id: string; name: string }[];
  activityTags?: Array<{
    type: string;
    name?: string;
    level?: number;
    count?: number;
    color?: string;
    url?: string;
    id?: string;
    imageUrl?: string;
    quantity?: number;
  }>;
};

type Milestone = {
  id: string;
  title: string;
  chapter: number;
  chapterLabel: string;
  accentColor?: string | null;
  sequences: Sequence[];
  type?: string;
};

interface RushChapterSidebarProps {
  milestones: Milestone[];
  completedSeqIds: Set<string>;
  activeMilestoneId?: string | null;
  className?: string;
}

export function RushChapterSidebar({
  milestones,
  completedSeqIds,
  activeMilestoneId,
  className,
}: RushChapterSidebarProps) {
  // Liste des chapitres distincts
  const chapters = useMemo(() => {
    const map = new Map<number, { chapter: number; label: string; milestones: Milestone[] }>();
    for (const ms of milestones) {
      if (ms.type === "SEPARATEUR" || ms.type === "INFO") continue;
      if (!map.has(ms.chapter)) {
        map.set(ms.chapter, {
          chapter: ms.chapter,
          label: ms.chapterLabel || `Chapitre ${ms.chapter}`,
          milestones: [],
        });
      }
      map.get(ms.chapter)!.milestones.push(ms);
    }
    return Array.from(map.values()).sort((a, b) => a.chapter - b.chapter);
  }, [milestones]);

  // Trouver le chapitre actif par défaut (celui qui contient activeMilestoneId ou le premier incomplet)
  const defaultChapter = useMemo(() => {
    if (activeMilestoneId) {
      const found = milestones.find((m) => m.id === activeMilestoneId);
      if (found) return found.chapter;
    }
    for (const ch of chapters) {
      const allSeq = ch.milestones.flatMap((m) => m.sequences);
      const isDone = allSeq.length > 0 && allSeq.every((s) => completedSeqIds.has(s.id));
      if (!isDone) return ch.chapter;
    }
    return chapters[0]?.chapter || 1;
  }, [activeMilestoneId, milestones, chapters, completedSeqIds]);

  const [selectedChapter, setSelectedChapter] = useState<number | "ALL">(defaultChapter);
  const [hideCompletedItems, setHideCompletedItems] = useState(false);

  // Milestones du chapitre sélectionné (ou tous)
  const currentMilestones = useMemo(() => {
    if (selectedChapter === "ALL") {
      return milestones.filter((m) => m.type !== "SEPARATEUR" && m.type !== "INFO");
    }
    return milestones.filter((m) => m.chapter === selectedChapter && m.type !== "SEPARATEUR" && m.type !== "INFO");
  }, [milestones, selectedChapter]);

  // Calcul des métriques du chapitre
  const stats = useMemo(() => {
    let totalSequences = 0;
    let completedSequences = 0;
    let dungeons = 0;
    let combatSolo = 0;
    let combatGroupe = 0;
    let tactique = 0;
    let metier = 0;

    for (const ms of currentMilestones) {
      for (const seq of ms.sequences) {
        totalSequences++;
        if (completedSeqIds.has(seq.id)) {
          completedSequences++;
        }
        for (const tag of seq.activityTags || []) {
          // Ne compte pas les donjons ici, on les comptera via seq.dungeons
          if (tag.type === "combat_solo") combatSolo++;
          if (tag.type === "combat_plusieurs" || tag.type === "plusieurs_personnes") combatGroupe++;
          if (tag.type === "combat_tactique" || tag.type === "combat_vagues") tactique++;
          if (tag.type === "metier") metier++;
        }
        // Donjons : depuis seq.dungeons (tableau) ou seq.dungeon (singulier)
        const seqAny = seq as any;
        const djList: unknown[] = seqAny.dungeons?.length > 0 ? seqAny.dungeons : (seqAny.dungeon ? [seqAny.dungeon] : []);
        dungeons += djList.length;
      }
    }

    const percent = totalSequences > 0 ? Math.round((completedSequences / totalSequences) * 100) : 0;

    return {
      totalSequences,
      completedSequences,
      percent,
      dungeons,
      combatSolo,
      combatGroupe,
      tactique,
      metier,
    };
  }, [currentMilestones, completedSeqIds]);

  // Calcul & Consolidation des objets nécessaires
  const aggregatedItems = useMemo(() => {
    const itemMap = new Map<
      string,
      {
        id?: string;
        name: string;
        totalQuantity: number;
        remainingQuantity: number;
        imageUrl?: string;
        level?: number;
        isCompleted: boolean;
      }
    >();

    for (const ms of currentMilestones) {
      for (const seq of ms.sequences) {
        const isSeqDone = completedSeqIds.has(seq.id);
        for (const tag of seq.activityTags || []) {
          if (tag.type === "item" && tag.name) {
            const key = tag.name.toLowerCase().trim();
            const qty = Number(tag.quantity || tag.count || 1);
            if (!itemMap.has(key)) {
              itemMap.set(key, {
                id: tag.id,
                name: tag.name,
                totalQuantity: 0,
                remainingQuantity: 0,
                imageUrl: tag.imageUrl,
                level: tag.level,
                isCompleted: true,
              });
            }
            const current = itemMap.get(key)!;
            current.totalQuantity += qty;
            if (!isSeqDone) {
              current.remainingQuantity += qty;
              current.isCompleted = false;
            }
            if (!current.imageUrl && tag.imageUrl) {
              current.imageUrl = tag.imageUrl;
            }
          }
        }
      }
    }

    return Array.from(itemMap.values()).sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return b.totalQuantity - a.totalQuantity;
    });
  }, [currentMilestones, completedSeqIds]);

  const visibleItems = useMemo(() => {
    if (hideCompletedItems) {
      return aggregatedItems.filter((it) => !it.isCompleted);
    }
    return aggregatedItems;
  }, [aggregatedItems, hideCompletedItems]);

  const currentChapterLabel = useMemo(() => {
    if (selectedChapter === "ALL") return "Tout le Guide";
    const found = chapters.find((c) => c.chapter === selectedChapter);
    return found?.label || `Chapitre ${selectedChapter}`;
  }, [chapters, selectedChapter]);

  return (
    <aside
      className={cn(
        "flex flex-col gap-4 bg-zinc-950/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-white/10 shadow-2xl transition-all",
        className
      )}
    >
      {/* ─── Sélecteur de Chapitre ─── */}
      <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Layers className="w-4 h-4 text-zinc-400 shrink-0" />
          <select
            value={selectedChapter}
            onChange={(e) => setSelectedChapter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
            aria-label="Sélectionner le chapitre"
            className="w-full bg-zinc-900/80 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-zinc-200 focus:outline-none focus:border-emerald-500/50 truncate cursor-pointer hover:bg-zinc-900 transition-colors"
          >
            {chapters.map((ch) => (
              <option key={ch.chapter} value={ch.chapter}>
                {ch.label}
              </option>
            ))}
            <option value="ALL">🌟 Tout le Guide (Global)</option>
          </select>
        </div>
      </div>

      {/* ─── Progression du Chapitre ─── */}
      <div className="flex items-center gap-4 bg-zinc-900/40 p-3.5 rounded-2xl border border-white/5">
        <div className="relative w-13 h-13 shrink-0 flex items-center justify-center">
          <svg className="w-13 h-13 transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-zinc-800/80"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-emerald-500 transition-all duration-500"
              strokeDasharray={`${stats.percent}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute font-mono font-bold text-xs text-white">{stats.percent}%</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Progression</p>
          <p className="text-sm font-bold text-zinc-100 truncate">
            {stats.completedSequences} / {stats.totalSequences}
            <span className="text-xs font-normal text-zinc-400 ml-1">quêtes</span>
          </p>
          <p className="text-[11px] text-zinc-500 truncate">{currentChapterLabel}</p>
        </div>
      </div>

      {/* ─── Synthèse & Infos du Chapitre ─── */}
      <div className="flex flex-col gap-2 bg-zinc-900/30 p-3 rounded-2xl border border-white/5">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Infos du chapitre</p>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-zinc-900/60 border border-white/5">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="text-xs">🏰</span> Donjons
            </span>
            <span className="font-mono font-bold text-zinc-200">{stats.dungeons}</span>
          </div>
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-zinc-900/60 border border-white/5">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="text-xs">⚔️</span> Solo
            </span>
            <span className="font-mono font-bold text-zinc-200">{stats.combatSolo}</span>
          </div>
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-zinc-900/60 border border-white/5">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="text-xs">👥</span> Groupe
            </span>
            <span className="font-mono font-bold text-zinc-200">{stats.combatGroupe}</span>
          </div>
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-zinc-900/60 border border-white/5">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="text-xs">🧩</span> Tactique
            </span>
            <span className="font-mono font-bold text-zinc-200">{stats.tactique}</span>
          </div>
        </div>
      </div>

      {/* ─── Objets & Ressources nécessaires ─── */}
      <div className="flex flex-col gap-2 bg-zinc-900/30 p-3.5 rounded-2xl border border-white/5 flex-1 min-h-0">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-zinc-400" />
            <h4 className="text-[11px] font-black uppercase tracking-widest text-zinc-300">
              Objets nécessaires ({aggregatedItems.length})
            </h4>
          </div>
          {aggregatedItems.length > 0 && (
            <button
              onClick={() => setHideCompletedItems((v) => !v)}
              className="text-[10px] text-zinc-400 hover:text-zinc-200 font-bold uppercase tracking-wider transition-colors"
            >
              {hideCompletedItems ? "Tout voir" : "Masquer finis"}
            </button>
          )}
        </div>

        {visibleItems.length > 0 ? (
          <div className="flex flex-col gap-1.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
            {visibleItems.map((item, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-between gap-2 p-2 rounded-xl border transition-all text-xs",
                  item.isCompleted
                    ? "bg-zinc-950/30 border-white/5 opacity-40"
                    : "bg-zinc-900/60 border-white/5 hover:border-white/10"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {item.imageUrl ? (
                    <div className="w-7 h-7 rounded-lg bg-zinc-950 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.imageUrl} alt={item.name} className="w-5.5 h-5.5 object-contain" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                      <Package className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "font-semibold truncate text-xs",
                        item.isCompleted ? "line-through text-zinc-500" : "text-zinc-200"
                      )}
                      title={item.name}
                    >
                      {item.name}
                    </p>
                    {item.level && (
                      <span className="text-[10px] text-zinc-500 block">Niv. {item.level}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      "font-mono font-bold text-xs px-2 py-0.5 rounded-md",
                      item.isCompleted
                        ? "bg-zinc-900 text-zinc-500"
                        : "bg-zinc-800 text-zinc-200 border border-white/10"
                    )}
                  >
                    {hideCompletedItems
                      ? item.remainingQuantity
                      : item.totalQuantity}
                  </span>
                  {item.isCompleted && (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-zinc-500 text-xs">
            <Package className="w-6 h-6 mx-auto mb-1 opacity-30" />
            <p className="font-bold">Aucune ressource répertoriée</p>
            <p className="text-[10px] text-zinc-600">pour ce chapitre.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
