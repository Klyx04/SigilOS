/**
 * **Données des étapes à variantes exclusives** — le guide de référence n'en porte
 * qu'une branche ; ce module déclare les variantes manquantes et la forme des tags.
 *
 * Mesure du 25/11/2026 sur la base locale : le guide contient « Le magnanime » (273)
 * et « Les ordres sont-ils les ordres ? » (311), mais pas leurs sœurs 272/274/312.
 * Le rendu et le comptage sont livrés ; ce plan fournit la donnée reproductible
 * (dry-run par défaut dans `scripts/add-rush-choice-variants.ts`).
 *
 * Convention **sans migration** : `choice_group` (id du groupe) + `choice_group_label`
 * et `choice_group_note` (textes de la carte), construits par `rush-choice-groups`.
 */

import {
  choiceGroupMetaTags,
  choiceGroupTag,
  stripChoiceGroupTags,
} from "@/lib/rush-choice-groups";
import type { RushActivityTag } from "@/types/rush-guide-types";

/** Une étape mesurée sur DPLN : une branche présente, N−1 variantes à ajouter. */
export type RushChoiceVariantDefinition = {
  /** Identifiant du groupe (55 / 66) — porté par le tag `choice_group`. */
  group: string;
  /** Quête déjà dans le guide qui sert de repère et de modèle de champs. */
  siblingName: string;
  /** Libellé éditable de la carte. */
  label: string;
  /** Note éditable de la carte (condition / explication). */
  note: string;
  /** Variantes à créer (nom officiel + id DofusDB). */
  variants: Array<{ name: string; questDbId: number }>;
};

/**
 * Les deux étapes mesurées le 27/10/2026 sur DPLN (étape 55 = 3 variantes, étape 66 =
 * 2). L'ordre des variantes suit l'ordre de lecture de DPLN.
 */
export const RUSH_CHOICE_VARIANTS: readonly RushChoiceVariantDefinition[] = [
  {
    group: "55",
    siblingName: "Le magnanime",
    label: "Étape 55 — choisissez votre variante",
    note: "Ces quêtes sont identiques, seul le nom change. Cochez celle que vous avez jouée.",
    variants: [
      { name: "Les kamas résolvent tout", questDbId: 274 },
      { name: "Assassinat effectué", questDbId: 272 },
    ],
  },
  {
    group: "66",
    siblingName: "Les ordres sont-ils les ordres ?",
    label: "Étape 66 — choisissez votre variante",
    note: "Ces quêtes sont identiques, seul le nom change. Cochez celle que vous avez jouée.",
    variants: [{ name: "On m'appelle l'Escargot", questDbId: 312 }],
  },
] as const;

/** Séquence minimale lue pour établir le plan (aucune dépendance Prisma). */
export type RushChoiceVariantSequence = {
  id: string;
  subGuideName: string;
  order: number;
  questDbIds: number[];
  activityTags?: unknown;
};

/** Mise à jour de tags d'une séquence existante (le groupe et les textes sont réécrits). */
export type RushChoiceVariantUpdate = {
  id: string;
  name: string;
  activityTags: RushActivityTag[];
  /** Décalage d'ordre éventuel (les variantes existantes suivent leurs voisines). */
  toOrder: number;
};

/** Variante à créer, dérivée du repère (le script copie les champs de route/donjons). */
export type RushChoiceVariantInsert = {
  name: string;
  questDbId: number;
  order: number;
  activityTags: RushActivityTag[];
};

export type RushChoiceVariantPlan = {
  group: string;
  sibling: { id: string; name: string; order: number } | null;
  updates: RushChoiceVariantUpdate[];
  inserts: RushChoiceVariantInsert[];
  /** Décalages d'ordre des séquences qui suivent le repère (hors variantes existantes). */
  shifts: Array<{ id: string; name: string; fromOrder: number; toOrder: number }>;
  /** Tout est déjà en place (rejeu : aucune écriture). */
  noop: boolean;
};

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function tagsOf(sequence: RushChoiceVariantSequence): RushActivityTag[] {
  return Array.isArray(sequence.activityTags)
    ? (sequence.activityTags as RushActivityTag[])
    : [];
}

/** JSON canonique (clés triées) — JSONB ne conserve pas l'ordre des clés. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Union de tags, sans doublon sémantique (les tags du repère passent en premier). */
function mergeTags(base: readonly RushActivityTag[], extra: readonly RushActivityTag[]): RushActivityTag[] {
  const seen = new Set<string>();
  const out: RushActivityTag[] = [];
  for (const tag of [...base, ...extra]) {
    const key = canonicalJson(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** Tags communs du groupe : remplace les trois tags de choix, garde le reste. */
export function choiceVariantTags(
  definition: RushChoiceVariantDefinition,
  currentTags: unknown
): RushActivityTag[] {
  return [
    ...(choiceGroupTag(definition.group) ?? []),
    ...choiceGroupMetaTags({ label: definition.label, note: definition.note }),
    ...stripChoiceGroupTags(currentTags),
  ];
}

/**
 * Plan **pur** d'une étape : repère, variantes existantes/manquantes, décalages.
 *
 * - une variante déjà présente (par `questDbIds` **ou** par nom exact) est mise à jour,
 *   jamais recréée ;
 * - les insertions prennent les ordres `repère + 1 … repère + n` ; les séquences
 *   suivantes sont décalées d'autant (aucun ordre en double) ;
 * - `noop` est vrai quand toutes les variantes existent et portent déjà le groupe et
 *   les textes — le script peut alors sortir sans écrire.
 */
export function planRushChoiceVariants(
  sequences: readonly RushChoiceVariantSequence[],
  definition: RushChoiceVariantDefinition
): RushChoiceVariantPlan {
  const sibling = sequences.find((sequence) => sameName(sequence.subGuideName, definition.siblingName)) ?? null;
  if (!sibling) {
    return {
      group: definition.group,
      sibling: null,
      updates: [],
      inserts: [],
      shifts: [],
      noop: false,
    };
  }

  const existingByQuestId = new Map<number, RushChoiceVariantSequence>();
  for (const sequence of sequences) {
    for (const questId of sequence.questDbIds ?? []) {
      if (!existingByQuestId.has(questId)) existingByQuestId.set(questId, sequence);
    }
  }

  const existingVariants = definition.variants
    .map((variant) => {
      const byId = existingByQuestId.get(variant.questDbId) ?? null;
      const byName = sequences.find((sequence) => sameName(sequence.subGuideName, variant.name)) ?? null;
      return { variant, sequence: byId ?? byName };
    })
    .filter((entry): entry is { variant: (typeof definition.variants)[number]; sequence: RushChoiceVariantSequence } =>
      Boolean(entry.sequence)
    );

  const existingVariantIds = new Set(existingVariants.map((entry) => entry.sequence.id));
  const missing = definition.variants.filter(
    (variant) => !existingVariants.some((entry) => entry.variant.questDbId === variant.questDbId)
  );

  const insertCount = missing.length;
  const updates: RushChoiceVariantUpdate[] = [];

  // Le repère : toujours re-taggé (idempotent), sans perdre ses autres tags.
  updates.push({
    id: sibling.id,
    name: sibling.subGuideName,
    activityTags: choiceVariantTags(definition, sibling.activityTags),
    toOrder: sibling.order,
  });

  // Une variante est la même quête : elle hérite des tags du repère (prérequis,
  // position, donjon, objets) que les runs antérieurs ou un import partiel auraient
  // pu omettre. Ses tags propres sont conservés (union, sans doublon).
  const siblingNonChoiceTags = stripChoiceGroupTags(sibling.activityTags);
  for (const entry of existingVariants) {
    updates.push({
      id: entry.sequence.id,
      name: entry.sequence.subGuideName,
      activityTags: choiceVariantTags(
        definition,
        mergeTags(siblingNonChoiceTags, tagsOf(entry.sequence))
      ),
      toOrder: entry.sequence.order,
    });
  }

  // Les insertions se posent APRÈS la dernière variante déjà présente (jamais dans
  // son ordre) : un rejeu partiel ne crée pas de collision d'ordre.
  const baseOrder = Math.max(
    sibling.order,
    ...existingVariants.map((entry) => entry.sequence.order)
  );
  const inserts: RushChoiceVariantInsert[] = missing.map((variant, index) => ({
    name: variant.name,
    questDbId: variant.questDbId,
    order: baseOrder + 1 + index,
    // Les variantes sont identiques : elles reprennent les tags du repère (prérequis,
    // position, donjon, objets…) et n'ajoutent que le groupe et les textes de carte.
    activityTags: choiceVariantTags(definition, sibling.activityTags),
  }));

  const shifts = sequences
    .filter(
      (sequence) =>
        sequence.id !== sibling.id &&
        !existingVariantIds.has(sequence.id) &&
        sequence.order > baseOrder
    )
    .map((sequence) => ({
      id: sequence.id,
      name: sequence.subGuideName,
      fromOrder: sequence.order,
      toOrder: sequence.order + insertCount,
    }));

  // `noop` : aucune création, et chaque update porte déjà exactement les tags voulus.
  // Comparaison **d'ensemble** : l'ordre des tags n'a pas de sens métier, et JSONB
  // normalise l'ordre des clés d'un objet (`{type,name}` peut revenir `{name,type}`).
  const canonicalTags = (tags: RushActivityTag[]) => tags.map(canonicalJson).sort().join("|");
  const tagsEqual = (a: RushActivityTag[], b: RushActivityTag[]) =>
    canonicalTags(a) === canonicalTags(b);
  const updatesNeeded = updates.some((update) => {
    const current = sequences.find((sequence) => sequence.id === update.id);
    return !current || !tagsEqual(tagsOf(current), update.activityTags) || update.toOrder !== current.order;
  });
  const noop = insertCount === 0 && !updatesNeeded;

  return {
    group: definition.group,
    sibling: { id: sibling.id, name: sibling.subGuideName, order: sibling.order },
    updates,
    inserts,
    shifts: insertCount === 0 ? [] : shifts,
    noop,
  };
}
