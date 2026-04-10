
import { Server, Socket } from "socket.io";
import { logger } from "@/lib/logger";

type GameState = "LOBBY" | "PLAYING" | "EXPLOSION" | "GAME_END";

interface Player {
    id: string; // Socket ID
    userId?: string;
    userName: string;
    userAvatar?: string;
    lives: number;
    isConnected: boolean;
    isSpectator: boolean;
    wordsFound: number;
}

export class SigilBombRoom {
    private id: string;
    private guildId: string;
    private state: GameState = "LOBBY";
    private players: Player[] = [];
    private hostId: string | null = null;
    
    // Game variables
    private currentTurnIndex: number = 0;
    private currentSyllable: string = "";
    private bombTimer: NodeJS.Timeout | null = null;
    private timeLeft: number = 0; // Total fuse time (random 5-20s)
    private tickInterval: NodeJS.Timeout | null = null;
    
    private usedWordsInTurn: Set<string> = new Set();
    private allWordsFound: string[] = [];

    constructor(private io: Server, config: any) {
        this.id = config.id;
        this.guildId = config.guildId;
    }

    public join(socket: Socket, playerObj: any) {
        const existing = this.players.find(p => p.userId === playerObj.userId);
        if (existing) {
            existing.id = socket.id;
            existing.isConnected = true;
        } else {
            const isSpectator = this.state !== "LOBBY" || playerObj.isSpectator;
            this.players.push({
                id: socket.id,
                userId: playerObj.userId,
                userName: playerObj.userName,
                userAvatar: playerObj.userAvatar,
                lives: 3,
                isConnected: true,
                isSpectator,
                wordsFound: 0
            });
            if (this.players.length === 1) this.hostId = socket.id;
        }

        socket.join(this.id);
        this.syncState();
    }

    public leave(socketId: string) {
        const player = this.players.find(p => p.id === socketId);
        if (player) {
            player.isConnected = false;
            if (this.state === "LOBBY") {
                this.players = this.players.filter(p => p.id !== socketId);
            }
        }
        if (this.hostId === socketId) {
            const nextHost = this.players.find(p => p.isConnected && !p.isSpectator);
            this.hostId = nextHost ? nextHost.id : null;
        }
        this.syncState();
    }

    public startGame(socketId: string) {
        if (this.hostId !== socketId) return;
        if (this.players.filter(p => !p.isSpectator).length < 1) return;

        this.state = "PLAYING";
        this.currentTurnIndex = 0;
        this.players.forEach(p => {
            p.lives = 3;
            p.wordsFound = 0;
        });
        this.startNewTurn();
    }

    private startNewTurn() {
        if (this.state !== "PLAYING") return;

        // Choose a syllable
        this.currentSyllable = this.generateSyllable();
        this.usedWordsInTurn.clear();
        
        // Random fuse time between 5 and 20 seconds
        this.timeLeft = Math.floor(Math.random() * (20 - 5 + 1)) + 5;
        
        this.io.to(this.id).emit("bomb:new-turn", {
            syllable: this.currentSyllable,
            turnIndex: this.currentTurnIndex,
            timeLeft: this.timeLeft
        });

        this.startTimer();
    }

    private generateSyllable(): string {
        const commonSyllables = [
            "RA", "TO", "PO", "LI", "ME", "NA", "DE", "SA", "MI", "RO", 
            "KA", "BO", "FE", "CA", "DO", "FU", "TE", "LE", "GA", "DI",
            "OR", "AN", "IN", "OU", "CH", "QU", "AL", "EL", "IL", "OL",
            "TI", "CO", "MA", "LO", "RE", "PI", "SI", "TA", "VO", "ZA"
        ];
        
        // Dofus Class specific syllables/prefixes
        const dofusSyllables = [
            "IO", "ENU", "XEL", "CRA", "SAD", "OSA", "ECA", "ENI", "SAC", "PAN", 
            "SRA", "FEK", "OUGI", "ZOB", "STEAM", "HUP", "FORG", "ELIO"
        ];
        
        const combined = Math.random() > 0.3 ? commonSyllables : dofusSyllables;
        return combined[Math.floor(Math.random() * combined.length)];
    }

    private startTimer() {
        this.stopTimer();
        
        this.tickInterval = setInterval(() => {
            this.timeLeft--;
            this.io.to(this.id).emit("bomb:tick", { timeLeft: this.timeLeft });

            if (this.timeLeft <= 0) {
                this.handleExplosion();
            }
        }, 1000);
    }

    private stopTimer() {
        if (this.tickInterval) clearInterval(this.tickInterval);
        this.tickInterval = null;
    }

    private handleExplosion() {
        this.stopTimer();
        const currentPlayer = this.players.filter(p => !p.isSpectator && p.lives > 0)[this.currentTurnIndex];
        
        if (currentPlayer) {
            currentPlayer.lives--;
            this.io.to(this.id).emit("bomb:explosion", { 
                playerId: currentPlayer.id, 
                lives: currentPlayer.lives 
            });
        }

        // Check if game ends or next round
        const survivors = this.players.filter(p => !p.isSpectator && p.lives > 0);
        if (survivors.length <= 1 && this.players.filter(p => !p.isSpectator).length > 1) {
            this.endGame();
        } else if (this.players.filter(p => !p.isSpectator).length === 1 && survivors.length === 0) {
             // Solo mode end
             this.endGame();
        } else {
            // Next turn for survivor
            this.nextTurn();
        }
    }

    private nextTurn() {
        const activePlayers = this.players.filter(p => !p.isSpectator && p.lives > 0);
        if (activePlayers.length === 0) {
            this.endGame();
            return;
        }

        this.currentTurnIndex = (this.currentTurnIndex + 1) % activePlayers.length;
        this.startNewTurn();
    }

    public submitWord(socketId: string, word: string) {
        const activePlayers = this.players.filter(p => !p.isSpectator && p.lives > 0);
        const currentPlayer = activePlayers[this.currentTurnIndex];
        
        if (!currentPlayer || currentPlayer.id !== socketId) return;

        const normalizedWord = word.trim().toUpperCase();
        
        // Validation: contains syllable, not already used in this turn, is valid Dofus/French word (simplified for now)
        if (normalizedWord.includes(this.currentSyllable) && !this.usedWordsInTurn.has(normalizedWord)) {
            this.usedWordsInTurn.add(normalizedWord);
            currentPlayer.wordsFound++;
            this.allWordsFound.push(normalizedWord);
            
            this.io.to(this.id).emit("bomb:word-success", { 
                word: normalizedWord, 
                playerId: currentPlayer.id 
            });
            
            this.stopTimer();
            this.nextTurn();
        } else {
            this.io.to(this.id).emit("bomb:word-error", { 
                message: this.usedWordsInTurn.has(normalizedWord) ? "Mot déjà utilisé !" : "Le mot ne contient pas la syllabe !"
            });
        }
    }

    private endGame() {
        this.state = "GAME_END";
        this.stopTimer();
        this.syncState();
    }

    private syncState() {
        this.io.to(this.id).emit("bomb:sync", {
            id: this.id,
            state: this.state,
            players: this.players,
            hostId: this.hostId,
            currentSyllable: this.currentSyllable,
            currentTurnIndex: this.currentTurnIndex,
            timeLeft: this.timeLeft
        });
    }

    public getPublicInfo() {
        return {
            roomId: this.id,
            playerCount: this.players.length,
            state: this.state
        };
    }
}
