/**
 * Verrou God des modules — **règle pure, une seule source**.
 *
 * Un module « verrouillé par le staff » (`GuildModules.disabledByGod`) est **OFF
 * effectif** quel que soit le toggle de la guilde (toggle **conservé** en BDD pour
 * une réactivation sans perte). Deux garanties :
 * - la liste des modules verrouillables est **dérivée** du registre
 *   (`DEFAULT_MODULES`) : elle ne peut plus dériver à la main (`commandes` manquait,
 *   audit du 24/09/2026) ;
 * - `admin` n'est **jamais** verrouillable (sinon l'admin perd le panneau qui lui
 *   explique pourquoi tout est éteint).
 *
 * Aucun `"use server"` ici : importable côté serveur, côté bot et côté client, et
 * testable en unitaire. Consommé par `module-actions.ts` (résolution + écriture),
 * `getUserContext` (permissions) et `internalCheckPermission` (interactions du bot).
 */

import { DEFAULT_MODULES, type GuildModulesState, type ModuleKey } from "@/lib/module-types";

/** Modules qu'un God peut couper pour une guilde — `admin` exclu. */
export const GOD_LOCKABLE_MODULES: readonly ModuleKey[] = (
    Object.keys(DEFAULT_MODULES) as ModuleKey[]
).filter((key) => key !== "admin");

export function isGodLockableModule(key: unknown): key is ModuleKey {
    return typeof key === "string" && (GOD_LOCKABLE_MODULES as readonly string[]).includes(key);
}

/**
 * Normalise un `disabledByGod` brut : ne garde que des clés verrouillables,
 * dédoublonnées, `admin` écarté. Toute lecture (UI God, guilde, bot) doit passer
 * par ici — c'est ce qui garantit que le verrou affiché est le verrou appliqué.
 */
export function normalizeGodLocks(raw: unknown): ModuleKey[] {
    if (!Array.isArray(raw)) return [];
    const out: ModuleKey[] = [];
    for (const value of raw) {
        if (isGodLockableModule(value) && !out.includes(value)) out.push(value);
    }
    return out;
}

/** `disabledByGod` tel quel lu sur un enregistrement `modules` (tolérant au bruit). */
export function godLocksOf(modules: unknown): unknown {
    return (modules as { disabledByGod?: unknown } | null | undefined)?.disabledByGod;
}

/**
 * Applique le verrou : les clés verrouillées passent à `false`, le reste est
 * intact. Renvoie l'objet **inchangé** s'il n'y a aucun verrou (pas de copie
 * inutile sur le chemin chaud du dashboard).
 */
export function applyGodLocks<T extends Partial<GuildModulesState>>(
    modules: T | null | undefined,
    locks: unknown,
): T {
    if (!modules) return modules as unknown as T;
    const normalized = normalizeGodLocks(locks);
    if (normalized.length === 0) return modules;

    const next: Record<string, unknown> = { ...modules };
    for (const key of normalized) next[key] = false;
    return next as unknown as T;
}
