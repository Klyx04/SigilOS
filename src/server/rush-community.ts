/**
 * Espace visiteur (rang 57) — **Progression Communautaire** (V2a-2), couche serveur.
 *
 * Une seule question : « quels visiteurs de MON serveur partagent leur progression de rush ? »
 * Trois invariants :
 *
 *  · **serveur imposé** : `account.profile.dofusServerId`, jamais un paramètre d URL ni un champ
 *    de formulaire — le panneau ne lit jamais un autre serveur ;
 *  · **consentement** : `profile.showRushProgress` est dans le `where` (D-V21) ; sans lui, la
 *    ligne n existe pas pour l écran, même si elle est en base ;
 *  · **minimisation** : le `select` ne lit ni `userId`, ni `publicProfileId`, ni l e-mail — seuls
 *    un nom de personnage et des compteurs partent au client.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getPublicAccount } from "@/server/public-account";
import { PUBLIC_RUSH_GUIDE_ID } from "@/lib/public-rush-progress";
import {
    COMMUNITY_MAX_MEMBERS,
    toCommunityMember,
    type CommunityMember,
} from "@/lib/rush-community-progress";

export type CommunityResult =
    | { success: true; members: CommunityMember[]; serverId: number }
    | { success: false; error: string };

const SESSION_EXPIRED = "Ta session a expiré. Reconnecte-toi pour continuer.";
const READ_FAILED = "Progression communautaire indisponible pour l instant.";

/**
 * Lecture des seuls profils consentants du serveur du lecteur.
 * Fail-closed : une erreur de base rend `success: false`, jamais une liste vide qui ferait croire
 * que personne ne partage — l écran dit « indisponible ».
 */
export async function loadPublicCommunity(): Promise<CommunityResult> {
    const account = await getPublicAccount();
    if (!account) return { success: false, error: SESSION_EXPIRED };

    const serverId = account.profile.dofusServerId;
    try {
        const rows = await db.publicRushProgress.findMany({
            where: {
                guideId: PUBLIC_RUSH_GUIDE_ID,
                profile: { dofusServerId: serverId, showRushProgress: true },
            },
            select: {
                characterName: true,
                completedMilestones: true,
                completedSteps: true,
                currentStep: true,
                dungeonChecks: true,
                updatedAt: true,
                profile: { select: { pseudoDofus: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: COMMUNITY_MAX_MEMBERS,
        });

        const members: CommunityMember[] = [];
        for (const row of rows) {
            const member = toCommunityMember({
                characterName: row.characterName,
                completedMilestones: row.completedMilestones,
                completedSteps: row.completedSteps,
                currentStep: row.currentStep,
                dungeonChecks: row.dungeonChecks,
                updatedAt: row.updatedAt,
                pseudoDofus: row.profile.pseudoDofus,
            });
            if (member) members.push(member);
        }

        return { success: true, members, serverId };
    } catch (error) {
        logger.error("[Espace visiteur] Progression communautaire illisible", { error });
        return { success: false, error: READ_FAILED };
    }
}