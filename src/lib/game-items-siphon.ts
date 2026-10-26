/**
 * 🎒 CŒUR du siphon « Items & ressources » (DofusDB `/items`).
 *
 * Descendu de `src/server/actions/game-item-actions.ts` (23/09/2026) pour être
 * exécutable **sans session Next** : la file BullMQ + le worker peuvent donc le lancer
 * ⇒ la passe complète (21 776 items, 436 lots de 50) **survit à la fermeture de l'onglet** et
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
import { Prisma } from '@prisma/client';
import { db } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { dofusDbFetch } from '@/lib/dofusdb-limiter';
import {
    DOFUSDB_THROTTLE_MAX_REPLAYS,
    LocalThrottleDeferredError,
    dofusDbFailureMessage,
    isLocalThrottle,
    isLocalThrottleDeferred,
    throttleWaitMs,
} from '@/lib/dofusdb-throttle';
import { siphonAndCompressImage } from '@/lib/dofus-asset-siphon';
import { GAME_ITEMS_BATCH_PAUSE_MS, GAME_ITEMS_BATCH_SIZE, GAME_ITEMS_INCREMENTAL_MAX_ITEMS } from '@/lib/game-items-cadence';
import { DOFUSDB_PAGE_MAX, hasMorePages } from '@/lib/dofusdb-pagination';
import { toNativeEffects } from '@/lib/market/effects';
import { resolveMarketItemFamily } from '@/lib/market/item-families';
import { diffFields, recordGameDataChanges, type GameDataChangeEntry } from '@/lib/game-data-changelog';

/**
 * 🔍 Champs d'item comparés par le **journal des changements** (`diffFields`) : répond à
 * « qu'est-ce qui a changé sur cette fiche ? » (nom, niveau, description, type, effets…).
 */
const ITEM_CHANGE_KEYS = [
    'name', 'level', 'description', 'typeId', 'typeName', 'category', 'hasRecipe', 'recipe',
    'realWeight', 'priceNpc', 'itemSetId', 'itemSetName', 'isLegendary', 'isSaleable',
    'superTypeId', 'superTypeName', 'effects', 'criterions', 'twoHanded',
] as const;

/** Recette normalisée telle que persistée en `GameItem.recipe` (forme consommée par le panneau encyclopédie). */
export interface SiphonedRecipe {
    job: unknown;
    resultLevel: number | null;
    ingredients: Array<{ id: number; name: { fr: string }; img?: string }>;
    quantities: number[];
}

/**
 * 🧪 Recette d'un item (DofusDB `/recipes/{id}`) → forme persistée, `null` si aucune.
 *
 * Sémantique d'échec (même que le batch) : un 404 / une réponse invalide / une panne
 * DofusDB rend `null` (l'item est persisté sans recette, reprise à la passe suivante) ;
 * seul le **limiteur local** saturé lève (`LocalThrottleDeferredError` : passe différée,
 * filigrane inchangé, BullMQ rejoue).
 */
export async function siphonGameItemRecipeCore(ankamaId: number): Promise<SiphonedRecipe | null> {
    if (!Number.isInteger(ankamaId) || ankamaId <= 0) return null;
    const res = await dofusDbFetch(`https://api.dofusdb.fr/recipes/${ankamaId}`, {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)',
        },
        signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
        if (isLocalThrottle(res)) throw new LocalThrottleDeferredError(throttleWaitMs(res));
        return null;
    }
    let raw: any = null;
    try {
        raw = await res.json();
    } catch {
        return null;
    }
    if (!raw || raw.error || !Array.isArray(raw.ingredients) || raw.ingredients.length === 0) return null;
    const ingredients = raw.ingredients
        .map((ing: any) => ({
            id: Number(ing?.id),
            name: { fr: typeof ing?.name?.fr === 'string' ? ing.name.fr : String(ing?.name ?? 'Ingrédient') },
            ...(typeof ing?.img === 'string' && ing.img ? { img: ing.img } : {}),
        }))
        .filter((ing: { id: number }) => Number.isInteger(ing.id) && ing.id > 0);
    if (ingredients.length === 0) return null;
    const quantities: number[] = Array.isArray(raw.quantities)
        ? raw.quantities.map((q: unknown) => Number(q) || 1)
        : ingredients.map(() => 1);
    return {
        job: raw.job ?? null,
        resultLevel:
            raw.resultLevel != null
                ? Number(raw.resultLevel)
                : raw.result?.level != null
                ? Number(raw.result.level)
                : null,
        ingredients,
        quantities,
    };
}

// La cadence vit dans `@/lib/game-items-cadence` (module PUR, client-safe) : ce cœur
// importe `sharp`/`fs` via `dofus-asset-siphon` et ne doit donc jamais être tiré par un
// composant client. Réexport pour que les appelants serveur gardent la même porte.
export { GAME_ITEMS_BATCH_PAUSE_MS, GAME_ITEMS_BATCH_SIZE };

/** Attente entre deux rejeux (le `setTimeout` du module, isolé pour rester testable). */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    /** R-1 : recettes détaillées persistées par la phase dédiée (0 si non jouée). */
    recipesFilled?: number;
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
    const safeLimit = Math.min(Math.max(limit, 10), DOFUSDB_PAGE_MAX);
    const baseUrl = `https://api.dofusdb.fr/items?$limit=${safeLimit}&$skip=${skip}`;
    // Veille ciblée (mesurée le 23/09/2026) : `updatedAt[$gt]=<date>` est un filtre RÉEL
    // côté DofusDB (futur ⇒ 0 résultat) ⇒ une passe incrémentale ramène les quelques items
    // touchés au lieu des 21 776. `$sort`/`$order`/`$select` sont refusés (HTTP 400) : on
    // ne peut pas trier ni projeter, seulement filtrer.
    const url = since ? `${baseUrl}&updatedAt[$gt]=${encodeURIComponent(since)}` : baseUrl;

    // 🚦 Budget partagé : une 429 **locale** (notre limiteur) n'est pas une panne de DofusDB.
    // On attend le reste de fenêtre (`retry-after` posé par le limiteur) et on rejoue, au lieu
    // d'échouer le lot en annonçant « DofusDB a renvoyé HTTP 429 » (message mensonger mesuré le
    // 28/09/2026 : *Items & ressources* en échec alors que le budget était le nôtre).
    const fetchPage = () =>
        dofusDbFetch(url, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'SigilOS/1.0 (+https://sigilos.fr)',
            },
            // Init NEUF à chaque rejeu : un `AbortSignal.timeout` déjà consommé lèverait aussitôt.
            signal: AbortSignal.timeout(15_000),
        });

    let res = await fetchPage();
    for (
        let replay = 0;
        replay < DOFUSDB_THROTTLE_MAX_REPLAYS && !res.ok && isLocalThrottle(res);
        replay++
    ) {
        await sleep(throttleWaitMs(res));
        res = await fetchPage();
    }

    if (!res.ok) {
        // 🔶 Budget local épuisé malgré les rejeux ⇒ DIFFÉRÉ (reprise au prochain
        // passage, filigrane inchangé), jamais une erreur de passe — même sémantique
        // que `throttledPages` des référentiels. Seule une vraie panne DofusDB lève.
        if (isLocalThrottle(res)) throw new LocalThrottleDeferredError(throttleWaitMs(res));
        throw new Error(dofusDbFailureMessage(res.status, false));
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
    // 🔍 Journal : une entrée par fiche créée/modifiée, écrite en **un seul** `createMany` par lot.
    const changes: GameDataChangeEntry[] = [];

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
        // Légalité des variantes (25/10/2026) : conditions d'objet (DSL DofusDB) + arme à deux
        // mains. L'arbre **structuré** (`conditions`) vient d'un second siphon
        // (`scripts/siphon-item-conditions.mjs`, source DofusDude).
        const criterions =
            typeof raw.criterions === 'string' && raw.criterions.trim().length > 0
                ? raw.criterions.trim().slice(0, 500)
                : null;
        const twoHanded = raw.twoHanded === true;
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


        const existing = await db.gameItem.findUnique({
            where: { ankamaId },
            select: {
                id: true,
                dataHash: true,
                // 🔍 Champs comparés pour le journal des changements (« avant → après »).
                name: true, level: true, description: true, typeId: true, typeName: true,
                category: true, hasRecipe: true, recipe: true, realWeight: true, priceNpc: true,
                itemSetId: true, itemSetName: true, isLegendary: true, isSaleable: true,
                superTypeId: true, superTypeName: true, effects: true,
            },
        });

        const localIconUrl = `/uploads/assets-dofus/items/${ankamaId}.webp`;

        // ── R-1 (16/10/2026) — la recette détaillée est persistée par
        // `fillMissingItemRecipesCore` (phase dédiée de la passe complète) et par le
        // siphon à-la-demande, JAMAIS ici : ce lot reste à UNE requête (la page).
        // Mesuré le 16/10 : ~50 fetches recettes par lot vidaient le budget partagé
        // (30 req/min) avant la page suivante ⇒ passe calée à 300 items puis Échec.
        // Ici on CONSERVE la recette déjà stockée (hash stable, pas de réécriture).
        const existingRecipe = (existing as { recipe?: unknown } | null)?.recipe;
        const recipe = (existingRecipe as SiphonedRecipe | null) ?? null;

        // Source distante de l'image (elle décide aussi du WebP local). Sortie du bloc
        // `create` pour entrer dans le hash : une icône changée est une modification réelle.
        const imageSrc = raw.imgset?.[0]?.sd || raw.imgset?.[0]?.icon || raw.img || null;

        // Calcul du Hash MD5 pour détecter les modifications réelles
        // (inclut les champs S2 : les items existants se COMPLÈTENT au prochain passage ;
        // R-1 : la recette aussi — la 1ʳᵉ passe suivant ce changement réécrit le
        // catalogue **une fois** pour la persister, sans retélécharger les WebP
        // (l'image n'est siphonnée qu'à la création — le dataset ASSETS_WEBP s'en charge).
        //
        // ⚠️ Mesure du 23/09/2026 : `description`, `typeId` et l'image étaient **stockés
        // mais absents du hash** ⇒ un item dont seuls la description ou le visuel changeaient
        // n'était JAMAIS réécrit. Ils y sont désormais : la détection couvre tout ce qu'on
        // persiste.
        const hashPayload = JSON.stringify({
            name, level, description, typeId, imageSrc, typeName, effects, hasRecipe, recipe,
            realWeight, priceNpc, itemSetId, itemSetName,
            isLegendary, isSaleable, superTypeId, superTypeName, nativeEffects,
            criterions, twoHanded,
        });
        const dataHash = crypto.createHash('md5').update(hashPayload).digest('hex');

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
            criterions,
            twoHanded,
            nativeEffects: (nativeEffects ?? undefined) as any,
            recipe: (recipe ?? undefined) as any,
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
            changes.push({ entityType: 'item', entityId: String(ankamaId), entityName: name, changeType: 'NEW' });

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
            // Correctif long terme 10/10/2026 — un item MODIFIÉ (nom, stats, **icône** :
            // `imageSrc` entre dans le hash) re-siphonne son image comme à la création.
            // Sans cela, un changement d'icône DofusDB mettait la DB à jour mais laissait le
            // WebP périmé (et, l'URL n'étant pas versionnée avant ce lot, invisible à jamais).
            // Fire-and-forget, comme en création : jamais bloquant. Le `?v=updatedAt` exposé
            // par la recherche propage ensuite le changement (navigateurs + Discord, finis les
            // purges manuelles).
            siphonAndCompressImage(imageSrc, 'items', ankamaId).catch(() => {});
            // 🔍 Détail du changement : « nom : avant → après », « level : … », etc.
            const changedFields = diffFields(existing, {
                name, level, description, typeId, typeName, category, hasRecipe, recipe,
                realWeight, priceNpc, itemSetId, itemSetName, isLegendary, isSaleable,
                superTypeId, superTypeName, effects,
            }, ITEM_CHANGE_KEYS);
            changes.push({
                entityType: 'item',
                entityId: String(ankamaId),
                entityName: name,
                changeType: 'MODIFIED',
                fields: changedFields,
            });
        }
    }

    // 🔍 Journal des changements (borné : 500 entrées / dataset, purge à l'écriture) —
    // non bloquant : une panne du journal ne casse jamais le siphon.
    await recordGameDataChanges('ITEMS', changes);

    const nextSkip = skip + rawItems.length;
    // ⚠️ Fin de pagination = plus rien lu OU tout le `total` distant couvert. **Jamais**
    // « la page est plus courte que demandé » : l'API plafonne à 50 par page (mesuré le
    // 24/09/2026), donc une page de 50 avec `$limit=100` est NORMALE — c'est ce qui faisait
    // s'arrêter la passe complète après 50 items.
    const hasMore = hasMorePages(skip, rawItems.length, totalInDofusDB);

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

    // ── R-1 (16/10/2026) — phase recettes manquantes : remplit `GameItem.recipe`
    // (jamais écrit avant) en attendant les fins de fenêtre au lieu d'abandonner.
    // Mesuré le 16/10 : les fetches inline vidaient le budget (30 req/min partagées)
    // avant la page suivante ⇒ passe calée à 300 items puis Échec. Ici 1 item = 1
    // requête, pause sur limiteur, reprise au même point : la passe va au bout.
    const recipes = await fillMissingItemRecipesCore();

    logger.info(
        `[game-items-siphon] ${inserted} créé(s) · ${updated} mis à jour · ${processed} item(s) analysé(s) en ${batches} lot(s) · ${recipes.filled} recette(s) persistée(s)`,
    );
    return { inserted, updated, processed, batches, recipesFilled: recipes.filled };
}

/**
 * R-1 — remplit les recettes manquantes (`hasRecipe: true` mais `recipe` NULL).
 *
 * Rythme tenable : 1 item = 1 requête ; sur refus du limiteur local on ATTEND la
 * fin de fenêtre (`retryAfterMs` porté par l'erreur) puis on rejoue le MÊME item —
 * jamais d'abandon, jamais de lot perdu. Un 404 / une panne DofusDB sur un item
 * est sauté (warn, retenté à la passe suivante) : un item ne bloque jamais la file.
 * Sortie : file vide, ou tour complet sans aucun progrès (que des 404).
 */
export interface MissingRecipesResult {
    filled: number;
    remaining: number;
    waitedMs: number;
}

export async function fillMissingItemRecipesCore(opts: { take?: number } = {}): Promise<MissingRecipesResult> {
    const take = Math.min(Math.max(opts.take ?? 25, 1), 100);
    // `recipe: null` direct est refusé par le typage (`JsonNullableFilter`) :
    // `DbNull` = colonne SQL NULL (jamais siphonnée), distinct de `JsonNull`.
    const where = { hasRecipe: true, recipe: { equals: Prisma.DbNull }, isDeprecated: false };
    let filled = 0;
    let waitedMs = 0;

    for (;;) {
        const missing = await db.gameItem.findMany({
            where,
            select: { ankamaId: true },
            orderBy: { ankamaId: "asc" },
            take,
        });
        if (missing.length === 0) return { filled, remaining: 0, waitedMs };

        let filledRound = 0;
        let waitedRound = 0;
        for (const m of missing) {
            let recipe: SiphonedRecipe | null = null;
            try {
                recipe = await siphonGameItemRecipeCore(m.ankamaId);
            } catch (err) {
                if (isLocalThrottleDeferred(err)) {
                    const waitMs = (err as LocalThrottleDeferredError).retryAfterMs;
                    await sleep(waitMs);
                    waitedMs += waitMs;
                    waitedRound += waitMs;
                    try {
                        recipe = await siphonGameItemRecipeCore(m.ankamaId);
                    } catch (retryErr) {
                        if (isLocalThrottleDeferred(retryErr)) {
                            // Toujours saturé après l'attente : on s'arrête proprement,
                            // reprise à la passe suivante (aucune perte, tout est rejouable).
                            const remaining = await db.gameItem.count({ where });
                            return { filled, remaining, waitedMs };
                        }
                        logger.warn("[fillMissingItemRecipesCore] Recette indisponible, item sauté", {
                            ankamaId: m.ankamaId,
                        });
                        continue;
                    }
                } else {
                    logger.warn("[fillMissingItemRecipesCore] Recette indisponible, item sauté", {
                        ankamaId: m.ankamaId,
                    });
                    continue;
                }
            }
            if (!recipe) continue;
            await db.gameItem.update({
                where: { ankamaId: m.ankamaId },
                data: { recipe: recipe as any },
            });
            filled++;
            filledRound++;
        }

        if (filledRound === 0 && waitedRound === 0) {
            // Que des 404/pannes : les mêmes reviendraient en boucle — reprise passe suivante.
            const remaining = await db.gameItem.count({ where });
            return { filled, remaining, waitedMs };
        }
    }
}

export interface GameItemsIncrementalResult extends GameItemsSiphonTotals {
    /** `true` = plafond atteint : la passe **doit reprendre** au même `skip` (aucune perte). */
    truncated: boolean;
    /**
     * 🔶 `true` = arrêt **propre** sur notre limite locale (budget partagé épuisé) : rien
     * n'est en panne, la page est mise en attente et la passe suivante reprend au même
     * `skip`, filigrane inchangé. L'appelant termine en `ok` avec la mention explicite.
     */
    deferred: boolean;
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
    let deferred = false;
    let hasMore = true;

    while (hasMore) {
        if (processed >= maxItems) {
            truncated = true;
            break;
        }
        let batch: GameItemsBatchResult;
        try {
            batch = await siphonGameItemsBatchCore(skip, GAME_ITEMS_BATCH_SIZE, since);
        } catch (error) {
            // 🔶 Notre budget est épuisé (passes concurrentes, 30 req/60 s partagées) :
            // on s'arrête PROPREMENT — le filigrane n'avance pas, la reprise se fera au
            // même `skip`. Toute autre erreur (DofusDB, DB) remonte et met la passe en échec.
            if (!isLocalThrottleDeferred(error)) throw error;
            deferred = true;
            hasMore = false;
            break;
        }
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
        `${inserted} créé(s) · ${updated} mis à jour · ${processed} analysé(s)${truncated ? " (plafond atteint, reprise au lot suivant)" : ""}${deferred ? " (limite locale, page mise en attente)" : ""}`,
    );
    return { inserted, updated, processed, batches, truncated, deferred, nextWatermark, nextSkip: skip };
}

