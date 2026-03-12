# 🎨 Skribbl.io — Analyse complète & Implémentation Dofus Edition

> Module mini-jeu pour Dashboard de Guilde | Inspiré de skribbl.io | Univers Dofus

---

## 📋 Table des matières

1. [Vue d'ensemble du jeu](#vue-densemble)
2. [Architecture technique](#architecture-technique)
3. [États de jeu (Game States)](#états-de-jeu)
4. [Protocole WebSocket (Socket.io)](#protocole-websocket)
5. [Canvas & Dessin — Best Practices](#canvas--dessin)
6. [Système de score](#système-de-score)
7. [Mots & Hints](#mots--hints)
8. [Modération & Sécurité](#modération--sécurité)
9. [Adaptation Univers Dofus](#adaptation-univers-dofus)
10. [Stack recommandée](#stack-recommandée)
11. [Structure de projet](#structure-de-projet)
12. [Schéma de BDD](#schéma-de-bdd)
13. [Checklist 99%](#checklist-99)

---

## 🎮 Vue d'ensemble

Skribbl.io est un jeu **tour-par-tour** de dessin/devinette multijoueur en temps réel :

- **1 dessinateur** choisit un mot parmi 3 propositions et dessine
- **N joueurs spectateurs** tapent leurs suppositions en chat
- Le serveur valide les réponses, attribue les points et révèle des indices
- Les rôles tournent jusqu'à ce que tous aient dessiné chaque round

### Flux de jeu simplifié

```
Lobby (attente) 
  → Countdown démarrage 
  → [Pour chaque joueur] 
      → Choix du mot (15s) 
      → Phase dessin (30-120s) 
      → Scoreboard intermédiaire (5s) 
  → Scoreboard final
```

---

## 🏗️ Architecture technique

### Stack de skribbl.io (reverse-engineered)

| Composant | Technologie |
|-----------|-------------|
| Backend   | Node.js + Express.js |
| Temps réel | Socket.io (WebSocket) |
| Transport | Polling → upgrade WebSocket |
| Auth session | Cookie + SID |
| Serveurs | Multi-instances géo-distribuées |

### Architecture recommandée pour le dashboard de guilde

```
┌─────────────────────────────────────────────┐
│              Next.js / React App             │
│   (Dashboard Guilde + Skribbl Dofus Module) │
└──────────────┬──────────────────────────────┘
               │ Socket.io-client
               ▼
┌─────────────────────────────────────────────┐
│         Node.js + Express + Socket.io        │
│              (Mini-jeu Server)               │
├─────────────────────────────────────────────┤
│  Room Manager │ Game Engine │ Word Validator  │
└──────┬────────┴──────┬──────┴───────┬────────┘
       ▼               ▼              ▼
   Redis (rooms)   Prisma ORM    Word Bank JSON
   (sessions)      (scores)      (mots Dofus)
```

### Flux réseau (One canvas, faible bande passante)

```
[Dessinateur] → stroke events → [Server] → broadcast → [Viewers]
[Viewers]     → text guess    → [Server] → validate  → points + hint reveal
```

**~5 KB/s** par room (un seul canvas à synchroniser) [web:3]

---

## 🔄 États de jeu

Reproduire les 8 états de skribbl.io est **critique** pour la fluidité :

| ID | État | Description | Durée |
|----|------|-------------|-------|
| 0  | `WAITING` | En attente de joueurs | ∞ |
| 1  | `STARTING` | Countdown démarrage | 3-5s |
| 2  | `ROUND_ANNOUNCE` | Affichage "Round X" | 2s |
| 3  | `WORD_PICKING` | Le dessinateur choisit | 15s |
| 4  | `DRAWING` | Phase de dessin active | 30-120s |
| 5  | `ROUND_END` | Scoreboard intermédiaire | 5s |
| 6  | `GAME_END` | Résultats finaux | 10s |
| 7  | `IDLE` | Partie non démarrée | ∞ |

```typescript
// game-states.ts
export enum GameState {
  WAITING       = 0,
  STARTING      = 1,
  ROUND_ANNOUNCE = 2,
  WORD_PICKING  = 3,
  DRAWING       = 4,
  ROUND_END     = 5,
  GAME_END      = 6,
  IDLE          = 7,
}
```

---

## 📡 Protocole WebSocket

Basé sur Socket.io avec des **data packets numérotés**. [web:1]

### Événements critiques (C = Client, S = Serveur)

```typescript
// Tous les packets transitent via un seul event "data"
socket.emit("data", { id: PACKET_ID, data: payload })
```

### Table des packets essentiels

| Packet ID | Direction | Action |
|-----------|-----------|--------|
| 1  | S→C | Player joined (UserObject) |
| 2  | S→C | Player left (id + reason) |
| 10 | S→C | Lobby data (state complet) |
| 11 | S→C | Game state update |
| 12 | C↔S | Room settings update |
| 13 | S→C | Reveal hint letter |
| 14 | S→C | Update timer |
| 15 | S→C | Player guessed correctly |
| 16 | S→C | Guess is "close" |
| 18 | C→S | Drawer selects word |
| 19 | C↔S | Draw stroke |
| 20 | C↔S | Clear canvas |
| 21 | C↔S | Undo last stroke |
| 22 | C→S | Start game (host) |
| 30 | C↔S | Chat message / guess |

### Structure DrawData (packet 19)

```typescript
// [tool, color, brushSize, startX, startY, endX, endY]
type DrawData = [number, number, number, number, number, number, number];

// Exemple: trait noir, taille medium, de (100,200) à (150,250)
const stroke: DrawData = [0, 1, 20, 100, 200, 150, 250];

// Outils: 0 = Pencil, 1 = Fill (bucket)
// Brushes: 4 (XS), 10 (S), 20 (M), 32 (L), 40 (XL)
```

### Implémentation Socket.io côté serveur

```typescript
// server/game/room.ts
export class GameRoom {
  id: string;
  players: Map<string, Player>;
  state: GameState;
  currentDrawer: string | null;
  currentWord: string | null;
  drawHistory: DrawData[][];  // pour rejoindre en cours de partie
  round: number;
  maxRounds: number;
  timer: NodeJS.Timeout | null;

  broadcast(packetId: number, data: unknown, exclude?: string) {
    this.players.forEach((player, socketId) => {
      if (socketId !== exclude) {
        player.socket.emit("data", { id: packetId, data });
      }
    });
  }
}
```

---

## 🖌️ Canvas & Dessin — Best Practices

### Setup HTML Canvas

```typescript
// hooks/useCanvas.ts
export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const strokesRef = useRef<DrawData[][]>([]); // historique pour undo

  useEffect(() => {
    const canvas = canvasRef.current!;
    // Ratio fixe 800x600 (comme skribbl.io)
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext("2d")!;
    ctx.lineCap = "round";     // ← CRUCIAL pour des traits naturels
    ctx.lineJoin = "round";    // ← Évite les angles durs
    ctxRef.current = ctx;
  }, []);

  return { canvasRef, ctxRef, strokesRef };
}
```

### Dessin fluide (anti-lag)

```typescript
// ⚠️ NE PAS envoyer chaque pixel — batching des strokes
let currentStroke: DrawData[] = [];
let sendInterval: NodeJS.Timeout;

function onMouseMove(e: MouseEvent) {
  const point = getCanvasCoords(e);
  drawLocal(lastPoint, point);
  currentStroke.push([0, color, size, lastPoint.x, lastPoint.y, point.x, point.y]);
}

// Envoyer toutes les 50ms maximum
sendInterval = setInterval(() => {
  if (currentStroke.length > 0) {
    socket.emit("data", { id: 19, data: currentStroke });
    currentStroke = [];
  }
}, 50);
```

### Reproduction fidèle du canvas côté spectateur

```typescript
// Rejoindre une room en cours → rejouer l'historique
socket.on("data", ({ id, data }) => {
  if (id === 10) { // Lobby data
    const { drawCommands } = data.state.data;
    // Rejouer tous les strokes précédents
    drawCommands.forEach((stroke: DrawData[]) => {
      stroke.forEach(cmd => drawLine(ctx, cmd));
    });
  }
  if (id === 19) { // Nouveau stroke temps réel
    data.forEach((cmd: DrawData) => drawLine(ctx, cmd));
  }
});
```

### Fill / Bucket Tool

```typescript
// Flood fill avec BFS — EXACT comme skribbl.io
function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, fillColor: string) {
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const targetColor = getPixelColor(imageData, x, y);
  if (colorsMatch(targetColor, fillColor)) return;

  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= imageData.width || cy >= imageData.height) continue;
    if (!colorsMatch(getPixelColor(imageData, cx, cy), targetColor)) continue;
    setPixelColor(imageData, cx, cy, fillColor);
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
  ctx.putImageData(imageData, 0, 0);
}
```

### Palette de couleurs (26 couleurs comme skribbl.io)

```typescript
export const SKRIBBL_COLORS = [
  "#FFFFFF", "#000000", "#C0C0C0", "#808080", // white, black, grays
  "#FF0000", "#800000",                        // reds
  "#FF8000", "#804000",                        // oranges
  "#FFFF00", "#808000",                        // yellows
  "#00FF00", "#008000", "#00C000",             // greens
  "#00FF80", "#00FFFF", "#008080",             // cyan
  "#0000FF", "#000080",                        // blues
  "#FF00FF", "#800080",                        // magenta
  "#FF80C0", "#804060",                        // pinks
  "#FFAA80", "#FF8040", "#C08040", "#804020",  // browns/peach
];
```

---

## 🏆 Système de score

### Formule de score (reverse-engineered)

```typescript
/**
 * Score du devineur basé sur la vitesse
 * Max 1000 pts pour une réponse immédiate, min 100 pts
 */
function calculateGuesserScore(
  totalTime: number,    // durée totale du tour (ex: 80s)
  timeLeft: number,     // temps restant quand deviné
  alreadyGuessed: number // nombre de joueurs ayant déjà trouvé
): number {
  const timeRatio = timeLeft / totalTime;         // 0 à 1
  const baseScore = Math.round(timeRatio * 900) + 100; // 100 à 1000
  // Légère pénalité si d'autres ont déjà trouvé
  const penalty = alreadyGuessed * 50;
  return Math.max(50, baseScore - penalty);
}

/**
 * Score du dessinateur = moyenne des scores des devineurs
 * Bonus si tout le monde a trouvé
 */
function calculateDrawerScore(
  guessersScores: number[],
  totalPlayers: number
): number {
  if (guessersScores.length === 0) return 0;
  const avg = guessersScores.reduce((a, b) => a + b, 0) / guessersScores.length;
  const allGuessedBonus = guessersScores.length === totalPlayers - 1 ? 200 : 0;
  return Math.round(avg) + allGuessedBonus;
}
```

---

## 💡 Mots & Hints

### Révélation progressive des lettres

```typescript
// Logique de reveal des hints — exactement comme skribbl.io
class HintManager {
  private word: string;
  private revealed: Set<number> = new Set();

  constructor(word: string) {
    this.word = word;
  }

  // Indices sur les espaces d'office (mots multiples)
  getInitialHints(): [number, string][] {
    return this.word.split("").reduce((acc, char, i) => {
      if (char === " ") acc.push([i, " "]);
      return acc;
    }, [] as [number, string][]);
  }

  // Révèle une lettre aléatoire non encore révélée
  revealNext(): [number, string] | null {
    const unrevealed = this.word.split("")
      .map((c, i) => i)
      .filter(i => this.word[i] !== " " && !this.revealed.has(i));
    if (unrevealed.length === 0) return null;
    const idx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    this.revealed.add(idx);
    return [idx, this.word[idx]];
  }

  // Planifier les hints (skribbl.io révèle à 40% et 70% du temps écoulé)
  scheduleHints(totalTime: number, callback: (hint: [number, string]) => void) {
    const times = [0.4, 0.7].map(p => totalTime * p * 1000);
    times.forEach(delay => {
      setTimeout(() => {
        const hint = this.revealNext();
        if (hint) callback(hint);
      }, delay);
    });
  }
}
```

### Validation "mot proche" (Close word)

```typescript
// Algorithme Levenshtein pour détecter les fautes proches
function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

function isCloseGuess(guess: string, word: string): boolean {
  const normalized = (s: string) => s.toLowerCase().trim();
  const distance = levenshtein(normalized(guess), normalized(word));
  // Skribbl considère "proche" si distance ≤ 1 pour mots ≤ 5 lettres,
  // ou ≤ 2 pour mots plus longs
  const threshold = word.length <= 5 ? 1 : 2;
  return distance > 0 && distance <= threshold;
}
```

### Modes de mots (Word Modes)

| Mode | Comportement |
|------|-------------|
| `Normal` | Affiche `_ _ _ _` (nombre de lettres) |
| `Hidden` | Masque tout, aucun indice de longueur |
| `Combination` | Mix des deux modes alternés |

---

## 🛡️ Modération & Sécurité

### Rate limiting des actions critiques

```typescript
// middleware/rateLimiter.ts
const limits = {
  draw: { window: 1000, max: 20 },    // 20 strokes/sec max
  chat: { window: 1000, max: 3 },     // 3 messages/sec
  guess: { window: 500, max: 5 },     // 5 guesses/500ms
};

// Anti-spam: packet 32 envoyé si détecté
socket.on("data", ({ id, data }) => {
  if (id === 30) { // chat
    if (isRateLimited(socket.id, "chat")) {
      socket.emit("data", { id: 32 }); // Spam detected
      return;
    }
  }
});
```

### Votekick system

```typescript
// Vote: [voterId, targetId, currentVotes, requiredVotes]
// requiredVotes = Math.ceil(players.length / 2)
function handleVotekick(room: GameRoom, voterId: string, targetId: string) {
  const votes = room.voteKicks.get(targetId) ?? new Set();
  votes.add(voterId);
  room.voteKicks.set(targetId, votes);

  const required = Math.ceil((room.players.size - 1) / 2);
  room.broadcast(5, [voterId, targetId, votes.size, required]);

  if (votes.size >= required) {
    kickPlayer(room, targetId, 1); // reason 1 = kicked
  }
}
```

---

## ⚔️ Adaptation Univers Dofus

### 📚 Banque de mots thématiques Dofus

```typescript
// data/dofus-words.ts
export const DOFUS_WORDS = {
  // Classes
  classes: [
    "Iop", "Cra", "Eniripsa", "Xelor", "Osamodas", "Sadida",
    "Ecaflip", "Enutrof", "Sram", "Feca", "Pandawa", "Sacrieur",
    "Masqueraider", "Roublard", "Zobal", "Steamer", "Eliotrope",
    "Huppermage", "Ouginak", "Forgelance",
  ],
  // Boss & Monstres
  monsters: [
    "Sylvestre", "Reine Nyée", "Toxine", "Magik Riktus",
    "Klime", "Phossile", "Ombre", "Djaul", "Bolgrot",
    "Groul", "Bwork Mage", "Tofu", "Bouftou", "Crobak",
    "Chafer", "Treechnid", "Craqueleur", "Kolosso", "Ilyzaëlle",
    "Korriandre", "Bethel", "Catseye",
  ],
  // Équipement iconique
  equipment: [
    "Gelano", "Turquoise", "Anneau Alliage", "Cape Vampyro",
    "Panoplie Kimbo", "Coiffe Gobball", "Trophée", "Dofus Ivoire",
    "Dofus Pourpre", "Dofus Turquoise", "Vulbis", "Ochre",
    "Bouclier Royal Gobball", "Cape du Bouftou",
  ],
  // Lieux & Zones
  places: [
    "Astrub", "Bonta", "Brakmar", "Amakna", "Incarnam",
    "Sufokia", "Frigost", "Pandala", "Wabbit Island",
    "Donjon des Larves", "Forêt des Abraknydes", "Mont Rouilleux",
    "Donjon Ombre", "Temple de Scriptorius", "Sarakech Sufokia",
  ],
  // Métiers
  crafts: [
    "Forgeur d'épées", "Sculpteur d'arcs", "Alchimiste",
    "Cordonnier", "Tailleur", "Forgeur de boucliers",
    "Bijoutier", "Boulanger", "Bûcheron", "Mineur",
    "Paysan", "Chasseur",
  ],
  // Sorts & Mécaniques
  spells: [
    "Mot d'amour", "Flèche explosive", "Epée céleste",
    "Sacrieur des chairs", "Convocation", "Roulette",
    "Chance de l'Enutrof", "Fourberie", "Blizzard",
    "Glyphe d'immunité", "Arbre Sadida", "Sablier",
  ],
  // Émotes & Culture
  culture: [
    "Frigostien", "Crâ-crâ", "Dofusien", "Kamas",
    "Kolizéum", "Temporis", "Donjon", "Drop", "Craft",
    "Hodoï", "Ankama", "Alliance", "Guilde", "Perc",
  ],
};

// Récupérer N mots aléatoires parmi une catégorie ou toutes
export function getRandomWords(count: number = 3, category?: keyof typeof DOFUS_WORDS): string[] {
  const pool = category
    ? DOFUS_WORDS[category]
    : Object.values(DOFUS_WORDS).flat();
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
```

### 🎨 Thème visuel Dofus

```css
/* styles/skribbl-dofus.css */
:root {
  --dofus-gold: #D4A017;
  --dofus-dark: #1A1A2E;
  --dofus-brown: #3D2B1F;
  --dofus-parchment: #F5E6C8;
  --dofus-red: #8B1A1A;
  --dofus-blue: #1B3A6B;
}

.game-container {
  background: var(--dofus-dark);
  font-family: 'Cinzel', 'Georgia', serif; /* Police médiéval-fantasy */
  border: 2px solid var(--dofus-gold);
}

/* Hint display — parchemin */
.word-hint {
  background: var(--dofus-parchment);
  color: var(--dofus-brown);
  letter-spacing: 8px;
  font-size: 1.5rem;
  padding: 8px 16px;
  border-radius: 4px;
  border: 1px solid var(--dofus-gold);
}

/* Score board — style Kolizéum */
.scoreboard {
  background: linear-gradient(135deg, var(--dofus-dark), var(--dofus-brown));
  border: 1px solid var(--dofus-gold);
  color: var(--dofus-parchment);
}

/* Canvas frame — parchemin */
.canvas-wrapper {
  border: 4px solid var(--dofus-gold);
  border-radius: 2px;
  box-shadow: 0 0 20px rgba(212, 160, 23, 0.3);
}
```

### 🏅 Avatars — Classes Dofus

```typescript
// Remplacer les avatars génériques par les 20 classes Dofus
export const DOFUS_AVATARS = [
  { id: 0,  name: "Iop",         emoji: "⚔️",  color: "#E74C3C" },
  { id: 1,  name: "Cra",         emoji: "🏹",  color: "#27AE60" },
  { id: 2,  name: "Eniripsa",    emoji: "💚",  color: "#1ABC9C" },
  { id: 3,  name: "Xelor",       emoji: "⏰",  color: "#8E44AD" },
  { id: 4,  name: "Osamodas",    emoji: "🐉",  color: "#2ECC71" },
  { id: 5,  name: "Sadida",      emoji: "🌿",  color: "#16A085" },
  { id: 6,  name: "Ecaflip",     emoji: "🎲",  color: "#F39C12" },
  { id: 7,  name: "Enutrof",     emoji: "💰",  color: "#D4AC0D" },
  { id: 8,  name: "Sram",        emoji: "💀",  color: "#2C3E50" },
  { id: 9,  name: "Feca",        emoji: "🛡️",  color: "#2980B9" },
  { id: 10, name: "Pandawa",     emoji: "🍶",  color: "#E67E22" },
  { id: 11, name: "Sacrieur",    emoji: "🩸",  color: "#C0392B" },
  { id: 12, name: "Eliotrope",   emoji: "🌀",  color: "#9B59B6" },
  { id: 13, name: "Huppermage",  emoji: "🔮",  color: "#3498DB" },
  { id: 14, name: "Ouginak",     emoji: "🐾",  color: "#795548" },
  { id: 15, name: "Steamer",     emoji: "⚙️",  color: "#607D8B" },
  { id: 16, name: "Roublard",    emoji: "💣",  color: "#FF5722" },
  { id: 17, name: "Zobal",       emoji: "🎭",  color: "#9C27B0" },
  { id: 18, name: "Masqueraider",emoji: "🎪",  color: "#E91E63" },
  { id: 19, name: "Forgelance",  emoji: "🔱",  color: "#FF9800" },
];
```

### 🎯 Fonctionnalités exclusives Dofus

```typescript
// 1. Mode "Catégorie Dofus" — les joueurs voient la catégorie du mot
interface DofusWordConfig {
  word: string;
  category: string;      // "Classe", "Boss", "Lieu"...
  difficulty: "easy" | "medium" | "hard";
  hint?: string;         // Indice contextuel ex: "Sort signature du Crâ"
}

// 2. Bonus "Kolizéum" — titres affichés selon le score
export function getKolizeumTitle(score: number): string {
  if (score >= 5000) return "Champion des Champions 🏆";
  if (score >= 3000) return "Challenger 💎";
  if (score >= 1500) return "Combattant 🥈";
  if (score >= 500)  return "Recrue ⚔️";
  return "Candiat 🌱";
}

// 3. Système de récompenses en Kamas (fictifs)
export function getKamasReward(rank: number, totalPlayers: number): number {
  const base = [1000, 600, 400, 200, 100];
  return base[Math.min(rank, base.length - 1)] ?? 50;
}

// 4. Mode "Temporis" — mots limités à la saison en cours
// Configurable via le dashboard admin de la guilde
```

---

## 🛠️ Stack recommandée

Basé sur le stack existant du dashboard de guilde :

```json
{
  "backend": {
    "runtime": "Node.js + TypeScript",
    "framework": "Express.js",
    "realtime": "Socket.io ^4",
    "orm": "Prisma",
    "cache": "Redis (bull queues + room state)",
    "validation": "Zod"
  },
  "frontend": {
    "framework": "React / Next.js",
    "canvas": "Native HTML5 Canvas API",
    "state": "Zustand (game state local)",
    "socket": "socket.io-client ^4",
    "styling": "TailwindCSS + CSS vars Dofus"
  },
  "infra": {
    "deploy": "VPS (existant) ou Vercel + Railway",
    "sessions": "Redis",
    "monitoring": "PM2"
  }
}
```

---

## 📁 Structure de projet

```
src/
├── server/
│   ├── game/
│   │   ├── GameRoom.ts         # Classe room principale
│   │   ├── GameEngine.ts       # Machine à états du jeu
│   │   ├── HintManager.ts      # Gestion des indices
│   │   ├── ScoreManager.ts     # Calcul des scores
│   │   └── WordBank.ts         # Banque de mots + API mots Dofus
│   ├── sockets/
│   │   ├── handlers/
│   │   │   ├── drawHandler.ts  # Packets draw (19, 20, 21)
│   │   │   ├── chatHandler.ts  # Packet 30 (guess + chat)
│   │   │   ├── roomHandler.ts  # Join/leave/settings
│   │   │   └── gameHandler.ts  # Start/end game
│   │   └── middleware/
│   │       ├── rateLimiter.ts
│   │       └── authGuard.ts    # Intégration auth guilde
│   └── routes/
│       └── game.routes.ts      # REST pour créer/rejoindre rooms
│
├── client/
│   ├── components/
│   │   ├── Canvas/
│   │   │   ├── DrawingCanvas.tsx    # Canvas principal
│   │   │   ├── Toolbar.tsx          # Outils + couleurs
│   │   │   └── useDrawing.ts        # Hook dessin
│   │   ├── Game/
│   │   │   ├── GameLobby.tsx        # Waiting room
│   │   │   ├── WordPicker.tsx       # Choix du mot (3 options)
│   │   │   ├── WordHint.tsx         # Affichage _ _ _ _
│   │   │   ├── ChatBox.tsx          # Chat + guesses
│   │   │   ├── PlayerList.tsx       # Scores + avatars
│   │   │   ├── Timer.tsx            # Countdown circulaire
│   │   │   └── Scoreboard.tsx       # Fin de round/partie
│   │   └── Dofus/
│   │       ├── DofusAvatar.tsx      # Avatar classe Dofus
│   │       └── KamasReward.tsx      # Animation récompense
│   ├── hooks/
│   │   ├── useGameSocket.ts     # Gestion socket + packets
│   │   ├── useCanvas.ts         # Canvas drawing
│   │   └── useGameState.ts      # Zustand store
│   └── data/
│       └── dofus-words.ts       # Banque de mots
│
└── prisma/
    └── schema.prisma            # Modèles BDD
```

---

## 🗄️ Schéma de BDD

```prisma
// prisma/schema.prisma

model GameSession {
  id          String   @id @default(cuid())
  guildId     String
  createdAt   DateTime @default(now())
  endedAt     DateTime?
  rounds      Int
  maxPlayers  Int
  wordMode    String   @default("normal")
  results     GameResult[]
  guild       Guild    @relation(fields: [guildId], references: [id])
}

model GameResult {
  id          String   @id @default(cuid())
  sessionId   String
  userId      String
  score       Int
  rank        Int
  wordsDrawn  Int      @default(0)
  wordsGuessed Int     @default(0)
  kamasEarned Int      @default(0)
  session     GameSession @relation(fields: [sessionId], references: [id])
  user        User     @relation(fields: [userId], references: [id])
}

model GameWord {
  id          String   @id @default(cuid())
  word        String   @unique
  category    String
  difficulty  String   @default("medium")
  language    String   @default("fr")
  usageCount  Int      @default(0)
  createdAt   DateTime @default(now())
}

// Extension du modèle User existant
// user.gamesPlayed, user.totalScore, user.bestRank
```

---

## ✅ Checklist 99%

### Core Gameplay
- [ ] Canvas HTML5 natif 800×600, lineCap round
- [ ] Batching des strokes (envoi toutes les 50ms)
- [ ] Flood fill (bucket tool) BFS
- [ ] Undo stroke (historique côté serveur)
- [ ] 26 couleurs + 5 tailles de pinceau
- [ ] Machine à 8 états de jeu
- [ ] Timer serveur (source of truth) + sync toutes les 5s
- [ ] Choix du mot parmi 3 options (15s timeout → auto-select)
- [ ] Reveal hints à 40% et 70% du temps écoulé
- [ ] Validation "mot exact" (insensible casse, trim)
- [ ] Validation "mot proche" (Levenshtein ≤ 2)
- [ ] Score basé sur le temps restant (100-1000 pts)
- [ ] Score dessinateur = moyenne des devineurs + bonus
- [ ] Rejouer l'historique du canvas pour les late-joiners
- [ ] Scoreboard intermédiaire entre chaque tour
- [ ] Scoreboard final avec classement

### Multijoueur
- [ ] Room publique / privée (code d'invitation)
- [ ] 2-20 joueurs par room
- [ ] Système de host (premier joueur)
- [ ] Transfer de host si le host quitte
- [ ] Votekick (majorité simple)
- [ ] Mute côté client
- [ ] Rate limiting draw/chat/guess

### UX/UI
- [ ] Avatar personnalisable (classes Dofus)
- [ ] Timer circulaire animé
- [ ] Animation de score (+X pts)
- [ ] Indication "mot proche !" en jaune
- [ ] Indication "X a trouvé !" en vert
- [ ] Le mot révélé en fin de tour pour tous
- [ ] Chat masqué pour le dessinateur (sauf après la fin)
- [ ] Barre de progression des rounds (Round 2/5)
- [ ] Support mobile (touch events)

### Fonctionnalités Dofus
- [ ] Banque de mots Dofus (200+ mots)
- [ ] Catégories : Classes, Boss, Lieux, Items, Sorts
- [ ] Thème visuel Dofus (couleurs, fonts)
- [ ] Avatars = 20 classes Dofus
- [ ] Titres Kolizéum selon score
- [ ] Récompenses en Kamas fictifs
- [ ] Statistiques sauvegardées en BDD (lié au compte guilde)

### Sécurité
- [ ] Auth guilde obligatoire pour créer/rejoindre
- [ ] Validation serveur de tous les packets
- [ ] Anti-cheat : le mot n'est JAMAIS envoyé aux spectateurs
- [ ] IP rate limit pour éviter les room floods
- [ ] Sanitisation du chat (XSS)

---

## 🚀 Démarrage rapide

```bash
# Installation
npm install socket.io socket.io-client zod zustand

# Variables d'environnement
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# Lancer le serveur de jeu séparé du dashboard
npm run dev:game   # Port 3001
npm run dev        # Dashboard Next.js port 3000
```

---

*Réalisé pour le Dashboard de Guilde Dofus — Module Mini-Jeux*
*Inspiré de skribbl.io par Mel — Architecture Socket.io + Next.js + TypeScript*
