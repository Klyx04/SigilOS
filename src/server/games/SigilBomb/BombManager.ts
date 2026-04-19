
import { Server, Socket } from "socket.io";
import { SigilBombRoom } from "./SigilBombRoom";
import { logger } from "@/lib/logger";

export class BombManager {
    private rooms: Map<string, SigilBombRoom> = new Map();
    private socketToRoom: Map<string, string> = new Map(); // socketId -> roomId
    private userToRoom: Map<string, string> = new Map();   // userId -> roomId

    constructor(private io: Server) {}

    public registerSocket(socket: Socket) {
        socket.on("bomb:room:join",     (data) => this.joinRoom(socket, data));
        socket.on("bomb:room:leave",    ()     => this.leaveRoom(socket));
        socket.on("bomb:room:list",     ()     => this.listRooms(socket));
        socket.on("bomb:start-game",    ()     => this.startGame(socket));
        socket.on("bomb:toggle-ready",  ()     => this.toggleReady(socket));
        socket.on("bomb:update-config", (cfg)  => this.updateConfig(socket, cfg));
        socket.on("bomb:submit-word",   (word) => this.submitWord(socket, word));
        socket.on("bomb:typing",        (text) => this.getRoom(socket)?.handleTyping(socket.id, text));
        socket.on("bomb:restart",       ()     => this.getRoom(socket)?.resetToLobby());
        socket.on("bomb:leave",         ()     => this.leaveRoom(socket));
    }

    public handleDisconnect(socket: Socket) {
        this.leaveRoom(socket);
    }

    private joinRoom(socket: Socket, data: any) {
        const { roomId, playerObj } = data;
        if (!playerObj?.userId) return;
        const userId = playerObj.userId;

        // 1. Leave previous room if it's NOT the same one
        const existingRoomId = this.userToRoom.get(userId);
        if (existingRoomId && existingRoomId !== roomId) {
            this.cleanupRoom(existingRoomId, "TRANSFER"); // Special flag to signify we are moving
        }

        const isNewRoom = !this.rooms.has(roomId);
        let room = this.rooms.get(roomId);
        if (!room) {
            room = new SigilBombRoom(this.io, {
                id: roomId,
                guildId: playerObj.guildId
            });
            this.rooms.set(roomId, room);
            logger.info(`[SigilBomb] Room Created: ${roomId} by ${playerObj.userName}`);
        }
        
        room.join(socket, playerObj);
        this.socketToRoom.set(socket.id, roomId);
        this.userToRoom.set(userId, roomId);

        // If the player created this room in solo mode, apply config synchronously
        // (host is guaranteed to be set after join above)
        if (isNewRoom && playerObj.isSoloMode === true) {
            logger.info(`[SigilBomb] Solo mode detected for new room ${roomId} — adding bot.`);
            room.updateConfig(socket.id, { isSoloMode: true });
        }
    }

    private leaveRoom(socket: Socket) {
        const roomId = this.socketToRoom.get(socket.id);
        if (roomId) {
            this.cleanupRoom(roomId, socket.id);
        }
    }

    private cleanupRoom(roomId: string, socketIdOrFlag: string) {
        const room = this.rooms.get(roomId);
        if (room) {
            if (socketIdOrFlag !== "TRANSFER") {
                room.leave(socketIdOrFlag);
                this.socketToRoom.delete(socketIdOrFlag);
            }
            
            // Re-calculate room visibility or cleanup
            const activePlayers = room.getPlayers().filter(p => !p.isBot && p.isConnected);
            
            // If room is empty, destroy it after a small grace period (10s)
            if (activePlayers.length === 0) {
                setTimeout(() => {
                    const r = this.rooms.get(roomId);
                    if (r) {
                        const stillEmpty = r.getPlayers().filter(p => !p.isBot && p.isConnected).length === 0;
                        if (stillEmpty) {
                            // Cleanup user mappings for all players who were in this room
                            r.getPlayers().forEach(p => {
                                if (p.userId) this.userToRoom.delete(p.userId);
                            });
                            this.rooms.delete(roomId);
                            logger.info(`[SigilBomb] Room Destroyed: ${roomId}`);
                        }
                    }
                }, 10000); 
            }
        }
    }

    private toggleReady(socket: Socket) {
        this.getRoom(socket)?.toggleReady(socket.id);
    }

    private updateConfig(socket: Socket, cfg: any) {
        this.getRoom(socket)?.updateConfig(socket.id, cfg);
    }

    private startGame(socket: Socket) {
        this.getRoom(socket)?.startGame(socket.id);
    }

    private submitWord(socket: Socket, word: string) {
        this.getRoom(socket)?.submitWord(socket.id, word);
    }

    private getRoom(socket: Socket): SigilBombRoom | undefined {
        const roomId = this.socketToRoom.get(socket.id);
        return roomId ? this.rooms.get(roomId) : undefined;
    }

    private listRooms(socket: Socket) {
        const list = Array.from(this.rooms.values())
            .filter(r => r.getState() === 'LOBBY' && r.getPlayers().some(p => !p.isBot))
            .map(r => r.getPublicInfo());
        socket.emit("bomb:room:list", list);
    }
}
