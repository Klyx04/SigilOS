/**
 * 📚 Encyclopédie — règles pures d'affichage (ressources).
 *
 * Servent `ItemSearchPanel` (filtre par type + masquage des blocs vides) et la
 * route `/api/dofusdb/search` (normalisation du paramètre `category`).
 * Zéro dépendance réseau : testable sans base ni fetch.
 */

export type EncyclopediaCategory = "all" | "equipment" | "resources" | "consumables" | "cosmetics";

export const ENCYCLOPEDIA_CATEGORIES: readonly EncyclopediaCategory[] = [
    "all",
    "equipment",
    "resources",
    "consumables",
    "cosmetics",
] as const;

export const ENCYCLOPEDIA_CATEGORY_LABELS: Record<EncyclopediaCategory, string> = {
    all: "Tous",
    equipment: "Équipements",
    resources: "Ressources",
    consumables: "Consommables",
    cosmetics: "Apparats",
};

/** Normalise `?category=` : toute valeur hors allowlist retombe sur `all`. */
export function normalizeEncyclopediaCategory(raw: unknown): EncyclopediaCategory {
    if (raw === "equipment" || raw === "resources" || raw === "consumables" || raw === "cosmetics") {
        return raw;
    }
    return "all";
}

/**
 * Contrat d'affichage du lot B « obtention / utilisation souverain » (siphon en
 * base via le cron data-watch, ZÉRO appel réseau au rendu) : ces helpers sont
 * déjà verrouillés par tests, la source locale arrive ensuite.
 * Plafond de résultats par fiche (monstres, zones, chasses, recettes).
 */
export const MAX_USAGE_RESULTS = 10;

/**
 * Taux de drop FR (« 0,8 % ») depuis les 5 grades DofusDB
 * (`percentDropForGrade1..5`). Grades hétérogènes ⇒ fourchette « min – max % ».
 * Aucune valeur finie ⇒ `null` (on n'affiche rien plutôt qu'un faux 0 %).
 */
export function formatDropRate(rates: readonly unknown[]): string | null {
    const vals = rates.map(Number).filter((n) => Number.isFinite(n) && n > 0);
    if (vals.length === 0) return null;
    const fmt = (n: number): string =>
        `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
}

/**
 * Conditions de drop DofusDB (`criterions`, ex. « Mt=0&Ms=0 »).
 * Seuls les codes **mesurés** sont traduits (fragment Glourdorak 1/8, 14/10/2026 :
 * `Mt=0&Ms=0` = « Hors donjon et Hors arène » sur la fiche) ; tout autre code est
 * rendu tel quel — jamais inventé.
 */
const KNOWN_DROP_CRITERIONS: Record<string, string> = {
    "Mt=0": "Hors donjon",
    "Ms=0": "Hors arène",
};

export function decodeDropCriterions(raw: string, hasCriterions: boolean): string[] {
    const clean = (raw || "").trim();
    if (!hasCriterions || !clean) return [];
    return clean
        .split("&")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => KNOWN_DROP_CRITERIONS[part] ?? part);
}

export interface EncyclopediaMetaInput {
    /** Poids en pods (`realWeight` DofusDB, déjà siphonné). */
    realWeight?: number | null;
    /** Nom de panoplie (`itemSetName`, déjà siphonné). */
    itemSetName?: string | null;
}

export interface EncyclopediaMetaChip {
    key: "weight" | "set";
    label: string;
}

/**
 * Méta-chips de la fiche (poids, panoplie) : ne renvoie que les valeurs
 * connues — jamais de chip « inconnu », jamais de prix (bruit, pas info).
 */
export function resolveEncyclopediaMetaChips(input: EncyclopediaMetaInput): EncyclopediaMetaChip[] {
    const chips: EncyclopediaMetaChip[] = [];
    if (typeof input.realWeight === "number" && Number.isFinite(input.realWeight) && input.realWeight > 0) {
        chips.push({ key: "weight", label: `${input.realWeight} pod${input.realWeight > 1 ? "s" : ""}` });
    }
    const setName = typeof input.itemSetName === "string" ? input.itemSetName.trim() : "";
    if (setName) {
        chips.push({ key: "set", label: setName });
    }
    return chips;
}

export interface EncyclopediaBlocksInput {
    /** Nombre d'effets connus (`effects` ou `possibleEffects`). */
    effectsCount: number;
    /**
     * Drapeau souverain (`GameItem.hasRecipe` / DofusDB `hasRecipe`) :
     * `false` = sait qu'il n'y a pas de recette, `true`/`undefined` = à tenter.
     */
    hasRecipeFlag?: boolean | null;
    /** Recette déjà chargée (locale ou distante). */
    hasRecipeData: boolean;
    /** Chargement de la recette en cours. */
    loadingRecipe: boolean;
}

/**
 * Quels blocs afficher sous la fiche.
 * - Effets : seulement s'il y a au moins une ligne d'effet.
 * - Fabrication : seulement si une recette est possible (pas de bloc
 *   « Pas de recette disponible » quand on sait déjà qu'il n'y en a pas).
 */
export function resolveEncyclopediaBlocks(input: EncyclopediaBlocksInput): {
    showEffects: boolean;
    showRecipe: boolean;
} {
    const showEffects = Number(input.effectsCount ?? 0) > 0;
    const knowsNoRecipe =
        input.hasRecipeFlag === false && !input.hasRecipeData && !input.loadingRecipe;
    const showRecipe = !knowsNoRecipe;
    return { showEffects, showRecipe };
}
