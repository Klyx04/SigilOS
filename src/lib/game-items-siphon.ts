/**
 * 🎒 CŒUR du siphon « Items & ressources » (DofusDB `/items`).
 *
 * Descendu de `src/server/actions/game-item-actions.ts` (23/09/2026) pour être
 * exécutable **sans session Next** : la file BullMQ + le worker peuvent donc le lancer
 * ⇒ la passe complète (21 776 items, 218 lots) **survit à la fermeture de l'onglet** et
 * BullMQ rejoue en cas d'échec réseau, au lieu de repartir de zéro dans le navigateur.
 *
 * Invariants (repris **à l'identique** de l'action historique) :
 *   · **upsert par `ankamaId`** (jamais de doublon) ;
 *   · **hash MD5** du payload : un item existant n'est réécrit que si quelque chose a bougé ;
 *   · **image WebP fire-and-forget** (`siphonAndCompressImage`) : jamais bloquante ;
 *   · `category` **dérivée de la famille** (`typeId` / `superTypeId` / `typeName`), jamais
 *     du seul libellé de type (constat beta du 13/09 : « Bois », « Minerai », « Clef »
 *     étaient classés `equipment` ⇒ la recherche « Ressources » ne renvoyait rien).
 */

import crypto from 'crypto';
import { db } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { dofusDbFetch } from '@/lib/dofusdb-limiter';
import { siphonAndCompressImage } from '@/lib/dofus-asset-siphon';
import { GAME_ITEMS_BATCH_PAUSE_MS, GAME_ITEMS_BATCH_SIZE, GAME_ITEMS_INCREMENTAL_MAX_ITEMS } from '@/lib/game-items-cadence';
import { toNativeEffects } from '@/lib/market/effects';
import { resolveMarketItemFamily } from '@/lib/market/item-families';

// La cadence vit dans `@/lib/game-items-cadence` (module PUR, client-safe) : ce cœur
// importe `sharp`/`fs` via `dofus-asset-siphon` et ne doit donc jamais être tiré par un
// composant client. Réexport pour que les appelants serveur gardent la même porte.
export { GAME_ITEMS_BATCH_PAUSE_MS, GAME_ITEMS_BATCH_SIZE };

export interface GameItemsBatchResult {
    inserted: number;
    updated: number;
    totalProcessed: number;
    hasMore: boolean;
    nextSkip: number;
    /** Total exposé par DofusDB (source de vérité de la progression, ~21 776 items). */
    total: number;
    /**
     * `updatedAt` distant le plus récent vu dans ce lot (ISO), `null` si l'API n'en
     * expose pas. Sert de **filigrane** à la passe incrémentale (`updatedAt[$gt]`).
     */
    maxUpdatedAt: string | null;
}

export interface GameItemsSiphonProgress {
    done: number;
    total: number | null;
    inserted: number;
    updated: number;
    batches: number;
}

export interface GameItemsSiphonTotals {
    inserted: number;
    updated: number;
    /** Items réellement renvoyés par DofusDB (tous lots confondus). */
    processed: number;
    batches: number;
}

/**
 * Un lot d'items DofusDB → `GameItem` (détection différentielle par hash MD5).
 *
 * ⚠️ L'échec HTTP **lève** (l'enveloppe serveur le traduit en `ActionResponse`, le worker
 * laisse BullMQ rejouer) : un cœur `src/lib` n'a pas de contrat d'action.
 */
export async function siphonGameItemsBatchCore(
    skip = 0,
    limit = GAME_ITEMS_BATCH_SIZE,
    since: string | null = null,
): Promise<GameItemsBatchResult> {
    const safeLimit = Math.min(Math.max(limit, 10), 100);
    const baseUrl = `https://api.dofusdb.fr/items?$limit=${safeLimit}&$skip=${skip}`;
    // Veille ciblée (mesurée le 23/09/2026) : `updatedAt[$gt]=<date>` est un filtre RÉEL
    // côté DofusDB (futur ⇒ 0 résultat) ⇒ une passe incrémentale ramène les quelques items
    // touchés au lieu des 21 776. `$sort`/`$order`/`$select` sont refusés (HTTP 400) : on
    // ne peut pas trier ni projeter, seulement filtrer.
    const url = since ? `${baseUrl}&updatedAt[$gt]=${encodeURIComponent(since)}` : baseUrl;

    const res = await dofusDbFetch(url, {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)',
        },
        signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
        throw new Error(`DofusDB a renvoyé HTTP ${res.status}`);
    }

    const json = await res.json();
    const rawItems: any[] = Array.isArray(json?.data) ? json.data : [];
    const totalInDofusDB = Number(json?.total ?? 0);

    if (rawItems.length === 0) {
        return {
            inserted: 0,
            updated: 0,
            totalProcessed: 0,
            hasMore: false,
            nextSkip: skip,
            total: totalInDofusDB,
            maxUpdatedAt: null,
        };
    }

    let inserted = 0;
    let updated = 0;
    let maxUpdatedAt: string | null = null;

    for (const raw of rawItems) {
        // Filigrane : horodatage distant le plus récent du lot (les ISO se comparent
        // lexicographiquement). Le cœur incrémental ne l'écrit **que** si la passe va
        // jusqu'au bout — sinon un lot tronqué ferait sauter des items.
        if (typeof raw.updatedAt === "string" && (maxUpdatedAt === null || raw.updatedAt > maxUpdatedAt)) {
            maxUpdatedAt = raw.updatedAt;
        }
        const ankamaId = Number(raw.id);
        if (!ankamaId || isNaN(ankamaId) || ankamaId <= 0) continue;

        const name = typeof raw.name?.fr === 'string' ? raw.name.fr : String(raw.name || 'Objet');
        const level = Number(raw.level || 1);
        const typeId =
            raw.typeId != null
                ? Number(raw.typeId)
                : raw.type?.id != null
                ? Number(raw.type.id)
                : null;
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
        // BUG-11 — DofusDB expose la famille dans `type.superTypeId` (et non
        // à la racine) : sans ce repli, `superTypeId` restait **NULL** en base
        // et la résolution de famille retombait sur le seul `typeName`.
        const superTypeId =
            raw.superTypeId != null
                ? Number(raw.superTypeId)
                : raw.type?.superTypeId != null
                ? Number(raw.type.superTypeId)
                : null;
        const superTypeName =
            typeof raw.superType?.name?.fr === 'string'
                ? raw.superType.name.fr
                : typeof raw.type?.superTypeName?.fr === 'string'
                ? raw.type.superTypeName.fr
                : null;
        // Version LÉGÈRE des effets natifs (plages min–max) : source serveur de l'éditeur FM
        // et de la carte d'item. `effects` (lourd, possibleEffects) est CONSERVÉ tel quel.
        const nativeEffects = toNativeEffects(raw);

        // Déterminer la catégorie principale.
        // ⚠️ Constat beta du 13/09 : l'ancien heuristique sur le libellé de
        // type classait « Bois », « Minerai », « Clef »… en `equipment` ⇒ la
        // recherche « Ressources » ne renvoyait rien. On dérive désormais la
        // catégorie de la **famille** (typeId / superTypeId / typeName), avec
        // le seau `consumables` conservé pour les consommables.
        const typeLower = typeName.toLowerCase();
        const isConsumable =
            typeLower.includes('consommable') ||
            typeLower.includes('potion') ||
            typeLower.includes('pain') ||
            typeLower.includes('viande') ||
            typeLower.includes('bière') ||
            typeLower.includes('boisson') ||
            typeLower.includes('friandise') ||
            typeLower.includes('nourriture');
        const family = resolveMarketItemFamily({ typeId, superTypeId, typeName });
        let category =
            family === 'EQUIPMENT'
                ? 'equipment'
                : family === 'COSMETIC'
                ? 'cosmetics'
                : isConsumable
                ? 'consumables'
                : 'resources';


        // Source distante de l'image (elle décide aussi du WebP local). Sortie du bloc
        // `create` pour entrer dans le hash : une icône changée est une modification réelle.
        const imageSrc = raw.imgset?.[0]?.sd || raw.imgset?.[0]?.icon || raw.img || null;

        // Calcul du Hash MD5 pour détecter les modifications réelles
        // (inclut les champs S2 : les items existants se COMPLÈTENT au prochain passage)
        //
        // ⚠️ Mesure du 23/09/2026 : `description`, `typeId` et l'image étaient **stockés
        // mais absents du hash** ⇒ un item dont seuls la description ou le visuel changeaient
        // n'était JAMAIS réécrit. Ils y sont désormais : la détection couvre tout ce qu'on
        // persiste. Conséquence assumée : la 1ʳᵉ passe suivant ce changement réécrit le
        // catalogue **une fois** (le hash change de définition) sans retélécharger les WebP
        // (l'image n'est siphonnée qu'à la création — le dataset ASSETS_WEBP s'en charge).
        const hashPayload = JSON.stringify({
            name, level, description, typeId, imageSrc, typeName, effects, hasRecipe,
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
            siphonAndCompressImage(imageSrc, 'items', ankamaId).catch(() => {});
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
        inserted,
        updated,
        totalProcessed: rawItems.length,
        hasMore,
        nextSkip,
        total: totalInDofusDB,
        maxUpdatedAt,
    };
}


/**
 * Passe COMPLÈTE du catalogue d'items (≈21 776 items ⇒ 218 lots de 100) — c'est cette
 * fonction que lance le worker d'arrière-plan : le travail survit à la fermeture de
 * l'onglet, `onProgress` alimente la progression **réelle** du tableau God
 * (`reportGameDataProgress`), et un échec réseau remonte à BullMQ (retry exponentiel).
 */
export async function siphonAllGameItemsCore(
    onProgress?: (patch: GameItemsSiphonProgress) => void | Promise<void>,
): Promise<GameItemsSiphonTotals> {
    let skip = 0;
    let hasMore = true;
    let inserted = 0;
    let updated = 0;
    let processed = 0;
    let batches = 0;
    let total: number | null = null;

    while (hasMore) {
        const batch = await siphonGameItemsBatchCore(skip, GAME_ITEMS_BATCH_SIZE);

        inserted += batch.inserted;
        updated += batch.updated;
        processed += batch.totalProcessed;
        skip = batch.nextSkip;
        hasMore = batch.hasMore;
        batches++;
        if (batch.total > 0) total = batch.total;

        await onProgress?.({ done: processed, total, inserted, updated, batches });

        if (!hasMore) break;
        await new Promise((resolve) => setTimeout(resolve, GAME_ITEMS_BATCH_PAUSE_MS));
    }

    logger.info(
        `[game-items-siphon] ${inserted} créé(s) · ${updated} mis à jour · ${processed} item(s) analysé(s) en ${batches} lot(s)`,
    );
    return { inserted, updated, processed, batches };
}

export interface GameItemsIncrementalResult extends GameItemsSiphonTotals {
    /** `true` = plafond atteint : la passe **doit reprendre** au même `skip` (aucune perte). */
    truncated: boolean;
    /** Nouveau filigrane à mémoriser (ISO) — `null` si DofusDB n'expose pas d'`updatedAt`. */
    nextWatermark: string | null;
    /** Reprise de pagination (le filtre est déterministe : le même `skip` reprend au même endroit). */
    nextSkip: number;
}

/**
 * 🔭 Passe **incrémentale** : ne demande à DofusDB que ce qui a bougé depuis le filigrane.
 *
 * Mesure du 23/09/2026 : `items?updatedAt[$gt]=<date>` est un filtre **réel** (une date
 * future renvoie 0) ⇒ sur 30 jours glissants, DofusDB ne renvoie que **46 items** au lieu
 * des 21 776 de la passe complète. `$sort`/`$order`/`$select` sont refusés (HTTP 400) :
 * l'ordre des pages est celui de l'API, d'où la reprise par `skip` en cas de plafond
 * (`truncated`) — on ne fait **jamais** avancer le filigrane sur une passe partielle, ce
 * qui sauterait silencieusement des items.
 *
 * `since = null` (aucun filigrane) ⇒ DofusDB renvoie tout le catalogue : c'est la passe
 * complète, elle doit être lancée par `siphonAllGameItemsCore` (le worker le fait).
 */
export async function siphonGameItemsIncrementalCore(
    startSkip: number,
    since: string | null,
    onProgress?: (patch: GameItemsSiphonProgress) => void | Promise<void>,
    maxItems = GAME_ITEMS_INCREMENTAL_MAX_ITEMS,
): Promise<GameItemsIncrementalResult> {
    let skip = Math.max(0, startSkip);
    let processed = 0;
    let inserted = 0;
    let updated = 0;
    let batches = 0;
    let total: number | null = null;
    let nextWatermark: string | null = null;
    let truncated = false;
    let hasMore = true;

    while (hasMore) {
        if (processed >= maxItems) {
            truncated = true;
            break;
        }
        const batch = await siphonGameItemsBatchCore(skip, GAME_ITEMS_BATCH_SIZE, since);
        if (batch.total > 0) total = batch.total;
        inserted += batch.inserted;
        updated += batch.updated;
        processed += batch.totalProcessed;
        batches++;
        skip = batch.nextSkip;
        if (batch.maxUpdatedAt && (nextWatermark === null || batch.maxUpdatedAt > nextWatermark)) {
            nextWatermark = batch.maxUpdatedAt;
        }
        hasMore = batch.hasMore && batch.totalProcessed > 0;
        // Plafond atteint à la fin d'un lot : on s'arrête **avant** la pause et on ne fait
        // pas avancer le filigrane (la reprise se fera au même `skip`).
        if (hasMore && processed >= maxItems) {
            truncated = true;
            hasMore = false;
        }

        await onProgress?.({ done: processed, total, inserted, updated, batches });

        if (hasMore) await new Promise((resolve) => setTimeout(resolve, GAME_ITEMS_BATCH_PAUSE_MS));
    }

    logger.info(
        `[game-items-siphon] veille ciblée${since ? ` depuis ${since}` : " (sans filigrane)"} : ` +
        `${inserted} créé(s) · ${updated} mis à jour · ${processed} analysé(s)${truncated ? " (plafond atteint, reprise au lot suivant)" : ""}`,
    );
    return { inserted, updated, processed, batches, truncated, nextWatermark, nextSkip: skip };
}

