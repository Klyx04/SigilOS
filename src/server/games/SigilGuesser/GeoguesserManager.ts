import { Server, Socket } from "socket.io";
import { redis } from "@/lib/redis";
import { GeoguesserRoom } from "./GeoguesserRoom";
import { WorldMapService } from "./WorldMapService";
import { GeoguesserGuessSchema } from "../../websocket/schemas";
import { db } from "@/lib/prisma";

// Simple random ID generator (or reuse DB ID)
function generateShortId() {
    return "GEO-" + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export class GeoguesserManager {
    private rooms = new Map<string, GeoguesserRoom>();
    private syncInterval: NodeJS.Timeout | null = null;

    constructor(private io: Server) { 
        this.startBlacklistSync();
    }

    public registerSocket(socket: Socket) {
        socket.on("geoguesser:room:join", (data) => this.joinRoom(socket, data));
        socket.on("geoguesser:room:leave", () => this.leaveRoom(socket));
        socket.on("geoguesser:game:start", (data) => this.startGame(socket, data));
        socket.on("geoguesser:guess:submit", (data) => this.handleGuess(socket, data));
        socket.on("geoguesser:room:settings", (data) => this.updateSettings(socket, data));
        socket.on("geoguesser:game:next-round", () => this.triggerNextRound(socket));
        socket.on("geoguesser:room:list", () => this.handleRoomList(socket));
        socket.on("geoguesser:map:report", (data) => this.reportMap(socket, data));
    }

    private async updateSettings(socket: Socket, data: any) {
        const roomId = await this.getSocketRoom(socket.id);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (!room || !room.isHost(socket.id)) return;

        if (data.maxRounds) room.setMaxRounds(data.maxRounds);
        if (data.timePerRound) room.setTimePerRound(data.timePerRound);
        if (data.gameMode) room.setGameMode(data.gameMode);
        // Difficulty setting removed
    }

    private async triggerNextRound(socket: Socket) {
        const roomId = await this.getSocketRoom(socket.id);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (!room) return;
        room.triggerNextRound(socket);
    }

    private async setSocketRoom(socketId: string, roomId: string) {
        await redis.set(`socket:${socketId}:georoom`, roomId, "EX", 3600);
    }

    private async getSocketRoom(socketId: string) {
        return await redis.get(`socket:${socketId}:georoom`);
    }

    private async delSocketRoom(socketId: string) {
        await redis.del(`socket:${socketId}:georoom`);
    }

    private async handleRoomList(socket: Socket) {
        const guildId = (socket.handshake.query.guildId as string) || "global";
        const rooms: any[] = [];
        this.rooms.forEach((room, roomId) => {
            if (room.guildId === guildId && !room.isEmpty()) {
                rooms.push(room.getPublicInfo(roomId));
            }
        });
        socket.emit("geoguesser:room:list", rooms);
    }

    private broadcastRoomList(guildId?: string) {
        if (!guildId) return;
        const rooms: any[] = [];
        this.rooms.forEach((room, roomId) => {
            if (room.guildId === guildId && !room.isEmpty()) {
                rooms.push(room.getPublicInfo(roomId));
            }
        });
        this.io.to(`guild:${guildId}`).emit("geoguesser:room:list", rooms);
    }

    private async joinRoom(socket: Socket, data: any) {
        const { roomId, pseudo, userId, avatarUrl, maxRounds, timePerRound } = data;
        const guildId = (socket.handshake.query.guildId as string) || "global";

        let room = this.rooms.get(roomId);
        if (!room) {
            room = new GeoguesserRoom(this.io, {
                id: roomId,
                guildId,
                maxRounds: maxRounds || 5,
                timePerRound: timePerRound || 30
            });
            this.rooms.set(roomId, room);
        } else {
            // SECURITY: Check guild isolation
            if (room.guildId !== guildId) {
                console.warn(`[GeoguesserManager] ❌ Guild mismatch: ${socket.id} tried to join ${roomId}`);
                socket.emit("geoguesser:error", { message: "Ce salon n'appartient pas à votre guilde." });
                return;
            }
        }

        socket.join(roomId);
        await this.setSocketRoom(socket.id, roomId);

        // Geoguesser allows mid-game participation, so we only force spectator if requested
        const isSpectator = !!data.isSpectator;

        room.addPlayer(socket, { 
            userName: pseudo, 
            userId, 
            userAvatar: avatarUrl,
            isSpectator 
        });
        room.handleLateJoin(socket);

        socket.emit("geoguesser:room:joined", { roomId });
        this.broadcastRoomList(guildId);
    }

    private async leaveRoom(socket: Socket) {
        const roomId = await this.getSocketRoom(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (room) {
            const guildId = room.guildId;
            room.removePlayer(socket.id);
            socket.leave(roomId);
            await this.delSocketRoom(socket.id);

            if (room.isEmpty()) {
                room.destroy();
                this.rooms.delete(roomId);
            }
            this.broadcastRoomList(guildId);
        }
    }

    private async startGame(socket: Socket, data: any) {
        const { targetMapIds } = data;
        const roomId = await this.getSocketRoom(socket.id);
        console.log(`[Geoguesser] 🚀 Tentative de lancement - Room: ${roomId}, Socket: ${socket.id}`);

        if (!roomId) {
            console.error(`[Geoguesser] ❌ Pas de roomId trouvé en Redis pour le socket ${socket.id}`);
            return;
        }

        const room = this.rooms.get(roomId);
        if (!room) {
            console.error(`[Geoguesser] ❌ Instance de room ${roomId} introuvable en mémoire.`);
            return;
        }

        if (room.isHost(socket.id)) {
            console.log(`[Geoguesser] ✅ Lancement autorisé (Hôte: ${socket.id})`);
            if (data.maxRounds) room.setMaxRounds(data.maxRounds);
            if (data.timePerRound) room.setTimePerRound(data.timePerRound);
            // Difficulty setting removed
            room.startGame(data.targetMapIds);
        } else {
            console.warn(`[Geoguesser] ⚠️ Le socket ${socket.id} n'est pas l'hôte de la room ${roomId}`);
        }
    }

    private async handleGuess(socket: Socket, data: any) {
        // SECURITY: Validate coordinates
        const validation = GeoguesserGuessSchema.safeParse(data);
        if (!validation.success) {
            console.warn(`[GeoguesserManager] ❌ Invalid guess from ${socket.id}`, validation.error.format());
            return;
        }

        const { x, y, score, distance, round, mapId, worldId } = data;
        const roomId = await this.getSocketRoom(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room || room.isSpectator(socket.id)) return;

        room.handleGuess(socket, { x, y, score, distance, mapId, worldId } as any);
    }

    public async handleDisconnect(socket: Socket, reason: string) {
        const roomId = await this.getSocketRoom(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (room) {
            const guildId = room.guildId;
            room.handlePlayerDisconnect(socket.id, reason);
            await this.delSocketRoom(socket.id);

            if (room.isEmpty()) {
                setTimeout(() => {
                    const currentRoom = this.rooms.get(roomId);
                    if (currentRoom && currentRoom.isEmpty()) {
                        currentRoom.destroy();
                        this.rooms.delete(roomId);
                        this.broadcastRoomList(guildId);
                    }
                }, 10000);
            } else {
                this.broadcastRoomList(guildId);
            }

        } else {
            await this.delSocketRoom(socket.id);
        }
    }

    private async reportMap(socket: Socket, data: any) {
        let mapId = data?.mapId;
        
        // If mapId is missing from data, try to find it from the room state (more secure)
        if (!mapId) {
            const roomId = await this.getSocketRoom(socket.id);
            if (roomId) {
                const room = this.rooms.get(roomId);
                if (room) {
                    mapId = room.getCurrentMapId();
                }
            }
        }

        if (mapId) mapId = Number(mapId);
        
        if (!mapId || isNaN(mapId)) {
            console.warn(`[GeoguesserManager] 🚩 Report ignored: No valid mapId provided and no active room found for ${socket.id}`);
            return;
        }

        try {
            // Use upsert to ensure the singleton exists even if god hasn't visited the dashboard yet
            const config = await db.platformConfig.upsert({
                where: { id: "singleton" },
                update: {},
                create: { id: "singleton" }
            });
            
            const reported = (config.geoguesserReportedMaps as number[]) || [];
            if (!reported.includes(mapId)) {
                reported.push(mapId);
                await db.platformConfig.update({
                    where: { id: "singleton" },
                    data: { geoguesserReportedMaps: reported }
                });
                console.log(`[GeoguesserManager] 🚩 Map ${mapId} reported by ${socket.id}`);
                
                // Trigger revalidation for the God Dashboard - REMOVED: Since we use auto-polling, we don't need this, and it crashes the WebSocket server process.

                // [NEW] GLOBAL GOD NOTIFICATION
                if ((config as any).godNotifyChannelId) {
                    const { sendChannelMessage } = await import("@/server/discord");
                    const ping = (config as any).godNotifyRoleId ? `<@&${(config as any).godNotifyRoleId}>` : "";
                    
                    await sendChannelMessage((config as any).godNotifyChannelId, ping, {
                        embedTitle: "🚩 Signalement Map SigilGuesser",
                        embedColor: 0xef4444,
                        embedDescription: [
                            `Une map a été signalée comme étant buggée ou mal placée.`,
                            "",
                            `**Map ID :** \`${data.mapId}\``,
                            `**Signalé par :** \`${socket.id}\``,
                            "",
                            `▸ [Gérer les maps sur Dashboard](https://sigilos.fr/god/mini-games?game=SigilGuesser)`,
                        ].join("\n"),
                        embedFooter: "SigilOS Administration · SigilGuesser",
                        embedThumbnail: "https://sigilos.fr/assets/ui/icons/geoguesser.png"
                    });
                }
            }
        } catch (e) {
            console.error(`[GeoguesserManager] ❌ Error reporting map:`, e);
        }
    }

    private async startBlacklistSync() {
        const sync = async () => {
            try {
                const config = await db.platformConfig.findUnique({
                    where: { id: "singleton" },
                    select: { geoguesserBlacklist: true }
                });
                if (config) {
                    WorldMapService.getInstance().setBlacklist(config.geoguesserBlacklist);
                }
            } catch (e) {
                console.error("[GeoguesserManager] ❌ Blacklist sync failed:", e);
            }
        };

        // Initial sync
        await sync();
        // Periodically sync (every 5 mins)
        this.syncInterval = setInterval(sync, 5 * 60 * 1000);
    }
}
