/**
 * Journal des tâches CRON — règle **pure** d'agrégation, de filtre et de regroupement.
 *
 * Source : `cron:telemetry:history:<cronId>` (Redis, **10 dernières exécutions par
 * tâche**, TTL 7 jours) — cf. `src/lib/cron-telemetry.ts`. Ce module ne lit rien : il
 * transforme des enregistrements bruts, donc il se teste sans Redis.
 */

import { formatDetailValue } from "@/lib/detail-value";

export type CronJournalStatus = "success" | "error" | "unknown";

export type CronJournalEntry = {
    cronId: string;
    name: string;
    schedule: string;
    /** ISO 8601 (UTC) — la date d'exécution écrite par `recordCronExecution`. */
    lastRun: string;
    durationMs: number | null;
    status: CronJournalStatus;
    summary: string | null;
    details: Record<string, unknown> | null;
    lines: string[];
};

/** Plafond de sécurité : un journal ne rend jamais plus de 500 lignes d'un coup. */
export const CRON_JOURNAL_MAX_ENTRIES = 500;
/** Plafond de sécurité d'affichage des détails d'une exécution (perte **dite**). */
export const CRON_JOURNAL_MAX_DETAIL_ROWS = 200;
/** Fenêtres proposées dans l'UI (`all` = tout ce que Redis garde, 7 jours). */
export const CRON_JOURNAL_PERIOD_HOURS = { "24h": 24, "7d": 168 } as const;

export type CronJournalPeriod = keyof typeof CRON_JOURNAL_PERIOD_HOURS | "all";

/** Une tâche et son historique brut (déjà lu de Redis par l'appelant). */
export type CronJournalSource = {
    cronId: string;
    name: string;
    schedule: string;
    records: unknown[];
};

export type CronJournalFilters = {
    taskId?: string | null;
    status?: "all" | "success" | "error";
    period?: CronJournalPeriod;
    search?: string | null;
};

export type CronJournalFacets = {
    total: number;
    success: number;
    error: number;
    tasks: { cronId: string; name: string; count: number }[];
};

export type CronJournalDay = { day: string; entries: CronJournalEntry[] };

export type CronJournalDetailRow = { label: string; value: string };

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function parseEntry(source: CronJournalSource, raw: unknown): CronJournalEntry | null {
    const record = asRecord(raw);
    if (!record) return null;

    const rawDate = record.lastRun;
    if (typeof rawDate !== "string") return null;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return null;

    const status: CronJournalStatus =
        record.status === "success" || record.status === "error" ? record.status : "unknown";

    return {
        cronId: source.cronId,
        name: typeof record.name === "string" && record.name.trim().length > 0 ? record.name : source.name,
        schedule: source.schedule,
        lastRun: date.toISOString(),
        durationMs:
            typeof record.durationMs === "number" && Number.isFinite(record.durationMs)
                ? record.durationMs
                : null,
        status,
        summary: typeof record.summary === "string" ? record.summary : null,
        details: asRecord(record.details),
        lines: Array.isArray(record.lines)
            ? record.lines.filter((line): line is string => typeof line === "string").slice(0, 20)
            : [],
    };
}

/**
 * Aplatit les historiques de toutes les tâches en un journal unique : lignes illisibles
 * écartées, doublons (`tâche` + `date`) supprimés, tri du plus récent au plus ancien,
 * plafond de sécurité appliqué.
 */
export function buildCronJournal(sources: CronJournalSource[]): CronJournalEntry[] {
    const seen = new Set<string>();
    const entries: CronJournalEntry[] = [];

    for (const source of sources) {
        for (const raw of source.records ?? []) {
            const entry = parseEntry(source, raw);
            if (!entry) continue;
            const key = `${entry.cronId}|${entry.lastRun}`;
            if (seen.has(key)) continue;
            seen.add(key);
            entries.push(entry);
        }
    }

    entries.sort((a, b) => new Date(b.lastRun).getTime() - new Date(a.lastRun).getTime());
    return entries.slice(0, CRON_JOURNAL_MAX_ENTRIES);
}

/** Filtre le journal (tâche, statut, fenêtre temporelle, recherche plein texte). */
export function filterCronJournal(
    entries: CronJournalEntry[],
    filters: CronJournalFilters,
    now: number = Date.now(),
): CronJournalEntry[] {
    const term = (filters.search ?? "").trim().toLowerCase();
    const period = filters.period ?? "all";
    const since = period === "all" ? null : now - CRON_JOURNAL_PERIOD_HOURS[period] * 3_600_000;

    return entries.filter((entry) => {
        if (filters.taskId && filters.taskId !== "all" && entry.cronId !== filters.taskId) return false;
        if (filters.status && filters.status !== "all" && entry.status !== filters.status) return false;
        if (since !== null && new Date(entry.lastRun).getTime() < since) return false;

        if (term.length > 0) {
            const haystack = [
                entry.name,
                entry.cronId,
                entry.schedule,
                entry.summary ?? "",
                entry.lines.join(" "),
                entry.details ? JSON.stringify(entry.details) : "",
            ]
                .join(" ")
                .toLowerCase();
            if (!haystack.includes(term)) return false;
        }

        return true;
    });
}

/** Compteurs et tâches présentes — calculés sur le journal **non filtré**. */
export function cronJournalFacets(entries: CronJournalEntry[]): CronJournalFacets {
    const tasks = new Map<string, { cronId: string; name: string; count: number }>();
    let success = 0;
    let error = 0;

    for (const entry of entries) {
        if (entry.status === "success") success += 1;
        else if (entry.status === "error") error += 1;

        const row = tasks.get(entry.cronId) ?? { cronId: entry.cronId, name: entry.name, count: 0 };
        row.count += 1;
        tasks.set(entry.cronId, row);
    }

    return {
        total: entries.length,
        success,
        error,
        tasks: [...tasks.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr")),
    };
}

/** Regroupe par jour **UTC** (l'ordre du journal est conservé). */
export function groupCronJournalByDay(entries: CronJournalEntry[]): CronJournalDay[] {
    const days = new Map<string, CronJournalEntry[]>();
    for (const entry of entries) {
        const day = entry.lastRun.slice(0, 10);
        const list = days.get(day) ?? [];
        list.push(entry);
        days.set(day, list);
    }
    return [...days.entries()].map(([day, list]) => ({ day, entries: list }));
}

/**
 * Détails d'une exécution en lignes lisibles. Au-delà de `CRON_JOURNAL_MAX_DETAIL_ROWS`,
 * `hidden` dit **combien** de lignes ne sont pas affichées (jamais silencieux).
 */
export function cronJournalDetailRows(details: Record<string, unknown> | null): {
    rows: CronJournalDetailRow[];
    hidden: number;
} {
    if (!details) return { rows: [], hidden: 0 };

    const rows: CronJournalDetailRow[] = [];
    for (const [label, value] of Object.entries(details)) {
        const formatted = formatDetailValue(value);
        if (formatted === null) continue;
        rows.push({ label, value: formatted });
    }

    const hidden = Math.max(0, rows.length - CRON_JOURNAL_MAX_DETAIL_ROWS);
    return { rows: rows.slice(0, CRON_JOURNAL_MAX_DETAIL_ROWS), hidden };
}
