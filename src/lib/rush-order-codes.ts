/**
 * Référentiel des **Ordres d'alignement** d'une séquence de guide — source unique.
 *
 * Pourquoi ce module : deux vocabulaires coexistent dans le dépôt et ils ne disent
 * pas la même chose.
 *
 * - `ORDERS` (`src/lib/dofus-assets.ts`) porte des ids **courts** (`vaillant`,
 *   `attentif`…) : c'est le vocabulaire de l'**alignement de guilde** (`alignmentOrder`
 *   d'un profil), avec icônes et paliers.
 * - `GuideSequence.alignOrderCode` attend le code **long** (`coeur_vaillant`,
 *   `oeil_attentif`…) — c'est ce que la règle de route (`resolveRushRoute`) et les
 *   verrous de test manipulent.
 *
 * Le studio God écrivait l'id **court** dans la colonne : la quête d'Ordre devenait
 * invisible dès qu'un joueur choisissait son Ordre (comparaison stricte). On écrit
 * désormais le code **canonique**, et `normalizeOrderCode` accepte encore l'ancien
 * pour ne pas masquer les données déjà saisies.
 */

export type RushOrderCamp = "bontarien" | "brakmarien";

export type RushOrderCode = {
    /** Code canonique écrit dans `GuideSequence.alignOrderCode`. */
    code: string;
    /** Libellé français. */
    label: string;
    /** Id **court** du référentiel `ORDERS` (alignement de guilde). */
    legacyId: string;
    /** Cité à laquelle l'Ordre appartient. */
    camp: RushOrderCamp;
};

export const RUSH_ORDER_CODES: RushOrderCode[] = [
    { code: "coeur_vaillant", label: "Cœur Vaillant", legacyId: "vaillant", camp: "bontarien" },
    { code: "oeil_attentif", label: "Œil Attentif", legacyId: "attentif", camp: "bontarien" },
    { code: "esprit_salvateur", label: "Esprit Salvateur", legacyId: "salvateur", camp: "bontarien" },
    { code: "coeur_saignant", label: "Cœur Saignant", legacyId: "saignant", camp: "brakmarien" },
    { code: "oeil_putride", label: "Œil Putride", legacyId: "putride", camp: "brakmarien" },
    { code: "esprit_malsain", label: "Esprit Malsain", legacyId: "malsain", camp: "brakmarien" },
];

/** Minuscule, sans accents, ligatures dépliées — clé de comparaison tolérante. */
function key(value: string | null | undefined): string {
    return (value ?? "")
        .trim()
        .toLowerCase()
        .replace(/œ/g, "oe")
        .replace(/æ/g, "ae")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Mots significatifs d'un libellé : `Ordre du Cœur Vaillant` et `Cœur Vaillant`
 * donnent la même clé (`coeur vaillant`). Les mots de liaison du référentiel de
 * guilde (« ordre », « du », « de », « de l' ») ne portent aucune information.
 */
const STOP_WORDS = new Set(["ordre", "du", "de", "des", "la", "le", "les", "l", "d"]);

function words(value: string | null | undefined): string {
    return key(value)
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((w) => w && !STOP_WORDS.has(w))
        .join(" ");
}

/** Ordres d'une cité (un Ordre n'appartient qu'à un camp). */
export function orderCodesForCamp(camp: string | null | undefined): RushOrderCode[] {
    const normalized = key(camp);
    if (normalized.startsWith("bont")) return RUSH_ORDER_CODES.filter((o) => o.camp === "bontarien");
    if (normalized.startsWith("brak")) return RUSH_ORDER_CODES.filter((o) => o.camp === "brakmarien");
    return [];
}

/**
 * Code canonique d'un Ordre, ou `null` si la valeur n'en désigne aucun.
 * Accepte le code long, l'id court historique et le libellé (complet ou nu).
 */
export function normalizeOrderCode(value: string | null | undefined): string | null {
    const normalized = key(value);
    if (!normalized) return null;

    // 1. Code long, id court : comparaison stricte (pas de mots à retirer).
    const exact = RUSH_ORDER_CODES.find((o) => key(o.code) === normalized || key(o.legacyId) === normalized);
    if (exact) return exact.code;

    // 2. Libellé : on compare les mots significatifs (« Ordre du Cœur Vaillant » → « coeur vaillant »).
    const target = words(value);
    if (!target) return null;
    const byLabel = RUSH_ORDER_CODES.find((o) => words(o.label) === target);
    return byLabel?.code ?? null;
}

/** Cité d'un Ordre canonique, ou `null`. */
export function orderCamp(code: string | null | undefined): RushOrderCamp | null {
    const canonical = normalizeOrderCode(code);
    if (!canonical) return null;
    return RUSH_ORDER_CODES.find((o) => o.code === canonical)?.camp ?? null;
}

