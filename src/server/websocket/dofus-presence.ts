/**
 * PAGE PAR-DOFUS — Présence temps réel (chantier #37, suite).
 *
 * Même architecture que guide-presence.ts (Ganymède) :
 * Redis pub/sub → room Socket.IO → broadcast client.
 *
 *   - Les server actions PUBLIENT des events sur `dofus:${guildId}:${slug}`
 *     (voir src/lib/dofus-realtime.ts) → ce module s'y abonne (psubscribe
 *     `dofus:*`) et les diffuse à la room `guild:<guildId>:dofus:<slug>`.
 *   - Heartbeat de présence éphémère : Set Redis `dofus:presence:${guildId}:${slug}`
 *     avec EXPIRE 45s ; les entrées non rafraîchies depuis 45s sont purgées.
 *     ZÉRO écriture Postgres pour la présence.
 *   - Position courante du membre = `questId` (quête ouverte / survolée), l'équivalent
 *     du `milestoneId` de la timeline Ganymède.
 *   - Batching des broadcasts : fenêtre glissante 500ms par room.
 *   - Guild isolation fail-closed : chaque handler vérifie l'appartenance
 *     (isMemberOfGuild) avant de rejoindre une room.
 *
 * Events Socket.IO émis vers le client (consommés par use-dofus-presence) :
 *   - `dofus:event` : tableau d'events DofusRealtimeEvent (batch 500ms) ;
 *   - `dofus:presence:update` : snapshot de présence `{ guildId, dofusSlug, members[] }`.
 */
import { Server, Socket } from "socket.io";
import { redis } from "../../lib/redis";
import { logger } from "../../lib/logger";
import type { DofusRealtimeEvent } from "../../lib/dofus-realtime";
import { resolveActiveProfileIdentity } from "./guide-presence";

export const dofusRoom = (guildId: string, dofusSlug: string): string => `guild:${guildId}:dofus:${dofusSlug}`;

const DOFUS_PRESENCE_PREFIX = "dofus:presence";
const PRESENCE_TTL_SECONDS = 45;
const BATCH_WINDOW_MS = 500;

type PresenceEntry = {
  profileId: string;
  userName: string;
  userAvatar?: string;
  questId: string;
  lastSeen: number;
};

export type DofusPresenceConfig = {
  io: Server;
  subClient: ReturnType<typeof redis.duplicate>;
  wsAuthEnabled: boolean;
  isMemberOfGuild: (userId: string, discordGuildId: string) => Promise<boolean>;
};

export type DofusJoinData = { guildId?: string; dofusSlug?: string };
export type DofusHeartbeatData = DofusJoinData & { questId?: string; userName?: string; userAvatar?: string; profileId?: string };

export function createDofusPresence(config: DofusPresenceConfig) {
  const { io, subClient, wsAuthEnabled, isMemberOfGuild } = config;

  // ─── Batching par room (events d'action + broadcast présence) ───────────────
  const eventQueue = new Map<string, DofusRealtimeEvent[]>();
  const eventTimers = new Map<string, NodeJS.Timeout>();
  const presenceQueued = new Set<string>();
  const presenceTimers = new Map<string, NodeJS.Timeout>();

  function queueEvent(room: string, event: DofusRealtimeEvent) {
    const list = eventQueue.get(room) ?? [];
    list.push(event);
    eventQueue.set(room, list);
    if (!eventTimers.has(room)) {
      eventTimers.set(room, setTimeout(() => {
        eventTimers.delete(room);
        const events = eventQueue.get(room);
        eventQueue.delete(room);
        if (events && events.length > 0) {
          io.to(room).emit("dofus:event", events);
          logger.debug(`[DofusPresence] ⚡ broadcast ${events.length} event(s) → ${room}`);
        }
      }, BATCH_WINDOW_MS));
    }
  }

  function queuePresenceBroadcast(room: string, guildId: string, dofusSlug: string) {
    if (presenceQueued.has(room)) return;
    presenceQueued.add(room);
    presenceTimers.set(room, setTimeout(() => {
      presenceQueued.delete(room);
      presenceTimers.delete(room);
      void broadcastPresence(guildId, dofusSlug);
    }, BATCH_WINDOW_MS));
  }

  // ─── Set de présence éphémère (ZÉRO écriture Postgres) ──────────────────────
  function presenceKey(guildId: string, dofusSlug: string): string {
    return `${DOFUS_PRESENCE_PREFIX}:${guildId}:${dofusSlug}`;
  }

  async function getPresenceMembers(guildId: string, dofusSlug: string): Promise<PresenceEntry[]> {
    const key = presenceKey(guildId, dofusSlug);
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
          // Un membre peut avoir plusieurs connexions (2 onglets, mobile + desktop) :
          // on garde la DERNIÈRE entrée pour ne jamais dédoublonner dans la facepile.
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

  async function touchPresence(guildId: string, dofusSlug: string, entry: Omit<PresenceEntry, "lastSeen">) {
    const key = presenceKey(guildId, dofusSlug);
    await getPresenceMembers(guildId, dofusSlug); // purge des entrées expirées
    await redis.sadd(key, JSON.stringify({ ...entry, lastSeen: Date.now() }));
    await redis.expire(key, PRESENCE_TTL_SECONDS);
  }

  async function broadcastPresence(guildId: string, dofusSlug: string) {
    const members = await getPresenceMembers(guildId, dofusSlug);
    const publicMembers = members.map(({ profileId, userName, userAvatar, questId }) => ({
      profileId,
      userName,
      userAvatar,
      questId,
    }));
    io.to(dofusRoom(guildId, dofusSlug)).emit("dofus:presence:update", {
      guildId,
      dofusSlug,
      members: publicMembers,
    });
  }

  // ─── Abonnement Redis aux events publiés par les server actions ─────────────
  subClient.psubscribe("dofus:*", (err) => {
    if (err) logger.error("[DofusPresence] ❌ Erreur abonnement dofus:*", { error: err });
  });

  subClient.on("pmessage", (_pattern, channel, message) => {
    try {
      // canal = `dofus:${guildId}:${dofusSlug}`
      const parts = channel.split(":");
      if (parts.length < 3 || parts[0] !== "dofus") return;
      const guildId = parts[1];
      const dofusSlug = parts.slice(2).join(":");
      const payload = JSON.parse(message) as DofusRealtimeEvent;
      queueEvent(dofusRoom(guildId, dofusSlug), payload);
    } catch (e) {
      logger.error("[DofusPresence] ❌ Erreur parsing event dofus", { error: e });
    }
  });

  // ─── Handlers Socket.IO (enregistrés dans server.ts) ────────────────────────
  async function handleJoin(socket: Socket, data: DofusJoinData) {
    if (!data.guildId || !data.dofusSlug) return;
    const userId = socket.data.userId as string | undefined;
    if (wsAuthEnabled) {
      if (!userId) return; // fail-closed : pas d'identité, pas de room
      const allowed = await isMemberOfGuild(userId, data.guildId);
      if (!allowed) return;
    }
    socket.join(dofusRoom(data.guildId, data.dofusSlug));
    logger.info(`[DofusPresence] 👥 ${socket.id} rejoint ${dofusRoom(data.guildId, data.dofusSlug)}`);
    // Notif d'arrivée sur la page (questId vide = arrivée, pas une position de quête).
    if (wsAuthEnabled && userId) {
      const identity = await resolveActiveProfileIdentity(userId, data.guildId);
      if (identity) {
        // Identité résolue UNE fois → les heartbeats suivants ne font AUCUNE requête DB.
        socket.data.dofusIdentity = identity;
        queueEvent(dofusRoom(data.guildId, data.dofusSlug), {
          type: "presence:join",
          profileId: identity.profileId,
          userName: identity.userName,
          userAvatar: identity.userAvatar,
          questId: "",
        });
      }
    }
    // État présent initial (snapshot) pour le nouveau venu uniquement
    const members = await getPresenceMembers(data.guildId, data.dofusSlug);
    socket.emit("dofus:presence:update", {
      guildId: data.guildId,
      dofusSlug: data.dofusSlug,
      members: members.map(({ profileId, userName, userAvatar, questId }) => ({ profileId, userName, userAvatar, questId })),
    });
  }

  async function handleLeave(socket: Socket, data: DofusJoinData) {
    if (!data.guildId || !data.dofusSlug) return;
    socket.leave(dofusRoom(data.guildId, data.dofusSlug));
    logger.info(`[DofusPresence] 🚪 ${socket.id} quitte ${dofusRoom(data.guildId, data.dofusSlug)}`);
    // Notif de départ de la page (questId vide = départ).
    const identity = socket.data.dofusIdentity as { profileId: string; userName?: string; userAvatar?: string } | undefined;
    if (identity?.profileId) {
      queueEvent(dofusRoom(data.guildId, data.dofusSlug), {
        type: "presence:leave",
        profileId: identity.profileId,
        userName: identity.userName,
        questId: "",
      });
    }
  }

  async function handleHeartbeat(socket: Socket, data: DofusHeartbeatData) {
    if (!data.guildId || !data.dofusSlug || !data.questId) return;

    // Identité résolue UNE SEULE fois au `dofus:join` et mémorisée sur le socket.
    let profileId: string | null = null;
    const identity = socket.data.dofusIdentity as { profileId: string; userName?: string; userAvatar?: string } | undefined;
    if (wsAuthEnabled) {
      if (!identity?.profileId) return; // fail-closed : pas d'identité join → pas de heartbeat
      profileId = identity.profileId;
    } else {
      if (!data.profileId) return;
      profileId = data.profileId;
    }

    await touchPresence(data.guildId, data.dofusSlug, {
      profileId,
      userName: data.userName || identity?.userName || "Membre",
      userAvatar: data.userAvatar || identity?.userAvatar,
      questId: data.questId,
    });
    queuePresenceBroadcast(dofusRoom(data.guildId, data.dofusSlug), data.guildId, data.dofusSlug);
  }

  return { handleJoin, handleLeave, handleHeartbeat, dofusRoom };
}

