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
        // Asset local (source unique : site + embeds) — le même picto partout.
        asset: "/assets/missions/reve1.png",
        xpBonus: 50,
        vagues: 2,
        couleur: "#22c55e",
        niveauParPalier: 23,
    },
    REVE_II: {
        label: "Rêve II",
        category: "Rêve",
        asset: "/assets/missions/reve2.png",
        xpBonus: 75,
        vagues: 2,
        couleur: "#4ade80",
        niveauParPalier: 24,
    },
    REVE_III: {
        label: "Rêve III",
        category: "Rêve",
        asset: "/assets/missions/reve3.png",
        xpBonus: 100,
        vagues: 2,
        couleur: "#86efac",
        niveauParPalier: 25,
    },
    PARADOXE_I: {
        label: "Paradoxe I",
        category: "Paradoxe",
        asset: "/assets/missions/paradoxe1.png",
        xpBonus: 120,
        vagues: 3,
        couleur: "#60a5fa",
        niveauParPalier: 25,
    },
    PARADOXE_II: {
        label: "Paradoxe II",
        category: "Paradoxe",
        asset: "/assets/missions/paradoxe2.png",
        xpBonus: 140,
        vagues: 3,
        couleur: "#3b82f6",
        niveauParPalier: 26,
    },
    PARADOXE_III: {
        label: "Paradoxe III",
        category: "Paradoxe",
        asset: "/assets/missions/paradoxe3.png",
        xpBonus: 160,
        vagues: 3,
        couleur: "#2563eb",
        niveauParPalier: 27,
    },
    PARADOXE_IV: {
        label: "Paradoxe IV",
        category: "Paradoxe",
        asset: "/assets/missions/paradoxe4.png",
        xpBonus: 190,
        vagues: 3,
        couleur: "#1d4ed8",
        niveauParPalier: 27,
    },
    CAUCHEMAR_I: {
        label: "Cauchemar I",
        category: "Cauchemar",
        asset: "/assets/missions/cauchemar1.png",
        xpBonus: 220,
        vagues: 4,
        couleur: "#f87171",
        niveauParPalier: 30,
    },
    CAUCHEMAR_II: {
        label: "Cauchemar II",
        category: "Cauchemar",
        asset: "/assets/missions/cauchemar2.png",
        xpBonus: 250,
        vagues: 4,
        couleur: "#ef4444",
        niveauParPalier: 32,
    },
    CAUCHEMAR_III: {
        label: "Cauchemar III",
        category: "Cauchemar",
        asset: "/assets/missions/cauchemar3.png",
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
    COMBAT: { label: "Combat", asset: "/assets/dofus/icons/crossedSwords.png", couleur: "#4ade80" },
    FONTAINE: { label: "Fontaine Onirique", asset: "/assets/dofus/icons/teleport.png", couleur: "#3b82f6" },
    FAVEUR: { label: "Faveur Onirique", asset: "/assets/dofus/icons/starFilled.png", couleur: "#a855f7" },
    BOSS: { label: "Boss Final", asset: "/assets/dofus/icons/boss.png", couleur: "#fbbf24" },
} as const;

/**
 * Objectifs de run
 */
export const OBJECTIVES = {
    MISSION_GUILDE: { label: "Mission de Guilde", asset: "/assets/dofus/icons/guild.png" },
    DROP_LEGENDE: { label: "Farm Légendes", asset: "/assets/dofus/icons/chest.png" },
    SUCCES_NO_ACHAT: { label: "Succès No Achat", asset: "/assets/dofus/icons/success.png" },
    FUN: { label: "Fun / Chill", asset: "/assets/dofus/icons/heart.png" },
    QUETE: { label: "Quête", asset: "/assets/dofus/icons/quests.png" },
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
 * Parse le fichier src/data/bonus_songes.json
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
    nouveau?: boolean; // MAJ 3.5 : nouveau bonus
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

// ============================================
// ÉPREUVES DE SONGE (MAJ 3.5)
// Parcours prédéfinis liés à des succès en jeu
// ============================================

export const EPREUVES_SONGE = [
    {
        code: "FONSOCAC",
        label: "Épreuve FONSOCAC",
        difficulty: "CAUCHEMAR_I" as DifficultyKey,
        difficultyLabel: "Cauchemar I",
        description: "Les armes ont : -1 PA, +1 lancer par tour et +10 dégâts de base. Les monstres ont des PV supplémentaires.",
        asset: "/assets/dofus/icons/shinySword.png",
        color: "#dc2626",
        borderClass: "border-red-500/40",
        textClass: "text-red-400",
        badgeClass: "bg-red-900/20 text-red-400 border-red-500/30",
    },
    {
        code: "REVERSED",
        label: "Épreuve REVERSED",
        difficulty: "CAUCHEMAR_I" as DifficultyKey,
        difficultyLabel: "Cauchemar I",
        description: "Vous incarnez un boss aléatoire et affrontez des PNJ qui ont l'apparence et les sorts des classes Dofus.",
        asset: "/assets/dofus/icons/boss.png",
        color: "#dc2626",
        borderClass: "border-red-500/40",
        textClass: "text-red-400",
        badgeClass: "bg-red-900/20 text-red-400 border-red-500/30",
    },
    {
        code: "NILEZAFF",
        label: "Épreuve NILEZAFF",
        difficulty: "PARADOXE_II" as DifficultyKey,
        difficultyLabel: "Paradoxe II",
        description: "Lorsqu'une entité reçoit des dommages à distance, elle force l'échange de position avec son attaquant et renvoie les dommages en zone.",
        asset: "/assets/dofus/icons/target.png",
        color: "#f59e0b",
        borderClass: "border-amber-500/40",
        textClass: "text-amber-400",
        badgeClass: "bg-amber-900/20 text-amber-400 border-amber-500/30",
    },
    {
        code: "SINJSONJ",
        label: "Épreuve SINJSONJ",
        difficulty: "PARADOXE_II" as DifficultyKey,
        difficultyLabel: "Paradoxe II",
        description: "Vous incarnez un Kongoku qui invoque un Moon dès le début du combat.",
        asset: "/assets/dofus/icons/waveMonsters.png",
        color: "#f59e0b",
        borderClass: "border-amber-500/40",
        textClass: "text-amber-400",
        badgeClass: "bg-amber-900/20 text-amber-400 border-amber-500/30",
    },
] as const;

export type EpreuveCode = typeof EPREUVES_SONGE[number]["code"];

export function getEpreuve(code: string | null | undefined) {
    if (!code) return null;
    return EPREUVES_SONGE.find(e => e.code === code) ?? null;
}
