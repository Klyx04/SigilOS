"use client";

import { parseRushConstraints } from "@/lib/rush-constraints";
import { cn } from "@/lib/utils";

import { RushQuestConstraints } from "./RushQuestConstraints";
import { RushRichText, splitTipLines } from "./RushRichText";

/**
 * Conseils en puces — SOURCE UNIQUE des conseils & notes pour l'overlay (modale de détail,
 * vue de jeu), le dashboard (blocs repliables), le guide public et l'aperçu du studio.
 *
 * Les lignes de condition (`Joueurs : …`, `Métier : …`, `Horaire : …`, `Sort : …`,
 * `Note : …`) sont d'abord rendues en **infos illustrées** par `RushQuestConstraints`
 * (icônes Dofus réelles) ; le reste garde les puces historiques. Aucune de ces infos ne
 * bloque la validation d'une quête.
 */
export function RushTipLines({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const { constraints, rest } = parseRushConstraints(text);
  const lines = splitTipLines(rest);
  if (constraints.length === 0 && lines.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {constraints.length > 0 && <RushQuestConstraints constraints={constraints} />}
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
