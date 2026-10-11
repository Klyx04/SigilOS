import fs from "fs";
import path from "path";
import { logger } from "@/lib/logger";
import { slugifyBossName } from "@/lib/boss-slug";

export interface UnityPassiveEffect {
    effectId?: number | null;
    label: string;
    type: "invulnerable" | "swap" | "resurrect" | "glyph" | "buff" | "unknown";
    duration: string;
    isLocked: boolean;
}

export interface UnityPassive {
    spellId: number;
    name: string;
    description: string;
    iconId: number;
    effects: UnityPassiveEffect[];
}

export interface UnitySpell {
    id: number;
    name: string;
    description?: string;
    iconId: number;
    apCost: number;
    minRange: number;
    range: number;
    criticalHitProbability: number;
    maxCastPerTurn: number;
    maxCastPerTarget: number;
    effects?: string[];
    criticalEffects?: string[];
    castTestLos?: boolean;
    castInLine?: boolean;
    castInDiagonal?: boolean;
    minCastInterval?: number;
}

export interface UnityGrade {
    grade: number;
    level: number;
    lifePoints: number;
    actionPoints: number;
    movementPoints: number;
    wisdom: number;
    strength: number;
    intelligence: number;
    chance: number;
    agility: number;
    tackle: number;
    evade: number;
    apRemoval: number;
    mpRemoval: number;
    apDodge: number;
    mpDodge: number;
    initiative: number;
    neutralResistance: number;
    earthResistance: number;
    fireResistance: number;
    waterResistance: number;
    airResistance: number;
    xp: number;
}

export interface UnityMonsterData {
    id: number;
    name: string;
    raceId: number;
    gfxId: number;
    passive: UnityPassive | null;
    spells: UnitySpell[];
    grades: UnityGrade[];
}

// Cache mémoire serveur (singleton pour toute la durée de vie du process)
let cachedBestiary: Record<string, UnityMonsterData> | null = null;
let nameIndex: Map<string, UnityMonsterData> | null = null;
/** Index par **slug de nom** (`slugifyBossName`) : l'URL publique d'une fiche monstre. */
let slugIndex: Map<string, UnityMonsterData> | null = null;
/** Le même dictionnaire, en tableau trié par nom (listes / recherches). */
let sortedMonsters: UnityMonsterData[] = [];

function norm(s: string): string {
    return (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

/**
 * Charge le dictionnaire du bestiaire Unity depuis `public/game-data/unity-bestiary.json`.
 */
export function getUnityBestiary(): Record<string, UnityMonsterData> {
    if (cachedBestiary) return cachedBestiary;
    try {
        const filePath = path.join(process.cwd(), "public", "game-data", "unity-bestiary.json");
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, "utf-8");
            cachedBestiary = JSON.parse(raw);
            nameIndex = new Map();
            slugIndex = new Map();
            const all: UnityMonsterData[] = [];
            if (cachedBestiary) {
                for (const m of Object.values(cachedBestiary)) {
                    if (m && m.name) {
                        nameIndex.set(norm(m.name), m);
                        all.push(m);
                        // Deux homonymes partagent le même slug : le premier du dictionnaire
                        // reste servi, exactement comme les fiches boss (slug unique en base).
                        const slug = slugifyBossName(m.name);
                        if (slug && !slugIndex.has(slug)) slugIndex.set(slug, m);
                    }
                }
            }
            sortedMonsters = all.sort((a, b) => a.name.localeCompare(b.name, "fr"));
            return cachedBestiary || {};
        }
    } catch (err) {
        logger.error("[getUnityBestiary] Erreur chargement unity-bestiary.json:", { error: err });
    }
    return {};
}

/**
 * Résout une entrée du bestiaire Unity par ID ou par nom.
 */
export function getUnityMonster(identifier: string | number): UnityMonsterData | null {
    const bestiary = getUnityBestiary();
    if (!bestiary) return null;

    // 1. Recherche par ID direct
    const numId = Number(identifier);
    if (Number.isFinite(numId) && numId > 0 && bestiary[String(numId)]) {
        return bestiary[String(numId)];
    }

    // 2. Recherche par nom normalisé
    if (typeof identifier === "string" && nameIndex) {
        const key = norm(identifier);
        const match = nameIndex.get(key);
        if (match) return match;
    }

    return null;
}

/**
 * Résout une entrée du bestiaire local par le **slug de nom** des URL publiques
 * (`slugifyBossName` — le MÊME algorithme que les fiches boss et `/bestiaire/<slug>`).
 * L'index est construit au chargement du dictionnaire (un seul passage) : aucune
 * requête, aucun fichier relu par appel.
 */
export function findUnityMonsterBySlug(slug: string): UnityMonsterData | null {
    getUnityBestiary();
    const key = String(slug ?? "").trim().toLowerCase();
    if (!key || !slugIndex) return null;
    return slugIndex.get(key) ?? null;
}

/**
 * Tous les monstres du bestiaire local, triés par nom (« Pious » avant « Porks »).
 * Référence **stable** : le tableau est construit une fois au chargement, les appels
 * suivants ne coûtent rien (listes, recherches, comptages des fiches monstres).
 */
export function listUnityMonsters(): UnityMonsterData[] {
    getUnityBestiary();
    return sortedMonsters;
}
