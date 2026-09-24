/**
 * 📚 CŒUR du siphon des référentiels de marché (DofusDB `/characteristics` + `/effects`).
 *
 * Descendu de `src/server/actions/game-item-actions.ts` (23/09/2026) pour être exécutable
 * **sans session Next** : la file BullMQ + le worker peuvent donc le lancer (le bouton du
 * Tableau « ▶ En arrière-plan » survivait sinon à rien).
 *
 * Invariants (repris **à l'identique**) :
 *   · pagination pilotée par le **`total` exposé par l'API** (`collectDofusDbPages`) —
 *     l'ancienne boucle s'arrêtait à la 1ʳᵉ page plus courte que `$limit` : la base était
 *     restée à **48/123** caractéristiques et **49/872** effets ;
 *   · **upsert idempotent** par id (jamais destructif) ;
 *   · **vidage du cache court** du référentiel à la fin (`resetMarketReferentialCache`),
 *     sinon les libellés/signes frais restent invisibles 5 min ;
 *   · mapping FM (`FM_CHARACTERISTIC_KEYS`) **confronté** au référentiel : un id absent est
 *     **signalé** (jamais bloquant — la résolution retombe sur le libellé).
 */

import { db } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { collectDofusDbPages } from '@/lib/market/referential-pagination';
import { resetMarketReferentialCache } from '@/lib/market/referential';
import { FM_CHARACTERISTIC_KEYS } from '@/lib/market/fm-effects';
import { diffFields, recordGameDataChanges, type GameDataChangeEntry } from '@/lib/game-data-changelog';

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
    changes: GameDataChangeEntry[];
}> {
    const names = new Map<number, string>();
    // 🔍 Journal : image **avant** (une seule lecture) — « libellé/signe/icône qui change ».
    const known = new Map(
        (await db.gameCharacteristic.findMany({ select: { id: true, name: true, keyword: true, iconKey: true } })).map(
            (c) => [c.id, c],
        ),
    );
    const changes: GameDataChangeEntry[] = [];
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
        const before = known.get(id);
        if (!before) {
            changes.push({
                entityType: 'characteristic',
                entityId: String(id),
                entityName: name,
                changeType: 'NEW',
            });
        } else {
            const fields = diffFields(before, { name, keyword, iconKey }, ['name', 'keyword', 'iconKey']);
            if (fields) {
                changes.push({
                    entityType: 'characteristic',
                    entityId: String(id),
                    entityName: name,
                    changeType: 'MODIFIED',
                    fields,
                });
            }
        }
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
        changes,
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
): Promise<{
    count: number;
    expected: number;
    received: number;
    truncated: boolean;
    failedPages: number[];
    changes: GameDataChangeEntry[];
}> {
    const collected = await collectDofusDbPages<any>(
        (skip, limit) => `https://api.dofusdb.fr/effects?$limit=${limit}&$skip=${skip}`,
        { initFor: dofusDbRefInit }
    );
    // 🔍 Journal : image **avant** (une seule lecture) — « libellé, signe, icône ou catégorie ».
    const known = new Map(
        (
            await db.gameEffect.findMany({
                select: { id: true, name: true, isNegativeValue: true, iconKey: true, category: true },
            })
        ).map((e) => [e.id, e]),
    );
    const changes: GameDataChangeEntry[] = [];
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
        // 🔍 Journal : un effet qui apparaît, ou dont le libellé/le signe/la catégorie change.
        const before = known.get(id);
        if (!before) {
            changes.push({ entityType: 'effect', entityId: String(id), entityName: name, changeType: 'NEW' });
        } else {
            const fields = diffFields(
                before,
                { name, isNegativeValue, iconKey, category },
                ['name', 'isNegativeValue', 'iconKey', 'category'],
            );
            if (fields) {
                changes.push({
                    entityType: 'effect',
                    entityId: String(id),
                    entityName: name,
                    changeType: 'MODIFIED',
                    fields,
                });
            }
        }
        count++;
    }
    return {
        count,
        expected: collected.expected,
        received: collected.rows.length,
        truncated: collected.truncated,
        failedPages: collected.failedPages,
        changes,
    };
}


export interface MarketReferentialsSyncResult {
    characteristics: number;
    characteristicsStored: number;
    characteristicsTotal: number;
    effects: number;
    effectsStored: number;
    effectsTotal: number;
    truncated: boolean;
    orphanFmIds: number[];
}

/**
 * Siphonne `/characteristics` puis `/effects` (≈20 requêtes, conforme DofusDB).
 * Fail-soft : une page en échec n'invalide pas les précédentes (`truncated` le dit).
 * Lève seulement si le siphon est impossible dans son ensemble (l'enveloppe serveur et
 * le worker traduisent ; BullMQ rejoue).
 */
export async function syncMarketReferentialsCore(): Promise<MarketReferentialsSyncResult> {
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
        logger.warn('[referential-siphon] Mapping FM orphelin (id absent du référentiel):', {
            orphanFmIds,
        });
    }
    if (truncated) {
        logger.warn(
            `[referential-siphon] Référentiel INCOMPLET : ${chars.received}/${chars.expected} caractéristique(s), ${effs.received}/${effs.expected} effet(s) lus — page(s) en échec : ${failedPages.join(', ') || 'aucune'} (relancer le siphon).`
        );
    }
    logger.info(
        `[referential-siphon] ${chars.received}/${chars.expected} caractéristique(s) et ${effs.received}/${effs.expected} effet(s) lus ; ${chars.count + effs.count} ligne(s) en base ; ${orphanFmIds.length} orphelin(s) FM.`
    );

    // 🔍 Journal des changements (borné : 500 entrées / dataset, purge à l'écriture) —
    // non bloquant : le référentiel est écrit même si le journal échoue.
    await recordGameDataChanges('REFERENTIALS', [...chars.changes, ...effs.changes]);

    return {
        characteristics: chars.received,
        characteristicsStored: chars.count,
        characteristicsTotal: chars.expected,
        effects: effs.received,
        effectsStored: effs.count,
        effectsTotal: effs.expected,
        truncated,
        orphanFmIds,
    };
}

