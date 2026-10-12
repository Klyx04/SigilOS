/**
 * Verrou God des modules — **règle pure, une seule source**.
 *
 * Un module coupé par le God (`GuildModules.disabledByGod` pour une guilde,
 * `PlatformConfig.disabledModules` pour toute la plateforme) est **OFF effectif**
 * quel que soit le toggle de la guilde (toggle **conservé** en BDD pour une
 * réactivation sans perte). Deux garanties :
 * - la liste des modules verrouillables est **dérivée** du registre
 *   (`DEFAULT_MODULES`) : elle ne peut plus dériver à la main (`commandes` manquait,
 *   audit du 24/09/2026) ;
 * - `admin` n'est **jamais** verrouillable (sinon l'admin perd le panneau qui lui
 *   explique pourquoi tout est éteint).
 *
 * Aucun `"use server"` ici : importable côté serveur, côté bot et côté client, et
 * testable en unitaire. Consommé par `module-actions.ts` (résolution + écriture),
 * `getUserContext` (permissions), `internalCheckPermission` (interactions du bot)
 * et `src/server/platform-module-state.ts` (verrou plateforme).
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

// ============================================================================
// Résolution d'état d'un module — LA règle, trois niveaux DISTINCTS (A1 · A2 · A3)
// ============================================================================
//
//  ① verrou **plateforme** (God, toutes les guildes)  ⇒ « Indisponible — maintenance »
//  ② verrou de **guilde** (God, cette guilde)        ⇒ « Indisponible — maintenance »
//  ③ toggle de la **guilde** (admin du serveur)      ⇒ « Désactivé par ta guilde »
//
// Le mot « staff » n'apparaît nulle part : il ne veut rien dire pour un admin de
// guilde. `admin` n'est jamais verrouillable (sinon l'admin perd le panneau qui
// lui explique pourquoi tout est éteint).

/** Modules qu'un God peut couper pour TOUTE la plateforme — même registre, `admin` exclu. */
export const PLATFORM_LOCKABLE_MODULES: readonly ModuleKey[] = GOD_LOCKABLE_MODULES;

/** Longueur maximale d'un message de maintenance libre (borne Zod et affichage). */
export const MODULE_NOTICE_MAX_LENGTH = 200;

/** Origine du verrou effectif d'un module. */
export type ModuleLockSource = "platform" | "guild";

/** État effectif d'un module tel qu'affiché et appliqué (guilde **et** God). */
export interface ModuleLockState {
    /** Le module est-il utilisable ? `false` dès qu'un verrou s'applique (toggle conservé en BDD). */
    enabled: boolean;
    /** Origine du verrou, `null` si aucun. */
    lockedBy: ModuleLockSource | null;
    /** Message libre du God (verrou plateforme), déjà borné/nettoyé, `null` si aucun. */
    notice: string | null;
}

export interface ModuleLocksInput {
    /** `GuildModules.disabledByGod` de la guilde (brut, tolérant). */
    guildLocks?: unknown;
    /** `PlatformConfig.disabledModules` (brut, tolérant). */
    platformLocks?: unknown;
    /** `PlatformConfig.moduleNotices` (brut, tolérant). */
    platformNotices?: unknown;
}

/** Verrou plateforme normalisé (mêmes garanties que le verrou de guilde). */
export function normalizePlatformLocks(raw: unknown): ModuleKey[] {
    return normalizeGodLocks(raw);
}

/**
 * Normalise `moduleNotices` : objet `{ moduleKey: message }`, messages nettoyés,
 * bornés à `MODULE_NOTICE_MAX_LENGTH`, vides écartés, clés hors registre écartées.
 * Lecture tolérante au bruit (une valeur non-objet ⇒ `{}`).
 */
export function normalizePlatformNotices(raw: unknown): Partial<Record<ModuleKey, string>> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Partial<Record<ModuleKey, string>> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (!isGodLockableModule(key) || typeof value !== "string") continue;
        const message = value.trim().slice(0, MODULE_NOTICE_MAX_LENGTH);
        if (message.length > 0) out[key] = message;
    }
    return out;
}

/**
 * État effectif d'UN module. Priorité : verrou plateforme > verrou de guilde > toggle.
 * `enabled` est faux dès qu'un verrou s'applique, **même si** le toggle de la guilde
 * est encore `true` en base (il est conservé pour une réactivation sans perte).
 */
export function resolveModuleState(
    moduleKey: ModuleKey,
    modules: Partial<GuildModulesState> | null | undefined,
    input: ModuleLocksInput = {},
): ModuleLockState {
    // `admin` n'est jamais verrouillable : le garde-fou est ici, pas seulement à l'écriture.
    const lockable = isGodLockableModule(moduleKey);
    const platformLocked = lockable && normalizePlatformLocks(input.platformLocks).includes(moduleKey);
    const guildLocked = lockable && normalizeGodLocks(input.guildLocks).includes(moduleKey);
    const lockedBy: ModuleLockSource | null = platformLocked ? "platform" : guildLocked ? "guild" : null;

    const toggle = (modules?.[moduleKey] ?? DEFAULT_MODULES[moduleKey]) !== false;
    const notice = platformLocked
        ? (normalizePlatformNotices(input.platformNotices)[moduleKey] ?? null)
        : null;

    return { enabled: toggle && lockedBy === null, lockedBy, notice };
}

/** Message affiché SUR LA CARTE du module quand un verrou s'applique (A2 · A3). */
export const MAINTENANCE_LABEL = "Indisponible — maintenance";

/** Message affiché quand le module est simplement éteint par la guilde (A3 ③). */
export const GUILD_DISABLED_LABEL = "Désactivé par ta guilde";

/** État effectif de TOUS les modules du registre (une seule passe de normalisation). */
export function resolveModuleGrid(
    modules: Partial<GuildModulesState> | null | undefined,
    input: ModuleLocksInput = {},
): Record<ModuleKey, ModuleLockState> {
    const guildLocks = normalizeGodLocks(input.guildLocks);
    const platformLocks = normalizePlatformLocks(input.platformLocks);
    const notices = normalizePlatformNotices(input.platformNotices);

    const out = {} as Record<ModuleKey, ModuleLockState>;
    for (const key of Object.keys(DEFAULT_MODULES) as ModuleKey[]) {
        const lockable = key !== "admin";
        const platformLocked = lockable && platformLocks.includes(key);
        const guildLocked = lockable && guildLocks.includes(key);
        const lockedBy: ModuleLockSource | null = platformLocked ? "platform" : guildLocked ? "guild" : null;
        out[key] = {
            enabled: ((modules?.[key] ?? DEFAULT_MODULES[key]) !== false) && lockedBy === null,
            lockedBy,
            notice: platformLocked ? (notices[key] ?? null) : null,
        };
    }
    return out;
}
