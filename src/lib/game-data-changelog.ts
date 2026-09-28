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
 * l'action `getGameDataChangeLogAction` (`game-data-sync-actions.ts`), qui renvoie une
 * `GameDataChangeLogPage` (lignes + compteurs réels + bornes de rétention).
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
/** Éléments conservés d'un tableau (au-delà : marqueur « … N autre(s) »). */
export const GAME_DATA_CHANGELOG_MAX_LIST_ITEMS = 6;
/** Clés conservées d'un objet (au-delà : tronqué, jamais recopié). */
export const GAME_DATA_CHANGELOG_MAX_OBJECT_KEYS = 6;
/** Taille maximale d'une chaîne **imbriquée** dans une valeur (libellé, texte libre). */
export const GAME_DATA_CHANGELOG_ITEM_CHARS = 80;

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
 *
 * ✔️ 28/09/2026 (A3) — **la valeur reste structurée**. Avant : un tableau d'effets était
 * aplati en **chaîne** (`"[3 : {\"effectId\":90,…}, …]"`), résultat d'un `JSON.stringify` tronqué
 * ⇒ l'écran affichait des accolades à la place des stats (« Vitalité 1 à 15 »), et aucune
 * humanisation `effectId → libellé` n'était possible (l'id était noyé dans du texte).
 * Désormais : liste bornée d'éléments **scalaires ou maps de scalaires** (jamais d'imbrication,
 * jamais de JSON dans une chaîne) que `@/lib/game-data-change-format` humanise à l'affichage.
 *
 * Bornes (invariant : la valeur sérialisée reste ≤ `GAME_DATA_CHANGELOG_MAX_VALUE_CHARS`) :
 *   · tableau → `GAME_DATA_CHANGELOG_MAX_LIST_ITEMS` éléments + marqueur « … N autre(s) » ;
 *   · objet → `GAME_DATA_CHANGELOG_MAX_OBJECT_KEYS` clés scalaires ;
 *   · conteneur imbriqué (tableau/objet dans une liste) → décrit par sa taille (`[4 élément(s)]`)
 *     plutôt que recopié : on garde l'information utile sans le payload.
 */
export function summarizeValue(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") return clampJournalString(value, GAME_DATA_CHANGELOG_MAX_VALUE_CHARS);
    if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return summarizeList(value);
    if (typeof value === "object") return summarizeMap(value as Record<string, unknown>);
    return String(value);
}

/** Valeur **scalaire** d'une entrée de journal (jamais un conteneur). */
type JournalScalar = string | number | boolean;

function clampJournalString(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Décrit une valeur en **un scalaire lisible** : les conteneurs imbriqués sont résumés par leur
 * taille (`[4 élément(s)]`, `{7 clé(s)}`) — l'information « ce champ contient une liste de 4
 * éléments » est conservée, le payload non. `null` = champ absent (ignoré, pas écrit « null »).
 */
function describeJournalLeaf(value: unknown): JournalScalar | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return clampJournalString(value, GAME_DATA_CHANGELOG_ITEM_CHARS);
    if (Array.isArray(value)) return `[${value.length} élément(s)]`;
    if (typeof value === "object") return `{${Object.keys(value as object).length} clé(s)}`;
    return String(value);
}

/** Objet → map de scalaires bornée (on s'arrête **avant** de dépasser le budget de la valeur). */
function summarizeMap(source: Record<string, unknown>): Record<string, JournalScalar> {
    const out: Record<string, JournalScalar> = {};
    for (const [key, value] of Object.entries(source)) {
        if (Object.keys(out).length >= GAME_DATA_CHANGELOG_MAX_OBJECT_KEYS) break;
        const leaf = describeJournalLeaf(value);
        if (leaf === null) continue;
        if (JSON.stringify({ ...out, [key]: leaf }).length > GAME_DATA_CHANGELOG_MAX_VALUE_CHARS) break;
        out[key] = leaf;
    }
    return out;
}

/**
 * Tableau → liste bornée d'éléments lisibles. Un élément **objet** devient une map de scalaires
 * (c'est ce qui permet à l'écran de dire « Vitalité 1 à 15 » au lieu de `{"effectId":90,…}`).
 */
function summarizeList(source: unknown[]): (JournalScalar | Record<string, JournalScalar>)[] {
    const out: (JournalScalar | Record<string, JournalScalar>)[] = [];
    for (const item of source.slice(0, GAME_DATA_CHANGELOG_MAX_LIST_ITEMS)) {
        let entry: JournalScalar | Record<string, JournalScalar> | null;
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
            const map = summarizeMap(item as Record<string, unknown>);
            // Objet sans aucun scalaire (que des listes/objets) : on dit ce qu'il contient.
            entry = Object.keys(map).length > 0 ? map : describeJournalLeaf(item);
        } else {
            entry = describeJournalLeaf(item);
        }
        if (entry === null) continue;
        if (JSON.stringify([...out, entry]).length > GAME_DATA_CHANGELOG_MAX_VALUE_CHARS) break;
        out.push(entry);
    }
    if (out.length < source.length) out.push(`… ${source.length - out.length} autre(s)`);
    return out;
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

/** 📄 Taille de page par défaut de la modale : « les 300 derniers » (A3). */
export const GAME_DATA_CHANGELOG_PAGE_SIZE = 300;
/** Plafond d'une page : jamais plus que ce que la purge conserve par dataset. */
export const GAME_DATA_CHANGELOG_PAGE_MAX = GAME_DATA_CHANGELOG_KEEP_PER_DATASET;

/** Compteurs **réels** d'un dataset (toutes les lignes retenues, filtre ignoré). */
export interface GameDataChangeCounts {
    ALL: number;
    NEW: number;
    MODIFIED: number;
    REMOVED: number;
}

/**
 * Une page du journal : les lignes **du filtre courant** + les compteurs **réels** du dataset,
 * c'est-à-dire tout ce qu'il faut pour écrire « 300 derniers sur 471 ».
 */
export interface GameDataChangeLogPage {
    rows: GameDataChangeRow[];
    counts: GameDataChangeCounts;
    /** Lignes retenues par le filtre courant (`counts.ALL` si le filtre est `ALL`). */
    total: number;
    /** Lignes réellement renvoyées (≤ `limit` **et** ≤ `total`). */
    shown: number;
    limit: number;
    /** Maximum que la rétention peut conserver pour ce dataset. */
    max: number;
    retention: string;
}


/**
 * 📖 Journal d'un dataset — **page + compteurs réels** (A3, 28/09/2026).
 *
 * Avant : la modale recevait 100 lignes **sans savoir sur combien** (« 100 derniers » sur 500
 * possibles, filtres NEW/MODIFIED/REMOVED sans chiffres) ⇒ impossible de dire si la liste était
 * complète. Ici, on renvoie **les lignes du filtre** *et* les compteurs du dataset, donc l'écran
 * peut afficher « 300 derniers sur 500 » (et « 471 »).
 *
 * Les deux requêtes sont **bornées par `dataset`** : le `groupBy(changeType)` ne découpe que les
 * lignes que la purge conserve par dataset (≤ 500) — mesuré le 28/09/2026 en base locale :
 * 3 lignes de regroupement pour 171 entrées (42 ms à froid), `findMany(take=300)` : 17 ms.
 */
export async function readGameDataChangeLogPage(
    dataset: GameDataDataset,
    opts: { limit?: number; changeType?: GameDataChangeType | "ALL" } = {},
): Promise<GameDataChangeLogPage> {
    const changeType = opts.changeType ?? "ALL";
    // Entrée **bornée côté serveur** (l'action valide déjà l'enum ; la taille, c'est ici).
    const requested = typeof opts.limit === "number" && Number.isFinite(opts.limit)
        ? Math.trunc(opts.limit)
        : GAME_DATA_CHANGELOG_PAGE_SIZE;
    const limit = Math.min(Math.max(requested, 1), GAME_DATA_CHANGELOG_PAGE_MAX);
    const [grouped, rows] = await Promise.all([
        db.gameDataChangeLog.groupBy({ by: ["changeType"], where: { dataset }, _count: { _all: true } }),
        db.gameDataChangeLog.findMany({
            where: { dataset, ...(changeType !== "ALL" ? { changeType } : {}) },
            orderBy: { createdAt: "desc" },
            take: limit,
        }),
    ]);
    const counts: GameDataChangeCounts = { ALL: 0, NEW: 0, MODIFIED: 0, REMOVED: 0 };
    for (const group of grouped) {
        const count = group._count._all;
        counts.ALL += count;
        const type = group.changeType;
        if (type === "NEW" || type === "MODIFIED" || type === "REMOVED") counts[type] = count;
    }
    return {
        rows: rows.map(toGameDataChangeRow),
        counts,
        total: changeType === "ALL" ? counts.ALL : counts[changeType],
        shown: rows.length,
        limit,
        max: GAME_DATA_CHANGELOG_PAGE_MAX,
        retention: GAME_DATA_CHANGELOG_RETENTION_LABEL,
    };
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
