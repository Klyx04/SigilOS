/**
 * Types pour le Raid Studio 3.6 (SigilOS)
 * 100% zéro dépendance externe, données vérifiées Dofus 3.6
 */

export type RaidId = "gigalodon" | "sanctuaire";

export interface DofusClassDef {
    id: number;
    name: string;
    icon: string; // Ex: /assets/dofus/classes/1.png
}

export const DOFUS_CLASSES: DofusClassDef[] = [
    { id: 1, name: "Féca", icon: "/assets/dofus/classes/1.png" },
    { id: 2, name: "Osamodas", icon: "/assets/dofus/classes/2.png" },
    { id: 3, name: "Enutrof", icon: "/assets/dofus/classes/3.png" },
    { id: 4, name: "Sram", icon: "/assets/dofus/classes/4.png" },
    { id: 5, name: "Xélor", icon: "/assets/dofus/classes/5.png" },
    { id: 6, name: "Ecaflip", icon: "/assets/dofus/classes/6.png" },
    { id: 7, name: "Eniripsa", icon: "/assets/dofus/classes/7.png" },
    { id: 8, name: "Iop", icon: "/assets/dofus/classes/8.png" },
    { id: 9, name: "Crâ", icon: "/assets/dofus/classes/9.png" },
    { id: 10, name: "Sadida", icon: "/assets/dofus/classes/10.png" },
    { id: 11, name: "Sacrieur", icon: "/assets/dofus/classes/11.png" },
    { id: 12, name: "Pandawa", icon: "/assets/dofus/classes/12.png" },
    { id: 13, name: "Roublard", icon: "/assets/dofus/classes/13.png" },
    { id: 14, name: "Zobal", icon: "/assets/dofus/classes/14.png" },
    { id: 15, name: "Steamer", icon: "/assets/dofus/classes/15.png" },
    { id: 16, name: "Eliotrope", icon: "/assets/dofus/classes/16.png" },
    { id: 17, name: "Huppermage", icon: "/assets/dofus/classes/17.png" },
    { id: 18, name: "Ouginak", icon: "/assets/dofus/classes/18.png" },
    { id: 20, name: "Forgelance", icon: "/assets/dofus/classes/20.png" },
];

/** Rôles tactiques génériques compréhensibles par la communauté Dofus */
export type RoleKey =
    | "tank"
    | "healer"
    | "dps-range"
    | "dps-melee"
    | "debuff"
    | "support"
    | "placement"
    | "control"
    | "utility";

export interface RaidRole {
    key: RoleKey;
    color: string; // Tailwind-compatible color token
}

export const RAID_ROLES: RaidRole[] = [
    { key: "tank", color: "blue" },
    { key: "healer", color: "emerald" },
    { key: "dps-range", color: "rose" },
    { key: "dps-melee", color: "orange" },
    { key: "debuff", color: "violet" },
    { key: "support", color: "teal" },
    { key: "placement", color: "amber" },
    { key: "control", color: "cyan" },
    { key: "utility", color: "slate" },
];

export interface RaidSlot {
    id: string;
    wing: 1 | 2;
    indexInWing: number;
    pseudo: string;
    classId: number | null;
    roleKey: RoleKey;
    initiative: number;
    isConfirmed: boolean;
}

export interface RaidPreset {
    id: string;
    name: string;
    raidId: RaidId;
    slots: RaidSlot[];
}

// Luminarium types
export type LuminariumGrid = number[][]; // 4x4 of 0/1

// Jardins Enigma types
export interface EchecsState {
    tourBlanche: string | null;
    tourNoire: string | null;
    fouBlanc: string | null;
    fouNoir: string | null;
}

export type BelladoneItemKey =
    | "crayon"
    | "bobine"
    | "lanterne"
    | "kamas"
    | "arakne"
    | "bougie"
    | "bague"
    | "regle";

export interface BelladoneRomanSlot {
    items: (BelladoneItemKey | null)[];
    hasFlower: boolean;
}

export type BelladoneState = Record<"I" | "II" | "III" | "IV", BelladoneRomanSlot>;

export interface BattleshipGrid {
    mapLabel: string;
    cells: Record<string, boolean>; // e.g. "A1": true
}

export type StatueColorKey = "orange" | "bleu" | "rouge" | "vert";
export type StatueSpriteKey = "fracamelia" | "tritulipe" | "muguegide" | "dahliane";

export interface StatueResult {
    pos: string;
    arrow: string;
}
