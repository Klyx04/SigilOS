"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { getUserContext, type ActionResponse } from "./user-actions";
import { revalidatePath } from "next/cache";

// ============================================================================
// Module « Défi » — progression « je l'ai fait » côté membre.
// La liste des défis (catalogue) vient de `getDefis` (actions God), mais cet onglet est
// public membre : il charge les défis + l'état de progression du membre courant.
// ============================================================================

/** Liste des défis + état de progression du membre courant (coche / qui a fait). */
export async function getUserDefisData(guildId: string): Promise<ActionResponse<{
    defis: any[];
    completedDefiIds: string[];
    progress: { defiId: string; profileId: string; completedAt: string | null }[];
}>> {
    const user = await getUserContext(guildId);
    if (!user.canViewSucces) return { success: false, error: "Accès refusé" };

    try {
        const [defis, progress] = await Promise.all([
            db.defi.findMany({ orderBy: { name: "asc" } }),
            db.userDefiProgress.findMany({ select: { defiId: true, profileId: true, completedAt: true } }),
        ]);
        const completedDefiIds = progress
            .filter((p) => p.profileId === user.profileId)
            .map((p) => p.defiId);

        return {
            success: true,
            data: {
                defis,
                completedDefiIds,
                progress: progress.map((p) => ({
                    defiId: p.defiId,
                    profileId: p.profileId,
                    completedAt: p.completedAt?.toISOString?.() ?? null,
                })),
            },
        };
    } catch (error) {
        logger.error("[getUserDefisData] Error:", error);
        return { success: false, error: "Erreur lors du chargement des défis" };
    }
}

/** Toggle « je l'ai fait » sur un défi (par membre). Fail-closed : canEditOwnSucces requis. */
export async function toggleDefiCompleted(
    guildId: string,
    defiId: string
): Promise<ActionResponse<{ completed: boolean }>> {
    const user = await getUserContext(guildId);
    if (!user.canEditOwnSucces) return { success: false, error: "Accès refusé" };
    if (!user.profileId) return { success: false, error: "Profil introuvable" };

    try {
        const existing = await db.userDefiProgress.findUnique({
            where: { profileId_defiId: { profileId: user.profileId, defiId } },
        });

        if (existing) {
            await db.userDefiProgress.delete({ where: { id: existing.id } });
            return { success: true, data: { completed: false } };
        }

        await db.userDefiProgress.create({
            data: { profileId: user.profileId, defiId, source: "MANUAL" },
        });
        return { success: true, data: { completed: true } };
    } catch (error) {
        logger.error("[toggleDefiCompleted] Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

// Révalidation des pages /succes quand un membre coche.
export async function revalidateDefiPages(guildId: string) {
    revalidatePath(`/dashboard/${guildId}/succes`);
    revalidatePath("/god?tab=game-data");
}
