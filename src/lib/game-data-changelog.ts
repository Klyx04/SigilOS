/**
 * 🔍 **Journal des changements** des siphons game-data — « quoi a changé, sur quelle fiche,
 * avant → après ». C'est la brique qui manquait : les cœurs calculaient des écarts (items par
 * hash, quêtes NEW/MODIFIED) puis **les oubliaient**.
 *
 * ⚠️ **Borné par construction** (demande user : « faut pas remplir le VPS à l'infini ») :
 *   · `GAME_DATA_CHANGELOG_KEEP_PER_DATASET` = 500 entrées les plus récentes **par dataset** ;
 *   · `GAME_DATA_CHANGELOG_MAX_AGE_DAYS` = 30 jours ;
 *   · valeurs tronquées (`summarizeValue`) et nombre de champs borné.
 * La purge tourne **à chaque écriture** (`recordGameDataChanges`) ⇒ la table ne peut pas croître
 * sans limite, même si personne ne s'en occupe.
 *
 * ⚠️ **Serveur uniquement** (importe `@/lib/prisma`) : les composants client passent par
 * l'action `getGameDataChangeLog` (`game-data-sync-actions.ts`).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { GameDataDataset } from "@/lib/game-data-sync-state";

/** Entrées conservées par dataset (les plus récentes). */
export const GAME_DATA_CHANGELOG_KEEP_PER_DATASET = 500;
/** Âge maximal d'une entrée, en jours. */
export const GAME_DATA_CHANGELOG_MAX_AGE_DAYS = 30;
/** Nombre de champs détaillés par changement (au-delà : tronqué). */
export const GAME_DATA_CHANGELOG_MAX_FIELDS = 12;
/** Taille maximale d'une valeur sérialisée dans le journal (caractères). */
export const GAME_DATA_CHANGELOG_MAX_VALUE_CHARS = 240;

/**
 * Libellé de rétention, **dérivé des constantes ci-dessus** — affiché par la modale (via
 * l'action serveur : un composant client ne peut pas importer ce module, qui charge Prisma).
 */
export const GAME_DATA_CHANGELOG_RETENTION_LABEL =
    `${GAME_DATA_CHANGELOG_MAX_AGE_DAYS} jours ou ${GAME_DATA_CHANGELOG_KEEP_PER_DATASET} entrées par jeu de données (le plus restrictif gagne)`;

export type GameDataChangeType = "NEW" | "MODIFIED" | "REMOVED";

export interface GameDataChangeField {
    before: unknown;
    after: unknown;
}

export interface GameDataChangeEntry {
    entityType: string;
    entityId: string;
    entityName?: string | null;
    changeType: GameDataChangeType;
    fields?: Record<string, GameDataChangeField> | null;
}

/**
 * 📏 Réduit une valeur à ce qui est utile dans un journal : jamais le payload entier.
 * Objet → JSON tronqué, tableau → `[N : a, b, …]`, chaîne → tronquée.
 */
export function summarizeValue(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
        return value.length > GAME_DATA_CHANGELOG_MAX_VALUE_CHARS
            ? `${value.slice(0, GAME_DATA_CHANGELOG_MAX_VALUE_CHARS)}…`
            : value;
    }
    if (typeof value === "number" || typeof value === "boolean") return value;
    if (Array.isArray(value)) {
        if (value.length === 0) return "[]";
        const head = value
            .slice(0, 3)
            .map((v) => (typeof v === "object" && v !== null ? JSON.stringify(v).slice(0, 60) : String(v)))
            .join(", ");
        const body =
            head.length > GAME_DATA_CHANGELOG_MAX_VALUE_CHARS
                ? `${head.slice(0, GAME_DATA_CHANGELOG_MAX_VALUE_CHARS)}…`
                : head;
        return `[${value.length} : ${body}${value.length > 3 ? ", …" : ""}]`;
    }
    try {
        const json = JSON.stringify(value);
        return json.length > GAME_DATA_CHANGELOG_MAX_VALUE_CHARS
            ? `${json.slice(0, GAME_DATA_CHANGELOG_MAX_VALUE_CHARS)}… (${json.length} car.)`
            : json;
    } catch {
        return "(non sérialisable)";
    }
}

/**
 * 🧮 Diff **pur** entre deux versions d'une même fiche, limité aux champs demandés.
 * `null` si rien n'a changé (on ne journalise jamais du vide).
 */
export function diffFields(
    before: Record<string, unknown> | null | undefined,
    after: Record<string, unknown>,
    keys: readonly string[],
): Record<string, GameDataChangeField> | null {
    if (!before) return null;
    const out: Record<string, GameDataChangeField> = {};
    for (const key of keys) {
        const b = before[key];
        const a = after[key];
        // Comparaison JSON : suffisante pour des scalaires et de petites listes.
        if (JSON.stringify(b ?? null) === JSON.stringify(a ?? null)) continue;
        out[key] = { before: summarizeValue(b), after: summarizeValue(a) };
        if (Object.keys(out).length >= GAME_DATA_CHANGELOG_MAX_FIELDS) break;
    }
    return Object.keys(out).length > 0 ? out : null;
}


/**
 * 🔍 Diff d'une **collection** indexée par id (grimoire d'une classe, monstres d'une famille,
 * sorts d'un boss…) : une entrée par élément **nouveau / modifié / retiré**, les champs modifiés
 * étant bornés par `diffFields`/`summarizeValue` (jamais le payload entier).
 *
 * `before = null` ⇒ tout est nouveau (première passe : utile à voir, borné à la lecture).
 */
export function diffCollection<T extends Record<string, unknown>>(
    before: T[] | null | undefined,
    after: T[],
    opts: {
        entityType: string;
        idKey?: string;
        labelKey?: string;
        /** Préfixe du libellé (ex. `Huppermage`) pour que la modale soit lisible seule. */
        labelPrefix?: string;
        /** Champs comparés (défaut : toutes les clés de l'élément). */
        keys?: readonly string[];
    },
): GameDataChangeEntry[] {
    const idKey = opts.idKey ?? "id";
    const labelKey = opts.labelKey ?? "name";
    const entries: GameDataChangeEntry[] = [];
    const beforeMap = new Map<string, T>();
    for (const item of before ?? []) {
        const id = item[idKey];
        if (id !== null && id !== undefined) beforeMap.set(String(id), item);
    }

    const seen = new Set<string>();
    for (const item of after) {
        const id = item[idKey];
        if (id === null || id === undefined) continue;
        const key = String(id);
        seen.add(key);
        const label = [opts.labelPrefix, String(item[labelKey] ?? `#${key}`)].filter(Boolean).join(" · ");
        const previous = beforeMap.get(key);
        if (!previous) {
            entries.push({ entityType: opts.entityType, entityId: key, entityName: label, changeType: "NEW" });
            continue;
        }
        const fields = diffFields(previous, item, opts.keys ?? Object.keys(item));
        if (fields) {
            entries.push({
                entityType: opts.entityType,
                entityId: key,
                entityName: label,
                changeType: "MODIFIED",
                fields,
            });
        }
    }

    for (const [key, item] of beforeMap) {
        if (seen.has(key)) continue;
        entries.push({
            entityType: opts.entityType,
            entityId: key,
            entityName: [opts.labelPrefix, String(item[labelKey] ?? `#${key}`)].filter(Boolean).join(" · "),
            changeType: "REMOVED",
        });
    }
    return entries;
}

/**
 * Enregistre des changements (batch) **et purge** dans la foulée.
 * Ne lève jamais : un journal ne doit pas casser un siphon.
 */
export async function recordGameDataChanges(
    dataset: GameDataDataset,
    entries: GameDataChangeEntry[],
    opts: { runId?: string } = {},
): Promise<number> {
    if (entries.length === 0) return 0;
    try {
        await db.gameDataChangeLog.createMany({
            data: entries.map((e) => ({
                dataset,
                entityType: e.entityType,
                entityId: String(e.entityId),
                entityName: e.entityName ?? null,
                changeType: e.changeType,
                fields: (e.fields ?? null) as never,
                runId: opts.runId ?? null,
            })),
        });
        await pruneGameDataChangeLog(dataset);
        return entries.length;
    } catch (error) {
        logger.warn("[game-data-changelog] écriture impossible (non bloquant)", {
            error: error instanceof Error ? error.message : String(error),
        });
        return 0;
    }
}

/** Purge bornée : âge maximal + nombre maximum d'entrées **par dataset**. */
export async function pruneGameDataChangeLog(dataset?: GameDataDataset): Promise<number> {
    try {
        const cutoff = new Date(Date.now() - GAME_DATA_CHANGELOG_MAX_AGE_DAYS * 24 * 3600 * 1000);
        const removed = await db.gameDataChangeLog.deleteMany({
            where: { ...(dataset ? { dataset } : {}), createdAt: { lt: cutoff } },
        });
        const targetDatasets = dataset
            ? [dataset]
            : (await db.gameDataChangeLog.findMany({ distinct: ["dataset"], select: { dataset: true } })).map(
                  (r) => r.dataset as GameDataDataset,
              );

        let trimmed = 0;
        for (const d of targetDatasets) {
            const beyond = await db.gameDataChangeLog.findMany({
                where: { dataset: d },
                orderBy: { createdAt: "desc" },
                skip: GAME_DATA_CHANGELOG_KEEP_PER_DATASET,
                select: { id: true },
            });
            if (beyond.length === 0) continue;
            const res = await db.gameDataChangeLog.deleteMany({ where: { id: { in: beyond.map((b) => b.id) } } });
            trimmed += res.count;
        }
        return removed.count + trimmed;
    } catch (error) {
        logger.warn("[game-data-changelog] purge impossible", {
            error: error instanceof Error ? error.message : String(error),
        });
        return 0;
    }
}

/** Journal d'un dataset (le plus récent d'abord) — lu par la modale du Tableau. */
export async function getGameDataChangeLog(
    dataset: GameDataDataset,
    opts: { limit?: number; changeType?: GameDataChangeType | "ALL" } = {},
): Promise<GameDataChangeRow[]> {
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 300);
    const rows = await db.gameDataChangeLog.findMany({
        where: {
            dataset,
            ...(opts.changeType && opts.changeType !== "ALL" ? { changeType: opts.changeType } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
    return rows.map(toGameDataChangeRow);
}

/**
 * Ligne **sérialisable** pour la modale (une `Date` Prisma ne se transporte pas telle quelle
 * d'une action serveur jusqu'au client de façon fiable ⇒ on envoie de l'ISO).
 */
export interface GameDataChangeRow {
    id: string;
    entityType: string;
    entityId: string;
    entityName: string | null;
    changeType: GameDataChangeType;
    fields: Record<string, GameDataChangeField> | null;
    createdAt: string;
}

export function toGameDataChangeRow(row: {
    id: string;
    entityType: string;
    entityId: string;
    entityName: string | null;
    changeType: string;
    fields: unknown;
    createdAt: Date;
}): GameDataChangeRow {
    return {
        id: row.id,
        entityType: row.entityType,
        entityId: row.entityId,
        entityName: row.entityName,
        changeType: (["NEW", "MODIFIED", "REMOVED"] as const).includes(row.changeType as GameDataChangeType)
            ? (row.changeType as GameDataChangeType)
            : "MODIFIED",
        fields: (row.fields ?? null) as Record<string, GameDataChangeField> | null,
        createdAt: row.createdAt.toISOString(),
    };
}

/** Compteurs par dataset (badge du Tableau) — une seule requête groupée. */
export async function getGameDataChangeCounts(): Promise<Record<string, number>> {
    try {
        const rows = await db.gameDataChangeLog.groupBy({ by: ["dataset"], _count: { _all: true } });
        return Object.fromEntries(rows.map((r) => [r.dataset, r._count._all]));
    } catch {
        return {};
    }
}
