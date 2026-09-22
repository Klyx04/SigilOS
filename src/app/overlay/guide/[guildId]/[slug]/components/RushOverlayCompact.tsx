"use client";

import React from "react";
import { Check, ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { RushOverlayChapterTree } from "./RushOverlayChapterTree";
import { RushOverlayMemberBubbles, type OverlayBubbleMember } from "./RushOverlayMemberBubbles";

/** Repli **stables** (jamais recréés à chaque rendu) quand l'appelant n'a pas de progression. */
const EMPTY_MS_IDS: Set<string> = new Set();
const EMPTY_DONE_BY_MS: Map<string, Set<string>> = new Map();

interface RushOverlayCompactProps {
  milestone: RushMilestone;
  objective: RushSequence | null;
  isDone: boolean;
  isLightMode?: boolean;
  /** Corps de remplacement (bannières du chapitre sans objectif restant) : prend la place de l'objectif. */
  body?: React.ReactNode;
  /**
   * Navigation chapitres — le sélecteur **partagé** (`RushOverlayChapterTree`, variante
   * `inline`), monté dans la vue de jeu pour pouvoir **changer de chapitre à tout moment** :
   * le mode compact n'offre sinon que « Précédent / Suivant », qui **sautent** les chapitres
   * déjà validés (retour user 21/09/2026 : « pour le chapitre faut pouvoir changer quand on
   * veut quand même »). Absent ⇒ le titre du bloc reste un simple texte.
   */
  chapters?: RushMilestone[];
  activeMsId?: string;
  onSelectChapter?: (msId: string) => void;
  completedMsIds?: Set<string>;
  doneByMs?: Map<string, Set<string>>;
  /** Membres ayant posé leur repère sur la quête courante (bulles + mini-modale). */
  bookmarkers?: OverlayBubbleMember[];
  onOpenBookmarkers?: () => void;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  onExpand: () => void;
  onClose: () => void;
  className?: string;
}

/**
 * Mode jeu compact — recommandé pendant une phase de combat.
 * Affiche uniquement : checkbox de la quête · nom · Étape n/m · objectif courant ·
 * précédent / suivant · agrandir · fermer.
 */
export function RushOverlayCompact({
  milestone,
  objective,
  isDone,
  isLightMode = false,
  body,
  chapters,
  activeMsId,
  onSelectChapter,
  completedMsIds,
  doneByMs,
  bookmarkers = [],
  onOpenBookmarkers,
  onToggle,
  onPrev,
  onNext,
  canPrev,
  canNext,
  onExpand,
  onClose,
  className,
}: RushOverlayCompactProps) {
  const name = objective?.subGuideName || objective?.subGuideRef || milestone.title || "—";
  const stepIdx = objective ? milestone.sequences.findIndex((s) => s.id === objective.id) : -1;
  const stepLabel = stepIdx >= 0 ? `${stepIdx + 1} / ${milestone.sequences.length}` : "";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-3",
        isLightMode ? "bg-white text-slate-900" : "bg-[#111419] text-[#f2f0e9]",
        className
      )}
    >
      {/* Ligne supérieure : checkbox · titre · actions */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Le bloc courant est toujours un CHAPITRE (les bannières ne sont pas des étapes) :
            la case à cocher a donc toujours un sens ici. */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={isDone ? "Décocher la quête" : "Marquer comme terminée"}
          className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-[#39bc95] focus-visible:outline-offset-1"
        >
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-md border transition-all",
              isDone
                ? "bg-[#39bc95] border-[#39bc95] text-black"
                : isLightMode
                  ? "border-slate-300 bg-white"
                  : "border-[#3a4d60] bg-[#0f1419]"
            )}
          >
            {isDone && <Check className="h-2.5 w-2.5 stroke-[3]" />}
          </span>
        </button>
        {/* Le titre du bloc est porté par le `body` (bannières) : pas de doublon. */}
        {!body && (
          <h2 className={cn("truncate text-sm font-bold leading-tight", isLightMode ? "text-slate-900" : "text-[#f2f0e9]")}>
            {name}
          </h2>
        )}

        <button
          type="button"
          onClick={onExpand}
          aria-label="Agrandir l'overlay"
          title="Agrandir"
          className={cn(
            "shrink-0 p-1.5 rounded-lg border transition-colors",
            isLightMode
              ? "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
              : "bg-[#181d23] border-[#2a3646] text-[#6e7784] hover:text-[#f2f0e9] hover:bg-[#1f2733]"
          )}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>

        {/* Fermer (seul X du mode compact) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'overlay"
          title="Fermer"
          className={cn(
            "shrink-0 p-1.5 rounded-lg border transition-colors",
            isLightMode
              ? "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
              : "bg-[#181d23] border-[#2a3646] text-[#6e7784] hover:text-red-400 hover:bg-[#1f2733]"
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Métadonnées : CHAPITRE (cliquable — « changer quand on veut ») · Étape n/m ·
          membres ici. Le chapitre reste affiché même quand un bandeau remplace l'objectif :
          sinon il ne resterait que Précédent/Suivant, qui sautent les chapitres validés. */}
      <div className="flex min-w-0 items-center gap-2">
        {chapters && onSelectChapter ? (
          <RushOverlayChapterTree
            variant="inline"
            chapters={chapters}
            activeMsId={activeMsId}
            onSelectChapter={onSelectChapter}
            completedMsIds={completedMsIds ?? EMPTY_MS_IDS}
            doneByMs={doneByMs ?? EMPTY_DONE_BY_MS}
            isLightMode={isLightMode}
            className="min-w-0 flex-1"
          />
        ) : (
          <p className={cn("min-w-0 flex-1 truncate text-[10px]", isLightMode ? "text-slate-500" : "text-[#929aa5]")}>
            {milestone.title}
          </p>
        )}
        {!body && stepLabel && (
          <span className={cn("shrink-0 text-[10px] tabular-nums", isLightMode ? "text-slate-500" : "text-[#929aa5]")}>
            {stepLabel}
          </span>
        )}
        {!isDone && bookmarkers.length > 0 && (
          <RushOverlayMemberBubbles
            members={bookmarkers}
            onOpen={() => onOpenBookmarkers?.()}
            size="md"
          />
        )}
      </div>

      {/* Objectif courant — ou le corps de remplacement (bandeau du séparateur).
          Pas d'encart doré « À FAIRE MAINTENANT » : le titre ci-dessus EST la quête
          courante (user, 21/09/2026). */}
      {body ? (
        body
      ) : !objective ? (
        <p className={cn("text-xs font-semibold", isLightMode ? "text-slate-500" : "text-[#929aa5]")}>
          {isDone ? "✓ Quête terminée" : "Toutes les étapes sont terminées."}
        </p>
      ) : null}

      {/* Actions précédent / suivant */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-20 transition-colors",
            isLightMode
              ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              : "border-[#28303a] bg-[#181e25] text-[#c4cad2] hover:bg-[#202732]"
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all disabled:opacity-20",
            "border-[#39bc95]/40 bg-[#39bc95]/15 hover:bg-[#39bc95]/25 text-[#2b9f7d] dark:text-[#74d6b6]"
          )}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
