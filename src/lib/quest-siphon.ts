/**
 * 📜 CŒUR du diff/sync des quêtes DofusDB (`/quests`, `/quest-categories`).
 *
 * Descendu de `src/server/actions/game-quest-sync-actions.ts` (23/09/2026) : il était
 * **déjà** sans contrôle d'accès (le cron `data-watch` l'appelait tel quel) — il remonte
 * simplement au bon étage pour que la file/le worker puissent lancer le dataset QUESTS.
 *
 * Invariants (repris **à l'identique**) :
 *   · `computeQuestDeltasCore` est **lecture seule** : aucun write, aucune session ;
 *   · comparaison par `dofusDbId` **et** repli par nom normalisé (évite les faux « NEW ») ;
 *   · `syncQuestDeltasCore` travaille par lots de **15** en `Promise.all` : une quête en
 *     échec n'interrompt pas les autres (loggée, comptée à part) ;
 *   · un nom déjà pris par un **autre** `dofusDbId` reçoit le suffixe ` (#id)` — jamais de
 *     doublon de nom, et `name.startsWith(remoteName + " (#")` évite de le re-signaler
 *     comme « MODIFIED » au passage suivant ;
 *   · 🖼️ **visuel de quête** (27/09/2026) : `syncQuestDeltasCore` écrit la carte de départ dans
 *     `GameQuest.imageUrl`, et `backfillQuestVisualsCore` rattrape les quêtes qui n'en ont pas —
 *     par **lots de 50 ids en une requête** (`id[$in][]`), donc sans dépendre de la pagination du
 *     comparateur (qui s'arrête au quota de l'API).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { dofusDbFetch } from "@/lib/dofusdb-limiter";
import { DOFUSDB_PAGE_MAX } from "@/lib/dofusdb-pagination";
import { questMapImageUrl, questStartMapId } from "@/lib/dungeon-finder-utils";
import { diffFields, diffCollection, recordGameDataChanges, type GameDataChangeEntry } from "@/lib/game-data-changelog";
import {
    buildQuestContentDigest,
    questContentHash,
    readQuestContentDigest,
} from "@/lib/quest-content";

/**
 * 🔍 Champs de quête comparés par le journal des changements. On journalise ce qui est
 * **écrit** (nom, niveaux, catégorie) : la détection en amont ne compare que nom + niveaux,
 * donc la catégorie est un écart qu'aucun autre écran ne montrait.
 * (Le contenu de quête — étapes, récompenses — n'est pas stocké : voir ROADMAP.)
 */
const QUEST_CHANGE_KEYS = ["name", "levelMin", "levelMax", "category"] as const;

const DOFUSDB_API = "https://api.dofusdb.fr";

export type QuestDelta = {
    dofusDbId: number;
    name: string;
    levelMin: number | null;
    levelMax: number | null;
    categoryId: number;
    type: "NEW" | "MODIFIED";
    localName?: string;
};

export interface QuestDeltasResult {
    totalLocal: number;
    totalRemote: number;
    deltas: QuestDelta[];
    /**
     * 📜 Quêtes dont le **contenu n'est pas encore stocké** (`contentHash` nul — migration du
     * 24/09/2026) : rattrapage **borné** (`QUEST_CONTENT_BACKFILL_PER_PASS`) pour ne pas lancer
     * 1976 requêtes d'un coup (30 req/min ⇒ ≈ 66 min). Chaque passe en rattrape une tranche.
     */
    backfillIds: number[];
}

/** Nombre de contenus de quêtes rattrapés par passe (≈ 10 min à 30 req/min). */
export const QUEST_CONTENT_BACKFILL_PER_PASS = 300;

/** 🖼️ Visuel (carte de départ) à écrire pour une quête locale — chemin **interne** uniquement. */
export interface QuestVisualEntry {
    dofusDbId: number;
    imageUrl: string;
}

/**
 * Borne des visuels rattrapés par passe. Chaque lot de **50 ids = 1 seule requête** (mesuré le
 * 27/09/2026 : `?id[$in][]=568&id[$in][]=584&$select[]=id&$select[]=startPosition` → 3 quêtes en
 * une requête) ⇒ 1 200 visuels = **24 requêtes**, soit **sous le quota** de 30 req/min : une passe
 * n'attend jamais. Volontairement **séparé du comparateur** : la pagination de ce dernier s'arrête
 * au quota (mesuré : 1 290 des 1 976 quêtes lues) — un rattrapage adossé à elle n'aurait jamais vu
 * la fin du catalogue.
 */
export const QUEST_VISUAL_BACKFILL_PER_PASS = 1200;


/**
 * Diff **lecture seule** entre DofusDB et nos quêtes locales. Lève en cas d'échec réseau
 * ou BDD (les appelants traduisent : enveloppe gardée pour l'UI, BullMQ rejoue le job).
 */
export async function computeQuestDeltasCore(): Promise<QuestDeltasResult> {
    // 1. Fetch DofusDB total quests count to see if we need deep checking
    const countRes = await dofusDbFetch(`${DOFUSDB_API}/quests?$limit=1`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
    });
    const countJson = await countRes.json();
    const totalRemote = typeof countJson?.total === "number" ? countJson.total : 0;

    // 2. Load local quests that have a dofusDbId
    const localQuests = await db.gameQuest.findMany({
        where: { dofusDbId: { not: null } },
        select: { dofusDbId: true, name: true, levelMin: true, levelMax: true, dofusDbUpdatedAt: true }
    });

    const localMap = new Map<number, { dofusDbId: number | null; name: string; levelMin: number | null; levelMax: number | null; dofusDbUpdatedAt: Date | null }>();
    for (const q of localQuests) {
        if (q.dofusDbId !== null) {
            localMap.set(q.dofusDbId, q);
        }
    }

    // 📜 Rattrapage **borné** du contenu des quêtes déjà en base (migration du 24/09/2026) :
    // on ne peut pas montrer « ce qui a changé » dans une quête sans son résumé d'avant.
    // Fail-soft : une lecture en échec ne doit pas empêcher la détection des écarts.
    const backfill = await db.gameQuest
        .findMany({
            where: { contentHash: null, dofusDbId: { not: null } },
            select: { dofusDbId: true },
            orderBy: { dofusDbId: "asc" },
            take: QUEST_CONTENT_BACKFILL_PER_PASS,
        })
        .catch(() => [] as { dofusDbId: number | null }[]);

    // Also index by name to avoid false "NEW" if dofusDbId wasn't set on some local quests
    const allLocalQuests = await db.gameQuest.findMany({
        select: { id: true, dofusDbId: true, name: true, levelMin: true, levelMax: true, dofusDbUpdatedAt: true }
    });
    const localByNameMap = new Map<string, { id: string; dofusDbId: number | null; name: string; levelMin: number | null; levelMax: number | null; dofusDbUpdatedAt: Date | null }>();
    for (const q of allLocalQuests) {
        localByNameMap.set(q.name.trim().toLowerCase(), q);
    }

    // 3. To find deltas, we fetch all quests lightly using correct FeathersJS $select[] array syntax.
    // ⚠️ Plafond d'API mesuré le 24/09/2026 : **50 lignes par page** quel que soit `$limit` ⇒
    // on page par `$skip` et on ne s'arrête que sur une page **vide** (voir la garde ci-dessous).
    const limit = DOFUSDB_PAGE_MAX;
    let skip = 0;
    const deltas: QuestDelta[] = [];

    while (skip < totalRemote) {
        const res = await dofusDbFetch(`${DOFUSDB_API}/quests?$limit=${limit}&$skip=${skip}&$select[]=id&$select[]=name&$select[]=levelMin&$select[]=levelMax&$select[]=categoryId&$select[]=updatedAt`, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(15000),
        });
        const json = await res.json();

        if (!json.data || json.data.length === 0) break;

        for (const remoteQuest of json.data) {
            const id = Number(remoteQuest.id);
            const remoteName = String(remoteQuest.name?.fr || remoteQuest.name || "").trim();
            if (!id || !remoteName) continue;

            const localQuest = localMap.get(id) || localByNameMap.get(remoteName.toLowerCase());

            if (!localQuest) {
                // New quest!
                deltas.push({
                    dofusDbId: id,
                    name: remoteName,
                    levelMin: remoteQuest.levelMin ?? null,
                    levelMax: remoteQuest.levelMax ?? null,
                    categoryId: remoteQuest.categoryId,
                    type: "NEW"
                });
            } else {
                // Check for modification (name, levels **ou contenu**)
                const nameChanged = localQuest.name !== remoteName && !localQuest.name.startsWith(remoteName + " (#");
                const levelMinChanged = localQuest.levelMin !== (remoteQuest.levelMin ?? null);
                const levelMaxChanged = localQuest.levelMax !== (remoteQuest.levelMax ?? null);
                // 📜 Le contenu d'une quête (étapes/objectifs/récompenses) change sans que le nom ni
                // les niveaux bougent : `updatedAt` DofusDB est le SEUL signal (mesuré le 24/09/2026).
                // Une quête dont l'`updatedAt` n'est pas encore stocké n'est pas « modifiée » (sinon
                // la 1ʳᵉ passe annoncerait 1976 changements) : elle part au rattrapage borné.
                const remoteUpdatedAt = typeof remoteQuest.updatedAt === "string" ? new Date(remoteQuest.updatedAt) : null;
                const contentChanged =
                    localQuest.dofusDbUpdatedAt !== null &&
                    remoteUpdatedAt !== null &&
                    localQuest.dofusDbUpdatedAt.getTime() !== remoteUpdatedAt.getTime();

                if (nameChanged || levelMinChanged || levelMaxChanged || contentChanged) {
                    deltas.push({
                        dofusDbId: id,
                        name: remoteName,
                        localName: localQuest.name,
                        levelMin: remoteQuest.levelMin ?? null,
                        levelMax: remoteQuest.levelMax ?? null,
                        categoryId: remoteQuest.categoryId,
                        type: "MODIFIED"
                    });
                }
            }
        }

        skip += json.data.length;
        // ⚠️ On NE s'arrête PAS sur une page « courte » : l'API rend 50 lignes max, donc une
        // page de 50 avec `$limit` plus grand est normale. Seule une page vide arrête la
        // boucle (garde en tête) — sinon le comparateur ne voyait que les 50 premières quêtes.
    }

    return {
        totalLocal: allLocalQuests.length,
        totalRemote,
        deltas,
        backfillIds: (Array.isArray(backfill) ? backfill : [])
            .map((q) => q.dofusDbId)
            .filter((id): id is number => typeof id === "number"),
    };
}

/**
 * Synchronise les quêtes sélectionnées (`syncQuestDeltasCore`) : catégories relues à
 * chaque passe, upsert par `dofusDbId` sinon par nom, lots de 15 en parallèle.
 * Renvoie le nombre de quêtes synchronisées ; lève si le référentiel de catégories
 * ou la BDD est injoignable (l'appelant décide : message UI ou rejeu BullMQ).
 */
export async function syncQuestDeltasCore(selectedIds: number[]): Promise<number> {
    // 1. Fetch categories mappings
    const catRes = await dofusDbFetch(`${DOFUSDB_API}/quest-categories?$limit=100`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
    });
    const catJson = await catRes.json();
    const categoriesMap = new Map<number, string>();
    if (catJson.data) {
        for (const cat of catJson.data) {
            categoriesMap.set(cat.id, cat.name?.fr || "Non classé");
        }
    }

    let syncedCount = 0;
    const batchSize = 15;
    // 🔍 Journal : ce qui est **réellement appliqué** (et non ce qui est seulement détecté) —
    // un seul point d'écriture ⇒ tous les déclencheurs (worker, action, cron) sont couverts.
    const changes: GameDataChangeEntry[] = [];

    // 2. Fetch specific quests from DofusDB and upsert in parallel batches
    for (let i = 0; i < selectedIds.length; i += batchSize) {
        const chunk = selectedIds.slice(i, i + batchSize);
        await Promise.all(
            chunk.map(async (rawId) => {
                // CodeQL SSRF — l'id vient d'une saisie utilisateur : on n'accepte qu'un entier ≥ 0.
                const id = Number(rawId);
                if (!Number.isInteger(id) || id < 0) return;
                try {
                    const res = await dofusDbFetch(`${DOFUSDB_API}/quests/${id}`, {
                        headers: { Accept: "application/json" },
                        signal: AbortSignal.timeout(10000),
                    });
                    if (!res.ok) return;
                    const remoteQuest = await res.json();

                    if (!remoteQuest || !remoteQuest.name?.fr) return;

                    const categoryName = categoriesMap.get(remoteQuest.categoryId) || "Non classé";
                    const rawName = String(remoteQuest.name.fr).trim();

                    // Check if name is already taken by another dofusDbId
                    const existingByName = await db.gameQuest.findFirst({
                        where: { name: rawName },
                        select: { id: true, dofusDbId: true }
                    });

                    let finalName = rawName;
                    if (existingByName && existingByName.dofusDbId !== id) {
                        finalName = `${rawName} (#${id})`;
                    }

                    // Upsert by dofusDbId if possible, or by name if dofusDbId isn't there yet
                    const existingById = await db.gameQuest.findFirst({
                        where: { dofusDbId: id },
                        select: {
                            id: true, name: true, levelMin: true, levelMax: true, category: true,
                            contentJson: true, contentHash: true, dofusDbUpdatedAt: true,
                        }
                    });

                    // 📜 Résumé **canonique** du contenu (FR borné) + empreinte : c'est ce qui permet
                    // de dire « l'objectif 115 a changé » sans stocker les 10 Ko multilingues.
                    const digest = buildQuestContentDigest(remoteQuest);
                    const contentHash = questContentHash(digest);
                    const remoteUpdatedAt =
                        typeof remoteQuest.updatedAt === "string" ? new Date(remoteQuest.updatedAt) : null;

                    const remoteValues = {
                        name: finalName,
                        levelMin: remoteQuest.levelMin ?? null,
                        levelMax: remoteQuest.levelMax ?? null,
                        category: categoryName,
                        contentJson: digest as unknown as object,
                        contentHash,
                        dofusDbUpdatedAt: remoteUpdatedAt,
                        // 🖼️ Vrai visuel de la quête (carte de départ DofusDB → tuile du jeu servie
                        // par le dépôt). `undefined` = « ne touche pas » : on n'efface jamais un
                        // visuel déjà écrit, et une quête sans position de départ ne perd rien.
                        // ⚠️ Volontairement **hors** de `QUEST_CHANGE_KEYS` : une vignette n'est pas
                        // un changement de contenu — le journal garde son sens (étapes/objectifs).
                        imageUrl: questMapImageUrl(questStartMapId(remoteQuest.startPosition)) ?? undefined,
                    };

                    if (existingById) {
                        await db.gameQuest.update({
                            where: { id: existingById.id },
                            data: remoteValues,
                        });
                        const changed = diffFields(existingById, remoteValues, QUEST_CHANGE_KEYS);
                        if (changed) {
                            changes.push({
                                entityType: "quest",
                                entityId: String(id),
                                entityName: finalName,
                                changeType: "MODIFIED",
                                fields: changed,
                            });
                        }
                        // 📜 Détail du contenu modifié : par **étape** puis par **objectif** (borné).
                        const previousContent = readQuestContentDigest(existingById.contentJson);
                        if (previousContent && existingById.contentHash !== contentHash) {
                            changes.push(
                                ...diffCollection(
                                    previousContent.steps as unknown as Record<string, unknown>[],
                                    digest.steps as unknown as Record<string, unknown>[],
                                    {
                                        entityType: "quest-step",
                                        keys: ["name", "rewards", "objectives"],
                                        labelPrefix: finalName,
                                    },
                                ),
                                ...diffCollection(
                                    previousContent.steps.flatMap((s) =>
                                        s.objectives.map((o) => ({ ...o, stepId: s.id })),
                                    ) as unknown as Record<string, unknown>[],
                                    digest.steps.flatMap((s) => s.objectives.map((o) => ({ ...o, stepId: s.id }))) as unknown as Record<string, unknown>[],
                                    {
                                        entityType: "quest-objective",
                                        keys: ["text", "type", "mapId", "stepId"],
                                        labelPrefix: finalName,
                                    },
                                ),
                            );
                        }
                    } else {
                        await db.gameQuest.upsert({
                            where: { name: finalName },
                            update: {
                                dofusDbId: id,
                                levelMin: remoteValues.levelMin,
                                levelMax: remoteValues.levelMax,
                                category: remoteValues.category,
                                contentJson: remoteValues.contentJson,
                                contentHash,
                                dofusDbUpdatedAt: remoteUpdatedAt,
                                imageUrl: remoteValues.imageUrl,
                            },
                            create: {
                                name: finalName,
                                dofusDbId: id,
                                levelMin: remoteValues.levelMin,
                                levelMax: remoteValues.levelMax,
                                category: remoteValues.category,
                                contentJson: remoteValues.contentJson,
                                contentHash,
                                dofusDbUpdatedAt: remoteUpdatedAt,
                                imageUrl: remoteValues.imageUrl,
                            }
                        });
                        changes.push({
                            entityType: "quest",
                            entityId: String(id),
                            entityName: finalName,
                            changeType: "NEW",
                        });
                    }

                    syncedCount++;
                } catch (err) {
                    logger.error(`[quest-siphon] Erreur de synchronisation de la quête ${id}:`, err);
                }
            })
        );
    }

    // 🔍 Journal des changements réellement appliqués (borné : 500 / dataset, purge à l'écriture).
    await recordGameDataChanges("QUESTS", changes);

    return syncedCount;
}

/**
 * 🖼️ Écrit les visuels de quêtes préparés en amont : **aucun appel réseau** ici, uniquement des
 * écritures locales bornées. Renvoie le nombre de lignes effectivement mises à jour.
 *
 * Garde d'état **dans le WHERE** (`imageUrl: null`) : on ne remplace jamais un visuel déjà présent
 * (une valeur curée en God reste), et un double passage est idempotent. Chaque entrée est
 * re-validée ici (id entier ≥ 0, chemin **interne** `/…` jamais `//`) : les données viennent d'une
 * API tierce, l'écriture ne leur fait pas confiance.
 */
export async function applyQuestVisualsCore(entries: QuestVisualEntry[]): Promise<number> {
    if (!Array.isArray(entries) || entries.length === 0) return 0;

    let updated = 0;
    const batchSize = 20;

    for (let i = 0; i < entries.length; i += batchSize) {
        const chunk = entries.slice(i, i + batchSize);
        await Promise.all(
            chunk.map(async (entry) => {
                const dofusDbId = Number(entry?.dofusDbId);
                const imageUrl = typeof entry?.imageUrl === "string" ? entry.imageUrl.trim() : "";
                if (!Number.isInteger(dofusDbId) || dofusDbId < 0) return;
                if (!imageUrl.startsWith("/") || imageUrl.startsWith("//")) return;
                try {
                    const res = await db.gameQuest.updateMany({
                        where: { dofusDbId, imageUrl: null },
                        data: { imageUrl },
                    });
                    updated += res.count;
                } catch (err) {
                    logger.error(`[quest-siphon] Erreur d'écriture du visuel de la quête ${dofusDbId}:`, err);
                }
            })
        );
    }

    return updated;
}

/**
 * 🖼️ Rattrapage **borné** du visuel des quêtes déjà en base (constat user du 27/09/2026 : « vrai
 * asset quête Dofus par quête » — 1 976/1 976 quêtes locales n'avaient **aucune** image).
 *
 * Pourquoi ne pas se contenter de `syncQuestDeltasCore` (qui écrit le visuel des quêtes qu'il
 * synchronise) ? Parce qu'il ne touche que les ids qu'on lui donne : sans ce rattrapage, une quête
 * déjà en base resterait sans image jusqu'à sa prochaine modification — soit jamais.
 *
 * 📏 Mesure : chaque lot de **50 ids = 1 requête** (`id[$in][]` + `$select[]=id&$select[]=startPosition`)
 * ⇒ 1 200 visuels / passe = **24 requêtes**, sous le quota (30/min) ⇒ aucune attente, aucun rejeu.
 * Contrairement à la pagination du comparateur, cette lecture **ne peut pas** s'arrêter « à la
 * moitié » : les ids sont ceux de nos lignes, précis.
 *
 * Fail-soft : un lot en échec est loggé et n'empêche ni les autres lots ni la passe suivante.
 */
export async function backfillQuestVisualsCore(
    limit: number = QUEST_VISUAL_BACKFILL_PER_PASS
): Promise<number> {
    const capped = Math.min(QUEST_VISUAL_BACKFILL_PER_PASS, Math.max(1, Math.round(limit) || 0));

    let missing: { dofusDbId: number | null }[];
    try {
        missing = await db.gameQuest.findMany({
            where: { imageUrl: null, dofusDbId: { not: null } },
            select: { dofusDbId: true },
            orderBy: { dofusDbId: "asc" },
            take: capped,
        });
    } catch (err) {
        logger.error("[quest-siphon] Rattrapage des visuels : lecture locale impossible", err);
        return 0;
    }

    const ids = missing
        .map((q) => Number(q.dofusDbId))
        .filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length === 0) return 0;

    const entries: QuestVisualEntry[] = [];
    for (let i = 0; i < ids.length; i += DOFUSDB_PAGE_MAX) {
        const chunk = ids.slice(i, i + DOFUSDB_PAGE_MAX);
        try {
            // CodeQL SSRF : les ids viennent de **notre** base et sont re-validés entiers > 0 ci-dessus.
            const query = chunk.map((id) => `id[$in][]=${id}`).join("&");
            const res = await dofusDbFetch(
                `${DOFUSDB_API}/quests?${query}&$select[]=id&$select[]=startPosition&$limit=${DOFUSDB_PAGE_MAX}`,
                { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15000) }
            );
            if (!res.ok) continue;
            const json = await res.json();
            if (!Array.isArray(json?.data)) continue;

            for (const remoteQuest of json.data) {
                const id = Number(remoteQuest?.id);
                const imageUrl = questMapImageUrl(questStartMapId(remoteQuest?.startPosition));
                if (Number.isInteger(id) && id > 0 && imageUrl) {
                    entries.push({ dofusDbId: id, imageUrl });
                }
            }
        } catch (err) {
            logger.error(`[quest-siphon] Rattrapage des visuels : lot de ${chunk.length} id(s) en échec`, err);
        }
    }

    return applyQuestVisualsCore(entries);
}

