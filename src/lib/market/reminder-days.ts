/**
 * Module « Marché » — **saisie des paliers de rappel** (durées J+n).
 *
 * ⚠️ Fichier **PUR** (aucune dépendance React / Prisma / Node) : importable par
 * les panneaux de réglages (God **et** guilde), côté client, et par les tests.
 *
 * 🎯 Pourquoi un helper partagé (T4 / D-B) : les deux panneaux saisissaient le
 * même champ avec **deux** jeux de bornes codés en dur (1–59 d'un côté, aucune
 * borne de l'autre) — un « 999 » invisible pouvait donc partir en base. Ici les
 * bornes viennent de `MARKET_SETTINGS_BOUNDS` et la saisie **inexploitable** est
 * refusée (`null`) au lieu d'être remplacée en silence par une valeur arbitraire
 * (règle projet : fail-closed, jamais de valeur inventée côté serveur).
 */

import { MARKET_SETTINGS_BOUNDS } from "@/server/actions/market-constants";

/** Nombre maximal de paliers de rappel acceptés (§9.1 : J+n, n ≤ 3). */
export const MARKET_REMINDER_DAYS_MAX = 3;

/**
 * « 7, 15 » → `[7, 15]`.
 *
 * - doublons supprimés, tri croissant, **max 3** valeurs ;
 * - valeurs hors bornes (`MARKET_SETTINGS_BOUNDS.marketReminderDays`) ignorées ;
 * - `null` si **aucune** valeur exploitable ⇒ l'appelant **refuse** la saisie
 *   (jamais un tableau vide écrit en base).
 */
export function parseReminderDays(raw: string): number[] | null {
    const { min, max } = MARKET_SETTINGS_BOUNDS.marketReminderDays;
    const days = [
        ...new Set(
            raw
                .split(",")
                .map((part) => Number.parseInt(part.trim(), 10))
                .filter((value) => Number.isInteger(value) && value >= min && value <= max)
        ),
    ]
        .sort((a, b) => a - b)
        .slice(0, MARKET_REMINDER_DAYS_MAX);

    return days.length > 0 ? days : null;
}

/** `[7, 15]` → « 7, 15 » (affichage des valeurs **en base**, jamais un tableau vide). */
export function formatReminderDays(days: readonly number[] | null | undefined): string {
    if (!days || days.length === 0) return "";
    return [...days].sort((a, b) => a - b).join(", ");
}
