/**
 * Sérialisation JSON **stable** (clés triées) — brique partagée.
 *
 * Pourquoi : PostgreSQL réordonne les clés d'une colonne `JSONB`. Comparer deux valeurs
 * avec `JSON.stringify` produit donc des différences **fantômes** et casse l'idempotence
 * d'un siphon (il réécrit à chaque passage). Piège déjà payé sur les siphons.
 *
 * ⚠️ Module pur, sans import : utilisable par un script, une action serveur ou un test.
 */

/** JSON déterministe : mêmes données ⇒ mêmes octets, quel que soit l'ordre des clés. */
export function stableStringify(value: unknown): string {
    if (value === null || value === undefined) return "null";
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    if (typeof value === "object") {
        const record = value as Record<string, unknown>;
        const keys = Object.keys(record).sort();
        return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}
