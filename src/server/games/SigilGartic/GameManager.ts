import { Server, Socket } from "socket.io";
import { redis } from "@/lib/redis";
import { GarticRoom } from "./Room";

// Simple random ID generator
function generateShortId() {
    return "DOFUS-" + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export class GameManager {
    // We KEEP the room objects in-memory for active instances, 
    // but the INDEX (socketId -> roomId) goes to Redis for better horizontal scalability/resilience.
    private rooms = new Map<string, GarticRoom>();

    constructor(private io: Server) { }

    public registerSocket(socket: Socket) {
        socket.on("gartic:room:create", (config) => this.createRoom(socket, config));
        socket.on("gartic:room:join", ({ roomId }) => this.joinRoom(socket, roomId));
        socket.on("gartic:draw:stroke", (stroke) => this.relayStroke(socket, stroke));
        socket.on("gartic:draw:clear", () => this.relayAction(socket, "clear"));
        socket.on("gartic:draw:undo", () => this.relayAction(socket, "undo"));
        socket.on("gartic:guess:submit", ({ text }) => this.handleGuess(socket, text));
    }

    private async setSocketRoom(socketId: string, roomId: string) {
        await redis.set(`socket:${socketId}:room`, roomId, "EX", 3600); // 1h TTL
    }

    private async getSocketRoom(socketId: string) {
        return await redis.get(`socket:${socketId}:room`);
    }

    private async delSocketRoom(socketId: string) {
        await redis.del(`socket:${socketId}:room`);
    }

    private async createRoom(socket: Socket, config: any): Promise<void> {
        const roomId = generateShortId();
        const room = new GarticRoom(this.io, { ...config, id: roomId });
        this.rooms.set(roomId, room);

        socket.join(roomId);
        await this.setSocketRoom(socket.id, roomId);
        room.addPlayer(socket);

        socket.emit("gartic:room:created", { roomId });
    }

    private async joinRoom(socket: Socket, roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room) {
            socket.emit("error", { message: "Room not found" });
            return;
        }

        socket.join(roomId);
        await this.setSocketRoom(socket.id, roomId);
        room.addPlayer(socket);
        room.handleLateJoin(socket);
    }

    private async relayStroke(socket: Socket, stroke: any) {
        const roomId = await this.getSocketRoom(socket.id);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (!room) return;
        room.handleStroke(socket, stroke);
    }

    private async relayAction(socket: Socket, action: "clear" | "undo") {
        const roomId = await this.getSocketRoom(socket.id);
        if (!roomId) return;
        socket.to(roomId).emit(`gartic:draw:${action}`);
    }

    private async handleGuess(socket: Socket, text: string) {
        const roomId = await this.getSocketRoom(socket.id);
        if (!roomId) return;
        const room = this.rooms.get(roomId);
        if (!room) return;
        room.handleGuess(socket, text);
    }

    public async handleDisconnect(socket: Socket, reason: string) {
        const roomId = await this.getSocketRoom(socket.id);
        if (!roomId) return;

        const room = this.rooms.get(roomId);
        if (!room) return;

        room.handlePlayerDisconnect(socket.id, reason);
        await this.delSocketRoom(socket.id);

        if (room.isEmpty()) {
            room.destroy();
            this.rooms.delete(roomId);
        }
    }
}
