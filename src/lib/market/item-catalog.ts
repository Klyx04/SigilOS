/**
 * Module « Marché » — catalogue d'objets **local-first** (S2.6).
 *
 * ⚠️ Fichier **serveur uniquement**. La recherche frappe d'abord la table
 * `GameItem` (0 ms, zéro réseau) ; si le catalogue local ne renvoie rien pour
 * une recherche textuelle, on **complète à la demande** depuis DofusDB (via
 * `siphonGameItemByAnkamaId`) puis on relit en local — jamais de blocage.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import { siphonGameItemByAnkamaId } from "@/server/actions/game-item-actions";

export type ItemCatalogCategory = "all" | "equipment" | "resources" | "consumables" | "cosmetics";

export type ItemCatalogFilters = {
    query?: string;
    category?: ItemCatalogCategory;
    superTypeId?: number | null;
    typeName?: string | null;
    minLevel?: number | null;
    maxLevel?: number | null;
    page?: number;
    pageSize?: number;
};

export type ItemCatalogEntry = {
    ankamaId: number;
    name: string;
    level: number;
    typeName: string;
    category: string;
    description: string | null;
    iconUrl: string | null;
    superTypeId: number | null;
    superTypeName: string | null;
    itemSetId: number | null;
    itemSetName: string | null;
    realWeight: number | null;
    priceNpc: number | null;
    isLegendary: boolean;
    nativeEffects: unknown;
};

const CATALOG_SELECT = {
    ankamaId: true,
    name: true,
    level: true,
    typeName: true,
    category: true,
    description: true,
    iconUrl: true,
    superTypeId: true,
    superTypeName: true,
    itemSetId: true,
    itemSetName: true,
    realWeight: true,
    priceNpc: true,
    isLegendary: true,
    nativeEffects: true,
} satisfies Prisma.GameItemSelect;

const DOFUSDUDE_SEARCH_TYPES = ["equipment", "resources", "consumables", "cosmetics"] as const;

function buildWhere(filters: ItemCatalogFilters): Prisma.GameItemWhereInput {
    const where: Prisma.GameItemWhereInput = { isDeprecated: false };
    const query = filters.query?.trim();
    if (query && query.length >= 2) {
        where.name = { contains: query, mode: "insensitive" };
    }
    if (filters.category && filters.category !== "all") {
        where.category = filters.category;
    }
    if (filters.superTypeId != null) {
        where.superTypeId = filters.superTypeId;
    }
    if (filters.typeName) {
        where.typeName = filters.typeName;
    }
    if (filters.minLevel != null || filters.maxLevel != null) {
        where.level = {
            ...(filters.minLevel != null ? { gte: filters.minLevel } : {}),
            ...(filters.maxLevel != null ? { lte: filters.maxLevel } : {}),
        };
    }
    return where;
}

/** Récupère des ids d'items via Dofusdude (repli réseau, borné et best-effort). */
async function fetchRemoteItemIds(query: string, limit: number): Promise<number[]> {
    const results = await Promise.allSettled(
        DOFUSDUDE_SEARCH_TYPES.map((type) =>
            fetch(
                `https://api.dofusdu.de/dofus3/v1/fr/items/${type}/search?query=${encodeURIComponent(query)}&limit=${limit}`,
                { signal: AbortSignal.timeout(4000) }
            ).then((res) => (res.ok ? res.json() : []))
        )
    );
    const ids: number[] = [];
    for (const result of results) {
        if (result.status !== "fulfilled" || !Array.isArray(result.value)) continue;
        for (const row of result.value as Array<{ ankama_id?: unknown }>) {
            const id = Number(row?.ankama_id);
            if (Number.isInteger(id) && id > 0) ids.push(id);
        }
    }
    return [...new Set(ids)].slice(0, limit);
}

/**
 * Recherche local-first avec filtres (famille, type, niveau, nom).
 * `source = "dofusdb"` indique qu'un complément à la demande a été siphonné.
 */
export async function searchItems(
    filters: ItemCatalogFilters
): Promise<{ items: ItemCatalogEntry[]; total: number; source: "local" | "dofusdb" }> {
    const pageSize = Math.min(Math.max(filters.pageSize ?? 24, 1), 120);
    const page = Math.max(filters.page ?? 0, 0);
    const where = buildWhere(filters);

    try {
        let total = await db.gameItem.count({ where });
        let source: "local" | "dofusdb" = "local";

        // Repli : catalogue local vide pour une recherche textuelle → on complète.
        const query = filters.query?.trim() ?? "";
        if (total === 0 && query.length >= 2) {
            const remoteIds = await fetchRemoteItemIds(query, pageSize);
            if (remoteIds.length > 0) {
                await Promise.allSettled(remoteIds.map((id) => siphonGameItemByAnkamaId(id)));
                total = await db.gameItem.count({ where });
                source = "dofusdb";
            }
        }

        const items = await db.gameItem.findMany({
            where,
            select: CATALOG_SELECT,
            orderBy: [{ level: "desc" }, { name: "asc" }],
            skip: page * pageSize,
            take: pageSize,
        });

        return { items, total, source };
    } catch (error) {
        logger.error("[market] searchItems failed", {
            err: error instanceof Error ? error.message : String(error),
        });
        return { items: [], total: 0, source: "local" };
    }
}

/** Récupère les métadonnées + plages natives d'un item (source serveur, S2.8). */
export async function getItemCatalogEntry(ankamaId: number): Promise<ItemCatalogEntry | null> {
    if (!Number.isInteger(ankamaId) || ankamaId <= 0) return null;
    return db.gameItem.findUnique({ where: { ankamaId }, select: CATALOG_SELECT });
}
