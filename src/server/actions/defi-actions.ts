"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { getUserContext, type ActionResponse } from "./user-actions";
import { revalidatePath } from "next/cache";
import { evaluateBadgeTriggersForProfile } from "./badge-triggers";

// ============================================================================
// Module « Défi » — progression « je l'ai fait » côté membre.
// La liste des défis (catalogue) vient de `getDefis` (actions God), mais cet onglet est
// public membre : il charge les défis + l'état de progression du membre courant.
// ============================================================================

/** Liste des défis + état de progression du membre courant (coche / qui a fait). */
export async function getUserDefisData(guildId: string): Promise<ActionResponse<{
    defis: any[];
    completedDefiIds: string[];
    members: { id: string; pseudo: string; image: string | null; dofusClass: string | null }[];
    progress: { defiId: string; profileId: string; pseudo: string; image: string | null; dofusClass: string | null; completedAt: string | null }[];
}>> {
    const user = await getUserContext(guildId);
    if (!user.canViewSucces) return { success: false, error: "Accès refusé" };

    try {
        const guildProfiles = await db.userProfile.findMany({
            where: { guildId: user.guildId || guildId, status: "ACTIVE" },
            select: {
                id: true,
                pseudoDofus: true,
                classe: true,
                discordNickname: true,
                user: { select: { name: true, image: true } },
            },
        });

        const profileIds = guildProfiles.map((p) => p.id);

        const [defis, progress] = await Promise.all([
            db.defi.findMany({ orderBy: { name: "asc" } }),
            db.userDefiProgress.findMany({
                where: { profileId: { in: profileIds } },
                select: { defiId: true, profileId: true, completedAt: true },
            }),
        ]);

        const profileMap = new Map(guildProfiles.map((p) => [p.id, p]));

        const completedDefiIds = progress
            .filter((p) => p.profileId === user.profileId)
            .map((p) => p.defiId);

        return {
            success: true,
            data: {
                defis,
                completedDefiIds,
                members: guildProfiles.map((p) => ({
                    id: p.id,
                    pseudo: p.pseudoDofus || p.discordNickname || p.user?.name || "Membre",
                    image: p.user?.image || null,
                    dofusClass: p.classe || null,
                })),
                progress: progress.map((p) => {
                    const prof = profileMap.get(p.profileId);
                    return {
                        defiId: p.defiId,
                        profileId: p.profileId,
                        pseudo: prof?.pseudoDofus || prof?.discordNickname || prof?.user?.name || "Membre",
                        image: prof?.user?.image || null,
                        dofusClass: prof?.classe || null,
                        completedAt: p.completedAt?.toISOString?.() ?? null,
                    };
                }),
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

        // 🏅 Évaluation automatique des badges (#198.2 No-Code Rules Engine)
        evaluateBadgeTriggersForProfile(user.profileId, "DEFI").catch((err) => {
            logger.error("[BadgeTrigger] Error evaluating defi trigger:", err);
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
