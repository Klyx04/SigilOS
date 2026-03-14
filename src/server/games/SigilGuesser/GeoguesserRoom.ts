import { Server, Socket } from "socket.io";
import { db } from "@/lib/prisma";
import { WorldMapService } from "./WorldMapService";

type GameState = "LOBBY" | "COUNTDOWN" | "IN_PROGRESS" | "RESULT" | "FINISHED";
type GameMode = "NORMAL" | "SPECIAL";

interface Player {
    id: string; // Socket ID
    userId: string;
    userName: string;
    userAvatar?: string;
    score: number;
    hasGuessed: boolean;
    isConnected: boolean;
    isSpectator: boolean;
    lastGuess?: {
        x: number;
        y: number;
        worldId?: number;
        mapId?: number;
        distance: number;
        score: number;
    } | null;
}

export class GeoguesserRoom {
    public id: string;
    public guildId: string;
    private maxRounds: number = 5;
    private timePerRound: number = 30; // secondes
    private difficulty = "easy" as const;

    private state: GameState = "LOBBY";
    private players: Player[] = [];
    private hostId: string | null = null;
    private gameMode: GameMode = "NORMAL";

    private currentRound: number = 0;
    private targetMapIds: number[] = [];

    private roundTimer: NodeJS.Timeout | null = null;
    private timeLeft: number = 0;

    constructor(private io: Server, config: any) {
        this.id = config.id;
        this.guildId = config.guildId;
        if (config.maxRounds) this.setMaxRounds(config.maxRounds);
        if (config.timePerRound) this.setTimePerRound(config.timePerRound);
        if (config.gameMode) this.setGameMode(config.gameMode);
        // Difficulty setting removed as per user request

    }

    private emitToAll(event: string, data?: any) {
        if (data) this.io.to(this.id).emit(event, data);
        else this.io.to(this.id).emit(event);
    }

    private emitTo(socketId: string, event: string, data?: any) {
        this.io.to(socketId).emit(event, data);
    }

    public isHost(socketId: string) {
        const player = this.players.find(p => p.id === socketId);
        return player ? this.hostId === player.userId : false;
    }


    public setMaxRounds(rounds: number) {
        this.maxRounds = rounds;
        this.syncState();
    }


    public setTimePerRound(time: number) {
        this.timePerRound = time;
        this.syncState();
    }

    public setGameMode(mode: GameMode) {
        this.gameMode = mode;
        this.syncState();
    }

    public isEmpty() {
        const connectedCount = this.players.filter(p => p.isConnected).length;
        return connectedCount === 0;
    }

    public addPlayer(socket: Socket, playerObj: { userName: string, userId: string, userAvatar?: string, isSpectator?: boolean }) {
        if (!playerObj.userId) {
            console.error(`[GeoRoom:${this.id}] ❌ Tentative d'ajout de joueur sans userId ! Socket: ${socket.id}`);
            return;
        }

        const existing = this.players.find(p => p.userId === playerObj.userId);

        if (existing) {
            console.log(`[GeoRoom:${this.id}] 🔄 Reconnexion de ${playerObj.userName} (${playerObj.userId})`);
            existing.isConnected = true;
            existing.id = socket.id;
        } else {

            const newPlayer: Player = {
                id: socket.id,
                userId: playerObj.userId,
                userName: playerObj.userName,
                userAvatar: playerObj.userAvatar,
                score: 0,
                hasGuessed: false,
                isConnected: true,
                isSpectator: !!(playerObj as any).isSpectator,
                lastGuess: null
            };
            this.players.push(newPlayer);
            if (!this.hostId && !newPlayer.isSpectator) this.hostId = playerObj.userId;
            
            // Notification join
            this.emitToAll("geoguesser:player:joined", { 
                userName: playerObj.userName, 
                userId: playerObj.userId,
                isSpectator: !!playerObj.isSpectator
            });
        }

        this.syncState();
    }

    public handleLateJoin(socket: Socket) {
        this.syncState();
    }

    public removePlayer(socketId: string) {
        const index = this.players.findIndex(p => p.id === socketId);
        if (index !== -1) {
            const player = this.players[index];
            console.log(`[GeoRoom:${this.id}] ➖ Déconnexion de ${player.userName}`);
            
            this.emitToAll("geoguesser:player:left", {
                userName: player.userName,
                userId: player.userId
            });

            if (this.state === "LOBBY") {
                this.players.splice(index, 1);
            } else {
                player.isConnected = false;
            }

            if (this.hostId === player.userId) {
                const nextHost = this.players.find(p => p.isConnected && !p.isSpectator);
                this.hostId = nextHost ? nextHost.userId : null;
                console.log(`[GeoRoom:${this.id}] 👑 Nouvel hôte: ${this.hostId}`);
            }

            if (this.state === "IN_PROGRESS") {
                // Check if the remaining players have all guessed, allowing the round to end early.
                this.checkRoundEndConditions();
            }

            this.syncState();
        }
    }

    public syncState() {
        const basePayload = {
            id: this.id,
            guildId: this.guildId,
            state: this.state,
            hostId: this.hostId,
            currentRound: this.currentRound,
            maxRounds: this.maxRounds,
            difficulty: this.difficulty,
            timeLeft: this.timeLeft,
            timePerRound: this.timePerRound,
            // SECURITY: Never send the full target list to clients to prevent F12 cheating. 
            // Only send the map ID for the current round if we are IN_PROGRESS.
            currentMapId: (this.state === "IN_PROGRESS" || this.state === "RESULT") ? this.targetMapIds[this.currentRound - 1] : undefined,
            gameMode: this.gameMode
        };

        const participantsBase = this.players.map(p => ({
            id: p.id,
            userId: String(p.userId),
            userName: p.userName,
            userAvatar: p.userAvatar,
            score: p.score,
            hasGuessed: p.hasGuessed,
            isConnected: p.isConnected,
            isSpectator: p.isSpectator,
            // Hidden for everyone else in IN_PROGRESS
            lastGuess: (this.state === "RESULT" || this.state === "FINISHED") ? p.lastGuess : (p.hasGuessed ? { hidden: true } : null)
        }));

        this.players.forEach(p => {
            if (!p.isConnected) return;
            
            // Build tailored list for this specific player
            const tailoredParticipants = participantsBase.map(other => {
                // If it's the current player, show them their own guess data
                if (String(other.userId) === String(p.userId)) {
                    return { ...other, lastGuess: p.lastGuess };
                }
                return other;
            });

            this.io.to(p.id).emit("geoguesser:state:sync", {
                ...basePayload,
                participants: tailoredParticipants
            });
        });
    }

    public async startGame(targetMapIds?: number[]) {
        console.log(`[GeoRoom:${this.id}] 🎬 Démarrage/Relance du jeu.`);
        
        // SECURITY: Server selects the maps to prevent client-side target manipulation
        if (!targetMapIds || targetMapIds.length === 0) {
            this.targetMapIds = WorldMapService.getInstance().getRandomMaps(this.maxRounds, this.gameMode);
        } else {
            // Even if provided, we should probably ignore it and use server-side random 
            // but for now we trust it only if it matches our expected count.
            this.targetMapIds = targetMapIds;
        }
        
        this.currentRound = 0;
        this.players.forEach(p => {
            p.score = 0;
            p.lastGuess = null;
            p.hasGuessed = false;
        });

        // Update DB status (use updateMany to avoid P2025 if session was already deleted)
        try {
            await db.geoguesserSession.updateMany({
                where: { id: this.id },
                data: { status: 'IN_PROGRESS', targetMapIds: this.targetMapIds }
            });
        } catch (e) {
            console.error(`[GeoRoom:${this.id}] ❌ Erreur DB status START:`, e);
        }

        // START COUNTDOWN instead of round 1
        this.state = "COUNTDOWN";
        this.timeLeft = 3;
        this.syncState();

        this.startTimer(() => {
            console.log(`[GeoRoom:${this.id}] 🚀 Countdown fini, lancement du Round 1`);
            this.startNextRound();
        });
    }

    public startNextRound() {
        this.currentRound++;
        console.log(`[GeoRoom:${this.id}] 🚩 Round ${this.currentRound} démarré.`);
        if (this.currentRound > this.maxRounds || this.currentRound > this.targetMapIds.length) {
            this.endGame();
            return;
        }

        this.state = "IN_PROGRESS";
        this.players.forEach(p => {
            p.hasGuessed = false;
            p.lastGuess = null;
        });

        this.timeLeft = this.gameMode === 'SPECIAL' ? 10 : this.timePerRound;
        this.syncState();

        this.startTimer(() => {
            console.error(`[GeoRoom:${this.id}] 🕒 Timeout reached for round ${this.currentRound}`);
            this.handleRoundFinish();
        });
        
        // Safety: Initial sync to make sure clients get the new timeLeft immediately
        this.syncState();
    }

    public triggerNextRound(socket: Socket) {
        if (this.isHost(socket.id) && !this.isSpectator(socket.id) && this.state === "RESULT") {
            this.startNextRound();
        }
    }

    public handleGuess(socket: Socket, data: { x: number, y: number, score: number, distance: number, mapId?: number, worldId?: number }) {
        const player = this.players.find(p => p.id === socket.id);
        if (!player || player.isSpectator) {
            console.error(`[GeoRoom:${this.id}] ❌ Tentative de guess par un joueur inconnu ou spectateur socket: ${socket.id}`);
            return;
        }

        if (player.hasGuessed) {
            console.warn(`[GeoRoom:${this.id}] ⚠️ Guess ignoré : ${player.userName} a déjà joué ce round.`);
            return;
        }

        if (this.state !== "IN_PROGRESS") {
            console.warn(`[GeoRoom:${this.id}] ⚠️ Guess ignoré : le round n'est pas en cours (State: ${this.state})`);
            return;
        }

        // --- SECURITY: RECALCULATE SCORE SERVER-SIDE ---
        const currentTargetId = this.targetMapIds[this.currentRound - 1];
        const { distance: calculatedDist, score: calculatedScore } = WorldMapService.getInstance().calculateScore(
            currentTargetId,
            Number(data.x),
            Number(data.y),
            data.worldId ? Number(data.worldId) : 1
        );

        player.hasGuessed = true;
        player.score += calculatedScore;
        player.lastGuess = {
            x: Number(data.x),
            y: Number(data.y),
            worldId: data.worldId ? Number(data.worldId) : undefined,
            mapId: data.mapId ? Number(data.mapId) : undefined,
            score: calculatedScore,
            distance: calculatedDist
        };

        console.log(`[GeoRoom:${this.id}] 🎯 Guess de ${player.userName}: ${data.score} pts (reste ${this.timeLeft}s)`);

        this.syncState();
        this.checkRoundEndConditions();
    }

    private checkRoundEndConditions() {
        const activeGuessers = this.players.filter(p => p.isConnected && !p.isSpectator);
        const allGuessed = activeGuessers.every(p => p.hasGuessed);

        if (allGuessed && activeGuessers.length > 0) {
            console.log(`[GeoRoom:${this.id}] ✅ Tous les joueurs ont joué.`);
            this.stopTimer();
            this.handleRoundFinish();
        }
    }

    private handleRoundFinish() {
        this.state = "RESULT";
        this.timeLeft = 10;
        this.syncState();

        this.startTimer(() => {
            if (this.currentRound >= this.maxRounds) {
                this.endGame();
            } else {
                this.startNextRound();
            }
        });
    }

    private async endGame() {
        console.log(`[GeoRoom:${this.id}] 🏆 Fin du jeu.`);
        this.state = "FINISHED";
        this.stopTimer();
        this.timeLeft = 0;
        this.syncState();

        // Update DB status to FINISHED (use updateMany to avoid P2025 if session was already deleted)
        try {
            const updated = await db.geoguesserSession.updateMany({
                where: { id: this.id },
                data: { status: 'FINISHED' }
            });

            if (updated.count > 0) {
                // Update individual total scores in DB for final result
                for (const p of this.players) {
                    await db.geoguesserSessionPlayer.updateMany({
                        where: { sessionId: this.id, userId: p.userId },
                        data: { totalScore: p.score }
                    });
                }
                
                // --- UPDATE HALL OF FAME ---
                // Only count players that are not spectators.
                const validPlayers = this.players.filter(p => !p.isSpectator && p.userId);
                console.log(`[GeoRoom:${this.id}] 🏆 Fin de partie. Joueurs valides pour le Hall of Fame: ${validPlayers.length} (Total: ${this.players.length})`);
                
                // Exclude solo games (must have > 1 valid players)
                if (validPlayers.length > 1) {
                    for (const p of validPlayers) {
                        try {
                            console.log(`[GeoRoom:${this.id}] 💾 Persistance du score pour ${p.userName} (${p.userId}): ${p.score} pts`);
                            // 1. Sauvegarder le score de cette partie (Historique)
                            await db.geoguesserScore.create({
                                data: {
                                    guildId: this.guildId,
                                    userId: p.userId,
                                    userName: p.userName || "Inconnu",
                                    userAvatar: p.userAvatar,
                                    score: p.score,
                                    distance: p.lastGuess?.distance || 0 
                                }
                            });

                            // 2. Mettre à jour le classement global (Hall of Fame)
                            const rank = await db.geoguesserRank.upsert({
                                where: {
                                    guildId_userId: { guildId: this.guildId, userId: p.userId }
                                },
                                create: {
                                    guildId: this.guildId,
                                    userId: p.userId,
                                    userName: p.userName || "Inconnu",
                                    userAvatar: p.userAvatar,
                                    bestScore: p.score,
                                    totalPoints: p.score,
                                    gamesPlayed: 1,
                                    avgDistance: p.lastGuess?.distance || 0 
                                },
                                update: {
                                    totalPoints: { increment: p.score },
                                    gamesPlayed: { increment: 1 },
                                    userName: p.userName || "Inconnu",
                                    userAvatar: p.userAvatar,
                                }
                            });
                            
                            // Empêcher la régression du bestScore
                            if (p.score > rank.bestScore) {
                                await db.geoguesserRank.update({
                                    where: { id: rank.id },
                                    data: { bestScore: p.score }
                                });
                            }
                        } catch (err) {
                            console.error(`[GeoRoom:${this.id}] ❌ Erreur mise à jour Hall of Fame pour ${p.userName}:`, err);
                        }
                    }
                } else {
                    console.log(`[GeoRoom:${this.id}] ℹ️ Partie ignorée par le Hall of Fame (Mode Solo ou moins de 2 joueurs).`);
                }
            } else {
                console.warn(`[GeoRoom:${this.id}] ⚠️ Session DB introuvable lors de endGame (déjà supprimée?). Scores non persistés.`);
            }
        } catch (e) {
            console.error(`[GeoRoom:${this.id}] ❌ Erreur DB status END:`, e);
        }

        setTimeout(() => {
            if (this.state === "FINISHED") {
                this.state = "LOBBY";
                this.syncState();
            }
        }, 30000);
    }

    private startTimer(onTimeout: () => void) {
        this.stopTimer();
        this.roundTimer = setInterval(() => {
            this.timeLeft--;
            
            // CRITICAL: Must sync state every tick so clients see the countdown
            this.syncState();
            
            if (this.timeLeft <= 0) {
                console.error(`[GeoRoom:${this.id}] 🕒 Timer auto-timeout.`);
                this.stopTimer();
                onTimeout();
            }
        }, 1000);
    }

    private stopTimer() {
        if (this.roundTimer) {
            clearInterval(this.roundTimer);
            this.roundTimer = null;
        }
    }

    public handlePlayerDisconnect(socketId: string, reason: string) {
        this.removePlayer(socketId);
    }

    public async destroy() {
        this.stopTimer();
        console.log(`[GeoRoom:${this.id}] 🔥 Salle détruite.`);
        try {
            // SECURITY: Delete session data instead of leaving finished records
            await db.geoguesserSession.deleteMany({
                where: { id: this.id }
            });
        } catch (e) {
            // Silently fail if already deleted
        }
    }

    public isSpectator(socketId: string) {
        return this.players.find(p => p.id === socketId)?.isSpectator || false;
    }

    public getState(): GameState {
        return this.state;
    }

    public getPublicInfo(roomId: string) {
        return {
            id: roomId,
            roomId,
            playerCount: this.players.filter(p => p.isConnected && !p.isSpectator).length,
            maxPlayers: 8,
            hostName: this.players.find(p => p.userId === this.hostId)?.userName || "Hôte",
            maxRounds: this.maxRounds,
            difficulty: this.difficulty,
            state: this.state,
            gameMode: this.gameMode
        };
    }
}
