/**
 * Révocation d'accès aux guildes côté process WS (audit 13/11/2026, lot 4f).
 *
 * Deux mécanismes complémentaires :
 *
 *  1. **Canal `guild:member:revoked`** — le serveur Next publie dès qu'une
 *     exclusion/archivage est enregistré (actions admin, God, cron). Le socket
 *     de l'utilisateur est retiré de `guild:<id>` et de ses sous-rooms, prévenu
 *     (`guild:access-revoked`), puis **coupé**. Couper est nécessaire : les
 *     heartbeats guide/dofus ne font aucune requête DB et continueraient sinon
 *     à publier la présence d'un non-membre.
 *
 *  2. **Sweep d'appartenance** (toutes les 60 s par défaut) — compare les
 *     couples (utilisateur, guilde) présents dans les rooms aux profils
 *     réellement `ACTIVE`. C'est le filet indépendant de « qui a archivé » :
 *     il couvre le bot Discord (qui n'a pas de client Redis), les exclusions
 *     faites sur Discord, les `updateMany` en masse et un publish perdu.
 *
 * Fail-closed : l'appartenance est toujours lue en base, jamais déduite d'un
 * cache. Une erreur de sweep laisse simplement la passe suivante réessayer.
 */
import type { Server } from "socket.io";
import { redis } from "../../lib/redis";
import { logger } from "../../lib/logger";
import {
    GUILD_ACCESS_REVOKED_EVENT,
    GUILD_MEMBER_REVOKED_CHANNEL,
    collectSocketGuildPairs,
    pairKey,
    parseGuildMemberRevoked,
    planRevocations,
    roomsToLeaveForGuild,
    sweepIntervalMs,
    type GuildMemberRevokedPayload,
    type GuildRevocationReason,
} from "../../lib/ws-guild-revocation";

export type GuildRevocationConfig = {
    io: Server;
    subClient: ReturnType<typeof redis.duplicate>;
    wsAuthEnabled: boolean;
};

export function createGuildRevocation(config: GuildRevocationConfig) {
    const { io, subClient, wsAuthEnabled } = config;
    let sweepTimer: NodeJS.Timeout | null = null;
    let sweepRunning = false;

    /** Résout l'utilisateur interne : fourni par le web, sinon via le compte Discord. */
    async function resolveUserId(payload: GuildMemberRevokedPayload): Promise<string | null> {
        if (payload.userId) return payload.userId;
        if (!payload.discordId) return null;
        try {
            const { db } = await import("../../lib/prisma");
            const account = await db.account.findFirst({
                where: { provider: "discord", providerAccountId: payload.discordId },
                select: { userId: true },
            });
            return account?.userId ?? null;
        } catch (err) {
            logger.warn("[WS] résolution du compte Discord impossible", { error: err });
            return null;
        }
    }

    /**
     * Coupe tous les sockets de l'utilisateur abonnés à cette guilde.
     * Retourne le nombre de sockets effectivement coupés (0 = déjà absent).
     */
    async function revokeUserFromGuild(
        userId: string,
        discordGuildId: string,
        reason: GuildRevocationReason
    ): Promise<number> {
        let sockets;
        try {
            sockets = await io.in(`user:${userId}`).fetchSockets();
        } catch (err) {
            logger.warn("[WS] lecture des sockets impossible pour une révocation", { error: err });
            return 0;
        }

        let revoked = 0;
        for (const socket of sockets) {
            const rooms = roomsToLeaveForGuild(socket.rooms, discordGuildId);
            if (rooms.length === 0) continue;
            socket.emit(GUILD_ACCESS_REVOKED_EVENT, { guildId: discordGuildId, reason });
            for (const room of rooms) {
                await socket.leave(room);
            }
            await socket.disconnect(true);
            revoked++;
        }
        return revoked;
    }

    async function handleRevokedMessage(raw: string): Promise<void> {
        const payload = parseGuildMemberRevoked(raw);
        if (!payload) {
            logger.warn("[WS] message de révocation ignoré (payload invalide)");
            return;
        }
        const userId = await resolveUserId(payload);
        if (!userId) return;
        try {
            const count = await revokeUserFromGuild(userId, payload.discordGuildId, payload.reason);
            if (count > 0) {
                logger.info("[WS] accès guilde révoqué en direct", { reason: payload.reason, sockets: count });
            }
        } catch (err) {
            logger.warn("[WS] révocation directe échouée — le sweep reprendra", { error: err });
        }
    }

    /** Une passe : sockets → couples → profils ACTIVE → révocation de la différence. */
    async function sweepOnce(): Promise<void> {
        if (!wsAuthEnabled || sweepRunning) return;
        sweepRunning = true;
        try {
            const sockets = await io.fetchSockets();
            const { pairs, truncated } = collectSocketGuildPairs(
                sockets.map((socket) => ({
                    userId: socket.data?.userId as string | undefined,
                    rooms: socket.rooms,
                }))
            );
            if (pairs.length === 0) return;

            const userIds = [...new Set(pairs.map((pair) => pair.userId))];
            const guildIds = [...new Set(pairs.map((pair) => pair.guildId))];
            const { db } = await import("../../lib/prisma");
            const activeProfiles = await db.userProfile.findMany({
                where: {
                    status: "ACTIVE",
                    userId: { in: userIds },
                    guild: { discordGuildId: { in: guildIds } },
                },
                select: { userId: true, guild: { select: { discordGuildId: true } } },
            });
            const activePairs = new Set(
                activeProfiles.map((profile) => pairKey(profile.userId, profile.guild.discordGuildId))
            );
            const revocations = planRevocations(pairs, activePairs);

            let revokedSockets = 0;
            for (const pair of revocations) {
                revokedSockets += await revokeUserFromGuild(pair.userId, pair.guildId, "SWEEP");
            }
            if (revocations.length > 0 || truncated) {
                logger.info("[WS] sweep d'appartenance", {
                    sockets: sockets.length,
                    pairs: pairs.length,
                    revokedPairs: revocations.length,
                    revokedSockets,
                    truncated,
                });
            }
        } catch (err) {
            logger.warn("[WS] sweep d'appartenance échoué — nouvelle tentative au prochain passage", {
                error: err,
            });
        } finally {
            sweepRunning = false;
        }
    }

    subClient.subscribe(GUILD_MEMBER_REVOKED_CHANNEL, (err) => {
        if (err) {
            logger.error("[WS] ❌ Erreur abonnement Redis guild:member:revoked", { error: err });
        }
    });

    subClient.on("message", (channel: string, message: string) => {
        if (channel !== GUILD_MEMBER_REVOKED_CHANNEL) return;
        void handleRevokedMessage(message);
    });

    function startSweep(): void {
        if (!wsAuthEnabled || sweepTimer) return;
        const intervalMs = sweepIntervalMs(process.env.WS_MEMBERSHIP_SWEEP_MS);
        sweepTimer = setInterval(() => {
            void sweepOnce();
        }, intervalMs);
        sweepTimer.unref?.();
        logger.info("[WS] sweep d'appartenance actif", { intervalMs });
    }

    function stop(): void {
        if (sweepTimer) {
            clearInterval(sweepTimer);
            sweepTimer = null;
        }
    }

    startSweep();

    return { stop, sweepOnce, revokeUserFromGuild };
}
