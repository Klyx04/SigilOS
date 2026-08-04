"use server";

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";

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

export async function checkDofusDbDeltas() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: "Non autorisé" };
    }

    try {
        // 1. Fetch DofusDB total quests count to see if we need deep checking
        const countRes = await fetch(`${DOFUSDB_API}/quests?$limit=1`);
        const countJson = await countRes.json();
        const totalRemote = countJson.total;

        // 2. Load local quests that have a dofusDbId
        const localQuests = await db.gameQuest.findMany({
            where: { dofusDbId: { not: null } },
            select: { dofusDbId: true, name: true, levelMin: true, levelMax: true }
        });

        const localMap = new Map();
        for (const q of localQuests) {
            localMap.set(q.dofusDbId, q);
        }

        // 3. To find deltas, we fetch all quests lightly.
        // Doing this in chunks to avoid timeout on Vercel
        const limit = 500;
        let skip = 0;
        const deltas: QuestDelta[] = [];
        let totalProcessed = 0;

        while (skip < totalRemote) {
            const res = await fetch(`${DOFUSDB_API}/quests?$limit=${limit}&$skip=${skip}&$select=id,name,levelMin,levelMax,categoryId`);
            const json = await res.json();

            if (!json.data || json.data.length === 0) break;

            for (const remoteQuest of json.data) {
                const id = remoteQuest.id;
                const remoteName = remoteQuest.name?.fr;
                if (!remoteName) continue;

                const localQuest = localMap.get(id);

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
                    // Note: DofusDB name might have been deduplicated locally, so we check if local name starts with remote name or is exact.
                    const nameChanged = localQuest.name !== remoteName && !localQuest.name.startsWith(remoteName + " (#");
                    const levelMinChanged = localQuest.levelMin !== remoteQuest.levelMin;
                    const levelMaxChanged = localQuest.levelMax !== remoteQuest.levelMax;

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

            totalProcessed += json.data.length;
            skip += limit;
        }

        return {
            success: true,
            data: {
                totalLocal: localQuests.length,
                totalRemote,
                deltas,
            }
        };

    } catch (e: any) {
        logger.error("checkDofusDbDeltas Error:", { error: e });
        return { success: false, error: e.message || "Erreur inconnue" };
    }
}

export async function syncDeltas(selectedIds: number[]) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: "Non autorisé" };
    }

    if (!selectedIds.length) {
        return { success: false, error: "Aucune quête sélectionnée" };
    }

    try {
        // 1. Fetch categories mappings
        const catRes = await fetch(`${DOFUSDB_API}/quest-categories?$limit=100`);
        const catJson = await catRes.json();
        const categoriesMap = new Map<number, string>();
        if (catJson.data) {
            for (const cat of catJson.data) {
                categoriesMap.set(cat.id, cat.name?.fr || "Non classé");
            }
        }

        let syncedCount = 0;

        // 2. Fetch specific quests from DofusDB and upsert
        for (const id of selectedIds) {
            const res = await fetch(`${DOFUSDB_API}/quests/${id}`);
            const remoteQuest = await res.json();

            if (!remoteQuest || !remoteQuest.name?.fr) continue;

            const categoryName = categoriesMap.get(remoteQuest.categoryId) || "Non classé";
            const rawName = remoteQuest.name.fr;

            // Check if name is already taken by another dofusDbId
            const existingByName = await db.gameQuest.findFirst({
                where: { name: rawName }
            });

            let finalName = rawName;
            if (existingByName && existingByName.dofusDbId !== id) {
                finalName = `${rawName} (#${id})`;
            }

            // Upsert by dofusDbId if possible, or by name if dofusDbId isn't there yet
            const existingById = await db.gameQuest.findFirst({
                where: { dofusDbId: id }
            });

            if (existingById) {
                await db.gameQuest.update({
                    where: { id: existingById.id },
                    data: {
                        name: finalName,
                        levelMin: remoteQuest.levelMin,
                        levelMax: remoteQuest.levelMax,
                        category: categoryName
                    }
                });
            } else {
                await db.gameQuest.upsert({
                    where: { name: finalName },
                    update: {
                        dofusDbId: id,
                        levelMin: remoteQuest.levelMin,
                        levelMax: remoteQuest.levelMax,
                        category: categoryName
                    },
                    create: {
                        name: finalName,
                        dofusDbId: id,
                        levelMin: remoteQuest.levelMin,
                        levelMax: remoteQuest.levelMax,
                        category: categoryName
                    }
                });
            }

            syncedCount++;
        }

        return { success: true, count: syncedCount };

    } catch (e: any) {
        logger.error("syncDeltas Error:", { error: e });
        return { success: false, error: e.message || "Erreur inconnue" };
    }
}
