/**
 * Vues des journaux d'audit God — helpers **purs** (aucun Prisma, aucun
 * `"use server"` : importables client **et** serveur).
 *
 * G6 (pagination **numérotée** + « par page », presets de période, regroupement
 * par **jour**) : ces règles n'existaient nulle part — le viewer God n'affichait
 * qu'un « Page 1 / 2 ‹ › » et chaque écran recalculait son découpage. Elles vivent
 * ici, **une seule source**, testables sans base ni DOM.
 *
 * ⚠️ Les **jours** sont calculés en **UTC** (`toISOString().slice(0, 10)`) : la
 * page des logs est rendue par le serveur puis re-rendue par le client après un
 * filtre ⇒ un découpage en heure locale donnerait deux regroupements différents
 * le même jour (« Aujourd'hui » du serveur ≠ celui du navigateur). Même choix que
 * le module Marché (`src/lib/market/format-date.ts`).
 */

import { MS_PER_DAY } from "@/lib/audit-retention-policy";

// ============================================================================
// Période
// ============================================================================

/** Presets de période du journal. `all` = aucune borne (toute la rétention). */
export type AuditLogPeriod = "all" | "24h" | "7d" | "30d" | "90d";

export const AUDIT_LOG_PERIODS: readonly { value: AuditLogPeriod; label: string; hours: number }[] = [
    { value: "all", label: "Toute la rétention", hours: 0 },
    { value: "24h", label: "Dernières 24 h", hours: 24 },
    { value: "7d", label: "7 derniers jours", hours: 24 * 7 },
    { value: "30d", label: "30 derniers jours", hours: 24 * 30 },
    { value: "90d", label: "90 derniers jours", hours: 24 * 90 },
];

/** Défaut = aucune borne : le total affiché reste celui de la rétention entière. */
export const DEFAULT_AUDIT_LOG_PERIOD: AuditLogPeriod = "all";

export function isAuditLogPeriod(value: unknown): value is AuditLogPeriod {
    return AUDIT_LOG_PERIODS.some((p) => p.value === value);
}

/**
 * Début de période — `undefined` pour « Toute la rétention » (jamais une date
 * arbitraire : ce qui n'est pas borné n'est pas filtré).
 */
export function auditLogPeriodStart(period: AuditLogPeriod, now: Date = new Date()): Date | undefined {
    const preset = AUDIT_LOG_PERIODS.find((p) => p.value === period);
    if (!preset || preset.hours === 0) return undefined;
    return new Date(now.getTime() - preset.hours * 60 * 60 * 1000);
}

// ============================================================================
// Pagination
// ============================================================================

export const AUDIT_LOG_PAGE_SIZES = [20, 50, 100] as const;
export type AuditLogPageSize = (typeof AUDIT_LOG_PAGE_SIZES)[number];
export const DEFAULT_AUDIT_LOG_PAGE_SIZE: AuditLogPageSize = 50;

/**
 * Fenêtre de pagination **numérotée** : première page, dernière page, la page
 * courante et `span` voisines. `"gap"` = ellipse (jamais un trou muet, jamais 90
 * boutons). Toujours croissant, sans doublon.
 */
export function paginationWindow(page: number, totalPages: number, span = 1): (number | "gap")[] {
    if (totalPages <= 0) return [];
    if (totalPages === 1) return [1];

    const current = Math.min(Math.max(Math.trunc(page) || 1, 1), totalPages);
    const first = Math.max(1, current - span);
    const last = Math.min(totalPages, current + span);

    const window: (number | "gap")[] = [];
    if (first > 1) {
        window.push(1);
        if (first > 2) window.push("gap");
    }
    for (let p = first; p <= last; p++) window.push(p);
    if (last < totalPages) {
        if (last < totalPages - 1) window.push("gap");
        window.push(totalPages);
    }
    return window;
}

/** Nombre de pages pour `total` entrées (au moins 1 : une page vide reste une page). */
export function totalPagesOf(total: number, pageSize: number): number {
    if (pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(Math.max(total, 0) / pageSize));
}

// ============================================================================
// Regroupement par jour (UTC)
// ============================================================================

/** Clé de jour UTC `AAAA-MM-JJ` — jamais une heure locale. */
export function utcDayKey(date: Date | string): string {
    const value = typeof date === "string" ? new Date(date) : date;
    return value.toISOString().slice(0, 10);
}

/** Libellé humain d'un jour UTC : « Aujourd'hui », « Hier », « 25/09/2026 ». */
export function utcDayLabel(date: Date | string, now: Date = new Date()): string {
    const key = utcDayKey(date);
    if (key === utcDayKey(now)) return "Aujourd'hui";
    if (key === utcDayKey(new Date(now.getTime() - MS_PER_DAY))) return "Hier";
    const [year, month, day] = key.split("-");
    return `${day}/${month}/${year}`;
}

export interface LogDayGroup<T> {
    key: string;
    label: string;
    rows: T[];
}

/**
 * Regroupe des lignes **déjà triées** (du plus récent au plus ancien) par jour
 * UTC, dans leur ordre d'arrivée — l'affichage ne réordonne jamais.
 */
export function groupLogsByDay<T>(
    rows: T[],
    getDate: (row: T) => Date | string,
    now: Date = new Date(),
): LogDayGroup<T>[] {
    const groups: LogDayGroup<T>[] = [];
    for (const row of rows) {
        const date = getDate(row);
        const key = utcDayKey(date);
        const current = groups[groups.length - 1];
        if (current && current.key === key) {
            current.rows.push(row);
            continue;
        }
        groups.push({ key, label: utcDayLabel(date, now), rows: [row] });
    }
    return groups;
}

export interface DailyCount {
    key: string;
    label: string;
    count: number;
}

/**
 * Série **continue** de compteurs par jour UTC (les jours sans ligne valent `0`),
 * du plus ancien au plus récent — l'affichage ne « saute » jamais un jour vide
 * (un trou non représenté se lit comme une absence de mesure).
 */
export function dailyCounts(dates: (Date | string)[], days: number, now: Date = new Date()): DailyCount[] {
    const boundedDays = Math.min(Math.max(Math.trunc(days) || 1, 1), 366);
    const counts = new Map<string, number>();
    for (const date of dates) {
        const key = utcDayKey(date);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const series: DailyCount[] = [];
    for (let offset = boundedDays - 1; offset >= 0; offset--) {
        const date = new Date(now.getTime() - offset * MS_PER_DAY);
        const key = utcDayKey(date);
        series.push({ key, label: utcDayLabel(date, now), count: counts.get(key) ?? 0 });
    }
    return series;
}
