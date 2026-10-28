/**
 * Donjons multi-boss — configuration statique des donjons qui regroupent
 * **plus de deux boss** dans une même salle finale (ex. Sanctuaire du dernier
 * espoir avec les 4 cavaliers de l'Éliocalypse).
 *
 * Le mécanisme « double boss » (`resolveDungeonBossPair`) gère déjà les paires
 * (Comte+Klime) via les champs Dofensive du `Dungeon`. Ici on étend le concept
 * aux N-uplets, sans migration de schéma : une table de correspondance statique
 * suffit (un seul donjon concerné à date).
 *
 * Le matching se fait sur le **slug** du donjon chapeau (`bossName` slugifié)
 * ou par inclusion du nom dans `bossName` / `name`.
 */

import { slugifyBossName } from "@/lib/boss-slug";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MultiBossConfig {
    /** Slug du donjon chapeau (dérivé de `bossName`). */
    parentSlug: string;
    /** Slugs alternatifs (ex. nom du donjon au lieu du bossName). */
    aliases?: string[];
    /** Noms exacts des boss affichés en onglets, dans l'ordre d'affichage. */
    bossNames: string[];
    /** Image du donjon chapeau (pas du boss résolu par DofusDB). */
    dungeonImageUrl: string;
    /** Libellé du bandeau multi-boss (ex. « Quatuor »). */
    label: string;
    /** Coordonnées d'entrée fixes — override du DofusDB qui résout mal ce donjon. */
    coordinates: { x: number; y: number; worldMapId: number };
    /** Image statique de localisation personnalisée (remplace la minimap en tuiles). */
    locationImageUrl?: string;
    /** Nom d'affichage de la zone (override ex. "Sanctuaire du dernier espoir"). */
    zoneName?: string;
}

// ─── Registre ────────────────────────────────────────────────────────────────

export const MULTI_BOSS_DUNGEONS: readonly MultiBossConfig[] = [
    {
        parentSlug: "sanctuaire-du-dernier-espoir",
        aliases: ["tempete-de-l-eliocalypse"],
        bossNames: ["Servitude", "Guerre", "Misère", "Corruption"],
        dungeonImageUrl: "/game-data/dungeons/temp-te-de-l-eliocalypse.webp",
        label: "Quatuor",
        coordinates: { x: 15, y: -20, worldMapId: 1 },
        locationImageUrl: "/game-data/worldmap/sanctuaire-cavaliers.webp",
        zoneName: "Sanctuaire du dernier espoir",
    },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const indexBySlug = new Map<string, MultiBossConfig>();

for (const c of MULTI_BOSS_DUNGEONS) {
    indexBySlug.set(c.parentSlug, c);
    if (c.aliases) {
        for (const a of c.aliases) {
            indexBySlug.set(a, c);
        }
    }
}

/**
 * Renvoie la config multi-boss si le donjon en possède une, `null` sinon.
 * Accepte un slug, un `bossName` brut ou un objet `{ slug?, bossName?, name? }`.
 */
export function getMultiBossConfig(
    input:
        | string
        | { slug?: string | null; bossName?: string | null; name?: string | null },
): MultiBossConfig | null {
    if (typeof input === "string") {
        const slug = slugifyBossName(input);
        return indexBySlug.get(slug) ?? null;
    }
    // Essai par slug stocké en base
    if (input.slug && indexBySlug.has(input.slug)) return indexBySlug.get(input.slug)!;
    // Essai par slugification de bossName
    const fromBoss = slugifyBossName(input.bossName ?? "");
    if (fromBoss && indexBySlug.has(fromBoss)) return indexBySlug.get(fromBoss)!;
    // Essai par slugification de name (fallback)
    const fromName = slugifyBossName(input.name ?? "");
    if (fromName && indexBySlug.has(fromName)) return indexBySlug.get(fromName)!;
    return null;
}

/** Vrai si le donjon est un donjon multi-boss (≥ 3 boss). */
export function isMultiBossDungeon(
    dungeon: { slug?: string | null; bossName?: string | null; name?: string | null },
): boolean {
    return getMultiBossConfig(dungeon) !== null;
}
