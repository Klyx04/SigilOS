import { db } from "@/lib/prisma";
import { getMyOcreProgress, OcreProgressData } from "./ocre-actions";
import { getDreamRuns } from "./songes/dream-run-actions";
import { UserContext } from "./user-actions";

export type FocusCardType = "OCRE_STEP" | "SONGES_RECRUIT" | "MISSION_URGENT" | "WELCOME";

export interface FocusCardData {
    type: FocusCardType;
    title: string;
    description: string;
    actionLabel: string;
    actionHref: string;
    priority: number; // 0-100
    metadata?: any;
}

/**
 * The Brain of SigilOS Dashboard.
 * Analyzes user state and returns the most relevant "Focus" action.
 */
export async function getDashboardFocus(
    guildId: string, 
    user: UserContext,
    prefetchedOcre?: OcreProgressData
): Promise<FocusCardData> {
    const cards: FocusCardData[] = [];

    try {
        // 1. Check Ocre Progress (Use prefetched data if available to save DB connections)
        if (user.canViewArchis) {
            let ocreData = prefetchedOcre;
            
            if (!ocreData) {
                const ocre = await getMyOcreProgress(guildId);
                if (ocre.success) ocreData = ocre.data;
            }

            if (ocreData) {
                const stats = ocreData.stats;
                if (stats.progressPercent > 80 && stats.progressPercent < 100) {
                    cards.push({
                        type: "OCRE_STEP",
                        title: "Quête Ocre : Prochaine étape",
                        description: `Vous avez complété ${stats.progressPercent}% de la quête. Plus que ${stats.manquants} monstres pour valider l'étape.`,
                        actionLabel: "Voir les monstres",
                        actionHref: `/dashboard/${guildId}/archimonstres`,
                        priority: stats.progressPercent
                    });
                }
            }
        }

        // 2. Check Songes Runs in recruitment
        if (user.canViewSonges) {
            const songes = await getDreamRuns(guildId, ["RECRUITING"]);
            if (songes.success && songes.runs && songes.runs.length > 0) {
                const recruitingRuns = songes.runs.filter((run: any) => run.status === "RECRUITING" && run.members.length < 4);

                if (recruitingRuns.length > 0) {
                    if (recruitingRuns.length === 1) {
                        const run = recruitingRuns[0];
                        const missing = 4 - run.members.length;
                        cards.push({
                            type: "SONGES_RECRUIT",
                            title: "Recrutement Songes",
                            description: `Un groupe pour une run ${run.difficulty} cherche ${missing} ${missing > 1 ? 'joueurs' : 'joueur'}.`,
                            actionLabel: "Consulter la run",
                            actionHref: `/dashboard/${guildId}/songes`,
                            priority: 85
                        });
                    } else {
                        const totalMissing = recruitingRuns.reduce((acc: number, run: any) => acc + (4 - run.members.length), 0);
                        cards.push({
                            type: "SONGES_RECRUIT",
                            title: "Recrutements Songes",
                            description: `${recruitingRuns.length} groupes de runs cherchent actuellement un total de ${totalMissing} joueurs.`,
                            actionLabel: "Voir les runs",
                            actionHref: `/dashboard/${guildId}/songes`,
                            priority: 88
                        });
                    }
                }
            }
        }

        // 3. Fallback: Welcome / Activities
        if (user.canViewMissions) {
            cards.push({
                type: "WELCOME",
                title: "Objectifs de Guilde",
                description: "Consultez les missions disponibles pour cette semaine et participez à l'effort collectif.",
                actionLabel: "Voir les missions",
                actionHref: `/dashboard/${guildId}/missions`,
                priority: 10
            });
        } else {
            // General fallback if missions are restricted
            cards.push({
                type: "WELCOME",
                title: "Découvrez SigilOS",
                description: "Consultez la présentation de la guilde et la documentation pour bien commencer.",
                actionLabel: "Lire le guide",
                actionHref: `/dashboard/${guildId}/presentation`,
                priority: 10
            });
        }

    } catch (e) {
        console.error("[Intelligence] Focus generation failed:", e);
    }

    // Return highest priority card
    return cards.sort((a, b) => b.priority - a.priority)[0];
}
