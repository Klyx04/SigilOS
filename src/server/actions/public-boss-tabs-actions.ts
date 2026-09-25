"use server";

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ─── TYPES PUBLICS ─────────────────────────────────────────────────────────────
// Pas d'auth — données 100 % publiques (aucune donnée membre ni guilde).

export interface PublicLinkedQuest {
    id: string;
    name: string;
    isDungeon: boolean;
    stepOrder: number;
    zone: string | null;
    chainName: string | null;
    dofusName: string | null;
    dofusSlug: string | null;
    dofusImageUrl: string | null;
    dofusSuccessName: string | null;
    level: number | null;
    npcName: string | null;
    objectives: string[];
    isRush: boolean;
}

export interface PublicLinkedQuestsData {
    quests: PublicLinkedQuest[];
}

export interface PublicDungeonAchievement {
    id: string;
    name: string;
    slug: string | null;
    iconUrl: string | null;
    points: number;
    description: string | null;
}

// ─── QUÊTES LIÉES (PUBLIC, SANS AUTH) ─────────────────────────────────────────

/**
 * Retourne les quêtes Dofus liées à un donjon, sans aucune donnée de guilde ni
 * de statut membre. Version publique de `getLinkedQuests` pour la landing boss.
 */
export async function getPublicLinkedQuests(
    dungeonName: string,
    bossName: string,
    dungeonDofusdbId?: number | null
): Promise<{ success: boolean; data?: PublicLinkedQuestsData; error?: string }> {
    try {
        const norm = (s: string) =>
            s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const dn = norm(dungeonName || "");
        const bn = norm(bossName || "");

        const all = await db.dofusQuestEntry.findMany({
            include: {
                chain: {
                    select: {
                        sectionName: true,
                        sectionType: true,
                        dofus: {
                            select: {
                                name: true,
                                nameShort: true,
                                imageUrl: true,
                                successName: true,
                                slug: true,
                            },
                        },
                    },
                },
            },
        });

        const linked = all.filter((e: any) => {
            if (dungeonDofusdbId && e.dofusdbId && e.dofusdbId === dungeonDofusdbId) return true;
            if (e.isDungeon) {
                const en = norm(e.name || "");
                if (en && dn && (en === dn || en.includes(dn) || dn.includes(en))) return true;
                if (en && bn && (en === bn || en.includes(bn) || bn.includes(en))) return true;
            }
            if (Array.isArray(e.dungeonsRequired) && e.dungeonsRequired.length > 0) {
                return e.dungeonsRequired.some(
                    (dr: any) =>
                        (dungeonDofusdbId && dr.id === dungeonDofusdbId) ||
                        (dn && norm(dr.name || "") === dn)
                );
            }
            return false;
        });

        const quests: PublicLinkedQuest[] = linked.map((q: any) => ({
            id: q.id,
            name: q.name,
            isDungeon: !!q.isDungeon,
            stepOrder: q.stepOrder ?? 0,
            zone: q.zone ?? null,
            chainName: q.chain?.sectionName ?? null,
            dofusName: q.chain?.dofus?.name ?? null,
            dofusSlug: q.chain?.dofus?.slug ?? null,
            dofusImageUrl: q.chain?.dofus?.imageUrl ?? null,
            dofusSuccessName: q.chain?.dofus?.successName ?? null,
            level: q.level ?? null,
            npcName: q.npcName ?? null,
            objectives: Array.isArray(q.objectives) ? q.objectives : [],
            isRush:
                !!q.isSynergyCandidate ||
                (q.chain?.sectionType || "").toLowerCase().includes("rush"),
        }));

        return { success: true, data: { quests } };
    } catch (error) {
        logger.error("[getPublicLinkedQuests] Error:", error);
        return { success: false, error: "Erreur lors du chargement des quêtes" };
    }
}

// ─── SUCCÈS DU DONJON (PUBLIC, SANS AUTH) ─────────────────────────────────────

/**
 * Retourne les succès (challenges) associés à un donjon.
 * Lecture seule, pas d'auth, pas de données de progression membre.
 */
export async function getPublicDungeonAchievements(
    dungeonId: string
): Promise<{ success: boolean; data?: PublicDungeonAchievement[]; error?: string }> {
    try {
        const rows = await (db as any).dungeonAchievement.findMany({
            where: { dungeonId },
            include: {
                challenge: {
                    select: {
                        name: true,
                        slug: true,
                        iconUrl: true,
                        description: true,
                    },
                },
            },
            orderBy: { points: "desc" },
        });

        const data: PublicDungeonAchievement[] = rows.map((r: any) => ({
            id: r.id,
            name: r.challenge?.name ?? "Succès",
            slug: r.challenge?.slug ?? null,
            iconUrl: r.challenge?.iconUrl ?? null,
            points: r.points ?? 0,
            description: r.challenge?.description ?? null,
        }));

        return { success: true, data };
    } catch (error) {
        logger.error("[getPublicDungeonAchievements] Error:", error);
        return { success: false, error: "Erreur lors du chargement des succès" };
    }
}
