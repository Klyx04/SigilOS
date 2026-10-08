"use client";

import React, { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNonCheckableBlock } from "@/lib/rush-guide-utils";
import type { RushMilestone } from "@/types/rush-guide-types";

/**
 * Les blocs d'un guide qui sont de VRAIES étapes (donc sélectionnables dans la navigation).
 * Un bloc non cochable — SÉPARATEUR, encart CONSEIL/TIPS, « Dofus obtenu » — n'est pas une
 * étape : il n'apparaît jamais dans le sélecteur de chapitres (pas de case, pas de « n/N »).
 * Il reste visible autrement : son bandeau dans le contenu, et la navigation précédent /
 * suivant s'y arrête.
 */
export function selectableChapters(chapters: RushMilestone[]): RushMilestone[] {
  return chapters.filter((ms) => !isNonCheckableBlock(ms));
}

interface RushOverlayChapterBarProps {
  chapters: RushMilestone[];
  activeMsId: string | undefined;
  onSelectChapter: (msId: string) => void;
  completedMsIds: Set<string>;
  doneByMs: Map<string, Set<string>>;
  isLightMode?: boolean;
  className?: string;
  /** Case « tout le chapitre » : le bloc courant se valide (ou se décoche) d'un clic. */
  onToggleChapter?: (ms: RushMilestone) => void;
  /** Bloc courant en cours d'écriture serveur : la case ne repart pas en double. */
  loading?: boolean;
  /** Dofus visé par le chapitre courant : icône + pastille « obtenu ». */
  dofus?: { imageUrl: string; label: string; done: boolean } | null;
}

/**
 * UNE barre de chapitre pour tout l'overlay (retour user du 08/10/2026).
 *
 * L'overlay empilait TROIS blocs pour dire la même chose — le sélecteur déroulant, une
 * barre « CHAPITRE n / N ──── n/N · x% », puis une troisième barre pour le bloc courant
 * (« ○ 1. Titre … x% » avec la case à cocher du chapitre). ~120 px de hauteur utile
 * perdus dans une fenêtre PiP.
 *
 * Cette barre unique porte les trois informations sur UNE rangée :
 *   · case à cocher « tout le chapitre » (à gauche) ;
 *   · titre + chevron (clic = recherche parmi les chapitres) ;
 *   · avancement chiffré (`n/N · x%`) et jauge fine collée au bas de la barre.
 *
 * Deux mentions disparaissent quand elles n'informent personne : « Chapitre 1 / 1 »
 * (un guide à un seul chapitre) et la jauge d'un bloc sans quête (séparateur, encart).
 */
export function RushOverlayChapterBar({
  chapters,
  activeMsId,
  onSelectChapter,
  completedMsIds,
  doneByMs,
  isLightMode = false,
  className,
  onToggleChapter,
  loading = false,
  dofus = null,
}: RushOverlayChapterBarProps) {
  const [open, setOpen] = useState(false);
  if (chapters.length === 0) return null;

  // Les blocs SÉPARATEUR ne sont pas des étapes : ils n'entrent PAS dans la liste des
  // chapitres qu'on sélectionne (ni case à cocher, ni « n/N » — ils n'ont aucune quête).
  // Ils restent visibles autrement : bandeau du séparateur dans le contenu, et titre
  // affiché ici quand on est dessus.
  const selectable = selectableChapters(chapters);
  const canSelect = selectable.length > 0;

  const activeIdx = chapters.findIndex((ms) => ms.id === activeMsId);
  const activeMs = activeIdx >= 0 ? chapters[activeIdx] : chapters[0];
  // Position du bloc courant dans les CHAPITRES (les séparateurs ne sont pas numérotés :
  // sinon « Chapitre 12 » sauterait des numéros au gré des séparateurs intercalés).
  const chapterPos = activeMs ? selectable.findIndex((ms) => ms.id === activeMs.id) : -1;
  const done = activeMs ? (doneByMs.get(activeMs.id)?.size ?? 0) : 0;
  const total = activeMs ? activeMs.sequences.length : 0;
  const pct = activeMs
    ? total > 0
      ? Math.round((done / total) * 100)
      : completedMsIds.has(activeMs.id)
        ? 100
        : 0
    : 0;
  const msDone = activeMs ? completedMsIds.has(activeMs.id) : false;
  // La numérotation ne vaut que s'il y a plusieurs chapitres à distinguer.
  const showChapterCount = selectable.length > 1 && chapterPos >= 0;
  // Un bloc sans quête n'a AUCUNE progression à montrer : « 0/0 » n'est pas une
  // information, c'est du bruit.
  const showProgress = !!activeMs && total > 0;

  return (
    <nav
      aria-label="Chapitres du guide"
      className={cn(
        "relative shrink-0 px-3 py-2.5 border-b z-30",
        isLightMode ? "bg-slate-50 border-slate-200" : "bg-[#0d1014] border-[#28303a]/70",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {/* Case à cocher « tout le chapitre » — un `button` FRÈRE du déclencheur, jamais
            imbriqué dedans (HTML invalide, et le clic ouvrirait la liste). */}
        {activeMs && onToggleChapter && showProgress && (
          <button
            type="button"
            onClick={() => {
              if (!loading) onToggleChapter(activeMs);
            }}
            disabled={loading}
            aria-label={msDone ? "Marquer le chapitre comme non terminé" : "Marquer le chapitre comme terminé"}
            title={msDone ? "Décocher tout le chapitre" : "Valider tout le chapitre"}
            className={cn(
              "shrink-0 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1",
              isLightMode ? "focus-visible:outline-emerald-600" : "focus-visible:outline-[#39bc95]",
              loading && "cursor-not-allowed opacity-50"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-md border transition-all",
                msDone
                  ? "bg-[#39bc95] border-[#39bc95] text-black"
                  : isLightMode
                    ? "border-slate-300 bg-white"
                    : "border-[#3a4d60] bg-[#0f1419]"
              )}
            >
              {msDone && <Check className="h-2.5 w-2.5 stroke-[3]" />}
            </span>
          </button>
        )}

        {/* Déclencheur : titre du chapitre + avancement + chevron (liste déroulante) */}
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Choisir un chapitre"
          onClick={() => canSelect && setOpen((v) => !v)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-xl border font-semibold transition-colors",
            "px-2.5 py-2 text-[11px]",
            canSelect && "cursor-pointer",
            isLightMode
              ? "bg-white border-slate-200 text-slate-800 hover:border-slate-300"
              : "bg-[#181c22] border-[#28303a] text-[#f2f0e9] hover:border-[#2a3646]"
          )}
        >
          {/* Picto de QUÊTE du jeu (asset réel, 64 px servi en 16 px) : une quête/un chapitre
              se reconnaît à son picto, pas à un glyphe d'interface. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/dofus-ui/pictos/etape.png" alt="" className="h-4 w-4 shrink-0 object-contain" />
          <span className="min-w-0 flex-1 truncate text-left">
            {activeMs?.title || `Chapitre ${activeIdx + 1}`}
          </span>
          {/* Dofus visé par le bloc courant (icône Dofus + pastille quand il est obtenu) */}
          {dofus && (
            <span className="relative flex shrink-0 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dofus.imageUrl}
                alt={dofus.label}
                title={dofus.label}
                className={cn("h-5 w-5 object-contain drop-shadow", dofus.done && "animate-pulse")}
              />
              {dofus.done && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#39bc95]" />
              )}
            </span>
          )}
          {dofus?.done && (
            <span
              className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide",
                isLightMode
                  ? "border-emerald-600/40 bg-emerald-50 text-emerald-700"
                  : "border-[#39bc95]/50 bg-[#39bc95]/15 text-[#39bc95]"
              )}
            >
              Dofus obtenu
            </span>
          )}
          {showChapterCount && (
            <span
              className={cn(
                "hidden shrink-0 text-[9px] font-black uppercase tracking-[0.12em] sm:inline",
                isLightMode ? "text-slate-400" : "text-[#6e7784]"
              )}
            >
              Chapitre {chapterPos + 1} / {selectable.length}
            </span>
          )}
          {showProgress && (
            <span
              className={cn(
                "shrink-0 font-mono text-[9px] font-bold tabular-nums",
                isLightMode ? "text-slate-600" : "text-[#969daa]"
              )}
            >
              {done}/{total} · {pct}%
            </span>
          )}
          {canSelect && (
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform",
                isLightMode ? "text-slate-400" : "text-[#6e7784]",
                open && "rotate-180"
              )}
            />
          )}
        </button>
      </div>
      {/* Jauge fine collée au bas de la barre : la progression ne coûte plus une rangée
          entière (c'était le 2ᵉ des trois blocs empilés). */}
      {showProgress && (
        <span
          className={cn(
            "absolute inset-x-0 bottom-0 h-[3px] overflow-hidden",
            isLightMode ? "bg-slate-200" : "bg-[#1e2530]"
          )}
          aria-hidden="true"
        >
          <span
            className="block h-full bg-[#d5a94e] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </span>
      )}

      {/* PANEL */}
      {open && canSelect && (
        <>
          <button
            type="button"
            aria-label="Fermer la liste des chapitres"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <ul
            role="listbox"
            className={cn(
              "absolute top-full mt-1.5 z-50 max-h-[42vh] overflow-y-auto rounded-xl border py-1 shadow-2xl",
              "left-3 right-3",
              isLightMode ? "bg-white border-slate-200" : "bg-[#161b21] border-[#2a3646]"
            )}
          >
            {selectable.map((ms, idx) => {
              const msDoneCount = doneByMs.get(ms.id)?.size ?? 0;
              const msTotal = ms.sequences.length;
              const isDone = msTotal > 0 && msDoneCount >= msTotal;
              const isActive = ms.id === activeMsId;
              return (
                <li key={ms.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => {
                      onSelectChapter(ms.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 px-2.5 py-2 text-left text-[11px] transition-colors",
                      isActive
                        ? isLightMode
                          ? "bg-slate-100 text-slate-900"
                          : "bg-[#242c36] text-[#f2f0e9]"
                        : isLightMode
                          ? "text-slate-700 hover:bg-slate-50"
                          : "text-[#c4cad2] hover:bg-[#1f2733]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                        isDone
                          ? "bg-[#39bc95] text-black"
                          : isLightMode
                            ? "border border-slate-300"
                            : "border border-[#3a4d60]"
                      )}
                    >
                      {isDone && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </span>
                    <span className="shrink-0 opacity-70">{idx + 1}.</span>
                    <span className="min-w-0 flex-1 truncate">{ms.title || `Chapitre ${idx + 1}`}</span>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[9px] font-bold tabular-nums",
                        isLightMode ? "text-slate-400" : "text-[#6e7784]"
                      )}
                    >
                      {msDoneCount}/{msTotal}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </nav>
  );
}


