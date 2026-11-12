"use client";

import React, { useMemo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { isInfoSequence, rushChapterNumbers } from "@/lib/rush-guide-utils";
import type { RushMilestone } from "@/types/rush-guide-types";

/**
 * Sommaire des **blocs** — le langage du dock de l'overlay, en colonne.
 *
 * 🎯 Demande user du 12/11/2026 : « je veux que dans les guides navigateurs on ait tous
 * ces fameux blocs comme dans l'overlay ». Le sommaire listait les **chapitres** (5 sur
 * la route Bontarien) ; il liste désormais les **blocs** numérotés (54), avec le chapitre
 * en mention secondaire. Une seule source pour la numérotation : `rushChapterNumbers`
 * (bandeaux exclus) — le MÊME rang que l'en-tête des blocs et que l'overlay.
 *
 * Parité public ↔ interne : ce composant vit dans le registre partagé
 * (`src/components/dofus-quests/rush/`), comme `RushChapterSidebar`. Aucune donnée
 * propre : il ne lit que `milestones` et les étapes validées, tous deux déjà en mémoire.
 *
 * Règle de comptage (verrou `rush-info-sequence-banner`) : un encart `info_sequence` n'a
 * pas de case, il ne compte donc ni au numérateur ni au dénominateur.
 */
interface RushChapterNavProps {
  milestones: RushMilestone[];
  completedSeqIds: Set<string>;
  /** Bloc affiché, pour le repère `aria-current`. */
  selectedMilestoneId?: string | null;
  onSelectMilestone?: (milestoneId: string) => void;
  className?: string;
  /** Titre de la colonne. Le même mot que l'en-tête des blocs, jamais un libellé neuf. */
  heading?: string;
}

export function RushChapterNav({
  milestones,
  completedSeqIds,
  selectedMilestoneId,
  onSelectMilestone,
  className,
  heading = "Blocs",
}: RushChapterNavProps) {
  // Liste PLATE des blocs cochables, dans l'ordre du guide. `rushChapterNumbers`
  // exclut les bandeaux (SEPARATEUR / INFO / DOFUS_OBTAINED) et donne le même numéro
  // que l'en-tête de bloc — pas un index de boucle.
  const blocks = useMemo(() => {
    const numbers = rushChapterNumbers(milestones);
    return milestones
      .filter((ms) => numbers.has(ms.id))
      .map((ms) => ({ ms, number: numbers.get(ms.id)! }));
  }, [milestones]);

  if (blocks.length === 0) return null;

  return (
    <nav className={cn("da-guide-nav", className)} aria-label="Sommaire des blocs">
      <header>
        <strong>{heading}</strong>
        <span>{blocks.length}</span>
      </header>
      <ul>
        {blocks.map(({ ms, number }) => {
          const steps = ms.sequences.filter((s) => !isInfoSequence(s));
          const done = steps.filter((s) => completedSeqIds.has(s.id)).length;
          const total = steps.length;
          const isDone = total > 0 && done === total;
          const active = selectedMilestoneId === ms.id;
          return (
            <li key={ms.id}>
              <button
                type="button"
                onClick={() => onSelectMilestone?.(ms.id)}
                aria-current={active ? "true" : undefined}
                className="da-guide-nav-item"
              >
                <span className="da-medal" aria-hidden="true">
                  {isDone ? <Check className="h-3 w-3" strokeWidth={2.5} /> : number}
                </span>
                <span className="min-w-0">
                  <span className="da-dock-label">{ms.title}</span>
                  {/* Le chapitre reste une DONNÉE : il ne pilote plus la navigation,
                      il se lit en mention secondaire sous le nom du bloc. */}
                  <span className="da-guide-nav-sub">
                    {ms.chapterLabel || `Chapitre ${ms.chapter}`}
                  </span>
                </span>
                <span
                  className="da-plank"
                  data-size="mini"
                  role="img"
                  aria-label={`${done} quêtes validées sur ${total}`}
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
