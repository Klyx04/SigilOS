"use server";

import { db } from "@/lib/prisma";
import { getMyOcreProgress } from "./ocre-actions";
import { getDreamRuns } from "./songes/dream-run-actions";

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
export async function getDashboardFocus(guildId: string, userId: string): Promise<FocusCardData> {
    const cards: FocusCardData[] = [];

    try {
        // 1. Check Ocre Progress
        const ocre = await getMyOcreProgress(guildId);
        if (ocre.success && ocre.data) {
            const stats = ocre.data.stats;
            const quest = ocre.data.questInfo;

            // If close to ending a step (e.g., stage 12, 11 archis to go)
            // For now, simple logic: if $> 80%$ but not done
            if (stats.progressPercent > 80 && stats.progressPercent < 100) {
                cards.push({
                    type: "OCRE_STEP",
                    title: "Quête Ocre : Prochaine étape",
                    description: `Vous avez complété ${stats.progressPercent}% de la quête. Plus que ${stats.manquants} monstres pour valider l'étape.`,
                    actionLabel: "Voir les monstres",
                    actionHref: `/dashboard/${guildId}/archimonstres`,
                    priority: stats.progressPercent // Using factual progress
                });
            }
        }

        // 2. Check Songes Runs in recruitment
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
                        priority: 85 // High weight for sorting, but UI will hide the %
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

        // 3. Fallback: Welcome / Activities
        cards.push({
            type: "WELCOME",
            title: "Objectifs de Guilde",
            description: "Consultez les missions disponibles pour cette semaine et participez à l'effort collectif.",
            actionLabel: "Voir les missions",
            actionHref: `/dashboard/${guildId}/missions`,
            priority: 10
        });

    } catch (e) {
        console.error("[Intelligence] Focus generation failed:", e);
    }

    // Return highest priority card
    return cards.sort((a, b) => b.priority - a.priority)[0];
}
