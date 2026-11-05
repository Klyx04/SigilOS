"use client";

import React, { useMemo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { isInfoSequence } from "@/lib/rush-guide-utils";
import type { RushMilestone } from "@/types/rush-guide-types";

/**
 * Sommaire des chapitres — le langage du **dock** de l'overlay, en colonne.
 *
 * Parité public ↔ interne : ce composant vit dans le registre partagé
 * (`src/components/dofus-quests/rush/`), comme `RushChapterSidebar`. Le guide
 * public l'affiche dans sa colonne de gauche ; le guide interne le recevra à la
 * passation (E4). Aucune donnée propre : il ne lit que `milestones` et les
 * étapes validées, tous deux déjà en mémoire — AUCUNE requête neuve.
 *
 * Règle de comptage (verrou `rush-info-sequence-banner`) : un encart
 * `info_sequence` n'a pas de case, il ne compte donc ni au numérateur ni au
 * dénominateur.
 *
 * Différence avec `RushChapterSidebar` : celui-ci porte le sommaire **seul**
 * (médaillon + libellé + compteur), pour tenir dans 260 px à côté du contenu ;
 * le rail garde la progression, les donjons/métiers et les objets requis.
 */
interface RushChapterNavProps {
  milestones: RushMilestone[];
  completedSeqIds: Set<string>;
  /** Chapitre affiché, pour le repère `aria-current`. */
  selectedChapter?: number | "ALL";
  onSelectChapter?: (chapter: number | "ALL") => void;
  className?: string;
  /** Titre de la colonne. Le même mot que le rail, jamais un libellé neuf. */
  heading?: string;
}

export function RushChapterNav({
  milestones,
  completedSeqIds,
  selectedChapter,
  onSelectChapter,
  className,
  heading = "Chapitres",
}: RushChapterNavProps) {
  // Même découpage que `RushChapterSidebar` : les blocs SEPARATEUR et INFO ne
  // sont pas des chapitres, ils n'apparaissent pas au sommaire.
  const chapters = useMemo(() => {
    const map = new Map<number, { chapter: number; label: string; milestones: RushMilestone[] }>();
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

  if (chapters.length === 0) return null;

  return (
    <nav className={cn("da-guide-nav", className)} aria-label="Sommaire des chapitres">
      <header>
        <strong>{heading}</strong>
        <span>{chapters.length}</span>
      </header>
      <ul>
        {chapters.map((ch) => {
          const steps = ch.milestones.flatMap((m) => m.sequences.filter((s) => !isInfoSequence(s)));
          const done = steps.filter((s) => completedSeqIds.has(s.id)).length;
          const total = steps.length;
          const isDone = total > 0 && done === total;
          const active = selectedChapter === ch.chapter;
          return (
            <li key={ch.chapter}>
              <button
                type="button"
                onClick={() => onSelectChapter?.(ch.chapter)}
                aria-current={active ? "true" : undefined}
                className="da-guide-nav-item"
              >
                <span className="da-medal" aria-hidden="true">
                  {isDone ? <Check className="h-3 w-3" strokeWidth={2.5} /> : ch.chapter}
                </span>
                <span className="da-dock-label">{ch.label}</span>
                <span
                  className="da-plank"
                  data-size="mini"
                  role="img"
                  aria-label={`${done} étapes validées sur ${total}`}
                >
                  <i />
                  <b />
                  <span>
                    {done}/{total}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
