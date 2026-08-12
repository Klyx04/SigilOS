/**
 * GANYMEDE — Présence temps réel du module guide (Phase E).
 *
 * Même architecture que la révocation God (R4, socket-r4.ts) :
 * Redis pub/sub → room Socket.IO → broadcast client.
 *
 *   - Les server actions PUBLIENT des events sur `guide:${guildId}:${guideSlug}`
 *     (voir src/lib/guide-realtime.ts) → ce module s'y abonne (psubscribe
 *     `guide:*`) et les diffuse à la room `guild:<guildId>:guide:<slug>`.
 *   - Heartbeat de présence éphémère : Set Redis `guide:presence:${guildId}:${slug}`
 *     avec EXPIRE 45s ; les entrées non rafraîchies depuis 45s sont purgées.
 *     ZÉRO écriture Postgres pour la présence.
 *   - Batching des broadcasts : fenêtre glissante 500ms par room (jamais un
 *     broadcast par event brut).
 *   - Guild isolation fail-closed : chaque handler vérifie l'appartenance
 *     (isMemberOfGuild) avant de rejoindre une room.
 *
 * Events Socket.IO émis vers le client (consommés par use-guide-presence, Phase F) :
 *   - `guide:event` : tableau d'events GuideRealtimeEvent (batch 500ms) ;
 *   - `guide:presence:update` : snapshot de présence `{ guildId, guideSlug, members[] }`.
 */
import { Server, Socket } from "socket.io";
import { redis } from "../../lib/redis";
import { logger } from "../../lib/logger";
import type { GuideRealtimeEvent } from "../../lib/guide-realtime";

export const guideRoom = (guildId: string, guideSlug: string): string => `guild:${guildId}:guide:${guideSlug}`;

const GUIDE_PRESENCE_PREFIX = "guide:presence";
const PRESENCE_TTL_SECONDS = 45;
const BATCH_WINDOW_MS = 500;

type PresenceEntry = {
  profileId: string;
  userName: string;
  userAvatar?: string;
  milestoneId: string;
  lastSeen: number;
};

export type GuidePresenceConfig = {
  io: Server;
  subClient: ReturnType<typeof redis.duplicate>;
  wsAuthEnabled: boolean;
  isMemberOfGuild: (userId: string, discordGuildId: string) => Promise<boolean>;
};

export type GuideJoinData = { guildId?: string; guideSlug?: string };
export type GuideHeartbeatData = GuideJoinData & { milestoneId?: string; userName?: string; userAvatar?: string; profileId?: string };

export function createGuidePresence(config: GuidePresenceConfig) {
  const { io, subClient, wsAuthEnabled, isMemberOfGuild } = config;

  // ─── Batching par room (events d'action + broadcast présence) ───────────────
  const eventQueue = new Map<string, GuideRealtimeEvent[]>();
  const eventTimers = new Map<string, NodeJS.Timeout>();
  const presenceQueued = new Set<string>();
  const presenceTimers = new Map<string, NodeJS.Timeout>();

  function queueEvent(room: string, event: GuideRealtimeEvent) {
    const list = eventQueue.get(room) ?? [];
    list.push(event);
    eventQueue.set(room, list);
    if (!eventTimers.has(room)) {
      eventTimers.set(room, setTimeout(() => {
        eventTimers.delete(room);
        const events = eventQueue.get(room);
        eventQueue.delete(room);
        if (events && events.length > 0) {
          io.to(room).emit("guide:event", events);
          logger.debug(`[GuidePresence] ⚡ broadcast ${events.length} event(s) → ${room}`);
        }
      }, BATCH_WINDOW_MS));
    }
  }

  function queuePresenceBroadcast(room: string, guildId: string, guideSlug: string) {
    if (presenceQueued.has(room)) return;
    presenceQueued.add(room);
    presenceTimers.set(room, setTimeout(() => {
      presenceQueued.delete(room);
      presenceTimers.delete(room);
      void broadcastPresence(guildId, guideSlug);
    }, BATCH_WINDOW_MS));
  }

  // ─── Set de présence éphémère (ZÉRO écriture Postgres) ──────────────────────
  function presenceKey(guildId: string, guideSlug: string): string {
    return `${GUIDE_PRESENCE_PREFIX}:${guildId}:${guideSlug}`;
  }

  async function getPresenceMembers(guildId: string, guideSlug: string): Promise<PresenceEntry[]> {
    const key = presenceKey(guildId, guideSlug);
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
          // le Set Redis contient alors plusieurs entrées pour le même profileId
          // (lastSeen différent). On garde la DERNIÈRE pour ne jamais dédoublonner
          // un membre dans la facepile / les modales de présence.
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

  async function touchPresence(guildId: string, guideSlug: string, entry: Omit<PresenceEntry, "lastSeen">) {
    const key = presenceKey(guildId, guideSlug);
    await getPresenceMembers(guildId, guideSlug); // purge des entrées expirées
    await redis.sadd(key, JSON.stringify({ ...entry, lastSeen: Date.now() }));
    await redis.expire(key, PRESENCE_TTL_SECONDS);
  }

  async function broadcastPresence(guildId: string, guideSlug: string) {
    const members = await getPresenceMembers(guildId, guideSlug);
    const publicMembers = members.map(({ profileId, userName, userAvatar, milestoneId }) => ({
      profileId,
      userName,
      userAvatar,
      milestoneId,
    }));
    io.to(guideRoom(guildId, guideSlug)).emit("guide:presence:update", {
      guildId,
      guideSlug,
      members: publicMembers,
    });
  }

  // ─── Abonnement Redis aux events publiés par les server actions ─────────────
  subClient.psubscribe("guide:*", (err) => {
    if (err) logger.error("[GuidePresence] ❌ Erreur abonnement guide:*", { error: err });
  });

  subClient.on("pmessage", (_pattern, channel, message) => {
    try {
      // canal = `guide:${guildId}:${guideSlug}`
      const parts = channel.split(":");
      if (parts.length < 3 || parts[0] !== "guide") return;
      const guildId = parts[1];
      const guideSlug = parts.slice(2).join(":");
      const payload = JSON.parse(message) as GuideRealtimeEvent;
      queueEvent(guideRoom(guildId, guideSlug), payload);
    } catch (e) {
      logger.error("[GuidePresence] ❌ Erreur parsing event guide", { error: e });
    }
  });

  // ─── Handlers Socket.IO (enregistrés dans server.ts) ────────────────────────
  async function handleJoin(socket: Socket, data: GuideJoinData) {
    if (!data.guildId || !data.guideSlug) return;
    const userId = socket.data.userId as string | undefined;
    if (wsAuthEnabled) {
      if (!userId) return; // fail-closed : pas d'identité, pas de room
      const allowed = await isMemberOfGuild(userId, data.guildId);
      if (!allowed) return;
    }
    socket.join(guideRoom(data.guildId, data.guideSlug));
    logger.info(`[GuidePresence] 👥 ${socket.id} rejoint ${guideRoom(data.guildId, data.guideSlug)}`);
    // Notif d'arrivée sur le guide (milestoneId vide = arrivée, pas une position de jalon).
    if (wsAuthEnabled && userId) {
      const identity = await resolveActiveProfileIdentity(userId, data.guildId);
      if (identity) {
        queueEvent(guideRoom(data.guildId, data.guideSlug), {
          type: "presence:join",
          profileId: identity.profileId,
          userName: identity.userName,
          userAvatar: identity.userAvatar,
          milestoneId: "",
        });
      }
    }
    // État présent initial (snapshot) pour le nouveau venu uniquement
    const members = await getPresenceMembers(data.guildId, data.guideSlug);
    socket.emit("guide:presence:update", {
      guildId: data.guildId,
      guideSlug: data.guideSlug,
      members: members.map(({ profileId, userName, userAvatar, milestoneId }) => ({ profileId, userName, userAvatar, milestoneId })),
    });
  }

  async function handleLeave(socket: Socket, data: GuideJoinData) {
    if (!data.guildId || !data.guideSlug) return;
    socket.leave(guideRoom(data.guildId, data.guideSlug));
    logger.info(`[GuidePresence] 🚪 ${socket.id} quitte ${guideRoom(data.guildId, data.guideSlug)}`);
    // Notif de départ du guide (milestoneId vide = départ du guide).
    const userId = socket.data.userId as string | undefined;
    if (wsAuthEnabled && userId) {
      const identity = await resolveActiveProfileIdentity(userId, data.guildId);
      if (identity) {
        queueEvent(guideRoom(data.guildId, data.guideSlug), {
          type: "presence:leave",
          profileId: identity.profileId,
          userName: identity.userName,
          milestoneId: "",
        });
      }
    }
  }

  async function handleHeartbeat(socket: Socket, data: GuideHeartbeatData) {
    if (!data.guildId || !data.guideSlug || !data.milestoneId) return;
    const userId = socket.data.userId as string | undefined;

    // Identité serveur-autoritative quand l'auth est active : le profileId est
    // résolu côté serveur (jamais fourni par le client), le nom/avatar restent
    // cosmétiques. En mode urgence (WS_AUTH_ENABLED=false) on accepte profileId.
    let profileId: string | null = null;
    if (wsAuthEnabled) {
      if (!userId) return; // fail-closed
      const allowed = await isMemberOfGuild(userId, data.guildId);
      if (!allowed) return;
      profileId = await resolveActiveProfileId(userId, data.guildId);
      if (!profileId) return;
    } else {
      if (!data.profileId) return;
      profileId = data.profileId;
    }

    await touchPresence(data.guildId, data.guideSlug, {
      profileId,
      userName: data.userName || "Membre",
      userAvatar: data.userAvatar,
      milestoneId: data.milestoneId,
    });
    queuePresenceBroadcast(guideRoom(data.guildId, data.guideSlug), data.guildId, data.guideSlug);
  }

  return { handleJoin, handleLeave, handleHeartbeat, guideRoom };
}

/** Résout le userProfile ACTIF d'un utilisateur dans une guilde (fail-closed null). */
async function resolveActiveProfileId(userId: string, discordGuildId: string): Promise<string | null> {
  try {
    const { db } = await import("../../lib/prisma");
    const profile = await db.userProfile.findFirst({
      where: { status: "ACTIVE", userId, guild: { discordGuildId } },
      select: { id: true },
    });
    return profile?.id ?? null;
  } catch {
    return null;
  }
}

/** Résout l'identité d'affichage (profileId + nom + avatar) d'un membre ACTIF. */
async function resolveActiveProfileIdentity(
  userId: string,
  discordGuildId: string
): Promise<{ profileId: string; userName: string; userAvatar?: string } | null> {
  try {
    const { db } = await import("../../lib/prisma");
    const profile = await db.userProfile.findFirst({
      where: { status: "ACTIVE", userId, guild: { discordGuildId } },
      select: {
        id: true,
        pseudoDofus: true,
        discordNickname: true,
        user: { select: { name: true, image: true } },
      },
    });
    if (!profile) return null;
    return {
      profileId: profile.id,
      userName: profile.pseudoDofus || profile.discordNickname || profile.user?.name || "Membre",
      userAvatar: profile.user?.image || undefined,
    };
  } catch {
    return null;
  }
}

