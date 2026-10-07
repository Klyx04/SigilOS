/**
 * Donjon tactique générique — socle partagé des simulations de donjons
 * (`fers-tyrannie.ts`, `tour-solar.ts`, …).
 *
 * Une seule source de vérité pour la logique (salles, layouts, pose auto,
 * butin) : les fichiers de donjons ne portent que des **données siphonnées**
 * (+ de fins délégués homonymes, testés). Le rendu vit dans
 * `src/components/dungeons/dungeon-tactical.tsx` (`DungeonTactical`), nourri
 * par un `TacticalDungeon`.
 */

export interface TacticalRoomVariant {
    /** `normal` = salle du donjon (`DungeonData`), `alt` = layout Dofensive (référence des simulations). */
    key: "normal" | "alt";
    label: string;
    /** mapId client de la variante. */
    mapId: number;
    /** Cases de départ monstres (rouges côté jeu : défenseurs, triées croissant = ordre de pose). */
    red: number[];
    /** Cases de départ joueurs (bleues côté jeu : attaquants, triées croissant). */
    blue: number[];
    blocked: number[];
    /** Cases `mov == 0 && los == 1` brutes (vide + puisards, voir `splitHoles`) — propres à chaque map. */
    holes: number[];
}

export interface TacticalRoom {
    /** 1-N (ordre du donjon). */
    index: number;
    /** mapId client. */
    mapId: number;
    /** Nom résolu (`<Donjon> - … salle`). */
    name: string;
    /** Cases de départ monstres (rouges côté jeu : défenseurs, triées croissant = ordre de pose). */
    red: number[];
    /** Cases de départ joueurs (bleues côté jeu : attaquants, triées croissant). */
    blue: number[];
    /** Obstacles (`los == 0 || nonWalkableDuringFight == 1`, gris 3D de la preview `L`). */
    blocked: number[];
    /**
     * Cases `mov == 0 && los == 1` brutes du client : mélange de vide hors-carte
     * (connecté au bord, transparent en preview `L`) et de vrais puisards
     * (enclavés). Séparer via `splitHoles` (`dofus-grid`) avant tout rendu.
     */
    holes: number[];
    /** Autres layouts possibles de la même salle. */
    variants: TacticalRoomVariant[];
}

export interface TacticalMonster {
    id: number;
    name: string;
    isBoss: boolean;
    /** gfxId client (portrait `Picto/Monsters/<gfxId>.png`). */
    gfxId: number;
    /** Portrait réel du jeu, servi en local. */
    portrait: string;
    /** Niveau au grade 5 (référence des simulations). */
    level: number;
    lifePoints: number;
    actionPoints: number;
    movementPoints: number;
    resistances: {
        neutral: number;
        earth: number;
        fire: number;
        water: number;
        air: number;
    };
}

export interface TacticalLayout {
    mapId: number;
    label: string;
    red: number[];
    blue: number[];
    blocked: number[];
    holes: number[];
}

export interface TacticalMonsterPlacement {
    cellId: number;
    monsterId: number;
}

export interface TacticalDungeon {
    /** Clé stable (onglets, stockage local). */
    key: string;
    dungeonId: number;
    dungeonName: string;
    gameVersion: string;
    rooms: TacticalRoom[];
    monsters: TacticalMonster[];
    /** Composition par défaut d'une salle (modifiable dans l'UI). */
    defaultRoster: (roomIndex: number) => number[];
    /** Clé localStorage (isolée par donjon). */
    storageKey: string;
}

/** Salle par index, `undefined` hors bornes (jamais d'exception). */
export function getTacticalRoom(rooms: TacticalRoom[], index: number): TacticalRoom | undefined {
    return rooms.find((r) => r.index === index);
}

/** Placement actif d'une salle (normal ou variante), jamais d'exception. */
export function activeTacticalLayout(room: TacticalRoom, variantKey: string): TacticalLayout {
    const alt = room.variants.find((v) => v.key === variantKey);
    if (alt) {
        return { mapId: alt.mapId, label: alt.label, red: alt.red, blue: alt.blue, blocked: alt.blocked, holes: alt.holes };
    }
    return { mapId: room.mapId, label: `Normal (${room.red.length}/${room.blue.length})`, red: room.red, blue: room.blue, blocked: room.blocked, holes: room.holes };
}

/** Butin : taille d'équipe bornée 1-8 (solo → 8 joueurs). */
export function clampTacticalTeam(n: unknown): number {
    const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 4;
    return Math.min(8, Math.max(1, v));
}

/**
 * Pose auto des monstres sur les cases de monstres (`room.blue`, glyphes bleus en jeu —
 * convention Dofus prouvée : défenseurs = bleu), dans l'ordre (premier monstre sur la plus
 * petite case — même convention que `computeMonsterPlacements` pour le boss). Tronque au
 * nombre de cases disponibles. Les classes joueurs se posent sur les cases rouges (`room.red`,
 * glyphes rouges = attaquants).
 */
export function autoPlaceTactical(room: TacticalRoom, monsterIds: number[]): TacticalMonsterPlacement[] {
    return monsterIds.slice(0, room.blue.length).map((monsterId, i) => ({
        cellId: room.blue[i],
        monsterId,
    }));
}

/**
 * Composition par défaut d'une salle (modifiable dans l'UI) : les mobs seuls
 * en salles 1-4, boss + mobs en salle boss. La compo réelle varie en jeu
 * (butin, salle) — c'est un point de départ, pas une vérité serveur.
 */
export function defaultTacticalRoster(monsters: TacticalMonster[], roomIndex: number, bossRoomIndex: number): number[] {
    const mobIds = monsters.filter((m) => !m.isBoss).map((m) => m.id);
    const boss = monsters.find((m) => m.isBoss);
    if (roomIndex === bossRoomIndex && boss) return [boss.id, ...mobIds];
    return mobIds;
}
