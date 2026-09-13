/**
 * Module « Marché » — **familles d'objets** (BUG-11 / T10).
 *
 * ⚠️ Fichier **PUR** (aucune dépendance React / Prisma / Node) : importable côté
 * client, côté serveur et en test unitaire. Il est la **source unique** des
 * familles, des libellés et des règles Forge / Lot / Légendaire du Marché.
 *
 * 📚 Table `superTypeId → famille` **vérifiée sur DofusDB le 13/09/2026** :
 * `https://api.dofusdb.fr/item-types` expose **239 types** (`id`, `superTypeId`,
 * `name.fr`) — ⚠️ l'API plafonne `$limit` à 50 ⇒ paginer par `$skip` pour la
 * relire. Contrôles d'échantillon : `311` = *Eau Potable* (`typeId 228`,
 * `superTypeId 9`) · `18` = *Familier* (`superTypeId 12`) · `82` = *Bouclier*
 * (`superTypeId 7`) · `169` = *Compagnon* (`superTypeId 23`) · `23` = *Dofus*,
 * `151` = *Trophée*, `217` = *Prysmaradite* (`superTypeId 13`) · `273`…`280` =
 * *équipement de percepteur* (`superTypeId 69`).
 *
 * 🎯 Règles produit **ratifiées par le user** (13/09) :
 *   · **Équipements** = coiffe, cape, ceinture, amulette, anneau, bouclier, armes
 *     (outils / pioches / faux / arme magique **inclus**), bottes, familier /
 *     montilier / dragodinde / muldo / volkorne, compagnon, Dofus / Trophée /
 *     Prysmaradite, équipement de percepteur ;
 *   · **compagnon / Dofus / Trophée / Prysmaradite** = **vente brute** ;
 *   · **équipement de percepteur** = **vente brute**, au **détail ou en lot** ;
 *   · **familier / montilier / dragodinde / muldo / volkorne** = stats
 *     **modifiables** ; **familier et montilier** peuvent être **légendaires** ;
 *   · **Cosmétique** (apparat, costume, épaulière, ailes…) = catégorie **dédiée**,
 *     aucune modification, vente brute ;
 *   · **Ressources / Autres** = tout le reste : aucune modification, mais **lot à
 *     quantité libre** (ex. item `311` *Eau potable* × 1 … × 500).
 */

/** Famille d'un objet du marché. */
export type MarketItemFamily = "EQUIPMENT" | "COSMETIC" | "RESOURCES_OTHER";

/** Libellés d'affichage (jamais un libellé en dur ailleurs). */
export const MARKET_ITEM_FAMILY_LABELS: Record<MarketItemFamily, string> = {
    EQUIPMENT: "Équipements",
    COSMETIC: "Cosmétique",
    RESOURCES_OTHER: "Ressources / Autres",
};

/** Descriptions de l'étape 1 de l'assistant de création. */
export const MARKET_ITEM_FAMILY_DESCRIPTIONS: Record<MarketItemFamily, string> = {
    EQUIPMENT:
        "Coiffe, cape, ceinture, amulette, anneau, bouclier, armes, bottes, familier, compagnon, Dofus, équipement de percepteur…",
    COSMETIC: "Apparats, costumes, épaulières, ailes — vente brute, aucune modification.",
    RESOURCES_OTHER:
        "Tout le reste : ressources, consommables, runes, ingrédients… au détail ou par lot (quantité libre).",
};

/**
 * `superTypeId` DofusDB → famille. **Toute** valeur absente retombe sur
 * `RESOURCES_OTHER` (fail-safe : on n'invente jamais une famille forgeable).
 */
export const MARKET_FAMILY_BY_SUPERTYPE_ID: Record<number, MarketItemFamily> = {
    // ÉQUIPEMENTS — amulette, armes (dont outils / pioches / faux / arme magique),
    // anneau, ceinture, bottes, bouclier, chapeau, cape, familier & montures,
    // Dofus / Trophée / Prysmaradite, compagnon, équipement de percepteur.
    1: "EQUIPMENT",
    2: "EQUIPMENT",
    3: "EQUIPMENT",
    4: "EQUIPMENT",
    5: "EQUIPMENT",
    7: "EQUIPMENT",
    10: "EQUIPMENT",
    11: "EQUIPMENT",
    12: "EQUIPMENT",
    13: "EQUIPMENT",
    23: "EQUIPMENT",
    69: "EQUIPMENT",
    // COSMÉTIQUE — apparat (22) & costume / épaulière / ailes (25).
    22: "COSMETIC",
    25: "COSMETIC",
};

/** `superTypeId` des familles ÉQUIPEMENTS (filtre SQL `in`). */
export const MARKET_EQUIPMENT_SUPERTYPE_IDS: number[] = Object.entries(
    MARKET_FAMILY_BY_SUPERTYPE_ID
)
    .filter(([, family]) => family === "EQUIPMENT")
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);

/** `superTypeId` de la famille COSMÉTIQUE (filtre SQL `in`). */
export const MARKET_COSMETIC_SUPERTYPE_IDS: number[] = Object.entries(
    MARKET_FAMILY_BY_SUPERTYPE_ID
)
    .filter(([, family]) => family === "COSMETIC")
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);

/**
 * Exceptions **par `typeId`** — table **complète** des types DofusDB
 * (`/item-types`, relevé du 13/09/2026). C'est le signal **le plus fiable** du
 * référentiel local : `typeId` est toujours renseigné (`superTypeId` peut être
 * NULL, `category` est dérivée d'un heuristique historique).
 *
 * Tout `typeId` **absent** de cette table appartient à `RESOURCES_OTHER`
 * (ressources, consommables, runes, quêtes, clefs, certificats…).
 */
export const MARKET_FAMILY_BY_TYPE_ID: Record<number, MarketItemFamily> = {
    // ── ÉQUIPEMENTS ─────────────────────────────────────────────────────────
    1: "EQUIPMENT", // Amulette
    2: "EQUIPMENT", // Arc
    3: "EQUIPMENT", // Baguette
    4: "EQUIPMENT", // Bâton
    5: "EQUIPMENT", // Dague
    6: "EQUIPMENT", // Épée
    7: "EQUIPMENT", // Marteau
    8: "EQUIPMENT", // Pelle
    19: "EQUIPMENT", // Hache
    20: "EQUIPMENT", // Outil
    21: "EQUIPMENT", // Pioche
    22: "EQUIPMENT", // Faux
    114: "EQUIPMENT", // Arme magique
    271: "EQUIPMENT", // Lance
    9: "EQUIPMENT", // Anneau
    10: "EQUIPMENT", // Ceinture
    11: "EQUIPMENT", // Bottes
    82: "EQUIPMENT", // Bouclier
    16: "EQUIPMENT", // Chapeau (coiffe)
    17: "EQUIPMENT", // Cape
    18: "EQUIPMENT", // Familier
    121: "EQUIPMENT", // Montilier
    311: "EQUIPMENT", // Monture
    331: "EQUIPMENT", // Dragodinde
    332: "EQUIPMENT", // Muldo
    333: "EQUIPMENT", // Volkorne
    23: "EQUIPMENT", // Dofus
    151: "EQUIPMENT", // Trophée
    217: "EQUIPMENT", // Prysmaradite
    169: "EQUIPMENT", // Compagnon
    273: "EQUIPMENT", // Fers de Percepteur
    274: "EQUIPMENT", // Cuirasses de Percepteur
    275: "EQUIPMENT", // Bannière de Percepteur
    276: "EQUIPMENT", // Poignards de Percepteur
    277: "EQUIPMENT", // Tunique de Percepteur
    279: "EQUIPMENT", // Coffres de Percepteur
    280: "EQUIPMENT", // Sacoches de Percepteur
    // ── COSMÉTIQUE ──────────────────────────────────────────────────────────
    113: "COSMETIC", // Objet vivant
    246: "COSMETIC", // Chapeau d'apparat
    247: "COSMETIC", // Cape d'apparat
    248: "COSMETIC", // Bouclier d'apparat
    249: "COSMETIC", // Familier d'apparat
    250: "COSMETIC", // Montilier d'apparat
    251: "COSMETIC", // Arme d'apparat
    252: "COSMETIC", // Objet divers d'apparat
    324: "COSMETIC", // Monture d'apparat
    304: "COSMETIC", // Panoplie d'apparat
    199: "COSMETIC", // Costume
    299: "COSMETIC", // Épaulière
    300: "COSMETIC", // Ailes
};

/** `typeId` des familles ÉQUIPEMENTS (filtre SQL `in`). */
export const MARKET_EQUIPMENT_TYPE_IDS: number[] = Object.entries(MARKET_FAMILY_BY_TYPE_ID)
    .filter(([, family]) => family === "EQUIPMENT")
    .map(([id]) => Number(id));

/** `typeId` de la famille COSMÉTIQUE (filtre SQL `in`). */
export const MARKET_COSMETIC_TYPE_IDS: number[] = Object.entries(MARKET_FAMILY_BY_TYPE_ID)
    .filter(([, family]) => family === "COSMETIC")
    .map(([id]) => Number(id));

/** Familiers & montures : stats **modifiables** (vendues telles quelles). */
export const MARKET_FAMILIAR_TYPE_IDS: readonly number[] = [18, 121, 311, 331, 332, 333];

/** Familiers **et** montiliers : peuvent être « légendaires » (réf. Dofus 3.4). */
export const MARKET_LEGENDARY_TYPE_IDS: readonly number[] = [18, 121];

/** Objets vendus **bruts** quoi qu'il arrive : Dofus, Trophée, Prysmaradite, Compagnon. */
export const MARKET_RAW_TYPE_IDS: readonly number[] = [23, 151, 217, 169];

/** Équipement de percepteur : vente brute, **au détail ou en lot**. */
export const MARKET_LOT_EQUIPMENT_SUPERTYPE_IDS: readonly number[] = [69];

/**
 * Noms de **type** DofusDB (`name.fr` de `/item-types`) → famille / règles.
 * Source : relevé du 13/09/2026 (239 types) — indispensable car `typeName` est
 * le seul signal **toujours** présent dans le référentiel local.
 */
export const MARKET_EQUIPMENT_TYPE_NAMES: readonly string[] = [
    // Équipement porté / armes (outils, pioches, faux, armes magiques inclus)
    "Amulette",
    "Arc",
    "Baguette",
    "Bâton",
    "Dague",
    "Épée",
    "Marteau",
    "Pelle",
    "Hache",
    "Outil",
    "Pioche",
    "Faux",
    "Arme magique",
    "Lance",
    "Anneau",
    "Ceinture",
    "Bottes",
    "Bouclier",
    "Chapeau",
    "Cape",
    // Familiers & montures
    "Familier",
    "Montilier",
    "Monture",
    "Dragodinde",
    "Muldo",
    "Volkorne",
    // Dofus / Trophée / Prysmaradite + compagnon
    "Dofus",
    "Trophée",
    "Prysmaradite",
    "Compagnon",
    // Équipement de percepteur
    "Fers de Percepteur",
    "Cuirasses de Percepteur",
    "Bannière de Percepteur",
    "Poignards de Percepteur",
    "Tunique de Percepteur",
    "Coffres de Percepteur",
    "Sacoches de Percepteur",
];

/** Noms de **type** DofusDB de la famille **Cosmétique**. */
export const MARKET_COSMETIC_TYPE_NAMES: readonly string[] = [
    "Chapeau d'apparat",
    "Cape d'apparat",
    "Bouclier d'apparat",
    "Familier d'apparat",
    "Montilier d'apparat",
    "Arme d'apparat",
    "Objet divers d'apparat",
    "Monture d'apparat",
    "Panoplie d'apparat",
    "Costume",
    "Épaulière",
    "Ailes",
    "Objet vivant",
];

/** Clé de comparaison insensible à la casse et aux accents. */
function normalizeTypeName(typeName: string): string {
    return typeName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

/** Index nom de type → famille (équipements + cosmétique). */
export const MARKET_FAMILY_BY_TYPE_NAME: Record<string, MarketItemFamily> = {
    ...Object.fromEntries(
        MARKET_EQUIPMENT_TYPE_NAMES.map((name) => [normalizeTypeName(name), "EQUIPMENT" as const])
    ),
    ...Object.fromEntries(
        MARKET_COSMETIC_TYPE_NAMES.map((name) => [normalizeTypeName(name), "COSMETIC" as const])
    ),
};

const FAMILIAR_TYPE_NAME_KEYS = new Set(
    ["Familier", "Montilier", "Monture", "Dragodinde", "Muldo", "Volkorne"].map(normalizeTypeName)
);
const LEGENDARY_TYPE_NAME_KEYS = new Set(["Familier", "Montilier"].map(normalizeTypeName));
const RAW_TYPE_NAME_KEYS = new Set(
    ["Dofus", "Trophée", "Prysmaradite", "Compagnon"].map(normalizeTypeName)
);
const PERCEPTEUR_TYPE_NAME_KEYS = new Set(
    MARKET_EQUIPMENT_TYPE_NAMES.filter((name) => name.includes("Percepteur")).map(normalizeTypeName)
);

/** `true` si le nom de type désigne un familier / une monture. */
export function familiarTypeName(typeName?: string | null): boolean {
    return typeof typeName === "string" && FAMILIAR_TYPE_NAME_KEYS.has(normalizeTypeName(typeName));
}

/** `true` si le nom de type est « légendaire-compatible » (familier, montilier). */
export function legendaryTypeName(typeName?: string | null): boolean {
    return typeof typeName === "string" && LEGENDARY_TYPE_NAME_KEYS.has(normalizeTypeName(typeName));
}

/** `true` si le nom de type impose une **vente brute**. */
export function rawTypeName(typeName?: string | null): boolean {
    return typeof typeName === "string" && RAW_TYPE_NAME_KEYS.has(normalizeTypeName(typeName));
}

/** `true` si le nom de type est un **équipement de percepteur** (lot autorisé). */
export function percepteurTypeName(typeName?: string | null): boolean {
    return typeof typeName === "string" && PERCEPTEUR_TYPE_NAME_KEYS.has(normalizeTypeName(typeName));
}

/** Politique d'un objet : ce que l'assistant de création a le droit d'ouvrir. */
export type MarketItemPolicy = {
    family: MarketItemFamily;
    /** Objet vendu **brut** (aucune rune, aucun jet déclaré). */
    raw: boolean;
    /** Bloc « Forge » (Transcendance, élément de frappe, potion) autorisé. */
    forgeAllowed: boolean;
    /** Éditeur de jet (stats déclarées) autorisé. */
    statEditorAllowed: boolean;
    /** Lot à quantité libre autorisé (Ressources / Autres + percepteur). */
    lotAllowed: boolean;
    /** Case « Légendaire » autorisée (familiers & montiliers). */
    legendaryAllowed: boolean;
};

/**
 * ⚠️ **Constat terrain (13/09, après régression constatée en beta)** : le
 * référentiel local ne porte **pas** toujours `typeId` / `superTypeId` (le siphon
 * lisait `raw.superTypeId`, absent du JSON DofusDB) — le `typeName`, lui, est
 * **toujours** renseigné (« Anneau », « Ceinture », « Chapeau d'apparat »…).
 * La résolution doit donc accepter **quatre signaux**, dans cet ordre :
 *   `typeId` (exception) → `superTypeId` (règle) → **`typeName`** (nom officiel
 *   de type, vérifié sur `api.dofusdb.fr/item-types`) → `category` (grossier).
 */
export function resolveMarketItemFamily(input: {
    typeId?: number | null;
    superTypeId?: number | null;
    /** `GameItem.typeName` (« Anneau », « Trophée », « Eau »…). */
    typeName?: string | null;
    /** `GameItem.category` (`equipment` | `resources` | `consumables` | `cosmetics`). */
    category?: string | null;
}): MarketItemFamily {
    const typeId = typeof input.typeId === "number" ? input.typeId : null;
    if (typeId != null && MARKET_FAMILY_BY_TYPE_ID[typeId]) {
        return MARKET_FAMILY_BY_TYPE_ID[typeId];
    }

    const superTypeId = typeof input.superTypeId === "number" ? input.superTypeId : null;
    if (superTypeId != null && MARKET_FAMILY_BY_SUPERTYPE_ID[superTypeId]) {
        return MARKET_FAMILY_BY_SUPERTYPE_ID[superTypeId];
    }

    if (typeof input.typeName === "string") {
        const byName = MARKET_FAMILY_BY_TYPE_NAME[normalizeTypeName(input.typeName)];
        if (byName) return byName;
    }

    // Dernier filet : la **catégorie** grossière — utilisée **uniquement** quand
    // aucun identifiant de type n'est disponible (fiches historiques). Son
    // heuristique est connue pour être fausse (« Bois » était classé
    // `equipment`) : un `typeId` présent mais inconnu de la table reste donc
    // `RESOURCES_OTHER`, jamais un équipement par défaut.
    if (typeId == null && superTypeId == null) {
        if (input.category === "equipment") return "EQUIPMENT";
        if (input.category === "cosmetics") return "COSMETIC";
    }
    return "RESOURCES_OTHER";
}

/** Politique complète (Forge / jet / lot / légendaire) d'un objet. */
export function resolveMarketItemPolicy(input: {
    typeId?: number | null;
    superTypeId?: number | null;
    typeName?: string | null;
    category?: string | null;
}): MarketItemPolicy {
    const family = resolveMarketItemFamily(input);
    const typeId = typeof input.typeId === "number" ? input.typeId : -1;
    const superTypeId = typeof input.superTypeId === "number" ? input.superTypeId : -1;

    if (family === "EQUIPMENT") {
        const familiar = MARKET_FAMILIAR_TYPE_IDS.includes(typeId) || familiarTypeName(input.typeName);
        const raw =
            MARKET_RAW_TYPE_IDS.includes(typeId) ||
            rawTypeName(input.typeName) ||
            MARKET_LOT_EQUIPMENT_SUPERTYPE_IDS.includes(superTypeId) ||
            percepteurTypeName(input.typeName);
        return {
            family,
            raw,
            // Une rune de Transcendance / une potion n'a aucun sens sur un familier.
            forgeAllowed: !raw && !familiar,
            statEditorAllowed: !raw,
            lotAllowed: MARKET_LOT_EQUIPMENT_SUPERTYPE_IDS.includes(superTypeId) || percepteurTypeName(input.typeName),
            legendaryAllowed: MARKET_LEGENDARY_TYPE_IDS.includes(typeId) || legendaryTypeName(input.typeName),
        };
    }

    if (family === "COSMETIC") {
        return {
            family,
            raw: true,
            forgeAllowed: false,
            statEditorAllowed: false,
            lotAllowed: false,
            legendaryAllowed: false,
        };
    }

    return {
        family,
        raw: true,
        forgeAllowed: false,
        statEditorAllowed: false,
        lotAllowed: true,
        legendaryAllowed: false,
    };
}

/** Type d'annonce (`MarketListingType`) correspondant à une famille. */
export function marketListingKindForFamily(
    family: MarketItemFamily
): "EQUIPMENT" | "RESOURCE" {
    // Cosmétique = un **objet** (pas un lot) ; Ressources / Autres = un lot.
    return family === "RESOURCES_OTHER" ? "RESOURCE" : "EQUIPMENT";
}


