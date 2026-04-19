
import { Server, Socket } from "socket.io";
import { logger } from "@/lib/logger";

export class InvaderManager {
    constructor(private io: Server) {}

    public registerSocket(socket: Socket) {
        socket.on("invader:room:join", (roomId: string) => {
            socket.join(`invader:room:${roomId}`);
            logger.info(`[Invader] Socket ${socket.id} joined room ${roomId}`);
        });

        socket.on("invader:pos:sync", (data: any) => {
            const { roomId, userId, ...posData } = data;
            if (roomId) {
                // Broadcast to everyone else in the room
                socket.to(`invader:room:${roomId}`).emit("invader:pos:update", {
                    userId: userId || socket.id, 
                    ...posData
                });
            }
        });

        socket.on("invader:bot:sync", (data: any) => {
            const { roomId, ...botData } = data;
            if (roomId) {
                socket.to(`invader:room:${roomId}`).emit("invader:bot:update", botData);
            }
        });

        socket.on("invader:obstacles:sync", (data: any) => {
            const { roomId, obstacles } = data;
            if (roomId) {
                socket.to(`invader:room:${roomId}`).emit("invader:obstacles:update", { obstacles });
            }
        });
    }

    public handleDisconnect(socket: Socket) {
        // No complex state to cleanup here since it's mostly ephemeral broadcast
    }
}
