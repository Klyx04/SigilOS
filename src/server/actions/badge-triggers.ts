"use server";

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

/**
 * ⚡ Moteur d'évaluation des règles de badges automatiques (#198.2 No-Code Rules Engine)
 * Appelé automatiquement lors des validations en jeu (Dofus, Défis, Songes, Missions).
 */
export async function evaluateBadgeTriggersForProfile(
    profileId: string,
    eventType?: "DOFUS" | "DEFI" | "SONGES" | "MISSION" | "ALL"
): Promise<{ success: boolean; newlyGrantedBadges: string[] }> {
    try {
        if (!profileId) return { success: false, newlyGrantedBadges: [] };

        // 1. Récupérer les badges avec déclencheur automatique
        const autoBadges = await (db as any).badge.findMany({
            where: {
                triggerType: { not: "MANUAL" }
            },
            include: {
                userBadges: {
                    where: { profileId }
                }
            }
        });

        // Filtrer les badges non encore débloqués par ce profil
        const pendingBadges = autoBadges.filter((b: any) => b.userBadges.length === 0);
        if (pendingBadges.length === 0) {
            return { success: true, newlyGrantedBadges: [] };
        }

        const newlyGranted: string[] = [];

        // Pré-chargement des compteurs du joueur selon les besoins
        let dofusCount: number | null = null;
        let completedDofusSlugs: Set<string> | null = null;
        let defiCount: number | null = null;
        let missionCount: number | null = null;

        for (const badge of pendingBadges) {
            const { triggerType, triggerValue } = badge;
            let conditionMet = false;
            let reason = `Débloqué automatiquement : ${badge.name}`;

            switch (triggerType) {
                case "DOFUS_COUNT": {
                    if (dofusCount === null) {
                        dofusCount = await (db as any).playerDofusProgress.count({
                            where: {
                                profileId,
                                isCompleted: true
                            }
                        });
                    }
                    const targetCount = parseInt(triggerValue || "1", 10);
                    const currentDofus = dofusCount ?? 0;
                    if (currentDofus >= targetCount) {
                        conditionMet = true;
                        reason = `A validé ${currentDofus} Dofus sur SigilOS (objectif: ${targetCount})`;
                    }
                    break;
                }

                case "DOFUS_SPECIFIC": {
                    if (completedDofusSlugs === null) {
                        const progresses = await (db as any).playerDofusProgress.findMany({
                            where: { profileId, isCompleted: true },
                            include: { dofusItem: { select: { slug: true } } }
                        });
                        completedDofusSlugs = new Set(progresses.map((p: any) => p.dofusItem?.slug).filter(Boolean));
                    }
                    const targetSlug = (triggerValue || "").toLowerCase().trim();
                    if (targetSlug && completedDofusSlugs && completedDofusSlugs.has(targetSlug)) {
                        conditionMet = true;
                        reason = `A obtenu le ${badge.name}`;
                    }
                    break;
                }

                case "DEFI_COUNT": {
                    if (defiCount === null) {
                        defiCount = await (db as any).userDefiProgress.count({
                            where: { profileId }
                        });
                    }
                    const targetCount = parseInt(triggerValue || "1", 10);
                    const currentDefis = defiCount ?? 0;
                    if (currentDefis >= targetCount) {
                        conditionMet = true;
                        reason = `A complété ${currentDefis} Défis / Doubles Boss (objectif: ${targetCount})`;
                    }
                    break;
                }

                case "MISSIONS_COUNT": {
                    if (missionCount === null) {
                        missionCount = await (db as any).missionSubmission.count({
                            where: {
                                profileId,
                                status: "APPROVED"
                            }
                        });
                    }
                    const targetCount = parseInt(triggerValue || "1", 10);
                    const currentMissions = missionCount ?? 0;
                    if (currentMissions >= targetCount) {
                        conditionMet = true;
                        reason = `A validé ${currentMissions} missions de guilde (objectif: ${targetCount})`;
                    }
                    break;
                }

                default:
                    break;
            }

            if (conditionMet) {
                await (db as any).userBadge.upsert({
                    where: {
                        profileId_badgeId: {
                            profileId,
                            badgeId: badge.id
                        }
                    },
                    create: {
                        profileId,
                        badgeId: badge.id,
                        source: "AUTOMATIC",
                        reason
                    },
                    update: {}
                });

                newlyGranted.push(badge.name);
                logger.info(`[BadgeTrigger] Badge "${badge.name}" attribué automatiquement au profil ${profileId}`);
            }
        }

        if (newlyGranted.length > 0) {
            revalidatePath("/dashboard/[guildId]/profile", "page");
            revalidatePath("/dashboard/[guildId]/members", "page");
        }

        return { success: true, newlyGrantedBadges: newlyGranted };
    } catch (err: any) {
        logger.error("[evaluateBadgeTriggersForProfile Error]", err);
        return { success: false, newlyGrantedBadges: [] };
    }
}
