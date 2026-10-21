/**
 * **Verrou de DONJONS par quête** — règle pure (Rush Sylvestre).
 *
 * Une quête peut exiger **plusieurs** donjons. Tant qu'un donjon **requis** n'est pas
 * coché, la quête **ne peut pas être validée**. Un donjon marqué **optionnel** ne bloque
 * rien : il reste affiché, décochable, et compte dans la préparation.
 *
 * 🎯 Trois invariants :
 *  · **Une seule source de vérité** pour lire les donjons d'une séquence : `getDungeons`
 *    (overlay-utils). Ce module ne réinvente pas la résolution, il ajoute le verrou.
 *  · **Clé stable** : `id` du donjon, sinon `slug`, sinon le nom normalisé. La coche est
 *    stockée par clé, pas par position dans le tableau.
 *  · **Fail-open mesuré** : un donjon **non identifiable** (ni id, ni slug, ni nom) est
 *    compté dans `unresolved` mais **ne bloque pas** — même doctrine que les prérequis
 *    introuvables : on signale, on ne fige pas une quête à vie sur une donnée absente.
 *
 * Pur : aucun state, aucun accès réseau. L'état des coches vient de la surface
 * (localStorage côté public, base côté guilde) — ce module ne sait pas d'où il vient.
 */

import type { RushMilestone, RushSequence } from "@/types/rush-guide-types";
import { getDungeons } from "@/app/overlay/guide/[guildId]/[slug]/components/overlay-utils";

/** Un donjon exigé par une quête, avec son état de coche. */
export type RushDungeonRequirement = {
  /** Clé stable de coche (`id` > `slug` > `nom:<nom normalisé>`). */
  key: string;
  /** Nom lisible ; jamais vide (repli « Donjon »). */
  name: string;
  /** Optionnel : affiché, mais ne bloque pas la validation. */
  isOptional: boolean;
  /** Donjon de la chasse à l'Ocre (badge dédié). */
  isOcre: boolean;
  /** Déjà coché par le joueur. */
  isDone: boolean;
};

export type RushDungeonResolution = {
  requirements: RushDungeonRequirement[];
  /** Donjons présents dans la donnée mais **sans identité exploitable**. */
  unresolved: number;
};

export type RushDungeonProgress = {
  /** Donjons identifiables de la quête. */
  total: number;
  /** Dont requis (non optionnels). */
  required: number;
  /** Dont cochés (tous confondus). */
  done: number;
  /** Clés des donjons **requis** non cochés : c'est ce qui bloque. */
  missingRequired: string[];
  /** Clés des donjons optionnels non cochés (informatif). */
  missingOptional: string[];
  unresolved: number;
  /** Tous les donjons **requis** sont cochés (vrai aussi sans donjon). */
  complete: boolean;
  /** La quête est verrouillée par au moins un donjon requis. */
  blocked: boolean;
};

/** Normalise un nom de donjon pour servir de clé de repli (stable, insensible à la casse). */
function normalizeDungeonName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Clé stable d'un donjon : `id` d'abord (clé Prisma), puis `slug` (lien public),
 * puis le nom normalisé. `null` si le donjon n'a aucune identité.
 */
export function dungeonKeyOf(dungeon: {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
}): string | null {
  const id = (dungeon.id ?? "").trim();
  if (id) return id;
  const slug = (dungeon.slug ?? "").trim();
  if (slug) return slug;
  const name = normalizeDungeonName(dungeon.name ?? "");
  return name ? `nom:${name}` : null;
}

/** Normalise l'entrée « coches » : `Set`, tableau ou itérable quelconque. */
function toSet(doneKeys?: Iterable<string> | null): Set<string> {
  if (!doneKeys) return new Set();
  if (doneKeys instanceof Set) return doneKeys;
  return new Set(doneKeys);
}

/**
 * Donjons exigés par une séquence, **dédupliqués par clé stable**, avec leur état.
 * Les donjons sans identité sont comptés dans `unresolved` et **écartés** (fail-open).
 */
export function resolveSequenceDungeons(
  seq: RushSequence,
  doneKeys?: Iterable<string> | null
): RushDungeonResolution {
  const done = toSet(doneKeys);
  const requirements: RushDungeonRequirement[] = [];
  const seen = new Set<string>();
  let unresolved = 0;

  for (const dungeon of getDungeons(seq)) {
    const key = dungeonKeyOf(dungeon);
    if (!key) {
      unresolved += 1;
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    requirements.push({
      key,
      name: dungeon.name ?? "Donjon",
      isOptional: dungeon.isOptional === true,
      isOcre: dungeon.isOcre === true,
      isDone: done.has(key),
    });
  }

  return { requirements, unresolved };
}

/**
 * État de progression des donjons d'une séquence.
 *
 * | Cas | `complete` | `blocked` |
 * |---|---|---|
 * | aucun donjon | `true` | `false` |
 * | tous les requis cochés | `true` | `false` |
 * | un requis manquant (même si les optionnels sont cochés) | `false` | `true` |
 * | seul un optionnel manque | `true` | `false` |
 */
export function sequenceDungeonProgress(
  seq: RushSequence,
  doneKeys?: Iterable<string> | null
): RushDungeonProgress {
  const { requirements, unresolved } = resolveSequenceDungeons(seq, doneKeys);

  const required = requirements.filter((r) => !r.isOptional);
  const missingRequired = required.filter((r) => !r.isDone).map((r) => r.key);
  const missingOptional = requirements.filter((r) => r.isOptional && !r.isDone).map((r) => r.key);

  return {
    total: requirements.length,
    required: required.length,
    done: requirements.filter((r) => r.isDone).length,
    missingRequired,
    missingOptional,
    unresolved,
    complete: missingRequired.length === 0,
    blocked: missingRequired.length > 0,
  };
}

/** La quête est-elle verrouillée par au moins un donjon **requis** non coché ? */
export function isSequenceBlockedByDungeons(
  seq: RushSequence,
  doneKeys?: Iterable<string> | null
): boolean {
  return sequenceDungeonProgress(seq, doneKeys).blocked;
}

/**
 * Coche / décoche une clé de donjon — **idempotent**.
 * Retourne un tableau **trié** (stockage stable, comparaisons simples côté surface).
 */
export function toggleDungeonKey(
  doneKeys: Iterable<string> | null | undefined,
  key: string
): string[] {
  const next = toSet(doneKeys);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return [...next].sort();
}

/** État manuel d'un donjon **dans une quête donnée** : « fait » ou « à faire ». */
export type RushDungeonState = "done" | "todo";

/** Un endroit du guide où le donjon apparaît. */
export type RushDungeonOccurrence = {
  milestoneId: string;
  milestoneTitle: string;
  chapter: number;
  sequenceId: string;
  sequenceName: string;
  /** Dans CETTE quête, le donjon est optionnel. */
  isOptional: boolean;
};

/** Entrée de l'index « tous les donjons du guide et leurs endroits ». */
export type RushDungeonIndexEntry = {
  key: string;
  name: string;
  isOcre: boolean;
  occurrences: RushDungeonOccurrence[];
  /** Nombre d'endroits (une quête = un endroit, jamais deux fois). */
  places: number;
  /** Endroits où le donjon est **requis** (c'est ce qui verrouille). */
  requiredPlaces: number;
};

/**
 * Index des donjons du guide, **dédoublonné par clé stable**.
 *
 * ⚠️ Le donjon est global (il apparaît dans plusieurs quêtes), mais **la coche est par
 * occurrence** : la même caverne refaite pour deux quêtes se coche deux fois. L'index
 * sert donc uniquement à **lister les endroits**, pas à mutualiser l'état.
 */
export function buildDungeonIndex(milestones: RushMilestone[]): RushDungeonIndexEntry[] {
  const byKey = new Map<string, RushDungeonIndexEntry>();

  for (const milestone of milestones ?? []) {
    for (const sequence of milestone.sequences ?? []) {
      const { requirements } = resolveSequenceDungeons(sequence);
      for (const requirement of requirements) {
        let entry = byKey.get(requirement.key);
        if (!entry) {
          entry = {
            key: requirement.key,
            name: requirement.name,
            isOcre: requirement.isOcre,
            occurrences: [],
            places: 0,
            requiredPlaces: 0,
          };
          byKey.set(requirement.key, entry);
        }
        // Une quête = un endroit : jamais deux lignes pour la même séquence.
        if (entry.occurrences.some((o) => o.sequenceId === sequence.id)) continue;
        entry.occurrences.push({
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          chapter: milestone.chapter,
          sequenceId: sequence.id,
          sequenceName: sequence.subGuideName || sequence.subGuideRef || milestone.title,
          isOptional: requirement.isOptional,
        });
        entry.places += 1;
        if (!requirement.isOptional) entry.requiredPlaces += 1;
      }
    }
  }

  return [...byKey.values()];
}

/**
 * Clé d'une **occurrence** : un donjon dans une quête précise.
 *
 * C'est la seule clé qui a le droit de porter un état. Cocher « Caverne du Koulosse »
 * dans la quête A ne dit **rien** de la quête B qui demande le même donjon.
 */
export function dungeonOccurrenceKey(sequenceId: string, dungeonKey: string): string {
  return `${sequenceId}::${dungeonKey}`;
}

/** Carte des états : clé = `sequenceId::dungeonKey`. */
export type RushDungeonStateMap = Readonly<Record<string, RushDungeonState>>;

/** État d'une occurrence, ou `null` (pas encore décidé). */
export function occurrenceState(
  states: RushDungeonStateMap | null | undefined,
  sequenceId: string,
  dungeonKey: string
): RushDungeonState | null {
  if (!states) return null;
  return states[dungeonOccurrenceKey(sequenceId, dungeonKey)] ?? null;
}

/** Occurrence enrichie de son état — ce que l'écran « Donjons » affiche. */
export type RushDungeonOccurrenceView = RushDungeonOccurrence & {
  state: RushDungeonState | null;
};

export type RushDungeonEntryView = Omit<RushDungeonIndexEntry, "occurrences"> & {
  occurrences: RushDungeonOccurrenceView[];
  /** Endroits déjà cochés « fait ». */
  donePlaces: number;
  /** Endroits marqués « à faire ». */
  todoPlaces: number;
};

/** Applique les états **par occurrence** à l'index. */
export function applyDungeonStates(
  index: RushDungeonIndexEntry[],
  states: RushDungeonStateMap | null | undefined
): RushDungeonEntryView[] {
  return index.map((entry) => {
    const occurrences = entry.occurrences.map((occurrence) => ({
      ...occurrence,
      state: occurrenceState(states, occurrence.sequenceId, entry.key),
    }));
    return {
      ...entry,
      occurrences,
      donePlaces: occurrences.filter((o) => o.state === "done").length,
      todoPlaces: occurrences.filter((o) => o.state === "todo").length,
    };
  });
}

/**
 * Clés des donjons **faits** pour UNE quête — c'est ce que le verrou de validation
 * consomme (`isSequenceBlockedByDungeons`).
 */
export function doneDungeonKeysForSequence(
  states: RushDungeonStateMap | null | undefined,
  sequenceId: string
): string[] {
  if (!states) return [];
  const prefix = `${sequenceId}::`;
  return Object.entries(states)
    .filter(([key, state]) => state === "done" && key.startsWith(prefix))
    .map(([key]) => key.slice(prefix.length))
    .sort();
}
