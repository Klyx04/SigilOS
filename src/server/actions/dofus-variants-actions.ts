'use server';

import { db } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { auth } from '@/auth';
import { rateLimit } from '@/lib/ratelimit';
import { VARIANT_SLOTS, normalizeStatCode, getStatLabel } from '@/lib/dofus-variant-utils';
import { normalizeItemIconUrl } from '@/lib/market/item-image';
import { Prisma } from '@prisma/client';

export interface VariantItemSummary {
    id: string;
    ankamaId: number;
    name: string;
    level: number;
    typeName: string;
    itemSetName?: string | null;
    /** Panoplie (id DofusDB) — sert au calcul des panoplies **actives** (conditions `pk`). */
    itemSetId?: number | null;
    /** Arbre de conditions **structuré** (DofusDude) — affichage + blocage. */
    conditions?: unknown;
    /** Arme à deux mains : incompatible avec un bouclier. */
    twoHanded?: boolean;
    iconUrl: string | null;
    /** Description officielle de l'objet (texte DofusDB) — Prysmaradites, objets légendaires… */
    description?: string | null;
    /** Id du sort passif (ligne native `effectId 1175` : `diceNum`) — résolu par `resolveItemPassive`. */
    passiveSpellId?: number | null;
    stats: {
        code: string;
        label: string;
        value: number;
        min: number;
        max: number;
        isNegative?: boolean;
    }[];
}

export interface SearchVariantItemsParams {
    slot: string;
    query?: string;
    minLevel?: number;
    maxLevel?: number;
    statFilters?: string[];
    limit?: number;
}

export interface SearchVariantItemsResult {
    slot: string;
    slotName: string;
    items: VariantItemSummary[];
}

export type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

/**
 * Extrait les statistiques et effets d'un GameItem de la base.
 */
function extractStatsFromGameItem(item: {
    nativeEffects?: unknown;
    effects?: unknown;
}): VariantItemSummary['stats'] {
    const rawEffects: any[] =
        Array.isArray(item.nativeEffects) && item.nativeEffects.length > 0
            ? (item.nativeEffects as any[])
            : Array.isArray(item.effects)
              ? (item.effects as any[])
              : [];

    const statsMap: Record<string, {
        code: string;
        label: string;
        value: number;
        min: number;
        max: number;
        isNegative?: boolean;
    }> = {};

    for (const fx of rawEffects) {
        const from = fx.from ?? fx.min ?? fx.value ?? 0;
        const to = fx.to ?? fx.max ?? fx.value ?? from;
        const val = to !== undefined && from !== undefined ? Math.max(from, to) : (to ?? from ?? 0);

        const rawKey = fx.characteristic ?? fx.effectId ?? fx.label ?? fx.name;
        const code = normalizeStatCode(rawKey);
        if (!code || val === 0) continue;

        const label = fx.label || getStatLabel(code);
        const isNeg = fx.isNegative || val < 0;

        if (!statsMap[code]) {
            statsMap[code] = {
                code,
                label,
                value: isNeg ? -Math.abs(val) : Math.abs(val),
                min: Math.min(from, to),
                max: Math.max(from, to),
                isNegative: isNeg,
            };
        } else {
            // Cumul si plusieurs lignes pour le même code
            statsMap[code].value += isNeg ? -Math.abs(val) : Math.abs(val);
            statsMap[code].max += Math.max(from, to);
        }
    }

    return Object.values(statsMap);
}

/**
 * Id du **sort passif** porté par l'objet (capacité légendaire).
 *
 * Mesure du 23/10/2026 : les Dofus et objets légendaires portent une ligne native
 * `effectId 1175` dont `diceNum` = sort passif et `diceSide` = grade (Dofus Turquoise → 5952).
 * `nativeEffects` (version légère) **perd** cette ligne : on interroge donc `effects` d'abord.
 */
function extractPassiveSpellId(item: { nativeEffects?: unknown; effects?: unknown }): number | null {
    const sources: unknown[] = [item.effects, item.nativeEffects];
    for (const source of sources) {
        if (!Array.isArray(source)) continue;
        for (const fx of source as any[]) {
            if (Number(fx?.effectId) !== 1175) continue;
            const id = Number(fx?.diceNum ?? fx?.from ?? 0);
            if (Number.isFinite(id) && id > 0) return id;
        }
    }
    return null;
}

/**
 * 🔍 Recherche d'équipements pour remplacer un slot de build (Variante interactive).
 * 0 appel externe (100% BDD locale), ultra réactif, filtrable par nom, niveau et caractéristiques.
 */
export async function searchVariantItems(
    params: SearchVariantItemsParams
): Promise<ActionResponse<SearchVariantItemsResult>> {
    // 🔐 Auth + rate limit (fail-closed) : la bibliothèque d'objets n'est pas publique.
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return { success: false, error: 'Non autorisé' };
    const limited = await rateLimit(`variant-search:${userId}`, 60, 60_000);
    if (!limited.success) {
        return { success: false, error: 'Trop de recherches — réessaie dans une minute.' };
    }

    try {
        const { slot, query = '', minLevel = 1, maxLevel = 200, statFilters = [], limit = 48 } = params;

        const slotConfig = VARIANT_SLOTS[slot];
        if (!slotConfig) {
            return {
                success: false,
                error: `Slot d'équipement inconnu: ${slot}`,
            };
        }

        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const cleanQuery = query.trim();

        const typeConditions: Prisma.GameItemWhereInput[] = [];
        if (slotConfig.typeIds.length > 0) {
            typeConditions.push({ typeId: { in: slotConfig.typeIds } });
        }
        if (slotConfig.typeNames.length > 0) {
            typeConditions.push({ typeName: { in: slotConfig.typeNames } });
        }

        const where: Prisma.GameItemWhereInput = {
            isDeprecated: false,
            category: 'equipment',
            OR: typeConditions.length > 0 ? typeConditions : undefined,
            level: {
                gte: Math.max(1, minLevel),
                lte: Math.min(200, maxLevel),
            },
            ...(cleanQuery.length > 0
                ? {
                      name: {
                          contains: cleanQuery,
                          mode: 'insensitive',
                      },
                  }
                : {}),
        };

        // Si des filtres de stats sont demandés, on prend un échantillon plus large pour filtrer en mémoire
        const queryLimit = statFilters.length > 0 ? Math.min(safeLimit * 5, 250) : safeLimit;

        const dbItems = await db.gameItem.findMany({
            where,
            take: queryLimit,
            orderBy: [{ level: 'desc' }, { name: 'asc' }],
            select: {
                id: true,
                ankamaId: true,
                name: true,
                level: true,
                typeName: true,
                itemSetName: true,
                itemSetId: true,
                conditions: true,
                twoHanded: true,
                iconUrl: true,
                description: true,
                nativeEffects: true,
                effects: true,
            },
        });

        // Conversion et extraction des statistiques
        let summaries: VariantItemSummary[] = dbItems.map((item) => {
            const stats = extractStatsFromGameItem(item);
            return {
                id: item.id,
                ankamaId: item.ankamaId,
                name: item.name,
                level: item.level,
                typeName: item.typeName,
                itemSetName: item.itemSetName,
                itemSetId: item.itemSetId ?? null,
                conditions: item.conditions ?? null,
                twoHanded: item.twoHanded === true,
                iconUrl: normalizeItemIconUrl(item.iconUrl, item.ankamaId),
                description: item.description ?? null,
                passiveSpellId: extractPassiveSpellId(item),
                stats,
            };
        });

        // Filtrage en mémoire sur les stats sélectionnées (ex: PA, PM, Force...)
        if (statFilters.length > 0) {
            summaries = summaries.filter((item) => {
                const itemStatCodes = new Set(item.stats.map((s) => s.code));
                // Doit posséder toutes les stats sélectionnées
                return statFilters.every((statCode) => itemStatCodes.has(statCode));
            });
        }

        const items = summaries.slice(0, safeLimit);

        return {
            success: true,
            data: {
                slot,
                slotName: slotConfig.slotName,
                items,
            },
        };
    } catch (err: any) {
        logger.error('[searchVariantItems] Error:', { error: err?.message, params });
        return {
            success: false,
            error: 'Erreur lors du chargement des variantes.',
        };
    }
}
