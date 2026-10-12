
import { Server, Socket } from "socket.io";
import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import * as fs from "fs";
import * as path from "path";

type GameState = "LOBBY" | "STARTING" | "PLAYING" | "GAME_END";

interface Player {
    id: string; // Socket ID
    userId?: string;
    discordId?: string; // NEW — Snowflake Discord ID for voice matching
    userName: string;
    userAvatar?: string;
    lives: number;
    isConnected: boolean;
    isSpectator: boolean;
    wordsFound: number;
    alphabet: string[];
    isReady: boolean;
    isBot: boolean;
}

interface RoomConfig {
    startingLives: number;
    turnTime: number;
    dictionaryMode: "dofus" | "mixed" | "fr";
    syllableDifficulty: "easy" | "medium" | "hard";
    minWordLength: number;
    isSoloMode: boolean;
    minTurnDuration: number; // Minimum time given to next player (JKLM style)
    suddenDeathEnabled: boolean;   // Mort subite (temps réduit) activée ou non
    suddenDeathExchanges: number;  // Nombre d'échanges avant l'activation de la mort subite
}

// ── Dofus class names always accepted ────────────────────────────
const ALWAYS_VALID = new Set([
    "IOP","CRA","KAMA","XELOR","ENUTROF","SACRIEUR","OUGINAK",
    "ELIOTROPE","HUPPERMAGE","ZOBAL","STEAMER","SADIDA",
    "FECA","SRAM","ROUBLARD","ECAFLIP","PANDAWA","OSAMODAS",
    "MASQUERAIDER","FORGELANCE","TWILIGHT","TEMPORAL","KROSMAGE",
    "GUILDE","ALLIANCE","PERCEPTEUR","BONTARIEN","BRAKMARIEN",
]);

export class SigilBombRoom {
    // ── Shared dictionary (static, loaded once) ──────────────────
    private static dictionaryDofus: string[] = [];
    private static dictionaryMixed: string[] = [];
    private static dictionaryCategories: Record<string, string> = {};
    private static dictionaryLoaded = false;

    private id: string;
    private guildId: string;
    private state: GameState = "LOBBY";
    private players: Player[] = [];
    private hostId: string | null = null; // Current Socket ID of host
    private hostUserId: string | null = null; // Permanent User ID of host

    private config: RoomConfig = {
        startingLives: 3,
        turnTime: 12,
        dictionaryMode: "dofus",
        syllableDifficulty: "medium",
        minWordLength: 1,
        isSoloMode: false,
        minTurnDuration: 2,
        suddenDeathEnabled: true,
        suddenDeathExchanges: 20,
    };

    private currentTurnIndex = 0;
    private currentSyllable = "";
    private currentSyllableCategory: string | null = null;
    private timeLeft = 0;
    private tickInterval: NodeJS.Timeout | null = null;
    private botTimeout: NodeJS.Timeout | null = null;
    private botTimeouts: NodeJS.Timeout[] = [];
    private usedWordsInSession = new Set<string>();
    private lastFoundWords: { word: string; playerName: string; playerId: string; isBot?: boolean }[] = [];
    private static deconstructedWords: Map<string, string[]> = new Map();
    private currentSyllablePartCount = 1;
    private currentSyllableHintParts: string[] = [];
    private suddenDeathExchanges = 0;
    private isSuddenDeath = false;
    private suddenDeathWarned = false;

    private clearBotTimeouts() {
        if (this.botTimeout) {
            clearTimeout(this.botTimeout);
            this.botTimeout = null;
        }
        this.botTimeouts.forEach(t => clearTimeout(t));
        this.botTimeouts = [];
    }

    constructor(private io: Server, config: { id: string; guildId: string }) {
        this.id = config.id;
        this.guildId = config.guildId;
        this.loadDictionary();
    }

    // ── Unicode normalization ──────────────────────────────────────
    private static normalize(word: string): string {
        return word
            .trim()
            .toUpperCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""); // strip diacritics
    }

    // ── Dictionary ────────────────────────────────────────────────
    private loadDictionary() {
        if (SigilBombRoom.dictionaryLoaded) return;
        try {
            const dofusPath = path.join(process.cwd(), "public/game-data/bomb-dictionary.json");
            const mixedPath = path.join(process.cwd(), "public/game-data/bomb-dictionary-mixed.json");
            
            if (fs.existsSync(dofusPath)) {
                const data = JSON.parse(fs.readFileSync(dofusPath, "utf-8"));
                SigilBombRoom.dictionaryDofus = (data.words || []).map((w: string) => SigilBombRoom.normalize(w));
                if (data.categories) {
                    SigilBombRoom.dictionaryCategories = data.categories;
                    
                    // ── Post-process categories (Fix Bosses miscategorized as Sorts) ──
                    const BOSS_KEYWORDS = [
                        "HAREBOURG", "KORRIANDRE", "MAITRECORBAC", "BWORKER", "MINOTOROR", 
                        "MINOTOT", "DRACOUSSAL", "TANTGUEUL", "GEANT", "KRALAMOURE",
                        "DAZAK", "CONTEUR", "KLIME", "NILEZA", "SYLARGH", "MISSIZ", "FRIZZ"
                    ];
                    
                    for (const [word, category] of Object.entries(SigilBombRoom.dictionaryCategories)) {
                        if (category === "Sort") {
                            const upperWord = word.toUpperCase();
                            if (BOSS_KEYWORDS.some(k => upperWord.includes(k))) {
                                SigilBombRoom.dictionaryCategories[word] = "Monstre (Boss)";
                            }
                        }
                    }
                }
            }
            if (fs.existsSync(mixedPath)) {
                const data = JSON.parse(fs.readFileSync(mixedPath, "utf-8"));
                SigilBombRoom.dictionaryMixed = (data.words || []).map((w: string) => SigilBombRoom.normalize(w));
            }
            
            SigilBombRoom.dictionaryLoaded = true;
            logger.info(`[SigilBomb] Dictionaries loaded: Dofus(${SigilBombRoom.dictionaryDofus.length}), Mixed(${SigilBombRoom.dictionaryMixed.length})`);
            
            // ── Deconstruct words for multi-word support ──
            this.buildDeconstructions();
        } catch (e) {
            logger.error("[SigilBomb] Failed to load dictionaries:", e as any);
        }
    }

    private buildDeconstructions() {
        const dofusWords = new Set(SigilBombRoom.dictionaryDofus);
        const allWords = new Set([...SigilBombRoom.dictionaryDofus, ...SigilBombRoom.dictionaryMixed]);
        
        // We focus on dofus words as they are the ones most likely to be "stuck" compounds
        const wordsToProcess = SigilBombRoom.dictionaryDofus.filter(w => w.length >= 7);

        logger.info(`[SigilBomb] Building deconstructions for ${wordsToProcess.length} words...`);
        let compoundCount = 0;

        for (const word of wordsToProcess) {
            const parts: string[] = [];
            let remaining = word;
            let possible = true;

            while (remaining.length > 0) {
                let found = false;
                // Try longest possible base word first (from current length down to 3)
                for (let len = Math.min(remaining.length, 12); len >= 3; len--) {
                    const sub = remaining.substring(0, len);
                    if (allWords.has(sub)) {
                        parts.push(sub);
                        remaining = remaining.substring(len);
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    // Try tiny common particles
                    const tinyWords = ["DE", "LE", "LA", "DU", "DES", "AU", "AUX", "EN"];
                    for (const tiny of tinyWords) {
                        if (remaining.startsWith(tiny)) {
                            parts.push(tiny);
                            remaining = remaining.substring(tiny.length);
                            found = true;
                            break;
                        }
                    }
                }

                if (!found) { possible = false; break; }
            }

            if (possible && parts.length >= 2) {
                SigilBombRoom.deconstructedWords.set(word, parts);
                compoundCount++;
            }
        }
        logger.info(`[SigilBomb] Deconstruction complete. Found ${compoundCount} compound words.`);
    }

    private getActiveDictionary(): string[] {
        if (this.config.dictionaryMode === "fr") {
            return SigilBombRoom.dictionaryMixed;
        } else if (this.config.dictionaryMode === "mixed") {
            return [...SigilBombRoom.dictionaryDofus, ...SigilBombRoom.dictionaryMixed];
        }
        return SigilBombRoom.dictionaryDofus;
    }

    // ── Join / Leave ──────────────────────────────────────────────
    public join(socket: Socket, playerObj: any) {
        const existing = this.players.find((p) => p.userId === playerObj.userId);
        if (existing) {
            // Reconnection — update socket id
            existing.id = socket.id;
            existing.isConnected = true;
            
            // CRITICAL FIX: If this user is the permanent host, update hostId to new socket
            if (existing.userId === this.hostUserId) {
                this.hostId = socket.id;
                logger.info(`[SigilBomb:${this.id}] Host ${existing.userName} reconnected with new socket.`);
            } else {
                logger.info(`[SigilBomb:${this.id}] ${existing.userName} reconnected.`);
            }
        } else {
            // Check capacity (8 participants max for circular UI logic)
            const participants = this.players.filter(p => !p.isSpectator).length;
            if (participants >= 8 && !playerObj.isSpectator) {
                socket.emit("bomb:word-error", { 
                    message: "La salle est complète (Maximum 8 joueurs)." 
                });
                return;
            }

            const isSpectator = this.state !== "LOBBY" || !!playerObj.isSpectator;
            const newPlayer: Player = {
                id: socket.id,
                userId: playerObj.userId,
                discordId: playerObj.discordId,
                userName: playerObj.userName,
                userAvatar: playerObj.userAvatar,
                lives: this.config.startingLives,
                isConnected: true,
                isSpectator,
                wordsFound: 0,
                alphabet: [],
                isReady: false,
                isBot: false,
            };
            this.players.push(newPlayer);
            if (!this.hostUserId && !isSpectator) {
                this.hostId = socket.id;
                this.hostUserId = playerObj.userId;
                newPlayer.isReady = true; // host auto-ready
                logger.info(`[SigilBomb:${this.id}] Initial host assigned: ${newPlayer.userName} (${newPlayer.userId})`);
            }
        }

        socket.join(this.id);
        this.syncState();
    }

    public leave(socketId: string) {
        const player = this.players.find((p) => p.id === socketId);
        if (player) {
            player.isConnected = false;
            if (this.state === "LOBBY") {
                this.players = this.players.filter((p) => p.id !== socketId);
            }
        }
        // Transfer host if current host socket leaves
        if (this.hostId === socketId) {
            // First try to find a player with the same userId (permanent host recovery)
            const permanentHost = this.players.find(p => p.userId === this.hostUserId && p.isConnected);
            if (permanentHost) {
                this.hostId = permanentHost.id;
                permanentHost.isReady = true;
            } else {
                // Otherwise find the next human player
                const next = this.players.find((p) => p.isConnected && !p.isSpectator && !p.isBot);
                if (next) {
                    this.hostId = next.id;
                    this.hostUserId = next.userId || null;
                    next.isReady = true;
                } else {
                    this.hostId = null;
                    this.hostUserId = null;
                }
            }
        }
        
        // If we are playing, check if enough players remain
        if (this.state === "PLAYING" || this.state === "STARTING") {
            const participants = this.players.filter((p) => !p.isSpectator);
            const connectedSurvivors = participants.filter((p) => p.lives > 0 && p.isConnected);
            
            // If it's a multiplayer game and 1 or 0 connected survivors remain
            if (participants.length > 1 && connectedSurvivors.length <= 1) {
                logger.info(`[SigilBomb:${this.id}] Game Ending due to disconnect. Survivors: ${connectedSurvivors.length}`);
                this.endGame();
                return; // endGame handles syncState
            }
            
            // If it was their turn, we need to skip them immediately so the timer doesn't stall
            if (this.state === "PLAYING" && this.currentTurnIndex >= 0) {
                const current = this.players[this.currentTurnIndex];
                if (current && current.id === socketId) {
                    this.stopTimer();
                    this.nextTurn();
                    return; // nextTurn handles syncState
                }
            }
        }

        this.syncState();
    }

    // ── Config & Ready ────────────────────────────────────────────
    public toggleReady(socketId: string) {
        const player = this.players.find((p) => p.id === socketId);
        if (player && this.state === "LOBBY" && !player.isSpectator) {
            // Host is always ready
            if (player.id === this.hostId) { player.isReady = true; }
            else { player.isReady = !player.isReady; }
            this.syncState();
        }
    }

    public updateConfig(socketId: string, cfg: Partial<RoomConfig>) {
        if (this.hostId !== socketId) return;
        this.config = { ...this.config, ...cfg };

        // Handle bot
        if (this.config.isSoloMode) {
            if (!this.players.some((p) => p.isBot)) {
                this.players.push({
                    id: "bot-" + Math.random().toString(36).substring(2, 7),
                    userId: "bot",
                    userName: "Robot Crâ-Mée",
                    userAvatar: "/assets/dofus/classes/9.png",
                    lives: this.config.startingLives,
                    isConnected: true,
                    isSpectator: false,
                    wordsFound: 0,
                    alphabet: [],
                    isReady: true,
                    isBot: true,
                });
            }
        } else {
            this.players = this.players.filter((p) => !p.isBot);
        }

        // Reset lives on config change (lobby only)
        if (this.state === "LOBBY") {
            this.players.forEach((p) => { p.lives = this.config.startingLives; });
        }
        this.syncState();

        // Auto-start in solo mode is now disabled to allow users to change settings in the lobby first.
        // The host must manually click "Lancer l'Épreuve".
    }

    // ── Start Game ────────────────────────────────────────────────
    public startGame(socketId: string) {
        if (this.hostId !== socketId) return;
        const participants = this.players.filter((p) => !p.isSpectator);
        const humanCount = participants.filter((p) => !p.isBot).length;

        // Block launch in solo mode if attempted without bot or less than 2 humans
        if (humanCount < 2 && !this.config.isSoloMode) {
            this.io.to(socketId).emit("bomb:word-error", {
                message: "Il faut au moins 2 joueurs (ou activer le mode Solo) !",
            });
            return;
        }

        const allReady = participants.every((p) => p.isReady || p.isBot);
        if (!allReady || participants.length === 0) {
            this.io.to(socketId).emit("bomb:word-error", {
                message: "Tous les joueurs doivent être prêts !",
            });
            return;
        }

        this.state = "STARTING";
        this.usedWordsInSession.clear();
        participants.forEach((p) => {
            p.lives = this.config.startingLives;
            p.wordsFound = 0;
            p.alphabet = [];
        });
        this.lastFoundWords = [];
        this.suddenDeathExchanges = 0;
        this.isSuddenDeath = false;
        this.suddenDeathWarned = false;

        // Pre-game countdown (3s)
        this.timeLeft = 3;
        this.syncState();
        // Son + affichage synchronisés : tick sonore dès le « 3 » (sinon 3 était muet
        // et le son était décalé sur 2 et 1 → désynchronisation ressentie).
        this.io.to(this.id).emit("bomb:tick", { timeLeft: 3 });

        this.stopTimer();
        this.tickInterval = setInterval(() => {
            this.timeLeft--;
            if (this.timeLeft <= 0) {
                this.stopTimer();
                this.state = "PLAYING";
                this.currentTurnIndex = this.players.findIndex((p) => !p.isSpectator && p.lives > 0);
                this.startNewTurn();
            } else {
                this.io.to(this.id).emit("bomb:tick", { timeLeft: this.timeLeft });
            }
        }, 1000);
    }

    // ── Turn Logic ────────────────────────────────────────────────
    private startNewTurn(isSuccess = false) {
        if (this.state !== "PLAYING") return;

        const { syllable, partCount, hintParts } = this.generateSyllableWithMetadata();
        this.currentSyllable = syllable;
        this.currentSyllablePartCount = partCount;
        this.currentSyllableHintParts = hintParts;
        
        // JKLM Logic: If it was a success, we might want to carry over time OR reset to max.
        // For now, we reset to max, but respect the minTurnDuration "bump" if we were to implement carry-over.
        // Standard behavior: Reset to turnTime.
        // Sudden Death Logic: If active, reduce time by 30%
        if (this.isSuddenDeath) {
            this.timeLeft = Math.max(3, Math.round(this.config.turnTime * 0.7));
        } else {
            this.timeLeft = this.config.turnTime;
        }
        
        // Clean typing for everyone on new turn
        this.io.to(this.id).emit("bomb:typing-reset");

        // 1. Start Clock (This cleans up previous intervals/timeouts)
        this.startTimer();

        // 2. Sync
        this.syncState();

        // 3. Bot logic (MUST BE AFTER startTimer to avoid immediate clearing)
        const currentPlayer = this.players[this.currentTurnIndex];
        if (currentPlayer?.isBot && currentPlayer.isConnected) {
            const delay = 1500 + Math.random() * 2500;
            if (this.botTimeout) clearTimeout(this.botTimeout);
            this.botTimeout = setTimeout(() => this.handleBotTurn(), delay);
        }
    }

    public handleTyping(socketId: string, text: string) {
        if (this.state !== "PLAYING") return;
        const player = this.players.find(p => p.id === socketId);
        if (!player || player.isSpectator || player.lives <= 0) return;

        // Broadcast typing to everyone else
        this.io.to(this.id).emit("bomb:typing-update", {
            playerId: socketId,
            text: text.substring(0, 30) // Limit length
        });
    }

    private handleBotTurn() {
        if (this.state !== "PLAYING") return;
        const current = this.players[this.currentTurnIndex];
        if (!current?.isBot) return;

        const syllable = SigilBombRoom.normalize(this.currentSyllable);
        const dict = this.getActiveDictionary();

        // 1. Filtrer les mots naturels (privilégier 5 à 10 lettres pour éviter les archaïsmes ultra courts comme BEER/GREER)
        const candidatesMedium = dict.filter(
            (w) => w.includes(syllable) && !this.usedWordsInSession.has(w) && w.length >= 5 && w.length <= 10
        );
        const naturalCandidates = candidatesMedium.length >= 3 
            ? candidatesMedium 
            : dict.filter((w) => w.includes(syllable) && !this.usedWordsInSession.has(w) && w.length >= 4 && w.length <= 12);

        const candidatePool = naturalCandidates.length > 0 ? naturalCandidates : dict.filter(
            (w) => w.includes(syllable) && !this.usedWordsInSession.has(w)
        );

        // 2. Probabilité de réussite humaine (88% de succès, 12% d'hésitation/échec)
        const willSucceed = candidatePool.length > 0 && Math.random() < 0.88;

        if (willSucceed) {
            // Préférer les mots du Lore Dofus ou les mots courants de taille idéale (5-9 lettres)
            const dofusSet = new Set(SigilBombRoom.dictionaryDofus);
            const dofusCandidates = candidatePool.filter(w => dofusSet.has(w));
            
            let selectedWord: string;
            if (dofusCandidates.length > 0 && Math.random() < 0.65) {
                // 65% de chance de sortir un mot typique Dofus si dispo
                selectedWord = dofusCandidates[Math.floor(Math.random() * dofusCandidates.length)];
            } else {
                // Sinon un mot courant de taille agréable
                const topSlice = candidatePool.slice(0, Math.min(25, candidatePool.length));
                selectedWord = topSlice[Math.floor(Math.random() * topSlice.length)];
            }

            const parts = SigilBombRoom.deconstructedWords.get(selectedWord);
            const wordToType = (parts && parts.length > 1) ? parts.join(" ") : selectedWord;

            // Simulation de frappe progressive lettre par lettre
            let currentText = "";
            const charSpeed = 80 + Math.floor(Math.random() * 60); // 80-140ms par lettre

            for (let i = 0; i < wordToType.length; i++) {
                const typingTimeout = setTimeout(() => {
                    if (this.state !== "PLAYING" || this.players[this.currentTurnIndex]?.id !== current.id) return;
                    currentText += wordToType[i];
                    this.handleTyping(current.id, currentText);
                }, (i + 1) * charSpeed);
                this.botTimeouts.push(typingTimeout);
            }

            // Soumission finale après une petite pause de validation
            const submitDelay = (wordToType.length + 1) * charSpeed + 200 + Math.floor(Math.random() * 200);
            const submitTimeout = setTimeout(() => {
                if (this.state !== "PLAYING" || this.players[this.currentTurnIndex]?.id !== current.id) return;
                this.submitWord(current.id, wordToType);
            }, submitDelay);
            this.botTimeouts.push(submitTimeout);
        } else {
            // Le bot hésite, tape un début puis n'arrive pas à finir à temps (explosion)
            if (candidatePool.length > 0 && Math.random() < 0.6) {
                const partial = candidatePool[0].substring(0, Math.max(1, Math.floor(candidatePool[0].length / 2)));
                let currentText = "";
                for (let i = 0; i < partial.length; i++) {
                    const timeout = setTimeout(() => {
                        if (this.state !== "PLAYING" || this.players[this.currentTurnIndex]?.id !== current.id) return;
                        currentText += partial[i];
                        this.handleTyping(current.id, currentText);
                    }, (i + 1) * 120);
                    this.botTimeouts.push(timeout);
                }
            }
        }
    }

    private generateSyllableWithMetadata(): { syllable: string; partCount: number; hintParts: string[] } {
        const dict = this.getActiveDictionary();
        this.currentSyllableCategory = null;

        if (!SigilBombRoom.dictionaryLoaded || dict.length === 0) {
            return { syllable: "RA", partCount: 1, hintParts: [] };
        }

        let syllable = "";
        let selectedWord = "";
        let attempts = 0;
        
        while (attempts < 100) {
            selectedWord = dict[Math.floor(Math.random() * dict.length)];
            if (selectedWord.length < 3) { attempts++; continue; }
            const len = Math.random() > 0.7 ? 3 : 2;
            const start = Math.floor(Math.random() * (selectedWord.length - len + 1));
            syllable = selectedWord.substring(start, start + len);
            
            if (syllable.length >= 2 && dict.some(w => w.includes(syllable))) {
                this.currentSyllableCategory = SigilBombRoom.dictionaryCategories[selectedWord] || null;
                if (!this.currentSyllableCategory && this.config.dictionaryMode === "dofus") {
                    this.currentSyllableCategory = "Lore Dofus";
                }
                break;
            }
            attempts++;
        }

        syllable = syllable || "RA";
        
        // Metadata
        const parts = SigilBombRoom.deconstructedWords.get(selectedWord) || [selectedWord];
        const partCount = parts.length;
        let hintParts: string[] = [];
        
        if (partCount > 1) {
            // Pick 2 random parts as hints
            const indices = Array.from({ length: partCount }, (_, i) => i);
            const shuffled = indices.sort(() => 0.5 - Math.random());
            const selectedIndices = shuffled.slice(0, 2).sort((a,b) => a - b);
            
            hintParts = parts.map((p, i) => selectedIndices.includes(i) ? p : "");
        }

        return { syllable, partCount, hintParts };
    }

    // ── Timer ─────────────────────────────────────────────────────
    private startTimer() {
        this.stopTimer();
        this.tickInterval = setInterval(() => {
            this.timeLeft--;
            // Emit a lightweight tick (not full sync) so the client timer updates every second
            this.io.to(this.id).emit("bomb:tick", { timeLeft: this.timeLeft });
            if (this.timeLeft <= 0) this.handleExplosion();
        }, 1000);
    }

    private stopTimer() {
        if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
        this.clearBotTimeouts();
    }

    // ── Explosion ─────────────────────────────────────────────────
    private handleExplosion() {
        this.stopTimer();
        const current = this.players[this.currentTurnIndex];
        const syllable = SigilBombRoom.normalize(this.currentSyllable);

        // Find a valid hint word that wasn't used yet
        const dict = this.getActiveDictionary();
        let hintWord = dict.find(
            (w) => w.includes(syllable) && !this.usedWordsInSession.has(w)
        ) || null;

        // Decouple hint word if compound
        if (hintWord) {
            const parts = SigilBombRoom.deconstructedWords.get(hintWord);
            if (parts) {
                hintWord = parts.join(" ");
            }
        }

        if (current && !current.isSpectator && current.lives > 0) {
            current.lives--;
            this.io.to(this.id).emit("bomb:explosion", {
                playerId: current.id,
                playerName: current.userName,
                lives: current.lives,
                syllable: this.currentSyllable,
                hintWord, // Word they could have said
            });
        }

        const participants = this.players.filter((p) => !p.isSpectator);
        const survivors = participants.filter((p) => p.lives > 0);

        // Win Condition: 
        // 1. More than one player started, but only 1 (or 0) remains.
        // 2. Or no one remains.
        const shouldEnd = (participants.length > 1 && survivors.length <= 1) || (survivors.length === 0);

        if (shouldEnd) {
            logger.info(`[SigilBomb:${this.id}] Ending game (Survivors: ${survivors.length})`);
            this.endGame();
        } else {
            this.nextTurn();
        }
    }

    private nextTurn() {
        let idx = (this.currentTurnIndex + 1) % this.players.length;
        for (let i = 0; i < this.players.length; i++) {
            const p = this.players[idx];
            if (p && !p.isSpectator && p.lives > 0 && p.isConnected) {
                this.currentTurnIndex = idx;
                this.startNewTurn();
                return;
            }
            idx = (idx + 1) % this.players.length;
        }
        this.endGame();
    }

    // ── Submit Word ───────────────────────────────────────────────
    public submitWord(socketId: string, word: string) {
        if (this.state !== "PLAYING") return;
        const current = this.players[this.currentTurnIndex];
        if (!current || current.id !== socketId || current.lives <= 0) return;

        // Normalize and remove internal spaces for dictionary check
        let normalizedWord = SigilBombRoom.normalize(word);
        const glueWord = normalizedWord.replace(/\s+/g, "");
        const normalizedSyllable = SigilBombRoom.normalize(this.currentSyllable);

        // 1. Must contain syllable
        if (!normalizedWord.includes(normalizedSyllable)) {
            this.io.to(socketId).emit("bomb:word-error", {
                message: `Le mot doit contenir "${this.currentSyllable}" !`,
            });
            return;
        }

        // 2. Must not have been used already
        if (this.usedWordsInSession.has(glueWord)) {
            this.io.to(socketId).emit("bomb:word-error", { message: "Déjà utilisé !" });
            return;
        }

        // 3. Must be in dictionary or whitelist
        const dict = this.getActiveDictionary();
        const isValid = dict.includes(glueWord) || ALWAYS_VALID.has(glueWord);
        if (!isValid) {
            const message = this.config.dictionaryMode === "dofus"
                ? "Ce mot n'existe pas dans le monde des Douze !"
                : "Mot inconnu au dictionnaire !";
            this.io.to(socketId).emit("bomb:word-error", { message });
            return;
        }

        // ── SUCCESS ──
        this.usedWordsInSession.add(glueWord);
        current.wordsFound++;

        // Obtenir la version affichable avec espaces si mot composé
        const parts = SigilBombRoom.deconstructedWords.get(glueWord);
        const displayWord = (parts && parts.length > 1) ? parts.join(" ") : (word.trim().toUpperCase() || glueWord);

        // Add to history
        this.lastFoundWords.unshift({ 
            word: displayWord, 
            playerName: current.userName, 
            playerId: current.id,
            isBot: !!current.isBot
        });
        if (this.lastFoundWords.length > 5) this.lastFoundWords.pop();

        // Track alphabet
        for (const char of glueWord) {
            if (char >= "A" && char <= "Z" && !current.alphabet.includes(char)) {
                current.alphabet.push(char);
            }
        }
        // Bonus life on full alphabet
        if (current.alphabet.length === 26) {
            current.lives++;
            current.alphabet = [];
            this.io.to(this.id).emit("bomb:bonus-life", { playerId: current.id });
        }

        this.io.to(this.id).emit("bomb:word-success", {
            word: displayWord,
            playerId: current.id,
        });

        // ── SUDDEN DEATH TRACKING ──
        const survivors = this.players.filter(p => !p.isSpectator && p.lives > 0);
        if (survivors.length === 2 && this.config.suddenDeathEnabled) {
            this.suddenDeathExchanges++;
            // Avertissement en amont : quelques échanges avant d'activer la mort subite.
            if (!this.isSuddenDeath && !this.suddenDeathWarned
                && this.suddenDeathExchanges >= Math.max(1, this.config.suddenDeathExchanges - 3)) {
                this.suddenDeathWarned = true;
                const exchangesLeft = Math.max(1, this.config.suddenDeathExchanges - this.suddenDeathExchanges);
                this.io.to(this.id).emit("bomb:sudden-death-soon", {
                    exchangesLeft,
                    reductionPercent: 30,
                });
            }
            if (this.suddenDeathExchanges >= this.config.suddenDeathExchanges && !this.isSuddenDeath) {
                this.isSuddenDeath = true;
                this.io.to(this.id).emit("bomb:sudden-death", {
                    reductionPercent: 30,
                    newTime: Math.max(3, Math.round(this.config.turnTime * 0.7))
                });
                logger.info(`[SigilBomb:${this.id}] SUDDEN DEATH ACTIVATED`);
            }
        }

        // Safety bump: If we had a carry-over system, we'd use minTurnDuration here.
        // Since we reset to full, we just go to next turn.
        this.stopTimer();
        this.nextTurn();
    }

    // ── End Game ─────────────────────────────────────────────────
    private endGame() {
        try {
            this.state = "GAME_END";
            this.stopTimer();

            const participants = this.players.filter((p) => !p.isSpectator);
            const connectedSurvivors = participants.filter((p) => p.lives > 0 && p.isConnected);
            
            // Winner is the last connected survivor, or the person with most words if everyone died/disconnected
            const winner = connectedSurvivors[0] || [...participants].sort((a, b) => {
                if (a.isConnected !== b.isConnected) return a.isConnected ? -1 : 1;
                return b.wordsFound - a.wordsFound;
            })[0];

            // Full leaderboard sorted by rank (wordsFound desc)
            const leaderboard = [...participants]
                .sort((a, b) => (b.wordsFound - a.wordsFound))
                .map((p, i) => ({
                    rank: i + 1,
                    id: p.id,
                    name: p.userName,
                    avatar: p.userAvatar,
                    wordsFound: p.wordsFound,
                    lives: p.lives,
                    isBot: p.isBot,
                }));

            logger.info(`[SigilBomb:${this.id}] Game Ended. Winner: ${winner?.userName || 'None'}`);

            // ── Persist scores to DB (fire-and-forget, don't block the game loop) ──
            const guildId = this.guildId;
            const humanPlayers = participants.filter(p => !p.isBot && p.userId && p.userId !== 'bot');
            if (humanPlayers.length > 0) {
                Promise.all(humanPlayers.map(async (p) => {
                    const score = p.wordsFound;
                    const userId = p.userId!;
                    try {
                        const rank = await db.bombRank.upsert({
                            where: { guildId_userId: { guildId, userId } },
                            create: {
                                guildId,
                                userId,
                                userName: p.userName,
                                userAvatar: p.userAvatar,
                                bestScore: score,
                                totalPoints: score,
                                gamesPlayed: 1,
                            },
                            update: {
                                totalPoints: { increment: score },
                                gamesPlayed: { increment: 1 },
                                userName: p.userName,
                                userAvatar: p.userAvatar,
                            },
                        });
                        if (score > rank.bestScore) {
                            await db.bombRank.update({
                                where: { id: rank.id },
                                data: { bestScore: score },
                            });
                        }
                        await db.bombScore.create({
                            data: { guildId, userId, userName: p.userName, userAvatar: p.userAvatar, score },
                        });
                    } catch (dbErr) {
                        logger.error(`[SigilBomb:${this.id}] Failed to save score for ${p.userName}:`, dbErr as any);
                    }
                })).catch(err => logger.error(`[SigilBomb:${this.id}] Score persistence error:`, err));
            }

            // Emit explicit event then sync full state
            this.io.to(this.id).emit("bomb:game-end", {
                winnerId: winner?.id,
                winnerName: winner?.userName,
                winnerAvatar: winner?.userAvatar,
                wordsFound: winner?.wordsFound,
                leaderboard,
            });

            this.syncState();
        } catch (error) {
            logger.error(`[SigilBomb:${this.id}] Error in endGame:`, error as any);
            // Emergency fallback to Lobby to avoid bricking the room
            this.resetToLobby();
        }
    }

    // ── Restart ───────────────────────────────────────────────────
    public resetToLobby() {
        this.stopTimer();
        this.state = "LOBBY";
        this.currentSyllable = "";
        this.currentSyllableCategory = null;
        this.currentTurnIndex = 0;
        this.timeLeft = 0;
        this.usedWordsInSession.clear();
        // Keep connected players, reset stats
        this.players = this.players.filter((p) => p.isConnected || p.isBot);
        this.players.forEach((p) => {
            p.lives = this.config.startingLives;
            p.wordsFound = 0;
            p.isReady = p.isBot || p.id === this.hostId;
        });
        // Reassign host if needed
        if (!this.players.find((p) => p.id === this.hostId && p.isConnected)) {
            const next = this.players.find((p) => p.isConnected && !p.isBot);
            if (next) { 
                this.hostId = next.id; 
                this.hostUserId = next.userId || null;
                next.isReady = true; 
            }
        }
        this.syncState();
    }

    // ── State Sync ────────────────────────────────────────────────
    public syncState() {
        this.io.to(this.id).emit("bomb:sync", {
            id: this.id,
            state: this.state,
            players: this.players,
            hostId: this.hostId,
            config: this.config,
            currentSyllable: this.currentSyllable,
            currentSyllableCategory: this.currentSyllableCategory,
            currentSyllablePartCount: this.currentSyllablePartCount,
            currentSyllableHintParts: this.currentSyllableHintParts,
            currentTurnIndex: this.currentTurnIndex,
            timeLeft: this.timeLeft,
            lastFoundWords: this.lastFoundWords,
            isSuddenDeath: this.isSuddenDeath,
        });
    }

    // ── Public Getters ────────────────────────────────────────────
    public getPublicInfo() {
        const host = this.players.find((p) => p.id === this.hostId);
        return {
            roomId: this.id,
            playerCount: this.players.length,
            state: this.state,
            hostName: host?.userName || "Inconnu",
        };
    }

    public getPlayers() { return this.players; }
    public getState()   { return this.state;   }
}
