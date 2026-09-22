"use client";

import React, { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNonCheckableBlock } from "@/lib/rush-guide-utils";
import type { RushMilestone } from "@/types/rush-guide-types";

interface RushOverlayChapterTreeProps {
  chapters: RushMilestone[];
  activeMsId: string | undefined;
  onSelectChapter: (msId: string) => void;
  completedMsIds: Set<string>;
  doneByMs: Map<string, Set<string>>;
  isLightMode?: boolean;
  className?: string;
  /**
   * `panel` (défaut) = barre de navigation complète (chrome + barre de progression),
   * montée en haut de l'overlay. `inline` = **le même sélecteur** sans le chrome, pour la
   * vue de jeu compacte : changer de chapitre doit rester possible **à tout moment**,
   * y compris pendant un combat (retour user 21/09/2026), et le mode compact ne propose
   * sinon que « Précédent / Suivant » — qui **sautent** les chapitres déjà validés.
   */
  variant?: "panel" | "inline";
}

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

/**
 * Navigation chapitres — DROPDOWN CUSTOM (fini le <select> natif).
 */
export function RushOverlayChapterTree({
  chapters,
  activeMsId,
  onSelectChapter,
  completedMsIds,
  doneByMs,
  isLightMode = false,
  className,
  variant = "panel",
}: RushOverlayChapterTreeProps) {
  const [open, setOpen] = useState(false);
  const isInline = variant === "inline";
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

  const tree = (
    <>
      {/* Déclencheur */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choisir un chapitre"
        onClick={() => canSelect && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border font-semibold transition-colors cursor-pointer",
          // En ligne (vue de jeu) le même déclencheur se lit comme un chip : la fenêtre
          // compacte n'a pas la place d'un contrôle de barre de navigation.
          isInline ? "px-2 py-1 text-[10px]" : "px-2.5 py-2 text-[11px]",
          isLightMode
            ? "bg-white border-slate-200 text-slate-800 hover:border-slate-300"
            : "bg-[#181c22] border-[#28303a] text-[#f2f0e9] hover:border-[#2a3646]"
        )}
      >
        {/* Picto de QUÊTE du jeu (asset réel, 64 px servi en 16 px) : une quête/un chapitre
            se reconnaît à son picto, pas à un glyphe d'interface. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/dofus-ui/pictos/etape.png" alt="" className="h-4 w-4 shrink-0 object-contain" />
        <span className="flex-1 min-w-0 truncate text-left">{activeMs?.title || `Chapitre ${activeIdx + 1}`}</span>
        {/* Un bloc sans quête (séparateur, encart d'info) n'a AUCUNE progression à montrer :
            « 0/0 » n'est pas une information, c'est du bruit. */}
        {total > 0 && (
          <span className={cn("shrink-0 text-[9px] font-mono font-bold tabular-nums", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>
            {done}/{total}
          </span>
        )}
        {canSelect && (
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 shrink-0 transition-transform",
              isLightMode ? "text-slate-400" : "text-[#6e7784]",
              open && "rotate-180"
            )}
          />
        )}
      </button>
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
              // En ligne (vue de jeu) le déclencheur est déjà dans le cadre : la liste
              // s'aligne sur lui au lieu de déborder du panneau.
              isInline ? "left-0 right-0" : "left-3 right-3",
              isLightMode ? "bg-white border-slate-200" : "bg-[#161b21] border-[#2a3646]"
            )}
          >
            {selectable.map((ms, idx) => {
              const msDone = doneByMs.get(ms.id)?.size ?? 0;
              const msTotal = ms.sequences.length;
              const isDone = msTotal > 0 && msDone >= msTotal;
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
                      "flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] transition-colors",
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
                    <span className={cn("shrink-0 text-[9px] font-mono font-bold tabular-nums", isLightMode ? "text-slate-400" : "text-[#6e7784]")}>
                      {msDone}/{msTotal}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Progression du chapitre actif — seulement sur un vrai chapitre (des quêtes).
          Un séparateur n'a pas de progression : on n'affiche ni « 0/0 » ni une barre vide. */}
      {activeMs && total > 0 && chapterPos >= 0 && (
        <div className="mt-2 flex items-center gap-2">
          <span
            className={cn(
              "shrink-0 text-[9px] font-black uppercase tracking-[0.12em]",
              isLightMode ? "text-slate-400" : "text-[#6e7784]"
            )}
          >
            Chapitre {chapterPos + 1} / {selectable.length}
          </span>
          <div
            className={cn(
              "flex-1 h-1 rounded-full overflow-hidden",
              isLightMode ? "bg-slate-200" : "bg-[#1e2530]"
            )}
          >
            <div className="h-full bg-[#d5a94e] transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className={cn("shrink-0 text-[9px] font-mono font-bold tabular-nums", isLightMode ? "text-slate-600" : "text-[#969daa]")}>
            {done}/{total} · {pct}%
          </span>
        </div>
      )}
    </>
  );

  // Vue de jeu (compact) : le sélecteur seul, sans chrome de barre ni barre de progression
  // — la vue compacte affiche déjà « Étape n/m » et doit rester minuscule.
  if (isInline) {
    return <div className={cn("relative min-w-0", className)}>{tree}</div>;
  }

  return (
    <nav
      aria-label="Chapitres du guide"
      className={cn(
        "relative shrink-0 px-3 py-2.5 border-b z-30",
        isLightMode ? "bg-slate-50 border-slate-200" : "bg-[#0d1014] border-[#28303a]/70",
        className
      )}
    >
      {tree}
    </nav>
  );
}
