import { Server, Socket } from "socket.io";
import { redis } from "@/lib/redis";
import { SkribblRoom } from "./SkribblRoom";
import { logger } from "@/lib/logger";
import { SkribblDrawSchema, SkribblGuessSchema } from "../../websocket/schemas";

function generateShortId() {
    return "DRAW-" + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export class SkribblManager {
    private rooms = new Map<string, SkribblRoom>();

    constructor(private io: Server) { }

    public registerSocket(socket: Socket) {
        // Enregistrement des événements via le namespace skribbl
        socket.on("skribbl:room:create", (config) => this.createRoom(socket, config));
        socket.on("skribbl:room:join", ({ roomId, playerObj }) => this.joinRoom(socket, roomId, playerObj));
        socket.on("skribbl:room:leave", () => this.handleLeaveRoom(socket));
        socket.on("skribbl:room:list", () => this.handleRoomList(socket));

        socket.on("skribbl:draw:stroke", (data) => this.relayToRoom(socket, "skribbl:draw:stroke", data));
        socket.on("skribbl:draw:clear", () => this.relayToRoom(socket, "skribbl:draw:clear"));
        socket.on("skribbl:draw:undo", () => this.relayToRoom(socket, "skribbl:draw:undo"));
        socket.on("skribbl:draw:fill", (data) => this.relayToRoom(socket, "skribbl:draw:fill", data));

        socket.on("skribbl:chat:guess", ({ text }) => this.handleGuess(socket, text));
        socket.on("skribbl:game:start", () => this.handleStart(socket));
        socket.on("skribbl:word:select", ({ word }) => this.handleWordChoice(socket, word));
        socket.on("skribbl:word:choose", ({ word }) => this.handleWordChoice(socket, word)); // Alias client
        socket.on("skribbl:word:reroll", () => this.handleWordReroll(socket));
        socket.on("skribbl:room:delete", () => this.handleDeleteRoom(socket));
        socket.on("skribbl:room:settings", (config) => this.handleUpdateSettings(socket, config));
    }

    private async handleUpdateSettings(socket: Socket, config: any) {
        const roomId = await redis.get(`socket:skribbl:${socket.id}:room`);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (room && room.isHost(socket.id)) {
            room.updateSettings(config);
        }
    }

    private async broadcastRoomList(guildIdCandidate?: string) {
        let guildId = guildIdCandidate || "global";
        if (guildId === "undefined" || guildId === "null") guildId = "global";

        const rooms: any[] = [];
        this.rooms.forEach((room, roomId) => {
            if (room.getGuildId() === guildId && !room.isEmpty()) {
                rooms.push(room.getPublicInfo(roomId));
            }
        });
        this.io.to(`guild:${guildId}`).emit("skribbl:room:list", rooms);
        
        // Internal Redis broadcast for Dashboard EventTicker
        if (guildId !== "global") {
            await redis.set(`guild:${guildId}:skribbl:rooms`, JSON.stringify(rooms), "EX", 3600);
        }
    }

    private handleRoomList(socket: Socket) {
        const guildId = (socket.handshake.query.guildId as string) || "global";

        const rooms: any[] = [];
        this.rooms.forEach((room, roomId) => {
            if (room.getGuildId() === guildId && !room.isEmpty()) {
                rooms.push(room.getPublicInfo(roomId));
            }
        });
        socket.emit("skribbl:room:list", rooms);
    }

    private async handleLeaveRoom(socket: Socket) {
        const roomId = await redis.get(`socket:skribbl:${socket.id}:room`);
        const userId = await redis.get(`socket:skribbl:${socket.id}:user`);

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
            const activeRoomId = await redis.get(`user:${userId}:skribbl:room`);
            if (activeRoomId === roomId) {
                await redis.del(`user:${userId}:skribbl:room`);
            }
        }
        await this.delSocketData(socket.id);
    }

    private async handleDeleteRoom(socket: Socket) {
        try {
            const roomId = await redis.get(`socket:skribbl:${socket.id}:room`);
            if (!roomId) return;
            const room = this.rooms.get(roomId);
            if (room && room.isHost(socket.id)) {
                const hostId = room.getHostId();
                const guildId = room.getGuildId();
                this.io.to(roomId).emit("skribbl:error", { message: "Le salon a été fermé par l'hôte." });
                room.destroy();
                this.rooms.delete(roomId);
                if (hostId) await redis.del(`user:${hostId}:skribbl:room`);
                this.broadcastRoomList(guildId);
            }
        } catch (e) {
            console.error("[SkribblManager] handleDeleteRoom error:", e);
        }
    }

    private async delSocketData(socketId: string) {
        try {
            await redis.del(`socket:skribbl:${socketId}:room`);
            await redis.del(`socket:skribbl:${socketId}:user`);
        } catch (e) {}
    }

    private async setSocketData(socketId: string, roomId: string, userId: string) {
        try {
            await redis.set(`socket:skribbl:${socketId}:room`, roomId, "EX", 3600);
            await redis.set(`socket:skribbl:${socketId}:user`, userId, "EX", 3600);
        } catch (e) {}
    }

    private async createRoom(socket: Socket, config: any) {
        try {
            const userId = config.playerObj?.userId || socket.id;
            let guildId = (socket.handshake.query.guildId as string);
            if (!guildId || guildId === "undefined" || guildId === "null") guildId = "global";

            const existingRoomId = await redis.get(`user:${userId}:skribbl:room`);
            if (existingRoomId && this.rooms.has(existingRoomId)) {
                // If the user already has a room, maybe they just need to rejoin it?
                // For now, we allow them to proceed if they are trying to create.
                // Or we can just join the existing one.
                socket.emit("skribbl:room:created", { roomId: existingRoomId });
                return;
            }

            const roomId = generateShortId();
            const room = new SkribblRoom(this.io, this, { ...config, id: roomId, guildId });
            this.rooms.set(roomId, room);

            await redis.set(`user:${userId}:skribbl:room`, roomId, "EX", 7200);
            socket.emit("skribbl:room:created", { roomId });
            this.broadcastRoomList(guildId);
        } catch (e) {
            console.error("[SkribblManager] createRoom error:", e);
        }
    }

    private async joinRoom(socket: Socket, roomId: string, playerObj: any) {
        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit("skribbl:error", { message: "Salon introuvable ou fermé." });
            return;
        }

        const socketGuildId = (socket.handshake.query.guildId as string) || "global";
        if (room.getGuildId() !== socketGuildId) {
            console.warn(`[SkribblManager] ❌ Guild mismatch: ${socket.id} tried to join ${roomId}`);
            socket.emit("skribbl:error", { message: "Ce salon n'appartient pas à votre guilde." });
            return;
        }

        const userId = playerObj.userId || socket.id;
        socket.join(roomId);
        await this.setSocketData(socket.id, roomId, userId);
        
        // SECURITY: If game is not in lobby, force spectator mode
        const isSpectator = !!playerObj.isSpectator || room.getState() !== "LOBBY";

        room.addPlayer(socket, { 
            userName: playerObj.userName || playerObj.pseudo, 
            userId: userId, 
            userAvatar: playerObj.userAvatar || playerObj.avatarUrl,
            isSpectator // Correctement passé ici
        } as any);
        this.broadcastRoomList(room.getGuildId());
    }

    private async relayToRoom(socket: Socket, event: string, data?: any) {
        // SECURITY: Validate drawing data
        if (event === "skribbl:draw:stroke" || event === "skribbl:draw:fill") {
            const validation = SkribblDrawSchema.safeParse(data);
            if (!validation.success) {
                console.warn(`[SkribblManager] ❌ Invalid draw data from ${socket.id}`, validation.error.format());
                return;
            }
        }

        const roomId = await redis.get(`socket:skribbl:${socket.id}:room`);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room) return;

        // SECURITY: Spectators can never draw
        if (room.isSpectator(socket.id)) {
            console.warn(`[SkribblManager] 🚫 Spectator ${socket.id} tried to draw in ${roomId}`);
            return;
        }

        if (event === "skribbl:draw:undo") {
            room.undoCanvasAction();
            return;
        }

        if (event.startsWith("skribbl:draw:")) {
            const actionType = event.replace("skribbl:draw:", "");
            if (actionType === "stroke" && Array.isArray(data)) {
                // For batched strokes, we store the data as-is if it's an array
                room.addCanvasAction(data);
            } else {
                room.addCanvasAction({ type: actionType, ...data });
            }
        }

        if (data !== undefined) {
            socket.to(roomId).emit(event, data);
        } else {
            socket.to(roomId).emit(event);
        }
    }

    private async handleGuess(socket: Socket, text: string) {
        // SECURITY: Validate guess text
        const validation = SkribblGuessSchema.safeParse({ text });
        if (!validation.success) return;

        const roomId = await redis.get(`socket:skribbl:${socket.id}:room`);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (room) {
            // SECURITY: Spectators cannot guess
            if (room.isSpectator(socket.id)) {
                console.warn(`[SkribblManager] 🚫 Spectator ${socket.id} tried to guess in room ${roomId}`);
                return;
            }
            room.handleGuess(socket, text);
        }
    }

    private async handleStart(socket: Socket) {
        const roomId = await redis.get(`socket:skribbl:${socket.id}:room`);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (room) {
            if (room.isHost(socket.id)) {
                room.startGame();
            } else {
                console.warn(`[SkribblManager] Player ${socket.id} tried to start game in room ${roomId} but is not host.`);
                socket.emit("skribbl:error", { message: "Seul l'hôte peut lancer la partie." });
            }
        }
    }

    private async handleWordChoice(socket: Socket, word: string) {
        const roomId = await redis.get(`socket:skribbl:${socket.id}:room`);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (room) room.handleWordChoice(socket.id, word);
    }

    private async handleWordReroll(socket: Socket) {
        const roomId = await redis.get(`socket:skribbl:${socket.id}:room`);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (room) room.handleWordReroll(socket.id);
    }

    public async handleDisconnect(socket: Socket, reason: string) {
        const roomId = await redis.get(`socket:skribbl:${socket.id}:room`);
        const userId = await redis.get(`socket:skribbl:${socket.id}:user`);

        if (roomId) {
            const room = this.rooms.get(roomId);
            if (room) {
                const guildId = room.getGuildId();
                room.removePlayer(socket.id);
                
                if (room.isEmpty()) {
                    // Grace period of 10 seconds before destroying the room
                    setTimeout(() => {
                        const currentRoom = this.rooms.get(roomId);
                        if (currentRoom && currentRoom.isEmpty()) {
                            currentRoom.destroy();
                            this.rooms.delete(roomId);
                            this.broadcastRoomList(guildId);
                            console.log(`[SkribblManager] Room ${roomId} destroyed after grace period.`);
                        }
                    }, 10000);
                } else {
                    this.broadcastRoomList(guildId);
                }
            }
        }

        if (userId && roomId) {
            const activeRoomId = await redis.get(`user:${userId}:skribbl:room`);
            if (activeRoomId === roomId) {
                await redis.del(`user:${userId}:skribbl:room`);
            }
        }
        await this.delSocketData(socket.id);
    }
}
