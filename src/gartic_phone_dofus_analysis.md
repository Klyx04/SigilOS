# 📞 Gartic Phone — Analyse complète Mode Normal & Implémentation Dofus Edition

> Module mini-jeu pour Dashboard de Guilde | Inspiré de Gartic Phone | Univers Dofus

---

## 📋 Table des matières

1. [Vue d'ensemble du jeu](#vue-densemble)
2. [Différences fondamentales avec Skribbl.io](#différences-avec-skribbl)
3. [Flux de jeu Mode Normal](#flux-de-jeu-mode-normal)
4. [Architecture technique](#architecture-technique)
5. [Machine à états](#machine-à-états)
6. [Chaîne de données (Chain System)](#chaîne-de-données)
7. [Canvas & Dessin](#canvas--dessin)
8. [Phase d'écriture (Prompt)](#phase-décriture)
9. [Phase de révélation](#phase-de-révélation)
10. [Gestion des timeouts](#gestion-des-timeouts)
11. [Adaptation Univers Dofus](#adaptation-univers-dofus)
12. [Stack recommandée](#stack-recommandée)
13. [Structure de projet](#structure-de-projet)
14. [Schéma de BDD](#schéma-de-bdd)
15. [Checklist 99%](#checklist-99)

---

## 🎮 Vue d'ensemble

Gartic Phone (2020, Onrizon) est une réinterprétation du **jeu du téléphone arabe** en version dessin/texte. [web:17]
Contrairement à skribbl.io qui est **compétitif et temps-réel**, Gartic Phone est **collaboratif, asynchrone et narratif** : le plaisir vient des déformations absurdes de la chaîne. [web:3]

### Philosophie du Mode Normal

```
[Joueur A écrit "Dragon cracheur de feu"]
        ↓ dessiné par B
[Dessin du dragon... approximatif]
        ↓ deviné par C
["Un crocodile qui chante"]
        ↓ dessiné par D
[Dessin d'un crocodile avec une note de musique]
        ↓ deviné par E
["Patrick Star en concert"]
        ↓ révélation générale → 😂
```

---

## ⚔️ Différences fondamentales avec Skribbl.io

| Critère | Skribbl.io | Gartic Phone Normal |
|---------|-----------|-------------------|
| Type | Tour par tour | Chaîne asynchrone |
| Interaction | Temps réel | Asynchrone (chacun à son rythme) |
| Objectif | Compétitif (score) | Narratif (fun de la chaîne) |
| Canvas sync | Temps réel (5 KB/s) | Snapshot PNG (envoi unique) |
| Chat | Oui (guessing live) | Non |
| Scores | Oui | Non (likes/votes) |
| Bande passante | ~5 KB/s | ~2 KB/s [web:3] |
| Complexité serveur | Faible | Moyenne (state machine complexe) |
| Nombre joueurs | 2-20 | 4-30 [web:20] |
| Durée | 15-30 min | 10-20 min |

> **Clé architecturale** : Pas besoin de synchronisation canvas en temps réel — le dessin est transmis comme une **image PNG en base64** à la soumission. [web:3]

---

## 🔄 Flux de jeu Mode Normal

### Déroulement précis (N joueurs)

```
1. LOBBY
   └── Joueurs rejoignent la room (4-30 joueurs)
   └── Host configure les paramètres

2. WRITING (tous simultanément)
   └── Chaque joueur écrit un prompt de son choix
   └── Timer: 30s
   └── Règle: on ne dessinera PAS son propre prompt

3. DRAWING (tous simultanément)
   └── Chaque joueur reçoit le prompt d'un autre joueur
   └── Il dessine ce prompt
   └── Timer: 45-90s (configurable)
   └── À la soumission: canvas → PNG base64 → serveur

4. GUESSING (tous simultanément)
   └── Chaque joueur reçoit UN dessin (pas le sien, pas celui qu'il a reçu)
   └── Il écrit ce qu'il voit
   └── Timer: 30s

5. [Répétition DRAWING / GUESSING]
   └── Autant de fois que nécessaire jusqu'à ce que
       la chaîne ait fait le tour (N-1 fois au total)

6. REVEAL
   └── Chaque chaîne est révélée une par une
   └── Prompt original → Dessin → Guess → Dessin → Guess...
   └── Animations de reveal progressif
   └── Les joueurs peuvent liker/réagir

7. POST-GAME
   └── Galerie de toutes les chaînes
   └── Sauvegarde optionnelle
```

### Rotation de la chaîne

```
// Avec 5 joueurs A, B, C, D, E :
// Chaque chaîne appartient à un joueur (celui qui a écrit le prompt initial)

Chaîne de A:
  A écrit   → B dessine  → C devine  → D dessine  → E devine

Chaîne de B:
  B écrit   → C dessine  → D devine  → E dessine  → A devine

// La rotation est décalée d'un cran pour chaque chaîne
// = chaque joueur participe à TOUTES les chaînes
```

---

## 🏗️ Architecture technique

### Paradigme clé : Async State Storage

```
┌─────────────────────────────────────────────────────┐
│              Next.js / React App                    │
│        (Dashboard Guilde + Gartic Module)           │
└──────────────┬──────────────────────────────────────┘
               │ Socket.io-client (coordination)
               ▼
┌─────────────────────────────────────────────────────┐
│          Node.js + Express + Socket.io              │
│                 (Game Server)                       │
├─────────────────────────────────────────────────────┤
│  Room Manager │ Chain Engine │ Turn Coordinator     │
│  Phase Ticker │ Timeout Mgr  │ Reveal Controller    │
└──────┬────────┴──────┬───────┴──────────┬───────────┘
       ▼               ▼                  ▼
   Redis          Prisma ORM         Storage
  (sessions,     (game history,      (PNG base64
   room state)    chains, stats)      ou S3/local)
```

### Points critiques de l'architecture

1. **Pas de broadcast canvas** — contrairement à skribbl, le canvas n'est diffusé qu'une fois, à la soumission
2. **Synchronisation de phase** — tout le monde doit finir sa tâche (ou timer expire) pour passer à la suivante
3. **Attribution de tâches** — le serveur calcule l'ordre de rotation et attribue la bonne tâche à chaque joueur
4. **Isolation des données** — un joueur NE DOIT PAS voir les autres chaînes en cours (seulement la sienne)
5. **Gestion des déconnexions** — si un joueur se déconnecte, la chaîne doit continuer sans lui

---

## 🔄 Machine à états

```typescript
// game-states.ts
export enum GarticPhase {
  LOBBY         = "lobby",        // Salle d'attente
  STARTING      = "starting",     // Countdown 3s
  WRITING       = "writing",      // Phase écriture prompt
  WAITING_WRITE = "waiting_write",// Attente que tous finissent
  DRAWING       = "drawing",      // Phase dessin
  WAITING_DRAW  = "waiting_draw", // Attente que tous finissent
  GUESSING      = "guessing",     // Phase devinette
  WAITING_GUESS = "waiting_guess",// Attente que tous finissent
  REVEALING     = "revealing",    // Révélation des chaînes
  FINISHED      = "finished",     // Fin de partie
}

// Transitions d'état
const STATE_MACHINE: Record<GarticPhase, GarticPhase[]> = {
  [GarticPhase.LOBBY]:          [GarticPhase.STARTING],
  [GarticPhase.STARTING]:       [GarticPhase.WRITING],
  [GarticPhase.WRITING]:        [GarticPhase.WAITING_WRITE],
  [GarticPhase.WAITING_WRITE]:  [GarticPhase.DRAWING],
  [GarticPhase.DRAWING]:        [GarticPhase.WAITING_DRAW],
  [GarticPhase.WAITING_DRAW]:   [GarticPhase.GUESSING, GarticPhase.REVEALING],
  [GarticPhase.GUESSING]:       [GarticPhase.WAITING_GUESS],
  [GarticPhase.WAITING_GUESS]:  [GarticPhase.DRAWING, GarticPhase.REVEALING],
  [GarticPhase.REVEALING]:      [GarticPhase.FINISHED],
  [GarticPhase.FINISHED]:       [],
};
```

---

## 🔗 Chaîne de données (Chain System)

### Structure de données centrale

```typescript
// types/chain.ts

export type ChainEntry =
  | { type: "text";    content: string;  playerId: string; submittedAt: number }
  | { type: "drawing"; content: string;  playerId: string; submittedAt: number }
  // content = texte libre | base64 PNG

export interface Chain {
  id: string;
  ownerId: string;          // Joueur qui a écrit le prompt initial
  entries: ChainEntry[];    // Alternance text → drawing → text → drawing...
}

export interface GameRoom {
  id: string;
  phase: GarticPhase;
  players: Player[];
  chains: Chain[];          // Une chaîne par joueur
  currentStep: number;      // 0=write, 1=draw, 2=guess, 3=draw, ...
  settings: RoomSettings;
  phaseDeadline: number;    // timestamp Unix de fin de phase
}
```

### Algorithme d'attribution des tâches

```typescript
// Calcul de la rotation (le cœur du jeu)
// Chaque joueur i reçoit la chaîne (i + step) % N

function assignTasks(room: GameRoom): Map<string, string> {
  const players = room.players;
  const step = room.currentStep;
  const N = players.length;
  const assignments = new Map<string, string>(); // playerId → chainId

  players.forEach((player, index) => {
    const chainIndex = (index + step) % N;
    const chain = room.chains[chainIndex];
    assignments.set(player.id, chain.id);
  });

  return assignments;
}

// Exemple avec 4 joueurs [A, B, C, D] et step=1 (phase dessin):
// A → chaîne de D (dessine le prompt de D)
// B → chaîne de A (dessine le prompt de A)
// C → chaîne de B (dessine le prompt de B)
// D → chaîne de C (dessine le prompt de C)
```

### Soumission d'une entrée

```typescript
// server/game/chainEngine.ts
async function submitEntry(
  room: GameRoom,
  playerId: string,
  content: string, // texte ou base64
  type: "text" | "drawing"
): Promise<void> {
  const chainId = room.currentAssignments.get(playerId);
  if (!chainId) throw new Error("No chain assigned");

  const chain = room.chains.find(c => c.id === chainId)!;
  chain.entries.push({ type, content, playerId, submittedAt: Date.now() });

  room.submittedThisRound.add(playerId);

  // Vérifier si tous ont soumis → avancer la phase
  if (room.submittedThisRound.size === room.players.length) {
    advancePhase(room);
  }
}
```

---

## 🖌️ Canvas & Dessin

### Différence clé avec Skribbl.io

Gartic Phone **ne transmet pas les strokes en temps réel**. Le canvas est une expérience **locale et privée** : le joueur dessine seul, puis soumet une **image PNG**.

```typescript
// hooks/useGarticCanvas.ts
export function useGarticCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<ImageData[]>([]); // Pour undo multi-niveaux

  // Export PNG pour soumission au serveur
  function exportAsBase64(): string {
    const canvas = canvasRef.current!;
    return canvas.toDataURL("image/png"); // base64 complet
  }

  // Undo par snapshot (plus fiable que stroke-by-stroke)
  function saveSnapshot() {
    const ctx = canvasRef.current!.getContext("2d")!;
    strokesRef.current.push(
      ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height)
    );
  }

  function undo() {
    if (strokesRef.current.length === 0) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const snapshot = strokesRef.current.pop()!;
    ctx.putImageData(snapshot, 0, 0);
  }

  return { canvasRef, exportAsBase64, saveSnapshot, undo };
}
```

### Outils de Gartic Phone (plus avancés que Skribbl)

```typescript
// Gartic Phone dispose de plus d'outils que skribbl.io [web:17]
export const GARTIC_TOOLS = {
  PENCIL:    { id: 0, cursor: "crosshair",  sizes: [2, 4, 8, 16, 32] },
  FILL:      { id: 1, cursor: "cell",       sizes: null },
  ERASER:    { id: 2, cursor: "cell",       sizes: [8, 16, 32, 48] },
  LINE:      { id: 3, cursor: "crosshair",  sizes: [2, 4, 8, 16] },
  RECTANGLE: { id: 4, cursor: "crosshair",  sizes: [2, 4, 8, 16] },
  CIRCLE:    { id: 5, cursor: "crosshair",  sizes: [2, 4, 8, 16] },
  // Note: Gartic phone a aussi un outil TEXT (utilisé avec prudence en mode guess)
} as const;
```

### Affichage du dessin précédent (contexte pour le devineur/dessinateur)

```typescript
// En phase DRAWING : le joueur voit le TEXTE du prompt précédent
// En phase GUESSING : le joueur voit l'IMAGE du dessin précédent
// → Afficher en vignette en haut de l'interface

function PreviousEntry({ chain, currentStep }: Props) {
  const lastEntry = chain.entries[chain.entries.length - 1];

  if (currentStep === "drawing" && lastEntry.type === "text") {
    return (
      <div className="prompt-display">
        <p className="label">Dessine ça :</p>
        <h2 className="prompt-text">{lastEntry.content}</h2>
      </div>
    );
  }

  if (currentStep === "guessing" && lastEntry.type === "drawing") {
    return (
      <div className="drawing-display">
        <p className="label">Que vois-tu ?</p>
        <img src={lastEntry.content} alt="Drawing to guess" className="reference-image" />
      </div>
    );
  }
}
```

---

## ✍️ Phase d'écriture (Prompt)

```typescript
// server/game/promptValidator.ts

const PROMPT_RULES = {
  minLength: 3,
  maxLength: 100,
  forbiddenPatterns: [
    /[<>{}]/,           // XSS
    /(https?:\/\/)/,  // URLs
  ],
};

function validatePrompt(text: string): { valid: boolean; error?: string } {
  const trimmed = text.trim();
  if (trimmed.length < PROMPT_RULES.minLength)
    return { valid: false, error: "Prompt trop court" };
  if (trimmed.length > PROMPT_RULES.maxLength)
    return { valid: false, error: "Prompt trop long" };
  for (const pattern of PROMPT_RULES.forbiddenPatterns)
    if (pattern.test(trimmed))
      return { valid: false, error: "Contenu invalide" };
  return { valid: true };
}

// Option "prompt suggéré" → le serveur peut proposer un mot
// (utile si le joueur manque d'inspiration ou pour le mode Dofus)
function getSuggestedPrompt(category?: string): string {
  // Retourne un mot de la banque Dofus si catégorie spécifiée
  return category
    ? getRandomDofusWord(category)
    : getRandomDofusWord();
}
```

---

## 📡 Événements Socket.io

### Table des events (approche événementielle, pas de packet IDs)

```typescript
// Contrairement à skribbl.io (packets numérotés),
// on utilisera des événements nommés — plus maintenable

// C → S (Client vers Serveur)
socket.emit("room:join",         { roomId, userId })
socket.emit("room:start",        {})                    // Host only
socket.emit("game:submit_text",  { content: string })   // Prompt ou guess
socket.emit("game:submit_draw",  { content: string })   // Base64 PNG
socket.emit("reveal:next",       {})                    // Host avance révélation
socket.emit("reveal:react",      { chainId, emoji })    // Réaction emoji

// S → C (Serveur vers Client)
socket.emit("room:state",        RoomState)             // État complet à la connexion
socket.emit("room:player_join",  Player)
socket.emit("room:player_leave", { playerId: string })
socket.emit("game:phase_start",  { phase, deadline, task?: TaskPayload })
socket.emit("game:phase_end",    { phase })
socket.emit("game:all_submitted",{})                    // Tout le monde a fini
socket.emit("reveal:chain",      { chain: Chain })      // Révèle une chaîne
socket.emit("reveal:entry",      { chainId, entry })    // Révèle une entrée (animation)
socket.emit("reveal:reaction",   { chainId, emoji, playerId })
```

### TaskPayload selon la phase

```typescript
// Ce que le serveur envoie au joueur pour sa tâche
type TaskPayload =
  | { type: "write";   suggestion?: string }                 // Phase écriture
  | { type: "draw";    prompt: string }                      // Phase dessin (texte à dessiner)
  | { type: "guess";   imageBase64: string }                 // Phase devinette (image à deviner)
```

---

## ⏱️ Gestion des timeouts

### Stratégie de synchronisation de phase

```typescript
// server/game/phaseManager.ts

class PhaseManager {
  private room: GameRoom;
  private timer: NodeJS.Timeout | null = null;

  startPhase(phase: GarticPhase, durationMs: number) {
    this.room.phase = phase;
    this.room.phaseDeadline = Date.now() + durationMs;
    this.room.submittedThisRound.clear();

    // Broadcaster la nouvelle phase à tous les joueurs
    const tasks = this.computeTasksForPhase();
    this.room.players.forEach(player => {
      player.socket.emit("game:phase_start", {
        phase,
        deadline: this.room.phaseDeadline,
        task: tasks.get(player.id),
      });
    });

    // Timer côté serveur (source of truth)
    this.timer = setTimeout(() => {
      this.onPhaseTimeout();
    }, durationMs);
  }

  private onPhaseTimeout() {
    // Tous les joueurs qui n'ont pas soumis → soumettre une entrée vide/par défaut
    this.room.players.forEach(player => {
      if (!this.room.submittedThisRound.has(player.id)) {
        const isDrawPhase = [GarticPhase.DRAWING].includes(this.room.phase);
        const defaultContent = isDrawPhase
          ? this.getBlankCanvas()   // PNG blanc
          : "...";                  // Texte vide
        this.submitEntry(player.id, defaultContent,
          isDrawPhase ? "drawing" : "text"
        );
      }
    });
  }

  // Timer UI synchronisé : envoyer le temps restant toutes les 5s
  syncTimer() {
    setInterval(() => {
      const timeLeft = Math.max(0, this.room.phaseDeadline - Date.now());
      this.room.broadcast("timer:sync", { timeLeft });
    }, 5000);
  }
}
```

### Durées recommandées par phase

```typescript
export const PHASE_DURATIONS = {
  [GarticPhase.STARTING]:  3_000,   // 3s countdown
  [GarticPhase.WRITING]:   45_000,  // 45s pour écrire un prompt
  [GarticPhase.DRAWING]:   90_000,  // 90s par défaut (configurable: 30-180s)
  [GarticPhase.GUESSING]:  45_000,  // 45s pour deviner
  // WAITING phases: pas de timer (on attend les soumissions)
  // Optionnel: WAITING_* avec max 120s pour les retardataires
};
```

---

## 🎬 Phase de révélation

```typescript
// La révélation est l'acmé du jeu — animations cruciales

class RevealController {
  private chains: Chain[];
  private currentChainIndex = 0;
  private currentEntryIndex = 0;

  // Révèle une chaîne complète progressivement
  async revealChain(chainId: string) {
    const chain = this.chains.find(c => c.id === chainId)!;

    // 1. Annoncer quelle chaîne on révèle
    this.broadcast("reveal:chain", { chain: { ...chain, entries: [] } });
    await sleep(1500);

    // 2. Révéler entrée par entrée avec animations
    for (const entry of chain.entries) {
      this.broadcast("reveal:entry", { chainId, entry });
      // Pause plus longue pour les dessins (temps de regarder)
      await sleep(entry.type === "drawing" ? 3000 : 2000);
    }

    // 3. Afficher la chaîne complète
    this.broadcast("reveal:chain_complete", { chainId });
  }

  // Le host peut avancer manuellement
  handleNextReveal() {
    if (this.currentChainIndex < this.chains.length) {
      this.revealChain(this.chains[this.currentChainIndex++].id);
    } else {
      this.broadcast("game:finished", {});
    }
  }
}

// Animation frontend (React)
function ChainReveal({ chain }: { chain: Chain }) {
  const [visibleEntries, setVisibleEntries] = useState<ChainEntry[]>([]);

  useEffect(() => {
    socket.on("reveal:entry", ({ chainId, entry }) => {
      if (chainId === chain.id) {
        setVisibleEntries(prev => [...prev, entry]);
      }
    });
  }, []);

  return (
    <div className="chain-reveal">
      {visibleEntries.map((entry, i) => (
        <div key={i} className={`chain-entry entry-${entry.type} animate-in`}>
          {entry.type === "text"
            ? <p className="guess-text">"{entry.content}"</p>
            : <img src={entry.content} alt={`Step ${i}`} className="chain-drawing" />
          }
          <span className="player-badge">{getPlayerName(entry.playerId)}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## ⚔️ Adaptation Univers Dofus

### 🎯 Mode "Prompts Dofus" — 3 variantes

```typescript
// 1. LIBRE : chaque joueur écrit son propre prompt (comme l'original)
//    → Peut écrire n'importe quoi

// 2. ASSISTÉ : le serveur suggère un mot Dofus, le joueur peut l'accepter ou changer
//    → Meilleure expérience pour les nouveaux membres

// 3. IMPOSÉ : le serveur impose un mot de la banque Dofus
//    → Mode "Quiz Dofus" — plus éducatif/compétitif
export type PromptMode = "free" | "suggested" | "imposed";
```

### 📚 Banque de prompts Dofus (adaptée aux dessins)

```typescript
// data/dofus-gartic-prompts.ts
// ⚠️ En mode Gartic Phone, les prompts doivent être DESSINABLES visuellement

export const DOFUS_DRAWABLE_PROMPTS = {
  // Facilement dessinable (silhouette distinctive)
  easy: [
    "Tofu",           "Bouftou",         "Crobak",
    "Blop",           "Larve bleue",     "Prespic",
    "Chafer",         "Bwork",           "Koalak",
    "Iop (classe)",   "Cra (classe)",    "Sadida",
    "Tour Bonta",     "Percepteur",      "Kama",
    "Dofus Pourpre",  "Zaap",            "Moulin Amakna",
  ],

  // Moyennement difficile
  medium: [
    "Sylvestre",      "Reine Nyée",      "Bolgrot",
    "Djaul",          "Magik Riktus",    "Korriandre",
    "Osamodas",       "Pandawa avec bouteille", "Ecaflip avec cartes",
    "Xelor avec horloge", "Sram en embuscade",  "Enutrof avec pelle",
    "Donjon des Larves",  "Marché d'Astrub",   "Frigost enneigé",
  ],

  // Difficile (abstrait ou très détaillé)
  hard: [
    "Sort Epée Céleste",     "Glyphe Feca",
    "Sacrieur des Chairs",   "Roublard posant une bombe",
    "Eliotrope avec portail","Huppermage avec runes",
    "Alliance de guilde",    "Perception de percepteur",
    "Combat de Kolizéum",    "Maison de joueur",
  ],
};

// Mélange et sélection avec pondération
export function getDofusPrompt(difficulty?: "easy" | "medium" | "hard"): string {
  const pool = difficulty
    ? DOFUS_DRAWABLE_PROMPTS[difficulty]
    : [
        ...DOFUS_DRAWABLE_PROMPTS.easy,
        ...DOFUS_DRAWABLE_PROMPTS.easy,    // x2 pour favoriser les faciles
        ...DOFUS_DRAWABLE_PROMPTS.medium,
        ...DOFUS_DRAWABLE_PROMPTS.hard,
      ];
  return pool[Math.floor(Math.random() * pool.length)];
}
```

### 🏆 Système de réactions Dofus (remplace les scores)

```typescript
// Gartic Phone n'a pas de score — on utilise des réactions thématiques Dofus

export const DOFUS_REACTIONS = [
  { id: "masterpiece", emoji: "🏆", label: "Chef-d'œuvre",   points: 3 },
  { id: "iop_brain",   emoji: "🧠", label: "Cerveau d'Iop",  points: 1 },  // = mauvais dessin hilarant
  { id: "kolizeum",    emoji: "⚔️", label: "Digne du Koli",   points: 2 },
  { id: "dofus",       emoji: "🥚", label: "Dofus trouvé !",  points: 3 },  // = bien deviné
  { id: "ecaflip",     emoji: "🎲", label: "Pure chance",     points: 1 },  // = deviné par hasard
  { id: "tofu",        emoji: "🐦", label: "Tofu-like",       points: 2 },  // = trop mignon
];

// Système de "Kamas de guilde" fictifs
// Chaque réaction reçue = des kamas pour le membre
interface ReactionSummary {
  playerId: string;
  reactions: Record<string, number>;
  totalKamas: number;
}
```

### 🎨 Thème visuel Gartic Phone × Dofus

```css
/* styles/gartic-dofus.css */

/* Layout principal — parchemin encadré */
.gartic-container {
  background: radial-gradient(ellipse at center, #2C1B0E 0%, #1A1008 100%);
  min-height: 100vh;
  font-family: 'Cinzel', 'Palatino', serif;
}

/* Phase indicator — style "quête" */
.phase-indicator {
  background: linear-gradient(90deg, #8B6914, #D4A017, #8B6914);
  color: #1A0A00;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 3px;
  padding: 8px 24px;
  border-radius: 2px;
}

/* Canvas wrapper — style parchemin déployé */
.canvas-wrapper {
  background: #F5E6C8;
  border: 6px solid #8B6914;
  border-radius: 4px;
  box-shadow:
    inset 0 0 30px rgba(139, 105, 20, 0.3),
    0 8px 32px rgba(0, 0, 0, 0.6);
  position: relative;
}

/* Prompt display — style grimoire */
.prompt-display {
  background: #2C1B0E;
  border: 2px solid #D4A017;
  border-radius: 4px;
  padding: 16px;
  text-align: center;
  color: #F5E6C8;
}

/* Chain reveal cards */
.chain-entry {
  background: #F5E6C8;
  border: 2px solid #8B6914;
  border-radius: 4px;
  margin: 8px;
  padding: 12px;
  animation: slideIn 0.5s ease-out;
}

.chain-entry.entry-text {
  background: linear-gradient(135deg, #F5E6C8, #EDD99A);
  font-size: 1.2rem;
  color: #3D2B1F;
  font-style: italic;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Timer — sablier Xelor */
.timer-circle {
  stroke: #D4A017;
  filter: drop-shadow(0 0 4px rgba(212, 160, 23, 0.8));
}

/* Player list — style équipe de guilde */
.player-card {
  background: #2C1B0E;
  border: 1px solid #8B6914;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}

/* Badge "En train de dessiner..." */
.drawing-indicator::after {
  content: "🖌️";
  animation: pulse 1s infinite;
}

/* Badge "A soumis ✓" */
.submitted-indicator {
  color: #2ECC71;
  font-weight: bold;
}
```

### 🌟 Fonctionnalités exclusives Dofus

```typescript
// 1. "Témoin de Guilde" — le serveur archive toutes les parties
//    Les chaînes sont sauvegardées et consultables depuis le dashboard

// 2. "Album de Guilde" — galerie des meilleures chaînes votées
interface GuildAlbum {
  chains: SavedChain[];     // Les chaînes les mieux notées
  totalGames: number;
  members: MemberStats[];
}

// 3. Mode "Recrue" — pour intégrer les nouveaux membres
//    Les prompts sont uniquement des personnalités de la guilde
//    ex: "Dessine [pseudo] en train de farm"

// 4. "Classement Artistique de Guilde"
interface MemberArtStats {
  userId: string;
  gamesPlayed: number;
  kamasReceived: number;       // Réactions reçues converties
  bestChain?: string;          // ID de la chaîne la plus appréciée
  favoriteCategory: string;    // Catégorie de mot où ils excellent
  titles: string[];            // "Grand Artiste", "Maître du Chaos"...
}
```

---

## 🛠️ Stack recommandée

```json
{
  "backend": {
    "runtime": "Node.js + TypeScript",
    "framework": "Express.js",
    "realtime": "Socket.io ^4",
    "orm": "Prisma",
    "cache": "Redis (room state + session)",
    "storage": "Base64 en BDD (petites parties) ou S3 (galerie guilde)",
    "validation": "Zod"
  },
  "frontend": {
    "framework": "React / Next.js",
    "canvas": "Native HTML5 Canvas API (+ snapshot PNG)",
    "state": "Zustand (local game state)",
    "socket": "socket.io-client ^4",
    "styling": "TailwindCSS + CSS vars Dofus",
    "animations": "Framer Motion (reveal animations)"
  },
  "infra": {
    "deploy": "VPS existant (PM2)",
    "sessions": "Redis",
    "images": "Stockage base64 en Prisma (Text field)"
  }
}
```

---

## 📁 Structure de projet

```
src/
├── server/
│   ├── game/
│   │   ├── GarticRoom.ts         # Classe room principale
│   │   ├── ChainEngine.ts        # Logique des chaînes + rotation
│   │   ├── PhaseManager.ts       # Machine à états + timers
│   │   ├── RevealController.ts   # Animation de révélation
│   │   └── PromptBank.ts         # Banque de prompts Dofus
│   ├── sockets/
│   │   ├── handlers/
│   │   │   ├── roomHandler.ts    # Join/leave/start
│   │   │   ├── submitHandler.ts  # submit_text + submit_draw
│   │   │   ├── revealHandler.ts  # next + react
│   │   │   └── syncHandler.ts    # Reconnexion + state sync
│   │   └── middleware/
│   │       ├── authGuard.ts      # Auth guilde
│   │       └── rateLimiter.ts
│   └── routes/
│       ├── game.routes.ts
│       └── album.routes.ts       # REST: galerie des parties
│
├── client/
│   ├── components/
│   │   ├── Canvas/
│   │   │   ├── GarticCanvas.tsx      # Canvas local (pas de sync temps réel)
│   │   │   ├── Toolbar.tsx           # Crayon, fill, formes, gomme
│   │   │   └── useGarticCanvas.ts    # Hook: draw + snapshot + undo
│   │   ├── Phases/
│   │   │   ├── LobbyPhase.tsx        # Waiting room + settings
│   │   │   ├── WritingPhase.tsx      # Input texte + suggestions Dofus
│   │   │   ├── DrawingPhase.tsx      # Canvas + prompt affiché
│   │   │   ├── GuessingPhase.tsx     # Image + input texte
│   │   │   └── WaitingPhase.tsx      # "X/N joueurs ont soumis"
│   │   ├── Reveal/
│   │   │   ├── RevealScreen.tsx      # Écran de révélation
│   │   │   ├── ChainCard.tsx         # Une entrée de chaîne
│   │   │   ├── ReactionBar.tsx       # Réactions Dofus
│   │   │   └── ChainTimeline.tsx     # Chaîne complète animée
│   │   └── Dofus/
│   │       ├── DofusAvatar.tsx       # Avatar classe Dofus
│   │       ├── KamasCounter.tsx      # Total réactions/kamas
│   │       └── GuildAlbum.tsx        # Galerie des meilleures chaînes
│   ├── hooks/
│   │   ├── useGameSocket.ts      # Gestion tous les events socket
│   │   ├── useGarticCanvas.ts    # Canvas local
│   │   ├── usePhaseTimer.ts      # Timer synchronisé serveur
│   │   └── useGameState.ts       # Zustand store
│   └── data/
│       └── dofus-prompts.ts      # Banque de prompts
│
└── prisma/
    └── schema.prisma
```

---

## 🗄️ Schéma de BDD

```prisma
// prisma/schema.prisma

model GarticSession {
  id          String        @id @default(cuid())
  guildId     String
  createdAt   DateTime      @default(now())
  endedAt     DateTime?
  playerCount Int
  promptMode  String        @default("free")  // free | suggested | imposed
  chains      GarticChain[]
  guild       Guild         @relation(fields: [guildId], references: [id])
}

model GarticChain {
  id          String        @id @default(cuid())
  sessionId   String
  ownerId     String        // Joueur qui a écrit le prompt initial
  entries     GarticEntry[]
  reactions   GarticReaction[]
  session     GarticSession @relation(fields: [sessionId], references: [id])
  owner       User          @relation(fields: [ownerId], references: [id])
  featured    Boolean       @default(false) // Dans l'album de guilde
}

model GarticEntry {
  id          String      @id @default(cuid())
  chainId     String
  playerId    String
  type        String      // "text" | "drawing"
  content     String      @db.Text  // texte ou base64 PNG
  position    Int         // Ordre dans la chaîne
  submittedAt DateTime    @default(now())
  chain       GarticChain @relation(fields: [chainId], references: [id])
  player      User        @relation(fields: [playerId], references: [id])
}

model GarticReaction {
  id          String      @id @default(cuid())
  chainId     String
  playerId    String
  reaction    String      // "masterpiece" | "iop_brain" | "dofus" etc.
  createdAt   DateTime    @default(now())
  chain       GarticChain @relation(fields: [chainId], references: [id])
  player      User        @relation(fields: [playerId], references: [id])

  @@unique([chainId, playerId]) // 1 réaction par joueur par chaîne
}
```

---

## ✅ Checklist 99%

### Core Gameplay Mode Normal
- [ ] Phase WRITING : input texte + timer 45s + suggestions Dofus
- [ ] Assignation rotation : joueur i → chaîne (i + step) % N
- [ ] Phase DRAWING : afficher prompt texte + canvas local + timer
- [ ] Phase GUESSING : afficher image précédente + input texte + timer
- [ ] Alternance DRAWING / GUESSING jusqu'à N-1 tours
- [ ] Soumission PNG base64 (canvas.toDataURL)
- [ ] Timeout auto → soumettre entrée vide/blanche
- [ ] "X/N joueurs ont soumis" en phase WAITING
- [ ] Avancer la phase dès que tous ont soumis (pas attendre le timer)

### Canvas
- [ ] Crayon (lineCap round, lineJoin round)
- [ ] Gomme
- [ ] Flood fill (BFS)
- [ ] Formes : ligne, rectangle, cercle
- [ ] Palette couleurs
- [ ] Undo multi-niveaux (par snapshot ImageData)
- [ ] Clear canvas
- [ ] Export PNG base64 à la soumission
- [ ] Fond blanc par défaut

### Révélation
- [ ] Révélation chaîne par chaîne
- [ ] Animation progressive entrée par entrée
- [ ] Pause plus longue sur les dessins (3s vs 2s pour textes)
- [ ] Host contrôle le rythme (bouton "Suivant")
- [ ] Réactions Dofus par chaîne
- [ ] Affichage du propriétaire de chaque entrée
- [ ] Vue "chaîne complète" en fin

### Multijoueur
- [ ] 4-30 joueurs [web:20]
- [ ] Room privée (code d'invitation)
- [ ] Host configurant les paramètres (durées, mode prompt)
- [ ] Gestion déconnexion mid-game (skip ce joueur dans la chaîne)
- [ ] Reconnexion : envoyer l'état actuel + tâche en cours
- [ ] Rate limiting soumissions

### UX/UI
- [ ] Timer circulaire animé (couleur change à <10s)
- [ ] Liste joueurs avec statut (en attente / soumis ✓)
- [ ] Transition animée entre phases
- [ ] Notification "La partie commence !" (son + animation)
- [ ] Écran "La partie est terminée" avant révélation
- [ ] Mobile support (touch drawing)

### Fonctionnalités Dofus
- [ ] Banque de prompts Dofus (100+ visuellement dessinables)
- [ ] 3 modes de prompts : libre / suggéré / imposé
- [ ] 6 réactions thématiques Dofus
- [ ] Kamas fictifs basés sur les réactions reçues
- [ ] Galerie de guilde (album des meilleures chaînes)
- [ ] Statistiques membres sauvegardées (parties, kamas, best chain)
- [ ] Avatars = classes Dofus
- [ ] Thème visuel parchemin/or Dofus

### Sécurité
- [ ] Auth guilde obligatoire
- [ ] Validation server-side de tous les inputs (Zod)
- [ ] Sanitisation base64 (vérifier que c'est bien un PNG)
- [ ] Limite taille image (max 500 KB par canvas)
- [ ] Un joueur ne peut PAS voir les dessins/textes des autres en cours
- [ ] Anti-spam soumissions multiples (1 seule soumission par phase par joueur)

---

## 🆚 Quand utiliser Gartic Phone vs Skribbl.io ?

| Situation | Gartic Phone | Skribbl.io |
|-----------|-------------|-----------|
| Soirée guilde décontractée | ✅ Parfait | ✅ Bien |
| Compétition entre membres | ❌ Pas de score | ✅ Classement |
| Peu de bonne artistes | ✅ Le chaos est le fun | ⚠️ Peut frustrer |
| Découverte du lore Dofus | ✅ Prompts imposés | ✅ Mots à deviner |
| 2-3 joueurs seulement | ❌ Minimum 4 | ✅ Fonctionne à 2 |
| Archiver des souvenirs | ✅ Album de guilde | ❌ Pas de replay |

---

## 🚀 Intégration dans le Dashboard

```typescript
// Lancer une room depuis le dashboard de guilde
// Deux mini-jeux disponibles en un bouton

const MINIGAMES = [
  {
    id: "skribbl",
    name: "Skribbl Dofus",
    icon: "🎨",
    description: "Dessine et fais deviner en temps réel !",
    minPlayers: 2,
    maxPlayers: 20,
    route: "/minigames/skribbl",
  },
  {
    id: "gartic",
    name: "Gartic Dofus",
    icon: "📞",
    description: "Le téléphone arabe en version Dofus !",
    minPlayers: 4,
    maxPlayers: 30,
    route: "/minigames/gartic",
  },
];
```

---

*Réalisé pour le Dashboard de Guilde Dofus — Module Mini-Jeux*
*Inspiré de Gartic Phone (Onrizon, 2020) — Architecture Socket.io + Next.js + TypeScript*
*Complément du fichier skribbl_dofus_analysis.md*
