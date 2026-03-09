import { Server, Socket } from "socket.io";
import { redis } from "@/lib/redis";
import { createActor, Snapshot, Actor } from "xstate";
import { garticMachine, GameContext, Player } from "./StateMachine";
import { StrokeData, Album, GamePhase, GameMode } from "../../../types/socket-events";

export interface RoomConfig {
    id: string;
    maxPlayers: number;
    maxRounds: number;
    drawTime: number;
    mode: GameMode;
}

export class GarticRoom {
    private state!: GameContext;
    private machine: Actor<typeof garticMachine>;
    private io: Server;
    public strokeHistory: StrokeData[] = [];
    private timers: Map<string, NodeJS.Timeout> = new Map();

    constructor(io: Server, config: RoomConfig) {
        this.io = io;
        this.machine = createActor(garticMachine, {
            input: { roomId: config.id, ...config },
        });
        this.machine.start();
        this.machine.subscribe(this.onStateChange.bind(this));
    }

    private onStateChange(snapshot: any) {
        const snap = snapshot;
        const phase = snap.value as GamePhase;
        this.state = snap.context;

        this.io.to(this.state.roomId).emit("gartic:state:update", {
            phase,
            players: Array.from(this.state.players.values()),
            currentRound: snap.context.currentRound,
            maxRounds: snap.context.maxRounds,
            drawerName: "Drawer", // to fix
            timer: snap.context.timer,
            scores: Object.fromEntries(snap.context.scores),
        });

        switch (phase) {
            case "BRIEFING":
                this.handleBriefing(snap.context);
                break;
            case "DRAWING":
                this.strokeHistory = [];
                this.startCountdown(snap.context.timer, "DRAWING");
                break;
            case "GUESSING":
                this.startCountdown(45, "GUESSING");
                break;
            case "REVEAL":
                this.sendAlbums(snap.context);
                break;
        }
    }

    public addPlayer(socket: Socket) {
        const user = socket.data?.user;
        if (!user) return;
        this.state.players.set(socket.id, {
            id: socket.id,
            username: user.name || "Unknown",
            dofusClass: "1",
            isReady: false,
            score: 0
        });
    }

    public handlePlayerDisconnect(socketId: string, reason: string) {
        this.state.players.delete(socketId);
    }

    public isEmpty() {
        return this.state.players.size === 0;
    }

    public destroy() {
        this.timers.forEach((t) => clearInterval(t));
        this.machine.stop();
    }

    private handleBriefing(ctx: GameContext) {
        // Notify drawer and guessers
    }

    private async sendAlbums(ctx: any) {
        // Collect all entries from player tracks
        const albumData = ctx.album;

        // --- PERFORMANCE OPTIM: Use Redis for ephemeral storage ---
        // Instead of Prisma (Disk), we use Redis (RAM) with 1h TTL
        const cacheKey = `gartic:album:${ctx.roomId}`;
        await redis.set(cacheKey, JSON.stringify(albumData), "EX", 3600);

        this.io.to(ctx.roomId).emit("gartic:album:ready", {
            roomId: ctx.roomId,
            expiresIn: 3600
        });
    }

    public handleStroke(socket: Socket, stroke: StrokeData) {
        if (this.machine.getSnapshot().value !== "DRAWING") return;
        this.strokeHistory.push(stroke);
        socket.to(this.state.roomId).emit("gartic:draw:stroke", stroke);
    }

    public handleGuess(socket: Socket, text: string) {
        if (this.machine.getSnapshot().value !== "GUESSING") return;
        this.machine.send({ type: "SUBMIT_GUESS", playerId: socket.id, guess: text } as any);
    }

    public handleLateJoin(socket: Socket) {
        if (this.strokeHistory.length > 0) {
            socket.emit("gartic:draw:history", this.strokeHistory);
        }
    }

    private startCountdown(duration: number, phase: string) {
        const key = `timer_${phase}`;
        if (this.timers.has(key)) clearInterval(this.timers.get(key)!);

        let remaining = duration;
        const interval = setInterval(() => {
            remaining--;
            this.io.to(this.state.roomId).emit("gartic:timer:tick", { remaining });

            if (remaining <= 0) {
                clearInterval(interval);
                this.machine.send({ type: "TIMER_END" } as any);
            }
        }, 1000);

        this.timers.set(key, interval);
    }
}
