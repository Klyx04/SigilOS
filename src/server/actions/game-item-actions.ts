'use server';

import { db } from '@/lib/prisma';
import { isSuperAdmin, canAccessBrick } from '@/server/actions/super-admin-actions';
import { logger } from '@/lib/logger';
import { siphonAndCompressImage } from '@/lib/dofus-asset-siphon';
import { dofusDbFetch } from '@/lib/dofusdb-limiter';
import { resolveNativeEffects, toNativeEffects, enrichNativeEffects, isPlaceholderStatLabel, type MarketNativeEffect } from '@/lib/market/effects';
import {
    loadMarketReferential,
    resetMarketReferentialCache,
    toMarketStatReferentialInput,
} from '@/lib/market/referential';
// Correction 13/09 — le référentiel de marché est mis en cache 5 min : le siphon
// God doit le purger pour que les libellés/signes fraîchement lus soient visibles.
import { FM_CHARACTERISTIC_KEYS } from '@/lib/market/fm-effects';
import { collectDofusDbPages } from '@/lib/market/referential-pagination';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

// ─── Garde d'autorisation SuperAdmin / PIM ───────────────────────────────────
async function canManageGameItems(): Promise<boolean> {
    if (await isSuperAdmin()) return true;
    return canAccessBrick('game-data');
}

export interface GameItemSearchResult {
    id: string;
    ankamaId: number;
    name: string;
    level: number;
    typeName: string;
    category: string;
    description: string | null;
    effects: any | null;
    recipe: any | null;
    hasRecipe: boolean;
    iconUrl: string | null;
    // ── S2 (chantier Marché) — métadonnées utiles à l'éditeur de jet FM ──────
    superTypeId?: number | null;
    superTypeName?: string | null;
    realWeight?: number | null;
    priceNpc?: number | null;
    itemSetId?: number | null;
    itemSetName?: string | null;
    isLegendary?: boolean;
    /** Plages natives (source serveur) — `[{ effectId, characteristic, from, to, … }]`. */
    nativeEffects?: unknown;
}

/**
 * 🔍 Recherche 100% Locale ultra-rapide (Local-First).
 * Utilisée par l'Encyclopédie, le module Services/Métiers et Prêts/Coffre.
 */
export async function searchLocalGameItems(
    query: string,
    category: 'all' | 'equipment' | 'resources' | 'consumables' | 'cosmetics' = 'all',
    limit = 20
): Promise<ActionResponse<GameItemSearchResult[]>> {
    try {
        const cleanQuery = (query || '').trim();
        if (cleanQuery.length < 2) {
            return { success: true, data: [] };
        }

        const safeLimit = Math.min(Math.max(limit, 1), 50);

        const where: any = {
            isDeprecated: false,
            name: {
                contains: cleanQuery,
                mode: 'insensitive',
            },
        };

        if (category !== 'all') {
            where.category = category;
        }

        // Correction 13/09 (2ᵉ passe) — le référentiel est chargé **ici** (cache
        // 5 min) pour que chaque item parte avec ses lignes déjà **résolues**
        // (libellé d'infobulle + drapeau de malus) : l'écran de déclaration ne
        // dépend plus d'un second aller-retour qui pouvait échouer en silence.
        const [items, referential] = await Promise.all([
            db.gameItem.findMany({
                where,
                take: safeLimit,
                orderBy: [{ level: 'desc' }, { name: 'asc' }],
                select: {
                    id: true,
                    ankamaId: true,
                    name: true,
                    level: true,
                    typeName: true,
                    category: true,
                    description: true,
                    effects: true,
                    recipe: true,
                    hasRecipe: true,
                    iconUrl: true,
                    superTypeId: true,
                    superTypeName: true,
                    realWeight: true,
                    priceNpc: true,
                    itemSetId: true,
                    itemSetName: true,
                    isLegendary: true,
                    nativeEffects: true,
                },
            }),
            loadMarketReferential(),
        ]);
        const statReferential = toMarketStatReferentialInput(referential);

        return {
            success: true,
            data: items.map((item) => ({
                ...item,
                nativeEffects: enrichNativeEffects(
                    resolveNativeEffects(item),
                    statReferential
                ),
            })),
        };
    } catch (error: any) {
        logger.error('[searchLocalGameItems] Error:', { error: error?.message, query });
        return { success: false, error: 'Erreur lors de la recherche', data: [] };
    }
}

/**
 * 📄 Récupère la fiche détaillée d'un item par son ankamaId en local
 */
export async function getLocalGameItemDetails(ankamaId: number): Promise<ActionResponse<GameItemSearchResult | null>> {
    try {
        if (!ankamaId || isNaN(ankamaId) || ankamaId <= 0) {
            return { success: false, error: 'ID invalide' };
        }

        const [item, referential] = await Promise.all([
            db.gameItem.findUnique({
                where: { ankamaId },
                select: {
                    id: true,
                    ankamaId: true,
                    name: true,
                    level: true,
                    typeName: true,
                    category: true,
                    description: true,
                    effects: true,
                    recipe: true,
                    hasRecipe: true,
                    iconUrl: true,
                    superTypeId: true,
                    superTypeName: true,
                    realWeight: true,
                    priceNpc: true,
                    itemSetId: true,
                    itemSetName: true,
                    isLegendary: true,
                    nativeEffects: true,
                },
            }),
            // Correction 13/09 (2ᵉ passe) — mêmes lignes résolues serveur que la
            // recherche locale (`searchLocalGameItems`) : une fiche ouverte en
            // édition affiche exactement le même libellé et le même signe.
            loadMarketReferential(),
        ]);

        return {
            success: true,
            data: item
                ? {
                      ...item,
                      nativeEffects: enrichNativeEffects(
                          resolveNativeEffects(item),
                          toMarketStatReferentialInput(referential)
                      ),
                  }
                : null,
        };
    } catch (error: any) {
        logger.error('[getLocalGameItemDetails] Error:', { error: error?.message, ankamaId });
        return { success: false, error: 'Erreur récupération item' };
    }
}

/**
 * 📊 Statistiques de la base d'items et du siphon WebP
 */
export async function getGameItemsStats(): Promise<
    ActionResponse<{
        totalItems: number;
        totalWithRecipe: number;
        totalWebpImages: number;
        byCategory: Record<string, number>;
        lastUpdated: string | null;
    }>
> {
    if (!(await canManageGameItems())) {
        return { success: false, error: 'Non autorisé' };
    }

    try {
        const [total, withRecipe, categoriesGroup, lastItem] = await Promise.all([
            db.gameItem.count({ where: { isDeprecated: false } }),
            db.gameItem.count({ where: { isDeprecated: false, hasRecipe: true } }),
            db.gameItem.groupBy({
                by: ['category'],
                _count: { id: true },
                where: { isDeprecated: false },
            }),
            db.gameItem.findFirst({
                orderBy: { updatedAt: 'desc' },
                select: { updatedAt: true },
            }),
        ]);

        const byCategory: Record<string, number> = {};
        for (const cat of categoriesGroup) {
            byCategory[cat.category] = cat._count.id;
        }

        // Vrai comptage FS (pas `total` : la jauge affichait 100 % en permanence
        // même quand le siphon d'images échouait en fire-and-forget).
        let realWebpCount = 0;
        try {
            const { getAssetStorageStats } = await import('@/lib/dofus-asset-siphon');
            realWebpCount = getAssetStorageStats().items.count;
        } catch {
            // Repli : à défaut de lecture disque, ne pas mentir avec `total`.
            realWebpCount = 0;
        }

        return {
            success: true,
            data: {
                totalItems: total,
                totalWithRecipe: withRecipe,
                totalWebpImages: realWebpCount,
                byCategory,
                lastUpdated: lastItem?.updatedAt ? lastItem.updatedAt.toISOString() : null,
            },
        };
    } catch (error: any) {
        logger.error('[getGameItemsStats] Error:', { error: error?.message });
        return { success: false, error: 'Erreur statistiques' };
    }
}

/**
 * 🩹 S2.12 — Backfill **idempotent** des plages natives (`nativeEffects`).
 *
 * Réparation **locale et instantanée** (aucun appel réseau) : recalcule
 * `nativeEffects` depuis `effects` (forme brute DofusDB, `diceNum`/`diceSide`)
 * pour les fiches siphonnées AVANT l'ajout de la colonne S2.2. C'est le remède
 * immédiat au message « aucun effet natif importé » de l'éditeur FM.
 * Le siphon DofusDB complet reste la source de vérité (il rafraîchit aussi les
 * nouvelles plages) ; cette action ne répare que ce qui est encore vide.
 */
export async function backfillNativeEffects(limit = 500): Promise<
    ActionResponse<{ scanned: number; repaired: number; remaining: number }>
> {
    if (!(await canManageGameItems())) {
        return { success: false, error: 'Non autorisé' };
    }

    const safeLimit = Math.min(Math.max(limit, 1), 2_000);
    const pendingWhere: Prisma.GameItemWhereInput = {
        OR: [
            { nativeEffects: { equals: Prisma.DbNull } },
            { nativeEffects: { equals: Prisma.JsonNull } },
        ],
        // ⚠️ Correctif S4.0e — ne balayer que les fiches ayant **réellement** des
        // effets. Sans ce filtre, `take` renvoyait d'abord des milliers de lignes
        // sans effet (ressources, runes, pains… stockées `effects = []`) : le lot
        // ressortait « 0 réparée » et la boucle du panneau God **s'arrêtait à la
        // 1ʳᵉ passe** (mesuré : **0 / 1000** réparable alors que **10 661** fiches
        // le sont). Le compteur `remaining` renvoie désormais le **reste à
        // rattraper**, pas les fiches définitivement sans effet.
        //
        // ⚠️ Forme `NOT: { effects: { equals: [] } }` OBLIGATOIRE : la forme
        // `effects: { not: { equals: [] } }` est **silencieusement ignorée** par
        // Prisma (vérifié : 19 952 lignes renvoyées au lieu de 10 661).
        NOT: { effects: { equals: [] } },
    };

    try {
        const pending = await db.gameItem.findMany({
            where: pendingWhere,
            select: { id: true, ankamaId: true, effects: true, nativeEffects: true },
            // Tri **déterministe** (sans lui, l'ordre physique décide du lot et
            // rendait la progression imprévisible d'une passe à l'autre).
            orderBy: { ankamaId: "asc" },
            take: safeLimit,
        });

        let repaired = 0;
        // Correction 13/09 (2ᵉ passe) — on persiste désormais les lignes
        // **résolues** (libellé d'infobulle + drapeau de malus du référentiel) :
        // une fiche réparée une fois n'a plus besoin du référentiel pour
        // s'afficher juste (« -30 Résistance Critiques » et non « +30 Effet »).
        const statReferential = toMarketStatReferentialInput(await loadMarketReferential());
        for (const row of pending) {
            const natives = resolveNativeEffects(row);
            const enriched = natives ? enrichNativeEffects(natives, statReferential) : null;
            if (!enriched) continue; // aucun effet exploitable → ligne laissée telle quelle
            await db.gameItem.update({
                where: { id: row.id },
                data: { nativeEffects: enriched as unknown as Prisma.InputJsonValue },
            });
            repaired++;
        }

        const remaining = await db.gameItem.count({ where: pendingWhere });
        logger.info('[backfillNativeEffects] terminé', {
            scanned: pending.length,
            repaired,
            remaining,
        });

        return { success: true, data: { scanned: pending.length, repaired, remaining } };
    } catch (error: any) {
        logger.error('[backfillNativeEffects] Error:', { error: error?.message });
        return { success: false, error: 'Backfill impossible' };
    }
}

/**
 * 🧹 S8.5 — **purge des gabarits `GameEffect.name`** (« Effet 63 », « }{ soins »).
 *
 * Contexte vérifié en base : **231** gabarits sur **871** effets, dont **47**
 * réellement référencés par des items. Le siphon `/effects` ramène le catalogue
 * des **effets de sorts** : beaucoup d'entrées n'ont pas de nom exploitable.
 *
 * Règles :
 * - **idempotent** : une ligne réparée ne redevient jamais un gabarit, donc elle
 *   n'est plus sélectionnée à la passe suivante ;
 * - **aucune suppression** : on ne fait que réécrire un libellé-gabarit ;
 * - **aucune invention** : la seule source fiable de réparation est la
 *   caractéristique jointe (`GameEffect.characteristic` → `GameCharacteristic.name`).
 *   Si elle est absente — cas actuel : `characteristic = 0` sur les 231 gabarits —
 *   la ligne est comptée en `unresolved` et **laissée telle quelle** ; les
 *   consommateurs l'ignorent déjà (`isPlaceholderStatLabel`) et retombent sur la
 *   table codée.
 */
export async function purgePlaceholderEffectLabels(): Promise<
    ActionResponse<{ scanned: number; repaired: number; unresolved: number }>
> {
    try {
        if (!(await canManageGameItems())) return { success: false, error: 'Non autorisé' };

        const placeholders = await db.gameEffect.findMany({
            where: {
                OR: [
                    { name: { startsWith: 'Effet ' } },
                    { name: { contains: '{' } },
                    { name: { contains: '}' } },
                ],
            },
            select: { id: true, name: true, characteristic: true },
            orderBy: { id: 'asc' },
        });

        const scanned = placeholders.length;
        if (scanned === 0) {
            return { success: true, data: { scanned: 0, repaired: 0, unresolved: 0 } };
        }

        // Seule source **fiable** : le libellé de la caractéristique jointe.
        const characteristics = await db.gameCharacteristic.findMany({
            select: { id: true, name: true },
        });
        const characteristicNames = new Map(characteristics.map((row) => [row.id, row.name]));

        let repaired = 0;
        let unresolved = 0;
        for (const effect of placeholders) {
            const candidate =
                effect.characteristic != null
                    ? characteristicNames.get(effect.characteristic)
                    : undefined;
            if (!candidate || isPlaceholderStatLabel(candidate)) {
                unresolved++;
                continue;
            }
            await db.gameEffect.update({ where: { id: effect.id }, data: { name: candidate } });
            repaired++;
        }

        logger.info('[purgePlaceholderEffectLabels] terminé', { scanned, repaired, unresolved });
        return { success: true, data: { scanned, repaired, unresolved } };
    } catch (error: any) {
        logger.error('[purgePlaceholderEffectLabels] Error:', { error: error?.message });
        return { success: false, error: 'Purge impossible' };
    }
}

/**
 * 🔄 Siphon par lot d'items depuis DofusDB avec détection différentielle (Hash)
 */
export async function siphonGameItemsBatch(skip = 0, limit = 50): Promise<
    ActionResponse<{
        inserted: number;
        updated: number;
        totalProcessed: number;
        hasMore: boolean;
        nextSkip: number;
    }>
> {
    if (!(await canManageGameItems())) {
        return { success: false, error: 'Non autorisé' };
    }

    try {
        const safeLimit = Math.min(Math.max(limit, 10), 100);
        const url = `https://api.dofusdb.fr/items?$limit=${safeLimit}&$skip=${skip}`;

        const res = await dofusDbFetch(url, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)',
            },
            signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) {
            return { success: false, error: `DofusDB a renvoyé HTTP ${res.status}` };
        }

        const json = await res.json();
        const rawItems: any[] = Array.isArray(json?.data) ? json.data : [];
        const totalInDofusDB = Number(json?.total ?? 0);

        if (rawItems.length === 0) {
            return {
                success: true,
                data: { inserted: 0, updated: 0, totalProcessed: 0, hasMore: false, nextSkip: skip },
            };
        }

        let inserted = 0;
        let updated = 0;

        for (const raw of rawItems) {
            const ankamaId = Number(raw.id);
            if (!ankamaId || isNaN(ankamaId) || ankamaId <= 0) continue;

            const name = typeof raw.name?.fr === 'string' ? raw.name.fr : String(raw.name || 'Objet');
            const level = Number(raw.level || 1);
            const typeId = raw.typeId ? Number(raw.typeId) : null;
            const typeName = typeof raw.type?.name?.fr === 'string' ? raw.type.name.fr : 'Équipement';
            const description = typeof raw.description?.fr === 'string' ? raw.description.fr : null;
            const effects = Array.isArray(raw.possibleEffects)
                ? raw.possibleEffects
                : Array.isArray(raw.effects)
                ? raw.effects
                : null;
            const hasRecipe = Boolean(raw.hasRecipe || raw.is_recipe_item);

            // ── S2 (chantier Marché) — champs DofusDB jusqu'ici non stockés (§6.11) ──
            const realWeight = raw.realWeight != null ? Number(raw.realWeight) : null;
            const priceNpc = raw.price != null ? Number(raw.price) : null;
            const itemSetId =
                raw.itemSetId != null
                    ? Number(raw.itemSetId)
                    : raw.itemSet?.id != null
                    ? Number(raw.itemSet.id)
                    : null;
            const itemSetName = typeof raw.itemSet?.name?.fr === 'string' ? raw.itemSet.name.fr : null;
            const isLegendary = Boolean(raw.isLegendary);
            const isSaleable = raw.isSaleable === undefined ? true : Boolean(raw.isSaleable);
            const superTypeId = raw.superTypeId != null ? Number(raw.superTypeId) : null;
            const superTypeName = typeof raw.superType?.name?.fr === 'string' ? raw.superType.name.fr : null;
            // Version LÉGÈRE des effets natifs (plages min–max) : source serveur de l'éditeur FM
            // et de la carte d'item. `effects` (lourd, possibleEffects) est CONSERVÉ tel quel.
            const nativeEffects = toNativeEffects(raw);

            // Déterminer la catégorie principale
            let category = 'equipment';
            const typeLower = typeName.toLowerCase();
            if (typeLower.includes('ressource') || typeLower.includes('matière') || typeLower.includes('alliage')) {
                category = 'resources';
            } else if (typeLower.includes('consommable') || typeLower.includes('potion') || typeLower.includes('pain') || typeLower.includes('viande')) {
                category = 'consumables';
            } else if (typeLower.includes('apparat') || typeLower.includes('cosmétique') || typeLower.includes('montilier') || typeLower.includes('costume')) {
                category = 'cosmetics';
            }

            // Calcul du Hash MD5 pour détecter les modifications réelles
            // (inclut les champs S2 : les items existants se COMPLÈTENT au prochain passage)
            const hashPayload = JSON.stringify({
                name, level, typeName, effects, hasRecipe,
                realWeight, priceNpc, itemSetId, itemSetName,
                isLegendary, isSaleable, superTypeId, superTypeName, nativeEffects,
            });
            const dataHash = crypto.createHash('md5').update(hashPayload).digest('hex');

            const existing = await db.gameItem.findUnique({
                where: { ankamaId },
                select: { id: true, dataHash: true },
            });

            const localIconUrl = `/uploads/assets-dofus/items/${ankamaId}.webp`;

            // Champs communs create/update (évite toute divergence entre les deux branches)
            const enrichi = {
                realWeight,
                priceNpc,
                itemSetId,
                itemSetName,
                isLegendary,
                isSaleable,
                superTypeId,
                superTypeName,
                nativeEffects: (nativeEffects ?? undefined) as any,
            };

            if (!existing) {
                await db.gameItem.create({
                    data: {
                        ankamaId,
                        name,
                        level,
                        typeId,
                        typeName,
                        category,
                        description,
                        effects: effects as any,
                        hasRecipe,
                        iconUrl: localIconUrl,
                        dataHash,
                        isDeprecated: false,
                        ...enrichi,
                    },
                });
                inserted++;

                // Siphon WebP de l'image en asynchrone non-bloquant
                const remoteImg = raw.imgset?.[0]?.sd || raw.imgset?.[0]?.icon || raw.img;
                siphonAndCompressImage(remoteImg, 'items', ankamaId).catch(() => {});
            } else if (existing.dataHash !== dataHash) {
                await db.gameItem.update({
                    where: { ankamaId },
                    data: {
                        name,
                        level,
                        typeId,
                        typeName,
                        category,
                        description,
                        effects: effects as any,
                        hasRecipe,
                        iconUrl: localIconUrl,
                        dataHash,
                        isDeprecated: false,
                        ...enrichi,
                    },
                });
                updated++;
            }
        }

        const nextSkip = skip + rawItems.length;
        const hasMore = nextSkip < totalInDofusDB && rawItems.length === safeLimit;

        return {
            success: true,
            data: {
                inserted,
                updated,
                totalProcessed: rawItems.length,
                hasMore,
                nextSkip,
            },
        };
    } catch (error: any) {
        logger.error('[siphonGameItemsBatch] Error:', { error: error?.message, skip, limit });
        return { success: false, error: `Erreur lors du siphon: ${error?.message}` };
    }
}

// ─── S2.5bis — Siphon des référentiels d'effets & de caractéristiques ───────
// Rend les libellés FR, les icônes et le « % » **data-driven** (remplace les
// maps codées en dur de `ItemSearchPanel`). Idempotent (upsert), jamais destructif.

/**
 * Récupère toutes les caractéristiques DofusDB (≈123) → GameCharacteristic.
 *
 * ⚠️ S4.0b — l'API **plafonne à 50 résultats par appel** quel que soit `$limit`
 * demandé : la pagination doit se caler sur la taille de page **réellement
 * retournée** (`json.limit`) : correctif **insuffisant**, l'API peut rendre
 * **moins** de lignes que `$limit` ⇒ la boucle coupait encore après la 1re page
 * (base constatée : **48** lignes pour **123** exposées).
 *
 * 🧪 S7.18 — la pagination est désormais déléguée à `collectDofusDbPages`, qui
 * se cale sur le **`total` exposé par l'API** (`skip < total`) au lieu de la
 * taille de la page reçue : c'est la seule source de vérité fiable.
 */
/** Init réseau **par page** (en-têtes + timeout neuf : un signal ne se partage pas). */
function dofusDbRefInit(): RequestInit {
    return {
        headers: { Accept: 'application/json', 'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)' },
        signal: AbortSignal.timeout(15_000),
    };
}

async function siphonAllCharacteristics(): Promise<{
    count: number;
    names: Map<number, string>;
    expected: number;
    received: number;
    truncated: boolean;
    failedPages: number[];
}> {
    const names = new Map<number, string>();
    const collected = await collectDofusDbPages<any>(
        (skip, limit) => `https://api.dofusdb.fr/characteristics?$limit=${limit}&$skip=${skip}`,
        { initFor: dofusDbRefInit }
    );
    let count = 0;
    for (const raw of collected.rows) {
        const id = Number(raw?.id);
        if (!Number.isInteger(id) || id <= 0) continue;
        const name = typeof raw?.name?.fr === 'string' ? raw.name.fr : String(raw?.name ?? `Caractéristique ${id}`);
        const keyword = typeof raw?.keyword === 'string' ? raw.keyword : null;
        const iconKey = typeof raw?.asset === 'string' ? raw.asset : null;
        await db.gameCharacteristic.upsert({
            where: { id },
            create: { id, name, keyword, iconKey },
            update: { name, keyword, iconKey },
        });
        names.set(id, name);
        count++;
    }
    return {
        count,
        names,
        expected: collected.expected,
        received: collected.rows.length,
        truncated: collected.truncated,
        failedPages: collected.failedPages,
    };
}

/**
 * Récupère tous les effets DofusDB (≈872) → GameEffect.
 * ⚠️ S4.0b — même plafond à 50/appel : la borne de pages couvre les ≈18 pages
 * nécessaires (l'ancienne borne de 10 tronquait le référentiel).
 * 🧪 S7.18 — pagination déléguée à `collectDofusDbPages` (pilotée par le `total`
 * de l'API) : la base était restée à **49** effets sur **872**.
 */
async function siphonAllEffects(
    charNames: Map<number, string>
): Promise<{ count: number; expected: number; received: number; truncated: boolean; failedPages: number[] }> {
    const collected = await collectDofusDbPages<any>(
        (skip, limit) => `https://api.dofusdb.fr/effects?$limit=${limit}&$skip=${skip}`,
        { initFor: dofusDbRefInit }
    );
    let count = 0;
    for (const raw of collected.rows) {
        const id = Number(raw?.id);
        if (!Number.isInteger(id) || id <= 0) continue;
        const characteristic = raw?.characteristic != null ? Number(raw.characteristic) : null;
        // Libellé : libellé de la caractéristique associée sinon description nettoyée.
        const fromChar = characteristic != null ? charNames.get(characteristic) : undefined;
        const rawDescription =
            typeof raw?.description?.fr === 'string'
                ? raw.description.fr
                : typeof raw?.theoreticalDescription?.fr === 'string'
                ? raw.theoreticalDescription.fr
                : null;
        const cleanDescription = rawDescription
            ? rawDescription.replace(/\{[^}]*\}/g, '').replace(/#\d+(~\d+)?/g, '').replace(/\s{2,}/g, ' ').trim()
            : null;
        const name = fromChar || cleanDescription || `Effet ${id}`;
        const isInPercent = Boolean(raw?.isInPercent);
        const category = raw?.category != null ? Number(raw.category) : null;
        const iconKey = raw?.iconId != null ? String(raw.iconId) : null;
        // Correction 13/09 — fidélité du SIGNE. DofusDB porte le sens de la
        // ligne dans deux champs : `characteristicOperator` (« + » / « - ») et
        // surtout le **gabarit de description**, qui préfixe le signe
        // (« -#1{{~1~2 à -}}#2 Esquive PA »). Les dés bruts d'un objet
        // (`possibleEffects`) étant toujours positifs, c'est le SEUL moyen de
        // restituer « -6 à -8 » au lieu de « +6 à +8 ».
        const characteristicOperator =
            typeof raw?.characteristicOperator === 'string' ? raw.characteristicOperator : null;
        const isNegativeValue = rawDescription ? rawDescription.trim().startsWith('-') : false;
        await db.gameEffect.upsert({
            where: { id },
            create: {
                id,
                name,
                characteristic,
                isInPercent,
                category,
                iconKey,
                characteristicOperator,
                isNegativeValue,
            },
            update: {
                name,
                characteristic,
                isInPercent,
                category,
                iconKey,
                characteristicOperator,
                isNegativeValue,
            },
        });
        count++;
    }
    return {
        count,
        expected: collected.expected,
        received: collected.rows.length,
        truncated: collected.truncated,
        failedPages: collected.failedPages,
    };
}

/**
 * 📚 S2.5bis — Siphonne `/effects` + `/characteristics` (≈20 requêtes, conforme
 * DofusDB). Réservé au God / PIM. Fail-soft : une page en échec n'invalide pas
 * les précédentes.
 *
 * 🧪 S4.0b / D39 — le mapping FM (`FM_CHARACTERISTIC_KEYS`) est **confronté** au
 * référentiel fraîchement siphonné : tout id du mapping absent de
 * `GameCharacteristic` (DofusDB a renommé/retiré la caractéristique) est
 * **signalé** au God sans jamais échouer (la résolution retombe sur le libellé).
 */
export async function siphonMarketReferentials(): Promise<
    ActionResponse<{
        characteristics: number;
        characteristicsStored: number;
        characteristicsTotal: number;
        effects: number;
        effectsStored: number;
        effectsTotal: number;
        truncated: boolean;
        orphanFmIds: number[];
    }>
> {
    if (!(await canManageGameItems())) {
        return { success: false, error: 'Non autorisé' };
    }
    try {
        // 🧪 S7.18 — pagination pilotée par le `total` de l'API (`collectDofusDbPages`) :
        // la base était restée à 48/123 caractéristiques et 49/872 effets, car
        // l'ancienne boucle s'arrêtait dès qu'une page revenait plus courte que `$limit`.
        const chars = await siphonAllCharacteristics();
        const effs = await siphonAllEffects(chars.names);
        // Correction 13/09 — purge le cache court du référentiel de marché : les
        // libellés exacts et les drapeaux de malus (`isNegativeValue`) sont
        // immédiatement visibles dans l'écran de déclaration.
        resetMarketReferentialCache();
        const names = chars.names;
        const truncated = chars.truncated || effs.truncated;
        const failedPages = [...chars.failedPages, ...effs.failedPages];
        const orphanFmIds = Object.keys(FM_CHARACTERISTIC_KEYS)
            .map(Number)
            .filter((id) => !names.has(id))
            .sort((a, b) => a - b);
        if (orphanFmIds.length > 0) {
            logger.warn('[siphonMarketReferentials] Mapping FM orphelin (id absent du référentiel):', {
                orphanFmIds,
            });
        }
        if (truncated) {
            logger.warn(
                `[siphonMarketReferentials] Référentiel INCOMPLET : ${chars.received}/${chars.expected} caractéristique(s), ${effs.received}/${effs.expected} effet(s) lus — page(s) en échec : ${failedPages.join(', ') || 'aucune'} (relancer le siphon).`
            );
        }
        logger.info(
            `[siphonMarketReferentials] ${chars.received}/${chars.expected} caractéristique(s) et ${effs.received}/${effs.expected} effet(s) lus ; ${chars.count + effs.count} ligne(s) en base ; ${orphanFmIds.length} orphelin(s) FM.`
        );
        return {
            success: true,
            data: {
                characteristics: chars.received,
                characteristicsStored: chars.count,
                characteristicsTotal: chars.expected,
                effects: effs.received,
                effectsStored: effs.count,
                effectsTotal: effs.expected,
                truncated,
                orphanFmIds,
            },
        };
    } catch (error: any) {
        logger.error('[siphonMarketReferentials] Error:', { error: error?.message });
        return { success: false, error: 'Siphon des référentiels impossible' };
    }
}

// ─── S2.6/S2.7 — Catalogue Marché : facettes + remplissage à la demande ──────

/**
 * 🗂️ S2.7 — Familles (`superTypeName`) et types (`typeName`) distincts du
 * catalogue, pour alimenter les filtres de recherche **sans liste codée en dur**.
 */
export async function getGameItemCatalogFacets(): Promise<
    ActionResponse<{ families: { id: number | null; name: string; count: number }[]; types: string[] }>
> {
    try {
        const [familiesGroup, typesRows] = await Promise.all([
            db.gameItem.groupBy({
                by: ['superTypeId', 'superTypeName'],
                where: { isDeprecated: false },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
                take: 60,
            }),
            db.gameItem.findMany({
                distinct: ['typeName'],
                where: { isDeprecated: false },
                select: { typeName: true },
                orderBy: { typeName: 'asc' },
                take: 200,
            }),
        ]);
        return {
            success: true,
            data: {
                families: familiesGroup
                    .filter((row) => !!row.superTypeName)
                    .map((row) => ({
                        id: row.superTypeId ?? null,
                        name: row.superTypeName as string,
                        count: row._count.id,
                    })),
                types: typesRows.map((row) => row.typeName),
            },
        };
    } catch (error: any) {
        logger.error('[getGameItemCatalogFacets] Error:', { error: error?.message });
        return { success: false, error: 'Facettes indisponibles' };
    }
}

/**
 * 🧩 S2.6 — Siphon **à la demande** d'un item unique (repli DofusDB quand le
 * catalogue local est incomplet). Additif : ne touche jamais les autres items.
 */
export async function siphonGameItemByAnkamaId(
    ankamaId: number
): Promise<ActionResponse<{ ankamaId: number }>> {
    if (!Number.isInteger(ankamaId) || ankamaId <= 0) {
        return { success: false, error: 'ID invalide' };
    }
    try {
        const res = await dofusDbFetch(`https://api.dofusdb.fr/items/${ankamaId}`, {
            headers: { Accept: 'application/json', 'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)' },
            signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return { success: false, error: 'Objet introuvable' };

        const raw: any = await res.json();
        if (!raw || !raw.id) return { success: false, error: 'Réponse invalide' };

        const name = typeof raw.name?.fr === 'string' ? raw.name.fr : String(raw.name || 'Objet');
        const typeName = typeof raw.type?.name?.fr === 'string' ? raw.type.name.fr : 'Équipement';
        const effects = Array.isArray(raw.possibleEffects)
            ? raw.possibleEffects
            : Array.isArray(raw.effects)
            ? raw.effects
            : null;
        const typeLower = typeName.toLowerCase();
        let category = 'equipment';
        if (typeLower.includes('ressource') || typeLower.includes('matière') || typeLower.includes('alliage')) category = 'resources';
        else if (typeLower.includes('consommable') || typeLower.includes('potion') || typeLower.includes('pain') || typeLower.includes('viande')) category = 'consumables';
        else if (typeLower.includes('apparat') || typeLower.includes('cosmétique') || typeLower.includes('montilier') || typeLower.includes('costume')) category = 'cosmetics';

        const data = {
            name,
            level: Number(raw.level || 1),
            typeId: raw.typeId ? Number(raw.typeId) : null,
            typeName,
            category,
            description: typeof raw.description?.fr === 'string' ? raw.description.fr : null,
            effects: effects as any,
            hasRecipe: Boolean(raw.hasRecipe || raw.is_recipe_item),
            iconUrl: `/uploads/assets-dofus/items/${ankamaId}.webp`,
            realWeight: raw.realWeight != null ? Number(raw.realWeight) : null,
            priceNpc: raw.price != null ? Number(raw.price) : null,
            itemSetId: raw.itemSetId != null ? Number(raw.itemSetId) : raw.itemSet?.id != null ? Number(raw.itemSet.id) : null,
            itemSetName: typeof raw.itemSet?.name?.fr === 'string' ? raw.itemSet.name.fr : null,
            isLegendary: Boolean(raw.isLegendary),
            isSaleable: raw.isSaleable === undefined ? true : Boolean(raw.isSaleable),
            superTypeId: raw.superTypeId != null ? Number(raw.superTypeId) : null,
            superTypeName: typeof raw.superType?.name?.fr === 'string' ? raw.superType.name.fr : null,
            nativeEffects: (toNativeEffects(raw) ?? undefined) as any,
            isDeprecated: false,
        };

        const dataHash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
        await db.gameItem.upsert({
            where: { ankamaId },
            create: { ankamaId, ...data, dataHash },
            update: { ...data, dataHash },
        });
        return { success: true, data: { ankamaId } };
    } catch (error: any) {
        logger.error('[siphonGameItemByAnkamaId] Error:', { error: error?.message, ankamaId });
        return { success: false, error: 'Siphon indisponible' };
    }
}

// ─── Phase 5.2 — Items disparus : flag isDeprecated, jamais supprimés ───────
// DofusDB retire parfois des items (renommages, nettoyages). Sans traitement,
// ils restent en BDD comme des fantômes à jour. On les flag dépréciés (exclus
// des recherches — cf. `isDeprecated: false` partout) et on ressuscite ceux
// qui réapparaissent. Suppression physique : JAMAIS (historique, drops liés).

async function fetchAllRemoteItemIds(): Promise<number[] | null> {
    const ids: number[] = [];
    const limit = 500;
    let skip = 0;
    for (let page = 0; page < 100; page++) {
        const res = await dofusDbFetch(`https://api.dofusdb.fr/items?$limit=${limit}&$skip=${skip}&$select[]=id`, {
            headers: { Accept: 'application/json', 'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)' },
            signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return null;
        const json = await res.json();
        const batch: unknown[] = Array.isArray(json?.data) ? json.data : [];
        for (const row of batch) {
            const id = Number((row as { id?: unknown })?.id);
            if (Number.isInteger(id) && id > 0) ids.push(id);
        }
        if (batch.length < limit) break;
        skip += limit;
    }
    return ids;
}

export interface VanishedPreview {
    vanished: { ankamaId: number; name: string }[];
    revivable: { ankamaId: number; name: string }[];
    localTotal: number;
    remoteTotal: number;
}

/** Dry-run : calcule quoi flagger/ressusciter, n'écrit RIEN. */
export async function previewVanishedGameItems(): Promise<ActionResponse<VanishedPreview>> {
    if (!(await canManageGameItems())) {
        return { success: false, error: 'Non autorisé' };
    }
    try {
        const remoteIds = await fetchAllRemoteItemIds();
        if (!remoteIds) return { success: false, error: 'DofusDB injoignable' };
        const { diffVanishedIds } = await import('@/lib/data-health');
        const remote = new Set(remoteIds);
        const [active, flagged] = await Promise.all([
            db.gameItem.findMany({ where: { isDeprecated: false }, select: { ankamaId: true, name: true } }),
            db.gameItem.findMany({ where: { isDeprecated: true }, select: { ankamaId: true, name: true } }),
        ]);
        const vanishedIds = new Set(diffVanishedIds(active.map((i) => i.ankamaId), remoteIds));
        return {
            success: true,
            data: {
                vanished: active.filter((i) => vanishedIds.has(i.ankamaId)),
                revivable: flagged.filter((i) => remote.has(i.ankamaId)),
                localTotal: active.length + flagged.length,
                remoteTotal: remote.size,
            },
        };
    } catch (error: any) {
        logger.error('[previewVanishedGameItems] Error:', { error: error?.message });
        return { success: false, error: 'Dry-run impossible' };
    }
}

/** Applique : flag les disparus + ressuscite les réapparus. Jamais de delete. */
export async function flagVanishedGameItems(): Promise<
    ActionResponse<{ deprecated: number; revived: number }>
> {
    if (!(await canManageGameItems())) {
        return { success: false, error: 'Non autorisé' };
    }
    try {
        const preview = await previewVanishedGameItems();
        if (!preview.success || !preview.data) {
            return { success: false, error: preview.error || 'Dry-run impossible' };
        }
        const toFlag = preview.data.vanished.map((i) => i.ankamaId);
        const toRevive = preview.data.revivable.map((i) => i.ankamaId);
        let deprecated = 0;
        let revived = 0;
        if (toFlag.length > 0) {
            const r = await db.gameItem.updateMany({
                where: { ankamaId: { in: toFlag }, isDeprecated: false },
                data: { isDeprecated: true },
            });
            deprecated = r.count ?? 0;
        }
        if (toRevive.length > 0) {
            const r = await db.gameItem.updateMany({
                where: { ankamaId: { in: toRevive }, isDeprecated: true },
                data: { isDeprecated: false },
            });
            revived = r.count ?? 0;
        }
        logger.info(`[flagVanishedGameItems] ${deprecated} déprécié(s), ${revived} ressuscité(s).`);
        return { success: true, data: { deprecated, revived } };
    } catch (error: any) {
        logger.error('[flagVanishedGameItems] Error:', { error: error?.message });
        return { success: false, error: 'Flag impossible' };
    }
}
