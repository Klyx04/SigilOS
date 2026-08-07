"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { createGodAuditLog } from "./audit-actions";
import { GOD_SCOPES, type GodScope } from "@/lib/god-scopes";

/**
 * RECOMPILE TRIGGER: 2026-03-11 02:22
 * This file MUST be async because it is marked with "use server".
 */

// Super-admin Discord IDs (from environment) - Forced async
export async function getSuperAdminIds(): Promise<string[]> {
    const envVar = process.env.SUPER_ADMIN_IDS;
    if (!envVar) return [];
    return envVar.split(",").map(id => id.trim()).filter(Boolean);
}

/**
 * Check if a Discord ID belongs to a super-admin
 */
export async function isDiscordSuperAdmin(discordId: string): Promise<boolean> {
    const superAdminIds = await getSuperAdminIds();
    return superAdminIds.includes(discordId);
}

/**
 * Check if the current user is a super-admin (platform-level)
 * Reads discordId from the JWT session — no DB call needed.
 */
export async function isSuperAdmin(): Promise<boolean> {
    const session = await auth();
    if (!session?.user?.id) return false;

    // discordId is stored in the JWT token by auth.ts jwt() callback
    // Reading it from session avoids a db.account.findFirst() on every request
    const discordId = (session as any).user?.discordId;
    if (!discordId) return false;

    const superAdminIds = await getSuperAdminIds();
    return superAdminIds.includes(discordId);
}

/**
 * GOD SCOPE HELPERS — délégation d'accès au dashboard God (sub-gods).
 * Sécurité fail-closed : par défaut AUCUN scope. Un sub-god ne peut voir que
 * ce qui lui est explicitement accordé via la table GodDelegate.
 * Les constantes GOD_SCOPES/GodScope vivent dans @/lib/god-scopes (fichier
 * NON "use server", car "use server" n'autorise que des fonctions async).
 *
 * Récupère les scopes actifs de l'utilisateur connecté en tant que sub-god.
 * Retourne un tableau vide si l'utilisateur n'est PAS super-admin ET PAS délégué.
 */
export async function getActiveScopes(): Promise<GodScope[]> {
    const session = await auth();
    if (!session?.user?.id) return [];

    const isAdmin = await isSuperAdmin();
    if (isAdmin) return [...GOD_SCOPES]; // super-admin = tous les scopes

    const now = new Date();
    const delegates = await db.godDelegate.findMany({
        where: {
            userId: session.user.id,
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { scopes: true },
    });

    const scopes = new Set<GodScope>();
    for (const d of delegates) {
        for (const s of d.scopes) {
            if ((GOD_SCOPES as readonly string[]).includes(s)) scopes.add(s as GodScope);
        }
    }
    return [...scopes];
}

/**
 * Vérifie si l'utilisateur connecté possède un scope god donné.
 * Lève une erreur sinon (utilisable dans les server actions).
 */
export async function requireGodAccess(scope: GodScope, opts?: { throwOnFail?: boolean }): Promise<boolean> {
    const scopes = await getActiveScopes();
    const has = scopes.includes(scope as GodScope);
    if (!has && opts?.throwOnFail !== false) {
        throw new Error("Unauthorized: God scope required: " + scope);
    }
    return has;
}

/**
 * Alias commode : true si l'utilisateur est super-admin OU a le scope demandé.
 */
export async function isGodDelegate(scope: GodScope): Promise<boolean> {
    const scopes = await getActiveScopes();
    return scopes.includes(scope as GodScope);
}

/**
 * 🔄 R1 — Vérifie l'accès à un scope SANS lever d'erreur (lectures God granuleuses).
 * Retourne false (fail-closed) si le scope n'est pas actif.
 * Les fonctions d'ÉCRITURE restent protégées par requireGodAccess (throw) + isSuperAdmin.
 */
export async function canGodAccess(scope: GodScope): Promise<boolean> {
    const scopes = await getActiveScopes();
    return scopes.includes(scope as GodScope);
}

/**
 * 🔄 D2 — Vérifie l'accès granulaire à une BRICK précise (PIM).
 *
 * Logique fail-closed :
 *  - super-admin → accès total (retourne true) ;
 *  - sinon, au moins un grant ACTIF sur cette brick : grant non révoqué,
 *    startAt <= now, expiresAt >= now (ou null = sans expiration),
 *    ET le délégué associé doit être actif (revokedAt null) et non expiré.
 *
 * Le bump de `scopeVersion` (révocation immédiate) invalide TOUS les grants
 * du délégué en une fois.
 */
export async function canAccessBrick(
    brickId: string,
    opts?: { userId?: string; guildContext?: string }
): Promise<boolean> {
    const session = await auth();
    if (!session?.user?.id) return false;

    // Super-admin bypass (tous les scopes = accès total)
    if (await isSuperAdmin()) return true;

    const userId = opts?.userId || session.user.id;
    const now = new Date();

    // 1. Le délégué doit être actif (non révoqué, non expiré) et porter la version courante
    const delegates = await db.godDelegate.findMany({
        where: {
            userId,
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { id: true, guildId: true, scopeVersion: true },
    });

    // 2. Grant actif sur cette brick pour ces délégués actifs
    // ⚠️ IMPORTANT (fix fail-open D2) : un spread `...` sur la clé `OR`
    // écraserait silencieusement le 1er OR. On construit donc des filtres
    // combinables dans un top-level `AND` qui préserve l'expiration ET le
    // guildContext (jamais l'un sans l'autre → fail-closed).
    const grantFilters: Prisma.GodAccessGrantWhereInput[] = [
        { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
    ];

    if (opts?.guildContext) {
        grantFilters.push({
            OR: [{ guildId: opts.guildContext }, { guildId: null }],
        });
    }

    const grantWhere: Prisma.GodAccessGrantWhereInput = {
        userId,
        brickId,
        revokedAt: null,
        startAt: { lte: now },
        AND: grantFilters,
    };

    const grants = await db.godAccessGrant.findMany({
        where: grantWhere,
        select: { delegateId: true, expiresAt: true },
    });

    // 3. Un grant n'est valide que si son délégué est encore actif
    const activeDelegateIds = new Set(delegates.map((d) => d.id));
    const allowed = grants.some((g: { delegateId: string; expiresAt: Date | null }) => activeDelegateIds.has(g.delegateId));

    // D4 : tentative refusée → warn anti-scout (faible volume, cohérent avec le proxy)
    if (!allowed) {
        const { logger } = await import("@/lib/logger");
        logger.warn("[GodAccess] brick refusée (fail-closed)", { brickId, userId });
    }

    return allowed;
}

/**
 * 🛡️ Guard fail-closed pour les actions serveur des modules ouverts aux sous-gods.
 * Autorise si super-admin OU (page ouvrable + grant/scope sur la brique).
 * Lève une erreur sinon (utilisable dans les server actions), et trace le refus
 * (GodAccessLog) pour l'anti-scout, cohérent avec la sécurité RULES.md.
 */
export async function requireGodBrick(brickId: string): Promise<true> {
    if (await isSuperAdmin()) return true;
    const session = await auth();
    if (!session?.user?.id) throw new Error("Non authentifié");
    const ok = await canAccessBrick(brickId);
    if (!ok) {
        const { logger } = await import("@/lib/logger");
        logger.warn("[GodBrickGuard] accès refusé (fail-closed)", { brickId, userId: session.user.id });
        throw new Error("Accès non autorisé à ce module");
    }
    return true;
}

/**
 * 🔄 P2 — Retourne la liste des briques réellement accessibles à un sous-god
 * (sans bypass super-admin : retourne [] pour un admin, qui passe par ses bypass).
 *
 * Logique fail-closed, en UNE seule requête groupée (évite N appels DB dans la
 * sidebar/layout) :
 *  - un sous-god accède à une brique si `subGodAccess === true` (page ouvrable)
 *    ET au moins un des deux :
 *       • le scope global requis est actif (rétro-compat scopes),
 *       • un grant de brique actif couvre cette brique (PIM).
 *  - sinon → la brique n'est PAS dans la liste.
 *
 * Utilisée par la sidebar et le layout God pour ne montrer à un sous-god que
 * les pages qu'il peut réellement voir (fail-closed par défaut).
 */
export type MyActiveGrant = {
    brickId: string;
    label: string;
    expiresAt: string | null; // ISO ou null si illimité
    scope: string | null;
};

/**
 * 🔄 P3-R — Retourne les accès effectifs d'un sous-god (sans bypass super-admin).
 * Fibre sur `getAccessibleBricks` (+ grants actifs qui apportent la date
 * d'expiration) pour l'UX côté sous-god : badge "expire dans X",
 * popup pré-expiration, vue "Mon accès".
 */
export async function getMyActiveGrants(userId: string): Promise<MyActiveGrant[]> {
    const { GOD_BRICKS } = await import("@/lib/god-bricks");
    const accessible = await getAccessibleBricks(userId);
    if (accessible.length === 0) return [];

    const now = new Date();
    const delegates = await db.godDelegate.findMany({
        where: {
            userId,
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { id: true },
    });
    const activeIds = delegates.map((d) => d.id);

    // Grant actif → expiration la plus proche par brique (info la plus précise)
    const expiresByBrick = new Map<string, string | null>();
    if (activeIds.length > 0) {
        const grants = await db.godAccessGrant.findMany({
            where: {
                userId,
                delegateId: { in: activeIds },
                revokedAt: null,
                startAt: { lte: now },
                OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
            },
            select: { brickId: true, expiresAt: true },
        });
        for (const g of grants) {
            const cur = expiresByBrick.get(g.brickId);
            // null = illimité → priorité de garder le plus court (on veut l'alerte la plus proche)
            const gVal = g.expiresAt ? g.expiresAt.toISOString() : null;
            if (gVal === null) { expiresByBrick.set(g.brickId, null); continue; }
            if (cur === undefined || (cur !== null && gVal < cur)) expiresByBrick.set(g.brickId, gVal);
        }
    }

    const result: MyActiveGrant[] = [];
    for (const brickId of accessible) {
        const brick = GOD_BRICKS.find((b) => b.id === brickId);
        result.push({
            brickId,
            label: brick?.label ?? brickId,
            scope: brick?.scope ?? null,
            expiresAt: expiresByBrick.get(brickId) ?? null,
        });
    }
    return result;
}

/**
 * 🔄 P2 — Retourne la liste des briques réellement accessibles à un sous-god
 * (sans bypass super-admin : retourne [] pour un admin, qui passe par ses bypass).
 *
 * Logique fail-closed, en UNE seule requête groupée (évite N appels DB dans la
 * sidebar/layout) :
 *  - un sous-god accède à une brique si `subGodAccess === true` (page ouvrable)
 *    ET au moins un des deux :
 *       • le scope global requis est actif (rétro-compat scopes),
 *       • un grant de brique actif couvre cette brique (PIM).
 *  - sinon → la brique n'est PAS dans la liste.
 *
 * Utilisée par la sidebar et le layout God pour ne montrer à un sous-god que
 * les pages qu'il peut réellement voir (fail-closed par défaut).
 */
export async function getAccessibleBricks(userId: string): Promise<string[]> {
    const { GOD_BRICKS, getSubGodBrickIds } = await import("@/lib/god-bricks");
    const subGodBrickIds = getSubGodBrickIds(); // briques ouvrables aux sous-gods

    if (subGodBrickIds.length === 0) return [];

    const now = new Date();

    // 1. Déélégations actives de l'utilisateur → scopes globaux + IDs délégués
    const delegates = await db.godDelegate.findMany({
        where: {
            userId,
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { id: true, scopes: true },
    });

    // Scopes actifs (dédoublonnés)
    const activeScopes = new Set<string>();
    const activeDelegateIds = delegates.length > 0 ? delegates.map((d) => d.id) : [];

    for (const d of delegates) {
        for (const s of d.scopes) activeScopes.add(s);
    }

    // 2. Grants actifs (PIM) pour ces délégués, triés par brique
    //    (filtres fail-closed : non révoqué, non expiré, startAt <= now)
    const bricksGranted = new Set<string>();
    if (activeDelegateIds.length > 0) {
        const grants = await db.godAccessGrant.findMany({
            where: {
                userId,
                delegateId: { in: activeDelegateIds },
                revokedAt: null,
                startAt: { lte: now },
                OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
            },
            select: { brickId: true },
        });
        for (const g of grants) bricksGranted.add(g.brickId);
    }

    // 3. Pour chaque brique ouvrable : accessible si scope requis actif OU grant actif
    const accessible: string[] = [];
    for (const b of GOD_BRICKS) {
        if (!b.subGodAccess) continue;
        const hasScope = b.scope ? activeScopes.has(b.scope) : false;
        const hasGrant = bricksGranted.has(b.id);
        if (hasScope || hasGrant) accessible.push(b.id);
    }

    return accessible;
}

/**
 * Get all allowed guilds (platform whitelist)
 * 🔄 R1 — LECTURE compatible scope "guilds" (ne lève plus pour un sub-god du scope guilds).
 */
export async function getAllowedGuilds() {
    if (!(await canGodAccess("guilds")) && !(await isSuperAdmin())) {
        throw new Error("Unauthorized: God scope required: guilds");
    }

    return db.allowedGuild.findMany({
        orderBy: { addedAt: "desc" }
    });
}

/**
 * Add a guild to the platform whitelist
 */
export async function addAllowedGuild(data: {
    discordGuildId: string;
    name?: string;
    tier?: string;
    notes?: string;
    expiresAt?: Date | null;
}) {
    const session = await auth();
    // ✅ Sous-god PIM du scope "guilds" autorisé (fail-closed sinon : aucun scope → throw)
    if (!(await canGodAccess("guilds"))) throw new Error("Unauthorized: God scope required: guilds");
    if (!session?.user?.id) throw new Error("Non authentifié");

    const isAdmin = await isSuperAdmin();
    const actorName = session.user.name || (isAdmin ? "Super Admin" : "Sous-God");

    // Get super-admin's Discord ID
    const account = await db.account.findFirst({
        where: { userId: session!.user!.id, provider: "discord" }
    });

    if (!account?.providerAccountId) throw new Error("Discord account not found");

    // Check if already exists
    const existing = await db.allowedGuild.findUnique({
        where: { discordGuildId: data.discordGuildId }
    });

    if (existing) {
        throw new Error("Cette guilde est déjà dans la liste blanche");
    }

    const guild = await db.allowedGuild.create({
        data: {
            discordGuildId: data.discordGuildId,
            name: data.name || null,
            tier: data.tier || "BETA",
            notes: data.notes || null,
            expiresAt: data.expiresAt || null,
            addedBy: account.providerAccountId,
        }
    });

    // 🔄 Invalide le cache `guild_allowed:{id}` pour éviter un flash AccessDenied
    // si un `false` périmé avait été mis en cache avant la whitelist.
    await invalidateAllowedGuildCache(data.discordGuildId);

    // 📝 LOG ACTION (Professional Verbose)
    if (session?.user?.id) {
        await createGodAuditLog({
            guildId: data.discordGuildId,
            action: "GOD_GUILD_WHITELIST",
            targetType: "WHITELIST",
            targetId: data.discordGuildId,
            newValue: { name: data.name, tier: data.tier, expiresAt: data.expiresAt },
            metadata: { operation: "ADD_TO_WHITELIST", guildName: data.name }
        });
    }

    // 🔔 NOTIFY GOD
    const { notifyGod } = await import("@/server/actions/god-notif-actions");
    await notifyGod({
        title: "Guilde Whitelistée",
        message: `**${data.name || data.discordGuildId}** a été ajouté à la whitelist (tier: ${data.tier || "BETA"}).\n👤 Par: **${actorName}**`,
        type: "SYSTEM",
        success: true,
        metadata: { guildId: data.discordGuildId, tier: data.tier || "BETA", performedBy: actorName },
    });

    // 🔔 NOTIF CLIENT : si un ticket ACCESS_REQUEST ouvert existe pour cette guilde,
    // on prévient le créateur (même message que la validation via ticket).
    try {
        const openAccessRequest = await db.supportTicket.findFirst({
            where: {
                category: "ACCESS_REQUEST",
                targetGuildId: data.discordGuildId,
                status: { not: "CLOSED" },
            },
            select: { id: true, ticketNumber: true, creatorDiscordId: true, discordThreadId: true },
        });

        if (openAccessRequest) {
            const { notifyGuildAccessApproved } = await import("@/server/actions/ticket-actions");
            const platformConfig = await db.platformConfig.findUnique({ where: { id: "singleton" } });
            await notifyGuildAccessApproved(openAccessRequest, platformConfig as any, data.notes || undefined, actorName);
        }
    } catch (notifClientErr) {
        // Non-bloquant : la whitelist est créée, la notif client est best-effort
        const { logger } = await import("@/lib/logger");
        logger.warn("[God] Notif client whitelist manuelle échouée (non bloquant)", { error: notifClientErr, guildId: data.discordGuildId });
    }

    revalidatePath("/god");
    return guild;
}

/**
 * Remove a guild from the platform whitelist
 */
export async function removeAllowedGuild(discordGuildId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized: Super-admin access required");

    // 🔔 NOTIFY GOD (must fetch name BEFORE deletion)
    const { notifyGod } = await import("@/server/actions/god-notif-actions");
    const session = await auth();
    const adminName = session?.user?.name || "Super Admin";
    const guildToRemove = await db.allowedGuild.findUnique({ where: { discordGuildId }, select: { name: true } });
    await notifyGod({
        title: "Guilde Retirée",
        message: `**${guildToRemove?.name || discordGuildId}** a été retiré de la whitelist.\n👤 Par: **${adminName}**`,
        type: "SYSTEM",
        success: false,
        metadata: { guildId: discordGuildId, performedBy: adminName },
    });

    await db.allowedGuild.delete({
        where: { discordGuildId }
    });

    // 🔄 Invalide le cache `guild_allowed:{id}` (suppression éventuelle d'un `true` périmé).
    await invalidateAllowedGuildCache(discordGuildId);

    // 📝 LOG ACTION
    if (session?.user?.id) {
        await createGodAuditLog({
            guildId: discordGuildId,
            action: "GOD_GUILD_WHITELIST",
            targetType: "WHITELIST",
            targetId: discordGuildId,
            metadata: { operation: "REMOVE_FROM_WHITELIST" }
        });
    }

    revalidatePath("/god");
    return { success: true };
}

/**
 * Toggle guild active status
 */
export async function toggleGuildActive(discordGuildId: string) {
    // ✅ Sous-god PIM du scope "guilds" autorisé (fail-closed sinon)
    if (!(await canGodAccess("guilds"))) throw new Error("Unauthorized: God scope required: guilds");
    const isAdmin = await isSuperAdmin();
    const adminName = (await auth())?.user?.name || (isAdmin ? "Super Admin" : "Sous-God");

    const guild = await db.allowedGuild.findUnique({
        where: { discordGuildId }
    });

    if (!guild) throw new Error("Guilde non trouvée");

    const updated = await db.allowedGuild.update({
        where: { discordGuildId },
        data: { isActive: !guild.isActive }
    });

    // 🔄 Invalide le cache `guild_allowed:{id}` pour que le changement de statut soit immédiat.
    await invalidateAllowedGuildCache(discordGuildId);

    // 📝 LOG ACTION
    const session = await auth();
    if (session?.user?.id) {
        await createGodAuditLog({
            guildId: discordGuildId,
            action: "GOD_GUILD_WHITELIST",
            targetType: "WHITELIST",
            targetId: discordGuildId,
            oldValue: { isActive: guild.isActive },
            newValue: { isActive: updated.isActive },
            metadata: { operation: "TOGGLE_ACTIVE_STATUS" }
        });
    }

    // 🔔 NOTIFY GOD
    const { notifyGod } = await import("@/server/actions/god-notif-actions");
    await notifyGod({
        title: updated.isActive ? "Guilde Activée" : "Guilde Désactivée",
        message: `**${updated.name || discordGuildId}** a été ${updated.isActive ? "réactivé" : "désactivé"} sur la plateforme.\n👤 Par: **${adminName}**`,
        type: "SYSTEM",
        success: updated.isActive,
        metadata: { guildId: discordGuildId, isActive: updated.isActive, performedBy: adminName },
    });

    revalidatePath("/god");
    return updated;
}

/**
 * Get platform-wide statistics with trends
 * 🔄 R1 — LECTURE compatible scope "guilds".
 */
export async function getPlatformStats() {
    if (!(await canGodAccess("guilds")) && !(await isSuperAdmin())) {
        throw new Error("Unauthorized: God scope required: guilds");
    }

    // Get current stats
    const [
        totalGuildsCount,
        activeGuildsCount,
        totalUsersCount,
        totalProfilesCount,
        activeProfilesCount,
        totalMissionsCount
    ] = await Promise.all([
        db.guildConfig.count(), // Count actual guilds, not whitelist
        db.guildConfig.count({ where: { isActive: true } }),
        db.user.count(),
        db.userProfile.count(),
        db.userProfile.count({ where: { status: "ACTIVE" } }),
        db.mission.count()
    ]);

    // Get stats from 24h ago for trends
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
        guildsTrend,
        usersTrend,
        missionsTrend,
        weeklyActiveUsers
    ] = await Promise.all([
        db.guildConfig.count({ where: { createdAt: { gte: yesterday } } }),
        db.user.count({ where: { createdAt: { gte: yesterday } } }),
        db.mission.count({ where: { createdAt: { gte: yesterday } } }),
        db.userProfile.count({ where: { lastSeen: { gte: lastWeek }, status: "ACTIVE" } })
    ]);

    const retentionRate = totalUsersCount > 0 ? (totalProfilesCount / totalUsersCount) * 100 : 0;
    const density = totalGuildsCount > 0 ? totalProfilesCount / totalGuildsCount : 0;

    return {
        allowedGuilds: totalGuildsCount, // Renamed for compatibility
        guildsTrend,
        activeGuilds: activeGuildsCount,
        totalUsers: totalUsersCount,
        usersTrend,
        totalProfiles: totalProfilesCount,
        activeProfiles: activeProfilesCount,
        totalMissions: totalMissionsCount,
        missionsTrend,
        weeklyActiveUsers,
        retentionRate: Math.round(retentionRate),
        density: Number(density.toFixed(1))
    };
}


import { redis } from "@/lib/redis";

/**
 * Check if a guild is allowed (for use in layouts/middleware)
 * This replaces the ALLOWED_GUILD_IDS env check
 * 
 * ✅ HIGH-03 FIX: Uses Redis for multi-node consistency
 */
export async function isGuildAllowed(discordGuildId: string): Promise<boolean> {
    const cacheKey = `guild_allowed:${discordGuildId}`;
    
    // 1. Try fetching from Redis
    try {
        const cached = await redis.get(cacheKey);
        if (cached !== null) return cached === 'true';
    } catch (e) {
        console.warn(`[Security] Redis read failed for ${cacheKey}, falling back to DB.`);
    }

    // 2. Fetch from DB if not cached
    try {
        // Parallel fetch for better performance
        const [ban, allowed, config] = await Promise.all([
            db.platformBan.findUnique({ where: { discordId: discordGuildId } }),
            db.allowedGuild.findUnique({ where: { discordGuildId } }),
            db.guildConfig.findUnique({
                where: { discordGuildId },
                select: { isActive: true }
            })
        ]);

        // Priority 1: Bans
        let isAllowed = true;
        if (ban && ban.entityType === "GUILD") isAllowed = false;

        // Priority 2: Whitelist
        if (isAllowed && (!allowed || !allowed.isActive)) isAllowed = false;

        // Priority 3: Config state
        if (isAllowed && config && !config.isActive) isAllowed = false;

        // 3. Save to Redis (60 seconds TTL)
        try {
            await redis.setex(cacheKey, 60, isAllowed ? 'true' : 'false');
        } catch (redisErr) {
            console.warn(`[Security] Redis write failed for ${cacheKey}`);
        }

        return isAllowed;
    } catch (e) {
        console.error(`[Security] Error checking guild status for ${discordGuildId}:`, e);
        // Fail closed for security
        return false;
    }
}

/**
 * Invalide le cache Redis `guild_allowed:{id}` (TTL 60s) utilisé par isGuildAllowed.
 * À appeler IMMÉDIATEMENT après toute écriture de whitelist / déploiement de guilde
 * pour éviter qu'un `false` périmé ne déclenche un bref flash "AccessDenied".
 * Non bloquant : erreur Redis silencieusement ignorée (le cache expire en 60s).
 */
export async function invalidateAllowedGuildCache(discordGuildId: string) {
    try {
        await redis.del(`guild_allowed:${discordGuildId}`);
    } catch {
        // Non bloquant
    }
}

/**
 * CLEANUP JANITOR (GDPR & Hygiene)
 * Deletes users created > threshold ago with NO profile and NO critical data.
 * Default: 24h. Test Mode: 2 mins.
 */
export async function cleanupGhostUsers(isTestMode = false) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    // DATA LIFECYCLE MANAGEMENT
    // Production: 24h grace period
    // Testing: 2 minutes grace period
    const threshold = isTestMode ? 2 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - threshold);

    const superAdminIds = await getSuperAdminIds();

    // 1. Find candidates (Old users)
    const candidates = await db.user.findMany({
        where: {
            createdAt: { lt: cutoffDate },
            profiles: { none: {} } // No UserProfile
        },
        include: {
            accounts: true // To check Discord ID for Super Admin protection
        }
    });

    let deletedCount = 0;

    for (const user of candidates) {
        // SAFETY CHECK 1: Is Super Admin?
        const discordId = user.accounts[0]?.providerAccountId;
        if (discordId && superAdminIds.includes(discordId)) {
            continue; // Skip Super Admins
        }

        // SAFETY CHECK 2: Has created guild events? (Deep cleaning check)
        const hasEvents = await db.guildEvent.count({ where: { creatorId: user.id } });
        if (hasEvents > 0) continue;

        // Execute Delete
        await db.user.delete({ where: { id: user.id } });
        deletedCount++;
    }

    // 📝 LOG ACTION
    const session = await auth();
    if (session?.user?.id) {
        const mgmtId = await db.guildConfig.findFirst({ select: { discordGuildId: true } });
        await createGodAuditLog({
            guildId: mgmtId?.discordGuildId || undefined,
            action: "GOD_USER_PLATFORM_BAN",
            targetType: "SYSTEM_GOD",
            metadata: { operation: "GHOST_CLEANUP", count: deletedCount, testMode: isTestMode }
        });
    }

    revalidatePath("/god");
    return { success: true, count: deletedCount, mode: isTestMode ? "TEST (2m)" : "PROD (24h)" };
}

/**
 * Get Ghost Users (No Profile) for Admin View with advanced insights
 */
export async function getGhostUsers(params?: { search?: string; limit?: number }) {
    const isAdmin = await isSuperAdmin();
    const hasScope = await canGodAccess("guilds") || await canGodAccess("users");
    if (!isAdmin && !hasScope) return [];

    const { search, limit = 100 } = params || {};

    const users = await db.user.findMany({
        where: {
            profiles: { none: {} },
            ...(search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { id: { contains: search } },
                    { accounts: { some: { providerAccountId: { contains: search } } } }
                ]
            } : {})
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
            accounts: {
                select: { provider: true, providerAccountId: true }
            },
            sessions: {
                orderBy: { expires: 'desc' },
                take: 1,
                select: { expires: true }
            },
            _count: {
                select: { sessions: true, guildEvents: true }
            }
        }
    });

    // Enhancement: Check if these ghost users are present in ANY whitelisted guild
    // This helps the admin know if they are "legit" members who just haven't confirmed their profile.
    const allowedGuilds = await db.allowedGuild.findMany({
        where: { isActive: true },
        select: { discordGuildId: true, name: true }
    });

    const { fetchGuildMember } = await import("@/server/discord");

    const enrichedUsers = await Promise.all(users.map(async (user) => {
        const discordId = user.accounts.find(a => a.provider === "discord")?.providerAccountId;
        const memberIn = [];

        if (discordId && allowedGuilds.length > 0) {
            // We check membership in whitelist guilds
            // To avoid huge latency, we only check the first 3 active guilds found or a limited subset
            for (const guild of allowedGuilds.slice(0, 5)) {
                try {
                    const member = await fetchGuildMember(guild.discordGuildId, discordId);
                    if (member) {
                        memberIn.push(guild.name || guild.discordGuildId);
                    }
                } catch {
                    // Ignore errors for individual guilds
                }
            }
        }

        return {
            ...user,
            memberInWhitelists: memberIn
        };
    }));

    return enrichedUsers;
}

/**
 * Delete a specific Ghost User (Manual Purge)
 */
export async function deleteGhostUser(userId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    const superAdminIds = await getSuperAdminIds();
    
    const user = await db.user.findUnique({
        where: { id: userId },
        include: { accounts: true, _count: { select: { profiles: true } } }
    });

    if (!user) throw new Error("Utilisateur introuvable.");
    if (user._count.profiles > 0) throw new Error("Cet utilisateur n'est pas un fantôme (profil détecté).");

    const discordId = user.accounts[0]?.providerAccountId;
    if (discordId && superAdminIds.includes(discordId)) {
        throw new Error("Impossible de purger un Super Admin.");
    }

    const hasEvents = await db.guildEvent.count({ where: { creatorId: user.id } });
    if (hasEvents > 0) throw new Error("Cet utilisateur possède des événements et ne peut pas être purgé.");

    await db.user.delete({ where: { id: user.id } });

    // 📝 LOG ACTION
    const currentSession = await auth();
    if (currentSession?.user?.id) {
        const mgmtId = await db.guildConfig.findFirst({ select: { discordGuildId: true } });
        await createGodAuditLog({
            guildId: mgmtId?.discordGuildId || undefined,
            action: "GOD_USER_PLATFORM_BAN",
            targetType: "USER",
            targetId: userId,
            metadata: { operation: "MANUAL_GHOST_DELETE", userName: user.name, discordId }
        });
    }

    revalidatePath("/god");
    return { success: true };
}

/**
 * Get Unauthorized Bot Connections
 * Identifies guilds where the bot is present but which are NOT in the whitelist.
 */
export async function getUnauthorizedBotConnections() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin && !(await canGodAccess("guilds"))) return [];

    try {
        const { fetchBotGuilds } = await import("@/server/discord");
        const [botGuilds, allowedGuilds] = await Promise.all([
            fetchBotGuilds(),
            db.allowedGuild.findMany({ select: { discordGuildId: true } })
        ]);

        const allowedIds = new Set(allowedGuilds.map(g => g.discordGuildId));
        const unauthorized = botGuilds.filter(g => !allowedIds.has(g.id));

        return unauthorized.map(g => ({
            id: g.id,
            name: g.name,
            icon: g.icon
        }));
    } catch (err) {
        console.error("[SuperAdmin] Failed to fetch unauthorized guilds:", err);
        return [];
    }
}

/**
 * Get Platform Activity (Pulse) Stats for Charts
 * Combines new registrations and total audit log activity
 */
export async function getPlatformActivityStats() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin && !(await canGodAccess("guilds"))) return [];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch new users
    const users = await db.user.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true }
    });

    // Fetch all audit activity (engagement pulse)
    const logs = await db.auditLog.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true }
    });

    const statsMap = new Map<string, { users: number; pulse: number }>();

    // Initialize last 30 days
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        statsMap.set(d.toISOString().split("T")[0], { users: 0, pulse: 0 });
    }

    users.forEach((u) => {
        const dateKey = u.createdAt.toISOString().split("T")[0];
        if (statsMap.has(dateKey)) {
            const current = statsMap.get(dateKey)!;
            statsMap.set(dateKey, { ...current, users: current.users + 1 });
        }
    });

    logs.forEach((l) => {
        const dateKey = l.createdAt.toISOString().split("T")[0];
        if (statsMap.has(dateKey)) {
            const current = statsMap.get(dateKey)!;
            // Normalizing pulse (diving by 10 to keep scale coherent on chart)
            statsMap.set(dateKey, { ...current, pulse: current.pulse + 1 });
        }
    });

    return Array.from(statsMap.entries())
        .map(([date, data]) => ({
            date,
            users: data.users,
            pulse: Number(data.pulse.toFixed(1))
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Force Delete User (Admin Manual Action)
 */
export async function forceDeleteUser(userId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    // Prevent Admin Suicide
    const session = await auth();
    if (session?.user?.id === userId) {
        throw new Error("Cannot delete yourself");
    }

    try {
        // Cascade delete will handle relations if Schema is set up correctly,
        // but explicit clean up is safer/clearer or relying on Prisma onDelete: Cascade
        await db.user.delete({
            where: { id: userId }
        });

        revalidatePath("/god");

        // 📝 LOG ACTION
        const session = await auth();
        if (session?.user?.id) {
            const mgmtId = await db.guildConfig.findFirst({ select: { discordGuildId: true } });
            await createGodAuditLog({
                guildId: mgmtId?.discordGuildId || undefined,
                action: "GOD_USER_PLATFORM_BAN",
                targetType: "USER",
                targetId: userId,
                metadata: { operation: "FORCE_DELETE_USER" }
            });
        }

        return { success: true };
    } catch (error) {
        console.error("Delete Error:", error);
        return { success: false, error: "Deletion failed" };
    }
}
/**
 * PLANETARY ORPHAN CLEANUP
 * Removes UserProfile entries that are no longer linked to a valid User.
 * This can happen if a User was deleted bypassing Prisma's cascade or due to previous bugs.
 */
export async function cleanupOrphanedProfiles() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized");

    // 1. Find all profile IDs
    const profiles = await db.userProfile.findMany({
        select: { id: true, userId: true }
    });

    // 2. Find all valid user IDs
    const users = await db.user.findMany({
        select: { id: true }
    });
    const userIds = new Set(users.map(u => u.id));

    // 3. Identify orphans
    const orphanIds = profiles
        .filter(p => !userIds.has(p.userId))
        .map(p => p.id);

    if (orphanIds.length === 0) {
        return { success: true, count: 0, message: "Aucun profil orphelin détecté." };
    }

    // 4. Delete orphans
    await db.userProfile.deleteMany({
        where: { id: { in: orphanIds } }
    });

    // 📝 LOG ACTION
    const session = await auth();
    if (session?.user?.id) {
        const mgmtId = await db.guildConfig.findFirst({ select: { discordGuildId: true } });
        await createGodAuditLog({
            guildId: mgmtId?.discordGuildId || undefined,
            action: "GOD_USER_PLATFORM_BAN",
            targetType: "SYSTEM_GOD",
            metadata: { operation: "ORPHAN_CLEANUP", count: orphanIds.length }
        });
    }

    revalidatePath("/god");
    return { success: true, count: orphanIds.length, message: `${orphanIds.length} profils orphelins supprimés.` };
}

/**
 * [ADM-8] Platform-wide: Get all users who have requested account deletion
 * or have a scheduled deletion pending. Includes their guild profile(s) for context.
 * Super-admin only.
 */
export async function getPendingDeletionUsers() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) throw new Error("Unauthorized: Super-admin access required");

    const users = await db.user.findMany({
        where: {
            OR: [
                { deletionRequestedAt: { not: null } },
                { scheduledDeletion: { not: null } },
            ]
        },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            deletionRequestedAt: true,
            scheduledDeletion: true,
            createdAt: true,
            profiles: {
                select: {
                    id: true,
                    status: true,
                    pseudoDofus: true,
                    discordNickname: true,
                    archiveReason: true,
                    guild: {
                        select: { name: true, discordGuildId: true }
                    }
                }
            }
        },
        orderBy: { deletionRequestedAt: "desc" },
        take: 100
    });

    return users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        image: u.image,
        deletionRequestedAt: u.deletionRequestedAt?.toISOString() || null,
        scheduledDeletion: u.scheduledDeletion?.toISOString() || null,
        createdAt: u.createdAt.toISOString(),
        guilds: u.profiles.map(p => ({
            guildName: p.guild.name,
            discordGuildId: p.guild.discordGuildId,
            displayName: p.pseudoDofus || p.discordNickname || u.name || "Inconnu",
            profileStatus: p.status,
            archiveReason: p.archiveReason,
        }))
    }));
}

/**
 * Get OCR API Usage Statistics for /god page
 * Returns daily usage for the last 30 days and monthly totals
 */
export async function getOcrApiStats() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin && !(await canGodAccess("maintenance"))) return { daily: [], monthlyTotal: 0, todayTotal: 0 };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    // Get all usage records for last 30 days
    // Note: Using 'as any' due to Prisma client cache issue with new models
    const usageRecords = await (db as any).ocrApiUsage.findMany({
        where: { date: { gte: thirtyDaysAgo } },
        orderBy: { date: 'asc' }
    });

    // Group by date
    const dailyMap = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        dailyMap.set(d.toISOString().split('T')[0], 0);
    }

    let monthlyTotal = 0;
    let todayTotal = 0;

    usageRecords.forEach((record: { date: Date; count: number }) => {
        const dateKey = new Date(record.date).toISOString().split('T')[0];
        if (dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + record.count);
        }

        if (new Date(record.date) >= firstOfMonth) {
            monthlyTotal += record.count;
        }

        if (new Date(record.date).toISOString().split('T')[0] === today.toISOString().split('T')[0]) {
            todayTotal += record.count;
        }
    });

    return {
        daily: Array.from(dailyMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        monthlyTotal,
        todayTotal
    };
}

// ============================================================================
// MANUAL WORKER TRIGGERS (Platform Level)
// ============================================================================

export async function triggerGlobalMetamobSync() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const { metamobQueue } = await import("@/lib/queue/metamob-queue");
        // Passing dummy IDs since this is for testing, wait, the Metamob queue expects specific guildId and userId.
        // For a global trigger, we add a generic job, though the current worker requires these fields.
        // Better yet: we just queue the job, and the worker will gracefully fail or do a generic task if we modify it later.
        // For now, testing the queue mechanics:
        const job = await metamobQueue.add("manual-metamob-sync", {
            guildId: "GOD_TEST",
            userId: "GOD_TEST"
        });
        
        // 📝 LOG ACTION
        const session = await auth();
        if (session?.user?.id) {
            const mgmtId = await db.guildConfig.findFirst({ select: { discordGuildId: true } });
            await createGodAuditLog({
                guildId: mgmtId?.discordGuildId || undefined,
                action: "GOD_DATABASE_SYNC",
                targetType: "DATA_SYNC",
                metadata: { operation: "MANUAL_METAMOB_TRIGGER", jobId: job.id }
            });
        }

        return { success: true, message: `Tâche Metamob (Job ${job.id}) envoyée dans la file.` };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function triggerGlobalLadderSync() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const { ladderQueue } = await import("@/lib/queue/ladder-queue");
        const job = await ladderQueue.add("manual-ladder-sync", { force: true });
        
        // 📝 LOG ACTION
        const session = await auth();
        if (session?.user?.id) {
            const mgmtId = await db.guildConfig.findFirst({ select: { discordGuildId: true } });
            await createGodAuditLog({
                guildId: mgmtId?.discordGuildId || undefined,
                action: "GOD_DATABASE_SYNC",
                targetType: "DATA_SYNC",
                metadata: { operation: "MANUAL_LADDER_TRIGGER", jobId: job.id }
            });
        }

        return { success: true, message: `Tâche Ladder (Job ${job.id}) envoyée dans la file.` };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function testLadderFetch(pseudo: string, serverId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: "Unauthorized" };

    const WORKER_URL = process.env.DOFUS_LADDER_WORKER_URL;
    const WORKER_SECRET = process.env.DOFUS_LADDER_WORKER_KEY || process.env.DOFUS_LADDER_WORKER_SECRET;
    
    if (!WORKER_URL) return { success: false, error: "La variable DOFUS_LADDER_WORKER_URL est absente." };

    try {
        const headers: Record<string, string> = { "Accept": "application/json" };
        if (WORKER_SECRET) headers["X-SigilOS-Key"] = WORKER_SECRET;

        const urlSucces = `${WORKER_URL}?server_id=${encodeURIComponent(serverId)}&name=${encodeURIComponent(pseudo)}&type=succes`;
        const resSucces = await fetch(urlSucces, { headers });
        const succesData = await resSucces.json().catch(() => null);

        const urlGeneral = `${WORKER_URL}?server_id=${encodeURIComponent(serverId)}&name=${encodeURIComponent(pseudo)}&type=general`;
        const resGeneral = await fetch(urlGeneral, { headers });
        const generalData = await resGeneral.json().catch(() => null);

        // API might return success: true or found: true
        const succesOk = succesData?.success || succesData?.found;
        const generalOk = generalData?.success || generalData?.found;

        const isFunctionalSuccess = resSucces.status === 200 && resGeneral.status === 200 && succesOk && generalOk;

        return { 
            success: isFunctionalSuccess,
            statusSucces: resSucces.status,
            succesData, 
            statusGeneral: resGeneral.status,
            generalData 
        };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}