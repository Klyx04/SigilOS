export type GamePhase =
    | "LOBBY"
    | "STARTING"
    | "BRIEFING"
    | "WRITING"
    | "DRAWING"
    | "GUESSING"
    | "INTERMISSION"
    | "REVEAL"
    | "SCORES";

export type GameMode =
    | "NORMAL"
    | "CADAVRE_EXQUIS"
    | "HISTOIRE"
    | "IMITATION"
    | "ANIMATION"
    | "COMPLEMENT"
    | "CHEF_OEUVRE";

export type WordCategory = string;

export type DrawTool =
    | "pencil"
    | "eraser"
    | "rect-outline"
    | "rect-fill"
    | "circle-outline"
    | "circle-fill"
    | "bucket"
    | "bezier"
    | "paint-bucket";

export interface StrokeData {
    x0: number; // normalisé 0-1
    y0: number; // normalisé 0-1
    x1: number; // normalisé 0-1
    y1: number; // normalisé 0-1
    color: string;
    size: number;
    tool: DrawTool;
    opacity: number;
}

export interface PublicPlayer {
    id: string;
    username: string;
    dofusClass: string;
    isReady: boolean;
    score: number;
    isDrawing?: boolean;
    isHost?: boolean;
    userAvatar?: string;
    isSpectator?: boolean;
}

export interface AlbumEntry {
    authorId: string;
    author: {
        username: string;
    };
    type: "drawing" | "text";
    content: string; // base64 pour drawing, texte pour text
    round: number;
}

export interface Album {
    ownerId: string;
    owner: {
        username: string;
    };
    entries: AlbumEntry[];
}

export interface ChatMessage {
    type: "correct" | "guess" | "chat";
    content: string;
    isCorrect?: boolean;
    isMe?: boolean;
}

// --- LOBBY ---
export interface JoinRoomEvent {
    event: "gartic:room:join";
    roomId: string;
}
export interface CreateRoomEvent {
    event: "gartic:room:create";
    config: {
        maxPlayers: number;
        maxRounds: number;
        drawTime: number;
        mode: GameMode;
        wordCategories: WordCategory[];
    };
}
export interface ReadyEvent { event: "gartic:player:ready" }
export interface StartGameEvent { event: "gartic:game:start" }

// --- DRAWING ---
export interface DrawStrokeEvent {
    event: "gartic:draw:stroke";
    stroke: StrokeData;
}
export interface DrawClearEvent { event: "gartic:draw:clear" }
export interface DrawUndoEvent { event: "gartic:draw:undo" }
export interface DrawDoneEvent {
    event: "gartic:draw:done";
    drawing: string;
}

// --- GUESSING ---
export interface SubmitGuessEvent {
    event: "gartic:guess:submit";
    text: string;
}

// --- CHAT ---
export interface ChatMessageEvent {
    event: "gartic:chat:message";
    content: string;
}

// --- STATE ---
export interface StateUpdateEvent {
    event: "gartic:state:update";
    state: {
        phase: GamePhase;
        players: PublicPlayer[];
        currentRound: number;
        maxRounds: number;
        drawerName: string;
        timer: number;
        scores: Record<string, number>;
    };
}

// --- DRAWING ---
export interface BroadcastStrokeEvent {
    event: "gartic:draw:stroke";
    stroke: StrokeData;
}
export interface DrawHistoryEvent {
    event: "gartic:draw:history";
    strokes: StrokeData[];
}

// --- WORD ---
export interface WordRevealEvent {
    event: "gartic:word:reveal";
    word: string;
}
export interface WordHintEvent {
    event: "gartic:word:hint";
    category: string;
    length: number;
    hint?: string;
}

// --- GUESS ---
export interface GuessCorrectEvent {
    event: "gartic:guess:correct";
    playerId: string;
    username: string;
    points: number;
    timeBonus: number;
}

// --- REVEAL ---
export interface AlbumRevealEvent {
    event: "gartic:album:reveal";
    albums: Album[];
}

// --- CHAT ---
export interface ChatBroadcastEvent {
    event: "gartic:chat:broadcast";
    playerId: string;
    username: string;
    content: string;
    isCorrect?: boolean;
}
