"use client";

import { constraintsToInfos, isEmptyConstraints, parseRushConstraints } from "@/lib/rush-constraints";
import { cn } from "@/lib/utils";

import type { RushQuestConstraints as RushQuestConstraintsModel } from "@/types/rush-constraints";

import { RushQuestConstraints } from "./RushQuestConstraints";
import { RushRichText, splitTipLines } from "./RushRichText";

/**
 * Conseils en puces — SOURCE UNIQUE des conseils & notes pour l'overlay (modale de détail,
 * vue de jeu), le dashboard (blocs repliables), le guide public et l'aperçu du studio.
 *
 * Deux sources, un seul rendu :
 *   · `constraints` (donnée structurée du studio) → chips illustrées, le texte des anciennes
 *     lignes de condition est retiré des puces ;
 *   · sinon, les lignes `Joueurs : …` / `Métier : …` / `Horaire : …` / `Sort : …` / `Note : …`
 *     de `tips` sont relues par le parseur (reprise des données existantes).
 * Aucune de ces infos ne bloque la validation d'une quête.
 */
export function RushTipLines({
  text,
  constraints,
  className,
}: {
  text: string | null | undefined;
  constraints?: RushQuestConstraintsModel | null;
  className?: string;
}) {
  const parsed = parseRushConstraints(text);
  const structured =
    constraints && !isEmptyConstraints(constraints) ? constraintsToInfos(constraints) : [];
  const chips = structured.length > 0 ? structured : parsed.constraints;
  const lines = splitTipLines(parsed.rest);
  if (chips.length === 0 && lines.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {chips.length > 0 && <RushQuestConstraints constraints={chips} />}
      {lines.length > 0 && (
        <ul className="space-y-1.5">
          {lines.map((line, index) => (
            <li key={index} className="flex items-start gap-1.5">
              <span
                aria-hidden="true"
                className="mt-[0.4rem] h-1 w-1 shrink-0 rounded-full bg-warning"
              />
              {/* `min-w-0` obligatoire : `RushRichText` rend un `span.contents`, qui ne peut pas
                  rétrécir seul dans une puce en flex. */}
              <span className="min-w-0">
                <RushRichText text={line} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
