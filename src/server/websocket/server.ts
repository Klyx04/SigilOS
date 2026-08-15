import "dotenv/config";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redis } from "../../lib/redis";
import { getToken } from "next-auth/jwt";
import { GeoguesserManager } from "../games/SigilGuesser/GeoguesserManager";
import { WorldMapService } from "../games/SigilGuesser/WorldMapService";
import { BombManager } from "../games/SigilBomb/BombManager";
import { rateLimit } from "../../lib/ratelimit";
import { getRushActiveMembers } from "../actions/rush-actions";
import { logger as AppLogger } from "../../lib/logger";
import { createGuidePresence } from "./guide-presence";
import { createDofusPresence } from "./dofus-presence";

// Fallback if logger is not correctly initialized
const logger = AppLogger || console;

// ═════════════════════════════════════════════════════════════════════════════
// SECURITY (F-08 / audit 2026): WebSocket Authentication & Guild Membership
// ─────────────────────────────────────────────────────────────────────────────
// Previously the WS server trusted `socket.handshake.query.guildId` and joined
// any guild room with NO session verification — anyone could spy on any guild
// (voice presence, rush, ocre, dj, games).
//
// Fix (deployed beta-first, see CONTEXT.md):
//   1. io.use() middleware decodes the SESSION cookie (HttpOnly) via Auth.js
//      `getToken` — NOT a client-readable bearer. The client already sends the
//      cookie thanks to `withCredentials: true` (step 1 already done).
//   2. In `connection`, we do NOT trust the client-provided guildId. We only
//      join a guild room if the authenticated user provably has an ACTIVE
//      UserProfile in that guild (server-side DB check).
//   3. Sensitive inbound events re-validate membership before broadcasting.
//   4. connectionStateRecovery.skipMiddlewares is set to false so session
//      re-validation runs on recovery.
//
// Rollback guard: set WS_AUTH_ENABLED=false in the container env to restore the
// previous permissive behavior without a code change (emergency kill-switch).
// ═════════════════════════════════════════════════════════════════════════════

const WS_AUTH_ENABLED = process.env.WS_AUTH_ENABLED !== "false";
const AUTH_SECRET = process.env.AUTH_SECRET;
// Cookie name matches auth.config.ts (secure prefix in production).
const SESSION_COOKIE = process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

/** Verify a user has an ACTIVE profile in the given Discord guild. */
async function isMemberOfGuild(userId: string, discordGuildId: string): Promise<boolean> {
    try {
        const { db } = await import("../../lib/prisma");
        const profile = await db.userProfile.findFirst({
            where: {
                status: "ACTIVE",
                userId,
                guild: { discordGuildId },
            },
            select: { id: true },
        });
        return !!profile;
    } catch {
        return false;
    }
}

/** Résout l'identité d'affichage (profil ACTIVE) pour la présence du dashboard. */
async function resolveDashboardIdentity(
    userId: string | undefined,
    discordGuildId: string
): Promise<{ profileId: string; userName: string; userAvatar?: string } | null> {
    if (!userId) return null;
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

// Load Geoguesser data
WorldMapService.getInstance().loadData();

const PORT = 3001;

// Create standalone HTTP server for WebSockets
const httpServer = createServer((req, res) => {
    // Only log in dev — HTTP requests in prod pollute container logs
    logger.debug(`[HTTP] 📥 ${req.method} ${req.url}`);
    if (req.url === "/health") {
        res.writeHead(200);
        res.end("OK");
        return;
    }
});

const pubClient = redis.duplicate();
const subClient = redis.duplicate();

const isProd = process.env.NODE_ENV === "production";

// R4 — Canal "god:revoked" : le serveur Next publie sur Redis, le serveur WS
// diffuse aux sockets du sous-god (room user:<userId>) pour déconnexion LIVE.
// Trigger build GHCR beta (re-déclenché après incident GitHub Actions).
const GOD_REVOKED_CHANNEL = "god:revoked";
subClient.subscribe(GOD_REVOKED_CHANNEL, (err) => {
    if (err) logger.error("[WS] ❌ Erreur abonnement Redis god:revoked:", { error: err });
});

// R4 — Canal "god:access-changed" : les briques accessibles d'un sous-god ont changé
// → on le prévient en LIVE pour qu'il rafraîchisse son UI (SANS déconnexion).
const GOD_ACCESS_CHANGED_CHANNEL = "god:access-changed";
subClient.subscribe(GOD_ACCESS_CHANGED_CHANNEL, (err) => {
    if (err) logger.error("[WS] ❌ Erreur abonnement Redis god:access-changed:", { error: err });
});

const io = new Server(httpServer, {
    // 🔒 [SECURITY] Limit payload size to 1MB — prevents OOM from oversized canvas events
    maxHttpBufferSize: 1e6,
    // Socket timeouts — detect dead connections faster
    pingTimeout: 20_000,
    pingInterval: 25_000,
    cors: {
        origin: (origin, callback) => {
            // [AUDIT 2026] MED-04: Strict origin validation to prevent Cross-Site WebSocket Hijacking
            if (!isProd) {
                return callback(null, true);
            }

            const allowedOrigins = [
                "https://sigilos.fr",
                "https://beta.sigilos.fr"
            ];

            if (origin && allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                logger.warn("[WS] ⚠️ Connexion bloquée par CORS (Origin non autorisée)", { origin });
                callback(new Error("Not allowed by CORS"));
            }
        },
        methods: ["GET", "POST"],
        credentials: true
    },
    // On n'active l'adapter Redis que si on a les clients prêts (utile pour le VPS)
    adapter: isProd ? createAdapter(pubClient, subClient) : undefined,
    path: "/socket.io/",
    // [AUDIT 2026] UX-01: Resilience for mobile/tunnel users
    connectionStateRecovery: {
        // Recovery window: 2 minutes (allow temporary signal loss)
        maxDisconnectionDuration: 2 * 60 * 1000,
        // SECURITY (F-08): MUST re-run the auth middleware on recovery — never
        // skip it. A reconnecting socket must re-prove its identity.
        skipMiddlewares: false,
    }
});

// [AUDIT 2026] HARD-03: Connection Rate Limiting
io.use(async (socket, next) => {
    const ip = socket.handshake.address;
    const { success } = await rateLimit(`ws-connect:${ip}`, 10, 60000);

    if (!success) {
        logger.warn(`[WS] 🛑 Rate limit atteint pour la connexion (IP: ${ip})`);
        return next(new Error("Rate limit exceeded. Please wait a minute."));
    }
    next();
});

// 🔐 (F-08) AUTH MIDDLEWARE — decode session cookie, attach identity to socket.data
if (WS_AUTH_ENABLED) {
    io.use(async (socket, next) => {
        try {
            if (!AUTH_SECRET) {
                return next(new Error("AUTH_SECRET not configured"));
            }
            // The client already sends the HttpOnly session cookie automatically
            // (withCredentials on all Socket.IO clients — step 1 already done).

            // Reuse Auth.js getToken with the request-shaped object so it can read
            // the cookie itself; pass raw=false to get the decoded payload.
            const token = await getToken({
                req: {
                    headers: {
                        cookie: socket.handshake.headers.cookie || "",
                    },
                },
                secret: AUTH_SECRET,
                secureCookie: isProd,
                cookieName: SESSION_COOKIE,
            });

            if (!token || !token.sub) {
                return next(new Error("Unauthorized"));
            }
            socket.data.userId = token.sub as string;
            socket.data.discordId = (token as any).discordId as string | undefined;
            next();
        } catch (err: any) {
            logger.warn("[WS] 🔐 Auth failed:", err?.message);
            next(new Error("Unauthorized"));
        }
    });
} else {
    logger.warn("[WS] ⚠️ WS_AUTH_ENABLED=false — WebSocket auth DISABLED (emergency mode)");
}


const geoguesserManager = new GeoguesserManager(io);
const bombManager = new BombManager(io);

// [New] Broadcast Ocre Trade & DJ Finder Updates from Redis
subClient.subscribe("ocre:trade:update", "dj:finder:update", (err) => {
    if (err) logger.error("[WS] ❌ Erreur abonnement Redis:", { error: err });
});

subClient.on("message", (channel, message) => {
    if (channel === "ocre:trade:update" || channel === "dj:finder:update") {
        try {
            const data = JSON.parse(message);
            if (data.guildId) {
                io.to(`guild:${data.guildId}`).emit(channel, data);
                logger.info(`[WS] 🔄 Broadcast ${channel} pour guilde ${data.guildId}`);
            }
        } catch (e) {
            logger.error(`[WS] ❌ Erreur parsing message ${channel}:`, { error: e });
        }
    }

    // R4 — Réception d'une révocation God → diffusion LIVE au sous-god concerné.
    if (channel === GOD_REVOKED_CHANNEL) {
        try {
            const payload = JSON.parse(message);
            if (payload.userId) {
                // Room par utilisateur : sécurisée par le middleware (socket.data.userId).
                io.to(`user:${payload.userId}`).emit("god:revoked", payload);
                logger.info(`[WS] ⚡ God revoked broadcast → user:${payload.userId} (reason: ${payload.reason})`);
            }
        } catch (e) {
            logger.error(`[WS] ❌ Erreur parsing god:revoked:`, { error: e });
        }
    }

    // R4 — Accès modifié (briques) → prévient le sous-god pour refresh UI, SANS logout.
    if (channel === GOD_ACCESS_CHANGED_CHANNEL) {
        try {
            const payload = JSON.parse(message);
            if (payload.userId) {
                io.to(`user:${payload.userId}`).emit("god:access-changed", payload);
                logger.info(`[WS] 🔄 God access changed broadcast → user:${payload.userId}`);
            }
        } catch (e) {
            logger.error(`[WS] ❌ Erreur parsing god:access-changed:`, { error: e });
        }
    }
});

// === GANYMEDE — présence temps réel du module guide (Phase E) ===
// S'abonne à `guide:*` (events publiés par les server actions via
// src/lib/guide-realtime.ts), gère le heartbeat de présence éphémère
// (Set Redis EXPIRE 45s) et le batching (500ms) avant broadcast aux rooms
// `guild:<guildId>:guide:<slug>`.
const guidePresence = createGuidePresence({
    io,
    subClient,
    wsAuthEnabled: WS_AUTH_ENABLED,
    isMemberOfGuild,
});

// === PAGE PAR-DOFUS — présence temps réel (chantier #37, suite) ===
// Room `guild:<guildId>:dofus:<slug>` + canal Redis `dofus:*`.
const dofusPresence = createDofusPresence({
    io,
    subClient,
    wsAuthEnabled: WS_AUTH_ENABLED,
    isMemberOfGuild,
});

// Gestionnaire global des connexions
io.on("connection", (socket: Socket) => {
    let guildId = socket.handshake.query.guildId as string;
    if (guildId === "undefined" || guildId === "null" || !guildId) guildId = "global";

    if (guildId && guildId !== "global") {
        // 🔐 (F-08) SECURITY: NEVER trust the client-raised guildId blindly.
        // Only join the guild room if the authenticated user provably belongs
        // to it (ACTIVE profile). Fast-path handshake sync stays but restricted.
        const userId = socket.data.userId as string | undefined;

        if (WS_AUTH_ENABLED && !userId) {
            // Shouldn't happen (auth middleware precedes connection), but fail-closed.
            logger.warn(`[WS] 🛑 Connexion ${socket.id} sans identité — join guilde refusé.`);
            return;
        }

        if (WS_AUTH_ENABLED) {
            // Server-side membership check (async, then join if allowed)
            isMemberOfGuild(userId!, guildId).then((allowed) => {
                if (!allowed) {
                    logger.warn(`[WS] 🛑 ${socket.id} refusé pour la guilde ${guildId} (non membre)`);
                    socket.emit("error", "forbidden");
                    return;
                }
                socket.join(`guild:${guildId}`);
                logger.info(`[WS] 🏢 Client ${socket.id} a rejoint le salon guilde: ${guildId}`);
            });
        } else {
            socket.join(`guild:${guildId}`);
            logger.info(`[WS] 🏢 Client ${socket.id} a rejoint le salon guilde: ${guildId}`);
        }
    } else {
        socket.join("guild:global");
    }

    // R4 — Rejoindre la room utilisateur (pour diffusions ciblées god:revoked).
    const wsUserId = socket.data.userId as string | undefined;
    if (wsUserId) {
        socket.join(`user:${wsUserId}`);
    }

    logger.info(`[WS] 🟢 Client connecté: ${socket.id}`);
    socket.emit("test:heartbeat", { time: Date.now() });

    // === SIGIL-GUESSER ===
    logger.info(`[WS] Initialisation Geoguesser pour ${socket.id}`);
    geoguesserManager.registerSocket(socket);

    // === SIGIL BOMB ===
    logger.info(`[WS] Initialisation SigilBomb pour ${socket.id}`);
    bombManager.registerSocket(socket);

    // === RUSH SYLVESTRE PRESENCE ===
    socket.on("rush:join", async (data: { guildId: string }) => {
        if (!data.guildId) return;
        // 🔐 (F-08) Only broadcast rush presence to guilds the user is a member of.
        if (WS_AUTH_ENABLED) {
            const userId = socket.data.userId as string | undefined;
            if (!userId) return;
            const allowed = await isMemberOfGuild(userId, data.guildId);
            if (!allowed) return;
        }
        logger.info(`[WS] 🏃 ${socket.id} joined rush in guild ${data.guildId}`);
        const result = await getRushActiveMembers(data.guildId);
        if (result.success) {
            io.to(`guild:${data.guildId}`).emit("rush:presence:update", {
                guildId: data.guildId,
                members: result.members,
            });
        }
    });

    socket.on("rush:leave", async (data: { guildId: string }) => {
        if (!data.guildId) return;
        if (WS_AUTH_ENABLED) {
            const userId = socket.data.userId as string | undefined;
            if (!userId) return;
            const allowed = await isMemberOfGuild(userId, data.guildId);
            if (!allowed) return;
        }
        logger.info(`[WS] 🏃 ${socket.id} left rush in guild ${data.guildId}`);
        const result = await getRushActiveMembers(data.guildId);
        if (result.success) {
            io.to(`guild:${data.guildId}`).emit("rush:presence:update", {
                guildId: data.guildId,
                members: result.members,
            });
        }
    });

    socket.on("rush:heartbeat", async (data: { guildId: string }) => {
        if (!data.guildId) return;
        if (WS_AUTH_ENABLED) {
            const userId = socket.data.userId as string | undefined;
            if (!userId) return;
            const allowed = await isMemberOfGuild(userId, data.guildId);
            if (!allowed) return;
        }
        const result = await getRushActiveMembers(data.guildId);
        if (result.success) {
            io.to(`guild:${data.guildId}`).emit("rush:presence:update", {
                guildId: data.guildId,
                members: result.members,
            });
        }
    });

    // === GANYMEDE GUIDE PRESENCE ===
    socket.on("guide:join", (data: { guildId?: string; guideSlug?: string }) => {
        guidePresence.handleJoin(socket, data).catch(() => {});
    });
    socket.on("guide:leave", (data: { guildId?: string; guideSlug?: string }) => {
        guidePresence.handleLeave(socket, data).catch(() => {});
    });
    socket.on("guide:heartbeat", (data: {
        guildId?: string; guideSlug?: string; milestoneId?: string; userName?: string; userAvatar?: string;
    }) => {
        guidePresence.handleHeartbeat(socket, data).catch(() => {});
    });

    // === PAGE PAR-DOFUS PRESENCE (chantier #37, suite) ===
    // Room `guild:<guildId>:dofus:<slug>`, position courante = questId.
    socket.on("dofus:join", (data: { guildId?: string; dofusSlug?: string }) => {
        dofusPresence.handleJoin(socket, data).catch(() => {});
    });
    socket.on("dofus:leave", (data: { guildId?: string; dofusSlug?: string }) => {
        dofusPresence.handleLeave(socket, data).catch(() => {});
    });
    socket.on("dofus:heartbeat", (data: {
        guildId?: string; dofusSlug?: string; questId?: string; userName?: string; userAvatar?: string;
    }) => {
        dofusPresence.handleHeartbeat(socket, data).catch(() => {});
    });

    // === DASHBOARD PRESENCE (temps réel qui se connecte / quitte, chantier #39) ===
    // Events : `dashboard:presence:event` = { type: "join"|"leave", profileId, userName, userAvatar }.
    // Broadcast aux AUTRES sockets de la guilde (socket.broadcast → pas de notif "toi").
    socket.on("dashboard:join", async (data: { guildId?: string }) => {
        if (!data.guildId) return;
        if (WS_AUTH_ENABLED) {
            const userId = socket.data.userId as string | undefined;
            if (!userId) return;
            const allowed = await isMemberOfGuild(userId, data.guildId);
            if (!allowed) return;
        }
        socket.join(`guild:${data.guildId}`);
        const identity = await resolveDashboardIdentity(socket.data.userId as string | undefined, data.guildId);
        if (!identity) return;
        socket.data.dashboardIdentity = identity;
        socket.data.dashboardGuildId = data.guildId;
        logger.info(`[WS] 👋 ${socket.id} joined dashboard (${identity.userName})`);
        socket.broadcast.to(`guild:${data.guildId}`).emit("dashboard:presence:event", {
            type: "join",
            profileId: identity.profileId,
            userName: identity.userName,
            userAvatar: identity.userAvatar,
        });
    });

    socket.on("dashboard:leave", async (data: { guildId?: string }) => {
        if (!data.guildId) return;
        socket.leave(`guild:${data.guildId}`);
        const identity = socket.data.dashboardIdentity as { profileId: string; userName?: string; userAvatar?: string } | undefined;
        if (identity?.profileId) {
            socket.broadcast.to(`guild:${data.guildId}`).emit("dashboard:presence:event", {
                type: "leave",
                profileId: identity.profileId,
                userName: identity.userName,
                userAvatar: identity.userAvatar,
            });
        }
        socket.data.dashboardIdentity = undefined;
        socket.data.dashboardGuildId = undefined;
    });

    // Gestion de la déconnexion
    socket.on("disconnect", (reason) => {
        logger.info(`[WS] 🔴 Client déconnecté: ${socket.id} (Raison: ${reason})`);
        // #73 : presence dashboard sans leave explicite (onglet ferme, coupure reseau,
        // ou emit non flushe cote client) -> broadcast un leave aux autres membres.
        // Idempotent : dashboard:leave a deja nettoye dashboardIdentity -> aucun doublon.
        const dashIdentity = socket.data.dashboardIdentity as { profileId: string; userName?: string; userAvatar?: string } | undefined;
        const dashGuildId = socket.data.dashboardGuildId as string | undefined;
        if (dashIdentity?.profileId && dashGuildId) {
            socket.broadcast.to(`guild:${dashGuildId}`).emit("dashboard:presence:event", {
                type: "leave",
                profileId: dashIdentity.profileId,
                userName: dashIdentity.userName,
                userAvatar: dashIdentity.userAvatar,
            });
        }
        geoguesserManager.handleDisconnect(socket, reason);
        bombManager.handleDisconnect(socket);
    });
});

// On démarre sans spécifier d'IP pour laisser l'OS choisir (souvent :: et 0.0.0.0)
// En dev, on écoute partout pour éviter les soucis de résolution localhost
try {
    httpServer.listen(PORT, "::", () => {
        logger.info(`[WS] 🚀 Serveur WebSocket démarré sur le port ${PORT} (IPv4/IPv6)`);
        logger.info(`[WS] 🔐 Auth ${WS_AUTH_ENABLED ? "ACTIVÉE" : "DÉSACTIVÉE (emergency)"}`);
        logger.info(`[WS] Testez via: http://localhost:${PORT}/health`);
    });
} catch (err: any) {
    logger.error("[WS] ❌ Erreur FATALE au démarrage:", err);
    process.exit(1);
}

httpServer.on("error", (err) => {
    logger.error("[WS] ❌ Erreur Serveur HTTP:", err);
});

// Gestion de l'extinction propre (Graceful Shutdown)
const shutdown = () => {
    logger.info("[WS] Extinction du serveur WebSocket...");
    io.close(() => {
        httpServer.close(() => {
            logger.info("[WS] Serveur fermé.");
            process.exit(0);
        });
    });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);