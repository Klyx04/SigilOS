# 🎨 Sigil Gartic — Documentation Complète
> Version Dofus de Gartic Phone intégrée au dashboard SigilOS  
> Stack : Next.js · TypeScript · Socket.io · Prisma · Tailwind CSS

---

## Table des matières

1. [Vue d'ensemble & Flow de jeu](#1-vue-densemble--flow-de-jeu)
2. [Architecture Backend](#2-architecture-backend)
3. [Machine à états (FSM)](#3-machine-à-états-fsm)
4. [Socket.io — Protocole complet](#4-socketio--protocole-complet)
5. [Gestion des Rooms](#5-gestion-des-rooms)
6. [Canvas & Synchronisation temps-réel](#6-canvas--synchronisation-temps-réel)
7. [Modes de jeu](#7-modes-de-jeu)
8. [Base de données (Prisma)](#8-base-de-données-prisma)
9. [UI/UX — Reproduction fidèle Gartic Phone](#9-uiux--reproduction-fidèle-gartic-phone)
10. [Composants React détaillés](#10-composants-react-détaillés)
11. [Banque de mots Dofus](#11-banque-de-mots-dofus)
12. [Sécurité & Anti-triche](#12-sécurité--anti-triche)
13. [Performance & Optimisation](#13-performance--optimisation)
14. [Structure de fichiers](#14-structure-de-fichiers)

---

## 1. Vue d'ensemble & Flow de jeu

### Cycle complet d'une partie (mode Normal)

```
LOBBY → [BRIEFING → DRAWING → GUESSING]×N → REVEAL → SCORES → LOBBY
          └──────────── 1 round ──────────┘
```

### Phases détaillées

| Phase | Durée | Qui fait quoi |
|-------|-------|---------------|
| `LOBBY` | ∞ | Host configure, joueurs rejoignent |
| `BRIEFING` | 3s | Tout le monde voit le mot (drawer seulement) |
| `DRAWING` | 60–120s | Drawer dessine, autres voient en live |
| `GUESSING` | 45s | Drawer regarde, autres écrivent leur réponse |
| `INTERMISSION` | 5s | Animation transition |
| `REVEAL` | ∞ | Parcours de l'album de chaque joueur |
| `SCORES` | 10s | Tableau final |

---

## 2. Architecture Backend

### Structure serveur

```
server/
├── index.ts                    # Entry point Express + Socket.io
├── games/
│   └── SigilGartic/
│       ├── GameManager.ts      # Singleton — gère toutes les rooms
│       ├── Room.ts             # Instance d'une partie
│       ├── Player.ts           # Modèle joueur
│       ├── StateMachine.ts     # FSM XState
│       ├── Timer.ts            # Gestion timers serveur-side
│       ├── WordBank.ts         # Banque de mots Dofus
│       └── modes/
│           ├── NormalMode.ts
│           ├── CadavreExquisMode.ts
│           └── HistoireMode.ts
├── middleware/
│   └── socketAuth.ts           # Vérification JWT SigilOS
└── utils/
    └── logger.ts
```

### Entry point Socket.io

```typescript
// server/index.ts
import { createServer } from "http";
import { Server } from "socket.io";
import express from "express";
import { GameManager } from "./games/SigilGartic/GameManager";
import { socketAuthMiddleware } from "./middleware/socketAuth";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  transports: ["websocket", "polling"],
  pingInterval: 10000,
  pingTimeout: 5000,
});

const gameManager = new GameManager(io);

io.use(socketAuthMiddleware); // Vérifie le JWT SigilOS

io.on("connection", (socket) => {
  console.log(`[Gartic] ${socket.data.user.username} connecté`);
  gameManager.registerSocket(socket);

  socket.on("disconnect", (reason) => {
    gameManager.handleDisconnect(socket, reason);
  });
});

httpServer.listen(3001);
```

### Middleware Auth (réutilise le JWT SigilOS)

```typescript
// server/middleware/socketAuth.ts
import jwt from "jsonwebtoken";
import type { ExtendedError } from "socket.io/dist/namespace";

export const socketAuthMiddleware = (socket: any, next: (err?: ExtendedError) => void) => {
  const token = socket.handshake.auth.token;

  if (!token) return next(new Error("AUTH_REQUIRED"));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    socket.data.user = payload;
    next();
  } catch {
    next(new Error("AUTH_INVALID"));
  }
};
```

---

## 3. Machine à états (FSM)

### XState v5 — Definition complète

```typescript
// server/games/SigilGartic/StateMachine.ts
import { createMachine, assign, fromPromise } from "xstate";

export type GamePhase =
  | "LOBBY"
  | "BRIEFING"
  | "DRAWING"
  | "GUESSING"
  | "INTERMISSION"
  | "REVEAL"
  | "SCORES";

export interface GameContext {
  roomId: string;
  players: Map<string, Player>;
  currentRound: number;
  maxRounds: number;
  currentDrawerIndex: number;
  currentWord: DofusWord | null;
  submissions: Map<string, Submission>; // playerId → { drawing | text }
  scores: Map<string, number>;
  timer: number;
  mode: GameMode;
  album: AlbumEntry[][];  // [joueur][round] = { type, content, authorId }
}

export const garticMachine = createMachine({
  id: "sigilGartic",
  initial: "LOBBY",
  context: ({ input }: { input: Partial<GameContext> }) => ({
    roomId: input.roomId ?? "",
    players: new Map(),
    currentRound: 0,
    maxRounds: input.maxRounds ?? 3,
    currentDrawerIndex: 0,
    currentWord: null,
    submissions: new Map(),
    scores: new Map(),
    timer: 0,
    mode: input.mode ?? "NORMAL",
    album: [],
  }),
  states: {
    LOBBY: {
      on: {
        START_GAME: {
          target: "BRIEFING",
          guard: ({ context }) => context.players.size >= 2,
          actions: assign({ currentRound: 0 }),
        },
      },
    },
    BRIEFING: {
      entry: assign(({ context }) => ({
        currentWord: pickWord(context.currentRound, context.mode),
        submissions: new Map(),
        timer: 3,
      })),
      after: { 3000: "DRAWING" },
    },
    DRAWING: {
      entry: assign(({ context }) => ({
        timer: context.mode === "NORMAL" ? 60 : 120,
      })),
      on: {
        DRAWING_DONE: {
          target: "GUESSING",
          guard: ({ context, event }) =>
            event.playerId === getCurrentDrawer(context),
        },
        TIMER_END: "GUESSING",
      },
      after: { 
        // Durée dynamique selon mode
        DRAW_TIMEOUT: "GUESSING" 
      },
    },
    GUESSING: {
      entry: assign({ timer: 45 }),
      on: {
        SUBMIT_GUESS: {
          actions: assign(({ context, event }) => {
            context.submissions.set(event.playerId, {
              type: "text",
              content: event.guess,
              timestamp: Date.now(),
            });
            return {};
          }),
        },
        ALL_SUBMITTED: "INTERMISSION",
        TIMER_END: "INTERMISSION",
      },
    },
    INTERMISSION: {
      entry: assign(({ context }) => ({
        scores: computeScores(context),
        album: updateAlbum(context),
      })),
      after: {
        5000: [
          {
            target: "BRIEFING",
            guard: ({ context }) =>
              context.currentRound < context.maxRounds - 1,
            actions: assign(({ context }) => ({
              currentRound: context.currentRound + 1,
              currentDrawerIndex:
                (context.currentDrawerIndex + 1) % context.players.size,
            })),
          },
          { target: "REVEAL" },
        ],
      },
    },
    REVEAL: {
      on: {
        NEXT_PLAYER_ALBUM: {
          // Navigation dans les albums
        },
        END_REVEAL: "SCORES",
      },
    },
    SCORES: {
      after: { 10000: "LOBBY" },
      on: { PLAY_AGAIN: "LOBBY" },
    },
  },
});
```

---

## 4. Socket.io — Protocole complet

### Events Client → Serveur

```typescript
// types/socket-events.ts

// --- LOBBY ---
interface JoinRoomEvent {
  event: "gartic:room:join";
  roomId: string;
}
interface CreateRoomEvent {
  event: "gartic:room:create";
  config: {
    maxPlayers: number;
    maxRounds: number;
    drawTime: number;
    mode: GameMode;
    wordCategories: WordCategory[];
  };
}
interface ReadyEvent { event: "gartic:player:ready" }
interface StartGameEvent { event: "gartic:game:start" }  // host only

// --- DRAWING ---
interface DrawStrokeEvent {
  event: "gartic:draw:stroke";
  stroke: {
    x0: number; y0: number;   // normalisé 0-1
    x1: number; y1: number;   // normalisé 0-1
    color: string;
    size: number;
    tool: DrawTool;
    opacity: number;
  };
}
interface DrawClearEvent { event: "gartic:draw:clear" }
interface DrawUndoEvent { event: "gartic:draw:undo" }
interface DrawDoneEvent { event: "gartic:draw:done" }

// --- GUESSING ---
interface SubmitGuessEvent {
  event: "gartic:guess:submit";
  text: string;
}

// --- CHAT ---
interface ChatMessageEvent {
  event: "gartic:chat:message";
  content: string;
}
```

### Events Serveur → Client

```typescript
// --- STATE ---
interface StateUpdateEvent {
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
interface BroadcastStrokeEvent {
  event: "gartic:draw:stroke";
  stroke: StrokeData;
}
interface DrawHistoryEvent {
  event: "gartic:draw:history";  // pour late-join
  strokes: StrokeData[];
}

// --- WORD ---
interface WordRevealEvent {
  event: "gartic:word:reveal";
  word: string;            // seulement au drawer
}
interface WordHintEvent {
  event: "gartic:word:hint";
  category: string;        // à tous sauf drawer
  length: number;
  hint?: string;           // "_o_f__" révélé progressivement
}

// --- GUESS ---
interface GuessCorrectEvent {
  event: "gartic:guess:correct";
  playerId: string;
  username: string;
  points: number;
  timeBonus: number;
}

// --- REVEAL ---
interface AlbumRevealEvent {
  event: "gartic:album:reveal";
  albums: Album[];
}

// --- CHAT ---
interface ChatBroadcastEvent {
  event: "gartic:chat:broadcast";
  playerId: string;
  username: string;
  content: string;
  isCorrect?: boolean;  // si c'est la bonne réponse
}
```

### Handler complet Room

```typescript
// server/games/SigilGartic/Room.ts
export class GarticRoom {
  private state: GameContext;
  private machine: Actor<typeof garticMachine>;
  private io: Server;
  private strokeHistory: StrokeData[] = [];
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: Server, config: RoomConfig) {
    this.io = io;
    this.machine = createActor(garticMachine, {
      input: { roomId: config.id, ...config },
    });
    this.machine.start();
    this.machine.subscribe(this.onStateChange.bind(this));
  }

  private onStateChange(snapshot: Snapshot<GameContext>) {
    const phase = snapshot.value as GamePhase;

    // Broadcast le nouveau state à tous dans la room
    this.io.to(this.state.roomId).emit("gartic:state:update", {
      phase,
      players: Array.from(this.state.players.values()).map(sanitizePlayer),
      currentRound: snapshot.context.currentRound,
      maxRounds: snapshot.context.maxRounds,
      drawerName: getCurrentDrawerName(snapshot.context),
      timer: snapshot.context.timer,
      scores: Object.fromEntries(snapshot.context.scores),
    });

    // Actions spécifiques par phase
    switch (phase) {
      case "BRIEFING":
        this.handleBriefing(snapshot.context);
        break;
      case "DRAWING":
        this.strokeHistory = []; // reset canvas
        this.startCountdown(snapshot.context.timer, "DRAWING");
        break;
      case "GUESSING":
        this.startCountdown(45, "GUESSING");
        break;
      case "REVEAL":
        this.sendAlbums(snapshot.context);
        break;
    }
  }

  private handleBriefing(ctx: GameContext) {
    const drawerId = getCurrentDrawer(ctx);

    // Le drawer reçoit le mot complet
    this.io.to(drawerId).emit("gartic:word:reveal", {
      word: ctx.currentWord!.label,
    });

    // Les autres reçoivent seulement un indice
    this.io.to(this.state.roomId).except(drawerId).emit("gartic:word:hint", {
      category: ctx.currentWord!.category,
      length: ctx.currentWord!.label.length,
    });

    // Révélation progressive après 30s
    setTimeout(() => {
      const hint = generateHint(ctx.currentWord!.label, 0.3); // révèle 30%
      this.io.to(this.state.roomId).except(drawerId).emit("gartic:word:hint", {
        category: ctx.currentWord!.category,
        length: ctx.currentWord!.label.length,
        hint,
      });
    }, 30000);
  }

  handleStroke(socket: Socket, stroke: StrokeData) {
    const ctx = this.machine.getSnapshot().context;

    // Guard : seul le drawer peut envoyer des strokes
    if (socket.id !== getCurrentDrawer(ctx)) return;
    // Guard : seulement en phase DRAWING
    if (this.machine.getSnapshot().value !== "DRAWING") return;

    this.strokeHistory.push(stroke);
    socket.to(this.state.roomId).emit("gartic:draw:stroke", stroke);
  }

  handleGuess(socket: Socket, text: string) {
    const ctx = this.machine.getSnapshot().context;
    if (this.machine.getSnapshot().value !== "GUESSING") return;
    if (socket.id === getCurrentDrawer(ctx)) return;

    this.machine.send({ type: "SUBMIT_GUESS", playerId: socket.id, guess: text });

    // Check si tous ont soumis
    if (ctx.submissions.size >= ctx.players.size - 1) {
      this.machine.send({ type: "ALL_SUBMITTED" });
    }
  }

  handleLateJoin(socket: Socket) {
    // Envoie l'historique du canvas au joueur qui rejoint en retard
    if (this.strokeHistory.length > 0) {
      socket.emit("gartic:draw:history", this.strokeHistory);
    }
    socket.emit("gartic:state:update", /* current state */);
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
        this.machine.send({ type: "TIMER_END" });
      }
    }, 1000);

    this.timers.set(key, interval);
  }
}
```

---

## 5. Gestion des Rooms

```typescript
// server/games/SigilGartic/GameManager.ts
export class GameManager {
  private rooms = new Map<string, GarticRoom>();
  private socketToRoom = new Map<string, string>(); // socketId → roomId

  constructor(private io: Server) {}

  registerSocket(socket: Socket) {
    socket.on("gartic:room:create", (config) => this.createRoom(socket, config));
    socket.on("gartic:room:join", ({ roomId }) => this.joinRoom(socket, roomId));
    socket.on("gartic:game:start", () => this.startGame(socket));
    socket.on("gartic:draw:stroke", (stroke) => this.relayStroke(socket, stroke));
    socket.on("gartic:draw:clear", () => this.relayAction(socket, "clear"));
    socket.on("gartic:draw:undo", () => this.relayAction(socket, "undo"));
    socket.on("gartic:draw:done", () => this.relayDone(socket));
    socket.on("gartic:guess:submit", ({ text }) => this.handleGuess(socket, text));
    socket.on("gartic:chat:message", ({ content }) => this.relayChat(socket, content));
  }

  private createRoom(socket: Socket, config: RoomConfig): void {
    const roomId = generateShortId(); // ex: "DOFUS-7X3K"
    const room = new GarticRoom(this.io, { ...config, id: roomId });
    this.rooms.set(roomId, room);

    socket.join(roomId);
    this.socketToRoom.set(socket.id, roomId);
    room.addPlayer(socket);

    socket.emit("gartic:room:created", { roomId });
  }

  handleDisconnect(socket: Socket, reason: string) {
    const roomId = this.socketToRoom.get(socket.id);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) return;

    room.handlePlayerDisconnect(socket.id, reason);
    this.socketToRoom.delete(socket.id);

    // Nettoyer la room si vide
    if (room.isEmpty()) {
      room.destroy();
      this.rooms.delete(roomId);
    }
  }
}
```

---

## 6. Canvas & Synchronisation temps-réel

### Outils disponibles (comme Gartic Phone)

```typescript
type DrawTool =
  | "pencil"       // ✏️ tracé libre
  | "eraser"       // 🧹 gomme
  | "rect-outline" // ▭ rectangle vide
  | "rect-fill"    // ▬ rectangle plein
  | "circle-outline" // ○ cercle vide
  | "circle-fill"  // ● cercle plein
  | "bucket"       // 🪣 remplissage (flood fill)
  | "bezier"       // ↗ ligne droite
  | "paint-bucket"; // pot de peinture
```

### Hook Canvas principal

```typescript
// hooks/useGarticCanvas.ts
import { useRef, useCallback, useEffect, useState } from "react";
import { throttle } from "lodash-es";

interface UseGarticCanvasOptions {
  isDrawer: boolean;
  socket: Socket;
  roomId: string;
}

export const useGarticCanvas = ({ isDrawer, socket, roomId }: UseGarticCanvasOptions) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null); // pour le preview des formes
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);

  const [tool, setTool] = useState<DrawTool>("pencil");
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(3);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Initialisation du canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.imageSmoothingEnabled = true;
    ctxRef.current = ctx;

    // Fond blanc
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    saveToHistory();
  }, []);

  const getRelativePos = useCallback((e: PointerEvent | MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const drawStroke = useCallback((stroke: StrokeData) => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const x0 = stroke.x0 * canvas.width;
    const y0 = stroke.y0 * canvas.height;
    const x1 = stroke.x1 * canvas.width;
    const y1 = stroke.y1 * canvas.height;

    ctx.globalAlpha = stroke.opacity ?? 1;
    ctx.strokeStyle = stroke.tool === "eraser" ? "#FFFFFF" : stroke.color;
    ctx.lineWidth = stroke.size;

    switch (stroke.tool) {
      case "pencil":
      case "eraser":
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        break;

      case "rect-outline":
        ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        break;

      case "rect-fill":
        ctx.fillStyle = stroke.color;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        break;

      case "circle-outline":
        ctx.beginPath();
        ctx.ellipse(
          (x0 + x1) / 2, (y0 + y1) / 2,
          Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2,
          0, 0, Math.PI * 2
        );
        ctx.stroke();
        break;

      case "circle-fill":
        ctx.beginPath();
        ctx.fillStyle = stroke.color;
        ctx.ellipse(
          (x0 + x1) / 2, (y0 + y1) / 2,
          Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2,
          0, 0, Math.PI * 2
        );
        ctx.fill();
        break;

      case "bezier":
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        break;

      case "bucket":
        floodFill(ctx, canvas, Math.round(x0), Math.round(y0), stroke.color);
        break;
    }

    ctx.globalAlpha = 1;
  }, []);

  // Flood fill (algo BFS)
  const floodFill = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    startX: number,
    startY: number,
    fillColor: string
  ) => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const targetColor = getPixelColor(data, startX, startY, canvas.width);
    const fill = hexToRgb(fillColor);

    if (!fill || colorsMatch(targetColor, fill)) return;

    const stack = [[startX, startY]];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;

      const current = getPixelColor(data, x, y, canvas.width);
      if (!colorsMatch(current, targetColor)) continue;

      visited.add(key);
      setPixelColor(data, x, y, canvas.width, fill);

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    // Limite l'historique à 20 étapes
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    historyIndexRef.current = historyRef.current.length - 1;

    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    ctxRef.current!.putImageData(historyRef.current[historyIndexRef.current], 0, 0);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
    socket.emit("gartic:draw:undo");
  }, [socket]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    ctxRef.current!.putImageData(historyRef.current[historyIndexRef.current], 0, 0);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
    socket.emit("gartic:draw:clear");
  }, [socket, saveToHistory]);

  // Event handlers pointer
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isDrawer) return;
    isDrawingRef.current = true;
    const pos = getRelativePos(e.nativeEvent);
    lastPointRef.current = pos;

    if (tool === "bucket") {
      const stroke: StrokeData = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y, color, size: brushSize, tool, opacity: 1 };
      drawStroke(stroke);
      socket.emit("gartic:draw:stroke", stroke);
      saveToHistory();
    }
  }, [isDrawer, tool, color, brushSize, drawStroke, saveToHistory]);

  const handlePointerMove = useCallback(throttle((e: React.PointerEvent) => {
    if (!isDrawer || !isDrawingRef.current) return;
    if (tool === "bucket") return;

    const pos = getRelativePos(e.nativeEvent);
    const last = lastPointRef.current ?? pos;

    const stroke: StrokeData = {
      x0: last.x, y0: last.y,
      x1: pos.x, y1: pos.y,
      color, size: brushSize, tool,
      opacity: tool === "eraser" ? 1 : 0.9,
    };

    // Draw local sans attendre le serveur (pas de latence)
    if (["pencil", "eraser"].includes(tool)) {
      drawStroke(stroke);
      lastPointRef.current = pos;
    }

    socket.emit("gartic:draw:stroke", stroke);
  }, 16), [isDrawer, tool, color, brushSize, drawStroke]); // throttle à 60fps

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    saveToHistory();
  }, [saveToHistory]);

  // Réception des events socket
  useEffect(() => {
    socket.on("gartic:draw:stroke", drawStroke);
    socket.on("gartic:draw:clear", () => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
    socket.on("gartic:draw:history", (history: StrokeData[]) => {
      history.forEach(drawStroke);
    });

    return () => {
      socket.off("gartic:draw:stroke");
      socket.off("gartic:draw:clear");
      socket.off("gartic:draw:history");
    };
  }, [socket, drawStroke]);

  return {
    canvasRef,
    overlayRef,
    tool, setTool,
    color, setColor,
    brushSize, setBrushSize,
    canUndo, canRedo,
    undo, redo, clear,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
  };
};
```

---

## 7. Modes de jeu

### Interface modes

```typescript
type GameMode =
  | "NORMAL"         // Classique : dessin → devinette → dessin...
  | "CADAVRE_EXQUIS" // Chaque joueur voit seulement la devinette précédente
  | "HISTOIRE"       // Construire une histoire collective
  | "IMITATION"      // Reproduire un dessin référence
  | "ANIMATION"      // Plusieurs frames pour animer
  | "COMPLEMENT"     // Compléter un dessin partiel
  | "CHEF_OEUVRE";   // Temps illimité, vote final

// Mode NORMAL (implémenté en priorité)
export class NormalMode implements IGameMode {
  readonly id = "NORMAL";
  readonly drawTime = 60;
  readonly guessTime = 45;
  readonly roundsPerPlayer = 1; // chaque joueur dessine une fois

  getNextPhase(current: GamePhase, ctx: GameContext): GamePhase {
    switch (current) {
      case "DRAWING": return "GUESSING";
      case "GUESSING":
        return ctx.currentRound < ctx.maxRounds - 1 ? "BRIEFING" : "REVEAL";
      default: return "LOBBY";
    }
  }

  computeScores(ctx: GameContext): Map<string, number> {
    const scores = new Map(ctx.scores);

    ctx.submissions.forEach((submission, playerId) => {
      if (submission.type !== "text") return;
      const isCorrect =
        submission.content.toLowerCase().trim() ===
        ctx.currentWord!.label.toLowerCase().trim();

      if (isCorrect) {
        const timeBonus = Math.floor(submission.timeRemainingRatio * 50); // max 50 pts bonus
        const points = 100 + timeBonus;
        scores.set(playerId, (scores.get(playerId) ?? 0) + points);

        // Le drawer gagne aussi des points si quelqu'un devine
        const drawerId = getCurrentDrawer(ctx);
        scores.set(drawerId, (scores.get(drawerId) ?? 0) + 25);
      }
    });

    return scores;
  }
}
```

---

## 8. Base de données (Prisma)

```prisma
// schema.prisma

model GarticRoom {
  id          String   @id @default(cuid())
  guildId     String
  guild       Guild    @relation(fields: [guildId], references: [id])
  hostId      String
  mode        String   @default("NORMAL")
  maxPlayers  Int      @default(8)
  maxRounds   Int      @default(3)
  drawTime    Int      @default(60)
  status      String   @default("WAITING") // WAITING | PLAYING | FINISHED
  createdAt   DateTime @default(now())
  finishedAt  DateTime?

  sessions    GarticSession[]
  albums      GarticAlbum[]
}

model GarticSession {
  id        String   @id @default(cuid())
  roomId    String
  room      GarticRoom @relation(fields: [roomId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  score     Int      @default(0)
  rank      Int?
  joinedAt  DateTime @default(now())
}

model GarticAlbum {
  id        String   @id @default(cuid())
  roomId    String
  room      GarticRoom @relation(fields: [roomId], references: [id])
  ownerId   String   // joueur propriétaire de cet album
  entries   GarticAlbumEntry[]
}

model GarticAlbumEntry {
  id        String   @id @default(cuid())
  albumId   String
  album     GarticAlbum @relation(fields: [albumId], references: [id])
  authorId  String
  type      String   // "drawing" | "text"
  content   String   // base64 pour drawing, texte pour text
  round     Int
  createdAt DateTime @default(now())
}

// Stats globales par joueur
model GarticPlayerStats {
  id              String @id @default(cuid())
  userId          String @unique
  user            User   @relation(fields: [userId], references: [id])
  totalGames      Int    @default(0)
  totalWins       Int    @default(0)
  totalPoints     Int    @default(0)
  correctGuesses  Int    @default(0)
  drawingsCreated Int    @default(0)
}
```

---

## 9. UI/UX — Reproduction fidèle Gartic Phone

### Palette de couleurs exacte

```css
/* Inspiré des screenshots Gartic Phone */
:root {
  /* Backgrounds par phase */
  --gartic-bg-lobby:    #2d1b69;   /* violet foncé */
  --gartic-bg-drawing:  #c0392b;   /* rouge vif */
  --gartic-bg-guessing: #e67e22;   /* orange */
  --gartic-bg-reveal:   #1a6fb5;   /* bleu */
  --gartic-bg-scores:   #1a6fb5;

  /* Accents */
  --gartic-accent-green:  #2ecc71;
  --gartic-accent-yellow: #f1c40f;
  --gartic-accent-pink:   #e91e8c;

  /* Canvas */
  --gartic-canvas-bg:   #ffffff;
  --gartic-canvas-border: #b0b0c0;

  /* UI elements */
  --gartic-card-bg:     rgba(255,255,255,0.15);
  --gartic-card-border: rgba(255,255,255,0.3);

  /* Timer ring */
  --gartic-timer-full:  #2ecc71;
  --gartic-timer-half:  #f39c12;
  --gartic-timer-low:   #e74c3c;
}
```

### Tailwind config custom

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        gartic: {
          lobby: "#2d1b69",
          drawing: "#c0392b",
          guessing: "#e67e22",
          reveal: "#1a6fb5",
          green: "#2ecc71",
          yellow: "#f1c40f",
          pink: "#e91e8c",
        },
      },
      fontFamily: {
        gartic: ["Fredoka One", "Nunito", "sans-serif"],
      },
      animation: {
        "bounce-in": "bounceIn 0.5s cubic-bezier(0.68,-0.55,0.265,1.55)",
        "slide-up": "slideUp 0.3s ease-out",
        "timer-pulse": "timerPulse 1s ease-in-out infinite",
        "correct-flash": "correctFlash 0.5s ease-in-out",
        "page-flip": "pageFlip 0.6s ease-in-out",
      },
      keyframes: {
        bounceIn: {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        timerPulse: {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.1)" },
        },
        correctFlash: {
          "0%": { backgroundColor: "transparent" },
          "50%": { backgroundColor: "rgba(46,204,113,0.4)" },
          "100%": { backgroundColor: "transparent" },
        },
        pageFlip: {
          "0%": { transform: "perspective(600px) rotateY(-90deg)", opacity: "0" },
          "100%": { transform: "perspective(600px) rotateY(0deg)", opacity: "1" },
        },
      },
    },
  },
};
```

---

## 10. Composants React détaillés

### Page Layout principale (adapte la couleur selon la phase)

```tsx
// components/gartic/GarticLayout.tsx
export const GarticLayout = ({ phase, children }: { phase: GamePhase; children: React.ReactNode }) => {
  const bgMap: Record<GamePhase, string> = {
    LOBBY: "from-[#2d1b69] to-[#4a2d9e]",
    BRIEFING: "from-[#c0392b] to-[#e74c3c]",
    DRAWING: "from-[#c0392b] to-[#e74c3c]",
    GUESSING: "from-[#e67e22] to-[#f39c12]",
    INTERMISSION: "from-[#8e44ad] to-[#9b59b6]",
    REVEAL: "from-[#1a6fb5] to-[#2980b9]",
    SCORES: "from-[#1a6fb5] to-[#2980b9]",
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bgMap[phase]} transition-all duration-700 font-gartic`}>
      {/* Étoiles décoratives comme Gartic Phone */}
      <GarticStarDecorations />
      <div className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  );
};
```

### Page Lobby

```tsx
// components/gartic/LobbyScreen.tsx
export const LobbyScreen = ({ room, onStart, onInvite }: LobbyScreenProps) => {
  return (
    <div className="grid grid-cols-3 gap-6 mt-8">
      {/* Colonne gauche : Joueurs */}
      <div className="col-span-1">
        <h2 className="text-gartic-yellow text-2xl font-bold tracking-wider mb-4 text-center">
          JOUEURS {room.players.length}/{room.maxPlayers}
        </h2>
        <div className="space-y-2">
          {room.players.map((player, i) => (
            <PlayerSlot key={player.id} player={player} index={i} />
          ))}
          {/* Slots vides */}
          {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
            <EmptySlot key={i} />
          ))}
        </div>
      </div>

      {/* Colonne droite : Préréglages */}
      <div className="col-span-2">
        <div className="flex gap-4 mb-4">
          <TabButton active={true}>PRÉRÉGLAGES</TabButton>
          <TabButton active={false}>PERSONNALISATIONS</TabButton>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {GAME_MODES.map((mode) => (
            <ModeCard
              key={mode.id}
              mode={mode}
              selected={room.mode === mode.id}
              onClick={() => onSelectMode(mode.id)}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button onClick={onInvite} className="flex-1 gartic-btn-secondary">
            <LinkIcon className="w-5 h-5 mr-2" />
            INVITER
          </button>
          <button onClick={onStart} className="flex-1 gartic-btn-primary">
            <PlayIcon className="w-5 h-5 mr-2" />
            DÉMARRER
          </button>
        </div>
      </div>
    </div>
  );
};

// Slot joueur avec avatar Dofus
const PlayerSlot = ({ player, index }: { player: Player; index: number }) => (
  <div className={cn(
    "flex items-center gap-3 px-4 py-3 rounded-xl",
    "bg-white/20 border border-white/30",
    index === 0 && "border-gartic-yellow bg-white/30", // host highlight
    "animate-slide-up"
  )}>
    <DofusAvatar classId={player.dofusClass} size={40} />
    <span className="text-white font-bold flex-1">{player.username}</span>
    {index === 0 && <CrownIcon className="text-gartic-yellow w-5 h-5" />}
    {player.isReady && <CheckCircleIcon className="text-gartic-green w-5 h-5" />}
  </div>
);
```

### Phase Dessin — Reproduction exacte Gartic Phone

```tsx
// components/gartic/DrawingScreen.tsx
export const DrawingScreen = ({ isDrawer, word, socket, roomId }: DrawingScreenProps) => {
  const canvas = useGarticCanvas({ isDrawer, socket, roomId });

  const DOFUS_COLORS = [
    // Ligne 1
    "#1a1a1a", "#6c6c6c", "#4169e1",
    // Ligne 2
    "#ffffff", "#a0a0a0", "#00bfff",
    // Ligne 3
    "#228b22", "#8b0000", "#8b4513",
    // Ligne 4
    "#32cd32", "#ff0000", "#ff8c00",
    // Ligne 5
    "#daa520", "#8b008b", "#d2691e",
    // Ligne 6
    "#ffd700", "#ff69b4", "#ffc0cb",
    // Remplissage large
    "#000000",
  ];

  const BRUSH_SIZES = [2, 4, 8, 14, 22]; // comme Gartic Phone

  return (
    <div className="flex gap-4 items-start">
      {/* Palette gauche */}
      <div className="flex flex-col gap-2 bg-white/10 p-3 rounded-2xl border border-white/20">
        {/* Grille de couleurs 3 colonnes */}
        <div className="grid grid-cols-3 gap-1.5">
          {DOFUS_COLORS.slice(0, -1).map((c) => (
            <ColorSwatch
              key={c}
              color={c}
              selected={canvas.color === c}
              onClick={() => canvas.setColor(c)}
            />
          ))}
        </div>
        {/* Couleur noire large */}
        <button
          onClick={() => canvas.setColor("#000000")}
          className={cn(
            "w-full h-10 rounded-lg border-2 transition-all",
            canvas.color === "#000000" ? "border-white scale-105" : "border-transparent"
          )}
          style={{ backgroundColor: "#000000" }}
        />
        {/* Indicateur couleur courante */}
        <div className="w-full h-8 rounded-lg border-2 border-white/50" style={{ backgroundColor: canvas.color }} />
      </div>

      {/* Zone centrale : Canvas + Header */}
      <div className="flex-1 flex flex-col gap-0">
        {/* Header canvas (ruban violet) */}
        <div className="bg-[#3d2080] rounded-t-2xl px-6 py-3 flex items-center justify-between">
          <button className="text-white/60 hover:text-white transition">
            <DownloadIcon className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full" /> {/* Phone deco gauche */}
            <h2 className="text-white text-xl font-bold tracking-widest">
              {isDrawer ? `HÉ, C'EST L'HEURE DU DESSIN !` : `QUE DESSINE ${drawerName.toUpperCase()} ?`}
            </h2>
            <div className="w-10 h-10 bg-white/20 rounded-full" /> {/* Phone deco droite */}
          </div>
          <VolumeIcon className="text-white/60 w-6 h-6" />
        </div>

        {/* Canvas principal */}
        <div className="relative border-4 border-[#b0b0c0] bg-white" style={{ aspectRatio: "4/3" }}>
          <canvas
            ref={canvas.canvasRef}
            width={800}
            height={600}
            className="w-full h-full"
            style={{ cursor: isDrawer ? getCursor(canvas.tool) : "default", touchAction: "none" }}
            {...(isDrawer ? canvas.handlers : {})}
          />
          {/* Overlay canvas pour preview formes */}
          <canvas
            ref={canvas.overlayRef}
            width={800}
            height={600}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
          {/* Hint mot (pour les non-drawers) */}
          {!isDrawer && wordHint && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full font-mono text-xl tracking-[0.5em]">
              {wordHint}
            </div>
          )}
        </div>

        {/* Barre de taille + timer en bas */}
        <div className="bg-[#3d2080] rounded-b-2xl px-6 py-3 flex items-center gap-4">
          {/* Tailles de brosse */}
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => canvas.setBrushSize(size)}
              className={cn(
                "rounded-full bg-white transition-all",
                canvas.brushSize === size ? "border-2 border-gartic-yellow" : "opacity-70"
              )}
              style={{ width: size + 8, height: size + 8 }}
            />
          ))}

          {/* Slider opacité */}
          <input type="range" min="0" max="100" className="flex-1 gartic-slider" />

          {/* Taille preview */}
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
            <div className="rounded-full bg-black" style={{ width: canvas.brushSize, height: canvas.brushSize }} />
          </div>
        </div>
      </div>

      {/* Outils droite */}
      <div className="flex flex-col gap-2 bg-white/10 p-3 rounded-2xl border border-white/20">
        <ToolButton icon="pencil" tool="pencil" current={canvas.tool} onClick={canvas.setTool} />
        <ToolButton icon="eraser" tool="eraser" current={canvas.tool} onClick={canvas.setTool} />
        <Divider />
        <ToolButton icon="rect-outline" tool="rect-outline" current={canvas.tool} onClick={canvas.setTool} />
        <ToolButton icon="circle-outline" tool="circle-outline" current={canvas.tool} onClick={canvas.setTool} />
        <ToolButton icon="rect-fill" tool="rect-fill" current={canvas.tool} onClick={canvas.setTool} />
        <ToolButton icon="circle-fill" tool="circle-fill" current={canvas.tool} onClick={canvas.setTool} />
        <Divider />
        <ToolButton icon="bezier" tool="bezier" current={canvas.tool} onClick={canvas.setTool} />
        <ToolButton icon="bucket" tool="bucket" current={canvas.tool} onClick={canvas.setTool} />
        <Divider />
        <ActionButton icon="undo" onClick={canvas.undo} disabled={!canvas.canUndo} />
        <ActionButton icon="redo" onClick={canvas.redo} disabled={!canvas.canRedo} />
      </div>
    </div>
  );
};
```

### Timer circulaire (comme Gartic Phone)

```tsx
// components/gartic/CircularTimer.tsx
export const CircularTimer = ({ remaining, total }: { remaining: number; total: number }) => {
  const ratio = remaining / total;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - ratio);

  const color = ratio > 0.5 ? "#2ecc71" : ratio > 0.25 ? "#f39c12" : "#e74c3c";
  const isUrgent = remaining <= 10;

  return (
    <div className={cn("relative w-20 h-20", isUrgent && "animate-timer-pulse")}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
        {/* Progress */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("text-2xl font-bold text-white", isUrgent && "text-red-300")}>
          {remaining}
        </span>
      </div>
    </div>
  );
};
```

### Phase Devinette

```tsx
// components/gartic/GuessingScreen.tsx
export const GuessingScreen = ({ isDrawer, wordHint, onSubmit, socket }: GuessingScreenProps) => {
  const [guess, setGuess] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    socket.on("gartic:chat:broadcast", (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });
    socket.on("gartic:guess:correct", ({ username, points }) => {
      setMessages(prev => [...prev, {
        type: "correct",
        content: `✅ ${username} a trouvé ! (+${points} pts)`,
        isCorrect: true,
      }]);
    });
  }, []);

  const handleSubmit = () => {
    if (!guess.trim() || submitted) return;
    onSubmit(guess);
    setSubmitted(true);

    // Affiche dans le chat local
    setMessages(prev => [...prev, { type: "guess", content: guess, isMe: true }]);
    setGuess("");
  };

  if (isDrawer) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="text-6xl animate-bounce">🎨</div>
        <p className="text-white text-2xl font-bold">Les autres devinent ton dessin !</p>
        <div className="text-gartic-yellow text-3xl font-bold">
          {/* Le drawer voit son mot */}
          {currentWord}
        </div>
        <ChatBox messages={messages} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      {/* Mascotte Gartic-style (à adapter avec mascotte Dofus) */}
      <DofusMascot className="w-48 animate-bounce-in" />

      <h2 className="text-gartic-yellow text-3xl font-bold tracking-widest animate-bounce">
        ÉCRIS UNE RÉPONSE
      </h2>

      {/* Hint du mot */}
      {wordHint && (
        <div className="text-white/60 text-lg font-mono tracking-[0.3em]">
          {wordHint} · {wordCategory}
        </div>
      )}

      <div className="flex gap-3 w-full max-w-lg">
        <input
          ref={inputRef}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={submitted ? "Réponse envoyée !" : "Dofus ocre sur un tofu..."}
          disabled={submitted}
          className={cn(
            "flex-1 px-6 py-4 rounded-2xl text-xl font-bold",
            "bg-white/90 text-gray-800 placeholder:text-gray-400",
            "border-4 border-white focus:border-gartic-yellow outline-none",
            "transition-all duration-200",
            submitted && "opacity-60"
          )}
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={submitted || !guess.trim()}
          className={cn(
            "px-6 py-4 rounded-2xl font-bold text-white text-lg",
            "bg-gartic-green hover:bg-green-400 active:scale-95",
            "border-4 border-green-700",
            "transition-all duration-150 flex items-center gap-2",
            (submitted || !guess.trim()) && "opacity-50 cursor-not-allowed"
          )}
        >
          <CheckIcon className="w-6 h-6" />
          TERMINÉ !
        </button>
      </div>

      {/* Chat messages */}
      <div className="w-full max-w-lg space-y-1 max-h-40 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={cn(
            "px-3 py-1 rounded-lg text-sm",
            msg.isCorrect ? "bg-gartic-green/30 text-white font-bold" : "bg-white/10 text-white/80",
            msg.isMe && "text-right"
          )}>
            {msg.content}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### Phase Reveal — Album style Gartic Phone

```tsx
// components/gartic/RevealScreen.tsx
export const RevealScreen = ({ albums, currentPlayerIndex, onNext }: RevealScreenProps) => {
  const album = albums[currentPlayerIndex];
  const [currentEntryIndex, setCurrentEntryIndex] = useState(0);

  return (
    <div className="grid grid-cols-4 gap-6">
      {/* Liste joueurs gauche */}
      <div className="col-span-1">
        <h2 className="text-gartic-green text-xl font-bold mb-4 text-center">JOUEURS</h2>
        {albums.map((a, i) => (
          <PlayerRevealSlot
            key={a.ownerId}
            player={a.owner}
            active={i === currentPlayerIndex}
            completed={i < currentPlayerIndex}
          />
        ))}
      </div>

      {/* Album central */}
      <div className="col-span-3">
        <h2 className="text-gartic-yellow text-3xl font-bold text-center mb-6">
          ALBUM DE {album.owner.username.toUpperCase()}
        </h2>

        <div className="space-y-4">
          {album.entries.map((entry, i) => (
            <AlbumEntry
              key={i}
              entry={entry}
              visible={i <= currentEntryIndex}
              onVisible={() => setCurrentEntryIndex(Math.max(currentEntryIndex, i + 1))}
            />
          ))}
        </div>

        {currentEntryIndex >= album.entries.length - 1 && (
          <div className="text-center mt-6">
            <div className="text-white/60 text-sm mb-4">
              FIN DE L'ALBUM DE {album.owner.username.toUpperCase()}
            </div>
            <button onClick={onNext} className="gartic-btn-primary px-8">
              {currentPlayerIndex < albums.length - 1 ? "ALBUM SUIVANT →" : "SCORES FINAUX"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AlbumEntry = ({ entry, visible }: { entry: AlbumEntry; visible: boolean }) => {
  if (!visible) return null;

  return (
    <div className={cn(
      "bg-white/10 border border-white/20 rounded-2xl p-4",
      "flex gap-4 items-start",
      "animate-page-flip"
    )}>
      <DofusAvatar userId={entry.authorId} size={48} />
      <div className="flex-1">
        <div className="text-white/60 text-sm mb-2">{entry.author.username}</div>
        {entry.type === "drawing" ? (
          <img
            src={entry.content}  // base64 PNG
            alt="dessin"
            className="rounded-xl border-2 border-white/20 max-h-64 w-full object-contain bg-white"
          />
        ) : (
          <div className="bg-white/90 text-gray-800 px-6 py-4 rounded-xl text-xl font-bold">
            {entry.content}
          </div>
        )}
      </div>
    </div>
  );
};
```

### Sauvegarde du dessin final en PNG

```typescript
// utils/canvas.ts
export const canvasToBase64 = (canvas: HTMLCanvasElement): string => {
  return canvas.toDataURL("image/png", 0.8);
};

// Appel quand le timer DRAWING se termine
const saveDrawing = async () => {
  const canvas = canvasRef.current!;
  const base64 = canvasToBase64(canvas);
  socket.emit("gartic:draw:done", { drawing: base64 });
};
```

---

## 11. Banque de mots Dofus

```typescript
// data/dofusWords.ts
export interface DofusWord {
  id: string;
  label: string;
  category: WordCategory;
  difficulty: 1 | 2 | 3;
  emoji?: string;
}

export type WordCategory =
  | "monstre"
  | "boss"
  | "classe"
  | "sort"
  | "item"
  | "lieu"
  | "pnj"
  | "familier"
  | "monture";

export const DOFUS_WORDS: DofusWord[] = [
  // Monstres faciles
  { id: "bouftou", label: "Bouftou", category: "monstre", difficulty: 1, emoji: "🐑" },
  { id: "tofu", label: "Tofu", category: "monstre", difficulty: 1 },
  { id: "prespic", label: "Prespic", category: "monstre", difficulty: 1 },
  { id: "crabe", label: "Crabe Royal", category: "monstre", difficulty: 1 },
  { id: "larve_bleue", label: "Larve Bleue", category: "monstre", difficulty: 1 },
  { id: "moskito", label: "Moskito", category: "monstre", difficulty: 1 },
  { id: "sanglier", label: "Sanglier des plaines", category: "monstre", difficulty: 1 },

  // Monstres moyens
  { id: "bwork", label: "Bwork Mage", category: "monstre", difficulty: 2 },
  { id: "gelée", label: "Gelée Bleue", category: "monstre", difficulty: 2 },
  { id: "chafer", label: "Chafer Lancier", category: "monstre", difficulty: 2 },
  { id: "trool", label: "Trool", category: "monstre", difficulty: 2 },

  // Boss
  { id: "count", label: "Count Harebourg", category: "boss", difficulty: 3 },
  { id: "nidas", label: "Roi Nidas", category: "boss", difficulty: 2 },
  { id: "dragon_cochon", label: "Dragon Cochon", category: "boss", difficulty: 2 },
  { id: "ougah", label: "Ougah", category: "boss", difficulty: 3 },
  { id: "julith", label: "Julith", category: "boss", difficulty: 3 },

  // Classes
  { id: "iop", label: "Iop", category: "classe", difficulty: 1, emoji: "⚔️" },
  { id: "cra", label: "Crâ", category: "classe", difficulty: 1 },
  { id: "eniripsa", label: "Eniripsa", category: "classe", difficulty: 1 },
  { id: "xelor", label: "Xélor", category: "classe", difficulty: 1 },
  { id: "sadida", label: "Sadida", category: "classe", difficulty: 1 },
  { id: "sacrieur", label: "Sacrieur", category: "classe", difficulty: 1 },
  { id: "feca", label: "Féca", category: "classe", difficulty: 1 },
  { id: "osamodas", label: "Osamodas", category: "classe", difficulty: 1 },
  { id: "pandawa", label: "Pandawa", category: "classe", difficulty: 1 },
  { id: "ecaflip", label: "Ecaflip", category: "classe", difficulty: 1 },
  { id: "sram", label: "Sram", category: "classe", difficulty: 1 },
  { id: "masqueraider", label: "Masqueraider", category: "classe", difficulty: 2 },
  { id: "eliotrope", label: "Eliotrope", category: "classe", difficulty: 2 },
  { id: "huppermage", label: "Huppermage", category: "classe", difficulty: 2 },
  { id: "ouginak", label: "Ouginak", category: "classe", difficulty: 1 },

  // Items iconiques
  { id: "dofus_pourpre", label: "Dofus Pourpre", category: "item", difficulty: 1, emoji: "🥚" },
  { id: "dofus_turquoise", label: "Dofus Turquoise", category: "item", difficulty: 1 },
  { id: "dofus_ocre", label: "Dofus Ocre", category: "item", difficulty: 1 },
  { id: "dofus_ebene", label: "Dofus Ébène", category: "item", difficulty: 2 },
  { id: "gelano", label: "Gelano", category: "item", difficulty: 2 },
  { id: "bouclier_des_paladins", label: "Bouclier des Paladins", category: "item", difficulty: 3 },

  // Lieux
  { id: "astrub", label: "Astrub", category: "lieu", difficulty: 1 },
  { id: "amakna", label: "Amakna", category: "lieu", difficulty: 1 },
  { id: "brakmar", label: "Brakmar", category: "lieu", difficulty: 1 },
  { id: "bonta", label: "Bonta", category: "lieu", difficulty: 1 },
  { id: "frigost", label: "Frigost", category: "lieu", difficulty: 2 },
  { id: "pandala", label: "Pandala", category: "lieu", difficulty: 2 },
  { id: "incarnam", label: "Incarnam", category: "lieu", difficulty: 1 },

  // PNJ & Familiers
  { id: "ankama", label: "Ankama", category: "pnj", difficulty: 2 },
  { id: "atcham_jumo", label: "Atcham & Jumo", category: "pnj", difficulty: 3 },
  { id: "mini_tofu", label: "Mini Tofu", category: "familier", difficulty: 1 },
  { id: "mulou", label: "Mulou", category: "familier", difficulty: 2 },
];

// Sélection intelligente selon le round
export const pickWords = (
  round: number,
  mode: GameMode,
  categories: WordCategory[],
  count: number = 3 // proposer 3 mots, le joueur choisit
): DofusWord[] => {
  const maxDiff = Math.min(3, 1 + Math.floor(round / 2)) as 1 | 2 | 3;
  const pool = DOFUS_WORDS.filter(
    (w) => w.difficulty <= maxDiff && categories.includes(w.category)
  );

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
};
```

---

## 12. Sécurité & Anti-triche

```typescript
// Règles de validation serveur (JAMAIS faire confiance au client)

class SecurityGuard {
  // 1. Rate limiting des strokes (max 60/s par connexion)
  private strokeCounts = new Map<string, number>();

  validateStroke(socketId: string, stroke: StrokeData): boolean {
    // Guard 1 : coords dans les limites [0, 1]
    if (stroke.x0 < 0 || stroke.x0 > 1 || stroke.y0 < 0 || stroke.y0 > 1) return false;
    if (stroke.x1 < 0 || stroke.x1 > 1 || stroke.y1 < 0 || stroke.y1 > 1) return false;

    // Guard 2 : couleur valide (hex)
    if (!/^#[0-9a-f]{6}$/i.test(stroke.color)) return false;

    // Guard 3 : taille de brosse raisonnable
    if (stroke.size < 1 || stroke.size > 50) return false;

    // Guard 4 : rate limit
    const count = this.strokeCounts.get(socketId) ?? 0;
    if (count > 60) return false; // trop de strokes par seconde

    return true;
  }

  // 2. Validation des devinettes
  validateGuess(text: string): string {
    return text
      .slice(0, 100)        // max 100 chars
      .replace(/<[^>]*>/g, "") // strip HTML
      .trim();
  }

  // 3. Vérification que le joueur est dans la room
  validatePlayerInRoom(socketId: string, roomId: string): boolean {
    return this.socketToRoom.get(socketId) === roomId;
  }

  // 4. Vérification que c'est bien le bon drawer
  validateIsDrawer(socketId: string, ctx: GameContext): boolean {
    return socketId === getCurrentDrawer(ctx);
  }
}
```

---

## 13. Performance & Optimisation

### Optimisations Canvas

```typescript
// 1. Double buffering
const offscreenCanvas = new OffscreenCanvas(800, 600);
const offscreenCtx = offscreenCanvas.getContext("2d")!;

// 2. RequestAnimationFrame pour le rendu
const renderLoop = () => {
  if (pendingStrokes.length > 0) {
    pendingStrokes.forEach(drawStroke);
    pendingStrokes = [];
  }
  requestAnimationFrame(renderLoop);
};

// 3. Compression des strokes (delta encoding)
interface DeltaStroke {
  dx: number;  // delta vs dernier point (int8, ±127)
  dy: number;
  flags: number; // color_changed | size_changed | tool_changed
  // color/size/tool seulement si flags le signalent
}

// 4. Batch de strokes (envoyer par paquet)
const BATCH_INTERVAL = 50; // ms
let strokeBatch: StrokeData[] = [];

const flushStrokes = () => {
  if (strokeBatch.length === 0) return;
  socket.emit("gartic:draw:strokes_batch", strokeBatch);
  strokeBatch = [];
};

setInterval(flushStrokes, BATCH_INTERVAL);

// 5. Canvas résolution adaptée (devicePixelRatio)
const setupHiDPI = (canvas: HTMLCanvasElement) => {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
};
```

### Optimisations Socket.io

```typescript
// Compression des messages
const io = new Server(httpServer, {
  perMessageDeflate: {
    threshold: 512,  // compresser > 512 bytes
    zlibDeflateOptions: { chunkSize: 1024, level: 1 },
  },
  maxHttpBufferSize: 1e6, // max 1MB (pour les images de dessin)
});

// Rooms Redis pour le scaling horizontal
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

---

## 14. Structure de fichiers

```
src/
├── app/
│   └── (dashboard)/
│       └── [guildId]/
│           └── mini-jeux/
│               └── gartic/
│                   ├── page.tsx              # Lobby / sélection salon
│                   └── [roomId]/
│                       └── page.tsx          # Jeu en cours
│
├── components/
│   └── gartic/
│       ├── GarticLayout.tsx                  # Layout animé par phase
│       ├── GarticStarDecorations.tsx         # Étoiles décoratives
│       ├── LobbyScreen.tsx                   # Écran lobby
│       ├── BriefingScreen.tsx                # Transition + mot
│       ├── DrawingScreen.tsx                 # Phase dessin
│       ├── GuessingScreen.tsx                # Phase devinette
│       ├── IntermissionScreen.tsx            # Entre les rounds
│       ├── RevealScreen.tsx                  # Album reveal
│       ├── ScoresScreen.tsx                  # Scores finaux
│       ├── CircularTimer.tsx                 # Timer SVG
│       ├── ColorPalette.tsx                  # Palette couleurs
│       ├── ToolPanel.tsx                     # Outils dessin
│       ├── ChatBox.tsx                       # Chat en jeu
│       ├── PlayerSlot.tsx                    # Slot joueur lobby
│       ├── ModeCard.tsx                      # Carte mode de jeu
│       └── AlbumEntry.tsx                    # Entrée album
│
├── hooks/
│   ├── useGarticSocket.ts                    # Connection + events socket
│   ├── useGarticCanvas.ts                    # Logique canvas
│   └── useGarticTimer.ts                     # Countdown local
│
├── stores/
│   └── garticStore.ts                        # Zustand store état du jeu
│
├── data/
│   └── dofusWords.ts                         # Banque de mots
│
├── types/
│   └── gartic.ts                             # Types partagés
│
└── server/
    └── games/
        └── SigilGartic/
            ├── GameManager.ts
            ├── Room.ts
            ├── StateMachine.ts
            ├── Timer.ts
            ├── WordBank.ts
            ├── SecurityGuard.ts
            └── modes/
                ├── NormalMode.ts
                ├── CadavreExquisMode.ts
                └── HistoireMode.ts
```

---

## Checklist d'implémentation

### Priorité 1 — MVP
- [ ] Setup Socket.io + rooms basiques
- [ ] FSM 4 états : LOBBY → DRAWING → GUESSING → REVEAL
- [ ] Canvas basique : pencil + eraser + palette
- [ ] Synchronisation strokes temps-réel
- [ ] Timer serveur-side
- [ ] Phase reveal simple (afficher le dessin + la réponse)
- [ ] Sauvegarde base64 du dessin

### Priorité 2 — Feature complete
- [ ] Tous les outils canvas (formes, bucket fill, bézier)
- [ ] Undo/Redo
- [ ] Hint progressif du mot
- [ ] Scores basés sur la vitesse
- [ ] Album interactif reveal (page par page)
- [ ] Chat en jeu + correct guess broadcast
- [ ] Gestion déconnexion/reconnexion

### Priorité 3 — Polish
- [ ] Animations par phase (backgrounds, transitions)
- [ ] Brushes stylisés (Dofus-themed)
- [ ] Banque de mots complète (200+ mots)
- [ ] Modes supplémentaires (Cadavre Exquis, Histoire)
- [ ] Stats persistantes (Prisma)
- [ ] Sons/effets audio (optionnel)
- [ ] Export album en PDF/GIF

---

*Documentation générée pour SigilOS — Sigil Gartic v1.0*
*Stack : Next.js 15 · TypeScript · Socket.io 4 · Prisma · Tailwind CSS · XState v5*
