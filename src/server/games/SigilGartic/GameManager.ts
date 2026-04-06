import { Server, Socket } from "socket.io";
import { redis } from "@/lib/redis";
import { GarticRoom, RoomConfig } from "./Room";
import { GarticDrawSchema, GarticTextSchema } from "../../websocket/schemas";

function generateShortId() {
    return "PHONE-" + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export class GameManager {
    private rooms = new Map<string, GarticRoom>();

    constructor(private io: Server) { }

    public registerSocket(socket: Socket) {
        socket.on("gartic:room:create", (config) => this.createRoom(socket, config));
        socket.on("gartic:room:join", ({ roomId, playerObj }) => this.joinRoom(socket, roomId, playerObj));
        socket.on("gartic:room:leave", () => this.handleLeaveRoom(socket));
        socket.on("gartic:room:list", () => this.handleRoomList(socket));
        
        socket.on("gartic:text:submit", ({ text }) => this.handleTextSubmit(socket, text));
        socket.on("gartic:draw:submit", ({ dataUrl }) => this.handleDrawSubmit(socket, dataUrl));
        
        socket.on("gartic:game:start", () => this.startGame(socket));
        socket.on("gartic:room:delete", () => this.handleDeleteRoom(socket));
        socket.on("gartic:reveal:next", () => this.handleRevealNext(socket));
    }

    private async delSocketData(socketId: string) {
        try {
            await redis.del(`socket:gartic:${socketId}:room`);
            await redis.del(`socket:gartic:${socketId}:user`);
        } catch (e) {}
    }

    private async setSocketData(socketId: string, roomId: string, userId: string) {
        try {
            await redis.set(`socket:gartic:${socketId}:room`, roomId, "EX", 3600);
            await redis.set(`socket:gartic:${socketId}:user`, userId, "EX", 3600);
        } catch (e) {}
    }

    private async handleRoomList(socket: Socket) {
        const guildId = (socket.handshake.query.guildId as string) || "global";
        const rooms: any[] = [];
        this.rooms.forEach((room, roomId) => {
            if (!room.isEmpty() && room.getGuildId() === guildId) {
                rooms.push(room.getPublicInfo(roomId));
            }
        });
        socket.emit("gartic:room:list", rooms);
    }

    private async broadcastRoomList(guildId?: string) {
        if (!guildId) return;
        const rooms: any[] = [];
        this.rooms.forEach((room, roomId) => {
            if (!room.isEmpty() && room.getGuildId() === guildId) {
                rooms.push(room.getPublicInfo(roomId));
            }
        });
        this.io.to(`guild:${guildId}`).emit("gartic:room:list", rooms);

        // Internal Redis broadcast for Dashboard EventTicker
        if (guildId !== "global") {
            await redis.set(`guild:${guildId}:gartic:rooms`, JSON.stringify(rooms), "EX", 3600);
        }
    }

    private async createRoom(socket: Socket, config: any) {
        try {
            const userId = config.userId || socket.id;
            const guildId = socket.handshake.query.guildId as string;
            
            const existingRoomId = await redis.get(`user:${userId}:gartic:room`);
            if (existingRoomId && this.rooms.has(existingRoomId)) {
                socket.emit("gartic:error", { message: "Vous avez déjà un salon actif." });
                return;
            }

            const roomId = generateShortId();
            const room = new GarticRoom(this.io, { ...config, id: roomId, guildId });
            this.rooms.set(roomId, room);

            await redis.set(`user:${userId}:gartic:room`, roomId, "EX", 7200);
            socket.emit("gartic:room:created", { roomId });
            
            // Join host
            await this.joinRoom(socket, roomId, { 
                userName: config.userName || config.pseudo,
                userId,
                userAvatar: config.userAvatar
            });
        } catch (e) {
            console.error("[GarticManager] createRoom error:", e);
        }
    }

    private async joinRoom(socket: Socket, roomId: string, playerObj: any) {
        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit("gartic:error", { message: "Salon introuvable ou fermé." });
            return;
        }

        const socketGuildId = (socket.handshake.query.guildId as string) || "global";
        if (room.getGuildId() !== socketGuildId) {
            console.warn(`[GarticManager] ❌ Guild mismatch: ${socket.id} tried to join ${roomId}`);
            socket.emit("gartic:error", { message: "Ce salon n'appartient pas à votre guilde." });
            return;
        }

        const userId = playerObj.userId || socket.id;
        socket.join(roomId);
        await this.setSocketData(socket.id, roomId, userId);

        // SECURITY: Force spectator if game is already active
        const isSpectator = !!playerObj.isSpectator || !room.isInLobby();

        room.addPlayer(socket, playerObj.userName || playerObj.pseudo, userId, playerObj.userAvatar || playerObj.avatarUrl, isSpectator);
        this.broadcastRoomList(room.getGuildId());
    }

    private async handleLeaveRoom(socket: Socket) {
        const roomId = await redis.get(`socket:gartic:${socket.id}:room`);
        const userId = await redis.get(`socket:gartic:${socket.id}:user`);
        
        if (roomId) {
            socket.leave(roomId);
            const room = this.rooms.get(roomId);
            if (room) {
                const guildId = room.getGuildId();
                room.handlePlayerDisconnect(socket.id);
                if (room.isEmpty()) {
                    room.destroy();
                    this.rooms.delete(roomId);
                }
                this.broadcastRoomList(guildId);
            }
        }
        
        if (userId) {
            const activeRoomId = await redis.get(`user:${userId}:gartic:room`);
            if (activeRoomId === roomId) {
                await redis.del(`user:${userId}:gartic:room`);
            }
        }
        await this.delSocketData(socket.id);
    }

    public async handleDisconnect(socket: Socket) {
        try {
            const roomId = await redis.get(`socket:gartic:${socket.id}:room`);
            const userId = await redis.get(`socket:gartic:${socket.id}:user`);
            
            if (roomId) {
                const room = this.rooms.get(roomId);
                if (room) {
                    const guildId = room.getGuildId();
                    room.handlePlayerDisconnect(socket.id);
                    if (room.isEmpty()) {
                        setTimeout(async () => {
                            const refreshedRoom = this.rooms.get(roomId);
                            if (refreshedRoom && refreshedRoom.isEmpty()) {
                                refreshedRoom.destroy();
                                this.rooms.delete(roomId);
                                this.broadcastRoomList(guildId);
                            }
                        }, 30000);
                    } else {
                        this.broadcastRoomList(guildId);
                    }
                }
            }

            if (userId && roomId) {
                 const activeRoomId = await redis.get(`user:${userId}:gartic:room`);
                 if (activeRoomId === roomId) {
                     await redis.del(`user:${userId}:gartic:room`);
                 }
            }
            await this.delSocketData(socket.id);
        } catch (e) {}
    }

    private async handleTextSubmit(socket: Socket, text: string) {
        const validation = GarticTextSchema.safeParse({ text });
        if (!validation.success) return;

        const roomId = await redis.get(`socket:gartic:${socket.id}:room`);
        if (roomId) {
            const room = this.rooms.get(roomId);
            if (room && !room.isSpectator(socket.id)) {
                room.handleTextSubmit(socket, text);
            }
        }
    }
    
    private async handleDrawSubmit(socket: Socket, dataUrl: string) {
        const validation = GarticDrawSchema.safeParse({ dataUrl });
        if (!validation.success) return;

        const roomId = await redis.get(`socket:gartic:${socket.id}:room`);
        if (roomId) {
            const room = this.rooms.get(roomId);
            if (room && !room.isSpectator(socket.id)) {
                room.handleDrawSubmit(socket, dataUrl);
            }
        }
    }

    private async startGame(socket: Socket) {
        const roomId = await redis.get(`socket:gartic:${socket.id}:room`);
        const room = roomId ? this.rooms.get(roomId) : null;
        if (room) {
            if (room.isHost(socket.id)) {
                room.startGame();
            } else {
                console.warn(`[GarticManager] Player ${socket.id} tried to start game in room ${roomId} but is not host.`);
                socket.emit("gartic:error", { message: "Seul l'hôte peut lancer la partie." });
            }
        }
    }

    private async handleRevealNext(socket: Socket) {
        const roomId = await redis.get(`socket:gartic:${socket.id}:room`);
        if (roomId) {
            const room = this.rooms.get(roomId);
            if (room && room.isHost(socket.id)) {
                room.handleRevealNext();
            }
        }
    }

    private async handleDeleteRoom(socket: Socket) {
        try {
            const roomId = await redis.get(`socket:gartic:${socket.id}:room`);
            if (!roomId) return;
            const room = this.rooms.get(roomId);
            if (room) {
                const hostId = room.getHostId();
                this.io.to(roomId).emit("gartic:error", { message: "Le salon a été fermé par l'hôte." });
                room.destroy();
                this.rooms.delete(roomId);
                if (hostId) await redis.del(`user:${hostId}:gartic:room`);
                this.broadcastRoomList(room.getGuildId());
            }
        } catch (e) {}
    }
}
