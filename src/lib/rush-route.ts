/**
 * Route d'alignement du Rush Sylvestre — **règle pure** (V-F / lot 5).
 *
 * Un seul guide, deux camps : chaque séquence peut déclarer `alignReq`
 * (`bontarien` | `brakmarien`). La route **filtre AVANT tout calcul** (vue, prérequis,
 * agrégation des ressources) : un prérequis masqué ne doit jamais bloquer une quête
 * visible — invariant n°1 du module.
 *
 * ⚠️ Le seuil legacy `alignOrderReq` (comparé à `alignmentLevel`) a été **retiré** le
 * 27/10/2026 (S5-1) : il valait `1` sur les 66 séquences qui le portaient, donc il ne
 * verrouillait rien. Le palier réel est `alignLevelReq` + `alignmentCountForCamp`.
 */

import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { normalizeOrderCode } from "@/lib/rush-order-codes";

export type RushAlignmentCamp = "bontarien" | "brakmarien";

export type RushRouteChoice = {
  /** Cité choisie par le joueur (profil, choix local, ou `null` s'il n'a rien choisi). */
  camp?: string | null;
  /** Code d'Ordre (6 valeurs). Ne filtre QUE les quêtes qui en portent un. */
  order?: string | null;
  /** Classe du personnage. Ne filtre QUE les quêtes de classe. */
  playerClass?: string | null;
  /** Palier d'alignement (calculé) — n'entre pas dans le filtre, il verrouille. */
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
  seq: Pick<RushSequence, "alignReq" | "alignOrderCode" | "classReq">,
  choice?: RushRouteChoice | string | null
): boolean {
  const route: RushRouteChoice = typeof choice === "string" ? { camp: choice } : (choice ?? {});

  // Étage 1 — cité.
  const rawCamp = (seq.alignReq ?? "").trim();
  if (rawCamp) {
    const required = normalizeAlignmentCamp(rawCamp);
    if (!required) return false; // fail-closed : cité inconnue
    const chosen = normalizeAlignmentCamp(route.camp);
    if (chosen && required !== chosen) return false;
  }

  // Étage 2 — Ordre : ne concerne que les quêtes qui en portent un.
  const rawOrder = (seq.alignOrderCode ?? "").trim().toLowerCase();
  if (rawOrder) {
    const chosenOrder = (route.order ?? "").trim().toLowerCase();
    if (chosenOrder) {
      // Deux vocabulaires ont cohabité dans `alignOrderCode` : le code canonique
      // (`coeur_vaillant`) et l'id court du référentiel de guilde (`vaillant`). On
      // compare les codes **ramenés au canonique** ; une valeur inconnue garde la
      // comparaison brute (fail-closed, on ne rend rien visible par consolation).
      const required = normalizeOrderCode(rawOrder) ?? rawOrder;
      const chosen = normalizeOrderCode(chosenOrder) ?? chosenOrder;
      if (required !== chosen) return false;
    }
  }

  // Classe : idem, uniquement les quêtes de classe.
  const rawClass = (seq.classReq ?? "").trim().toLowerCase();
  if (rawClass) {
    const chosenClass = (route.playerClass ?? "").trim().toLowerCase();
    if (chosenClass && rawClass !== chosenClass) return false;
  }

  return true;
}

/**
 * Applique la route : filtre les séquences, puis retire les blocs devenus vides.
 * Les bandeaux (`SEPARATEUR` / `INFO`) sont conservés : ce sont des repères de lecture.
 */
export function resolveRushRoute(
  milestones: RushMilestone[],
  choice?: RushRouteChoice | null
): RushMilestone[] {
  return milestones
    .map((ms) => ({ ...ms, sequences: ms.sequences.filter((seq) => isSequenceOnRoute(seq, choice)) }))
    .filter(
      (ms) =>
        ms.type === "SEPARATEUR" ||
        ms.type === "INFO" ||
        ms.sequences.length > 0
    );
}
