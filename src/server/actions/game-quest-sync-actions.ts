"use server";

import { logger } from "@/lib/logger";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { computeQuestDeltasCore, syncQuestDeltasCore, type QuestDelta } from "@/lib/quest-siphon";

/**
 * Enveloppes serveur du diff/sync des quêtes DofusDB — **le CŒUR vit dans
 * `src/lib/quest-siphon.ts`** (23/09/2026) : le worker peut donc lancer le dataset QUESTS
 * en arrière-plan. Ici : garde d'accès + traduction en `ActionResponse` (contrat INCHANGÉ
 * pour `QuestSyncPanel` et pour le lanceur « dans l'onglet »).
 */

// 🛡️ #108 — un sous-god avec la brique "game-data" (scope Données de Jeu) accède
// au comparateur/sync DofusDB du panneau God (QuestSyncPanel).
async function canAccessQuestSync(): Promise<boolean> {
    if (await isSuperAdmin()) return true;
    return canAccessBrick("game-data");
}

export type { QuestDelta };

export async function checkDofusDbDeltas() {
    if (!(await canAccessQuestSync())) {
        return { success: false, error: "Non autorisé" };
    }

    try {
        return { success: true, data: await computeQuestDeltasCore() };
    } catch (e: any) {
        logger.error("checkDofusDbDeltas Error:", { error: e });
        return { success: false, error: e?.message || "Erreur inconnue" };
    }
}

export async function syncDeltas(selectedIds: number[]) {
    if (!(await canAccessQuestSync())) {
        return { success: false, error: "Non autorisé" };
    }

    if (!selectedIds.length) {
        return { success: false, error: "Aucune quête sélectionnée" };
    }

    try {
        return { success: true, count: await syncQuestDeltasCore(selectedIds) };

    } catch (e: any) {
        logger.error("syncDeltas Error:", { error: e });
        return { success: false, error: e?.message || "Erreur inconnue" };
    }
}
