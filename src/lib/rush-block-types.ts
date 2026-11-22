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

// ─── Bandeaux de SÉQUENCE (dans un bloc, entre deux quêtes) ───────────────────
/**
 * Une **séquence** peut porter un bandeau, exactement comme les blocs ci-dessus,
 * sans migration : le marqueur vit dans `activityTags` (JSON).
 *
 * ⚠️ Ne PAS réutiliser `combat_tactique` : c'est **déjà** le tag d'une quête qui
 * comporte un combat tactique (studio, seed, `rush-guide-view` le prouve : la quête
 * reste cochable). Un bandeau de séquence se marque donc avec un tag **dédié** :
 * `{ type: "sequence_banner", kind: "combat_tactique" | "combat_semi_tactique" }`.
 * Le conseil garde son tag historique `info_sequence`.
 *
 * Invariant : une séquence qui porte un de ces marqueurs n'est **jamais cochable** et
 * ne compte pas dans la progression (`isInfoSequence` lit la même table).
 */
export const RUSH_INFO_SEQUENCE_TAG = "info_sequence" as const;
export const RUSH_SEQUENCE_BANNER_TAG = "sequence_banner" as const;
export const RUSH_COMBAT_SEQUENCE_TAGS = ["combat_tactique", "combat_semi_tactique"] as const;
export type RushCombatSequenceTag = (typeof RUSH_COMBAT_SEQUENCE_TAGS)[number];
export type RushSequenceBannerKind = "none" | typeof RUSH_INFO_SEQUENCE_TAG | RushCombatSequenceTag;

/** Signature **structurelle** : seuls `type` et `kind` sont lus (aucun cast). */
export type RushTaggedSequence = {
  activityTags?: ReadonlyArray<{ type?: string | null; kind?: string | null }> | null;
};

function isCombatSequenceKind(kind: string | null | undefined): kind is RushCombatSequenceTag {
  return kind === "combat_tactique" || kind === "combat_semi_tactique";
}

/** Ce tag est-il un **marqueur de bandeau** (conseil ou combat) ? */
export function isRushSequenceBannerMarker(
  tag: { type?: string | null; kind?: string | null } | null | undefined
): boolean {
  if (!tag) return false;
  if (tag.type === RUSH_INFO_SEQUENCE_TAG) return true;
  return tag.type === RUSH_SEQUENCE_BANNER_TAG && isCombatSequenceKind(tag.kind ?? null);
}

/** Type de **bloc** Combat correspondant au marqueur de séquence (`null` sinon). */
export function rushCombatSequenceType(
  seq: RushTaggedSequence | null | undefined
): RushCombatBlockType | null {
  const tags = seq?.activityTags;
  if (!Array.isArray(tags)) return null;
  for (const tag of tags) {
    if (tag?.type === RUSH_SEQUENCE_BANNER_TAG && isCombatSequenceKind(tag.kind ?? null)) {
      return tag.kind as RushCombatBlockType;
    }
  }
  return null;
}

/** Bandeau choisi pour une séquence (studio) : `none` s'il n'y a aucun marqueur. */
export function rushSequenceBannerKind(
  seq: RushTaggedSequence | null | undefined
): RushSequenceBannerKind {
  const tags = seq?.activityTags;
  if (!Array.isArray(tags)) return "none";
  for (const tag of tags) {
    if (tag?.type === RUSH_INFO_SEQUENCE_TAG) return RUSH_INFO_SEQUENCE_TAG;
    if (tag?.type === RUSH_SEQUENCE_BANNER_TAG && isCombatSequenceKind(tag.kind ?? null)) {
      return tag.kind as RushCombatSequenceTag;
    }
  }
  return "none";
}

/**
 * Tag à écrire pour un choix du studio (les marqueurs existants sont remplacés) :
 * `null` = aucune bandeau. `color` est conservé pour la teinte du bandeau.
 */
export function rushSequenceBannerTag(
  kind: RushSequenceBannerKind,
  color?: string
): { type: string; kind?: string; color?: string } | null {
  if (kind === "none") return null;
  if (kind === RUSH_INFO_SEQUENCE_TAG) return { type: RUSH_INFO_SEQUENCE_TAG, color };
  return { type: RUSH_SEQUENCE_BANNER_TAG, kind, color };
}

