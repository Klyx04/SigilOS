/**
 * Module « Marché » — **formatage de dates déterministe** (BUG-9).
 *
 * ⚠️ Fichier **PUR** (aucune dépendance React / Node) : importable côté serveur,
 * côté client et en test unitaire.
 *
 * 🎯 Pourquoi : `Date#toLocaleDateString("fr-FR")` produisait une chaîne qui
 * différait entre le rendu **serveur** (Node, fuseau + ICU du serveur) et
 * l'hydratation **navigateur** (fuseau + ICU du poste) ⇒ React levait
 * `error #418` (« text didn't match ») sur `/marche` (`src/temp/debug.md`).
 *
 * ✅ Solution : un format **figé** (`JJ/MM/AAAA` et `JJ/MM/AAAA HH:mm`), calculé
 * sur les composantes **UTC** — donc **identique** des deux côtés, quel que soit
 * le fuseau ou la version d'ICU. Le fuseau affiché est documenté dans l'UI.
 */

const EMPTY = "—";

function toParts(value: string | number | Date | null | undefined) {
    if (value === null || value === undefined) return null;
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    if (Number.isNaN(time)) return null;
    return {
        day: String(date.getUTCDate()).padStart(2, "0"),
        month: String(date.getUTCMonth() + 1).padStart(2, "0"),
        year: String(date.getUTCFullYear()),
        hours: String(date.getUTCHours()).padStart(2, "0"),
        minutes: String(date.getUTCMinutes()).padStart(2, "0"),
    };
}

/** `JJ/MM/AAAA` (UTC) — `—` si la valeur est absente ou invalide. */
export function formatMarketDate(value: string | number | Date | null | undefined): string {
    const parts = toParts(value);
    if (!parts) return EMPTY;
    return `${parts.day}/${parts.month}/${parts.year}`;
}

/** `JJ/MM/AAAA HH:mm` (UTC) — `—` si la valeur est absente ou invalide. */
export function formatMarketDateTime(value: string | number | Date | null | undefined): string {
    const parts = toParts(value);
    if (!parts) return EMPTY;
    return `${parts.day}/${parts.month}/${parts.year} ${parts.hours}:${parts.minutes}`;
}
