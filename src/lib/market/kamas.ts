/**
 * Module « Marché » — helper pur de formatage/parsing des kamas.
 *
 * Aucune dépendance React / Prisma / Node : ce fichier est importable aussi
 * bien côté serveur que côté client, et testable en unitaire.
 * C'est l'unique source de vérité pour la borne `KAMAS_MAX` (plafond Int32
 * PostgreSQL) et le format d'affichage français.
 */

/** Plafond absolu d'un prix en kamas (Int32 PostgreSQL) — garde Zod §6.2 / D4. */
export const KAMAS_MAX = 2_147_483_647;

/** Espace fine insécable utilisée comme séparateur de milliers (fr-FR). */
const GROUP_SEPARATOR = "\u202F";

/** Marque d'absence de prix (affichage seulement). */
export const KAMAS_EMPTY_LABEL = "—";

/**
 * `true` si la valeur est un entier de kamas valide (0 ≤ v ≤ KAMAS_MAX).
 * Les valeurs non entières, `NaN`, `Infinity` ou négatives sont refusées.
 */
export function isValidKamas(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= KAMAS_MAX
    );
}

/**
 * Formate un prix en kamas pour l'affichage : `12500` → `"12 500 k"`.
 * Retourne `KAMAS_EMPTY_LABEL` pour `null`/`undefined`/valeur non finie.
 */
export function formatKamas(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return KAMAS_EMPTY_LABEL;
    }
    const rounded = Math.trunc(value);
    const sign = rounded < 0 ? "-" : "";
    const grouped = Math.abs(rounded)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
    return `${sign}${grouped}${GROUP_SEPARATOR}k`;
}

/**
 * Parse une saisie utilisateur de kamas (`"12 500 k"`, `"12.500"`, `"12500"`).
 * Tolérant sur les séparateurs (espaces, points, virgules, suffixe `k`/`K`),
 * strict sur le résultat : entier `0 ≤ v ≤ KAMAS_MAX`, sinon `null`.
 */
export function parseKamas(input: string | null | undefined): number | null {
    if (input === null || input === undefined) return null;

    const cleaned = input
        .trim()
        .replace(/[kK]\s*$/, "")
        .replace(/[\s\u00A0\u202F.,']/g, "");

    if (cleaned === "") return null;
    if (!/^\d+$/.test(cleaned)) return null;

    const parsed = Number.parseInt(cleaned, 10);
    return isValidKamas(parsed) ? parsed : null;
}
