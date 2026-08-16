"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { auth } from "@/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
    INTER_GUILD_MODULES,
    type InterGuildModuleKey,
    type InterGuildScope,
    type InterGuildAdminState,
    resolveInterGuildScope,
    isScopeOpen,
} from "@/lib/inter-guild";
import type { AuditAction, AuditTargetType } from "./audit-actions";

// ============================================================================
// Chantier Inter-Guilde (19/08) — couche serveur (fail-closed, opt-in bilatéral).
//
// Règles de sécurité (cf. PLAN-MAITRE / DECISIONS) :
//  - L'inter-guilde est effective ⇔ guilde.interGuildEnabled ET God.interGuildGlobalEnabled.
//  - Les pairs = guildes actives, elles-mêmes ouvertes, même dofusServerId (scope SERVER)
//    ou toutes (scope GLOBAL), liste bornée (MAX_PEERS).
//  - Aucune écriture cross-guilde ici : ce fichier ne fait QUE de la lecture croisée +
//    la mise à jour de la config de la guilde appelante.
//  - PII minimale : les membres externes exposent pseudo Dofus + classe + tag guilde.
// ============================================================================

const MAX_PEERS = 200;
const CACHE_TTL_MS = 30_000;

type GodInterGuildConfig = {
    globalEnabled: boolean;
    modules: Record<string, unknown> | null;
    channels: Record<string, unknown> | null;
};

let godCache: { data: GodInterGuildConfig; expiresAt: number } | null = null;

/** Kill-switch God + overrides par module (cache mémoire court, fail-closed si BDD KO). */
export async function getGodInterGuildConfig(): Promise<GodInterGuildConfig> {
    if (godCache && godCache.expiresAt > Date.now()) return godCache.data;
    try {
        const config = await db.platformConfig.findUnique({
            where: { id: "singleton" },
            select: { interGuildGlobalEnabled: true, interGuildModules: true, interGuildChannels: true },
        });
        const data: GodInterGuildConfig = {
            globalEnabled: config?.interGuildGlobalEnabled ?? true,
            modules: (config?.interGuildModules as Record<string, unknown> | null) ?? null,
            channels: (config?.interGuildChannels as Record<string, unknown> | null) ?? null,
        };
        godCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
        return data;
    } catch (e) {
        logger.error("[inter-guild] getGodInterGuildConfig failed:", e);
        // Fail-closed : on ne peut pas vérifier l'état God → on coupe (globalEnabled=false).
        const data: GodInterGuildConfig = { globalEnabled: false, modules: null, channels: null };
        godCache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
        return data;
    }
}

/** Invalide le cache God (appelé après un toggle God, et dans les tests). */
export async function invalidateGodInterGuildCache(): Promise<void> {
    godCache = null;
}


type GuildInterGuildRow = {
    id: string;
    discordGuildId: string;
    name: string;
    dofusServerId: string | null;
    interGuildEnabled: boolean;
    interGuildModules: unknown;
};

async function getGuildInterGuildRow(discordGuildId: string): Promise<GuildInterGuildRow | null> {
    return db.guildConfig.findUnique({
        where: { discordGuildId },
        select: {
            id: true,
            discordGuildId: true,
            name: true,
            dofusServerId: true,
            interGuildEnabled: true,
            interGuildModules: true,
        },
    }) as Promise<GuildInterGuildRow | null>;
}

export type InterGuildConfig = {
    enabled: boolean;
    godGlobalEnabled: boolean;
    scopes: Record<InterGuildModuleKey, InterGuildScope>;
    guildDofusServerId: string | null;
};

/**
 * Config effective inter-guilde d'une guilde (toggle guilde × kill-switch God).
 * Fail-closed : si la guilde n'est pas activée OU le God a coupé → enabled=false.
 */
export async function getInterGuildConfig(discordGuildId: string): Promise<InterGuildConfig> {
    const [guild, god] = await Promise.all([
        getGuildInterGuildRow(discordGuildId),
        getGodInterGuildConfig(),
    ]);
    if (!guild) return { enabled: false, godGlobalEnabled: god.globalEnabled, scopes: {} as InterGuildConfig["scopes"], guildDofusServerId: null };

    const guildOverrides = (guild.interGuildModules as Record<string, unknown> | null) ?? {};
    const scopes = {} as Record<InterGuildModuleKey, InterGuildScope>;
    for (const mod of INTER_GUILD_MODULES) {
        scopes[mod] = resolveInterGuildScope(mod, guildOverrides, god.modules ?? {});
    }

    return {
        enabled: !!guild.interGuildEnabled && god.globalEnabled,
        godGlobalEnabled: god.globalEnabled,
        scopes,
        guildDofusServerId: guild.dofusServerId,
    };
}

/**
 * Guildes pairs d'une guilde pour un module donné (opt-in bilatéral + scope).
 * - guilde appelante NON ouverte (ou God coupé) → [] (fail-closed).
 * - scope OFF → [].
 * - scope SERVER → mêmes dofusServerId (non-null) ; scope GLOBAL → toutes.
 * - Liste bornée à MAX_PEERS, cache Redis 30s, invalidation au toggle.
 */
export async function getInterGuildPeerGuildIds(
    discordGuildId: string,
    module: InterGuildModuleKey
): Promise<string[]> {
    const cfg = await getInterGuildConfig(discordGuildId);
    if (!cfg.enabled || !isScopeOpen(cfg.scopes[module])) return [];

    const cacheKey = `inter:peers:${discordGuildId}:${module}`;
    try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as string[];
    } catch (e) {
        logger.error("[inter-guild] redis read failed:", e);
    }

    const scope = cfg.scopes[module];
    const where: Record<string, unknown> = {
        isActive: true,
        interGuildEnabled: true,
        NOT: { discordGuildId },
    };
    if (scope === "SERVER") {
        where.dofusServerId = cfg.guildDofusServerId;
    }

    try {
        const peers = await db.guildConfig.findMany({
            where,
            select: { id: true },
            take: MAX_PEERS + 1,
            orderBy: { name: "asc" },
        });
        // Bornage strict : on ne garde jamais plus de MAX_PEERS pairs.
        const ids = peers.slice(0, MAX_PEERS).map(p => p.id);
        await redis.set(cacheKey, JSON.stringify(ids), "EX", CACHE_TTL_MS / 1000).catch(() => { });
        return ids;
    } catch (e) {
        logger.error("[inter-guild] getInterGuildPeerGuildIds failed:", e);
        return [];
    }
}

/** Nombre de guildes pairs (toutes modules confondues, borné). */
export async function getInterGuildPeerGuildCount(discordGuildId: string): Promise<number> {
    const cfg = await getInterGuildConfig(discordGuildId);
    if (!cfg.enabled) return 0;
    // On prend le scope le plus permissif parmi les modules ouverts pour compter.
    let scope: InterGuildScope | null = null;
    for (const mod of INTER_GUILD_MODULES) {
        if (!isScopeOpen(cfg.scopes[mod])) continue;
        if (!scope) scope = cfg.scopes[mod];
        else if (cfg.scopes[mod] === "GLOBAL") scope = "GLOBAL";
    }
    if (!scope) return 0;
    try {
        const where: Record<string, unknown> = {
            isActive: true,
            interGuildEnabled: true,
            NOT: { discordGuildId },
        };
        if (scope === "SERVER") where.dofusServerId = cfg.guildDofusServerId;
        return await db.guildConfig.count({ where } as never);
    } catch (e) {
        logger.error("[inter-guild] getInterGuildPeerGuildCount failed:", e);
        return 0;
    }
}

// ============================================================================
// Lecture croisée PII-minimale — annuaire membres inter-guilde
// ============================================================================

export type InterGuildMemberView = {
    pseudoDofus: string;
    classe: string | null;
    dofusLevel: number | null;
    guildName: string;
    guildDiscordId: string;
};

const MEMBER_FETCH_LIMIT = 60;

/**
 * Annuaire inter-guilde : membres ACTIVE des guildes pairs (scope du module `members`).
 * PII minimale : pseudo Dofus + classe + niveau + tag guilde — jamais d'identité Discord.
 * RBAC : l'appelant doit déjà pouvoir voir l'annuaire de SA guilde (vérifié en amont par la page).
 */
export async function getInterGuildMembers(discordGuildId: string): Promise<{ members: InterGuildMemberView[]; peerCount: number }> {
    const cfg = await getInterGuildConfig(discordGuildId);
    if (!cfg.enabled || !isScopeOpen(cfg.scopes.members)) {
        return { members: [], peerCount: 0 };
    }

    const peerIds = await getInterGuildPeerGuildIds(discordGuildId, "members");
    if (peerIds.length === 0) return { members: [], peerCount: peerIds.length };

    try {
        const [profiles, peerGuilds] = await Promise.all([
            db.userProfile.findMany({
                where: {
                    guildId: { in: peerIds },
                    status: "ACTIVE",
                    // Filtre serveur : `not: null` (les pseudoDofus vides sont écartés côté JS).
                    pseudoDofus: { not: null },
                },
                select: { pseudoDofus: true, classe: true, dofusLevel: true, guildId: true },
                orderBy: { pseudoDofus: "asc" },
                take: MEMBER_FETCH_LIMIT,
            }),
            db.guildConfig.findMany({
                where: { id: { in: peerIds } },
                select: { id: true, name: true, discordGuildId: true },
            }),
        ]);

        const guildMap = new Map(peerGuilds.map(g => [g.id, g]));
        const members: InterGuildMemberView[] = profiles
            .filter(p => p.pseudoDofus && p.pseudoDofus.trim() !== "")
            .map(p => {
                const guild = guildMap.get(p.guildId);
                return {
                    pseudoDofus: p.pseudoDofus as string,
                    classe: p.classe,
                    dofusLevel: p.dofusLevel,
                    guildName: guild?.name ?? "Guilde inconnue",
                    guildDiscordId: guild?.discordGuildId ?? "",
                };
            });

        return { members, peerCount: peerIds.length };
    } catch (e) {
        logger.error("[inter-guild] getInterGuildMembers failed:", e);
        return { members: [], peerCount: peerIds.length };
    }
}

// ============================================================================
// Mutation admin (config de SA propre guilde)
// ============================================================================

const UpdateInterGuildSchema = z.object({
    enabled: z.boolean(),
    modules: z
        .record(z.enum(INTER_GUILD_MODULES), z.enum(["OFF", "SERVER", "GLOBAL"]))
        .optional()
        .default({}),
});

export async function updateInterGuildConfig(
    discordGuildId: string,
    input: { enabled: boolean; modules?: Partial<Record<InterGuildModuleKey, InterGuildScope>> }
): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const user = await getUserContextLocal(discordGuildId);
    if (!user.isAdmin) return { success: false, error: "Accès non autorisé" };

    const parsed = UpdateInterGuildSchema.safeParse({
        enabled: input.enabled,
        modules: input.modules ?? {},
    });
    if (!parsed.success) return { success: false, error: "Données invalides" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true, interGuildEnabled: true, interGuildModules: true },
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        // Merge des surcharges : on ne garde que les clés éligibles, le reste est inchangé.
        const current = ((guild.interGuildModules as Record<string, unknown>) || {});
        const next: Record<string, unknown> = { ...current };
        for (const [key, scope] of Object.entries(parsed.data.modules ?? {})) {
            if ((INTER_GUILD_MODULES as readonly string[]).includes(key)) {
                next[key] = scope;
            }
        }

        const oldValue = { enabled: guild.interGuildEnabled, modules: guild.interGuildModules };
        await db.guildConfig.update({
            where: { id: guild.id },
            data: {
                interGuildEnabled: parsed.data.enabled,
                interGuildModules: next,
            },
        });

        await createAuditLogEntry({
            guildId: discordGuildId,
            actorUserId: session.user.id,
            actorName: session.user.name || "Admin",
            action: "CONFIG_UPDATED",
            targetType: "CONFIG",
            targetId: "INTER_GUILD",
            oldValue,
            newValue: { enabled: parsed.data.enabled, modules: next },
        });

        // Invalidation des caches (contextes utilisateurs + peers).
        await clearInterGuildCaches(discordGuildId);

        revalidatePath(`/dashboard/${discordGuildId}/admin/settings`);
        return { success: true };
    } catch (e) {
        logger.error("[inter-guild] updateInterGuildConfig failed:", e);
        return { success: false, error: "Erreur serveur" };
    }
}

/** État pour l'UI admin (toggle + scopes par module + pairs). */
export async function getInterGuildAdminState(discordGuildId: string): Promise<InterGuildAdminState> {
    const cfg = await getInterGuildConfig(discordGuildId);
    const peerCount = await getInterGuildPeerGuildCount(discordGuildId);

    const LABELS: Record<InterGuildModuleKey, string> = {
        welcome: "Fil d'arrivées",
        members: "Annuaire membres",
        gallery: "Galerie de stuffs",
        minigames: "Mini-jeux",
        calendar: "Calendrier & Raids",
        ladder: "Ladder",
        ocre: "Quête Ocre (trades)",
        songes: "Songes Infinis",
        donjons: "Donjons & Quêtes",
        services: "Services",
        quests: "Suivi par Dofus / Rush",
    };

    return {
        enabled: cfg.enabled,
        godGlobalEnabled: cfg.godGlobalEnabled,
        peerCount,
        modules: INTER_GUILD_MODULES.map(module => ({
            module,
            label: LABELS[module],
            defaultScope: "SERVER",
            currentScope: cfg.scopes[module],
        })),
    };
}

// ============================================================================
// Internes (imports dynamiques pour éviter les cycles user-actions ⇄ inter-guild)
// ============================================================================

async function getUserContextLocal(discordGuildId: string): Promise<{ isAdmin: boolean }> {
    const { getUserContext } = await import("@/server/actions/user-actions");
    return getUserContext(discordGuildId);
}

async function createAuditLogEntry(args: {
    guildId: string;
    actorUserId: string;
    actorName: string;
    action: AuditAction;
    targetType: AuditTargetType;
    targetId: string;
    oldValue: unknown;
    newValue: unknown;
}) {
    const { createAuditLog } = await import("@/server/actions/audit-actions");
    await createAuditLog(args);
}

async function clearInterGuildCaches(discordGuildId: string) {
    try {
        const { invalidateGuildCache, flushGuildUserContextCache } = await import("@/server/actions/user-actions");
        await invalidateGuildCache(discordGuildId);
        await flushGuildUserContextCache(discordGuildId);
    } catch (e) {
        logger.error("[inter-guild] cache flush failed:", e);
    }
    // Purge des caches Redis des pairs de cette guilde (tous modules).
    try {
        let cursor = "0";
        do {
            const [next, found] = await redis.scan(cursor, "MATCH", `inter:peers:${discordGuildId}:*`, "COUNT", 100);
            cursor = next;
            if (found.length > 0) await redis.del(...found).catch(() => { });
        } while (cursor !== "0");
    } catch (e) {
        logger.error("[inter-guild] peer cache flush failed:", e);
    }
}



