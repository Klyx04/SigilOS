/**
 * Listes d'exclusion game-data — **source de vérité UNIQUE** (fichiers JSON).
 *
 * Extraites de `src/server/actions/game-data-actions.ts` (22/09/2026) pour que les
 * **cœurs de siphon `src/lib`** (appelés par la file/le worker, sans session Next)
 * filtrent EXACTEMENT comme les boutons du dashboard. Sans ça, un siphon lancé en
 * arrière-plan recréerait ce qu'un God a supprimé (une suppression ne doit jamais
 * être annulée par le cron — règle déjà posée pour les avis de recherche).
 *
 * Lecture seule ici : les écritures restent dans les actions God (avec audit).
 */
import * as fs from "fs";
import * as path from "path";

export const IGNORED_FAMILIES_PATH = path.join(process.cwd(), "public", "game-data", "ignored-families.json");
export const IGNORED_ZONES_PATH = path.join(process.cwd(), "public", "game-data", "ignored-zones.json");

/** Familles jamais siphonnées (bruit structurel de DofusDB, pas des monstres jouables). */
export const DEFAULT_IGNORED_FAMILY_PATTERNS = [
    "archimonstres",
    "archimonstre",
    "monstres de quête",
    "monstres de quetes",
    "alignement",
    "avis de recherche",
    "monstre d'alignement",
    "pnj",
    "invocation",
    "garde",
    "protecteur",
    "tutorial",
    "tutoriel",
];

function readNamesFile(filePath: string): string[] {
    try {
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, "utf-8");
            const data = JSON.parse(raw);
            return Array.isArray(data.names) ? data.names : [];
        }
    } catch {
        // fail-open : une liste illisible ne doit pas bloquer un siphon
    }
    return [];
}

export function getIgnoredFamilies(): string[] {
    return readNamesFile(IGNORED_FAMILIES_PATH);
}

export function getIgnoredZones(): string[] {
    return readNamesFile(IGNORED_ZONES_PATH);
}

export function isIgnoredFamily(name?: string | null): boolean {
    if (!name) return false;
    const lower = name.trim().toLowerCase();
    if (DEFAULT_IGNORED_FAMILY_PATTERNS.some((pat) => lower.includes(pat))) return true;
    return getIgnoredFamilies().includes(lower);
}

export function isIgnoredZone(name?: string | null): boolean {
    if (!name) return false;
    return getIgnoredZones().includes(name.trim().toLowerCase());
}
