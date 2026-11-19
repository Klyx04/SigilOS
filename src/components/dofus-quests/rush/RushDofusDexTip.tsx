"use client";

import { splitDofusDexTip } from "@/lib/rush-dofusdex-tip";
import type { RushQuestConstraints as RushQuestConstraintsModel } from "@/types/rush-constraints";
import { RushTipLines } from "./RushTipLines";

/**
 * Tips d'un bloc du Rush, **sans la section « DofusDex officiel »**.
 *
 * Demande user (19/11/2026, verbatim) : « je ne veux plus des dofusdex explicatifs dans les
 * guides c'est juste infect et inutile supprime ». La section (en-tête + une puce par
 * objectif, 13 à 51 lignes) n'est plus rendue ; le reste du tips — `Prérequis`,
 * `Donjons (étape N)` — reste affiché. Sans section officielle, le tips est rendu tel quel.
 */
export function RushDofusDexTip({
  text,
  constraints,
  className,
}: {
  text: string | null | undefined;
  constraints?: RushQuestConstraintsModel | null;
  className?: string;
}) {
  const { official, rest } = splitDofusDexTip(text);
  if (!official) return <RushTipLines text={text} constraints={constraints} className={className} />;
  // Le tips ne portait QUE le pavé : il ne reste rien à afficher.
  if (!rest.trim()) return null;
  return <RushTipLines text={rest} constraints={constraints} className={className} />;
}
