/**
 * Sigil King — Socket.io Manager
 * Follows the exact same pattern as SkribblManager & GarticGameManager
 */

import { Server, Socket } from "socket.io";
import { redis } from "@/lib/redis";
import { SigilKingRoom, SigilKingSettings } from "./SigilKingRoom";
import { SigilKingBidSchema, SigilKingPlaySchema } from "../../websocket/schemas";

function generateShortId() {
    return "KING-" + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export class SigilKingManager {
    private rooms = new Map<string, SigilKingRoom>();

    constructor(private io: Server) {}

    public registerSocket(socket: Socket) {
        socket.on("sk:room:create", (config) => this.createRoom(socket, config));
        socket.on("sk:room:join", ({ roomId, playerObj }) => this.joinRoom(socket, roomId, playerObj));
        socket.on("sk:room:leave", () => this.handleLeaveRoom(socket));
        socket.on("sk:room:list", () => this.handleRoomList(socket));
        socket.on("sk:room:delete", () => this.handleDeleteRoom(socket));
        socket.on("sk:room:settings", (config) => this.handleUpdateSettings(socket, config));

        socket.on("sk:game:start", () => this.handleStart(socket));
        socket.on("sk:bid:submit", ({ amount }) => this.handleBid(socket, amount));
        socket.on("sk:card:play", ({ cardId, sramChoice }) => this.handlePlayCard(socket, cardId, sramChoice));
    }

    // ─── Room List ───────────────────────────────────────────

    private handleRoomList(socket: Socket) {
        const guildId = (socket.handshake.query.guildId as string) || "global";
        const rooms: any[] = [];
        this.rooms.forEach((room, roomId) => {
            if (room.isInLobby() && room.getGuildId() === guildId) {
                rooms.push(room.getPublicInfo(roomId));
            }
        });
        socket.emit("sk:room:list", rooms);
    }

    private broadcastRoomList(guildId?: string) {
        if (!guildId) return;
        const rooms: any[] = [];
        this.rooms.forEach((room, roomId) => {
            if (room.isInLobby() && room.getGuildId() === guildId) {
                rooms.push(room.getPublicInfo(roomId));
            }
        });
        this.io.to(`guild:${guildId}`).emit("sk:room:list", rooms);
    }

    // ─── Create / Join / Leave ──────────────────────────────

    private async createRoom(socket: Socket, config: any) {
        try {
            const userId = config.userId || socket.id;
            const guildId = (socket.handshake.query.guildId as string) || "global";

            const existingRoomId = await redis.get(`user:${userId}:sk:room`);
            if (existingRoomId && this.rooms.has(existingRoomId)) {
                socket.emit("sk:room:created", { roomId: existingRoomId });
                return;
            }

            const roomId = generateShortId();
            const room = new SigilKingRoom(this.io, {
                id: roomId,
                guildId,
                settings: config.settings,
            });
            this.rooms.set(roomId, room);

            await redis.set(`user:${userId}:sk:room`, roomId, "EX", 7200);
            socket.emit("sk:room:created", { roomId });

            // Auto-join host
            await this.joinRoom(socket, roomId, {
                userName: config.userName || config.pseudo,
                userId,
                userAvatar: config.userAvatar,
            });
        } catch (e) {
            console.error("[SigilKingManager] createRoom error:", e);
        }
    }

    private async joinRoom(socket: Socket, roomId: string, playerObj: any) {
        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit("sk:error", { message: "Salon introuvable ou fermé." });
            return;
        }

        const socketGuildId = (socket.handshake.query.guildId as string) || "global";
        if (room.getGuildId() !== socketGuildId) {
            socket.emit("sk:error", { message: "Ce salon n'appartient pas à votre guilde." });
            return;
        }

        const userId = playerObj.userId || socket.id;
        socket.join(roomId);
        await this.setSocketData(socket.id, roomId, userId);

        // SECURITY: Force spectator if game already started
        const isSpectator = !!playerObj.isSpectator || !room.isInLobby();

        room.addPlayer(
            socket,
            playerObj.userName || playerObj.pseudo,
            userId,
            playerObj.userAvatar || playerObj.avatarUrl,
            isSpectator
        );
        this.broadcastRoomList(room.getGuildId());
    }

    private async handleLeaveRoom(socket: Socket) {
        const roomId = await redis.get(`socket:sk:${socket.id}:room`);
        const userId = await redis.get(`socket:sk:${socket.id}:user`);

        if (roomId) {
            socket.leave(roomId);
            const room = this.rooms.get(roomId);
            if (room) {
                const guildId = room.getGuildId();
                room.removePlayer(socket.id);
                if (room.isEmpty()) {
                    room.destroy();
                    this.rooms.delete(roomId);
                }
                this.broadcastRoomList(guildId);
            }
        }

        if (userId) {
            const activeRoomId = await redis.get(`user:${userId}:sk:room`);
            if (activeRoomId === roomId) {
                await redis.del(`user:${userId}:sk:room`);
            }
        }
        await this.delSocketData(socket.id);
    }

    private async handleDeleteRoom(socket: Socket) {
        try {
            const roomId = await redis.get(`socket:sk:${socket.id}:room`);
            if (!roomId) return;
            const room = this.rooms.get(roomId);
            if (room && room.isHost(socket.id)) {
                const hostId = room.getHostId();
                const guildId = room.getGuildId();
                this.io.to(roomId).emit("sk:error", { message: "Le salon a été fermé par l'hôte." });
                room.destroy();
                this.rooms.delete(roomId);
                if (hostId) await redis.del(`user:${hostId}:sk:room`);
                this.broadcastRoomList(guildId);
            }
        } catch (e) {
            console.error("[SigilKingManager] handleDeleteRoom error:", e);
        }
    }

    // ─── Game Actions ────────────────────────────────────────

    private async handleStart(socket: Socket) {
        const roomId = await redis.get(`socket:sk:${socket.id}:room`);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (room) {
            if (room.isHost(socket.id)) {
                room.startGame();
            } else {
                socket.emit("sk:error", { message: "Seul l'hôte peut lancer la partie." });
            }
        }
    }

    private async handleBid(socket: Socket, amount: number) {
        const validation = SigilKingBidSchema.safeParse({ amount });
        if (!validation.success) return;

        const roomId = await redis.get(`socket:sk:${socket.id}:room`);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (room && !room.isSpectator(socket.id)) {
            room.submitBid(socket.id, amount);
        }
    }

    private async handlePlayCard(socket: Socket, cardId: string, sramChoice?: "incarnation" | "pandawa") {
        const validation = SigilKingPlaySchema.safeParse({ cardId, sramChoice });
        if (!validation.success) return;

        const roomId = await redis.get(`socket:sk:${socket.id}:room`);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (room && !room.isSpectator(socket.id)) {
            room.playCard(socket.id, cardId, sramChoice);
        }
    }

    private async handleUpdateSettings(socket: Socket, config: any) {
        const roomId = await redis.get(`socket:sk:${socket.id}:room`);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (room && room.isHost(socket.id)) {
            room.updateSettings(config);
        }
    }

    // ─── Disconnect ──────────────────────────────────────────

    public async handleDisconnect(socket: Socket, reason: string) {
        const roomId = await redis.get(`socket:sk:${socket.id}:room`);
        const userId = await redis.get(`socket:sk:${socket.id}:user`);

        if (roomId) {
            const room = this.rooms.get(roomId);
            if (room) {
                const guildId = room.getGuildId();
                room.removePlayer(socket.id);
                if (room.isEmpty()) {
                    setTimeout(() => {
                        const currentRoom = this.rooms.get(roomId);
                        if (currentRoom && currentRoom.isEmpty()) {
                            currentRoom.destroy();
                            this.rooms.delete(roomId);
                            this.broadcastRoomList(guildId);
                        }
                    }, 15000);
                } else {
                    this.broadcastRoomList(guildId);
                }
            }
        }

        if (userId && roomId) {
            const activeRoomId = await redis.get(`user:${userId}:sk:room`);
            if (activeRoomId === roomId) {
                await redis.del(`user:${userId}:sk:room`);
            }
        }
        await this.delSocketData(socket.id);
    }

    // ─── Redis Helpers ───────────────────────────────────────

    private async setSocketData(socketId: string, roomId: string, userId: string) {
        try {
            await redis.set(`socket:sk:${socketId}:room`, roomId, "EX", 3600);
            await redis.set(`socket:sk:${socketId}:user`, userId, "EX", 3600);
        } catch (e) {}
    }

    private async delSocketData(socketId: string) {
        try {
            await redis.del(`socket:sk:${socketId}:room`);
            await redis.del(`socket:sk:${socketId}:user`);
        } catch (e) {}
    }
}
