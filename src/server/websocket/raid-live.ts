/**
 * Lot 2 — temps réel des sessions live de raid.
 *
 * Même architecture que `guide-presence.ts` :
 * Redis pub/sub → room Socket.IO → broadcast client.
 *
 *   - Les server actions PUBLIENT sur `raid-live:<eventId>` (canal construit par
 *     la règle pure `raidLiveChannel`, `src/lib/raid-live.ts`) → ce module s'y
 *     abonne (psubscribe `raid-live:*`) et diffuse à la room
 *     `guild:<guildId>:raid-live:<eventId>` après batching (500 ms).
 *   - Heartbeat de présence éphémère : Set Redis
 *     `raid-live:presence:<guildId>:<eventId>` avec EXPIRE 45 s (compteur
 *     « x/y inscrits ont l'overlay ouvert », lot 4c). ZÉRO écriture Postgres.
 *   - Guild isolation fail-closed : chaque handler vérifie l'appartenance
 *     (isMemberOfGuild) avant de rejoindre une room.
 *
 * Events Socket.IO vers le client :
 *   - `raid-live:event` : tableau d'events `{ kind, at }` (batch 500 ms) ;
 *   - `raid-live:presence:update` : snapshot `{ guildId, eventId, members[] }`.
 */
import { Server, Socket } from "socket.io";
import { redis } from "../../lib/redis";
import { logger } from "../../lib/logger";
import { resolveActiveProfileIdentity } from "./guide-presence";

export const raidLiveRoom = (guildId: string, eventId: string): string =>
    `guild:${guildId}:raid-live:${eventId}`;

export interface RaidLiveClientEvent {
    kind: string;
    at: number;
}

const RAID_LIVE_PRESENCE_PREFIX = "raid-live:presence";
const PRESENCE_TTL_SECONDS = 45;
const BATCH_WINDOW_MS = 500;

type PresenceEntry = {
    profileId: string;
    userName: string;
    userAvatar?: string;
    lastSeen: number;
};

export type RaidLivePresenceConfig = {
    io: Server;
    subClient: ReturnType<typeof redis.duplicate>;
    wsAuthEnabled: boolean;
    isMemberOfGuild: (userId: string, discordGuildId: string) => Promise<boolean>;
};

export type RaidLiveJoinData = { guildId?: string; eventId?: string };
export type RaidLiveHeartbeatData = RaidLiveJoinData & { userName?: string; userAvatar?: string };

/** `eventId` plausible (cuid/guildEvent) : borné, jamais un canal fantaisiste. */
function isValidEventId(eventId: unknown): eventId is string {
    return typeof eventId === "string" && /^[a-z0-9]{6,40}$/i.test(eventId);
}

export function createRaidLivePresence(config: RaidLivePresenceConfig) {
    const { io, subClient, wsAuthEnabled, isMemberOfGuild } = config;

    const eventQueue = new Map<string, RaidLiveClientEvent[]>();
    const eventTimers = new Map<string, NodeJS.Timeout>();
    const presenceQueued = new Set<string>();
    const presenceTimers = new Map<string, NodeJS.Timeout>();

    function queueEvent(room: string, event: RaidLiveClientEvent) {
        const list = eventQueue.get(room) ?? [];
        list.push(event);
        eventQueue.set(room, list);
        if (!eventTimers.has(room)) {
            eventTimers.set(room, setTimeout(() => {
                eventTimers.delete(room);
                const events = eventQueue.get(room);
                eventQueue.delete(room);
                if (events && events.length > 0) {
                    io.to(room).emit("raid-live:event", events);
                }
            }, BATCH_WINDOW_MS));
        }
    }

    function presenceKey(guildId: string, eventId: string): string {
        return `${RAID_LIVE_PRESENCE_PREFIX}:${guildId}:${eventId}`;
    }

    async function getPresenceMembers(guildId: string, eventId: string): Promise<PresenceEntry[]> {
        const key = presenceKey(guildId, eventId);
        const raw = await redis.smembers(key);
        const now = Date.now();
        const byProfile = new Map<string, PresenceEntry>();
        const stale: string[] = [];
        for (const item of raw) {
            try {
                const entry = JSON.parse(item) as PresenceEntry;
                if (now - entry.lastSeen > PRESENCE_TTL_SECONDS * 1000) {
                    stale.push(item);
                } else {
                    byProfile.set(entry.profileId, entry);
                }
            } catch {
                stale.push(item);
            }
        }
        if (stale.length > 0) {
            await redis.srem(key, ...stale).catch(() => {});
        }
        return Array.from(byProfile.values());
    }

    async function touchPresence(guildId: string, eventId: string, entry: Omit<PresenceEntry, "lastSeen">) {
        const key = presenceKey(guildId, eventId);
        await getPresenceMembers(guildId, eventId);
        await redis.sadd(key, JSON.stringify({ ...entry, lastSeen: Date.now() }));
        await redis.expire(key, PRESENCE_TTL_SECONDS);
    }

    async function broadcastPresence(guildId: string, eventId: string) {
        const members = await getPresenceMembers(guildId, eventId);
        io.to(raidLiveRoom(guildId, eventId)).emit("raid-live:presence:update", {
            guildId,
            eventId,
            members: members.map(({ profileId, userName, userAvatar }) => ({ profileId, userName, userAvatar })),
        });
    }

    function queuePresenceBroadcast(room: string, guildId: string, eventId: string) {
        if (presenceQueued.has(room)) return;
        presenceQueued.add(room);
        presenceTimers.set(room, setTimeout(() => {
            presenceQueued.delete(room);
            presenceTimers.delete(room);
            void broadcastPresence(guildId, eventId);
        }, BATCH_WINDOW_MS));
    }

    // Abonnement Redis aux events publiés par les server actions.
    subClient.psubscribe("raid-live:*", (err) => {
        if (err) logger.error("[RaidLive] ❌ Erreur abonnement raid-live:*", { error: err });
    });

    subClient.on("pmessage", (_pattern, channel, message) => {
        try {
            // canal = `raid-live:<eventId>` (l'eventId ne contient jamais `:`)
            const parts = channel.split(":");
            if (parts.length !== 2 || parts[0] !== "raid-live") return;
            const eventId = parts[1];
            if (!isValidEventId(eventId)) return;
            const payload = JSON.parse(message) as { kind?: unknown; at?: unknown; guildId?: unknown };
            if (typeof payload.kind !== "string" || typeof payload.guildId !== "string") return;
            queueEvent(raidLiveRoom(payload.guildId, eventId), {
                kind: payload.kind,
                at: typeof payload.at === "number" ? payload.at : Date.now(),
            });
        } catch (e) {
            logger.error("[RaidLive] ❌ Erreur parsing event", { error: e });
        }
    });

    async function handleJoin(socket: Socket, data: RaidLiveJoinData) {
        if (!data.guildId || !isValidEventId(data.eventId)) return;
        const userId = socket.data.userId as string | undefined;
        if (wsAuthEnabled) {
            if (!userId) return;
            const allowed = await isMemberOfGuild(userId, data.guildId);
            if (!allowed) return;
        }
        socket.join(raidLiveRoom(data.guildId, data.eventId));
        if (wsAuthEnabled && userId) {
            const identity = await resolveActiveProfileIdentity(userId, data.guildId);
            if (identity) socket.data.raidLiveIdentity = identity;
        }
        const members = await getPresenceMembers(data.guildId, data.eventId);
        socket.emit("raid-live:presence:update", {
            guildId: data.guildId,
            eventId: data.eventId,
            members: members.map(({ profileId, userName, userAvatar }) => ({ profileId, userName, userAvatar })),
        });
    }

    async function handleLeave(socket: Socket, data: RaidLiveJoinData) {
        if (!data.guildId || !isValidEventId(data.eventId)) return;
        socket.leave(raidLiveRoom(data.guildId, data.eventId));
    }

    async function handleHeartbeat(socket: Socket, data: RaidLiveHeartbeatData) {
        if (!data.guildId || !isValidEventId(data.eventId)) return;
        let profileId: string | null = null;
        const identity = socket.data.raidLiveIdentity as { profileId: string; userName?: string; userAvatar?: string } | undefined;
        if (wsAuthEnabled) {
            if (!identity?.profileId) return;
            profileId = identity.profileId;
        } else {
            return;
        }
        await touchPresence(data.guildId, data.eventId, {
            profileId,
            userName: data.userName || identity?.userName || "Membre",
            userAvatar: data.userAvatar || identity?.userAvatar,
        });
        queuePresenceBroadcast(raidLiveRoom(data.guildId, data.eventId), data.guildId, data.eventId);
    }

    return { handleJoin, handleLeave, handleHeartbeat, raidLiveRoom };
}
