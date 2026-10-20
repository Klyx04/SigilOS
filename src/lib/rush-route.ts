/**
 * Route d'alignement du Rush Sylvestre — **règle pure** (V-F / lot 5).
 *
 * Un seul guide, deux camps : chaque séquence peut déclarer `alignReq`
 * (`bontarien` | `brakmarien`). La route **filtre AVANT tout calcul** (vue, prérequis,
 * agrégation des ressources) : un prérequis masqué ne doit jamais bloquer une quête
 * visible — invariant n°1 du module.
 *
 * ⚠️ `alignOrderReq` est un **seuil de niveau** (il est comparé à `alignmentLevel`),
 * pas un code d'Ordre. Il ne sert donc PAS au filtrage : le guide doit montrer les
 * quêtes d'alignement à venir même si le niveau n'est pas encore atteint.
 */

import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";

export type RushAlignmentCamp = "bontarien" | "brakmarien";

export type RushRouteChoice = {
  /** Cité choisie par le joueur (profil, choix local, ou `null` s'il n'a rien choisi). */
  camp?: string | null;
  /** Code d'Ordre (6 valeurs) — conservé pour l'affichage, n'entre pas dans le filtre. */
  order?: string | null;
  /** Tranche / niveau d'alignement — sert au badge, pas au filtrage. */
  level?: number | null;
};

/** Normalise une valeur de camp (« bontarien », « Brâkmar », « BONTA »…). */
export function normalizeAlignmentCamp(value?: string | null): RushAlignmentCamp | null {
  const v = (value ?? "")
    .trim()
    .toLowerCase()
    // « Brâkmar » porte un accent : sans repli des diacritiques, il ne serait pas reconnu.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (v.startsWith("bont")) return "bontarien";
  if (v.startsWith("brak")) return "brakmarien";
  return null;
}

/**
 * Cette séquence appartient-elle à la route choisie ?
 *
 * | Cas | Résultat |
 * |---|---|
 * | aucune `alignReq` | **visible** (quête commune) |
 * | `alignReq` inconnu (valeur non reconnue) | **masquée** — fail-closed |
 * | aucun choix du joueur | **visible** (on ne vide pas le guide par défaut) |
 * | camp identique au choix | **visible** |
 * | camp opposé | **masquée** |
 */
export function isSequenceOnRoute(
  seq: Pick<RushSequence, "alignReq">,
  camp?: string | null
): boolean {
  const raw = (seq.alignReq ?? "").trim();
  if (!raw) return true;
  const required = normalizeAlignmentCamp(raw);
  if (!required) return false;
  const chosen = normalizeAlignmentCamp(camp);
  if (!chosen) return true;
  return required === chosen;
}

/**
 * Applique la route : filtre les séquences, puis retire les blocs devenus vides.
 * Les bandeaux (`SEPARATEUR` / `INFO`) sont conservés : ce sont des repères de lecture.
 */
export function resolveRushRoute(
  milestones: RushMilestone[],
  choice?: RushRouteChoice | null
): RushMilestone[] {
  const camp = choice?.camp ?? null;
  return milestones
    .map((ms) => ({ ...ms, sequences: ms.sequences.filter((seq) => isSequenceOnRoute(seq, camp)) }))
    .filter(
      (ms) =>
        ms.type === "SEPARATEUR" ||
        ms.type === "INFO" ||
        ms.sequences.length > 0
    );
}
