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
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private guildId: string;

    constructor(io: Server, config: RoomConfig & { guildId: string }) {
        this.io = io;
        this.guildId = config.guildId;
        this.machine = createActor(garticMachine, {
            input: { roomId: config.id, ...config },
        });
        this.machine.start();
        this.machine.subscribe(this.onStateChange.bind(this));
    }

    public getGuildId() {
        return this.guildId;
    }

    private onStateChange(snapshot: any) {
        const snap = snapshot;
        const phase = snap.value as GamePhase;
        this.state = snap.context;

        // Emit general state to everyone
        const basicState = {
            id: this.state.roomId,
            phase,
            currentRound: this.state.currentRound,
            maxRounds: this.state.maxRounds,
            timer: this.state.timer,
            maxTimer: this.state.maxTimer,
            hostId: this.state.hostId,
            players: Array.from(this.state.players.values()).map(p => ({
                id: p.id,
                username: p.username,
                dofusClass: p.dofusClass,
                score: p.score,
                isHost: p.id === this.state.hostId || p.userId === this.state.hostId,
                hasSubmitted: this.state.submittedThisRound.has(p.id)
            })),
        };
        
        if (phase === "REVEAL") {
            (basicState as any).albums = Array.from(this.state.chains.entries()).map(([ownerId, entries]) => ({
                owner: { username: this.state.players.get(ownerId)?.username || "Inconnu" },
                entries: entries.map(e => ({
                    ...e,
                    author: { username: this.state.players.get(e.playerId)?.username || "Inconnu" }
                }))
            }));
            (basicState as any).revealIndex = this.state.revealIndex;
        }

        // For each player, send custom task data
        this.state.players.forEach(player => {
            const chainId = this.state.assignments.get(player.id);
            let task = null;

            if (chainId && (phase === "DRAWING" || phase === "GUESSING")) {
                const chain = this.state.chains.get(chainId) || [];
                // IMPORTANT: The task is always the entry from the PREVIOUS round
                const taskEntry = chain[this.state.currentRound - 1]; 
                if (taskEntry) {
                    task = {
                        type: taskEntry.type,
                        content: taskEntry.content
                    };
                }
            }

            this.io.to(player.id).emit("gartic:state:update", {
                ...basicState,
                task
            });
        });

        // Trigger phase-specific countdown
        if (["STARTING", "WRITING", "DRAWING", "GUESSING", "INTERMISSION"].includes(phase)) {
            this.startCountdown(this.state.maxTimer, phase);
        }
    }

    public addPlayer(socket: Socket, userName: string = "Anonyme", userId?: string, userAvatar?: string, isSpectator: boolean = false) {
        this.machine.send({
            type: "PLAYER_JOIN",
            player: {
                id: socket.id,
                userId,
                username: userName,
                userAvatar,
                dofusClass: (Math.floor(Math.random() * 18) + 1).toString(),
                isReady: false,
                score: 0,
                isSpectator
            }
        });
    }

    public startGame() {
        if (this.state.players.size < 1) { // 1 pour tester
            this.io.to(this.state.roomId).emit("gartic:error", { message: "Il faut au moins 1 joueur !" });
            return;
        }
        this.machine.send({ type: "START_GAME" });
    }

    public isHost(socketId: string): boolean {
        const player = this.state.players.get(socketId);
        if (!player) return false;
        return this.state.hostId === player.id || this.state.hostId === player.userId;
    }

    public isSpectator(socketId: string): boolean {
        return this.state?.players.get(socketId)?.isSpectator || false;
    }

    public handleTextSubmit(socket: Socket, text: string) {
        this.machine.send({ type: "SUBMIT_TEXT", playerId: socket.id, text });
    }

    public handleDrawSubmit(socket: Socket, dataUrl: string) {
        // SECURITY: Limit drawing size to 1MB to prevent DOS (RAM exhaustion)
        if (dataUrl && dataUrl.length > 1024 * 1024) {
            console.warn(`[GarticRoom:${this.state.roomId}] ⚠️ Drawing rejected: Payload too large (${Math.round(dataUrl.length / 1024)}KB)`);
            socket.emit("gartic:error", { message: "Le dessin est trop lourd ! (Max 1Mo)" });
            return;
        }
        this.machine.send({ type: "SUBMIT_DRAW", playerId: socket.id, dataUrl });
    }

    public getHostId() {
        return this.state.hostId;
    }

    public isEmpty() {
        return (this.state?.players?.size ?? 0) === 0;
    }

    public isInLobby(): boolean {
        return this.machine.getSnapshot().value === "LOBBY";
    }

    public getPublicInfo(roomId: string) {
        const host = Array.from(this.state.players.values()).find(p => p.id === this.state.hostId || p.userId === this.state.hostId);
        return {
            roomId,
            playerCount: this.state?.players?.size ?? 0,
            maxPlayers: this.state?.maxPlayers ?? 14,
            mode: this.state?.mode ?? "NORMAL",
            hostName: host?.username || "Hôte"
        };
    }

    public handleRevealNext() {
        this.machine.send({ type: "NEXT_REVEAL" });
    }

    public handlePlayerDisconnect(socketId: string) {
        this.machine.send({ type: "PLAYER_LEAVE", playerId: socketId });
    }

    public destroy() {
        this.timers.forEach((t) => clearInterval(t));
        this.machine.stop();
    }

    private sendAlbums(ctx: GameContext) {
        const albums = Array.from(ctx.chains.entries()).map(([ownerId, entries]) => ({
            owner: ctx.players.get(ownerId)?.username || "Inconnu",
            entries: entries.map(e => ({
                ...e,
                author: ctx.players.get(e.playerId)?.username || "Inconnu"
            }))
        }));

        this.io.to(ctx.roomId).emit("gartic:reveal:ready", { albums });
    }

    private startCountdown(duration: number, phase: string) {
        const key = `timer_${phase}`;
        
        // Clean up ALL active timers for this room to prevent memory leaks
        this.timers.forEach((t) => clearInterval(t));
        this.timers.clear();

        let remaining = duration;
        this.machine.send({ type: "TICK", remaining });
        const interval = setInterval(() => {
            remaining--;
            this.machine.send({ type: "TICK", remaining });

            if (remaining <= 0) {
                clearInterval(interval);
                this.timers.delete(key);
                this.machine.send({ type: `TIMER_END_${phase}` as any });
            }
        }, 1000);

        this.timers.set(key, interval);
    }
}
