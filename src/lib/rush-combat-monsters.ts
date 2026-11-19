/**
 * **Monstres des combats du guide Rush** — règle pure, partagée par le seed,
 * l'import et l'affichage.
 *
 * Mesure du 19/11/2026 (guide `rush-sylvestre`, 742 tags `combat_solo` /
 * `combat_plusieurs`) : un tag ne porte **pas** un monstre, mais un **groupe**
 * écrit par la source (« A, B, C », parfois préfixé `groupe ·`). En découpant,
 * on obtient **1 443 noms** ; **815** correspondent au bestiaire local
 * (`public/game-data/unity-bestiary.json`, 5 129 entrées). Les autres restent
 * des libellés de rôle ou des variantes de source : ils s'affichent **en texte**,
 * jamais avec une fiche inventée.
 *
 * Aucune similarité approximative : la résolution est une **égalité normalisée**
 * (casse, accents, ponctuation, `×N`, préfixe `groupe`), sur la carte générée
 * par `scripts/build-rush-monster-map.ts`.
 */

/** Monstre résolu (ou simplement nommé) d'un tag de combat. */
export type RushCombatMonster = {
    /** Nom affichable — le nom canonique de la fiche quand le monstre est résolu. */
    name: string;
    /** Slug de la fiche publique `/bestiaire/<slug>` (résolu seulement). */
    slug?: string;
    /** Id Ankama — sert au proxy d'image (`/api/assets-dofus/monsters/<id>`). */
    monsterId?: number;
    /** `gfxId` du client — sert aux 31 PNG locaux quand ils existent. */
    gfxId?: number;
};

/** Entrée de la carte générée (`src/data/rush-monster-map.json`). */
export type RushMonsterMapEntry = {
    name: string;
    slug: string;
    monsterId: number;
    gfxId: number;
};

/** Carte normalisée nom → fiche. */
export type RushMonsterMap = Readonly<Record<string, RushMonsterMapEntry>>;

/**
 * Alias **mesurés** (19/11/2026) : la source Tougli tronque trois noms du
 * bestiaire. On ne devine pas — chaque cible existe telle quelle dans
 * `unity-bestiary.json` ; le test `rush-combat-monsters` le vérifie.
 */
export const RUSH_MONSTER_NAME_ALIASES: Readonly<Record<string, string>> = {
    "chaffoin le sourn": "chaffoin le sournois",
    "garde bwork elemental d ai": "garde bwork elemental d air",
    "aventurier injuri": "aventurier injurieux",
};

/** Plafond d'un groupe : une séquence porte au plus 30 tags, un tag reste lisible. */
export const MAX_RUSH_COMBAT_MONSTERS = 20;

/**
 * Retire le bruit de la source : quantité `×N`, préfixe `groupe ·` / `groupe:`,
 * espaces multiples. Le nom garde sa casse et ses accents pour l'affichage.
 */
export function cleanRushCombatMonsterName(value: string | null | undefined): string {
    return String(value ?? "")
        .replace(/\u00d7\s*\d+/g, " ")
        // Le mode est déjà porté par le type de tag (`combat_solo`…) : la source
        // répète « solo · » / « groupe · » / « soloV · » (vagues) devant le nom.
        .replace(/^\s*(?:groupe|solo|tactique|vagues|combat)V?\s*(?:\u00b7|:)\s*/i, "")
        .replace(/^\s*groupe\s*$/i, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Clé de rapprochement : minuscules, sans accents, ponctuation → espace.
 * Même normalisation que `scripts/build-rush-monster-map.ts` — une seule règle.
 */
export function normalizeRushCombatMonsterName(value: string | null | undefined): string {
    return cleanRushCombatMonsterName(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Découpe un tag de combat en noms de monstres : virgules, dédoublonnage sur la
 * clé normalisée, ordre de la source conservé, plafond borné.
 */
export function splitRushCombatMonsterNames(
    raw: string | null | undefined,
    max = MAX_RUSH_COMBAT_MONSTERS
): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const part of String(raw ?? "").split(",")) {
        const name = cleanRushCombatMonsterName(part);
        const key = normalizeRushCombatMonsterName(name);
        if (!name || !key || seen.has(key)) continue;
        seen.add(key);
        out.push(name);
        if (out.length >= max) break;
    }
    return out;
}

/**
 * Résout un tag de combat contre la carte du bestiaire. Un nom inconnu reste
 * **nommé** (aucune fiche, aucun slug) : le rendu ne devine jamais.
 */
export function resolveRushCombatMonsters(
    raw: string | null | undefined,
    lookup: RushMonsterMap,
    max = MAX_RUSH_COMBAT_MONSTERS
): RushCombatMonster[] {
    return splitRushCombatMonsterNames(raw, max).map((name) => {
        const key = normalizeRushCombatMonsterName(name);
        const hit = lookup[RUSH_MONSTER_NAME_ALIASES[key] ?? key];
        return hit
            ? {
                  name: hit.name,
                  slug: hit.slug,
                  monsterId: hit.monsterId,
                  gfxId: hit.gfxId,
              }
            : { name };
    });
}
