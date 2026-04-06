import { Server, Socket } from "socket.io";
import { getDofusWords, type SkribblWord } from "./words";
import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import type { SkribblManager } from "./SkribblManager";

type GameState = "LOBBY" | "SELECTING_WORD" | "DRAWING" | "ROUND_END" | "GAME_END";

interface Player {
    id: string; // Socket ID
    userId?: string;
    userName: string;
    userAvatar?: string;
    score: number;
    hasGuessed: boolean;
    isDrawing: boolean;
    isConnected: boolean;
    isSpectator: boolean;
}

// Fonction utilitaire pour enlever les accents
function removeAccents(str: string) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Outil basique de distance de Levenshtein (insensible à la casse et aux accents)
function levenshteinDistance(a: string, b: string): number {
    a = removeAccents(a.toLowerCase().trim());
    b = removeAccents(b.toLowerCase().trim());
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1) // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

export class SkribblRoom {
    private id: string;
    private guildId: string;
    private maxRounds: number = 3;
    private roundDuration: number = 60;
    private difficulty: "facile" | "moyen" | "difficile" = "moyen";
    private allowedCategories: string[] = [];

    private state: GameState = "LOBBY";
    private players: Player[] = [];
    private hostId: string | null = null;

    // État du jeu en cours
    private currentRound: number = 0;
    private drawerIndex: number = -1;
    private currentWord: string = "";
    private currentWordIcon?: string;
    private currentWordCategory?: string;
    private currentWordMask: string = "";
    private wordChoices: SkribblWord[] = [];
    private revealedHints: Set<number> = new Set();
    private revealedHintIndexes: Set<number> = new Set(); // Indice des lettres révélées
    private showIconHint: boolean = false;
    private guessedPlayersCount: number = 0;
    private guessersScoresThisRound: number[] = [];

    private roundTimer: NodeJS.Timeout | null = null;
    private timeLeft: number = 0;
    private hasRerolledThisTurn: boolean = false;

    // Canvas history pour les spectateurs qui rejoignent en retard
    private canvasActions: any[] = [];
    private usedWords: Set<string> = new Set();

    constructor(private io: Server, private manager: SkribblManager, config: any) {
        this.id = config.id;
        this.guildId = config.guildId;
        if (config.rounds) this.maxRounds = config.rounds;
        if (config.duration) this.roundDuration = config.duration;
        if (config.difficulty) this.difficulty = config.difficulty;
        if (config.categories) this.allowedCategories = config.categories;
    }

    public getGuildId() {
        return this.guildId;
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
        return player ? this.hostId === (player.userId || player.id) : false;
    }

    public getHostId() {
        return this.hostId;
    }

    public isEmpty() {
        return this.players.filter(p => p.isConnected).length === 0;
    }

    public addPlayer(socket: Socket, playerObj: { userName: string, userId?: string, userAvatar?: string, isSpectator?: boolean }) {
        const existing = this.players.find(p => p.id === socket.id || (playerObj.userId && p.userId === playerObj.userId));

        if (existing) {
            existing.isConnected = true;
            existing.id = socket.id; // Mise à jour du socket
        } else {
            const newPlayer: Player = {
                id: socket.id,
                userId: playerObj.userId,
                userName: playerObj.userName || `Joueur ${this.players.length + 1}`,
                userAvatar: playerObj.userAvatar,
                score: 0,
                hasGuessed: false,
                isDrawing: false,
                isConnected: true,
                isSpectator: !!playerObj.isSpectator
            };
            this.players.push(newPlayer);
            if (!this.hostId && !newPlayer.isSpectator) this.hostId = playerObj.userId || socket.id;
        }

        this.syncState();

        // Dire à tout le monde qu'il a rejoint (Chat system)
        this.emitToAll("skribbl:chat:message", { type: "system", text: `${playerObj.userName} a rejoint la salle.` });

        // Si la partie en est cours de dessin, envoyer l'état du canvas à ce joueur
        if (this.state === "DRAWING" && this.canvasActions.length > 0) {
            this.emitTo(socket.id, "skribbl:canvas:restore", { actions: this.canvasActions });
        }
    }

    public removePlayer(socketId: string) {
        const player = this.players.find(p => p.id === socketId);
        if (player) {
            player.isConnected = false;
            this.emitToAll("skribbl:chat:message", { type: "system", text: `${player.userName} a quitté la salle.` });

            // Si c'était l'hôte, on passe le lead
            if (this.hostId === (player.userId || player.id)) {
                const nextHost = this.players.find(p => p.isConnected && !p.isSpectator);
                this.hostId = nextHost ? (nextHost.userId || nextHost.id) : null;
            }

            // Si c'était le dessinateur, on skip le tour !
            if (this.state === "DRAWING" || this.state === "SELECTING_WORD") {
                if (player.isDrawing) {
                    this.emitToAll("skribbl:chat:message", { type: "system", text: `Le dessinateur a fui ! Fin du tour.` });
                    this.endRound();
                } else if (this.state === "DRAWING") {
                    this.checkRoundEndConditions();
                }
            }
            this.syncState();
        }
    }

    public addCanvasAction(action: any) {
        if (action.type === "clear") {
            this.canvasActions = [];
        } else {
            this.canvasActions.push(action);
        }
    }

    public undoCanvasAction() {
        if (this.canvasActions.length === 0) return;
        const lastAction = this.canvasActions[this.canvasActions.length - 1];
        const lastPathId = lastAction.pathId;
        if (lastPathId) {
            this.canvasActions = this.canvasActions.filter(a => a.pathId !== lastPathId);
        } else {
            this.canvasActions.pop();
        }
        this.emitToAll("skribbl:draw:undo");
    }

    public syncState() {
        const publicPlayers = this.players.map(p => ({
            id: p.id,
            userName: p.userName,
            userAvatar: p.userAvatar,
            score: p.score,
            hasGuessed: p.hasGuessed,
            isDrawing: p.isDrawing,
            isConnected: p.isConnected
        }));

        const publicState = {
            id: this.id,
            state: this.state,
            hostId: this.hostId,
            currentRound: this.currentRound,
            maxRounds: this.maxRounds,
            timeLeft: this.timeLeft,
            currentWord: (this.state === "DRAWING" || this.state === "ROUND_END" || this.state === "GAME_END") ? this.currentWord : "",
            currentWordMask: this.currentWordMask,
            wordChoices: this.wordChoices,
            hasRerolled: this.hasRerolledThisTurn,
            difficulty: this.difficulty,
            allowedCategories: this.allowedCategories,
            showIconHint: this.showIconHint,
            currentWordIcon: (this.showIconHint || this.state === "ROUND_END" || this.state === "GAME_END") ? this.currentWordIcon : undefined,
            currentWordCategory: this.currentWordCategory,
            players: this.players.map(p => ({
                id: p.id,
                userId: p.userId,
                userName: p.userName,
                userAvatar: p.userAvatar,
                score: p.score,
                isDrawing: p.isDrawing,
                hasGuessed: p.hasGuessed,
                isConnected: p.isConnected,
                isSpectator: p.isSpectator
            })),
            drawerId: this.players.find(p => p.isDrawing)?.id || null,
            drawerUserId: this.players.find(p => p.isDrawing)?.userId || null
        };

        // On ne doit pas envoyer currentWord à tout le monde
        const isRevealPhase = (this.state === "ROUND_END" || this.state === "GAME_END");

        this.players.forEach(p => {
            const personalState = { ...publicState };
            
            // Drawer identification
            const drawingPlayer = this.players.find(p => p.isDrawing);
            const drawerUserId = drawingPlayer?.userId;
            const isActuallyDrawing = p.isDrawing || (drawerUserId && p.userId === drawerUserId);

            // Obfucation du mot et des choix
            if (!isActuallyDrawing && !isRevealPhase) {
                personalState.currentWord = "";
                if (this.state === "SELECTING_WORD") personalState.wordChoices = [];
                // L'icône n'est révélée qu'aux devineurs si showIconHint est vrai
                if (!this.showIconHint) personalState.currentWordIcon = undefined;
            }
            
            if (isActuallyDrawing) {
                personalState.currentWordIcon = this.currentWordIcon;
                personalState.currentWord = this.currentWord;
            }
            
            this.emitTo(p.id, "skribbl:state:sync", personalState);
        });
    }

    public updateSettings(config: any) {
        if (this.state !== "LOBBY") return;
        if (config.rounds !== undefined) this.maxRounds = config.rounds;
        if (config.difficulty !== undefined) this.difficulty = config.difficulty;
        if (config.categories !== undefined) this.allowedCategories = config.categories;
        this.syncState();
    }

    public startGame() {
        if (this.state !== "LOBBY") return;
        if (this.players.filter(p => p.isConnected && !p.isSpectator).length < 2) {
            this.emitToAll("skribbl:chat:message", { type: "system", text: "Il faut au moins 2 joueurs (hors spectateurs) pour lancer la partie." });
            return;
        }

        this.state = "SELECTING_WORD";
        this.currentRound = 1;
        this.drawerIndex = -1; // Sera incrémenté dans startNextTurn
        this.startNextTurn();
    }

    private startNextTurn(originalDrawerIndex?: number): void {
        const connectedPlayers = this.players.filter(p => p.isConnected && !p.isSpectator);
        if (connectedPlayers.length < 1) {
            console.warn(`[Skribbl:${this.id}] ⚠️ No eligible players (connected & not spectator). Returning to Lobby.`);
            this.state = "LOBBY";
            this.syncState();
            return;
        }

        // Initialize original index on first call of this turn
        if (originalDrawerIndex === undefined) {
            originalDrawerIndex = this.drawerIndex;
        }

        this.drawerIndex++;
        // Si on a fait le tour de tous les joueurs, c'est la fin du round !
        if (this.drawerIndex >= this.players.length) {
            this.drawerIndex = 0;
            this.currentRound++;
        }
        
        if (this.currentRound > this.maxRounds) {
            this.endGame();
            return;
        }

        const nextDrawer = this.players[this.drawerIndex];

        // S'il est déco ou spectateur, on skip à la récursion suivante
        if (!nextDrawer || !nextDrawer.isConnected || nextDrawer.isSpectator) {
            // Safety break: If we've looped back to the start without finding anyone
            if (this.drawerIndex === originalDrawerIndex) {
                 console.error(`[Skribbl:${this.id}] ❌ Loop error: No eligible drawer found in a full cycle.`);
                 this.state = "LOBBY";
                 this.syncState();
                 return;
            }
            return this.startNextTurn(originalDrawerIndex);
        }

        this.players.forEach(p => {
            p.hasGuessed = false;
            p.isDrawing = false; // Reset all, then set for current drawer
        });

        this.currentWord = "";
        this.currentWordIcon = undefined;
        this.currentWordMask = "";
        this.canvasActions = [];
        this.emitToAll("skribbl:draw:clear");
        this.revealedHints.clear();
        this.showIconHint = false;
        this.guessedPlayersCount = 0;
        this.hasRerolledThisTurn = false;
        const currentDrawer = this.players[this.drawerIndex];
        currentDrawer.isDrawing = true;
        this.state = "SELECTING_WORD";
        this.timeLeft = 15; // 15s pour choisir un mot
        this.emitTo(nextDrawer.id, "skribbl:sound:play", "success");

        this.wordChoices = getDofusWords(3, this.difficulty, this.usedWords, this.allowedCategories);
        console.log(`[Skribbl] Word choices for ${nextDrawer.userName}:`, JSON.stringify(this.wordChoices));

        this.emitToAll("skribbl:chat:message", { type: "system", text: `${nextDrawer.userName} choisit un mot...` });
        this.syncState();

        // 15 secondes pour choisir, sinon ça choisit au pif
        this.startTimer(() => {
            const fallback = this.wordChoices[0] || { word: "Iop" };
            this.handleWordChoice(nextDrawer.id, fallback.word);
        });
    }

    public handleWordChoice(socketId: string, word: string) {
        if (this.state !== "SELECTING_WORD") return;
        const drawer = this.players[this.drawerIndex];
        if (!drawer || drawer.id !== socketId) return;

        const choice = this.wordChoices.find(c => c.word === word);
        if (!choice) {
            console.warn(`[SkribblRoom:${this.id}] ⚠️ Word choice rejected: ${word} was not in choices.`);
            this.emitTo(socketId, "skribbl:chat:message", { type: "system", text: "Ce mot n'était pas dans la liste !" });
            return;
        }
        
        this.currentWord = choice.word;
        this.currentWordIcon = choice.iconUrl;
        this.currentWordCategory = choice.category;
        console.log(`[SkribblRoom:${this.id}] 📝 Set word: "${this.currentWord}" (Category: ${this.currentWordCategory})`);
        
        this.usedWords.add(this.currentWord.toLowerCase()); // On retient qu'il a été utilisé
        this.currentWordMask = this.currentWord.replace(/[a-zA-ZÀ-ÿ0-9]/g, "_");
        this.revealedHintIndexes.clear();
        this.state = "DRAWING";

        this.emitToAll("skribbl:chat:message", { type: "system", text: `${drawer.userName} dessine !` });
        this.emitTo(drawer.id, "skribbl:word:start", { word: this.currentWord }); // Lui dire quel mot c'est

        this.syncState();

        this.timeLeft = this.roundDuration;
        this.startTimer(() => {
            this.endRound();
        });
    }

    public handleWordReroll(socketId: string) {
        if (this.state !== "SELECTING_WORD" || this.hasRerolledThisTurn) return;
        const drawer = this.players[this.drawerIndex];
        if (!drawer || drawer.id !== socketId) return;

        this.hasRerolledThisTurn = true;
        this.wordChoices = getDofusWords(3, this.difficulty, this.usedWords, this.allowedCategories);
        this.syncState();
    }

    public handleGuess(socket: Socket, text: string) {
        const player = this.players.find(p => p.id === socket.id);
        if (!player || player.isDrawing || player.hasGuessed || player.isSpectator || this.state !== "DRAWING") return;

        const guess = text.trim();
        const dist = levenshteinDistance(guess, this.currentWord);
        const maxLen = Math.max(guess.length, this.currentWord.length);

        // Distance stricte == 0 -> Exact !
        if (dist === 0) {
            player.hasGuessed = true;
            this.guessedPlayersCount++;

            // Score du devineur basé sur la vitesse (max 1000)
            const timeRatio = this.timeLeft / this.roundDuration;
            const baseScore = Math.round(timeRatio * 900) + 100;
            const penalty = (this.guessedPlayersCount - 1) * 50;
            const points = Math.max(50, baseScore - penalty);

            player.score += points;
            this.guessersScoresThisRound.push(points);

            this.emitToAll("skribbl:chat:message", { type: "success", text: `${player.userName} a trouvé le mot !` });
            this.emitTo(socket.id, "skribbl:sound:play", "success");
            this.emitToAll("skribbl:sound:play", "ding"); // Notifier tout le monde joyeusement
            this.syncState();

            this.checkRoundEndConditions();
        }
        // Distance proche (faute de frappe)
        else if (dist <= 2 && maxLen > 4) {
            // Seulement visible pour le joueur qui a presque trouvé
            this.emitToAll("skribbl:chat:message", { type: "guess", text: `${player.userName}: ${guess}` });
            this.emitTo(socket.id, "skribbl:chat:message", { type: "warning", text: `'${guess}' est presque exact !` });
        }
        // Différence de 1 lettre autorisée pour "C'est presque ça !"
        else if (dist === 1 && text.length > 3) {
            this.emitTo(socket.id, "skribbl:chat:message", { type: "system", text: `'${text}' est presque correct !` });
            return;
        }

        // Sinon message normal
        this.emitToAll("skribbl:chat:message", {
            sender: player.userName,
            text,
            userId: player.userId
        });
        
        // Son de "raté" pour celui qui a tapé (si c'est pas le mot exact)
        this.emitTo(socket.id, "skribbl:sound:play", "fail");
    }

    private checkRoundEndConditions() {
        // Si tout le monde (sauf le dessinateur et spectateurs) a trouvé, round end
        const activeGuessers = this.players.filter(p => p.isConnected && !p.isDrawing && !p.isSpectator);
        const allGuessed = activeGuessers.every(p => p.hasGuessed);

        if (allGuessed && activeGuessers.length > 0) {
            this.endRound();
        }
    }

    private endRound() {
        this.stopTimer();
        this.state = "ROUND_END";

        // Logic for drawer points
        const drawer = this.players[this.drawerIndex];
        if (drawer) {
            if (this.guessersScoresThisRound.length > 0) {
                const totalGuessersPoints = this.guessersScoresThisRound.reduce((a, b) => a + b, 0);
                const avgGuesserPoints = totalGuessersPoints / this.guessersScoresThisRound.length;
                
                // Le dessinateur gagne une portion du score moyen
                const drawerPoints = Math.round(avgGuesserPoints * 0.75);
                drawer.score += drawerPoints;

                this.emitToAll("skribbl:chat:message", { 
                    type: "system", 
                    text: `${drawer.userName} (Dessinateur) gagne +${drawerPoints} points !` 
                });
            } else {
                this.emitToAll("skribbl:chat:message", { 
                    type: "system", 
                    text: `Personne n'a trouvé ! 0 points pour ${drawer.userName}.` 
                });
            }
        }

        // Fin de round, montrer le mot
        if (this.currentWord) {
            this.currentWordMask = this.currentWord;
            this.emitToAll("skribbl:chat:message", { type: "system", text: `Le mot était : ${this.currentWord}` });
        } else {
             this.emitToAll("skribbl:chat:message", { type: "system", text: `Le tour est annulé (dessinateur absent).` });
        }
        this.syncState();

        this.guessersScoresThisRound = [];

        setTimeout(() => {
            if (this.state === "ROUND_END") {
                this.startNextTurn();
            }
        }, 5000);
    }

    private async endGame() {
        this.state = "GAME_END";
        this.emitToAll("skribbl:chat:message", { type: "system", text: "La partie est terminée !" });
        
        // Trier les joueurs par score
        const winners = [...this.players].sort((a, b) => b.score - a.score);
        if (winners.length > 0) {
            this.emitToAll("skribbl:chat:message", { type: "system", text: `Le vainqueur est ${winners[0].userName} avec ${winners[0].score} kamas !` });
        }
        
        this.syncState();

        // --- HALL OF FAME PERSISTENCE ---
        try {
            const validPlayers = this.players.filter(p => !p.isSpectator && p.userId);
            // On ne compte que si il y a au moins 2 joueurs (pas de solo)
            if (validPlayers.length > 1) {
                for (const p of validPlayers) {
                    // 1. Sauvegarder le score individuel
                    await db.skribblScore.create({
                        data: {
                            guildId: this.guildId,
                            userId: p.userId!,
                            userName: p.userName,
                            userAvatar: p.userAvatar,
                            score: p.score
                        }
                    });

                    // 2. Mettre à jour le rang global
                    const rank = await db.skribblRank.upsert({
                        where: { guildId_userId: { guildId: this.guildId, userId: p.userId! } },
                        create: {
                            guildId: this.guildId,
                            userId: p.userId!,
                            userName: p.userName,
                            userAvatar: p.userAvatar,
                            bestScore: p.score,
                            totalPoints: p.score,
                            gamesPlayed: 1
                        },
                        update: {
                            userName: p.userName,
                            userAvatar: p.userAvatar,
                            totalPoints: { increment: p.score },
                            gamesPlayed: { increment: 1 }
                        }
                    });

                    // Update bestScore if needed
                    if (p.score > rank.bestScore) {
                        await db.skribblRank.update({
                            where: { id: rank.id },
                            data: { bestScore: p.score }
                        });
                    }
                }
            }
        } catch (error) {
            console.error("[SkribblRoom] Error saving Hall of Fame:", error);
        }
        
        setTimeout(() => {
            this.state = "LOBBY";
            this.currentRound = 0;
            this.drawerIndex = -1;
            this.players.forEach(p => p.score = 0);
            this.usedWords.clear();
            this.syncState();
        }, 10000); // 10 sec de podium
    }

    private checkHintReveal() {
        if (!this.currentWord || this.currentWord.length <= 2) return;
        const totalDuration = this.roundDuration;
        const elapsed = totalDuration - this.timeLeft;
        const ratio = elapsed / totalDuration;

        let shouldRevealCount = 0;
        if (ratio >= 0.35) shouldRevealCount = 1;
        if (ratio >= 0.65) shouldRevealCount = 2; // ~21s left
        if (this.timeLeft <= 15) shouldRevealCount = 3; // Final rush hint!
        
        // Very long words can have an extra hint
        if (ratio >= 0.85 && this.currentWord.length >= 8) shouldRevealCount = 4;

        if (this.revealedHintIndexes.size < shouldRevealCount) {
            const chars = this.currentWord.split("");
            const unrevealed = chars
                .map((c, i) => i)
                .filter(i => chars[i] !== " " && chars[i] !== "-" && chars[i] !== "'" && !this.revealedHintIndexes.has(i));
            
            if (unrevealed.length > 0) {
                const idx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
                this.revealedHintIndexes.add(idx);
                
                const charArray = this.currentWordMask.split("");
                charArray[idx] = this.currentWord[idx];
                this.currentWordMask = charArray.join("");
                
                console.log(`[SkribblRoom:${this.id}] 💡 Revealed hint at index ${idx}: "${this.currentWord[idx]}" -> ${this.currentWordMask}`);
                this.syncState(); 
            }
        }

        // Hint Visuel (Icône) après ratio >= 0.4 (~24s écoulées -> 36s restantes)
        if (ratio >= 0.4 && !this.showIconHint && this.currentWordIcon) {
            this.showIconHint = true;
            this.emitToAll("skribbl:chat:message", { type: "system", text: "🚨 UN INDICE VISUEL EST APPARU !" });
            this.syncState();
        }
        
        // Message spécial quand il reste peu de temps
        if (this.timeLeft === 15) {
            this.emitToAll("skribbl:chat:message", { type: "warning", text: "Plus que 15 secondes ! Dépêchez-vous !" });
        }
    }

    private getWordMask(): string {
        return this.currentWordMask;
    }

    private startTimer(onTimeout: () => void) {
        this.stopTimer(); // Sécurité
        // Envoyer un tick toutes les secondes
        this.roundTimer = setInterval(() => {
            this.timeLeft--;
            if (this.timeLeft <= 0) {
                this.stopTimer();
                onTimeout();
            } else {
                if (this.state === "DRAWING") {
                    this.checkHintReveal();
                }
                if (this.timeLeft <= 10 && this.state === "DRAWING") {
                    this.emitToAll("skribbl:sound:play", "tick");
                }
                this.emitToAll("skribbl:time:tick", { timeLeft: this.timeLeft });
            }
        }, 1000);
    }

    private stopTimer() {
        if (this.roundTimer) {
            clearInterval(this.roundTimer);
            this.roundTimer = null;
        }
    }

    public isSpectator(socketId: string): boolean {
        return this.players.find(p => p.id === socketId)?.isSpectator || false;
    }

    public getState(): GameState { return this.state; }

    public getConnectedPlayerCount(): number {
        return this.players.filter(p => p.isConnected && !p.isSpectator).length;
    }

    public getSpectatorCount(): number {
        return this.players.filter(p => p.isConnected && p.isSpectator).length;
    }

    public getHostName(): string {
        const host = this.players.find(p => p.userId === this.hostId || p.id === this.hostId);
        return host?.userName || "Hôte";
    }

    public getPublicInfo(roomId: string) {
        return {
            roomId,
            playerCount: this.getConnectedPlayerCount(),
            spectatorCount: this.getSpectatorCount(),
            maxPlayers: 8,
            hostName: this.getHostName(),
            rounds: this.maxRounds,
        };
    }

    public destroy() {
        this.stopTimer();
    }
}
