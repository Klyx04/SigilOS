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
 *     comme « MODIFIED » au passage suivant.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { dofusDbFetch } from "@/lib/dofusdb-limiter";
import { DOFUSDB_PAGE_MAX } from "@/lib/dofusdb-pagination";
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

