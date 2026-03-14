/**
 * Sigil King — Game Room (State Machine)
 * 
 * Phases: LOBBY → BIDDING → PLAYING → ROUND_END → ... → GAME_END
 * 10 rounds, escalating card count per round.
 */

import { Server, Socket } from "socket.io";
import { Deck, Card, Suit } from "./Deck";
import { TrickResolver, PlayedCard, BonusType } from "./TrickResolver";
import { ScoreCalculator, RoundPlayerResult } from "./ScoreCalculator";
import { db } from "@/lib/prisma";
// No circular import needed — manager reference removed

type GamePhase = "LOBBY" | "BIDDING" | "PLAYING" | "ROUND_END" | "GAME_END";

interface Player {
    id: string; // Socket ID
    userId?: string;
    userName: string;
    userAvatar?: string;
    score: number;
    bid: number | null;
    tricksWon: number;
    bonuses: BonusType[];
    hand: Card[];
    isConnected: boolean;
    isSpectator: boolean;
    seatIndex: number;
}

interface TrickState {
    cards: PlayedCard[];
    leadSuit: Suit | null;
}

export interface SigilKingSettings {
    advancedCards: boolean;
    stormMode: boolean;
    maxRounds: number; // 10 by default, can be 5 for quick games
    timeoutBid: number; // seconds
    timeoutPlay: number; // seconds
}

export class SigilKingRoom {
    private id: string;
    private guildId: string;
    private phase: GamePhase = "LOBBY";
    private players: Player[] = [];
    private hostId: string | null = null;

    // Game state
    private currentRound: number = 0;
    private dealerIndex: number = -1;
    private currentPlayerIndex: number = -1;
    private currentTrick: TrickState = { cards: [], leadSuit: null };
    private tricksHistory: PlayedCard[][] = [];
    private roundResults: RoundPlayerResult[][] = [];
    private deck: Card[] = [];

    // Settings
    private settings: SigilKingSettings = {
        advancedCards: false,
        stormMode: true,
        maxRounds: 10,
        timeoutBid: 30,
        timeoutPlay: 45,
    };

    // Timers
    private phaseTimer: NodeJS.Timeout | null = null;
    private timeLeft: number = 0;

    // Engines
    private trickResolver = new TrickResolver();
    private scoreCalculator = new ScoreCalculator();

    constructor(
        private io: Server,
        config: { id: string; guildId: string; settings?: Partial<SigilKingSettings> }
    ) {
        this.id = config.id;
        this.guildId = config.guildId;
        if (config.settings) {
            this.settings = { ...this.settings, ...config.settings };
        }
    }

    public getGuildId() { return this.guildId; }
    public getPhase() { return this.phase; }
    public isInLobby() { return this.phase === "LOBBY"; }
    public isEmpty() { return this.players.filter(p => p.isConnected).length === 0; }

    public isHost(socketId: string) {
        const player = this.players.find(p => p.id === socketId);
        return player ? this.hostId === (player.userId || player.id) : false;
    }

    public getHostId() { return this.hostId; }

    public isSpectator(socketId: string): boolean {
        return this.players.find(p => p.id === socketId)?.isSpectator || false;
    }

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
            maxPlayers: 6,
            hostName: this.getHostName(),
            rounds: this.settings.maxRounds,
            phase: this.phase,
        };
    }

    // ─── Emit helpers ───────────────────────────────────────

    private emitToAll(event: string, data?: any) {
        if (data !== undefined) this.io.to(this.id).emit(event, data);
        else this.io.to(this.id).emit(event);
    }

    private emitTo(socketId: string, event: string, data?: any) {
        this.io.to(socketId).emit(event, data);
    }

    // ─── Player Management ──────────────────────────────────

    public addPlayer(socket: Socket, userName: string, userId?: string, userAvatar?: string, isSpectator?: boolean) {
        const existing = this.players.find(p => p.id === socket.id || (userId && p.userId === userId));

        if (existing) {
            existing.isConnected = true;
            existing.id = socket.id;
            this.syncState();
            return;
        }

        if (this.players.filter(p => !p.isSpectator).length >= 6 && !isSpectator) {
            isSpectator = true; // Force spectator if full
        }

        const seatIndex = isSpectator ? -1 : this.players.filter(p => !p.isSpectator).length;

        const newPlayer: Player = {
            id: socket.id,
            userId,
            userName: userName || `Joueur ${this.players.length + 1}`,
            userAvatar,
            score: 0,
            bid: null,
            tricksWon: 0,
            bonuses: [],
            hand: [],
            isConnected: true,
            isSpectator: !!isSpectator,
            seatIndex,
        };
        this.players.push(newPlayer);

        if (!this.hostId && !newPlayer.isSpectator) {
            this.hostId = userId || socket.id;
        }

        this.emitToAll("sk:chat", { type: "system", text: `${userName} a rejoint la taverne.` });
        this.syncState();
    }

    public removePlayer(socketId: string) {
        const player = this.players.find(p => p.id === socketId);
        if (!player) return;

        player.isConnected = false;
        this.emitToAll("sk:chat", { type: "system", text: `${player.userName} a quitté la taverne.` });

        // Transfer host if needed
        if (this.hostId === (player.userId || player.id)) {
            const nextHost = this.players.find(p => p.isConnected && !p.isSpectator);
            this.hostId = nextHost ? (nextHost.userId || nextHost.id) : null;
        }

        // Handle disconnection during game
        if (this.phase === "BIDDING") {
            this.checkAllBidsSubmitted();
        } else if (this.phase === "PLAYING") {
            const activePlayers = this.getActivePlayers();
            if (activePlayers[this.currentPlayerIndex]?.id === socketId) {
                // Current player disconnected, skip their turn with auto-play
                this.autoPlayForPlayer(player);
            }
        }

        // If fewer than 2 connected players remain during a game, end it
        const connectedActive = this.players.filter(p => p.isConnected && !p.isSpectator);
        if (this.phase !== "LOBBY" && connectedActive.length < 2) {
            this.emitToAll("sk:chat", { type: "system", text: "Pas assez de joueurs, partie annulée." });
            this.resetToLobby();
        }

        this.syncState();
    }

    // ─── Settings ───────────────────────────────────────────

    public updateSettings(settings: Partial<SigilKingSettings>) {
        if (this.phase !== "LOBBY") return;
        this.settings = { ...this.settings, ...settings };
        this.syncState();
    }

    // ─── Game Flow ──────────────────────────────────────────

    public startGame() {
        if (this.phase !== "LOBBY") return;
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length < 2) {
            this.emitToAll("sk:chat", { type: "system", text: "Il faut au moins 2 joueurs pour commencer." });
            return;
        }

        // Reset all scores
        this.players.forEach(p => {
            p.score = 0;
            p.tricksWon = 0;
            p.bid = null;
            p.hand = [];
            p.bonuses = [];
        });
        this.currentRound = 0;
        this.dealerIndex = -1;
        this.roundResults = [];

        this.emitToAll("sk:chat", { type: "system", text: "🃏 La partie de Sigil King commence !" });
        this.updateSessionInDB();
        this.startNextRound();
    }

    private startNextRound() {
        this.currentRound++;
        if (this.currentRound > this.settings.maxRounds) {
            this.endGame();
            return;
        }

        const activePlayers = this.getActivePlayers();

        // Rotate dealer
        this.dealerIndex = (this.dealerIndex + 1) % activePlayers.length;

        // Generate and deal deck
        this.deck = Deck.generate(this.settings.advancedCards);
        const hands = Deck.deal(this.deck, activePlayers.length, this.currentRound);
        activePlayers.forEach((p, i) => {
            p.hand = hands[i];
            p.bid = null;
            p.tricksWon = 0;
            p.bonuses = [];
        });

        this.tricksHistory = [];
        this.currentTrick = { cards: [], leadSuit: null };

        this.phase = "BIDDING";
        this.emitToAll("sk:chat", {
            type: "system",
            text: `🎴 Manche ${this.currentRound}/${this.settings.maxRounds} — ${this.currentRound} carte${this.currentRound > 1 ? 's' : ''} distribuée${this.currentRound > 1 ? 's' : ''}.`,
        });

        this.syncState();
        this.updateSessionInDB();

        // Give players time to see their cards before the bid prompt
        // Timer scales with round: 5s base + 1s per card
        const cardPreviewTime = 5000 + (this.currentRound * 1000);
        this.emitToAll("sk:dealing:start", {
            round: this.currentRound,
            cardCount: this.currentRound,
            previewDuration: cardPreviewTime,
        });

        setTimeout(() => {
            if (this.phase === "BIDDING") {
                this.startBidTimer();
            }
        }, cardPreviewTime);
    }

    // ─── Bidding Phase ──────────────────────────────────────

    private startBidTimer() {
        // Scale timeout with round: base + 3s per round (more cards = more thinking needed)
        const scaledTimeout = this.settings.timeoutBid + (this.currentRound * 3);
        this.timeLeft = scaledTimeout;
        this.stopTimer();
        this.phaseTimer = setInterval(() => {
            this.timeLeft--;
            this.emitToAll("sk:timer", { timeLeft: this.timeLeft });
            if (this.timeLeft <= 0) {
                this.stopTimer();
                this.autoSubmitBids();
            }
        }, 1000);
    }

    public submitBid(socketId: string, amount: number) {
        if (this.phase !== "BIDDING") return;
        const player = this.players.find(p => p.id === socketId);
        if (!player || player.isSpectator || player.bid !== null) return;

        // Validate bid range
        if (amount < 0 || amount > this.currentRound) return;

        player.bid = amount;
        this.emitToAll("sk:chat", {
            type: "system",
            text: `${player.userName} a misé.`,
        });

        this.syncState();
        this.checkAllBidsSubmitted();
    }

    private checkAllBidsSubmitted() {
        const activePlayers = this.getActivePlayers();
        const allSubmitted = activePlayers.every(p => p.bid !== null || !p.isConnected);
        if (allSubmitted) {
            this.stopTimer();
            this.revealBids();
        }
    }

    private autoSubmitBids() {
        const activePlayers = this.getActivePlayers();
        activePlayers.forEach(p => {
            if (p.bid === null && p.isConnected) {
                p.bid = 0; // Default bid
            }
        });
        this.revealBids();
    }

    private revealBids() {
        const activePlayers = this.getActivePlayers();
        const bids: Record<string, number> = {};
        activePlayers.forEach(p => {
            bids[p.userId || p.id] = p.bid ?? 0;
        });

        this.emitToAll("sk:bids:reveal", bids);

        // Start playing phase after a short delay
        setTimeout(() => {
            this.startPlayingPhase();
        }, 2500);
    }

    // ─── Playing Phase ──────────────────────────────────────

    private startPlayingPhase() {
        this.phase = "PLAYING";
        const activePlayers = this.getActivePlayers();

        // First player is left of dealer
        this.currentPlayerIndex = (this.dealerIndex + 1) % activePlayers.length;
        this.currentTrick = { cards: [], leadSuit: null };

        this.syncState();
        this.startPlayTimer();
    }

    private startPlayTimer() {
        // Scale timeout per turn with round too: base + 2s per round
        const scaledTimeout = this.settings.timeoutPlay + (this.currentRound * 2);
        this.timeLeft = scaledTimeout;
        this.stopTimer();
        this.phaseTimer = setInterval(() => {
            this.timeLeft--;
            this.emitToAll("sk:timer", { timeLeft: this.timeLeft });
            if (this.timeLeft <= 0) {
                this.stopTimer();
                const activePlayers = this.getActivePlayers();
                const currentPlayer = activePlayers[this.currentPlayerIndex];
                if (currentPlayer) {
                    // Penalty: -10 points for timing out
                    currentPlayer.score = Math.max(-200, currentPlayer.score - 10);
                    this.emitToAll("sk:chat", {
                        type: "system",
                        text: `⏰ ${currentPlayer.userName} n'a pas joué à temps ! -10 pts`,
                    });
                    this.autoPlayForPlayer(currentPlayer);
                }
            }
        }, 1000);
    }

    public playCard(socketId: string, cardId: string, sramChoice?: "incarnation" | "pandawa") {
        if (this.phase !== "PLAYING") return;
        const activePlayers = this.getActivePlayers();
        const currentPlayer = activePlayers[this.currentPlayerIndex];
        if (!currentPlayer || currentPlayer.id !== socketId) return;
        if (currentPlayer.isSpectator) return;

        const cardIndex = currentPlayer.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;

        const card = currentPlayer.hand[cardIndex];

        // Validate card play (lead suit rule)
        if (!this.trickResolver.canPlayCard(card, currentPlayer.hand, this.currentTrick.leadSuit)) {
            this.emitTo(socketId, "sk:error", { message: "Vous devez jouer la couleur demandée !" });
            return;
        }

        // Sram requires a choice
        if (card.type === "sram" && !sramChoice) {
            this.emitTo(socketId, "sk:sram:choose", { cardId });
            return;
        }

        // Remove card from hand
        currentPlayer.hand.splice(cardIndex, 1);

        // Add to trick
        const playedCard: PlayedCard = { playerId: currentPlayer.userId || currentPlayer.id, card, sramChoice };
        this.currentTrick.cards.push(playedCard);

        // Set lead suit if first elemental card
        if (!this.currentTrick.leadSuit && card.type === "elemental") {
            this.currentTrick.leadSuit = card.suit!;
        }

        this.emitToAll("sk:card:played", {
            playerId: currentPlayer.userId || currentPlayer.id,
            card,
            sramChoice,
        });

        // Check if trick is complete
        if (this.currentTrick.cards.length >= activePlayers.length) {
            this.stopTimer();
            this.resolveTrick();
        } else {
            // Next player's turn
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % activePlayers.length;
            // Skip disconnected players
            let attempts = 0;
            while (!activePlayers[this.currentPlayerIndex]?.isConnected && attempts < activePlayers.length) {
                this.autoPlayForPlayer(activePlayers[this.currentPlayerIndex]);
                this.currentPlayerIndex = (this.currentPlayerIndex + 1) % activePlayers.length;
                attempts++;
            }
            this.stopTimer();
            this.startPlayTimer();
            this.syncState();
        }
    }

    private autoPlayForPlayer(player: Player) {
        if (!player || player.hand.length === 0) return;

        // Auto-play: play the first valid card
        const validCard = player.hand.find(c =>
            this.trickResolver.canPlayCard(c, player.hand, this.currentTrick.leadSuit)
        ) || player.hand[0];

        const cardIndex = player.hand.indexOf(validCard);
        if (cardIndex >= 0) {
            player.hand.splice(cardIndex, 1);
            const sramChoice = validCard.type === "sram" ? "pandawa" as const : undefined;
            const playedCard: PlayedCard = {
                playerId: player.userId || player.id,
                card: validCard,
                sramChoice,
            };
            this.currentTrick.cards.push(playedCard);

            if (!this.currentTrick.leadSuit && validCard.type === "elemental") {
                this.currentTrick.leadSuit = validCard.suit!;
            }

            this.emitToAll("sk:card:played", {
                playerId: player.userId || player.id,
                card: validCard,
                sramChoice,
            });
        }

        // Check if trick complete after auto-play
        const activePlayers = this.getActivePlayers();
        if (this.currentTrick.cards.length >= activePlayers.length) {
            this.stopTimer();
            this.resolveTrick();
        }
    }

    private resolveTrick() {
        const outcome = this.trickResolver.resolve(this.currentTrick.cards);

        // Save trick history
        this.tricksHistory.push([...this.currentTrick.cards]);

        // Award trick to winner
        if (outcome.winnerId) {
            const winner = this.players.find(p => (p.userId || p.id) === outcome.winnerId);
            if (winner) {
                winner.tricksWon++;
                if (outcome.bonusTriggered) {
                    winner.bonuses.push(outcome.bonusTriggered);
                }
            }
        }

        // Emit trick result
        this.emitToAll("sk:trick:resolved", {
            winnerId: outcome.winnerId,
            bonusTriggered: outcome.bonusTriggered,
            cards: this.currentTrick.cards,
        });

        // Bonus announcement
        if (outcome.bonusTriggered === "eniripsa_captures_ogrest") {
            this.emitToAll("sk:chat", { type: "bonus", text: "💫 L'Éniripsa a capturé Ogrest ! +50 points bonus !" });
        } else if (outcome.bonusTriggered === "incarnation_captures_ogrest") {
            this.emitToAll("sk:chat", { type: "bonus", text: "⚔️ L'Incarnation a vaincu Ogrest ! +30 points bonus !" });
        }

        if (!outcome.winnerId) {
            this.emitToAll("sk:chat", { type: "system", text: "💀 Le Dévastateur annule le pli !" });
        }

        // Check if round is over (all cards played)
        const activePlayers = this.getActivePlayers();
        const roundOver = activePlayers.every(p => p.hand.length === 0);

        setTimeout(() => {
            if (roundOver) {
                this.endRound();
            } else {
                // Start next trick — winner leads (or next player if trick cancelled)
                if (outcome.winnerId) {
                    this.currentPlayerIndex = activePlayers.findIndex(
                        p => (p.userId || p.id) === outcome.winnerId
                    );
                    if (this.currentPlayerIndex === -1) {
                        this.currentPlayerIndex = (this.dealerIndex + 1) % activePlayers.length;
                    }
                }
                this.currentTrick = { cards: [], leadSuit: null };
                this.syncState();
                this.startPlayTimer();
            }
        }, 2500);
    }

    // ─── Round End ───────────────────────────────────────────

    private endRound() {
        this.phase = "ROUND_END";
        this.stopTimer();

        const activePlayers = this.getActivePlayers();
        const results: RoundPlayerResult[] = activePlayers.map(p => {
            const bonusPoints = this.scoreCalculator.calculateBonusPoints(p.bonuses);
            const roundScore = this.scoreCalculator.calculateRoundScore(
                p.bid ?? 0,
                p.tricksWon,
                this.currentRound,
                this.settings.stormMode
            ) + bonusPoints;

            p.score += roundScore;

            return {
                playerId: p.userId || p.id,
                bid: p.bid ?? 0,
                tricksWon: p.tricksWon,
                bonusPoints,
                roundScore,
                totalScore: p.score,
            };
        });

        this.roundResults.push(results);

        this.emitToAll("sk:round:end", {
            round: this.currentRound,
            results,
        });

        // Show scores for a few seconds, then start next round
        setTimeout(() => {
            if (this.phase === "ROUND_END") {
                this.startNextRound();
            }
        }, 8000);

        this.syncState();
    }

    // ─── Game End ────────────────────────────────────────────

    private endGame() {
        this.phase = "GAME_END";
        this.stopTimer();

        const sortedPlayers = [...this.players]
            .filter(p => !p.isSpectator)
            .sort((a, b) => b.score - a.score);

        this.emitToAll("sk:chat", {
            type: "system",
            text: `🏆 Fin de la partie ! ${sortedPlayers[0]?.userName || "Personne"} remporte la couronne avec ${sortedPlayers[0]?.score || 0} points !`,
        });

        this.emitToAll("sk:game:over", {
            players: sortedPlayers.map(p => ({
                playerId: p.userId || p.id,
                userName: p.userName,
                userAvatar: p.userAvatar,
                score: p.score,
            })),
            roundResults: this.roundResults,
        });

        this.saveGameResults();
        this.syncState();

        // Return to lobby after podium
        setTimeout(() => {
            this.resetToLobby();
        }, 15000);
    }

    private async updateSessionInDB() {
        try {
            const activePlayers = this.getActivePlayers();
            await db.sigilKingSession.upsert({
                where: { id: this.id },
                create: {
                    id: this.id,
                    guildId: this.guildId,
                    hostId: this.hostId || "unknown",
                    hostName: this.getHostName(),
                    status: this.phase,
                    currentRound: this.currentRound,
                    maxRounds: this.settings.maxRounds,
                    targetScore: 200, // Fixed for now
                },
                update: {
                    status: this.phase,
                    currentRound: this.currentRound,
                    hostId: this.hostId || "unknown",
                    hostName: this.getHostName(),
                }
            });

            // Update players
            for (const p of activePlayers) {
                if (!p.userId) continue;
                await db.sigilKingSessionPlayer.upsert({
                    where: { sessionId_userId: { sessionId: this.id, userId: p.userId } },
                    create: {
                        sessionId: this.id,
                        userId: p.userId,
                        userName: p.userName,
                        userAvatar: p.userAvatar,
                        totalScore: p.score,
                        cards: JSON.stringify(p.hand),
                    },
                    update: {
                        totalScore: p.score,
                        cards: JSON.stringify(p.hand),
                        lastActive: new Date(),
                    }
                });
            }
        } catch (error) {
            console.error(`[SigilKingRoom:${this.id}] Error updating session in DB:`, error);
        }
    }

    private async saveGameResults() {
        try {
            const validPlayers = this.players.filter(p => !p.isSpectator && p.userId);
            if (validPlayers.length <= 1) {
                console.log(`[SigilKingRoom:${this.id}] PartIE solo ou uniquement des spectateurs - pas de Hall of Fame.`);
                return;
            }

            const sortedPlayers = [...validPlayers].sort((a, b) => b.score - a.score);
            for (let i = 0; i < sortedPlayers.length; i++) {
                const p = sortedPlayers[i];
                if (!p.userId) continue;

                await db.sigilKingScore.create({
                    data: {
                        guildId: this.guildId,
                        userId: p.userId,
                        userName: p.userName,
                        userAvatar: p.userAvatar,
                        score: p.score,
                        rank: i + 1,
                    }
                });

                // 2. Update global ranks/ladder
                const isWinner = i === 0;
                await db.sigilKingRank.upsert({
                    where: { guildId_userId: { guildId: this.guildId, userId: p.userId } },
                    create: {
                        guildId: this.guildId,
                        userId: p.userId,
                        userName: p.userName,
                        userAvatar: p.userAvatar,
                        bestScore: p.score,
                        totalPoints: p.score,
                        gamesPlayed: 1,
                        wins: isWinner ? 1 : 0,
                    },
                    update: {
                        bestScore: { set: Math.max(p.score, 0) }, // will handle in custom way below if needed
                        totalPoints: { increment: p.score },
                        gamesPlayed: { increment: 1 },
                        wins: { increment: isWinner ? 1 : 0 },
                    }
                });
                
                // Fine-tune bestScore
                const currentRank = await db.sigilKingRank.findUnique({
                    where: { guildId_userId: { guildId: this.guildId, userId: p.userId } }
                });
                if (currentRank && p.score > currentRank.bestScore) {
                    await db.sigilKingRank.update({
                        where: { id: currentRank.id },
                        data: { bestScore: p.score }
                    });
                }
            }

            // 3. Mark session as finished
            await db.sigilKingSession.update({
                where: { id: this.id },
                data: { status: "FINISHED" }
            });

        } catch (error) {
            console.error(`[SigilKingRoom:${this.id}] Error saving game results:`, error);
        }
    }

    private resetToLobby() {
        this.phase = "LOBBY";
        this.currentRound = 0;
        this.dealerIndex = -1;
        this.roundResults = [];
        this.players.forEach(p => {
            p.score = 0;
            p.bid = null;
            p.tricksWon = 0;
            p.hand = [];
            p.bonuses = [];
        });
        this.syncState();
    }

    // ─── State Sync ─────────────────────────────────────────

    public syncState() {
        const activePlayers = this.getActivePlayers();

        // Build public state (no hand info for other players)
        const baseState = {
            id: this.id,
            phase: this.phase,
            round: this.currentRound,
            maxRounds: this.settings.maxRounds,
            settings: this.settings,
            currentPlayerIndex: this.currentPlayerIndex,
            dealerIndex: this.dealerIndex,
            timeLeft: this.timeLeft,
            hostId: this.hostId,
            currentTrick: {
                cards: this.currentTrick.cards,
                leadSuit: this.currentTrick.leadSuit,
            },
            tricksThisRound: this.tricksHistory.length,
            roundResults: this.roundResults,
            players: this.players.map(p => ({
                odKey: p.userId || p.id,
                userName: p.userName,
                userAvatar: p.userAvatar,
                score: p.score,
                bid: (this.phase === "BIDDING" && p.bid !== null) ? "hidden" : p.bid,
                tricksWon: p.tricksWon,
                handCount: p.hand.length,
                isConnected: p.isConnected,
                isSpectator: p.isSpectator,
                seatIndex: p.seatIndex,
                isCurrentTurn: this.phase === "PLAYING" && activePlayers[this.currentPlayerIndex]?.id === p.id,
                hasBid: p.bid !== null,
            })),
        };

        // Send personalized state to each player (with their hand)
        this.players.forEach(p => {
            const personalState = {
                ...baseState,
                localHand: p.hand,
                localPlayerId: p.userId || p.id,
            };

            // Reveal bids only after bidding phase
            if (this.phase !== "BIDDING") {
                personalState.players = this.players.map(pp => ({
                    ...baseState.players.find(bp => bp.odKey === (pp.userId || pp.id))!,
                    bid: pp.bid,
                }));
            }

            this.emitTo(p.id, "sk:state", personalState);
        });
    }

    // ─── Helpers ─────────────────────────────────────────────

    private getActivePlayers(): Player[] {
        return this.players.filter(p => !p.isSpectator);
    }

    private stopTimer() {
        if (this.phaseTimer) {
            clearInterval(this.phaseTimer);
            this.phaseTimer = null;
        }
    }

    public destroy() {
        this.stopTimer();
    }
}
