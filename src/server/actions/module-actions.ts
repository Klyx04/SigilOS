"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { createAuditLog, createGodAuditLog } from "./audit-actions";
import { auth } from "@/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { rateLimit } from "@/lib/ratelimit";
import { type ModuleKey, type GuildModulesState, DEFAULT_MODULES } from "@/lib/module-types";
import {
    MODULE_NOTICE_MAX_LENGTH,
    applyGodLocks,
    isGodLockableModule,
    normalizeGodLocks,
    normalizePlatformLocks,
    normalizePlatformNotices,
    resolveModuleGrid,
    type ModuleLockState,
} from "@/lib/module-lock";
import { getPlatformModuleState, invalidatePlatformModuleStateCache } from "@/server/platform-module-state";

const UpdateModulesSchema = z.object({
    // Général
    presentation: z.boolean(),
    roster: z.boolean(),
    stats: z.boolean(),
    calendar: z.boolean(),
    // Fonctionnalités
    missions: z.boolean(),
    songes: z.boolean(),
    ocre: z.boolean(),
    ladder: z.boolean(),
    // Outils
    services: z.boolean(),
    donjons: z.boolean(),
    profile: z.boolean(),
    docs: z.boolean(),
    polls: z.boolean(),
    // Planning
    availability: z.boolean(),
    // Admin
    logs: z.boolean(),
    admin: z.boolean(),
    // Coming Soon
    quests: z.boolean(),
    worldmap: z.boolean(),
    resources: z.boolean(),
    // Nouveau
    gallery: z.boolean(),
    ladderSync: z.boolean(),
    manualLadderSync: z.boolean(),
    minigames: z.boolean(),
    succes: z.boolean(),
    marche: z.boolean(),
    reactionRoles: z.boolean(),
    tickets: z.boolean(),
    commandes: z.boolean(),
});

type ActionResponse<T = undefined> = {
    success: boolean;
    error?: string;
    data?: T;
};

import { cache } from "react";

// In-memory cache for module states (30s TTL).
// On met en cache l'état **BRUT** (`raw` = toggles de la guilde tels qu'en BDD) +
// les verrous de guilde ; le verrou **plateforme** est appliqué à la lecture
// (`getPlatformModuleState`, cache 30 s), donc un déverrouillage plateforme
// n'attend pas l'expiration de ce cache-ci.
type CachedGuildModules = { raw: GuildModulesState; guildLocks: ModuleKey[]; expiresAt: number };
const moduleCache = new Map<string, CachedGuildModules>();
const MODULE_CACHE_TTL = 30_000;

/**
 * Invalidate modules cache for a guild
 */
export async function invalidateModuleCache(discordGuildId: string) {
    moduleCache.delete(discordGuildId);
}

/**
 * Vide le cache des modules de **toutes** les guildes. Réservé aux écritures
 * d'un verrou **plateforme** (`setPlatformModuleLock`) : une coupure globale
 * change l'état de chaque guilde, un cache par guilde ne suffirait pas.
 */
export async function invalidateAllModuleCaches(): Promise<void> {
    moduleCache.clear();
}

/** Lecture unique de la guilde : toggles **bruts** + verrou de guilde, cache 30 s. */
async function readGuildModules(discordGuildId: string): Promise<CachedGuildModules> {
    const now = Date.now();
    const cached = moduleCache.get(discordGuildId);
    if (cached && cached.expiresAt > now) return cached;

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            include: { modules: true },
        });

        const dbModules = guildConfig?.modules as any;
        
        // If no modules record at all, return defaults (aucun verrou possible)
        if (!dbModules) {
            const entry: CachedGuildModules = { raw: DEFAULT_MODULES, guildLocks: [], expiresAt: now + MODULE_CACHE_TTL };
            moduleCache.set(discordGuildId, entry);
            return entry;
        }

        // Merge defaults with DB values, ensuring boolean conversion and fallback
        const data: GuildModulesState = {
            ...DEFAULT_MODULES,
            presentation: dbModules.presentation ?? DEFAULT_MODULES.presentation,            roster: dbModules.roster ?? DEFAULT_MODULES.roster,
            stats: dbModules.stats ?? DEFAULT_MODULES.stats,
            calendar: dbModules.calendar ?? DEFAULT_MODULES.calendar,
            missions: dbModules.missions ?? DEFAULT_MODULES.missions,
            songes: dbModules.songes ?? DEFAULT_MODULES.songes,
            ocre: dbModules.ocre ?? DEFAULT_MODULES.ocre,
            ladder: dbModules.ladder ?? DEFAULT_MODULES.ladder,
            services: dbModules.services ?? DEFAULT_MODULES.services,
            donjons: dbModules.donjons ?? DEFAULT_MODULES.donjons,
            profile: dbModules.profile ?? DEFAULT_MODULES.profile,
            docs: dbModules.docs ?? DEFAULT_MODULES.docs,
            polls: dbModules.polls ?? DEFAULT_MODULES.polls,
            availability: dbModules.availability ?? DEFAULT_MODULES.availability,
            logs: dbModules.logs ?? DEFAULT_MODULES.logs,
            admin: dbModules.admin ?? DEFAULT_MODULES.admin,
            reactionRoles: dbModules.reactionRoles ?? DEFAULT_MODULES.reactionRoles,
            quests: dbModules.quests ?? DEFAULT_MODULES.quests,
            worldmap: dbModules.worldmap ?? DEFAULT_MODULES.worldmap,
            resources: dbModules.resources ?? DEFAULT_MODULES.resources,
            gallery: dbModules.gallery ?? DEFAULT_MODULES.gallery,
            ladderSync: dbModules.ladderSync ?? DEFAULT_MODULES.ladderSync,
            manualLadderSync: dbModules.manualLadderSync ?? DEFAULT_MODULES.manualLadderSync,
            minigames: dbModules.minigames ?? DEFAULT_MODULES.minigames,
            succes: dbModules.succes ?? DEFAULT_MODULES.succes,
            marche: dbModules.marche ?? DEFAULT_MODULES.marche,
            tickets: dbModules.tickets ?? DEFAULT_MODULES.tickets,
            commandes: dbModules.commandes ?? DEFAULT_MODULES.commandes,
        };

        const entry: CachedGuildModules = {
            raw: data,
            guildLocks: normalizeGodLocks(dbModules.disabledByGod),
            expiresAt: now + MODULE_CACHE_TTL,
        };
        moduleCache.set(discordGuildId, entry);
        return entry;
    } catch {
        return { raw: DEFAULT_MODULES, guildLocks: [], expiresAt: now + MODULE_CACHE_TTL };
    }
}
/**
 * État effectif des modules d'une guilde — **guilde ∪ plateforme**.
 *
 * Un module verrouillé (par le God, pour cette guilde **ou** pour toute la
 * plateforme) est OFF effectif quel que soit le toggle de guilde, lequel reste
 * conservé en BDD (réactivation sans perte au déverrouillage). Règle PURE
 * partagée (`src/lib/module-lock.ts`) : c'est la MÊME règle que
 * `getGuildModuleStates`, `getUserContext` et `internalCheckPermission`, donc le
 * verrou affiché est exactement le verrou appliqué.
 */
export const getGuildModules = cache(async (discordGuildId: string): Promise<GuildModulesState> => {
    const [entry, platform] = await Promise.all([
        readGuildModules(discordGuildId),
        getPlatformModuleState(),
    ]);
    return applyGodLocks(entry.raw, [...entry.guildLocks, ...platform.locks]);
});

/**
 * Configuration **complète** d'une guilde pour la carte des modules :
 * les toggles **bruts** (propriété de la guilde, payload d'écriture) + l'état
 * **effectif** de chaque module (origine du verrou, message de maintenance).
 *
 * Les deux valeurs viennent de la **même lecture** : c'est ce qui garantit qu'un
 * enregistrement n'écrase jamais le toggle conservé en BDD d'un module verrouillé.
 *
 * Auth : fail-closed — la configuration n'est rendue qu'à une session
 * authentifiée (les pages qui la consomment sont derrière une garde d'accès).
 */
export async function getGuildModuleConfig(
    discordGuildId: string,
): Promise<{ toggles: GuildModulesState; states: Record<ModuleKey, ModuleLockState> }> {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Non authentifié");

    const [entry, platform] = await Promise.all([
        readGuildModules(discordGuildId),
        getPlatformModuleState(),
    ]);
    return {
        toggles: entry.raw,
        states: resolveModuleGrid(entry.raw, {
            guildLocks: entry.guildLocks,
            platformLocks: platform.locks,
            platformNotices: platform.notices,
        }),
    };
}

/**
 * Le module est-il **verrouillé** (guilde ou plateforme) pour cette guilde ?
 *
 * Garde de page dédiée : c'est le **verrou** qui doit reboucler une URL directe
 * (A1) — pas le toggle de guilde, qui a ses propres sémantiques de navigation.
 * `admin` n'est jamais verrouillable.
 */
export async function isModuleLocked(discordGuildId: string, module: ModuleKey): Promise<boolean> {
    if (!isGodLockableModule(module)) return false;
    const [entry, platform] = await Promise.all([
        readGuildModules(discordGuildId),
        getPlatformModuleState(),
    ]);
    return entry.guildLocks.includes(module) || platform.locks.includes(module);
}



export async function isModuleEnabled(
    discordGuildId: string,
    module: ModuleKey
): Promise<boolean> {
    const modules = await getGuildModules(discordGuildId);
    return modules[module];
}

// ============================================================================
// MUTATIONS (Admin only)
// ============================================================================

export async function updateGuildModules(
    discordGuildId: string,
    newModules: GuildModulesState
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const user = await getUserContext(discordGuildId);
    // Règle unique alignée sur la page /admin/modules : natif Discord admin
    // (owner/0x8) ou God. Les dieux DÉLÉGUÉS system:god ne basculent plus les
    // modules (blast radius = toute la guilde) — breaking documenté.
    if (!user.isDiscordAdmin) return { success: false, error: "Accès non autorisé" };

    const parsed = UpdateModulesSchema.safeParse(newModules);
    if (!parsed.success) return { success: false, error: "Données invalides" };

    // Refuse toute modification du toggle guilde d'un module verrouillé — par le
    // God pour cette guilde **ou** pour toute la plateforme (le verrou prime ; le
    // toggle est conservé tel quel en BDD). `admin` n'est jamais verrouillable
    // (garde-fou miroir de la résolution).
    const rawRow = await db.guildModules.findFirst({
        where: { guild: { discordGuildId } },
    }).catch(() => null) as unknown as (Record<string, unknown> & { disabledByGod?: unknown }) | null;
    const platform = await getPlatformModuleState();
    // Pas de ligne = premier toggle (upsert ci-dessous) = aucun verrou de guilde possible.
    const locked: ModuleKey[] = Array.from(new Set([
        ...normalizeGodLocks(rawRow?.disabledByGod),
        ...platform.locks,
    ]));
    for (const key of locked) {
        const current = rawRow?.[key] as boolean | null | undefined;
        const wanted = (parsed.data as Record<string, boolean>)[key];
        if (wanted !== undefined && current !== undefined && current !== null && wanted !== current) {
            return { success: false, error: "Module indisponible (maintenance) : modification refusée." };
        }
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            include: { modules: true },
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const oldModules = guildConfig.modules ?? DEFAULT_MODULES;

        await db.guildModules.upsert({
            where: { guildId: guildConfig.id },
            create: {
                guildId: guildConfig.id,
                ...parsed.data,
                updatedBy: session.user.id,
            },
            update: {
                ...parsed.data,
                updatedBy: session.user.id,
            },
        });

        // 🛡️ CRITICAL: Invalidate Server-side memory caches
        await invalidateModuleCache(discordGuildId);
        const { invalidateGuildCache, flushGuildUserContextCache } = await import("./user-actions");
        await invalidateGuildCache(discordGuildId);
        // BUGFIX: Flush all user context Redis caches so module changes take effect immediately
        // (without this, members see stale permissions for up to 60s after a module toggle)
        await flushGuildUserContextCache(discordGuildId);

        await createAuditLog({
            guildId: discordGuildId,
            actorUserId: session.user.id,
            actorName: session.user.name || "Admin",
            action: "CONFIG_UPDATED",
            targetType: "CONFIG",
            targetId: "MODULES",
            oldValue: oldModules,
            newValue: parsed.data,
        });

        revalidatePath(`/dashboard/${discordGuildId}/admin/modules`);
        // BUGFIX: Invalider le layout pour répercuter les changements de modules sur tout le dashboard
        revalidatePath(`/dashboard/${discordGuildId}`, "layout");


        return { success: true };
    } catch (error) {
        logger.error("[updateGuildModules] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// VERROU GOD (super-gestion par guilde)
// ============================================================================

/**
 * Entrée bornée du verrou God (même exigence que `god-market-actions` :
 * fail-closed, ids Discord bornés, jamais une clé arbitraire en base).
 */
const GodLockSchema = z.object({
    discordGuildId: z.string().min(17).max(20).regex(/^\d+$/, "Snowflake Discord attendu"),
    moduleKey: z.string().min(1).max(40),
    locked: z.boolean(),
});

/**
 * Liste des modules verrouillés par le staff pour une guilde.
 * Lecture : God OU admin Discord natif de la guilde (l'admin voit ce qu'on
 * lui coupe). `admin` n'est jamais verrouillable (garde-fou).
 * Filtre = règle partagée (`normalizeGodLocks`) : le verrou lu est celui appliqué.
 */
export async function getModuleGodLocks(discordGuildId: string): Promise<ModuleKey[]> {
    try {
        const session = await auth();
        if (!session?.user?.id) return [];
        const { isSuperAdmin } = await import("./super-admin-actions");
        const god = await isSuperAdmin();
        if (!god) {
            const ctx = await getUserContext(discordGuildId);
            if (!ctx.isDiscordAdmin) return [];
        }
        const row = await db.guildModules.findFirst({
            where: { guild: { discordGuildId } },
            select: { disabledByGod: true },
        }).catch(() => null) as unknown as { disabledByGod?: unknown } | null;
        return normalizeGodLocks(row?.disabledByGod);
    } catch {
        return [];
    }
}

/**
 * Verrouille / déverrouille un module pour une guilde (God uniquement).
 * Le toggle guilde et les mappings RBAC sont CONSERVÉS (réactivation sans
 * perte) ; l'effectif passe à OFF tant que le verrou tient.
 *
 * Durcissements (audit 24/09/2026) :
 * - **garde d'état** dans le `WHERE` (`disabledByGod equals <valeur lue>`) :
 *   deux Gods simultanés ne s'écrasent plus (last-writer-wins silencieux) ;
 * - **Zod borné** + **rate-limit** 10/min/God (modèle `god-market-actions`) ;
 * - journal **God** (`createGodAuditLog`, `isGodLog: true`, sans `guildId`) et
 *   non plus le journal de la guilde — une action plateforme ne se range pas
 *   dans les logs d'un client.
 */
export async function setModuleGodLock(
    discordGuildId: string,
    moduleKey: string,
    locked: boolean
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    const { isSuperAdmin } = await import("./super-admin-actions");
    if (!(await isSuperAdmin())) return { success: false, error: "Non autorisé" };

    const parsed = GodLockSchema.safeParse({ discordGuildId, moduleKey, locked });
    if (!parsed.success) return { success: false, error: "Requête invalide" };
    if (!isGodLockableModule(parsed.data.moduleKey)) {
        return { success: false, error: "Module non verrouillable" };
    }

    const limited = await rateLimit(`god:module-lock:${session.user.id}`, 10, 60_000);
    if (!limited.success) {
        return { success: false, error: "Trop de modifications rapprochées — patiente une minute." };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: parsed.data.discordGuildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const row = await db.guildModules.findUnique({
            where: { guildId: guildConfig.id },
            select: { disabledByGod: true },
        }).catch(() => null) as unknown as { disabledByGod?: unknown } | null;

        const current: ModuleKey[] = normalizeGodLocks(row?.disabledByGod);
        const key = parsed.data.moduleKey;
        const next: ModuleKey[] = parsed.data.locked
            ? Array.from(new Set([...current, key]))
            : current.filter((k) => k !== key);

        if (!row) {
            // Première écriture de la guilde : le `create` garde l'unicité (guildId).
            await db.guildModules.upsert({
                where: { guildId: guildConfig.id },
                create: { guildId: guildConfig.id, disabledByGod: next },
                update: { disabledByGod: { set: next } },
            });
        } else {
            // Garde d'état : la valeur lue doit être encore celle en base.
            const updated = await db.guildModules.updateMany({
                where: { guildId: guildConfig.id, disabledByGod: { equals: current } },
                data: { disabledByGod: { set: next } },
            });
            if (updated.count === 0) {
                return { success: false, error: "Verrou modifié entre-temps — recharge la page." };
            }
        }

        await invalidateModuleCache(parsed.data.discordGuildId);
        const { invalidateGuildCache, flushGuildUserContextCache } = await import("./user-actions");
        await invalidateGuildCache(parsed.data.discordGuildId);
        await flushGuildUserContextCache(parsed.data.discordGuildId);

        await createGodAuditLog({
            guildId: parsed.data.discordGuildId,
            action: "GOD_MODULE_LOCK",
            targetType: "CONFIG",
            targetId: `MODULE_GOD_LOCK:${key}`,
            oldValue: current,
            newValue: next,
            metadata: { operation: "SET_MODULE_GOD_LOCK", moduleKey: key, locked: parsed.data.locked },
        });

        revalidatePath(`/dashboard/${parsed.data.discordGuildId}`, "layout");
        revalidatePath(`/god/guilds/${guildConfig.id}`);
        return { success: true };
    } catch (error) {
        logger.error("[setModuleGodLock] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// VERROU PLATEFORME DES MODULES (A2 · A3 · G12) — God uniquement
// ============================================================================

/** Entrée bornée du verrou plateforme (mêmes exigences que le verrou de guilde). */
const PlatformModuleLockSchema = z.object({
    moduleKey: z.string().min(1).max(40),
    locked: z.boolean(),
    notice: z.string().max(MODULE_NOTICE_MAX_LENGTH).optional(),
});

export interface PlatformModuleOverview {
    /** Modules coupés pour TOUTES les guildes. */
    locks: ModuleKey[];
    /** Message de maintenance libre par module. */
    notices: Partial<Record<ModuleKey, string>>;
    /** Nombre de guildes où le God a verrouillé ce module (verrou de guilde). */
    guildLockCounts: Partial<Record<ModuleKey, number>>;
    updatedAt: string | null;
    updatedBy: string | null;
}

/**
 * Vue God « Modules » : verrou plateforme + compteur de guildes verrouillées par
 * module. Super-admin uniquement (brique `modules` en `subGodAccess: false`).
 */
export async function getPlatformModuleOverview(): Promise<PlatformModuleOverview> {
    const { isSuperAdmin } = await import("./super-admin-actions");
    if (!(await isSuperAdmin())) throw new Error("Non autorisé");

    const [state, rows] = await Promise.all([
        getPlatformModuleState(),
        db.guildModules.findMany({
            where: { disabledByGod: { isEmpty: false } },
            select: { disabledByGod: true },
        }).catch(() => [] as Array<{ disabledByGod: unknown }>),
    ]);

    const guildLockCounts: Partial<Record<ModuleKey, number>> = {};
    for (const row of rows) {
        for (const key of normalizeGodLocks((row as { disabledByGod?: unknown }).disabledByGod)) {
            guildLockCounts[key] = (guildLockCounts[key] ?? 0) + 1;
        }
    }

    const meta = await db.platformConfig.findUnique({ where: { id: "singleton" } })
        .catch(() => null) as unknown as {
            disabledModulesUpdatedAt?: Date | null;
            disabledModulesUpdatedBy?: string | null;
        } | null;

    return {
        locks: state.locks,
        notices: state.notices,
        guildLockCounts,
        updatedAt: meta?.disabledModulesUpdatedAt?.toISOString() ?? null,
        updatedBy: meta?.disabledModulesUpdatedBy ?? null,
    };
}

/**
 * Coupe (ou rétablit) un module pour **toutes** les guildes, avec un message de
 * maintenance libre affiché sur la carte du module côté guilde.
 *
 * Durcissements (mêmes règles que `setModuleGodLock`) : `isSuperAdmin()`,
 * **Zod borné**, **rate-limit** 10/min, **garde d'état** (`WHERE disabledModules
 * equals <valeur lue>` : deux Gods simultanés ne s'écrasent plus), journal **God**
 * (`createGodAuditLog`, jamais le journal d'une guilde), invalidation des caches
 * (plateforme, modules de **toutes** les guildes, contexte utilisateur par guilde).
 */
export async function setPlatformModuleLock(
    moduleKey: string,
    locked: boolean,
    notice?: string,
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    const { isSuperAdmin } = await import("./super-admin-actions");
    if (!(await isSuperAdmin())) return { success: false, error: "Non autorisé" };

    const parsed = PlatformModuleLockSchema.safeParse({ moduleKey, locked, notice });
    if (!parsed.success) return { success: false, error: "Requête invalide" };
    if (!isGodLockableModule(parsed.data.moduleKey)) {
        return { success: false, error: "Module non verrouillable" };
    }

    const limited = await rateLimit(`god:module-platform-lock:${session.user.id}`, 10, 60_000);
    if (!limited.success) {
        return { success: false, error: "Trop de modifications rapprochées — patiente une minute." };
    }

    const key = parsed.data.moduleKey;
    const wantedNotice = parsed.data.notice?.trim().slice(0, MODULE_NOTICE_MAX_LENGTH) ?? "";

    try {
        // `upsert` : la ligne singleton peut manquer sur une base neuve.
        await db.platformConfig.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
        const row = await db.platformConfig.findUnique({ where: { id: "singleton" } }) as unknown as {
            disabledModules?: unknown;
            moduleNotices?: unknown;
        } | null;

        const current = normalizePlatformLocks(row?.disabledModules);
        const next: ModuleKey[] = parsed.data.locked
            ? Array.from(new Set([...current, key]))
            : current.filter((k) => k !== key);

        const nextNotices: Partial<Record<ModuleKey, string>> = { ...normalizePlatformNotices(row?.moduleNotices) };
        if (parsed.data.locked && wantedNotice) nextNotices[key] = wantedNotice;
        else delete nextNotices[key];

        // Garde d'état : la valeur lue doit être encore celle en base.
        const updated = await db.platformConfig.updateMany({
            where: { id: "singleton", disabledModules: { equals: current } },
            data: {
                disabledModules: { set: next },
                moduleNotices: nextNotices as never,
                disabledModulesUpdatedAt: new Date(),
                disabledModulesUpdatedBy: session.user.id,
            },
        });
        if (updated.count === 0) {
            return { success: false, error: "Verrou modifié entre-temps — recharge la page." };
        }

        await invalidateAllModuleCaches();
        invalidatePlatformModuleStateCache();
        const { invalidateGuildCache, flushGuildUserContextCache } = await import("./user-actions");
        const guilds = await db.guildConfig.findMany({ select: { discordGuildId: true } }).catch(() => []);
        await Promise.all(guilds.map(async (g) => {
            await invalidateGuildCache(g.discordGuildId);
            await flushGuildUserContextCache(g.discordGuildId);
        }));

        await createGodAuditLog({
            action: "GOD_MODULE_LOCK",
            targetType: "CONFIG",
            targetId: `MODULE_PLATFORM_LOCK:${key}`,
            oldValue: current,
            newValue: next,
            metadata: {
                operation: "SET_PLATFORM_MODULE_LOCK",
                moduleKey: key,
                locked: parsed.data.locked,
                hasNotice: Boolean(wantedNotice),
            },
        });

        revalidatePath("/god");
        revalidatePath("/dashboard/[guildId]", "layout");
        return { success: true };
    } catch (error) {
        logger.error("[setPlatformModuleLock] Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

