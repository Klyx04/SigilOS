/**
 * Mission Payload Types
 * Typed payloads for each mission category stored in the JSONB field.
 */

// === DONJON ===
export type DungeonPayload = {
    dungeonId: string;
    dungeonName: string;
    bossName: string;
    level: number;
    dpnlUrl?: string;
    imageUrl?: string;
}

// === REGULATION ===
export type RegulationPayload = {
    zoneId: string;
    zoneName: string;
    familyId?: string;
    familyName?: string;
    monsterId?: string;
    monsterName?: string;
    targetCount: 50; // Always 50
    imageUrl?: string;
}

// === ANOMALIE ===
export type AnomaliePayload = {
    type: 'ZONE' | 'BOSS' | 'GARDIENS' | 'COLLECTE' | 'FRAGMENTS' | 'STABILISATION';
    levelRange: AnomalieLevelRange;
    fragmentLevel?: 1 | 2 | 3; // Only for COLLECTE type (maj 3.5)
    // 'uchronique' = Élixir uchronique sans niveau (ajout chantier #145)
    elixir?: 'aucun' | 'uchronique' | 'mineur' | 'ameliore' | 'majeur';
}

// === SONGES ===
export type SongesPayload = {
    difficulty: 'Rêve' | 'Paradoxe' | 'Cauchemar';
    level: 'I' | 'II' | 'III' | 'IV';
    tier: 1 | 2 | 3 | 4 | 5;
}

// === ÉPREUVE SONGE (4 épreuves spéciales : Fonsocac, Nilezaff, Reversed, Sinjsonj) ===
export type SongesEpreuvePayload = {
    epreuve: 'Fonsocac' | 'Nilezaff' | 'Reversed' | 'Sinjsonj';
    imageUrl?: string;
}

// === EXPEDITION ===
export type ExpeditionPayload = {
    dungeonId: string;
    dungeonName: string;
    bossName: string;
    mode: 'bravoure' | 'audace' | 'aucun';
    level: number;
    dpnlUrl?: string;
    imageUrl?: string;
}

// === EVENT ===
export type EventPayload = {
    eventType?: 'REGULATION' | 'DONJON' | 'MONSTRE_SPECIAL' | 'OBJECTIF' | 'FRAGMENTS_ANOMALIE';
    contextPreset?: 'VULKANIA' | 'NOWEL' | 'PWAK' | 'HALOUINE' | 'AUTRE';
    contextManual?: string;
    description?: string;
    dungeonId?: string;
    dungeonName?: string;
    bossName?: string;
    level?: number;
    imageUrl?: string;
    zoneId?: string;
    zoneName?: string;
    familyId?: string;
    familyName?: string;
    targetCount?: number;
    monsterName?: string;
    title?: string;
    customObjective?: string;
    // Notes / instructions libres (maj 2026-08) — missions spéciales
    notes?: string;
}

// Union type for all payloads
export type MissionPayload =
    | DungeonPayload
    | RegulationPayload
    | AnomaliePayload
    | SongesPayload
    | SongesEpreuvePayload
    | ExpeditionPayload
    | EventPayload;

// Songes configuration (fixed values)
export const SONGES_CONFIG = {
    difficulties: ['Rêve', 'Paradoxe', 'Cauchemar'] as const,
    levels: {
        'Rêve': ['I', 'II', 'III'] as const,
        'Paradoxe': ['I', 'II', 'III', 'IV'] as const,
        'Cauchemar': ['I', 'II', 'III'] as const,
    },
    tiers: [1, 2, 3, 4, 5] as const,
    epreuves: ['Fonsocac', 'Nilezaff', 'Reversed', 'Sinjsonj'] as const,
};

// Anomalie level ranges
export type AnomalieLevelRange = '50+' | '100+' | '150' | '160' | '170' | '180' | '190' | '200';
export const ANOMALIE_LEVEL_RANGES: AnomalieLevelRange[] = ['50+', '100+', '150', '160', '170', '180', '190', '200'];

// Expedition modes
export const EXPEDITION_MODES = [
    { value: 'bravoure', label: 'Bravoure' },
    { value: 'audace', label: 'Audace' },
    { value: 'aucun', label: 'Aucun modificateur' },
] as const;
