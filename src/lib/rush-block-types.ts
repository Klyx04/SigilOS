/**
 * Règles pures des **types de bloc** du Rush Sylvestre (12/11/2026).
 *
 * Deux types sont ajoutés : `COMBAT_TACTIQUE` et `COMBAT_SEMI_TACTIQUE`. Ce sont
 * des blocs d'**information** (comme `INFO`) : ils ne portent pas de quête, ne se
 * cochent pas et ne comptent pas dans la progression. Cette règle est la **source
 * unique** utilisée par les trois surfaces (dashboard, guide public, overlay) et
 * par le studio — sans elle, chaque écran filtrerait les types à sa façon.
 */

import type { RushMilestoneType } from "@/types/rush-guide-types";

export const RUSH_COMBAT_BLOCK_TYPES = ["COMBAT_TACTIQUE", "COMBAT_SEMI_TACTIQUE"] as const;
export type RushCombatBlockType = (typeof RUSH_COMBAT_BLOCK_TYPES)[number];

export type RushCombatBlockMeta = {
  type: RushCombatBlockType;
  /** Libellé de la palette du studio. */
  label: string;
  /** Sceau du bandeau (« COMBAT TACTIQUE », « SEMI-TACTIQUE »). */
  kicker: string;
  /** Illustration par défaut du bloc (remplaçable par `imageUrl` dans le studio). */
  image: string;
  /** Teinte de la DA, jamais une couleur de composant. */
  accent: string;
  /** Filet de registre (token sémantique). */
  rail: "success" | "warning";
};

export const RUSH_COMBAT_BLOCK_META: Record<RushCombatBlockType, RushCombatBlockMeta> = {
  COMBAT_TACTIQUE: {
    type: "COMBAT_TACTIQUE",
    label: "Combat tactique",
    kicker: "Combat tactique",
    image: "/assets/rush/blocks/combat-tactique.webp",
    accent: "#b8cf6a",
    rail: "success",
  },
  COMBAT_SEMI_TACTIQUE: {
    type: "COMBAT_SEMI_TACTIQUE",
    label: "Combat semi-tactique",
    kicker: "Combat semi-tactique",
    image: "/assets/rush/blocks/combat-semi-tactique.webp",
    accent: "#e3a63c",
    rail: "warning",
  },
};

export function isRushCombatBlock(type: string | null | undefined): type is RushCombatBlockType {
  return type === "COMBAT_TACTIQUE" || type === "COMBAT_SEMI_TACTIQUE";
}

export function rushCombatBlockMeta(type: string | null | undefined): RushCombatBlockMeta | null {
  return isRushCombatBlock(type) ? RUSH_COMBAT_BLOCK_META[type] : null;
}

/** Bloc d'information : le conseil historique (`INFO`) ou les deux blocs Combat. */
export function isRushInfoBlock(type: string | null | undefined): boolean {
  return type === "INFO" || isRushCombatBlock(type);
}

/**
 * Bloc **non cochable** et **sans quête** : conseil/tips, combat, séparateur,
 * bannière « Dofus obtenu ». C'est la liste qui pilote les compteurs de quêtes,
 * les filtres de recherche et l'affichage de la progression.
 */
export function isRushNonQuestBlock(type: string | null | undefined): boolean {
  return isRushInfoBlock(type) || type === "SEPARATEUR" || type === "DOFUS_OBTAINED";
}

/** Le type est-il l'un des deux nouveaux blocs (pour la palette / les tests) ? */
export function isRushCombatBlockType(type: RushMilestoneType | string): boolean {
  return isRushCombatBlock(type);
}
