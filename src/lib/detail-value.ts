/**
 * Formatage d'une valeur de détail pour l'affichage — **règle partagée**.
 *
 * Deux écrans rendent des couples `libellé → valeur` issus de JSON libre :
 * les alertes God (`GodNotification.details`) et le journal des tâches CRON
 * (`cron:telemetry:history:*`). Avant ce module, chacun aurait sa propre
 * conversion — et l'un des deux finissait par afficher `[object Object]`.
 *
 * Règles (une seule fois) : jamais `[object Object]`, tableaux **joints**,
 * dates en ISO, scalaires en texte, valeurs vides retirées, longueur bornée
 * avec une marque `…` visible.
 */

const ELLIPSIS = "…";

/** Tronque une valeur et **dit** qu'elle l'est (marque `…`). */
export function truncateDetailValue(value: string, max: number): string {
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(1, max - ELLIPSIS.length)).trimEnd()}${ELLIPSIS}`;
}

/** Objet « simple » (pas un tableau, pas une date, pas `null`). */
export function isPlainDetailObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/** Rend une valeur exploitable à l'écran ; `null` si elle n'apprend rien. */
export function formatDetailValue(value: unknown, max = 4000): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? truncateDetailValue(trimmed, max) : null;
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return String(value);
    }
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
        const parts = value
            .map((entry) => formatDetailValue(entry, max))
            .filter((entry): entry is string => entry !== null);
        return parts.length > 0 ? truncateDetailValue(parts.join(", "), max) : null;
    }
    if (isPlainDetailObject(value)) {
        try {
            return truncateDetailValue(JSON.stringify(value), max);
        } catch {
            return null;
        }
    }
    return truncateDetailValue(String(value), max);
}
