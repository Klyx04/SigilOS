import "dotenv/config";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redis } from "../../lib/redis";
import { GameManager as GarticGameManager } from "../games/SigilGartic/GameManager";
import { SkribblManager } from "../games/SigilSkribbl/SkribblManager";
import { GeoguesserManager } from "../games/SigilGuesser/GeoguesserManager";
import { WorldMapService } from "../games/SigilGuesser/WorldMapService";
import { BombManager } from "../games/SigilBomb/BombManager";
import { InvaderManager } from "../games/SigilInvaderManager";
import { rateLimit } from "../../lib/ratelimit";
import { DiscordVoiceService } from "../discord/voice-service";
import { logger as AppLogger } from "../../lib/logger";

// Fallback if logger is not correctly initialized
const logger = AppLogger || console;

// Load Geoguesser data
WorldMapService.getInstance().loadData();

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
        // Whether to discard events of some rooms when we can't recover the state
        skipMiddlewares: true,
    }
});

// [AUDIT 2026] HARD-03: Connection Rate Limiting
io.use(async (socket, next) => {
    const ip = socket.handshake.address;
    const { success } = await rateLimit(`ws-connect:${ip}`, 10, 60000);
    
    if (!success) {
        logger.warn("[WS] 🛑 Rate limit atteint pour la connexion (IP: ${ip})");
        return next(new Error("Rate limit exceeded. Please wait a minute."));
    }
    next();
});


const garticManager = new GarticGameManager(io);
const skribblManager = new SkribblManager(io);
const geoguesserManager = new GeoguesserManager(io);
const bombManager = new BombManager(io);
const invaderManager = new InvaderManager(io);

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
});

// Gestionnaire global des connexions
io.on("connection", (socket: Socket) => {
    let guildId = socket.handshake.query.guildId as string;
    if (guildId === "undefined" || guildId === "null" || !guildId) guildId = "global";

    if (guildId && guildId !== "global") {
        socket.join(`guild:${guildId}`);
        logger.info(`[WS] 🏢 Client ${socket.id} a rejoint le salon guilde: ${guildId}`);
        
        // [New] Send initial voice state immediately
        const residents = voiceService.getVoiceUsers(guildId);
        if (residents.length > 0) {
            socket.emit("discord:voice:update", { guildId, users: residents });
            logger.info(`[WS] 🎤 Initial Voice Sync (${residents.length} users) for ${socket.id}`);
        }
    } else {
        socket.join("guild:global");
    }

    logger.info(`[WS] 🟢 Client connecté: ${socket.id}`);
    socket.emit("test:heartbeat", { time: Date.now() });

    // === GARTIC PHONE ===
    logger.info(`[WS] Initialisation Gartic pour ${socket.id}`);
    garticManager.registerSocket(socket);

    // === SKRIBBL.IO (Sigil-Draw) ===
    logger.info(`[WS] Initialisation Skribbl pour ${socket.id}`);
    skribblManager.registerSocket(socket);

    // === SIGIL-GUESSER ===
    logger.info(`[WS] Initialisation Geoguesser pour ${socket.id}`);
    geoguesserManager.registerSocket(socket);

    // === SIGIL BOMB ===
    logger.info(`[WS] Initialisation SigilBomb pour ${socket.id}`);
    bombManager.registerSocket(socket);

    // [New] Direct voice request for immediate sync
    socket.on("discord:voice:request", (data: { guildId: string }) => {
        if (!data.guildId) return;
        const residents = voiceService.getVoiceUsers(data.guildId);
        socket.emit("discord:voice:update", { guildId: data.guildId, users: residents });
        logger.info(`[WS] 🎤 Manual Voice Sync (${residents.length} users) for ${socket.id}`);
    });

    // === SIGIL INVADER ===
    logger.info(`[WS] Initialisation SigilInvader pour ${socket.id}`);
    invaderManager.registerSocket(socket);

    // Gestion de la déconnexion
    socket.on("disconnect", (reason) => {
        logger.info(`[WS] 🔴 Client déconnecté: ${socket.id} (Raison: ${reason})`);
        garticManager.handleDisconnect(socket);
        skribblManager.handleDisconnect(socket, reason);
        geoguesserManager.handleDisconnect(socket, reason);
        bombManager.handleDisconnect(socket);
        invaderManager.handleDisconnect(socket);
    });
});

// On démarre sans spécifier d'IP pour laisser l'OS choisir (souvent :: et 0.0.0.0)
// En dev, on écoute partout pour éviter les soucis de résolution localhost
try {
    httpServer.listen(PORT, "::", () => {
        logger.info(`[WS] 🚀 Serveur WebSocket démarré sur le port ${PORT} (IPv4/IPv6)`);
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
