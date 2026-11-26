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
  /** Emplacement du personnage (`PRINCIPAL` ou pseudo de mule). */
  characterSlot?: string;
  /** Surface d'où vient ce heartbeat : dashboard, overlay (PiP) ou public. */
  surface?: string;
  /** Classe Dofus du personnage (icône à côté du pseudo). */
  dofusClass?: string | null;
  /** Alignement du personnage (lu au join, recopié tel quel dans Redis). */
  alignment?: string | null;
  alignmentOrder?: string | null;
  alignmentLevel?: number | null;
  lastSeen: number;
};

type MergedPresenceEntry = PresenceEntry & { surfaces: string[] };

/** Surface bornée : une valeur inconnue retombe sur le dashboard, jamais sur l'overlay. */
function normalizePresenceSurface(value: unknown): string {
  return value === "overlay" || value === "public" || value === "dashboard"
    ? value
    : "dashboard";
}

/** Projection publique d'une entrée de présence (jamais `lastSeen`). */
function publicPresenceMember(entry: MergedPresenceEntry) {
  return {
    profileId: entry.profileId,
    userName: entry.userName,
    userAvatar: entry.userAvatar,
    milestoneId: entry.milestoneId,
    characterSlot: entry.characterSlot ?? "PRINCIPAL",
    surfaces: entry.surfaces,
    dofusClass: entry.dofusClass ?? null,
    alignment: entry.alignment ?? null,
    alignmentOrder: entry.alignmentOrder ?? null,
    alignmentLevel: entry.alignmentLevel ?? 0,
  };
}

export type GuidePresenceConfig = {
  io: Server;
  subClient: ReturnType<typeof redis.duplicate>;
  wsAuthEnabled: boolean;
  isMemberOfGuild: (userId: string, discordGuildId: string) => Promise<boolean>;
};

export type GuideJoinData = {
  guildId?: string;
  guideSlug?: string;
  milestoneId?: string;
  userName?: string;
  userAvatar?: string;
  characterSlot?: string;
  surface?: string;
  dofusClass?: string | null;
};
export type GuideHeartbeatData = GuideJoinData & { profileId?: string };

export function createGuidePresence(config: GuidePresenceConfig) {
  const { io, subClient, wsAuthEnabled, isMemberOfGuild } = config;

  // ─── Batching par room (events d'action + broadcast présence) ───────────────
  const eventQueue = new Map<string, GuideRealtimeEvent[]>();
  const eventTimers = new Map<string, NodeJS.Timeout>();
  const presenceQueued = new Set<string>();
  const presenceTimers = new Map<string, NodeJS.Timeout>();
  /**
   * Sockets **réellement connectés** par personnage (`guild:guide:profile:slot`) →
   * `socket.id → surface`. Source de vérité du « encore là » pour les départs : un
   * heartbeat d'onglet réduit peut être throttlé, mais le socket reste ouvert. Sans
   * cette carte, fermer la PiP annonçait « a quitté le guide » alors que le dashboard
   * était toujours ouvert (retour user du 26/11/2026).
   */
  const activeGuideSockets = new Map<string, Map<string, string>>();
  const activeGuideKey = (guildId: string, guideSlug: string, profileId: string, slot: string) =>
    `${guildId}:${guideSlug}:${profileId}:${slot}`;
  function registerActiveGuideSocket(
    socket: Socket,
    key: string,
    surface: string
  ) {
    const sockets = activeGuideSockets.get(key) ?? new Map<string, string>();
    sockets.set(socket.id, surface);
    activeGuideSockets.set(key, sockets);
    socket.data.guideActiveKey = key;
  }
  function unregisterActiveGuideSocket(socket: Socket): boolean {
    const key = socket.data.guideActiveKey as string | undefined;
    if (!key) return false;
    const sockets = activeGuideSockets.get(key);
    if (!sockets) return false;
    const removed = sockets.delete(socket.id);
    if (sockets.size === 0) activeGuideSockets.delete(key);
    return removed;
  }
  function hasActiveGuideSocket(key: string): boolean {
    return (activeGuideSockets.get(key)?.size ?? 0) > 0;
  }

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

  async function getPresenceMembers(guildId: string, guideSlug: string): Promise<MergedPresenceEntry[]> {
    const key = presenceKey(guildId, guideSlug);
    const raw = await redis.smembers(key);
    const now = Date.now();
    const byCharacter = new Map<string, MergedPresenceEntry>();
    const stale: string[] = [];
    for (const item of raw) {
      try {
        const entry = JSON.parse(item) as PresenceEntry;
        if (now - entry.lastSeen > PRESENCE_TTL_SECONDS * 1000) {
          stale.push(item);
        } else {
          // Un **personnage** peut avoir plusieurs connexions (2 onglets, guide + PiP) :
          // le Set Redis contient alors plusieurs entrées pour le même
          // `profileId::characterSlot` (lastSeen et surface différents). On garde la
          // dernière position, mais on **fusionne les surfaces** : l'overlay et le
          // dashboard du même personnage restent un seul membre, avec deux surfaces.
          const slot = entry.characterSlot?.trim() || "PRINCIPAL";
          const characterKey = `${entry.profileId}::${slot}`;
          const surface = entry.surface?.trim() || "dashboard";
          const current = byCharacter.get(characterKey);
          const surfaces = [...new Set([...(current?.surfaces ?? []), surface])];
          if (!current || entry.lastSeen >= current.lastSeen) {
            byCharacter.set(characterKey, { ...entry, surfaces });
          } else {
            current.surfaces = surfaces;
          }
        }
      } catch {
        stale.push(item);
      }
    }
    if (stale.length > 0) {
      await redis.srem(key, ...stale).catch(() => {});
    }
    return Array.from(byCharacter.values());
  }

  async function touchPresence(guildId: string, guideSlug: string, entry: Omit<PresenceEntry, "lastSeen">) {
    const key = presenceKey(guildId, guideSlug);
    await getPresenceMembers(guildId, guideSlug); // purge des entrées expirées
    await redis.sadd(key, JSON.stringify({ ...entry, lastSeen: Date.now() }));
    await redis.expire(key, PRESENCE_TTL_SECONDS);
  }

  async function broadcastPresence(guildId: string, guideSlug: string) {
    const members = await getPresenceMembers(guildId, guideSlug);
    const publicMembers = members.map(publicPresenceMember);
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
    const surface = normalizePresenceSurface(data.surface);
    const characterSlot = data.characterSlot?.trim().slice(0, 80) || "PRINCIPAL";
    socket.data.guideSurface = surface;
    socket.data.guideCharacterSlot = characterSlot;
    socket.join(guideRoom(data.guildId, data.guideSlug));
    logger.info(`[GuidePresence] 👥 ${socket.id} rejoint ${guideRoom(data.guildId, data.guideSlug)} (${surface})`);
    // Notif d'arrivée : l'overlay s'annonce même s'il connaît déjà son jalon ; le
    // dashboard garde la règle « heartbeat de repère = pas une arrivée ».
    if (wsAuthEnabled && userId) {
      const identity = await resolveActiveProfileIdentity(userId, data.guildId);
      if (identity) {
        // P1 : on mémorise l'identité résolue sur le socket → les heartbeats suivants
        // ne font AUCUNE requête DB (gros gain à 300+ clients, heartbeat toutes les 20s).
        socket.data.guideIdentity = identity;
        socket.data.guideGuildId = data.guildId;
        socket.data.guideSlugKey = data.guideSlug;
        registerActiveGuideSocket(
          socket,
          activeGuideKey(data.guildId, data.guideSlug, identity.profileId, characterSlot),
          surface
        );
        // Le join porte le jalon : on écrit la présence TOUT DE SUITE pour que le
        // snapshot initial contienne le personnage (et pas seulement le heartbeat 0 ms).
        if (data.milestoneId) {
          await touchPresence(data.guildId, data.guideSlug, {
            profileId: identity.profileId,
            userName: data.userName || identity.userName,
            userAvatar: data.userAvatar || identity.userAvatar,
            milestoneId: data.milestoneId,
            characterSlot,
            surface,
            dofusClass: data.dofusClass ?? identity.dofusClass ?? null,
            alignment: identity.alignment ?? null,
            alignmentOrder: identity.alignmentOrder ?? null,
            alignmentLevel: identity.alignmentLevel ?? 0,
          });
        }
        queueEvent(guideRoom(data.guildId, data.guideSlug), {
          type: "presence:join",
          profileId: identity.profileId,
          userName: data.userName || identity.userName,
          userAvatar: data.userAvatar || identity.userAvatar,
          milestoneId: data.milestoneId ?? "",
          surface,
          characterSlot,
          dofusClass: data.dofusClass ?? identity.dofusClass ?? null,
        });
        // Le snapshot doit inclure le nouveau venu pour les AUTRES surfaces
        // (overlay ouvert → compteur et pastilles à jour en < 1 s).
        queuePresenceBroadcast(guideRoom(data.guildId, data.guideSlug), data.guildId, data.guideSlug);
      }
    }
    // État présent initial (snapshot) pour le nouveau venu uniquement
    const members = await getPresenceMembers(data.guildId, data.guideSlug);
    socket.emit("guide:presence:update", {
      guildId: data.guildId,
      guideSlug: data.guideSlug,
      members: members.map(publicPresenceMember),
    });
  }

  /**
   * Annonce le départ d'une surface **si ce socket était encore enregistré**.
   * `stillPresent` vient de la carte des sockets, pas du TTL Redis : un onglet
   * réduit peut ne plus battre, mais son socket reste la preuve qu'il est ouvert.
   */
  /** Retire du Set Redis les entrées de CETTE surface (badge « Overlay » immédiat). */
  async function clearPresenceSurface(
    guildId: string,
    guideSlug: string,
    profileId: string,
    slot: string,
    surface: string
  ) {
    try {
      const key = presenceKey(guildId, guideSlug);
      const raw = await redis.smembers(key);
      const toRemove = raw.filter((item) => {
        try {
          const entry = JSON.parse(item) as PresenceEntry;
          return (
            entry.profileId === profileId &&
            (entry.characterSlot ?? "PRINCIPAL") === slot &&
            (entry.surface ?? "dashboard") === surface
          );
        } catch {
          return false;
        }
      });
      if (toRemove.length > 0) await redis.srem(key, ...toRemove);
    } catch {
      // Best-effort : le TTL 45 s reste le filet de sécurité.
    }
  }

  async function notifyGuideLeave(socket: Socket, guildId: string, guideSlug: string) {
    const identity = socket.data.guideIdentity as
      | {
          profileId: string;
          userName?: string;
          userAvatar?: string;
          alignment?: string | null;
          alignmentOrder?: string | null;
          alignmentLevel?: number | null;
        }
      | undefined;
    if (!identity?.profileId) return;
    const surface = (socket.data.guideSurface as string | undefined) ?? "dashboard";
    const characterSlot =
      (socket.data.guideCharacterSlot as string | undefined) ?? "PRINCIPAL";
    await clearPresenceSurface(guildId, guideSlug, identity.profileId, characterSlot, surface);
    const key = activeGuideKey(guildId, guideSlug, identity.profileId, characterSlot);
    const stillPresent = hasActiveGuideSocket(key);
    queueEvent(guideRoom(guildId, guideSlug), {
      type: "presence:leave",
      profileId: identity.profileId,
      userName: identity.userName,
      milestoneId: "",
      surface,
      characterSlot,
      stillPresent,
    });
    queuePresenceBroadcast(guideRoom(guildId, guideSlug), guildId, guideSlug);
  }

  async function handleLeave(socket: Socket, data: GuideJoinData) {
    if (!data.guildId || !data.guideSlug) return;
    socket.leave(guideRoom(data.guildId, data.guideSlug));
    const surface = (socket.data.guideSurface as string | undefined) ?? normalizePresenceSurface(data.surface);
    logger.info(`[GuidePresence] 🚪 ${socket.id} quitte ${guideRoom(data.guildId, data.guideSlug)} (${surface})`);
    const removed = unregisterActiveGuideSocket(socket);
    if (removed) await notifyGuideLeave(socket, data.guildId, data.guideSlug);
  }

  /** Déconnexion brutale (fermeture d'onglet/fenêtre) : même règle que `guide:leave`. */
  async function handleDisconnect(socket: Socket) {
    const guildId = socket.data.guideGuildId as string | undefined;
    const guideSlug = socket.data.guideSlugKey as string | undefined;
    const removed = unregisterActiveGuideSocket(socket);
    if (removed && guildId && guideSlug) {
      await notifyGuideLeave(socket, guildId, guideSlug);
    }
  }

  async function handleHeartbeat(socket: Socket, data: GuideHeartbeatData) {
    if (!data.guildId || !data.guideSlug || !data.milestoneId) return;

    // P1 : identité résolue UNE seule fois au `guide:join` et mémorisée sur le socket.
    // Les heartbeats (toutes les 20s, 300+ clients) ne font PLUS aucune requête DB.
    let profileId: string | null = null;
    const identity = socket.data.guideIdentity as { profileId: string; userName?: string; userAvatar?: string; dofusClass?: string | null; alignment?: string | null; alignmentOrder?: string | null; alignmentLevel?: number | null } | undefined;
    if (wsAuthEnabled) {
      if (!identity?.profileId) return; // fail-closed : pas d'identité join → pas de heartbeat
      profileId = identity.profileId;
    } else {
      if (!data.profileId) return;
      profileId = data.profileId;
    }

    const characterSlot =
      typeof data.characterSlot === "string" && data.characterSlot.trim()
        ? data.characterSlot.trim().slice(0, 80)
        : (socket.data.guideCharacterSlot as string | undefined) ?? "PRINCIPAL";
    const surface =
      (socket.data.guideSurface as string | undefined) ?? normalizePresenceSurface(data.surface);
    socket.data.guideSurface = surface;
    socket.data.guideCharacterSlot = characterSlot;

    await touchPresence(data.guildId, data.guideSlug, {
      profileId,
      userName: data.userName || identity?.userName || "Membre",
      userAvatar: data.userAvatar || identity?.userAvatar,
      milestoneId: data.milestoneId,
      characterSlot,
      surface,
      dofusClass: data.dofusClass ?? identity?.dofusClass ?? null,
      alignment: identity?.alignment ?? null,
      alignmentOrder: identity?.alignmentOrder ?? null,
      alignmentLevel: identity?.alignmentLevel ?? 0,
    });
    queuePresenceBroadcast(guideRoom(data.guildId, data.guideSlug), data.guildId, data.guideSlug);
  }

  return { handleJoin, handleLeave, handleHeartbeat, handleDisconnect, guideRoom };
}

/** Résout l'identité d'affichage (profileId + nom + avatar) d'un membre ACTIF. */
export async function resolveActiveProfileIdentity(
  userId: string,
  discordGuildId: string
): Promise<{
  profileId: string;
  userName: string;
  userAvatar?: string;
  dofusClass?: string | null;
  alignment?: string | null;
  alignmentOrder?: string | null;
  alignmentLevel?: number | null;
} | null> {
  try {
    const { db } = await import("../../lib/prisma");
    const profile = await db.userProfile.findFirst({
      where: { status: "ACTIVE", userId, guild: { discordGuildId } },
      select: {
        id: true,
        pseudoDofus: true,
        discordNickname: true,
        classe: true,
        alignment: true,
        alignmentOrder: true,
        alignmentLevel: true,
        user: { select: { name: true, image: true } },
      },
    });
    if (!profile) return null;
    return {
      profileId: profile.id,
      userName: profile.pseudoDofus || profile.discordNickname || profile.user?.name || "Membre",
      userAvatar: profile.user?.image || undefined,
      dofusClass: profile.classe ?? null,
      alignment: profile.alignment ?? null,
      alignmentOrder: profile.alignmentOrder ?? null,
      alignmentLevel: profile.alignmentLevel ?? 0,
    };
  } catch {
    return null;
  }
}

