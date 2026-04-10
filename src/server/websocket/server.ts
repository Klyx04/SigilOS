import "dotenv/config";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redis } from "../../lib/redis";
import { GameManager as GarticGameManager } from "../games/SigilGartic/GameManager";
import { SkribblManager } from "../games/SigilSkribbl/SkribblManager";
import { GeoguesserManager } from "../games/SigilGuesser/GeoguesserManager";
import { WorldMapService } from "../games/SigilGuesser/WorldMapService";
import { SigilKingManager } from "../games/SigilKing/SigilKingManager";
import { BombManager } from "../games/SigilBomb/BombManager";

const logger = console; // Bypass structured logger for local debugging

// Load Geoguesser data
WorldMapService.getInstance().loadData();

const PORT = 3001;

// Create standalone HTTP server for WebSockets
const httpServer = createServer((req, res) => {
    console.log(`[HTTP] 📥 Requête reçue: ${req.method} ${req.url}`);
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
    cors: {
        origin: (origin, callback) => {
            // En dev, on accepte tout. En prod, on restreint.
            if (!isProd || !origin || [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "https://sigilos.fr",
                "https://beta.sigilos.fr"
            ].includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        methods: ["GET", "POST"],
        credentials: true
    },
    // On n'active l'adapter Redis que si on a les clients prêts (utile pour le VPS)
    adapter: isProd ? createAdapter(pubClient, subClient) : undefined,
    path: "/socket.io/"
});

const garticManager = new GarticGameManager(io);
const skribblManager = new SkribblManager(io);
const geoguesserManager = new GeoguesserManager(io);
const sigilKingManager = new SigilKingManager(io);
const bombManager = new BombManager(io);

// [New] Broadcast Ocre Trade & DJ Finder Updates from Redis
subClient.subscribe("ocre:trade:update", "dj:finder:update", (err) => {
    if (err) console.error("[WS] ❌ Erreur abonnement Redis:", err);
});

subClient.on("message", (channel, message) => {
    if (channel === "ocre:trade:update" || channel === "dj:finder:update") {
        try {
            const data = JSON.parse(message);
            if (data.guildId) {
                io.to(`guild:${data.guildId}`).emit(channel, data);
                console.log(`[WS] 🔄 Broadcast ${channel} pour guilde ${data.guildId}`);
            }
        } catch (e) {
            console.error(`[WS] ❌ Erreur parsing message ${channel}:`, e);
        }
    }
});

// Gestionnaire global des connexions
io.on("connection", (socket: Socket) => {
    let guildId = socket.handshake.query.guildId as string;
    if (guildId === "undefined" || guildId === "null" || !guildId) guildId = "global";

    if (guildId && guildId !== "global") {
        socket.join(`guild:${guildId}`);
        console.log(`[WS] 🏢 Client ${socket.id} a rejoint le salon guilde: ${guildId}`);
    } else {
        socket.join("guild:global");
    }

    console.log(`[WS] 🟢 Client connecté: ${socket.id}`);
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

    // === SIGIL KING ===
    logger.info(`[WS] Initialisation SigilKing pour ${socket.id}`);
    sigilKingManager.registerSocket(socket);

    // === SIGIL BOMB ===
    logger.info(`[WS] Initialisation SigilBomb pour ${socket.id}`);
    bombManager.registerSocket(socket);

    // Gestion de la déconnexion
    socket.on("disconnect", (reason) => {
        logger.info(`[WS] 🔴 Client déconnecté: ${socket.id} (Raison: ${reason})`);
        garticManager.handleDisconnect(socket);
        skribblManager.handleDisconnect(socket, reason);
        geoguesserManager.handleDisconnect(socket, reason);
        sigilKingManager.handleDisconnect(socket, reason);
        bombManager.handleDisconnect(socket);
    });
});

// On démarre sans spécifier d'IP pour laisser l'OS choisir (souvent :: et 0.0.0.0)
// En dev, on écoute partout pour éviter les soucis de résolution localhost
try {
    httpServer.listen(PORT, "::", () => {
        console.log(`[WS] 🚀 Serveur WebSocket démarré sur le port ${PORT} (IPv4/IPv6)`);
        console.log(`[WS] Testez via: http://localhost:${PORT}/health`);
    });
} catch (err: any) {
    console.error("[WS] ❌ Erreur FATALE au démarrage:", err);
    process.exit(1);
}

httpServer.on("error", (err) => {
    console.error("[WS] ❌ Erreur Serveur HTTP:", err);
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
