/**
 * Songes Module - Types and Constants
 * Based on official data from dofuspourlesnoobs.com
 */

// ============================================
// DOFUS CLASSES
// ============================================

export const DOFUS_CLASSES = [
    "Cra",
    "Ecaflip",
    "Eliotrope",
    "Eniripsa",
    "Enutrof",
    "Féca",
    "Forgelance",
    "Huppermage",
    "Iop",
    "Osamodas",
    "Ouginak",
    "Pandawa",
    "Roublard",
    "Sacrieur",
    "Sadida",
    "Sram",
    "Steamer",
    "Xélor",
    "Zobal",
] as const;

export type DofusClass = typeof DOFUS_CLASSES[number];

// ============================================
// CONSTANTS - Official Game Data
// ============================================

/**
 * Les 5 paliers officiels des Songes Infinis
 */
export const PALIERS = [
    {
        id: 1,
        nom: "Les Pensées oniriques",
        etages: [1, 2, 3],
        couleur: "#22c55e",  // Vert
        prNormal: 5,
        prDifficile: 15,
    },
    {
        id: 2,
        nom: "Les Balades fantastiques",
        etages: [4, 5, 6, 7, 8, 9],
        couleur: "#3b82f6",  // Bleu
        prNormal: 5,
        prDifficile: 15,
    },
    {
        id: 3,
        nom: "Les Espaces imaginaires",
        etages: [10, 11, 12, 13, 14, 15],
        couleur: "#a855f7",  // Violet
        prNormal: 5,
        prDifficile: 15,
    },
    {
        id: 4,
        nom: "Les Concepts brumeux",
        etages: [16, 17, 18, 19, 20, 21],
        couleur: "#f97316",  // Orange
        prNormal: 5,
        prDifficile: 15,
    },
    {
        id: 5,
        nom: "Les Abstractions chimériques",
        etages: [22, 23, 24, 25, 26],
        couleur: "#ef4444",  // Rouge
        prNormal: 10,
        prDifficile: 20,
    },
] as const;

/**
 * Jalons (Fontaines guaranties) - Entrées de chaque palier sauf le premier
 */
export const JALONS = [4, 10, 16, 22] as const;

/**
 * Configuration des 10 difficultés
 */
export const DIFFICULTIES = {
    REVE_I: {
        label: "Rêve I",
        category: "Rêve",
        xpBonus: 50,
        vagues: 2,
        couleur: "#22c55e",
        niveauParPalier: 23,
    },
    REVE_II: {
        label: "Rêve II",
        category: "Rêve",
        xpBonus: 75,
        vagues: 2,
        couleur: "#4ade80",
        niveauParPalier: 24,
    },
    REVE_III: {
        label: "Rêve III",
        category: "Rêve",
        xpBonus: 100,
        vagues: 2,
        couleur: "#86efac",
        niveauParPalier: 25,
    },
    PARADOXE_I: {
        label: "Paradoxe I",
        category: "Paradoxe",
        xpBonus: 120,
        vagues: 3,
        couleur: "#60a5fa",
        niveauParPalier: 25,
    },
    PARADOXE_II: {
        label: "Paradoxe II",
        category: "Paradoxe",
        xpBonus: 140,
        vagues: 3,
        couleur: "#3b82f6",
        niveauParPalier: 26,
    },
    PARADOXE_III: {
        label: "Paradoxe III",
        category: "Paradoxe",
        xpBonus: 160,
        vagues: 3,
        couleur: "#2563eb",
        niveauParPalier: 27,
    },
    PARADOXE_IV: {
        label: "Paradoxe IV",
        category: "Paradoxe",
        xpBonus: 190,
        vagues: 3,
        couleur: "#1d4ed8",
        niveauParPalier: 27,
    },
    CAUCHEMAR_I: {
        label: "Cauchemar I",
        category: "Cauchemar",
        xpBonus: 220,
        vagues: 4,
        couleur: "#f87171",
        niveauParPalier: 30,
    },
    CAUCHEMAR_II: {
        label: "Cauchemar II",
        category: "Cauchemar",
        xpBonus: 250,
        vagues: 4,
        couleur: "#ef4444",
        niveauParPalier: 32,
    },
    CAUCHEMAR_III: {
        label: "Cauchemar III",
        category: "Cauchemar",
        xpBonus: 300,
        vagues: 4,
        couleur: "#dc2626",
        niveauParPalier: 35,
    },
} as const;

/**
 * Types de salles
 */
export const ROOM_TYPES = {
    COMBAT: { label: "Combat", icon: "⚔️", couleur: "#4ade80" },
    FONTAINE: { label: "Fontaine Onirique", icon: "⛲", couleur: "#3b82f6" },
    FAVEUR: { label: "Faveur Onirique", icon: "🌟", couleur: "#a855f7" },
    BOSS: { label: "Boss Final", icon: "👑", couleur: "#fbbf24" },
} as const;

/**
 * Objectifs de run
 */
export const OBJECTIVES = {
    MISSION_GUILDE: { label: "Mission de Guilde", icon: "🎯" },
    DROP_LEGENDE: { label: "Farm Légendes", icon: "💎" },
    SUCCES_NO_ACHAT: { label: "Succès No Achat", icon: "🏆" },
    FUN: { label: "Pour le fun", icon: "🎮" },
} as const;

// ============================================
// TYPES
// ============================================

export type DifficultyKey = keyof typeof DIFFICULTIES;
export type RoomTypeKey = keyof typeof ROOM_TYPES;
export type ObjectiveKey = keyof typeof OBJECTIVES;

export type Palier = typeof PALIERS[number];
export type Difficulty = typeof DIFFICULTIES[DifficultyKey];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Retourne le palier correspondant à un étage
 */
export function getPalierFromFloor(floor: number): Palier {
    return PALIERS.find(p => (p.etages as readonly number[]).includes(floor)) ?? PALIERS[0];
}

/**
 * Retourne la couleur d'un étage
 */
export function getFloorColor(floor: number): string {
    return getPalierFromFloor(floor).couleur;
}

/**
 * Vérifie si un étage est un jalon (fontaine garantie)
 */
export function isJalon(floor: number): boolean {
    return JALONS.includes(floor as typeof JALONS[number]);
}

/**
 * Retourne les points de rêve pour un étage
 */
export function getPointsReveForFloor(floor: number, isDifficile: boolean): number {
    const palier = getPalierFromFloor(floor);
    return isDifficile ? palier.prDifficile : palier.prNormal;
}

/**
 * Retourne le label de difficulté formaté
 */
export function getDifficultyLabel(difficulty: DifficultyKey): string {
    return DIFFICULTIES[difficulty].label;
}

/**
 * Retourne la couleur de difficulté
 */
export function getDifficultyColor(difficulty: DifficultyKey): string {
    return DIFFICULTIES[difficulty].couleur;
}

/**
 * Parse le fichier bonus_songes.json
 */
export type SongesBonus = {
    rarete: "Commun" | "Rare" | "Épique" | "Légendaire";
    nom: string;
    type: "passif" | "actif" | "bonus" | "consommable";
    type_label: string;
    description: string;
    effets: string;
    infos?: string;
    cout: number;
};

/**
 * Filtre les bonus par rareté
 */
export function filterBonusByRarity(
    bonuses: SongesBonus[],
    rarete: SongesBonus["rarete"]
): SongesBonus[] {
    return bonuses.filter(b => b.rarete === rarete);
}

/**
 * Filtre les bonus par type
 */
export function filterBonusByType(
    bonuses: SongesBonus[],
    type: SongesBonus["type"]
): SongesBonus[] {
    return bonuses.filter(b => b.type === type);
}
