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
}


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
        select: { dofusDbId: true, name: true, levelMin: true, levelMax: true }
    });

    const localMap = new Map<number, { dofusDbId: number | null; name: string; levelMin: number | null; levelMax: number | null }>();
    for (const q of localQuests) {
        if (q.dofusDbId !== null) {
            localMap.set(q.dofusDbId, q);
        }
    }

    // Also index by name to avoid false "NEW" if dofusDbId wasn't set on some local quests
    const allLocalQuests = await db.gameQuest.findMany({
        select: { id: true, dofusDbId: true, name: true, levelMin: true, levelMax: true }
    });
    const localByNameMap = new Map<string, { id: string; dofusDbId: number | null; name: string; levelMin: number | null; levelMax: number | null }>();
    for (const q of allLocalQuests) {
        localByNameMap.set(q.name.trim().toLowerCase(), q);
    }

    // 3. To find deltas, we fetch all quests lightly using correct FeathersJS $select[] array syntax.
    const limit = 500;
    let skip = 0;
    const deltas: QuestDelta[] = [];

    while (skip < totalRemote) {
        const res = await dofusDbFetch(`${DOFUSDB_API}/quests?$limit=${limit}&$skip=${skip}&$select[]=id&$select[]=name&$select[]=levelMin&$select[]=levelMax&$select[]=categoryId`, {
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
                // Check for modification (name or levels)
                const nameChanged = localQuest.name !== remoteName && !localQuest.name.startsWith(remoteName + " (#");
                const levelMinChanged = localQuest.levelMin !== (remoteQuest.levelMin ?? null);
                const levelMaxChanged = localQuest.levelMax !== (remoteQuest.levelMax ?? null);

                if (nameChanged || levelMinChanged || levelMaxChanged) {
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
        if (json.data.length < limit) break;
    }

    return {
        totalLocal: allLocalQuests.length,
        totalRemote,
        deltas,
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
                        select: { id: true }
                    });

                    if (existingById) {
                        await db.gameQuest.update({
                            where: { id: existingById.id },
                            data: {
                                name: finalName,
                                levelMin: remoteQuest.levelMin ?? null,
                                levelMax: remoteQuest.levelMax ?? null,
                                category: categoryName
                            }
                        });
                    } else {
                        await db.gameQuest.upsert({
                            where: { name: finalName },
                            update: {
                                dofusDbId: id,
                                levelMin: remoteQuest.levelMin ?? null,
                                levelMax: remoteQuest.levelMax ?? null,
                                category: categoryName
                            },
                            create: {
                                name: finalName,
                                dofusDbId: id,
                                levelMin: remoteQuest.levelMin ?? null,
                                levelMax: remoteQuest.levelMax ?? null,
                                category: categoryName
                            }
                        });
                    }

                    syncedCount++;
                } catch (err) {
                    logger.error(`[quest-siphon] Erreur de synchronisation de la quête ${id}:`, err);
                }
            })
        );
    }

    return syncedCount;
}

