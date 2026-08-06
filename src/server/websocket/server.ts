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
import { DiscordVoiceService } from "../discord/voice-service";
import { getRushActiveMembers } from "../actions/rush-actions";
import { logger as AppLogger } from "../../lib/logger";

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
// Ce bloc est présent depuis le commit R4 (02923c81) — trigger build GHCR beta.
const GOD_REVOKED_CHANNEL = "god:revoked";
subClient.subscribe(GOD_REVOKED_CHANNEL, (err) => {
    if (err) logger.error("[WS] ❌ Erreur abonnement Redis god:revoked:", { error: err });
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

// === DISCORD VOICE MONITORING ===
const voiceService = DiscordVoiceService.getInstance();
voiceService.setOnUpdate((guildId, users) => {
    io.to(`guild:${guildId}`).emit("discord:voice:update", {
        guildId,
        users
    });
    logger.info(`[WS] 🎤 Broadcast Voice Update (${users.length} users) for guild ${guildId}`);
});
voiceService.start().catch(err => logger.error("[WS] ❌ Erreur démarrage VoiceService:", err));

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

                // Send initial voice state immediately
                const residents = voiceService.getVoiceUsers(guildId);
                if (residents.length > 0) {
                    socket.emit("discord:voice:update", { guildId, users: residents });
                }
            });
        } else {
            socket.join(`guild:${guildId}`);
            logger.info(`[WS] 🏢 Client ${socket.id} a rejoint le salon guilde: ${guildId}`);
            const residents = voiceService.getVoiceUsers(guildId);
            if (residents.length > 0) {
                socket.emit("discord:voice:update", { guildId, users: residents });
            }
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

    // [New] Direct voice request for immediate sync
    socket.on("discord:voice:request", (data: { guildId: string }) => {
        if (!data.guildId) return;
        // 🔐 (F-08) Only answer for a guild the user is a member of.
        if (WS_AUTH_ENABLED) {
            const userId = socket.data.userId as string | undefined;
            if (!userId) return;
            isMemberOfGuild(userId, data.guildId).then((allowed) => {
                if (!allowed) return;
                const residents = voiceService.getVoiceUsers(data.guildId);
                socket.emit("discord:voice:update", { guildId: data.guildId, users: residents });
                logger.info(`[WS] 🎤 Manual Voice Sync (${residents.length} users) for ${socket.id}`);
            });
            return;
        }
        const residents = voiceService.getVoiceUsers(data.guildId);
        socket.emit("discord:voice:update", { guildId: data.guildId, users: residents });
        logger.info(`[WS] 🎤 Manual Voice Sync (${residents.length} users) for ${socket.id}`);
    });

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

    // Gestion de la déconnexion
    socket.on("disconnect", (reason) => {
        logger.info(`[WS] 🔴 Client déconnecté: ${socket.id} (Raison: ${reason})`);
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