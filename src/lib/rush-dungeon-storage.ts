/**
 * **Persistance LOCALE des coches donjon** (guide public, sans compte) — règle pure.
 *
 * Le guide public n'a ni compte ni base : les états « fait » / « à faire » vivent dans
 * le `localStorage` du navigateur, sous la même clé de préfixe que le reste de la
 * progression invitée (`guestProgressPrefix`), suffixée `dungeons`. Un visiteur qui
 * déclare un personnage garde donc SES coches de donjons, comme ses étapes cochées.
 *
 * 🎯 Deux invariants :
 *  · **Clé par occurrence** (`sequenceId::dungeonKey`) : cocher un donjon dans la quête A
 *    ne dit rien de la quête B qui demande le même donjon (règle `rush-dungeons`).
 *  · **Fail-closed à la lecture** : un contenu illisible, une valeur inconnue ou une clé
 *    qui n'est pas une occurrence sont **écartés** — on ne devine jamais un état.
 *
 * Pur : aucun React, aucun accès réseau. Les accès `localStorage` sont gardés pour
 * rester inoffensifs au SSR (build ISR du guide public).
 */

import type { RushDungeonState } from "@/lib/rush-dungeons";

/** Suffixe de la 4ᵉ clé de progression invitée (voir `guest-progress.ts`). */
export const DUNGEON_STATES_SUFFIX = "dungeons";

/**
 * Plafond de sécurité : un guide réel porte quelques centaines d'occurrences.
 * Au-delà, la donnée est suspecte (stockage trafiqué) : on garde les premières.
 */
const MAX_ENTRIES = 2000;

/** Longueur maximale d'une clé d'occurrence (`sequenceId::dungeonKey`). */
const MAX_KEY_LENGTH = 200;

/** États locaux : clé = `sequenceId::dungeonKey`. */
export type LocalDungeonStates = Record<string, RushDungeonState>;

/** Clé de stockage complète pour un emplacement de progression. */
export function dungeonStatesStorageKey(progressPrefix: string): string {
  return `${progressPrefix}${DUNGEON_STATES_SUFFIX}`;
}

/** Une clé d'occurrence exploitable ? (elle doit porter l'identifiant de la quête) */
export function isDungeonOccurrenceKey(key: unknown): key is string {
  return (
    typeof key === "string" &&
    key.length > 0 &&
    key.length <= MAX_KEY_LENGTH &&
    key.includes("::")
  );
}

function isDungeonState(value: unknown): value is RushDungeonState {
  return value === "done" || value === "todo";
}

/**
 * Lit un contenu brut. **Fail-closed** : tout ce qui n'est pas reconnu est écarté
 * (JSON invalide ⇒ objet vide, jamais une exception).
 */
export function parseDungeonStates(raw: string | null | undefined): LocalDungeonStates {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const out: LocalDungeonStates = {};
  let kept = 0;
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (kept >= MAX_ENTRIES) break;
    if (!isDungeonOccurrenceKey(key)) continue;
    if (!isDungeonState(value)) continue;
    out[key] = value;
    kept += 1;
  }
  return out;
}

/** Sérialise pour le stockage (jamais `undefined` : `{}` est un état valide). */
export function serializeDungeonStates(states: LocalDungeonStates | null | undefined): string {
  return JSON.stringify(states ?? {});
}

/** États de l'emplacement courant (`{}` au SSR ou si rien n'est stocké). */
export function readDungeonStates(progressPrefix: string): LocalDungeonStates {
  if (typeof localStorage === "undefined") return {};
  try {
    return parseDungeonStates(localStorage.getItem(dungeonStatesStorageKey(progressPrefix)));
  } catch {
    return {};
  }
}

/**
 * Écrit UNE occurrence et retourne la carte à jour — `state === null` retire la ligne.
 * Cet état retourné est la source de vérité à passer au `useState` de la surface :
 * on ne relit jamais deux fois le stockage.
 */
export function writeDungeonState(
  progressPrefix: string,
  occurrenceKey: string,
  state: RushDungeonState | null
): LocalDungeonStates {
  const next = { ...readDungeonStates(progressPrefix) };
  if (!isDungeonOccurrenceKey(occurrenceKey)) return next;

  if (state === null) delete next[occurrenceKey];
  else next[occurrenceKey] = state;

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(dungeonStatesStorageKey(progressPrefix), serializeDungeonStates(next));
    } catch {
      /* stockage plein / navigation privée : on garde l'état en mémoire */
    }
  }
  return next;
}

/** Remise à zéro (bouton « Réinitialiser la progression » du guide public). */
export function clearDungeonStates(progressPrefix: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(dungeonStatesStorageKey(progressPrefix));
  } catch {
    /* fail-soft : la surface repart d'un état vide en mémoire */
  }
}
