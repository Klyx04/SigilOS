"use client";

import React, { memo } from "react";
import { Check, Flag, BookmarkCheck, Lock, Info, DoorOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSequenceCoord, getItemTags, isDungeonSequence } from "./overlay-utils";
import { getAlignmentSet } from "@/lib/rush-helpers";
import type { RushSequence } from "@/types/rush-guide-types";

interface RushOverlayQuestListItemProps {
  seq: RushSequence;
  isDone: boolean;
  isBookmarked: boolean;
  isLightMode: boolean;
  onToggle: () => void;
  onBookmark: () => void;
  onOpenDetail: () => void;
  /** Membres (avatar + nom) qui ont posé le repère sur cette étape */
  bookmarkers?: { name: string; avatar?: string }[];
  /** Quête verrouillée tant que ses prérequis ne sont pas validés */
  isLocked?: boolean;
  /** Quêtes prérequis (cliquables pour y sauter) */
  prereqs?: { seqId: string; milestoneId: string; name: string }[];
  onGoToPrereq?: (seqId: string, milestoneId: string) => void;
  /** Ouvre la modale listant les membres en attente ici (avatars cliquables). */
  onOpenBookmarkers?: () => void;
}

/**
 * Ligne compacte d'une quête dans la liste.
 * Montre : checkbox · icône · titre · coord · badge DJ · compteur ressources · repère · chevron
 * Tout le détail va dans le panneau accordéon (RushOverlayQuestPanel).
 */
export const RushOverlayQuestListItem = memo(function RushOverlayQuestListItem({
  seq,
  isDone,
  isBookmarked,
  isLightMode,
  onToggle,
  onBookmark,
  onOpenDetail,
  bookmarkers = [],
  isLocked = false,
  prereqs = [],
  onGoToPrereq,
  onOpenBookmarkers,
}: RushOverlayQuestListItemProps) {
  const parsedCoord = getSequenceCoord(seq);
  const itemTags = getItemTags(seq.activityTags);
  const hasDungeon = isDungeonSequence(seq);
  const name = seq.subGuideName || seq.subGuideRef || "—";
  const alignmentSet = getAlignmentSet(seq);
  const alignLabel = alignmentSet
    ? alignmentSet.camp === "brakmarien"
      ? "Brakmarien"
      : alignmentSet.camp === "bontarien"
      ? "Bontarien"
      : alignmentSet.camp
    : null;
  // Lien externe prioritaire : DofusPourLesNoobs, sinon DofusDB.
  const externalUrl = seq.dofuspourlesnoobsUrl || seq.dofusdbUrl || null;
  const externalLabel = seq.dofuspourlesnoobsUrl ? "DofusPourLesNoobs" : "DofusDB";

  return (
    <div
      id={`overlay-seq-${seq.id}`}
      className={cn(
        "rounded-xl border transition-all overflow-hidden",
        // Priorité à « validé » : seul un repère posé sur une quête NON validée
        // déclenche la couleur dorée. Une quête validée reprend son style « done »
        // (le repère, s'il existait, a été retiré à la validation).
        isDone
          ? isLightMode
            ? "bg-slate-100/60 border-slate-200 opacity-60"
            : "bg-[#0e1014]/50 border-[#1e2530]/50 opacity-55"
          : isBookmarked
          ? isLightMode
            ? "bg-amber-100 border-amber-400 border-l-[3px] border-l-amber-500"
            : "bg-[#26200e] border-[#d5a94e]/60 border-l-[3px] border-l-[#d5a94e] shadow-[0_0_16px_rgba(213,169,78,0.14)]"
          : isLightMode
          ? "bg-white border-slate-200 hover:border-slate-300"
          : "bg-[#13161b] hover:bg-[#161c22] border-[#1e2530] hover:border-[#2a3646]"
      )}
    >
      {/* Ligne principale */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        {/* Checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isLocked) onToggle();
          }}
          disabled={isLocked}
          aria-label={isDone ? "Décocher la quête" : isLocked ? "Quête verrouillée par un prérequis" : "Marquer comme terminée"}
          className={cn(
            "shrink-0 focus-visible:outline-2 focus-visible:outline-[#39bc95] focus-visible:outline-offset-1 rounded",
            isLocked && "cursor-not-allowed"
          )}
        >
          <div
            className={cn(
              "w-4 h-4 rounded-md border flex items-center justify-center transition-all",
              isDone
                ? "bg-[#39bc95] border-[#39bc95] text-black"
                : isLocked
                ? isLightMode
                  ? "border-slate-200 bg-slate-100 text-slate-400"
                  : "border-[#2a3646] bg-[#0b0e12] text-[#5c6771]"
                : isLightMode
                ? "border-slate-300 bg-white hover:border-[#39bc95]"
                : "border-[#3a4d60] bg-[#0f1419] hover:border-[#39bc95]"
            )}
          >
            {isDone ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : isLocked ? <Lock className="w-2.5 h-2.5 stroke-[2.5]" /> : null}
          </div>
        </button>

        {/* Titre + 2e ligne — clic sur le titre = ouvrir la fiche externe (DPLN/DofusDB) */}
        <div className="flex-1 min-w-0">
          {externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={`Ouvrir la fiche sur ${externalLabel}`}
              className={cn(
                "block w-full text-left text-xs font-semibold leading-tight truncate transition-colors hover:underline",
                isDone
                  ? "line-through opacity-50"
                  : isLightMode
                  ? "text-slate-900 hover:text-[#d5a94e]"
                  : "text-[#e8e4da] hover:text-[#d5a94e]"
              )}
            >
              {name}
            </a>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail();
              }}
              title="Voir les détails"
              className={cn(
                "block w-full text-left text-xs font-semibold leading-tight truncate transition-colors cursor-pointer",
                isDone
                  ? "line-through opacity-50"
                  : isLightMode
                  ? "text-slate-900 hover:text-[#d5a94e]"
                  : "text-[#e8e4da] hover:text-[#d5a94e]"
              )}
            >
              {name}
            </button>
          )}

          {/* 2e ligne : indicateurs (chips harmonisés) */}
          {(parsedCoord || hasDungeon || itemTags.length > 0 || bookmarkers.length > 0 || alignmentSet) && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {alignmentSet && alignLabel && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 h-[18px] px-1.5 rounded text-[9px] font-bold",
                    isLightMode
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-[#2a2160]/80 text-[#a5b4fc]"
                  )}
                  title={`Quête d'alignement → ${alignLabel} ${alignmentSet.level}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={alignmentSet.camp === "brakmarien" ? "/ordres/brakmar.png" : "/ordres/bonta.png"}
                    alt=""
                    className="w-3 h-3 object-contain"
                  />
                  Alignement {alignLabel} {alignmentSet.level}
                </span>
              )}
              {parsedCoord && (
                <span
                  className={cn(
                    "inline-flex items-center h-[18px] px-1.5 rounded font-mono text-[9px] font-bold tabular-nums",
                    isLightMode
                      ? "bg-blue-100 text-blue-600"
                      : "bg-[#1a2d4a]/80 text-[#7baeff]"
                  )}
                  title={`Position : ${parsedCoord.raw}`}
                >
                  [{parsedCoord.x},{parsedCoord.y}]
                </span>
              )}
              {hasDungeon && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 h-[18px] px-1.5 rounded text-[9px] font-bold",
                    isLightMode
                      ? "bg-blue-100 text-blue-600"
                      : "bg-[#1a2d4a]/80 text-[#7baeff]"
                  )}
                  title="Donjon requis"
                >
                  <DoorOpen className="w-3 h-3" /> DJ
                </span>
              )}
              {itemTags.length > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center h-[18px] px-1.5 rounded text-[9px] font-bold",
                    isLightMode
                      ? "bg-amber-100 text-amber-700"
                      : "bg-[#2a2210]/80 text-[#d5a94e]"
                  )}
                  title={`${itemTags.length} ressource${itemTags.length > 1 ? "s" : ""} à prévoir`}
                >
                  📦 {itemTags.length}
                </span>
              )}
              {!isDone && bookmarkers.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenBookmarkers?.();
                  }}
                  title={bookmarkers.map((b) => b.name).join(", ")}
                  aria-label={`En attente ici : ${bookmarkers.map((b) => b.name).join(", ")}`}
                  className={cn(
                    "inline-flex items-center h-[18px] px-1.5 rounded text-[9px] font-bold border transition-colors",
                    isLightMode
                      ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                      : "bg-[#2a2210]/80 border-[#d5a94e]/30 text-[#d5a94e] hover:bg-[#3a2a0e]/80"
                  )}
                >
                  <span className="flex items-center -space-x-1">
                    {bookmarkers.slice(0, 3).map((b, i) =>
                      b.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={b.avatar}
                          alt={b.name}
                          loading="lazy"
                          className="w-4 h-4 rounded-full border border-[#d5a94e]/40 object-cover"
                        />
                      ) : (
                        <span
                          key={i}
                          className="w-4 h-4 rounded-full border border-[#d5a94e]/40 bg-[#d5a94e]/20 text-[#d5a94e] flex items-center justify-center text-[8px] font-bold uppercase"
                        >
                          {b.name.charAt(0) || "?"}
                        </span>
                      )
                    )}
                  </span>
                  <span className="ml-0.5">📍 {bookmarkers.length}</span>
                </button>
              )}
            </div>
          )}
          {isLocked && prereqs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[#e2726f]">
                <Lock className="w-2.5 h-2.5" /> À terminer avant :
              </span>
              {prereqs.map((p) => (
                <button
                  key={p.seqId}
                  type="button"
                  onClick={() => onGoToPrereq?.(p.seqId, p.milestoneId)}
                  className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors",
                    isLightMode
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      : "bg-[#3a2a0e]/80 text-[#d5a94e] hover:bg-[#4b3512]"
                  )}
                  title={`Aller à : ${p.name}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Repère */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isLocked && !isDone) onBookmark();
          }}
          disabled={isLocked || isDone}
          aria-label={isDone ? "Quête déjà validée" : isBookmarked ? "Retirer le repère" : isLocked ? "Repère indisponible (prérequis)" : "Poser le repère ici"}
          title={isDone ? "Quête déjà validée — repère désactivé" : isBookmarked ? "Repère posé ici" : isLocked ? "Repère indisponible (prérequis non terminés)" : "Je suis ici"}
          className={cn(
            "p-1 rounded-lg transition-colors shrink-0",
            (isLocked || isDone) && "opacity-40 cursor-not-allowed",
            isBookmarked && !isDone
              ? isLightMode
                ? "text-amber-600 bg-amber-100"
                : "text-[#d5a94e] bg-[#d5a94e]/10"
              : isLightMode
              ? "text-slate-300 hover:text-amber-500"
              : "text-[#8b95a0] hover:text-[#d5a94e]"
          )}
        >
          {isBookmarked && !isDone ? <BookmarkCheck className="w-3.5 h-3.5" /> : isLocked ? <Lock className="w-3.5 h-3.5" /> : <Flag className="w-3.5 h-3.5" />}
        </button>

        {/* Accordéon */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail();
          }}
          aria-label="Détails"
          title="Voir tous les détails (donjons, ressources, conseils)"
          className={cn(
            "p-1 rounded-lg transition-colors shrink-0 flex items-center gap-0.5",
            isLightMode
              ? "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              : "text-[#8b95a0] hover:text-[#f2f0e9] hover:bg-[#1f2733]"
          )}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});
