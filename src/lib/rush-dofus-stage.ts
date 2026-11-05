/**
 * Stades du Dofus — **règle pure** de la frise de l'en-tête.
 *
 * La maquette « Gouache Wakfu » affiche cinq losanges et le nom du stade atteint
 * sous la jauge de progression : c'est la même échelle pour tous les blocs, seul
 * le pourcentage décide. Les seuils sont ceux de la maquette validée
 * (`pct<2 → Graine`, `<25 → Pousse`, `<45 → Jeune pin`, `<75 → Pin`, sinon Grand pin).
 *
 * Aucune donnée n'est inventée : ce sont des paliers d'affichage, pas une règle
 * métier du guide. Le libellé est le seul texte affiché (le nom du stade).
 */

export const RUSH_DOFUS_STAGES = ["Graine", "Pousse", "Jeune pin", "Pin", "Grand pin"] as const;

export type RushDofusStageName = (typeof RUSH_DOFUS_STAGES)[number];

export type RushDofusStage = {
  /** 0 → 4 (Graine → Grand pin). */
  index: number;
  label: RushDofusStageName;
};

/** Seuils de passage au stade suivant, en pourcentage de progression. */
export const RUSH_DOFUS_STAGE_STEPS = [2, 25, 45, 75] as const;

/** Nombre de losanges de la frise : un par stade. */
export const RUSH_DOFUS_STAGE_COUNT = RUSH_DOFUS_STAGES.length;

/** Stade atteint pour un pourcentage donné (borné à 0–100, jamais `NaN`). */
export function dofusStage(percent: number): RushDofusStage {
  // `NaN` ⇒ 0 ; ±Infinity ⇒ borné (100 / 0), jamais rejeté au premier stade.
  const safe = Number.isNaN(percent) ? 0 : percent;
  const pct = Math.min(100, Math.max(0, safe));
  let index = 0;
  for (const threshold of RUSH_DOFUS_STAGE_STEPS) {
    if (pct >= threshold) index += 1;
  }
  return { index, label: RUSH_DOFUS_STAGES[index] };
}
