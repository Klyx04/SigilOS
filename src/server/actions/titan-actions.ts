"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { getUserContext, type ActionResponse } from "./user-actions";
import { revalidatePath } from "next/cache";
import { evaluateBadgeTriggersForProfile } from "./badge-triggers";

// ============================================================================
// Module « Titan » — progression « je l'ai vaincu » côté membre.
// La liste des titans (catalogue) vient de `getTitans` (actions God), mais cet onglet
// est public membre : il charge les titans + l'état de progression du membre courant.
// ============================================================================

/** Liste des titans + état de progression du membre courant (coche / qui a fait). */
export async function getUserTitansData(guildId: string): Promise<ActionResponse<{
    titans: any[];
    completedTitanIds: string[];
    members: { id: string; pseudo: string; image: string | null; dofusClass: string | null }[];
    progress: { titanId: string; profileId: string; pseudo: string; image: string | null; dofusClass: string | null; completedAt: string | null }[];
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

        const [titans, progress] = await Promise.all([
            db.titan.findMany({ orderBy: { name: "asc" } }),
            db.userTitanProgress.findMany({
                where: { profileId: { in: profileIds } },
                select: { titanId: true, profileId: true, completedAt: true },
            }),
        ]);

        const profileMap = new Map(guildProfiles.map((p) => [p.id, p]));

        const completedTitanIds = progress
            .filter((p) => p.profileId === user.profileId)
            .map((p) => p.titanId);

        return {
            success: true,
            data: {
                titans,
                completedTitanIds,
                members: guildProfiles.map((p) => ({
                    id: p.id,
                    pseudo: p.pseudoDofus || p.discordNickname || p.user?.name || "Membre",
                    image: p.user?.image || null,
                    dofusClass: p.classe || null,
                })),
                progress: progress.map((p) => {
                    const prof = profileMap.get(p.profileId);
                    return {
                        titanId: p.titanId,
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
        logger.error("[getUserTitansData] Error:", error);
        return { success: false, error: "Erreur lors du chargement des titans" };
    }
}

/** Toggle « je l'ai vaincu » sur un titan (par membre). Fail-closed : canEditOwnSucces requis. */
/**
 * Marque (ou démarque) un Titan comme vaincu — **idempotent**, l'état voulu est explicite.
 *
 * 🐛 Défaut mesuré le 30/10/2026 : l'ancien `toggleTitanCompleted` inversait l'état courant de la
 * base, alors que le client calculait déjà le sien. Deux clics rapides (ou un état client périmé)
 * produisaient l'inverse de ce que le joueur venait de cliquer — et le 1er clic affichait une
 * **erreur** alors que la ligne était créée.
 *
 * `completed = true` → `upsert` (crée si absent) ; `completed = false` → `deleteMany` (0 ou 1
 * ligne, jamais d'erreur si la ligne n'existe plus). La réponse renvoie **l'état voulu**.
 */
export async function setTitanCompleted(
    guildId: string,
    titanId: string,
    completed: boolean
): Promise<ActionResponse<{ completed: boolean }>> {
    const user = await getUserContext(guildId);
    if (!user.canEditOwnSucces) return { success: false, error: "Accès refusé" };
    if (!user.profileId) return { success: false, error: "Profil introuvable" };

    try {
        if (!completed) {
            await db.userTitanProgress.deleteMany({
                where: { profileId: user.profileId, titanId },
            });
            return { success: true, data: { completed: false } };
        }

        await db.userTitanProgress.upsert({
            where: { profileId_titanId: { profileId: user.profileId, titanId } },
            update: {},
            create: { profileId: user.profileId, titanId, source: "MANUAL" },
        });

        // 🏅 Évaluation automatique des badges (#198.2 No-Code Rules Engine) — **au marquage
        // seulement** : décocher ne doit pas rejouer les déclencheurs.
        evaluateBadgeTriggersForProfile(user.profileId, "DEFI").catch((err) => {
            logger.error("[BadgeTrigger] Error evaluating titan trigger:", err);
        });

        return { success: true, data: { completed: true } };
    } catch (error) {
        logger.error("[setTitanCompleted] Error:", error);
        return { success: false, error: "Erreur lors de la mise à jour" };
    }
}

// Révalidation des pages /succes quand un membre coche.
export async function revalidateTitanPages(guildId: string) {
    revalidatePath(`/dashboard/${guildId}/succes`);
    revalidatePath("/god?tab=game-data");
}
