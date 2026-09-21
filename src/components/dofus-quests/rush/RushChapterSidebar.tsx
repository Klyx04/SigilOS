"use client";

import React, { useState, useMemo } from "react";
import { 
  Package, Sword, Users, Sparkles, ExternalLink, 
  Layers, Check, Copy, CheckCheck, DoorOpen
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { resolveItemImage, getMetierIconPath } from "@/lib/rush-guide-utils";
import { copyToClipboard } from "@/lib/clipboard";
import { ResourceImage } from "@/components/dofus-quests/ResourceImage";

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
  /** Pilotage externe du chapitre sélectionné (sync au clic d'un chapitre dans le feed). */
  selectedChapter?: number | "ALL";
  onSelectChapter?: (chapter: number | "ALL") => void;
}

export function RushChapterSidebar({
  milestones,
  completedSeqIds,
  activeMilestoneId,
  className,
  selectedChapter: selectedChapterProp,
  onSelectChapter,
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

  const [internalChapter, setInternalChapter] = useState<number | "ALL">(defaultChapter);
  const [hideCompletedItems, setHideCompletedItems] = useState(false);
  // Pilotage externe : si `selectedChapter` est fournie (clic d'un chapitre dans le
  // feed), la sidebar est « contrôlée » ; sinon comportement autonome (défaut auto).
  const selectedChapter = selectedChapterProp ?? internalChapter;
  const handleSelectChapter = (c: number | "ALL") => {
    setInternalChapter(c);
    onSelectChapter?.(c);
  };

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

    for (const ms of currentMilestones) {
      for (const seq of ms.sequences) {
        totalSequences++;
        if (completedSeqIds.has(seq.id)) {
          completedSequences++;
        }
      }
    }

    const percent = totalSequences > 0 ? Math.round((completedSequences / totalSequences) * 100) : 0;

    return {
      totalSequences,
      completedSequences,
      percent,
    };
  }, [currentMilestones, completedSeqIds]);

  // ─── S7 : « Ce qu'il faut prévoir » — donjons & métiers requis du chapitre ────
  // Dérivés des séquences déjà passées au composant (aucun fetch supplémentaire).
  const chapterDungeons = useMemo(() => {
    const seen = new Map<string, { id?: string; name: string; imageUrl?: string; bossName?: string }>();
    for (const ms of currentMilestones) {
      for (const seq of ms.sequences) {
        const list: { id?: string; name?: string; imageUrl?: string; bossName?: string }[] =
          seq.dungeons && seq.dungeons.length > 0 ? seq.dungeons : seq.dungeon ? [seq.dungeon] : [];
        for (const d of list) {
          if (d?.name) seen.set(d.name.trim().toLowerCase(), { id: d.id, name: d.name, imageUrl: (d as any).imageUrl, bossName: (d as any).bossName });
        }
        // donjons aussi via tag type "donjon"
        for (const tag of seq.activityTags || []) {
          if (tag.type === "donjon" && tag.name) seen.set(tag.name.trim().toLowerCase(), { name: tag.name });
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [currentMilestones]);

  const chapterMetiers = useMemo(() => {
    const seen = new Map<string, { name: string; level?: number }>();
    for (const ms of currentMilestones) {
      for (const seq of ms.sequences) {
        for (const tag of seq.activityTags || []) {
          if (tag.type === "metier" && tag.name) {
            const key = tag.name.trim().toLowerCase();
            if (!seen.has(key)) seen.set(key, { name: tag.name, level: tag.level });
          }
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [currentMilestones]);

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
                imageUrl: resolveItemImage(tag.id, tag.imageUrl),
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
        "flex flex-col gap-3.5 bg-surface p-4 rounded-[6px] border border-border",
        className
      )}
    >
      {/* Chapitres */}
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-foreground">Chapitres</span>
        </div>
        <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{chapters.length}</span>
      </div>

      {/* Rail des chapitres (scrollable) */}
      <div className="flex flex-col gap-1 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
        {chapters.map((ch) => {
          const allSeq = ch.milestones.flatMap((m) => m.sequences);
          const doneSeq = allSeq.filter((s) => completedSeqIds.has(s.id)).length;
          const pct = allSeq.length > 0 ? Math.round((doneSeq / allSeq.length) * 100) : 0;
          const active = selectedChapter === ch.chapter;
          const isDone = allSeq.length > 0 && doneSeq === allSeq.length;
          return (
            <button key={ch.chapter} type="button" onClick={() => handleSelectChapter(ch.chapter)}
              className={cn("w-full flex items-center gap-2.5 px-2 py-1.5 rounded-[4px] border transition-colors text-left",
                active ? "bg-elevated border-border" : "border-transparent hover:border-border")}>
              <span className={cn("w-5 h-5 shrink-0 rounded-[3px] flex items-center justify-center text-[11px] font-mono border",
                isDone ? "border-success text-success" : active ? "border-warning text-warning" : "border-border text-muted-foreground")}>{isDone ? <Check className="w-3 h-3" strokeWidth={2}/> : ch.chapter}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs text-foreground truncate">{ch.label}</span>
                <span className="block h-[3px] rounded-[2px] bg-elevated mt-1 overflow-hidden"><span className="block h-full rounded-[2px] bg-success" style={{ width: `${pct}%` }}/></span>
              </span>
              <span className="font-mono tabular-nums text-[11px] text-muted-foreground">{doneSeq}/{allSeq.length}</span>
            </button>
          );
        })}
      </div>
      {/* ─── Progression du Chapitre ─── */}
      <div className="flex items-center gap-4 bg-elevated p-3 rounded-[6px] border border-border">
        <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
          <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-border"
              strokeWidth="5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-success transition-all duration-300"
              strokeDasharray={`${stats.percent}, 100`}
              strokeWidth="5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute font-mono tabular-nums text-xs text-foreground">{stats.percent}%</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground">Progression</p>
          <p className="text-sm font-mono tabular-nums text-foreground truncate">
            {stats.completedSequences} / {stats.totalSequences}
            <span className="text-xs font-sans text-muted-foreground ml-1">quêtes</span>
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{currentChapterLabel}</p>
        </div>
      </div>

      {/* ─── Donjons & Métiers requis ─── */}
      {(chapterDungeons.length > 0 || chapterMetiers.length > 0) && (
        <div className="flex flex-col gap-2.5 bg-elevated p-3 rounded-[6px] border border-border">
            {chapterDungeons.length > 0 && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Donjons à prévoir</p>
                <div className="flex flex-col gap-1.5">
                  {chapterDungeons.map((d) => (
                    <span key={d.id || d.name} className="inline-flex items-center gap-2 text-xs text-foreground min-w-0 max-w-full">
                      {d.imageUrl ? (
                        /* Picto de boss/donjon du jeu, posé NU et LISIBLE (7 = 28 px). */
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.imageUrl} alt="" title={d.bossName || d.name} className="w-7 h-7 object-contain shrink-0" />
                      ) : (
                        <DoorOpen className="w-5 h-5 text-muted-foreground shrink-0" />
                      )}
                      <span className="min-w-0 break-words">{d.name}</span>
                      {d.bossName ? <span className="text-[10px] text-muted-foreground shrink-0 max-w-[45%] break-words">{d.bossName}</span> : null}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {chapterMetiers.length > 0 && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Métiers requis</p>
                <div className="flex flex-col gap-1.5">
                  {chapterMetiers.map((m) => (
                    <span key={m.name} className="inline-flex items-center gap-2 text-xs text-foreground min-w-0 max-w-full">
                      {/* Picto du métier réel (référentiel des 20 métiers), posé NU. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getMetierIconPath(m.name)} alt="" title={m.name} className="w-5 h-5 object-contain shrink-0" />
                      <span className="min-w-0 break-words">{m.name}</span>
                      {m.level ? <b className="font-mono font-medium text-muted-foreground shrink-0">{m.level}</b> : null}
                    </span>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* ─── Objets & Ressources nécessaires ─── */}
      <div className="flex flex-col gap-2 bg-elevated p-3 rounded-[6px] border border-border flex-1 min-h-0">
        <div className="flex flex-col gap-2 border-b border-border pb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <h4 className="text-xs text-foreground truncate min-w-0 flex-1">
              Objets requis
            </h4>
            <span className="font-mono tabular-nums text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
              ({aggregatedItems.length})
            </span>
          </div>
          {aggregatedItems.length > 0 && (
            <div className="grid grid-cols-2 gap-0.5 p-0.5 rounded-[4px] bg-surface border border-border">
              <button
                onClick={() => setHideCompletedItems(true)}
                className={cn("px-1.5 py-1 rounded-[3px] text-[11px] transition-colors text-center", hideCompletedItems ? "bg-success text-success-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Restantes
              </button>
              <button
                onClick={() => setHideCompletedItems(false)}
                className={cn("px-1.5 py-1 rounded-[3px] text-[11px] transition-colors text-center", !hideCompletedItems ? "bg-success text-success-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                Toutes
              </button>
            </div>
          )}
        </div>
        {aggregatedItems.length > 0 && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{hideCompletedItems ? "Encore requis" : "Total"}</span>
            <span className="font-mono tabular-nums text-foreground">{hideCompletedItems ? aggregatedItems.filter((it) => !it.isCompleted).length : aggregatedItems.length}</span>
          </div>
        )}

        {visibleItems.length > 0 ? (
          <div className="flex flex-col gap-1.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
            {visibleItems.map((item, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-between gap-2 p-1.5 rounded-[4px] border transition-colors text-xs",
                  item.isCompleted
                    ? "border-border opacity-40"
                    : "bg-surface border-border hover:border-foreground/20"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {item.imageUrl ? (
                    /* Ressource : asset du jeu posé NU (plus de tuile sous l'icône). */
                    <ResourceImage id={item.id} imageUrl={item.imageUrl} alt={item.name} className="w-6 h-6 object-contain shrink-0" />
                  ) : (
                    <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => { copyToClipboard(item.name).then((ok) => { if (ok) toast.success(`Nom copié : ${item.name}`, { duration: 1600 }); }); }}
                      title={`Copier le nom « ${item.name} »`}
                      aria-label={`Copier le nom ${item.name}`}
                      className={cn(
                        // Nom COMPLET (plus de `truncate`) : un objet Dofus porte parfois
                        // un nom long, et un nom mangé ne sert à rien.
                        "font-medium text-xs text-left block w-full max-w-full break-words",
                        item.isCompleted ? "line-through text-muted-foreground" : "text-foreground",
                        "hover:text-success transition-colors cursor-pointer"
                      )}
                    >
                      {item.name}
                    </button>
                    {item.level && (
                      <span className="text-[10px] font-mono text-muted-foreground block">Niv. {item.level}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      "font-mono tabular-nums text-xs px-1.5 py-0.5 rounded-[3px] border",
                      item.isCompleted
                        ? "border-border text-muted-foreground"
                        : "border-border text-foreground"
                    )}
                  >
                    {hideCompletedItems
                      ? `×${item.remainingQuantity}`
                      : `×${item.totalQuantity}`}
                  </span>
                  {item.isCompleted && (
                    <Check className="w-3.5 h-3.5 text-[#4fd1a5] shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-[#9aa7b4] text-xs">
            <Package className="w-6 h-6 mx-auto mb-1 opacity-30 text-[#e6b96b]" />
            <p className="font-bold">Aucune ressource répertoriée</p>
            <p className="text-[10px] text-[#78828f]">pour ce chapitre.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
