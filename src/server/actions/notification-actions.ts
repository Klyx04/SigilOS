"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { NotificationType, NotificationCategory, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { isMarketNotificationEnabled, type MarketNotificationType } from "@/lib/market/notifications";
import { isNotificationImageKind, sanitizeNotificationImageUrl } from "@/lib/notification-categories";
import { getUserContext } from "./user-actions";

// --- Types ---

export type Notification = {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    category: NotificationCategory;
    read: boolean;
    link: string | null;
    createdAt: Date;
    /** Avatar Discord de l'émetteur (`User.image`) — `null` ⇒ repli sur le picto de catégorie. */
    actorImage: string | null;
    /** Asset de l'objet annoncé (illustration de donjon, icône de Dofus…) — `null` ⇒ picto de catégorie. */
    imageUrl: string | null;
    /** Ce que l'asset représente (`NotificationImageKind`). */
    imageKind: string | null;
};

/** Ligne lue **avec** l'avatar de l'émetteur (une jointure, aucun aller-retour par ligne). */
type NotificationRow = Prisma.NotificationGetPayload<{
    include: { user: { select: { image: true } } };
}>;

/**
 * Met la ligne à plat pour l'affichage : l'avatar remonte au même niveau que le reste.
 *
 * Pourquoi une jointure et pas une colonne : `Notification.userId` existe **déjà** — l'avatar
 * est à une jointure de distance, aucune migration n'est nécessaire pour l'afficher. Le coût
 * est nul en pratique : la lecture est mise en cache Redis (10 s) et plafonnée à 50 lignes.
 */
function toNotificationView(row: NotificationRow): Notification {
    const { user, ...rest } = row;
    return {
        id: rest.id,
        title: rest.title,
        message: rest.message,
        type: rest.type,
        category: rest.category,
        read: rest.read,
        link: rest.link,
        createdAt: rest.createdAt,
        actorImage: user?.image ?? null,
        imageUrl: rest.imageUrl ?? null,
        imageKind: rest.imageKind ?? null,
    };
}

// --- Helpers ---

/**
 * Infer category from notification type or content for legacy support
 */
function inferCategory(type: NotificationType, title: string): NotificationCategory {
    if (["MISSION_VALIDATED", "MISSION_REJECTED"].includes(type)) return "MISSION";
    if (["ACHIEVEMENT_VALIDATED", "ACHIEVEMENT_REJECTED"].includes(type)) return "SUCCESS";
    if (type === "NEW_SUBMISSION_PENDING") return "ADMIN_ALERT";
    if (type === "SONGES_JOIN_REQUEST" || title.toLowerCase().includes("songes")) return "SONGES";
    if (type === "EVENT_REMINDER" || title.toLowerCase().includes("rappel") || title.toLowerCase().includes("event")) return "EVENT";
    if (type === "POLL_CREATED" || type === "POLL_CLOSED" || title.toLowerCase().includes("sondage")) return "POLL";
    if (type.startsWith("OCRE_") || title.toLowerCase().includes("ocre")) return "OCRE";
    if (type.startsWith("FINDER_") || title.toLowerCase().includes("donjon")) return "DONJONS";
    if (type.startsWith("MARKET_")) return "MARKET";
    return "SYSTEM";
}

/**
 * Résout un guildId (qui peut être un discordGuildId si length > 15) vers l'ID interne
 * de GuildConfig. Retourne `undefined` si non résoluble (guilde introuvable).
 */
async function resolveInternalGuildId(guildId?: string): Promise<string | undefined> {
    if (!guildId) return undefined;
    let internalGuildId = guildId;
    if (guildId.length > 15) { // Discord ID lookup
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (guild) internalGuildId = guild.id;
    }
    return internalGuildId;
}

/**
 * Construit le filtre `where` de scope multi-tenant.
 *
 * 🛡️ **Strictement par guilde depuis le 15/10/2026** : la branche `guildId: null`
 * (« notifications système globales », rétrocompatibilité) a été **retirée**. C'était le **seul**
 * chemin par lequel une notification pouvait s'afficher dans une guilde alors qu'elle appartenait
 * à une autre — et sur ce chemin, le garde RBAC des `ADMIN_ALERT` était évalué avec le contexte de
 * la guilde **consultée** (franchissement de privilège).
 *
 * Mesure qui a tranché (base bêta, 15/10/2026) : **7 340 lignes sans guilde sur 11 722 (63 %)**,
 * mais **toutes antérieures au 03/08/2026** — le commit `0b1c592d` qui a introduit l'isolation
 * (`0` depuis septembre) — et **0 destinataire multi-guilde sur 81** ⇒ **aucune fuite effective**.
 * Le trou n'était donc pas actif : il était **hérité**. On le ferme quand même, parce que le
 * premier membre à rejoindre une 2ᵉ guilde (chantier `feat/inter-guilde`) l'aurait réveillé.
 */
function buildGuildScopeFilter(internalGuildId?: string) {
    if (!internalGuildId) return {};
    return { guildId: internalGuildId };
}

// --- Actions ---

export async function getUnreadNotifications(guildId?: string): Promise<{ success: boolean; data?: Notification[]; error?: string }> {
    const start = Date.now();
    const session = await auth();
    const authDone = Date.now();

    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // 🛡️ Fail-closed (15/10/2026) : sans guilde, la lecture n'était **pas scopée** (toutes les
    // guildes de la personne). Aucun appelant ne l'omet aujourd'hui — le garde rend la règle
    // explicite au lieu de dépendre d'un appel correct.
    if (!guildId) {
        logger.warn("[Notification] lecture refusée : guilde absente");
        return { success: false, error: "Guild required" };
    }

    const cacheKey = `notifs:unread:${session.user.id}:${guildId}`;

    try {
        // 1. Cache FIRST — évite le getUserContext lourd (~5s) à chaque poll (sidebar 10s).
        //    Le cache est scopé user+guilde et n'est peuplé qu'après un contrôle membre réussi
        //    (TTL 5s) => safe de le lire avant la vérification de membership.
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) {
            logger.debug(`[PERF] getUnreadNotifications: Returned from CACHE (${Date.now() - start}ms)`);
            return { success: true, data: JSON.parse(cached) as Notification[] };
        }

        // 2. SECURITY (I-XX): guild isolation — membre requis (fail-closed, docs/SECURITY.md)
        //    Les notifs système sans guilde restent visibles via le scope OR [guildId, null].
        let internalGuildId: string | undefined;
        if (guildId) {
            const ctx = await getUserContext(guildId);
            if (!ctx.isMember) {
                logger.warn(`[Notification] Blocked unread notifications access for user ${session.user.id} on unauthorized guild ${guildId}`);
                return { success: false, error: "Forbidden: Member access required" };
            }
            internalGuildId = await resolveInternalGuildId(guildId);
        }

        // 3. DB query — l'avatar de l'émetteur vient avec la ligne (une jointure, pas N+1).
        const notifications = await db.notification.findMany({
            where: {
                userId: session.user.id,
                read: false,
                ...buildGuildScopeFilter(internalGuildId),
            },
            orderBy: { createdAt: "desc" },
            take: 50, // PERF: limit results to prevent unbounded accumulation
            include: { user: { select: { image: true } } },
        });

        // 4. SECURITY RBAC: Filtrer les notifications administratives si l'utilisateur n'a pas la RBAC
        const ctx = guildId ? await getUserContext(guildId) : null;
        const filtered = notifications.filter(n => {
            if (n.category === "ADMIN_ALERT") {
                return !!(ctx?.isAdmin || ctx?.canValidateMissions || ctx?.canManageMembers);
            }
            return true;
        });

        const views = filtered.map(toNotificationView);

        // 5. Cache 10s (aligné sur le polling sidebar 10s => quasi-100% de hits)
        await redis.set(cacheKey, JSON.stringify(views), "EX", 10).catch(() => {});

        logger.debug(`[PERF] getUnreadNotifications: DB Fetch ${Date.now() - start}ms (Auth: ${authDone - start}ms, DB: ${Date.now() - authDone}ms)`);
        return { success: true, data: views };
    } catch (error) {
        logger.error("Get Notifications Error:", error);
        return { success: false, error: "Database error" };
    }
}

export async function getAllNotifications(guildId?: string, limit = 100): Promise<{ success: boolean; data?: Notification[]; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // 🛡️ Fail-closed (15/10/2026) — même règle que `getUnreadNotifications`.
    if (!guildId) {
        logger.warn("[Notification] lecture refusée : guilde absente");
        return { success: false, error: "Guild required" };
    }

    let internalGuildId: string | undefined;
    let ctx: any = null;
    if (guildId) {
        ctx = await getUserContext(guildId);
        if (!ctx.isMember) {
            return { success: false, error: "Forbidden: Member access required" };
        }
        internalGuildId = await resolveInternalGuildId(guildId);
    }

    try {
        const notifications = await db.notification.findMany({
            where: {
                userId: session.user.id,
                ...buildGuildScopeFilter(internalGuildId),
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            include: { user: { select: { image: true } } },
        });

        // SECURITY RBAC: Filtrer les notifications administratives si l'utilisateur n'a pas la RBAC
        const filtered = notifications.filter(n => {
            if (n.category === "ADMIN_ALERT") {
                return !!(ctx?.isAdmin || ctx?.canValidateMissions || ctx?.canManageMembers);
            }
            return true;
        });

        return { success: true, data: filtered.map(toNotificationView) };
    } catch (error) {
        logger.error("Get All Notifications Error:", error);
        return { success: false, error: "Database error" };
    }
}


export async function markAsRead(notificationId: string, guildId?: string) {
    const session = await auth();
    if (!session?.user?.id) return;

    // 🛡️ Fail-closed (15/10/2026) : sans guilde, le `updateMany` n'était pas scopé (il ne pouvait
    // toucher qu'un id, donc une ligne appartenant déjà à l'appelant — mais la règle est la même
    // partout, on ne dépend pas de cette nuance).
    if (!guildId) {
        logger.warn("[Notification] markAsRead refusé : guilde absente");
        return;
    }

    // SECURITY: verrouillage par guilde si fournie (cohérence multi-tenant)
    if (guildId) {
        const ctx = await getUserContext(guildId);
        if (!ctx.isMember) {
            logger.warn(`[Notification] Blocked mark-read for user ${session.user.id} on unauthorized guild ${guildId}`);
            return;
        }
    }

    try {
        const internalGuildId = await resolveInternalGuildId(guildId);
        await db.notification.updateMany({
            where: {
                id: notificationId,
                userId: session.user.id,
                read: false,
                ...buildGuildScopeFilter(internalGuildId),
            },
            data: { read: true },
        });
        // #28 — purge du cache « unread » (sinon la bulle persiste jusqu'au TTL 10s).
        invalidateUnreadCache(session.user.id, guildId);
        revalidatePath("/");
    } catch (error) {
        logger.error("Mark Read Error:", error);
    }
}

/**
 * Supprime définitivement une notification (bouton ✕ du centre).
 * Scopée comme les lectures : propriétaire + guilde (fail-closed).
 */
export async function deleteNotification(
    notificationId: string,
    guildId?: string
): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // 🛡️ Fail-closed (15/10/2026) — une suppression sans guilde n'était pas scopée.
    if (!guildId) {
        logger.warn("[Notification] suppression refusée : guilde absente");
        return { success: false, error: "Guild required" };
    }

    if (guildId) {
        const ctx = await getUserContext(guildId);
        if (!ctx.isMember) {
            logger.warn(`[Notification] Blocked delete for user ${session.user.id} on unauthorized guild ${guildId}`);
            return { success: false, error: "Forbidden: Member access required" };
        }
    }

    try {
        const internalGuildId = await resolveInternalGuildId(guildId);
        const res = await db.notification.deleteMany({
            where: {
                id: notificationId,
                userId: session.user.id,
                ...buildGuildScopeFilter(internalGuildId),
            },
        });
        if (res.count === 0) return { success: false, error: "Notification introuvable" };
        invalidateUnreadCache(session.user.id, guildId);
        revalidatePath("/");
        return { success: true };
    } catch (error) {
        logger.error("Delete Notification Error:", error);
        return { success: false, error: "Suppression impossible" };
    }
}

export async function markAllAsRead(guildId?: string) {
    const session = await auth();
    if (!session?.user?.id) return;

    // 🛡️ Fail-closed (15/10/2026) : sans guilde, ce `updateMany` marquait comme lues **toutes** les
    // notifications de la personne, toutes guildes confondues.
    if (!guildId) {
        logger.warn("[Notification] markAllAsRead refusé : guilde absente");
        return;
    }

    // SECURITY: guild isolation en écriture
    if (guildId) {
        const ctx = await getUserContext(guildId);
        if (!ctx.isMember) {
            logger.warn(`[Notification] Blocked mark-all-read for user ${session.user.id} on unauthorized guild ${guildId}`);
            return;
        }
    }

    try {
        const internalGuildId = await resolveInternalGuildId(guildId);
        await db.notification.updateMany({
            where: {
                userId: session.user.id,
                read: false,
                ...buildGuildScopeFilter(internalGuildId),
            },
            data: { read: true },
        });
        // #28 — purge du cache « unread » (sinon la bulle persiste jusqu'au TTL 10s).
        invalidateUnreadCache(session.user.id, guildId);
        revalidatePath("/");
    } catch (error) {
        logger.error("Mark All Read Error:", error);
    }
}

/**
 * Internal Helper to create notification
 * Respects user preferences stored in UserProfile
 */
export async function createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    link?: string,
    guildId?: string,
    category?: NotificationCategory,
    /**
     * Asset de l'objet annoncé (illustration de donjon, icône de Dofus, picto de succès) —
     * `null`/absent ⇒ repli sur le picto de la catégorie. C'est le **seul** moyen d'afficher
     * *quoi* est annoncé : le `link` n'est qu'un chemin d'écran, sans identifiant d'entité.
     */
    imageUrl?: string | null,
    /** Ce que l'asset représente (`NotificationImageKind`) — ignoré si le type est inconnu. */
    imageKind?: string | null
) {
    try {
        const finalCategory = category || inferCategory(type, title);

        // Résolution de l'ID interne de guilde (snowflake Discord → id interne) avant toute écriture.
        let internalGuildId: string | null = null;
        if (guildId) {
            const resolved = await resolveInternalGuildId(guildId);
            // ⚠️ `resolveInternalGuildId` rend l'entrée **telle quelle** quand la recherche par
            // snowflake échoue : un identifiant Discord long **inchangé** n'est donc pas un id
            // interne (il n'existe pas dans `GuildConfig`). On le traite comme « non résolu » ici,
            // plutôt que de laisser Prisma rejeter une clé étrangère (l'erreur ne disait pas
            // pourquoi, et l'annonce disparaissait dans un `logger.error` générique).
            internalGuildId = resolved && !(guildId.length > 15 && resolved === guildId) ? resolved : null;
        }

        // 🛡️ **FAIL-CLOSED (15/10/2026) — aucune notification sans guilde.**
        //
        // Avant, une guilde non résolue (`guildId` absent, ou snowflake Discord inconnu de
        // `GuildConfig` : fenêtre d'onboarding, identifiant passé sous une autre forme) produisait
        // une ligne `guildId: null`, et **sautait au passage le contrôle de préférences** (il était
        // niché dans le `if (internalGuildId)`). Deux défauts pour un : une annonce que le membre
        // ne pouvait **pas couper**, et qu'il voyait dans **toutes** ses guildes.
        //
        // Conséquence assumée : une annonce dont la guilde ne peut pas être identifiée est
        // **perdue** (journalisée) au lieu d'être mal rangée. Les émetteurs qui passaient un
        // identifiant non résolu (`geoguesser-multi-actions`, `metamob-worker`, DJ, feedback) ont
        // été corrigés dans le même lot : soit ils passent la guilde, soit ils n'écrivent rien.
        if (!internalGuildId) {
            logger.warn("[Notification] annonce non écrite : guilde non résolue", {
                type,
                guildId: guildId ?? null,
                userId,
            });
            return;
        }

        // Contrôle des préférences du membre — **toujours atteint** désormais (la guilde est
        // résolue), donc plus aucun interrupteur ne peut être contourné.
        const profile = await db.userProfile.findUnique({
            where: { userId_guildId: { userId, guildId: internalGuildId } },
            select: { notificationPrefs: true }
        });

        if (profile?.notificationPrefs) {
            const prefs = profile.notificationPrefs as any;

            // Stop if preference is explicitly false
            if (finalCategory === "MISSION" && prefs.missions === false) return;
            if (finalCategory === "SUCCESS" && prefs.ladder === false) return;
            if (finalCategory === "SONGES" && prefs.songes === false) return;
            if (finalCategory === "EVENT" && prefs.events === false) return;
            if (finalCategory === "POLL" && prefs.polls === false) return;
            if (finalCategory === "OCRE" && prefs.ocre === false) return;
            if (finalCategory === "DONJONS" && prefs.donjons === false) return;
            if (finalCategory === "ADMIN_ALERT" && prefs.admin_validations === false) return;
            // §11.9 — Marché : un booléen **par type** (`market.<clé>`),
            // défaut activé ; seul un `false` explicite coupe la notif.
            if (
                finalCategory === "MARKET"
                && !isMarketNotificationEnabled(prefs, type as MarketNotificationType)
            ) return;
        }

        // 2. Create Notification
        await db.notification.create({
            data: {
                userId,
                type,
                category: finalCategory,
                title,
                message,
                link: link || null,
                guildId: internalGuildId,
                // Asset de l'objet : borné au chemin servi par l'app, jamais une URL arbitraire
                // (une notification ne doit pas pouvoir pointer n'importe où).
                imageUrl: sanitizeNotificationImageUrl(imageUrl),
                imageKind: isNotificationImageKind(imageKind) ? imageKind : null,
            }
        });

        // #28 — invalide le cache « unread » du destinataire → bulle à jour sans attendre le TTL 10s.
        invalidateUnreadCache(userId, guildId);
    } catch (error) {
        logger.error("[Notification] Creation Failed:", error);
    }
}

/**
 * #28 — purge les caches Redis « unread » (TTL 10s) après une lecture/écriture pour
 * que la bulle de notifications se mette à jour immédiatement, partout (sidebar/topbar).
 */
function invalidateUnreadCache(userId: string, guildId?: string) {
    const keys = [
        `notifs:unread:${userId}`,
        ...(guildId ? [`notifs:unread:${userId}:${guildId}`] : []),
    ];
    Promise.all(keys.map(k => redis.del(k).catch(() => {}))).catch(() => {});
}