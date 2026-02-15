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
                    title: "L'Éternelle Moisson : Presque là !",
                    description: `Tu as fini ${stats.progressPercent}% de ta quête. Plus que ${stats.manquants} monstres pour avancer.`,
                    actionLabel: "Lancer un échange",
                    actionHref: `/dashboard/${guildId}/archimonstres`,
                    priority: 90
                });
            }
        }

        // 2. Check Songes Runs in recruitment
        const songes = await getDreamRuns(guildId, ["RECRUITING"]);
        if (songes.success && songes.runs && songes.runs.length > 0) {
            const accessibleRun = songes.runs.find((run: any) => run.status === "RECRUITING" && run.members.length < 4);
            if (accessibleRun) {
                const missing = 4 - accessibleRun.members.length;
                cards.push({
                    type: "SONGES_RECRUIT",
                    title: "Une expédition t'attend",
                    description: `Une run Songes (${accessibleRun.difficulty}) cherche ${missing} ${missing > 1 ? 'joueurs' : 'joueur'}.`,
                    actionLabel: "Rejoindre la run",
                    actionHref: `/dashboard/${guildId}/songes`,
                    priority: 85
                });
            }
        }

        // 3. Fallback: Welcome / Activities
        cards.push({
            type: "WELCOME",
            title: "Prêt pour l'aventure ?",
            description: "Consulte les missions de la semaine pour faire briller ta guilde.",
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
