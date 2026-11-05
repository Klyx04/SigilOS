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
  className?: string;
  /** Case « tout le chapitre » : le bloc courant se valide (ou se décoche) d'un clic. */
  onToggleChapter?: (ms: RushMilestone) => void;
  /** Bloc courant en cours d'écriture serveur : la case ne repart pas en double. */
  loading?: boolean;
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
 *   · nœud « tout le chapitre » (à gauche) ;
 *   · médaillon + titre + chevron (clic = recherche parmi les chapitres) ;
 *   · compteur sur mini-écriteau et jauge fine collée au bas de la barre.
 *
 * DA « Gouache Wakfu » (E1e) : la barre est le `dock` de la maquette — barre pleine
 * largeur, médaillon 26 px, titre 13 px condensé qui passe à la ligne (jamais
 * tronqué), compteur sur planches 40 × 28, nœud rond au lieu d'un carré nu.
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
  className,
  onToggleChapter,
  loading = false,
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
      className={cn("da-dock", className)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* Case « tout le chapitre » — un `button` FRÈRE du déclencheur, jamais
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
              "da-node-btn shrink-0 cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
              loading && "cursor-not-allowed opacity-50"
            )}
          >
            {/* DA « Gouache Wakfu » : le nœud de la liste, pas un carré nu. */}
            <span className="da-node" data-state={msDone ? "done" : "todo"} aria-hidden="true">
              {msDone && <Check className="h-3 w-3 stroke-[3]" />}
            </span>
          </button>
        )}

        {/* Déclencheur : médaillon + titre du chapitre + compteur + chevron */}
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Choisir un chapitre"
          aria-current="true"
          onClick={() => canSelect && setOpen((v) => !v)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-[6px] px-1.5 py-1.5 text-left transition-colors motion-reduce:transition-none",
            canSelect && "cursor-pointer"
          )}
        >
          {/* Médaillon 26 px (DA) : le picto de QUÊTE du jeu, pas un glyphe. */}
          <span className="da-medal" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/dofus-ui/pictos/etape.png" alt="" className="h-4 w-4 object-contain" />
          </span>
          <span className="da-dock-label min-w-0 flex-1 text-left">
            {activeMs?.title || `Chapitre ${activeIdx + 1}`}
          </span>
          {showChapterCount && (
            <span
              className={cn(
                "hidden shrink-0 text-[9px] font-semibold uppercase tracking-[0.12em] sm:inline",
                "text-muted-foreground"
              )}
            >
              Chapitre {chapterPos + 1} / {selectable.length}
            </span>
          )}
          {/* Compteur + chevron dans un groupe collé à DROITE (`margin-left: auto`) :
              quand le titre passe à deux lignes en PiP étroite, il poussait le
              compteur au milieu de la barre (mesure du 05/11/2026). */}
          <span className="da-dock-trail">
            {showProgress && (
              <span
                className="da-plank shrink-0"
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
            )}
            {canSelect && (
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                  open && "rotate-180"
                )}
              />
            )}
          </span>
        </button>
      </div>
      {/* Jauge fine collée au bas de la barre : la progression ne coûte plus une rangée
          entière (c'était le 2ᵉ des trois blocs empilés). */}
      {showProgress && (
        <span
          className="absolute inset-x-0 bottom-0 h-[2px] bg-elevated"
          aria-hidden="true"
        >
          <span
            className="relative block h-full bg-gold transition-[width] duration-150 ease-out motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          >
            {pct > 0 && (
              <span className="absolute -right-[3px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rotate-45 bg-gold" />
            )}
          </span>
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
              "absolute top-full mt-1.5 z-50 max-h-[42vh] overflow-y-auto rounded-[6px] border py-1",
              "left-3 right-3",
              "border-border-strong bg-elevated"
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
                      "flex w-full cursor-pointer items-center gap-2 px-2.5 py-2 text-left text-[11px] transition-colors motion-reduce:transition-none",
                      isActive
                        ? "bg-surface text-foreground"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                        isDone
                          ? "bg-success text-background"
                          : "border border-border-strong"
                      )}
                    >
                      {isDone && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </span>
                    <span className="shrink-0 opacity-70">{idx + 1}.</span>
                    <span className="min-w-0 flex-1 truncate">{ms.title || `Chapitre ${idx + 1}`}</span>
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[9px] font-semibold tabular-nums",
                        "text-muted-foreground"
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


