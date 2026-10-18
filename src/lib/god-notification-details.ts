/**
 * Projection humaine des alertes God — **une seule règle, trois lecteurs**.
 *
 * Mesure du 18/10/2026 (`dev` = `9f1d9649`) : `notifyGod` construisait les champs de
 * l'embed Discord à la volée (`fields`, libellés français) mais ne persistait que
 * `metadata` (clés techniques). La même alerte disait donc « Profils traités : 12 » sur
 * Discord et affichait `success_count` dans la console God — deux vérités pour un fait,
 * et une console qui rendait toutes les clés sans borne de longueur.
 *
 * Ici :
 *  · `details` est la **vérité complète** : tout ce que l'appelant fournit est conservé,
 *    dans l'ordre, sans coupure produit ;
 *  · `toGodEmbedFields()` en est une **projection bornée** aux limites techniques de
 *    Discord (25 champs, 1 024 caractères par valeur) — jamais une seconde vérité ;
 *  · la console God affiche `details` **en entier** (aucune troncature d'affichage).
 *
 * Les deux constantes `GOD_DETAILS_MAX_FIELDS` / `GOD_DETAILS_VALUE_MAX` sont des
 * **plafonds de sécurité** (charge anormale), pas des bornes produit. Mesure du 18/10 :
 * le plus gros émetteur réel (`data-watch`) envoie **9** champs. Si un plafond est atteint,
 * la perte est **dite** dans un champ dédié — jamais silencieuse.
 */

export type GodNotificationDetail = { name: string; value: string; inline?: boolean };

/** Plafond de sécurité du nombre de détails **conservés** en base. */
export const GOD_DETAILS_MAX_FIELDS = 200;
/** Plafond de sécurité d'une valeur conservée en base. */
export const GOD_DETAILS_VALUE_MAX = 4000;
/** Plafond d'un libellé (limite Discord, appliquée aussi en base pour rester cohérent). */
export const GOD_DETAILS_NAME_MAX = 256;
/** Limite dure de Discord : nombre de champs par embed. */
export const GOD_DETAILS_EMBED_MAX_FIELDS = 25;
/** Limite dure de Discord : caractères par valeur d'embed. */
export const GOD_DETAILS_EMBED_VALUE_MAX = 1024;
/** Libellé du champ qui dit, dans l'embed, que tout n'a pas pu être envoyé. */
export const GOD_DETAILS_EMBED_OVERFLOW_NAME = "… autres détails";
/** Borne de lecture de la console God (une requête ne rapporte jamais plus). */
export const GOD_NOTIFICATIONS_LIST_MAX = 100;

const ELLIPSIS = "…";

function truncate(value: string, max: number): string {
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(1, max - ELLIPSIS.length)).trimEnd()}${ELLIPSIS}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/** Rend une valeur exploitable à l'écran (jamais `[object Object]`). */
export function formatGodDetailValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? truncate(trimmed, GOD_DETAILS_VALUE_MAX) : null;
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return String(value);
    }
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) {
        const parts = value
            .map((entry) => formatGodDetailValue(entry))
            .filter((entry): entry is string => entry !== null);
        return parts.length > 0 ? truncate(parts.join(", "), GOD_DETAILS_VALUE_MAX) : null;
    }
    if (isPlainObject(value)) {
        try {
            return truncate(JSON.stringify(value), GOD_DETAILS_VALUE_MAX);
        } catch {
            return null;
        }
    }
    return truncate(String(value), GOD_DETAILS_VALUE_MAX);
}

/** Normalise une liste de champs ; `null` si rien n'est affichable. */
export function normalizeGodNotificationDetails(input: unknown): GodNotificationDetail[] | null {
    if (!Array.isArray(input)) return null;

    const rows: GodNotificationDetail[] = [];
    for (const entry of input) {
        if (!isPlainObject(entry)) continue;
        const rawName = entry.name;
        const name = typeof rawName === "string" ? rawName.trim() : "";
        if (name.length === 0) continue;
        const value = formatGodDetailValue(entry.value);
        if (value === null) continue;

        const label = truncate(name, GOD_DETAILS_NAME_MAX);
        rows.push(
            typeof entry.inline === "boolean"
                ? { name: label, value, inline: entry.inline }
                : { name: label, value },
        );
    }

    if (rows.length === 0) return null;
    if (rows.length <= GOD_DETAILS_MAX_FIELDS) return rows;

    // Plafond de sécurité atteint : on garde les premiers et on **dit** ce qui manque.
    const kept = rows.slice(0, GOD_DETAILS_MAX_FIELDS);
    kept.push({
        name: "⚠️ Détails non conservés",
        value: `${rows.length - GOD_DETAILS_MAX_FIELDS} champ(s) supplémentaires ignorés (charge anormale).`,
        inline: false,
    });
    return kept;
}

/** Détails dérivés d'un `metadata` brut (alertes écrites avant la colonne `details`). */
export function detailsFromMetadata(metadata: unknown): GodNotificationDetail[] | null {
    if (!isPlainObject(metadata)) return null;
    return normalizeGodNotificationDetails(
        Object.entries(metadata).map(([name, value]) => ({ name, value })),
    );
}

/** Règle unique : `fields` (libellés humains) sinon `metadata` (clés techniques). */
export function resolveGodNotificationDetails(params: {
    fields?: unknown;
    metadata?: unknown;
}): GodNotificationDetail[] | null {
    return normalizeGodNotificationDetails(params.fields) ?? detailsFromMetadata(params.metadata);
}

/**
 * Projection bornée pour un embed Discord — **extrait** de `details`, jamais une autre
 * vérité : mêmes libellés, mêmes valeurs, même ordre. Au-delà des limites de Discord, la
 * dernière ligne dit combien de détails restent visibles **dans la console God**.
 */
export function toGodEmbedFields(
    details: GodNotificationDetail[] | null | undefined,
): GodNotificationDetail[] | undefined {
    if (!details || details.length === 0) return undefined;

    const projected: GodNotificationDetail[] = details.map((detail) => ({
        name: truncate(detail.name, GOD_DETAILS_NAME_MAX),
        value: truncate(detail.value, GOD_DETAILS_EMBED_VALUE_MAX),
        ...(detail.inline === undefined ? {} : { inline: detail.inline }),
    }));

    if (projected.length <= GOD_DETAILS_EMBED_MAX_FIELDS) return projected;

    const kept = projected.slice(0, GOD_DETAILS_EMBED_MAX_FIELDS - 1);
    kept.push({
        name: GOD_DETAILS_EMBED_OVERFLOW_NAME,
        value: `${projected.length - kept.length} détail(s) de plus — tout est visible dans la console God.`,
        inline: false,
    });
    return kept;
}
