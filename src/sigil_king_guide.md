# 🃏 Sigil King — Guide Complet d'Implémentation

> Jeu de plis multijoueur inspiré de Skull King, skinné dans l'univers Dofus.  
> Rendu visuel : **2.5D style Governor of Poker** — fond fixe + sprites CSS + SVG animés  
> Stack : Node.js · TypeScript · Socket.io · React 18 · Framer Motion · TailwindCSS

---

## Table des matières

1. [Concept & Thème Dofus](#1-concept--thème-dofus)
2. [Règles complètes du Sigil King](#2-règles-complètes)
3. [Vision visuelle 2.5D](#3-vision-visuelle-25d)
4. [Architecture technique](#4-architecture-technique)
5. [Data Models TypeScript](#5-data-models-typescript)
6. [Logique métier — résolution d'un pli](#6-logique-métier)
7. [UI Design System](#7-ui-design-system)
8. [Composants UI clés](#8-composants-ui-clés)
9. [Cartes numérotées — SVG inline](#9-cartes-numérotées--svg-inline)
10. [Animations & Effets](#10-animations--effets)
11. [Responsive & Mobile](#11-responsive--mobile)
12. [Performance & Optimisation](#12-performance--optimisation)
13. [Socket.io — Flux temps réel](#13-socketio--flux-temps-réel)
14. [Roadmap d'implémentation](#14-roadmap)

---

## 1. Concept & Thème Dofus

**Sigil King** est un jeu de plis (trick-taking) pour 2 à 6 joueurs.  
Chaque manche, les joueurs misent sur le nombre de plis qu'ils pensent remporter.  
Les 10 manches escaladent en complexité : 1 carte en manche 1, 10 cartes en manche 10.

### Re-skin Dofus

| Skull King original | Sigil King (Dofus) | Couleur / Glow |
|---|---|---|
| 4 couleurs | 🔥 Feu · 💧 Eau · 🌪️ Air · 🌿 Terre | Rouge / Bleu / Vert / Or |
| Atout noir | **Stasis** (magie noire de Xelor) | Violet sombre |
| Pirates (×5) | **Incarnations** : Iop, Sacrieur, Roublard, Crâ, Osamodas | Bordure rouge |
| Skull King | **Ogrest** (roi des titans) | Glow doré |
| Sirènes (×2) | **Éniripsa** (guérisseuse qui retourne le combat) | Glow cyan |
| Évasions (×5) | **Pandawa** (trop ivre pour combattre) | Gris terne |
| Tigresse | **Sram** (assassin double identité) | Glow violet |
| Kraken *(avancé)* | **Dévastateur** (annule le pli entier) | Glow noir/rouge |
| Baleine blanche *(avancé)* | **Alma Mater** (vole le pli) | Glow blanc/or |

---

## 2. Règles complètes

### 2.1 Composition du deck (66 cartes)

| Carte | Qtité | Description |
|---|---|---|
| Cartes élémentaires (1–13) | 65 | 5 séries × 13 cartes : Feu, Eau, Air, Terre, Stasis |
| Incarnations | 5 | Battent toutes les cartes numérotées |
| Ogrest | 1 | Bat toutes les Incarnations, perd contre les Éniripsa |
| Éniripsa | 2 | Battent tout, sauf Ogrest (qui les bat en retour... non !) |
| Pandawa | 5 | Perdent toujours le pli |
| Sram | 1 | Au choix du joueur : Incarnation ou Pandawa |
| Dévastateur *(avancé)* | 1 | Annule le pli entier |
| Alma Mater *(avancé)* | 1 | Vole le pli au gagnant naturel |

> Note : Le Stasis est la 5ème couleur numérotée (1-13) qui sert d'atout — bat les 4 éléments.

### 2.2 Hiérarchie de force

```
Éniripsa > Ogrest > Incarnations > Stasis > Couleur demandée > Autre couleur > Pandawa
```

**Cas spéciaux critiques :**
- Éniripsa capture Ogrest → **+50 pts bonus** au joueur qui a joué l'Éniripsa
- Incarnation capture Ogrest → **+30 pts bonus**
- Deux Incarnations dans le même pli → **la première jouée gagne**
- Tous Pandawa → **la première jouée "gagne" le pli** (elle le prend à contrecœur)
- Dévastateur → pli annulé, personne ne prend, cartes défaussées

### 2.3 Déroulement d'une manche

```
1. Distribution des cartes (n cartes = numéro de manche)
2. Phase de mise SIMULTANÉE → tous misent en secret, révélation en même temps
3. Phase de jeu : le joueur à gauche du donneur ouvre, les autres suivent
4. Résolution du pli → le gagnant ouvre le prochain
5. Fin de manche → calcul des scores
6. Recommencer jusqu'à la manche 10
```

**Règle de suivi :** Le joueur DOIT jouer la couleur demandée s'il en a une.  
S'il n'en a pas, il peut jouer n'importe quelle carte.  
Les cartes spéciales (Incarnation, Ogrest, Éniripsa, Pandawa, Sram) peuvent **toujours** être jouées.

La couleur du pli est définie par la **première carte élémentaire jouée** (pas par une spéciale).

### 2.4 Calcul du score

| Résultat | Formule |
|---|---|
| Mise exacte (mise ≥ 1) | `+20 × mise` |
| Mise 0 réussie | `+10 × numéro de manche` |
| Mise ratée | `-10 × abs(mise - plis obtenus)` |
| Bonus : Éniripsa capture Ogrest | `+50` |
| Bonus : Incarnation capture Ogrest | `+30` |
| Storm mode : mise = toutes les cartes | Score × 2 (si réussi) |

### 2.5 Règles avancées (optionnelles)

- **Dévastateur** : si joué, le pli est annulé — personne ne marque de pli, cartes défaussées
- **Alma Mater** : le joueur qui la joue vole le pli à celui qui l'aurait gagné naturellement
- **Sram** : le joueur DOIT annoncer son rôle (Incarnation ou Pandawa) au moment de jouer
- **Storm mode** : si un joueur mise exactement `round` plis (tous ses plis), et réussit → score ×2

---

## 3. Vision visuelle 2.5D

### Le principe : Governor of Poker, version Dofus

Pas de 3D réelle (Three.js/WebGL), mais une illusion de profondeur en **2.5D** :

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  COUCHE 1 — Image de fond fixe (z-index: 0)          │
│  Salle de taverne Dofus, perspective légère,         │
│  générée par IA (Midjourney / Stable Diffusion)      │
│  → Jamais animée, 100% statique                      │
│                                                      │
│  COUCHE 2 — Table ovale CSS (z-index: 10)            │
│  div avec border-radius: 50%, gradient feutre vert   │
│  box-shadow interne, bordure en bois/or              │
│  → Responsive, s'adapte à la fenêtre                │
│                                                      │
│  COUCHE 3 — Avatars joueurs (z-index: 20)            │
│  Sprites PNG transparents des classes Dofus          │
│  Animation CSS idle loop (respiration, balancement)  │
│  → Positionnés en absolute autour de la table        │
│                                                      │
│  COUCHE 4 — Cartes SVG React (z-index: 30)           │
│  Composants SVG inline (NumberedCard + SpecialCard)  │
│  Animés avec Framer Motion (layoutId FLIP)           │
│  → Volent, se retournent, glissent                   │
│                                                      │
│  COUCHE 5 — Particules & effets (z-index: 40)        │
│  Canvas 2D transparent pour bonus (Éniripsa/Ogrest)  │
│  CSS glow/pulse pour le joueur actif                 │
│                                                      │
│  COUCHE 6 — UI (z-index: 50)                         │
│  Modals (BidModal, ScoreBoard), toasts, timers       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Pourquoi ce choix est le bon

| Critère | 3D WebGL | 2.5D (notre choix) | CSS pur flat |
|---|---|---|---|
| Rendu visuel | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Charge de travail | ❌ 6+ mois | ✅ 4-6 semaines | ✅ 2-3 semaines |
| Performances mobiles | ❌ GPU intensif | ✅ CSS GPU | ✅ Natif |
| Animations cartes | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Maintenance | ❌ Complexe | ✅ React standard | ✅ Simple |
| Cohérence Dofus | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 4. Architecture technique

```
sigil-king/
├── packages/
│   ├── server/
│   │   └── src/
│   │       ├── game/
│   │       │   ├── GameManager.ts       # Orchestrateur des rooms
│   │       │   ├── GameState.ts         # État pur du jeu
│   │       │   ├── TrickResolver.ts     # Résolution de plis (toute la logique)
│   │       │   ├── ScoreCalculator.ts   # Calcul des scores + bonus
│   │       │   ├── Deck.ts              # Génération & Fisher-Yates shuffle
│   │       │   └── BidManager.ts        # Mises simultanées
│   │       ├── socket/
│   │       │   ├── events.ts            # Événements Socket.io typés
│   │       │   └── handlers.ts          # Handlers par événement
│   │       └── index.ts
│   │
│   ├── client/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── game/
│   │       │   │   ├── GameBoard.tsx        # Plateau principal (2.5D layout)
│   │       │   │   ├── TableFelt.tsx        # Table ovale CSS
│   │       │   │   ├── PlayerSeat.tsx       # Avatar + infos joueur
│   │       │   │   ├── PlayerHand.tsx       # Main locale (bas d'écran)
│   │       │   │   ├── TrickArea.tsx        # Cartes jouées au centre
│   │       │   │   ├── BidModal.tsx         # Modal mise simultanée
│   │       │   │   ├── ScoreBoard.tsx       # Résultats de manche
│   │       │   │   └── ParticleCanvas.tsx   # Effets bonus
│   │       │   └── cards/
│   │       │       ├── CardComponent.tsx    # Wrapper universel
│   │       │       ├── NumberedCard.tsx     # Cartes 1–13 (SVG inline)
│   │       │       ├── SpecialCard.tsx      # Ogrest, Éniripsa, Sram…
│   │       │       ├── CardBack.tsx         # Dos de carte SVG
│   │       │       ├── SuitIcon.tsx         # Icônes éléments inline
│   │       │       └── pipLayouts.ts        # Positions des pips 1→10
│   │       ├── hooks/
│   │       │   ├── useGameSocket.ts
│   │       │   ├── useGameState.ts
│   │       │   └── useCardAnimation.ts
│   │       ├── store/
│   │       │   └── gameStore.ts             # Zustand
│   │       └── assets/
│   │           ├── backgrounds/
│   │           │   └── taverne-dofus.jpg    # Image de fond 2.5D (1920×1080)
│   │           └── sprites/
│   │               ├── iop-idle.png         # Sprite sheet classes Dofus
│   │               ├── eniripsa-idle.png
│   │               └── ...
│   │
│   └── shared/
│       └── src/
│           ├── types.ts
│           └── constants.ts
```

### Stack recommandée

| Domaine | Technologie | Raison |
|---|---|---|
| Framework UI | **React 18 + Vite** | Concurrent features, fast HMR |
| Animations | **Framer Motion** | layoutId FLIP, spring physics |
| State global | **Zustand** | Léger, TypeScript natif |
| Styles | **TailwindCSS + CSS custom** | Utilitaires + keyframes GPU |
| Temps réel | **Socket.io** | Déjà dans ton stack |
| Cartes | **SVG React inline** | Scalable, animable, 0 requête |
| Fond 2.5D | **Image JPG statique** | Générée par IA, jamais animée |
| Sprites avatars | **PNG transparent + CSS** | Animation idle via keyframes |
| Particules | **Canvas 2D overlay** | Performance GPU, z-index élevé |

---

## 5. Data Models TypeScript

```typescript
// shared/src/types.ts

export type Suit = "fire" | "water" | "air" | "earth" | "stasis";

export type CardType =
  | "elemental"    // cartes numérotées 1–13
  | "incarnation"  // Pirates — Iop, Sacrieur, Roublard, Crâ, Osamodas
  | "ogrest"       // Skull King
  | "eniripsa"     // Sirènes
  | "pandawa"      // Évasions
  | "sram"         // Tigresse
  | "devastator"   // Kraken (avancé)
  | "almamater";   // Baleine blanche (avancé)

export interface Card {
  id: string;           // uuid unique (clé React + layoutId Framer)
  type: CardType;
  suit?: Suit;          // uniquement "elemental"
  value?: number;       // 1–13, uniquement "elemental"
  name: string;
}

export type GamePhase = "lobby" | "bidding" | "playing" | "scoring" | "gameover";

export interface Player {
  id: string;
  name: string;
  avatarClass: string;  // "iop" | "eniripsa" | "sram" | ...
  score: number;
  roundScore: number;
  bid: number | null;
  tricksWon: number;
  bonusPoints: number;
  hand: Card[];
  isConnected: boolean;
  isCurrentTurn: boolean;
  seatIndex: number;    // 0–5, position autour de la table
}

export interface PlayedCard {
  playerId: string;
  card: Card;
  sramChoice?: "incarnation" | "pandawa";
}

export interface Trick {
  id: string;
  cards: PlayedCard[];
  leadSuit: Suit | null;
  winnerId: string | null;   // null = annulé (Dévastateur)
  bonusTriggered: "eniripsa_captures_ogrest" | "incarnation_captures_ogrest" | null;
}

export interface RoundResult {
  round: number;
  players: Array<{
    playerId: string;
    bid: number;
    tricksWon: number;
    bonusPoints: number;
    roundScore: number;
    totalScore: number;
  }>;
}

export interface GameState {
  id: string;
  phase: GamePhase;
  round: number;
  players: Player[];
  currentTrick: Trick;
  tricksHistory: Trick[];
  roundResults: RoundResult[];
  currentPlayerIndex: number;
  dealerIndex: number;
  settings: GameSettings;
}

export interface GameSettings {
  advancedCards: boolean;
  stormMode: boolean;
  maxPlayers: 2 | 3 | 4 | 5 | 6;
  timeoutBid: number;
  timeoutPlay: number;
}

// Événements Socket.io (typés côté shared)
export interface ServerToClientEvents {
  "game:state":          (state: PublicGameState) => void;
  "game:trick_resolved": (trick: Trick) => void;
  "game:round_end":      (result: RoundResult) => void;
  "game:over":           (finalScores: RoundResult) => void;
  "player:joined":       (player: Omit<Player, "hand">) => void;
  "player:left":         (playerId: string) => void;
  "bid:reveal":          (bids: Record<string, number>) => void;
  "card:played":         (playedCard: PlayedCard) => void;
  "error":               (message: string) => void;
}

export interface ClientToServerEvents {
  "game:join":       (roomId: string, playerName: string) => void;
  "game:start":      () => void;
  "bid:submit":      (amount: number) => void;
  "card:play":       (cardId: string, sramChoice?: "incarnation" | "pandawa") => void;
  "settings:update": (settings: Partial<GameSettings>) => void;
}

// PublicGameState : seul le joueur local voit sa main
export type PublicGameState = Omit<GameState, "players"> & {
  players: Array<Omit<Player, "hand"> & { handCount: number }>;
  localHand: Card[];   // injecté par le serveur uniquement pour le destinataire
};
```

---

## 6. Logique métier

### 6.1 TrickResolver — résolution complète

```typescript
// server/src/game/TrickResolver.ts

import { Card, PlayedCard, Trick, Suit } from "@sigil-king/shared";

type TrickOutcome = {
  winnerId: string | null;
  bonusTriggered: Trick["bonusTriggered"];
};

export class TrickResolver {

  resolve(trick: Trick): TrickOutcome {
    const { cards } = trick;

    // Cas 1 : Dévastateur → pli annulé
    if (cards.some(pc => pc.card.type === "devastator")) {
      return { winnerId: null, bonusTriggered: null };
    }

    // Résolution naturelle
    const naturalWinner = this.resolveNatural(cards);
    const bonus = this.checkBonus(cards, naturalWinner.playerId);

    // Cas 2 : Alma Mater → vole le pli
    const almaMater = cards.find(pc => pc.card.type === "almamater");
    if (almaMater && almaMater.playerId !== naturalWinner.playerId) {
      return { winnerId: almaMater.playerId, bonusTriggered: bonus };
    }

    return { winnerId: naturalWinner.playerId, bonusTriggered: bonus };
  }

  private resolveNatural(cards: PlayedCard[]): PlayedCard {
    // 1. Éniripsa (première jouée gagne)
    const mermaids = cards.filter(pc => pc.card.type === "eniripsa");
    if (mermaids.length > 0) return mermaids[0];

    // 2. Ogrest
    const ogrest = cards.find(pc => pc.card.type === "ogrest");
    if (ogrest) return ogrest;

    // 3. Incarnations + Sram(incarnation) — première jouée gagne
    const pirates = cards.filter(pc =>
      pc.card.type === "incarnation" ||
      (pc.card.type === "sram" && pc.sramChoice === "incarnation")
    );
    if (pirates.length > 0) return pirates[0];

    // 4. Stasis (atout — valeur la plus haute)
    const stasisCards = cards.filter(pc =>
      pc.card.type === "elemental" && pc.card.suit === "stasis"
    );
    if (stasisCards.length > 0) {
      return stasisCards.reduce((max, pc) =>
        pc.card.value! > max.card.value! ? pc : max
      );
    }

    // 5. Couleur du pli (lead suit — valeur la plus haute)
    const leadSuit = this.getLeadSuit(cards);
    if (leadSuit) {
      const leadCards = cards.filter(pc =>
        pc.card.type === "elemental" && pc.card.suit === leadSuit
      );
      if (leadCards.length > 0) {
        return leadCards.reduce((max, pc) =>
          pc.card.value! > max.card.value! ? pc : max
        );
      }
    }

    // 6. Que des Pandawa → le premier prend (à contrecœur)
    return cards[0];
  }

  private getLeadSuit(cards: PlayedCard[]): Suit | null {
    for (const pc of cards) {
      if (pc.card.type === "elemental") return pc.card.suit!;
    }
    return null;
  }

  private checkBonus(cards: PlayedCard[], winnerId: string): Trick["bonusTriggered"] {
    if (!cards.some(pc => pc.card.type === "ogrest")) return null;
    const winner = cards.find(pc => pc.playerId === winnerId);
    if (!winner) return null;
    if (winner.card.type === "eniripsa") return "eniripsa_captures_ogrest";
    if (winner.card.type === "incarnation" ||
       (winner.card.type === "sram" && winner.sramChoice === "incarnation")) {
      return "incarnation_captures_ogrest";
    }
    return null;
  }
}
```

### 6.2 ScoreCalculator

```typescript
// server/src/game/ScoreCalculator.ts

import { Player, Trick, GameSettings } from "@sigil-king/shared";

export class ScoreCalculator {

  calculate(player: Player, tricksWon: number, round: number, settings: GameSettings): number {
    const bid = player.bid!;
    let score = 0;

    if (bid === 0) {
      score = tricksWon === 0 ? 10 * round : -10 * round;
    } else if (tricksWon === bid) {
      score = 20 * bid;
      if (settings.stormMode && bid === round) score *= 2; // Storm mode
    } else {
      score = -10 * Math.abs(bid - tricksWon);
    }

    return score;
  }

  getBonusPoints(tricks: Trick[]): number {
    return tricks.reduce((total, trick) => {
      if (trick.bonusTriggered === "eniripsa_captures_ogrest")   return total + 50;
      if (trick.bonusTriggered === "incarnation_captures_ogrest") return total + 30;
      return total;
    }, 0);
  }
}
```

### 6.3 BidManager — mises simultanées

```typescript
// server/src/game/BidManager.ts

export class BidManager {
  private bids = new Map<string, number>();
  private playerIds: string[];
  private revealed = false;

  constructor(playerIds: string[]) {
    this.playerIds = playerIds;
  }

  submit(playerId: string, amount: number, maxBid: number): boolean {
    if (this.revealed || amount < 0 || amount > maxBid) return false;
    this.bids.set(playerId, amount);
    return true;
  }

  allSubmitted(): boolean {
    return this.playerIds.every(id => this.bids.has(id));
  }

  reveal(): Map<string, number> {
    this.revealed = true;
    return new Map(this.bids);
  }

  reset(): void {
    this.bids.clear();
    this.revealed = false;
  }
}
```

### 6.4 Deck — génération complète

```typescript
// server/src/game/Deck.ts

import { Card, Suit } from "@sigil-king/shared";
import { v4 as uuid } from "uuid";

const SUITS: Suit[] = ["fire", "water", "air", "earth", "stasis"];

export class Deck {

  static generate(advancedCards = false): Card[] {
    const cards: Card[] = [];

    // 65 cartes élémentaires (5 suits × 13 valeurs)
    for (const suit of SUITS) {
      for (let v = 1; v <= 13; v++) {
        cards.push({ id: uuid(), type: "elemental", suit, value: v, name: `${v} ${suit}` });
      }
    }

    // 5 Incarnations
    ["Iop","Sacrieur","Roublard","Crâ","Osamodas"].forEach(name => {
      cards.push({ id: uuid(), type: "incarnation", name: `Incarnation ${name}` });
    });

    // 1 Ogrest
    cards.push({ id: uuid(), type: "ogrest", name: "Ogrest" });

    // 2 Éniripsa
    for (let i = 1; i <= 2; i++)
      cards.push({ id: uuid(), type: "eniripsa", name: `Éniripsa ${i}` });

    // 5 Pandawa
    for (let i = 1; i <= 5; i++)
      cards.push({ id: uuid(), type: "pandawa", name: `Pandawa ${i}` });

    // 1 Sram
    cards.push({ id: uuid(), type: "sram", name: "Sram" });

    // Cartes avancées
    if (advancedCards) {
      cards.push({ id: uuid(), type: "devastator", name: "Dévastateur" });
      cards.push({ id: uuid(), type: "almamater",  name: "Alma Mater"  });
    }

    return Deck.shuffle(cards);
  }

  static shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  static deal(deck: Card[], playerCount: number, round: number): Card[][] {
    const hands: Card[][] = Array.from({ length: playerCount }, () => []);
    for (let i = 0; i < round; i++)
      for (let p = 0; p < playerCount; p++) {
        const card = deck.pop();
        if (card) hands[p].push(card);
      }
    return hands;
  }
}
```

---

## 7. UI Design System

### 7.1 Palette de couleurs Dofus

```css
/* src/styles/tokens.css */
:root {
  /* Éléments */
  --color-fire:    #E8472A;
  --color-water:   #2A8CE8;
  --color-air:     #7BC96F;
  --color-earth:   #C8960C;
  --color-stasis:  #9B59B6;

  /* Table */
  --table-felt:    #1B4D1B;
  --table-felt-2:  #163D16;
  --table-rim:     #5C3310;    /* bois sombre */
  --table-gold:    #8B6914;    /* bordure dorée */

  /* UI */
  --bg-dark:       #0D1117;
  --bg-panel:      rgba(10, 8, 20, 0.85);
  --color-gold:    #FFD700;
  --color-silver:  #C0C0C0;
  --card-parchment:#F5ECD7;
  --card-border:   #8B6914;

  /* Glows */
  --glow-fire:     0 0 18px rgba(232,71,42,0.65);
  --glow-water:    0 0 18px rgba(42,140,232,0.65);
  --glow-air:      0 0 18px rgba(123,201,111,0.65);
  --glow-earth:    0 0 18px rgba(200,150,12,0.65);
  --glow-stasis:   0 0 22px rgba(155,89,182,0.75);
  --glow-gold:     0 0 28px rgba(255,215,0,0.9);
  --glow-active:   0 0 0 3px rgba(255,215,0,0.6);

  /* Typo */
  --font-title: "Cinzel Decorative", serif;   /* Google Fonts */
  --font-ui:    "Rajdhani", sans-serif;
  --font-card:  "Cinzel", serif;
}
```

### 7.2 Table ovale — CSS pur (cœur du 2.5D)

```css
/* La table verte, positionnée sur l'image de fond */
.table-felt {
  position: relative;
  width: clamp(420px, 65vw, 900px);
  aspect-ratio: 16 / 9;
  border-radius: 50%;
  margin: 0 auto;

  /* Feutre vert avec texture radiale */
  background:
    radial-gradient(ellipse at 50% 40%, #2A6A2A 0%, var(--table-felt) 50%, var(--table-felt-2) 100%);

  /* Bordure composite : bois intérieur + or extérieur */
  border: 12px solid var(--table-rim);
  outline: 3px solid var(--table-gold);
  outline-offset: -4px;

  /* Ombre portée vers le bas (effet de profondeur 2.5D) */
  box-shadow:
    0 30px 80px rgba(0,0,0,0.7),
    0 10px 30px rgba(0,0,0,0.5),
    inset 0 0 60px rgba(0,0,0,0.3),   /* ombre intérieure */
    inset 0 0 120px rgba(0,80,0,0.1); /* lumière centrale verte */
}

/* Reflet lumineux sur le bord haut de la table (effet 3D) */
.table-felt::before {
  content: "";
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  background: linear-gradient(
    to bottom,
    rgba(255,255,255,0.06) 0%,
    transparent 40%
  );
  pointer-events: none;
}

/* Ligne décorative intérieure */
.table-felt::after {
  content: "";
  position: absolute;
  inset: 12px;
  border-radius: 50%;
  border: 1px solid rgba(255, 215, 0, 0.15);
  pointer-events: none;
}
```

### 7.3 Layout 2.5D — GameBoard

```css
.game-board {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

/* Fond statique : image de taverne Dofus */
.game-background {
  position: absolute;
  inset: 0;
  background-image: url("/assets/backgrounds/taverne-dofus.jpg");
  background-size: cover;
  background-position: center 30%; /* légèrement en haut = effet perspective */
  filter: brightness(0.75) saturate(0.9);
  z-index: 0;
}

/* Vignette sombre sur les bords */
.game-background::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center,
    transparent 40%,
    rgba(0,0,0,0.6) 100%
  );
}

/* Conteneur centré de la table */
.table-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -48%) perspective(800px) rotateX(8deg);
  /* rotateX(8deg) = l'effet "vue de dessus" GoP */
  z-index: 10;
  transform-origin: center bottom;
}

/* Main du joueur local — fixée en bas */
.player-hand {
  position: fixed;
  bottom: 0;
  left: 0; right: 0;
  height: clamp(140px, 20vh, 190px);
  z-index: 30;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  /* Fond semi-transparent pour séparer la main du plateau */
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%);
}
```

---

## 8. Composants UI clés

### 8.1 GameBoard.tsx

```tsx
import { motion, AnimatePresence } from "framer-motion";
import { useGameState } from "@/hooks/useGameState";
import { TableFelt } from "./TableFelt";
import { PlayerSeat } from "./PlayerSeat";
import { PlayerHand } from "./PlayerHand";
import { TrickArea } from "./TrickArea";
import { BidModal } from "./BidModal";
import { ScoreBoard } from "./ScoreBoard";
import { ParticleCanvas } from "./ParticleCanvas";

// Positions des joueurs autour de l'ellipse (en %)
function getSeatPosition(index: number, total: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    left: `${50 + 46 * Math.cos(angle)}%`,
    top:  `${50 + 38 * Math.sin(angle)}%`,
    transform: "translate(-50%, -50%)",
  };
}

export const GameBoard = () => {
  const { state, localPlayerId } = useGameState();

  return (
    <div className="game-board">
      {/* Fond taverne Dofus */}
      <div className="game-background" />

      {/* Table 2.5D */}
      <div className="table-container">
        <TableFelt>

          {/* Avatars joueurs */}
          {state.players.map((player, i) => (
            <PlayerSeat
              key={player.id}
              player={player}
              isLocal={player.id === localPlayerId}
              style={getSeatPosition(i, state.players.length)}
            />
          ))}

          {/* Zone centrale : cartes jouées */}
          <TrickArea trick={state.currentTrick} />

          {/* Indicateur de manche */}
          <motion.div
            className="round-badge"
            key={state.round}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            Manche {state.round} / 10
          </motion.div>

        </TableFelt>
      </div>

      {/* Effets particules (overlay) */}
      <ParticleCanvas />

      {/* Main du joueur local */}
      <PlayerHand />

      {/* Modals */}
      <AnimatePresence>
        {state.phase === "bidding"  && <BidModal />}
        {state.phase === "scoring"  && <ScoreBoard result={state.roundResults.at(-1)!} />}
        {state.phase === "gameover" && <GameOver results={state.roundResults} />}
      </AnimatePresence>
    </div>
  );
};
```

### 8.2 PlayerSeat.tsx — Avatar Dofus avec idle animation

```tsx
interface PlayerSeatProps {
  player: Player;
  isLocal: boolean;
  style: React.CSSProperties;
}

export const PlayerSeat = memo(({ player, isLocal, style }: PlayerSeatProps) => {
  return (
    <motion.div
      className={[
        "player-seat",
        player.isCurrentTurn && "player-seat--active",
        !player.isConnected  && "player-seat--disconnected",
        isLocal              && "player-seat--local",
      ].filter(Boolean).join(" ")}
      style={style}
      animate={player.isCurrentTurn
        ? { filter: "drop-shadow(0 0 12px rgba(255,215,0,0.9))" }
        : { filter: "none" }
      }
      transition={{ duration: 0.4 }}
    >
      {/* Sprite avatar classe Dofus avec idle CSS */}
      <div
        className={`avatar avatar--${player.avatarClass}`}
        style={{
          // L'animation idle est une feuille de sprites CSS
          // ou un simple keyframe de "respiration" si pas de sprite sheet
          animation: player.isCurrentTurn
            ? "avatar-pulse 0.8s ease-in-out infinite alternate"
            : "avatar-idle 3s ease-in-out infinite alternate",
        }}
      />

      {/* Nameplate */}
      <div className="player-nameplate">
        <span className="player-name">{player.name}</span>
        <span className="player-score">{player.score} pts</span>
      </div>

      {/* Mise révélée */}
      <AnimatePresence>
        {player.bid !== null && (
          <motion.div
            className="bid-chip"
            initial={{ scale: 0, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            {player.bid}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Plis remportés (petite pile de cartes) */}
      {player.tricksWon > 0 && (
        <div className="tricks-stack">
          {Array.from({ length: Math.min(player.tricksWon, 5) }).map((_, i) => (
            <div key={i} className="tricks-stack__card"
              style={{ transform: `rotate(${(i - 2) * 5}deg) translateY(${-i * 2}px)` }}
            />
          ))}
          <span className="tricks-count">{player.tricksWon}</span>
        </div>
      )}
    </motion.div>
  );
});
```

### 8.3 CSS — Animations idle avatars

```css
/* Avatar idle : légère respiration */
@keyframes avatar-idle {
  0%   { transform: translateY(0px) scale(1); }
  100% { transform: translateY(-4px) scale(1.01); }
}

/* Avatar actif : pulse doré */
@keyframes avatar-pulse {
  0%   { transform: translateY(-2px) scale(1.02); filter: brightness(1.1); }
  100% { transform: translateY(-6px) scale(1.05); filter: brightness(1.25); }
}

/* Seat actif : halo doré autour du personnage */
.player-seat--active .avatar {
  filter: drop-shadow(0 0 10px rgba(255,215,0,0.8))
          drop-shadow(0 0 20px rgba(255,215,0,0.4));
}

/* Déconnecté : grisé */
.player-seat--disconnected {
  opacity: 0.45;
  filter: grayscale(0.8);
}
```

### 8.4 BidModal.tsx — Mise simultanée

```tsx
export const BidModal = () => {
  const [bid, setBid] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const { submitBid } = useGameSocket();
  const { state } = useGameState();

  return (
    <motion.div className="bid-overlay"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div className="bid-modal"
        initial={{ scale: 0.7, rotateX: -20, y: 60 }}
        animate={{ scale: 1,   rotateX: 0,   y: 0  }}
        exit={{    scale: 0.7, rotateX: 20,  y: 60 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        style={{ perspective: "600px" }}
      >
        <h2>Combien de plis ?</h2>
        <p>Manche {state.round} — {state.round} cartes en main</p>

        {!submitted ? (
          <>
            <div className="bid-counter">
              <button onClick={() => setBid(b => Math.max(0, b - 1))}>−</button>
              <motion.span key={bid}
                initial={{ scale: 1.5, color: "var(--color-gold)" }}
                animate={{ scale: 1,   color: "#ffffff" }}
                className="bid-number"
              >
                {bid}
              </motion.span>
              <button onClick={() => setBid(b => Math.min(state.round, b + 1))}>+</button>
            </div>
            <button className="btn-primary" onClick={() => { submitBid(bid); setSubmitted(true); }}>
              Miser
            </button>
          </>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bid-waiting">
            <div className="spinner" />
            <p>En attente des autres joueurs…</p>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};
```

---

## 9. Cartes numérotées — SVG inline

### Principe : 1 composant → 65 cartes, zéro fichier image

```tsx
// src/components/cards/NumberedCard.tsx

const SUIT_PATHS = {
  fire:   { color: "#E8472A", path: "M12 2 C12 2 8 7 8 11 C8 14.3 9.8 16 12 16 C14.2 16 16 14.3 16 11 C16 7 12 2 12 2Z" },
  water:  { color: "#2A8CE8", path: "M12 3 C9 8 6 10 6 14 C6 17.3 8.7 20 12 20 C15.3 20 18 17.3 18 14 C18 10 15 8 12 3Z" },
  air:    { color: "#7BC96F", path: "M12 4 C12 4 6 8 6 12 C6 14 7 15 8 15 C9 15 10 14 10 13 L10 15 C10 17 11 18 12 18 C13 18 14 17 14 15 L14 13 C14 14 15 15 16 15 C17 15 18 14 18 12 C18 8 12 4 12 4Z" },
  earth:  { color: "#C8960C", path: "M12 3 L15 8 L20 8 L16 12 L18 18 L12 15 L6 18 L8 12 L4 8 L9 8 Z" },
  stasis: { color: "#9B59B6", path: "M12 2 L14 7 L19 7 L15 11 L17 17 L12 13 L7 17 L9 11 L5 7 L10 7 Z M12 6 L13 9 L16 9 L14 11 L15 14 L12 12 L9 14 L10 11 L8 9 L11 9 Z" },
};

// Positions des pips pour chaque valeur (1→10)
const PIP_LAYOUTS = {
  1:  [{ x:50, y:50 }],
  2:  [{ x:50, y:25 }, { x:50, y:75, r:180 }],
  3:  [{ x:50, y:20 }, { x:50, y:50 }, { x:50, y:80, r:180 }],
  4:  [{ x:30, y:25 }, { x:70, y:25 }, { x:30, y:75, r:180 }, { x:70, y:75, r:180 }],
  5:  [{ x:30, y:25 }, { x:70, y:25 }, { x:50, y:50 }, { x:30, y:75, r:180 }, { x:70, y:75, r:180 }],
  6:  [{ x:30, y:22 }, { x:70, y:22 }, { x:30, y:50 }, { x:70, y:50 }, { x:30, y:78, r:180 }, { x:70, y:78, r:180 }],
  7:  [{ x:30, y:20 }, { x:70, y:20 }, { x:50, y:35 }, { x:30, y:50 }, { x:70, y:50 }, { x:30, y:75, r:180 }, { x:70, y:75, r:180 }],
  8:  [{ x:30, y:20 }, { x:70, y:20 }, { x:50, y:33 }, { x:30, y:50 }, { x:70, y:50 }, { x:50, y:65, r:180 }, { x:30, y:78, r:180 }, { x:70, y:78, r:180 }],
  9:  [{ x:30, y:18 }, { x:70, y:18 }, { x:30, y:36 }, { x:70, y:36 }, { x:50, y:50 }, { x:30, y:64, r:180 }, { x:70, y:64, r:180 }, { x:30, y:82, r:180 }, { x:70, y:82, r:180 }],
  10: [{ x:30, y:18 }, { x:70, y:18 }, { x:50, y:28 }, { x:30, y:40 }, { x:70, y:40 }, { x:30, y:60, r:180 }, { x:70, y:60, r:180 }, { x:50, y:72, r:180 }, { x:30, y:82, r:180 }, { x:70, y:82, r:180 }],
  11: [{ x:50, y:50 }], // Acolyte
  12: [{ x:50, y:50 }], // Champion
  13: [{ x:50, y:50 }], // Seigneur
};

const FIGURE_NAMES = { 11: "Acolyte", 12: "Champion", 13: "Seigneur" };
const DISPLAY_VALUE = (v: number) => ({ 1: "A", 11: "J", 12: "Q", 13: "K" }[v] ?? String(v));

const SIZES = {
  sm: { w: 56,  h: 84,  pip: 10, corner: 10 },
  md: { w: 80,  h: 120, pip: 14, corner: 13 },
  lg: { w: 110, h: 165, pip: 20, corner: 18 },
};

export const NumberedCard = memo(({ suit, value, size = "md", playable = true, selected = false, onClick }) => {
  const dim = SIZES[size];
  const { color, path } = SUIT_PATHS[suit];
  const pips = PIP_LAYOUTS[value];
  const isFigure = value >= 11;
  const scale = (dim.pip) / 24;
  const cornerScale = (dim.corner - 2) / 24;

  const pipAreaTop    = dim.h * 0.22;
  const pipAreaH      = dim.h * 0.56;
  const pipAreaLeft   = dim.w * 0.15;
  const pipAreaW      = dim.w * 0.70;

  return (
    <svg width={dim.w} height={dim.h} viewBox={`0 0 ${dim.w} ${dim.h}`}
      className={["card", `card--${suit}`, !playable && "card--disabled", selected && "card--selected"].filter(Boolean).join(" ")}
      onClick={playable ? onClick : undefined}
    >
      <defs>
        <linearGradient id={`bg-${suit}`} x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#FAF0E0" />
          <stop offset="100%" stopColor="#EDE0C4" />
        </linearGradient>
      </defs>

      {/* Fond parchemin */}
      <rect x="1" y="1" width={dim.w-2} height={dim.h-2} rx="6"
        fill={`url(#bg-${suit})`}
        stroke={selected ? "#FFD700" : color}
        strokeWidth={selected ? 2.5 : 1.5}
      />

      {/* Coin haut-gauche */}
      <text x={4} y={dim.corner+1} fontSize={dim.corner} fontWeight="bold" fill={color} fontFamily="Cinzel, serif">{DISPLAY_VALUE(value)}</text>
      <g transform={`translate(4, ${dim.corner+3}) scale(${cornerScale})`}><path d={path} fill={color} /></g>

      {/* Coin bas-droit (miroir) */}
      <g transform={`rotate(180, ${dim.w/2}, ${dim.h/2})`}>
        <text x={4} y={dim.corner+1} fontSize={dim.corner} fontWeight="bold" fill={color} fontFamily="Cinzel, serif">{DISPLAY_VALUE(value)}</text>
        <g transform={`translate(4, ${dim.corner+3}) scale(${cornerScale})`}><path d={path} fill={color} /></g>
      </g>

      {/* Zone centrale */}
      {isFigure ? (
        <>
          <g transform={`translate(${dim.w/2 - dim.pip*1.2}, ${pipAreaTop + pipAreaH*0.15}) scale(${dim.pip*2.2/24})`}>
            <path d={path} fill={color} />
          </g>
          <text x={dim.w/2} y={pipAreaTop + pipAreaH*0.82} fontSize={dim.w*0.1} fill={color} fontFamily="Cinzel, serif" textAnchor="middle">{FIGURE_NAMES[value]}</text>
        </>
      ) : pips.map((pos, i) => {
        const px = pipAreaLeft + (pos.x / 100) * pipAreaW;
        const py = pipAreaTop  + (pos.y / 100) * pipAreaH;
        return (
          <g key={i} transform={`translate(${px - dim.pip/2}, ${py - dim.pip/2}) ${pos.r ? `rotate(${pos.r}, ${dim.pip/2}, ${dim.pip/2})` : ""} scale(${scale})`}>
            <path d={path} fill={color} />
          </g>
        );
      })}

      {/* Ligne décorative */}
      <line x1={dim.w*0.2} y1={dim.h/2} x2={dim.w*0.8} y2={dim.h/2}
        stroke={color} strokeWidth="0.4" strokeOpacity="0.25" strokeDasharray="2,3" />
    </svg>
  );
});
```

---

## 10. Animations & Effets

### 10.1 Stratégie GPU-first

```
✅ Utiliser : transform, opacity, filter (compositing layer)
❌ Éviter   : top, left, width, height, margin (reflow)

will-change: transform → uniquement pendant l'animation active
             retirer avec will-change: auto après la fin
```

### 10.2 Distribution des cartes (stagger)

```tsx
const dealVariants = {
  hidden:  { opacity: 0, scale: 0, y: -200, rotate: -30 },
  visible: (i: number) => ({
    opacity: 1, scale: 1, y: 0, rotate: 0,
    transition: { delay: i * 0.08, type: "spring", stiffness: 260, damping: 20 },
  }),
};

// <motion.div variants={dealVariants} initial="hidden" animate="visible" custom={cardIndex} />
```

### 10.3 FLIP — cartes qui volent vers le gagnant

```tsx
// layoutId = card.id sur toutes les instances d'une même carte
// Framer Motion calcule automatiquement la trajectoire entre les 2 positions DOM

// Dans TrickArea (carte jouée)
<motion.div layoutId={played.card.id}>
  <CardComponent card={played.card} />
</motion.div>

// Dans PlayerSeat (pile des plis gagnés)
// Quand la carte change de parent DOM, elle "vole" automatiquement
<motion.div layoutId={card.id}>
  <CardBack size="sm" />
</motion.div>
```

### 10.4 Révélation simultanée des mises

```tsx
// Toutes les mises apparaissent EN MÊME TEMPS avec un spring
{bids.map(({ playerId, amount }, i) => (
  <motion.div key={playerId}
    initial={{ scale: 0, y: -20, opacity: 0 }}
    animate={{ scale: 1, y: 0,   opacity: 1 }}
    transition={{ type: "spring", delay: i * 0.05, stiffness: 400, damping: 18 }}
  >
    <BidChip value={amount} />
  </motion.div>
))}
```

### 10.5 Effet particules Canvas (bonus Éniripsa/Ogrest)

```typescript
// src/components/game/ParticleCanvas.tsx

export function spawnParticles(
  canvas: HTMLCanvasElement,
  x: number, y: number,
  color: string,
  count = 30
) {
  const ctx = canvas.getContext("2d")!;
  const particles = Array.from({ length: count }, () => ({
    x, y,
    vx: (Math.random() - 0.5) * 8,
    vy: (Math.random() - 0.5) * 8 - 3,
    radius: Math.random() * 4 + 2,
    alpha: 1,
    color,
  }));

  let frame: number;
  const animate = () => {
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravité
      p.alpha -= 0.025;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    if (particles.some(p => p.alpha > 0)) frame = requestAnimationFrame(animate);
  };
  frame = requestAnimationFrame(animate);
  return () => cancelAnimationFrame(frame);
}
```

---

## 11. Responsive & Mobile

```css
/* Tailles adaptatives via clamp */
:root {
  --card-width:  clamp(52px, 7vw, 88px);
  --card-height: calc(var(--card-width) * 1.5);
}

/* Table se rétrécit sur mobile */
.table-felt {
  width: clamp(300px, 90vw, 900px);
}

/* Inclinaison perspective réduite sur mobile */
@media (max-width: 640px) {
  .table-container {
    transform: translate(-50%, -46%) perspective(600px) rotateX(4deg);
  }
  /* Avatars plus petits, réorganisés */
  .player-seat .avatar { transform: scale(0.75); }
}
```

```tsx
// Swipe up pour jouer une carte (mobile)
import { useDrag } from "@use-gesture/react";

const bind = useDrag(({ movement: [, my], velocity: [, vy], last }) => {
  if (last && my < -50 && vy > 0.5) handlePlay(card);
});
```

---

## 12. Performance & Optimisation

```tsx
// Mémoriser les composants coûteux
export const CardComponent  = memo(...);
export const PlayerSeat     = memo(...);
export const NumberedCard   = memo(...);

// Sélecteurs Zustand granulaires
const trick   = useGameStore(s => s.currentTrick);  // ✅ re-render ciblé
const state   = useGameStore(s => s);               // ❌ re-render global

// Préchargement image de fond
// <link rel="preload" href="/assets/backgrounds/taverne-dofus.jpg" as="image" />

// Payloads Socket.io minimaux — ne jamais envoyer l'état complet à chaque action
socket.emit("card:played", { playerId, card });            // ✅
socket.emit("game:state", entireGameState);                // ❌
```

---

## 13. Socket.io — Flux temps réel

### Séquence complète d'une manche

```
CLIENT A                    SERVER                  AUTRES CLIENTS
    │                          │                         │
    ├── game:join ────────────>│                         │
    │                          ├── player:joined ───────>│
    │                          ├── game:state ──────────>│
    │<── game:state ───────────┤                         │
    │                          │                         │
    ├── game:start ───────────>│ (host only)             │
    │                          ├── game:state (bidding) >│
    │<── game:state (bidding) ─┤                         │
    │                          │                         │
    ├── bid:submit(2) ─────────┤                         │
    │                          │<── bid:submit(1) ───────┤
    │                          │<── bid:submit(3) ───────┤
    │                          │  (attend TOUS)          │
    │<── bid:reveal ───────────┼─────────────────────── >│
    │<── game:state (playing) ─┼─────────────────────── >│
    │                          │                         │
    ├── card:play(id) ─────────┤                         │
    │                          ├── card:played ─────────>│
    │<── card:played ──────────┤                         │
    │                          │  (... tous jouent ...)  │
    │<── game:trick_resolved ──┼─────────────────────── >│
    │<── game:state (new) ─────┼─────────────────────── >│
    │                          │  (... 10 manches ...)   │
    │<── game:over ────────────┼─────────────────────── >│
```

### Gestion déconnexion / reconnexion

```typescript
socket.on("disconnect", () => {
  const game = gameManager.findByPlayer(socket.id);
  if (!game) return;
  game.markDisconnected(socket.id);
  io.to(game.id).emit("player:disconnected", socket.id);

  // Timer 60s avant forfait
  socket.data.timeout = setTimeout(() => {
    game.removePlayer(socket.id);
    if (game.playerCount < 2) game.pause();
  }, 60_000);
});

socket.on("game:rejoin", (roomId, playerId) => {
  clearTimeout(socket.data.timeout);
  const game = gameManager.findById(roomId);
  game?.reconnect(playerId, socket.id);
  socket.emit("game:state", game?.getPublicState(playerId));
});
```

---

## 14. Roadmap

### Sprint 1 — Core Game Logic (1 semaine)
- [ ] Types TypeScript partagés (`Card`, `GameState`, événements Socket)
- [ ] `Deck.ts` : génération + shuffle des 66 (ou 68) cartes
- [ ] `TrickResolver.ts` : tous les cas (Sram, double Incarnation, Dévastateur, Alma Mater)
- [ ] `ScoreCalculator.ts` : scoring complet + bonus + Storm mode
- [ ] `BidManager.ts` : mises simultanées avec reveal
- [ ] Tests unitaires : résolution de plis, calcul de scores

### Sprint 2 — Serveur Socket.io (1 semaine)
- [ ] `GameManager` : rooms, join, start, reconnect
- [ ] Handlers Socket.io pour chaque événement
- [ ] Gestion des tours + timeout configurable
- [ ] Déconnexion / reconnexion avec timer 60s

### Sprint 3 — UI de base (2 semaines)
- [ ] Design System CSS (tokens, palette, typo)
- [ ] Image de fond taverne Dofus (génération IA)
- [ ] `TableFelt.tsx` : table ovale CSS + perspective
- [ ] `NumberedCard.tsx` : SVG inline avec pips + figures
- [ ] `CardBack.tsx` : dos SVG inline
- [ ] `SpecialCard.tsx` : Ogrest, Éniripsa, Sram…
- [ ] `PlayerSeat.tsx` : avatar + nameplate + idle animation
- [ ] `PlayerHand.tsx` : éventail + règle de suivi (grisage)
- [ ] `TrickArea.tsx` : cartes jouées au centre

### Sprint 4 — Modals & Flux (1 semaine)
- [ ] `BidModal.tsx` : mise simultanée
- [ ] `ScoreBoard.tsx` : résultats de manche animés
- [ ] `GameOver.tsx` : classement final
- [ ] `SramChoiceModal.tsx` : choix Incarnation/Pandawa
- [ ] Toasts pour les bonus (Éniripsa, Incarnation)
- [ ] Timer visuel si `timeoutPlay > 0`

### Sprint 5 — Animations & Polish (1 semaine)
- [ ] Distribution des cartes (stagger Framer Motion)
- [ ] Carte jouée → table (FLIP `layoutId`)
- [ ] Pli remporté → joueur (FLIP `layoutId`)
- [ ] Révélation simultanée des mises (spring)
- [ ] Particules Canvas pour les bonus
- [ ] Glow pulsant sur joueur actif

### Sprint 6 — Responsive + Intégration Dashboard (0.5 semaine)
- [ ] Adaptation mobile (`clamp`, touch swipe, `safe-area-inset`)
- [ ] Route `/game/sigil-king` dans le dashboard de guilde
- [ ] Auth via session Discord existante
- [ ] Historique des parties + stats joueurs
- [ ] Invitation par lien (`roomId` dans l'URL)

---

> **Total estimé : 6–8 semaines week-end**  
> Le Sprint 1 est le plus critique : bien tester la logique métier évite toutes les incohérences de jeu en production.  
> Le rendu 2.5D (fond image + CSS) est atteignable seul, sans graphiste dédié.
