
import { Server, Socket } from "socket.io";
import { SigilBombRoom } from "./SigilBombRoom";

export class BombManager {
    private rooms: Map<string, SigilBombRoom> = new Map();

    constructor(private io: Server) {}

    public registerSocket(socket: Socket) {
        socket.on("bomb:room:join", (data) => this.joinRoom(socket, data));
        socket.on("bomb:room:leave", () => this.leaveRoom(socket));
        socket.on("bomb:game:start", () => this.startGame(socket));
        socket.on("bomb:word:submit", (data) => this.submitWord(socket, data));
        socket.on("bomb:room:list", () => this.listRooms(socket));
    }

    public handleDisconnect(socket: Socket) {
        this.leaveRoom(socket);
    }

    private joinRoom(socket: Socket, data: any) {
        const { roomId, playerObj } = data;
        let room = this.rooms.get(roomId);
        
        if (!room) {
            room = new SigilBombRoom(this.io, {
                id: roomId,
                guildId: playerObj.guildId
            });
            this.rooms.set(roomId, room);
        }
        
        room.join(socket, playerObj);
    }

    private leaveRoom(socket: Socket) {
        this.rooms.forEach(room => room.leave(socket.id));
    }

    private startGame(socket: Socket) {
        this.rooms.forEach(room => room.startGame(socket.id));
    }

    private submitWord(socket: Socket, data: any) {
        const { word } = data;
        this.rooms.forEach(room => room.submitWord(socket.id, word));
    }

    private listRooms(socket: Socket) {
        const list = Array.from(this.rooms.values()).map(r => r.getPublicInfo());
        socket.emit("bomb:room:list", list);
    }
}
