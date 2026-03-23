"use server";

import { getUserContext } from "./user-actions";
import { metamobQueue } from "@/lib/queue/metamob-queue";
import { ladderQueue } from "@/workers/ladder-sync-worker";
import { logger } from "@/lib/logger";

export async function triggerManualMetamobSync(guildId: string, userId: string) {
    const user = await getUserContext(guildId);
    if (!user.isSuperAdmin) {
        return { success: false, error: "Unauthorized. SuperAdmin required." };
    }

    try {
        const job = await metamobQueue.add("manual-metamob-sync", {
            guildId,
            userId, // The user triggering the specific sync. In a real scenario we'd queue an entire scan or specifically this user. For now, testing their own profile.
        });
        
        logger.info(`[Admin] SuperAdmin ${user.name} triggered a manual Metamob Sync (Job ${job.id})`);
        return { success: true, message: "Tâche de synchronisation Metamob (Dofusbook) ajoutée à la file d'attente." };
    } catch (err: any) {
        logger.error(`[Admin] Failed to dispatch metamob sync: ${err.message}`);
        return { success: false, error: "Erreur lors de l'envoi de la tâche." };
    }
}

export async function triggerManualLadderSync(guildId: string) {
    const user = await getUserContext(guildId);
    if (!user.isSuperAdmin) {
        return { success: false, error: "Unauthorized. SuperAdmin required." };
    }

    try {
        const job = await ladderQueue.add("manual-ladder-sync", {});
        
        logger.info(`[Admin] SuperAdmin ${user.name} triggered a manual Ladder Sync (Job ${job.id})`);
        return { success: true, message: "Tâche de synchronisation du LADDER ajoutée à la file d'attente." };
    } catch (err: any) {
        logger.error(`[Admin] Failed to dispatch ladder sync: ${err.message}`);
        return { success: false, error: "Erreur lors de l'envoi de la tâche." };
    }
}
