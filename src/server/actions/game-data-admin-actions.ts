'use server';

import { logger } from "@/lib/logger";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { isSuperAdmin, canAccessBrick } from "@/server/actions/super-admin-actions";
import { createGodAuditLog } from "@/server/actions/audit-actions";
import { revalidatePath } from "next/cache";
import { writeFileSync } from "fs";
import { join } from "path";

import { addIgnoredFamily, addIgnoredZone } from "@/server/actions/game-data-actions";
import { NO_ACHIEVEMENT_CHALLENGE_SLUG, ensureNoAchievementChallengeId } from "@/lib/dungeon-no-achievement";

// --- Types ---

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

// --- Validation Schemas ---

const MonsterFamilySchema = z.object({
    name: z.string().min(1, "Nom requis").max(100),
    level: z.number().int().min(1).max(1000).optional().nullable(),
    description: z.string().optional(),
    imageUrl: z.string().optional().or(z.literal("")),
    zoneIds: z.array(z.string()).optional(),
});

const ChallengeSchema = z.object({
    name: z.string().min(1, "Nom requis").max(100),
    slug: z.string().min(1, "Slug requis").max(100).regex(/^[a-z0-9-]+$/, "Format: minuscules, chiffres, tirets uniquement"),
    description: z.string().optional(),
    iconUrl: z.string().optional().or(z.literal("")),

    conditions: z.record(z.any()).optional(),
});

const DungeonFormSchema = z.object({
    name: z.string().min(1, "Nom requis").max(150),
    bossName: z.string().min(1, "Nom du boss requis").max(150),
    level: z.number().min(1, "Niveau invalide").max(1000),
    dpnlUrl: z.string().optional().or(z.literal("")),
    dofuspourlesnoobsUrl: z.string().optional().or(z.literal("")),
    dofensiveUrl: z.string().optional().or(z.literal("")),
    imageUrl: z.string().optional().or(z.literal("")),
    isExpedition: z.boolean().default(false),
    expeditionModes: z.array(z.enum(["BRAVOURE", "AUDACE", "NORMAL"])).optional(),
    expeditionMechanics: z.string().optional(),
    isOcreQuest: z.boolean().default(false),
    mapId: z.number().int().nullable().optional(),
    challengeIds: z.array(z.string()).optional(),
    /* Chantier double boss : dissociation affichage / résolution Dofensive. Optionnels. */
    dofensiveMonsterName: z.string().optional().or(z.literal("")),
    dofensiveDungeonName: z.string().optional().or(z.literal("")),
    /* Chantier donjon sans succès : le « succès » est d'être validé → pseudo-succès « Donjon validé ». */
    isNoAchievement: z.boolean().default(false),
    /* Chantier « boss d'anomalie » : coché en God (le contenu lui-même est siphonné). */
    isAnomalyBoss: z.boolean().default(false),
});

// --- Helper: Check super-admin access ---

// 🛡️ Fail-closed : super-admin OU sous-god avec la brique "game-data".
async function requireSuperAdmin(): Promise<string | null> {
    const session = await auth();
    if (!session?.user?.id) return null;

    const isAdmin = await isSuperAdmin();
    if (isAdmin) return session.user.id;

    const ok = await canAccessBrick("game-data");
    if (!ok) return null;

    return session.user.id;
}

// 🛡️ Trace une écriture God UNIQUEMENT pour un sous-god (pas super-admin).
async function logGameDataWrite(op: string, targetId?: string, metadata?: Record<string, any>) {
    try {
        const session = await auth();
        if (!session?.user?.id) return;
        const isAdmin = await isSuperAdmin();
        if (isAdmin) return;
        await createGodAuditLog({
            action: "GOD_GAME_DATA_UPDATE",
            targetType: "DATA_SYNC",
            targetId,
            metadata: { op, ...metadata },
        });
    } catch {
        // Non bloquant
    }
}

// ===========================
// MONSTER FAMILIES
// ===========================

const CommonFilterSchema = z.object({
    search: z.string().optional(),
    minLevel: z.number().optional(),
    maxLevel: z.number().optional(),
});

const FamilyFilterSchema = CommonFilterSchema.extend({
    zoneId: z.string().optional(),
});

export async function getMonsterFamilies(
    filters: z.infer<typeof FamilyFilterSchema> = {}
): Promise<ActionResponse<any[]>> {
    try {
        const validated = FamilyFilterSchema.parse(filters);
        const whereClause: any = {};

        if (validated.zoneId) {
            whereClause.zones = { some: { id: validated.zoneId } };
        }

        if (validated.search) {
            whereClause.name = { contains: validated.search, mode: 'insensitive' };
        }

        if (validated.minLevel !== undefined || validated.maxLevel !== undefined) {
            const levelFilter: any = {};
            if (typeof validated.minLevel === 'number') levelFilter.gte = validated.minLevel;
            if (typeof validated.maxLevel === 'number') levelFilter.lte = validated.maxLevel;
            
            if (Object.keys(levelFilter).length > 0) {
                whereClause.level = levelFilter;
            }
        }

        const families = await db.monsterFamily.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                level: true,
                description: true,
                imageUrl: true,
                _count: { select: { monsters: true } },
                zones: { select: { id: true, name: true } }
            },
            orderBy: { name: 'asc' }
        });
        return { success: true, data: families };
    } catch (error) {
        logger.error('[getMonsterFamilies] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des familles' };
    }
}

export async function createMonsterFamily(
    data: z.infer<typeof MonsterFamilySchema>
): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = MonsterFamilySchema.parse(data);
        const { zoneIds, ...familyData } = validated;

        const family = await db.monsterFamily.create({
            data: {
                ...familyData,
                imageUrl: familyData.imageUrl || null,
                zones: zoneIds ? {
                    connect: zoneIds.map(id => ({ id }))
                } : undefined
            }
        });
        await logGameDataWrite('create-monster-family', family.id, { name: family.name });

        revalidatePath('/god/game-data');
        return { success: true, data: family };
    } catch (error: any) {
        logger.error('[createMonsterFamily] Error:', error);
        if (error.code === 'P2002') {
            return { success: false, error: 'Cette famille existe déjà' };
        }
        return { success: false, error: 'Erreur lors de la création' };
    }
}

export async function updateMonsterFamily(
    id: string,
    data: z.infer<typeof MonsterFamilySchema>
): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = MonsterFamilySchema.parse(data);
        const { zoneIds, ...familyData } = validated;

        const family = await db.monsterFamily.update({
            where: { id },
            data: {
                ...familyData,
                imageUrl: familyData.imageUrl || null,
                zones: zoneIds ? {
                    set: zoneIds.map(id => ({ id }))
                } : undefined
            }
        });
        await logGameDataWrite('update-monster-family', id, { name: family.name });

        revalidatePath('/god/game-data');
        return { success: true, data: family };
    } catch (error: any) {
        logger.error('[updateMonsterFamily] Error:', error);
        if (error.code === 'P2002') {
            return { success: false, error: 'Cette famille existe déjà' };
        }
        return { success: false, error: 'Erreur lors de la mise à jour' };
    }
}

export async function deleteMonsterFamily(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const target = await db.monsterFamily.findUnique({
            where: { id },
            select: { name: true }
        });
        if (target?.name) {
            addIgnoredFamily(target.name);
        }
        await db.monsterFamily.delete({ where: { id } });
        await logGameDataWrite('delete-monster-family', id);
        revalidatePath('/god/game-data');
        return { success: true };
    } catch (error: any) {
        logger.error('[deleteMonsterFamily] Error:', error);
        if (error.code === 'P2003') {
            return { success: false, error: 'Impossible de supprimer : des monstres sont associés' };
        }
        return { success: false, error: 'Erreur lors de la suppression' };
    }
}

// ===========================
// CHALLENGES
// ===========================

export async function getChallenges(): Promise<ActionResponse<any[]>> {
    try {
        const challenges = await db.challenge.findMany({
            include: {
                _count: { select: { dungeonAchievements: true } }
            },
            orderBy: { name: 'asc' }
        });
        return { success: true, data: challenges };
    } catch (error) {
        logger.error('[getChallenges] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des challenges' };
    }
}

export async function createChallenge(
    data: z.infer<typeof ChallengeSchema>
): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = ChallengeSchema.parse(data);
        const challenge = await db.challenge.create({
            data: {
                ...validated,
                iconUrl: validated.iconUrl || null,
            }
        });
        await logGameDataWrite('create-challenge', challenge.id, { name: challenge.name });

        revalidatePath('/god/game-data');
        return { success: true, data: challenge };
    } catch (error: any) {
        logger.error('[createChallenge] Error:', error);
        if (error.code === 'P2002') {
            return { success: false, error: 'Ce challenge (nom ou slug) existe déjà' };
        }
        return { success: false, error: 'Erreur lors de la création' };
    }
}

export async function updateChallenge(
    id: string,
    data: z.infer<typeof ChallengeSchema>
): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = ChallengeSchema.parse(data);
        const challenge = await db.challenge.update({
            where: { id },
            data: {
                ...validated,
                iconUrl: validated.iconUrl || null,
            }
        });
        await logGameDataWrite('update-challenge', id, { name: challenge.name });

        revalidatePath('/god/game-data');
        return { success: true, data: challenge };
    } catch (error: any) {
        logger.error('[updateChallenge] Error:', error);
        if (error.code === 'P2002') {
            return { success: false, error: 'Ce challenge (nom ou slug) existe déjà' };
        }
        return { success: false, error: 'Erreur lors de la mise à jour' };
    }
}

export async function deleteChallenge(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await db.challenge.delete({ where: { id } });
        await logGameDataWrite('delete-challenge', id);
        revalidatePath('/god/game-data');
        return { success: true };
    } catch (error: any) {
        logger.error('[deleteChallenge] Error:', error);
        if (error.code === 'P2003') {
            return { success: false, error: 'Impossible de supprimer : des donjons sont associés' };
        }
        return { success: false, error: 'Erreur lors de la suppression' };
    }
}

// ===========================
// DUNGEONS
// ===========================

export async function getDungeonsWithAchievements(
    filters: z.infer<typeof CommonFilterSchema> = {}
): Promise<ActionResponse<any[]>> {
    try {
        const validated = CommonFilterSchema.parse(filters);
        const whereClause: any = {};

        if (validated.search) {
            whereClause.OR = [
                { name: { contains: validated.search, mode: 'insensitive' } },
                { bossName: { contains: validated.search, mode: 'insensitive' } }
            ];
        }

        if (validated.minLevel !== undefined || validated.maxLevel !== undefined) {
            const levelFilter: any = {};
            if (typeof validated.minLevel === 'number') levelFilter.gte = validated.minLevel;
            if (typeof validated.maxLevel === 'number') levelFilter.lte = validated.maxLevel;
            if (Object.keys(levelFilter).length > 0) whereClause.level = levelFilter;
        }

        const dungeons = await db.dungeon.findMany({
            where: whereClause,
            include: {
                achievements: {
                    include: { challenge: true },
                    orderBy: { challenge: { name: 'asc' } }
                }
            },
            orderBy: { level: 'asc' }
        });
        return { success: true, data: dungeons };
    } catch (error) {
        logger.error('[getDungeonsWithAchievements] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des donjons' };
    }
}

export async function createDungeon(
    data: z.infer<typeof DungeonFormSchema>
): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = DungeonFormSchema.parse(data);
        const { challengeIds, isNoAchievement, isAnomalyBoss, ...dungeonData } = validated;

        // Chantier double boss : conversion '' → null pour les champs de résolution Dofensive.
        const dungeon = await db.dungeon.create({
            data: {
                ...dungeonData,
                isNoAchievement: !!isNoAchievement,
                isAnomalyBoss: !!isAnomalyBoss,
                dpnlUrl: dungeonData.dpnlUrl || null,
                dofuspourlesnoobsUrl: dungeonData.dofuspourlesnoobsUrl || null,
                dofensiveUrl: dungeonData.dofensiveUrl || null,
                imageUrl: dungeonData.imageUrl || null,
                dofensiveMonsterName: dungeonData.dofensiveMonsterName || null,
                dofensiveDungeonName: dungeonData.dofensiveDungeonName || null,
                expeditionModes: (dungeonData.expeditionModes || null) as any,
                expeditionMechanics: dungeonData.expeditionMechanics || null,
                achievements: challengeIds || isNoAchievement ? {
                    create: [
                        ...(challengeIds || []).map(challengeId => ({
                            challengeId,
                            points: 10, // Default value
                        })),
                    ]
                } : undefined
            },
            include: {
                achievements: { include: { challenge: true } }
            }
        });

        // Donjon sans succès : rattacher le pseudo-succès « Donjon validé » (créé au besoin).
        if (isNoAchievement) {
            const noAchId = await ensureNoAchievementChallengeId();
            if (noAchId) {
                await db.dungeonAchievement.upsert({
                    where: { dungeonId_challengeId: { dungeonId: dungeon.id, challengeId: noAchId } },
                    update: {},
                    create: { dungeonId: dungeon.id, challengeId: noAchId, points: 10 },
                });
            }
        }
        await logGameDataWrite('create-dungeon', dungeon.id, { name: dungeon.name });

        revalidatePath('/god/game-data');
        revalidatePath('/admin/missions');
        return { success: true, data: dungeon };
    } catch (error: any) {
        logger.error('[createDungeon] Error:', error);
        if (error.code === 'P2002') {
            return { success: false, error: 'Ce donjon existe déjà' };
        }
        return { success: false, error: 'Erreur lors de la création' };
    }
}

export async function updateDungeon(
    id: string,
    data: z.infer<typeof DungeonFormSchema>
): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = DungeonFormSchema.parse(data);
        const { challengeIds, isNoAchievement, isAnomalyBoss, ...dungeonData } = validated;

        // Update dungeon and sync achievements
        const dungeon = await db.$transaction(async (tx) => {
            // Update dungeon basic info
            const updated = await tx.dungeon.update({
                where: { id },
                data: {
                    ...dungeonData,
                    isNoAchievement: !!isNoAchievement,
                    isAnomalyBoss: !!isAnomalyBoss,
                    dpnlUrl: dungeonData.dpnlUrl || null,
                    dofuspourlesnoobsUrl: dungeonData.dofuspourlesnoobsUrl || null,
                    dofensiveUrl: dungeonData.dofensiveUrl || null,
                    imageUrl: dungeonData.imageUrl || null,
                    dofensiveMonsterName: dungeonData.dofensiveMonsterName || null,
                    dofensiveDungeonName: dungeonData.dofensiveDungeonName || null,
                    expeditionModes: (dungeonData.expeditionModes || null) as any,
                    expeditionMechanics: dungeonData.expeditionMechanics || null,
                }
            });

            // Chantier « donjon sans succès » : synchroniser le pseudo-succès « Donjon validé ».
            const noAchId = isNoAchievement ? await ensureNoAchievementChallengeId() : null;
            if (noAchId) {
                await tx.dungeonAchievement.upsert({
                    where: { dungeonId_challengeId: { dungeonId: id, challengeId: noAchId } },
                    update: {},
                    create: { dungeonId: id, challengeId: noAchId, points: 10 },
                });
            } else {
                const existingNoAch = await tx.challenge.findUnique({ where: { slug: NO_ACHIEVEMENT_CHALLENGE_SLUG } });
                if (existingNoAch) {
                    await tx.dungeonAchievement.deleteMany({
                        where: { dungeonId: id, challengeId: existingNoAch.id },
                    });
                }
            }

            // Sync achievements if provided
            if (challengeIds) {
                // Delete removed achievements (jamais le pseudo-succès « Donjon validé » quand isNoAchievement).
                await tx.dungeonAchievement.deleteMany({
                    where: {
                        dungeonId: id,
                        challengeId: { notIn: challengeIds, not: noAchId ?? "__none__" }
                    }
                });

                // Add new achievements
                for (const challengeId of challengeIds) {
                    await tx.dungeonAchievement.upsert({
                        where: {
                            dungeonId_challengeId: { dungeonId: id, challengeId }
                        },
                        update: {},
                        create: { dungeonId: id, challengeId, points: 10 }
                    });
                }
            }

            return tx.dungeon.findUnique({
                where: { id },
                include: { achievements: { include: { challenge: true } } }
            });
        });

        await logGameDataWrite('update-dungeon', id, { name: dungeon?.name });
        revalidatePath('/god/game-data');
        revalidatePath('/admin/missions');
        return { success: true, data: dungeon };
    } catch (error: any) {
        logger.error('[updateDungeon] Error:', error);
        if (error.code === 'P2002') {
            return { success: false, error: 'Ce donjon existe déjà' };
        }
        return { success: false, error: 'Erreur lors de la mise à jour' };
    }
}

export async function deleteDungeon(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await db.dungeon.delete({ where: { id } });
        await logGameDataWrite('delete-dungeon', id);
        revalidatePath('/god/game-data');
        revalidatePath('/admin/missions');
        return { success: true };
    } catch (error: any) {
        logger.error('[deleteDungeon] Error:', error);
        if (error.code === 'P2003') {
            return { success: false, error: 'Impossible de supprimer : des missions sont associées' };
        }
        return { success: false, error: 'Erreur lors de la suppression' };
    }
}

// ===========================
// DREAM BONUSES (Songes)
// ===========================

const DreamBonusSchema = z.object({
    name: z.string().min(1, "Nom requis").max(100),
    type: z.enum(["ACTIF", "PASSIF", "CONSOMMABLE"]).default("ACTIF"),
    description: z.string().optional(),
    imageUrl: z.string().optional().or(z.literal("")),
    costMin: z.number().int().min(0).optional().nullable(),
    costMax: z.number().int().min(0).optional().nullable(),
});

export async function getDreamBonuses(): Promise<ActionResponse<any[]>> {
    try {
        const bonuses = await db.dreamBonus.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
        return { success: true, data: bonuses };
    } catch (error) {
        logger.error('[getDreamBonuses] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des bonus de rêve' };
    }
}

export async function createDreamBonus(data: z.infer<typeof DreamBonusSchema>): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };
    try {
        const validated = DreamBonusSchema.parse(data);
        const bonus = await db.dreamBonus.create({
            data: { ...validated, imageUrl: validated.imageUrl || null }
        });
        revalidatePath('/god/game-data');
        return { success: true, data: bonus };
    } catch (error: any) {
        logger.error('[createDreamBonus] Error:', error);
        if (error.code === 'P2002') return { success: false, error: 'Ce bonus existe déjà' };
        return { success: false, error: 'Erreur lors de la création' };
    }
}

export async function updateDreamBonus(id: string, data: z.infer<typeof DreamBonusSchema>): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };
    try {
        const validated = DreamBonusSchema.parse(data);
        const bonus = await db.dreamBonus.update({
            where: { id },
            data: { ...validated, imageUrl: validated.imageUrl || null }
        });
        revalidatePath('/god/game-data');
        return { success: true, data: bonus };
    } catch (error: any) {
        logger.error('[updateDreamBonus] Error:', error);
        if (error.code === 'P2002') return { success: false, error: 'Ce bonus existe déjà' };
        return { success: false, error: 'Erreur lors de la mise à jour' };
    }
}

export async function deleteDreamBonus(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };
    try {
        await db.dreamBonus.delete({ where: { id } });
        revalidatePath('/god/game-data');
        return { success: true };
    } catch (error: any) {
        logger.error('[deleteDreamBonus] Error:', error);
        return { success: false, error: 'Erreur lors de la suppression' };
    }
}

// ===========================
// GAME QUESTS
// ===========================

const GameQuestSchema = z.object({
    name: z.string().min(1, "Nom requis").max(200),
    dofusDbId: z.number().int().positive().optional().nullable(),
    levelMin: z.number().int().min(1).max(1000).optional().nullable(),
    levelMax: z.number().int().min(1).max(1000).optional().nullable(),
    description: z.string().optional(),
    imageUrl: z.string().optional().or(z.literal("")),
    category: z.string().optional(),
});

export async function getGameQuests(): Promise<ActionResponse<any[]>> {
    try {
        const quests = await db.gameQuest.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
        return { success: true, data: quests };
    } catch (error) {
        logger.error('[getGameQuests] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des quêtes' };
    }
}

export async function createGameQuest(data: z.infer<typeof GameQuestSchema>): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };
    try {
        const validated = GameQuestSchema.parse(data);
        const quest = await db.gameQuest.create({
            data: { ...validated, imageUrl: validated.imageUrl || null }
        });
        revalidatePath('/god/game-data');
        return { success: true, data: quest };
    } catch (error: any) {
        logger.error('[createGameQuest] Error:', error);
        if (error.code === 'P2002') return { success: false, error: 'Cette quête existe déjà' };
        return { success: false, error: 'Erreur lors de la création' };
    }
}

export async function updateGameQuest(id: string, data: z.infer<typeof GameQuestSchema>): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };
    try {
        const validated = GameQuestSchema.parse(data);
        const quest = await db.gameQuest.update({
            where: { id },
            data: { ...validated, imageUrl: validated.imageUrl || null }
        });
        revalidatePath('/god/game-data');
        return { success: true, data: quest };
    } catch (error: any) {
        logger.error('[updateGameQuest] Error:', error);
        if (error.code === 'P2002') return { success: false, error: 'Cette quête existe déjà' };
        return { success: false, error: 'Erreur lors de la mise à jour' };
    }
}

export async function deleteGameQuest(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };
    try {
        await db.gameQuest.delete({ where: { id } });
        revalidatePath('/god/game-data');
        return { success: true };
    } catch (error: any) {
        logger.error('[deleteGameQuest] Error:', error);
        return { success: false, error: 'Erreur lors de la suppression' };
    }
}

// ===========================
// GAME QUESTS — SIPHON DOFUSDB (#154)
// ===========================

/**
 * 🧲 #154 — Siphonne des quêtes depuis l'API DofusDB vers la table locale GameQuest.
 * Elles deviennent alors réutilisables dans les posts DJ/quêtes (recherche locale d'abord,
 * fallback dofusdb ensuite via `searchGameQuests`/`dofus-search-actions`).
 *
 * Anti-doublons : les quêtes déjà présentes (par dofusDbId ou par nom) sont ignorées.
 * Bornage : 10 ≤ limit ≤ 300 par clic (appel paginé en tâches de 50).
 */
export async function siphonQuestsFromDofusDB(limit = 100): Promise<ActionResponse<{
    created: number;
    skipped: number;
    errors: number;
}>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    const capped = Math.min(500, Math.max(10, Math.round(limit) || 100));

    try {
        let created = 0;
        let skipped = 0;
        let errors = 0;
        let skip = 0;
        const pageSize = 50;
        let totalRemote = Infinity;

        while (created < capped && skip < totalRemote) {
            const take = pageSize;
            // DofusDB pagine via `$limit`/`$skip`. On pagine continuellement jusqu'à importer
            // `capped` NOUVELLES quêtes ou atteindre la fin de l'API DofusDB.
            const res = await fetch(`https://api.dofusdb.fr/quests?$limit=${take}&$skip=${skip}`, {
                headers: { Accept: "application/json" },
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
                // DofusDB indisponible → on s'arrête proprement (fail-stop, sans casser l'existant).
                logger.error(`[siphonQuestsFromDofusDB] DofusDB HTTP ${res.status}`);
                break;
            }

            const json = await res.json();
            if (typeof json?.total === "number") totalRemote = json.total;
            const data: any[] = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);

            if (data.length === 0) break;

            for (const q of data) {
                if (created >= capped) break;

                const dofusDbId = Number(q?.id) || null;
                const name = String(q?.name?.fr || q?.name || q?.className || "").trim();
                if (!name) { errors++; continue; }

                const existingById = dofusDbId
                    ? await db.gameQuest.findFirst({ where: { dofusDbId }, select: { id: true } })
                    : null;
                if (existingById) { skipped++; continue; }

                const existingByName = await db.gameQuest.findUnique({ where: { name }, select: { id: true } });
                if (existingByName) { skipped++; continue; }

                try {
                    await db.gameQuest.create({
                        data: {
                            name,
                            dofusDbId,
                            levelMin: Number(q?.levelMin) || null,
                            levelMax: Number(q?.levelMax) || null,
                            description: q?.description?.fr || q?.description || null,
                            imageUrl: q?.img || null,
                            category: String(q?.category?.name?.fr || "DofusDB").slice(0, 60),
                        },
                    });
                    created++;
                } catch (e: any) {
                    if (e?.code === "P2002") { skipped++; continue; }
                    errors++;
                }
            }

            skip += data.length;

            // Fin de pagination : DofusDB a renvoyé moins d'éléments que demandés.
            if (data.length < take) break;
        }

        if (created > 0) revalidatePath('/god/game-data');
        return { success: true, data: { created, skipped, errors } };
    } catch (error: any) {
        logger.error('[siphonQuestsFromDofusDB] Error:', error);
        return { success: false, error: error?.message || 'Erreur lors du siphonnage des quêtes' };
    }
}

/**
 * Action d'administration (GOD) pour déclencher le siphonnage intégral
 * des donjons, monstres de salles et familles de boss DofusDB.
 * Met à jour public/game-data/dungeon-monsters.json.
 */
export async function siphonDungeonMonstersDatasetAction(): Promise<ActionResponse<{
    totalDungeons: number;
    totalMonsters: number;
    totalBossFamilies: number;
}>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const { siphonDungeonMonstersDataset } = await import("@/lib/dungeon-monsters-siphon");
        const result = await siphonDungeonMonstersDataset();
        revalidatePath('/god/game-data');
        return { success: true, data: result };
    } catch (error: any) {
        logger.error('[siphonDungeonMonstersDatasetAction] Error:', error);
        return { success: false, error: error?.message || 'Erreur lors du siphonnage des monstres et donjons' };
    }
}

// 🛡️ Fail-closed : super-admin OU sous-god avec la brique « game-data » **ou** la brique
// ciblée « game-data-bounties » (même règle que `canAccessBounties` dans game-data-actions) :
// un délégué « avis de recherche » peut siphonner sans avoir tout le module de données.
async function requireGameDataBounties(): Promise<string | null> {
    const session = await auth();
    if (!session?.user?.id) return null;

    if (await isSuperAdmin()) return session.user.id;
    if (await canAccessBrick("game-data")) return session.user.id;
    if (await canAccessBrick("game-data-bounties")) return session.user.id;

    return null;
}

/**
 * Action d'administration (GOD) — **siphon des avis de recherche**.
 *
 * Source de vérité : DofusDB (`monster-races/32|90|127|147|156` = 96 avis) + Dofensive
 * (`/monsters/{id}` : preuve d'appartenance, zone de traque, sorts de combat). Écrit la ligne
 * `Bounty` (**par `dofusdbId`**), la fiche `MonsterStat` et les icônes. Idempotent : relançable.
 */
export async function siphonBountiesAction(): Promise<ActionResponse<{
    synced: number;
    unchanged: number;
    total: number;
    unproven: number;
    images: number;
    errors: number;
    perRace: Record<string, number>;
}>> {
    const userId = await requireGameDataBounties();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const { syncBounties } = await import("@/lib/bounty-siphon");
        const result = await syncBounties();
        await logGameDataWrite("siphon-bounties", `synced-${result.synced}`, {
            total: result.entries.length,
            unproven: result.unproven,
            errors: result.errors.length,
        });
        revalidatePath('/god/game-data');
        revalidatePath('/god/game-data/bounties');
        return {
            success: true,
            data: {
                synced: result.synced,
                unchanged: result.unchanged,
                total: result.entries.length,
                unproven: result.unproven,
                images: result.imagesSiphoned,
                errors: result.errors.length,
                perRace: result.perRace,
            },
        };
    } catch (error: any) {
        logger.error('[siphonBountiesAction] Error:', error);
        return { success: false, error: error?.message || 'Erreur lors du siphon des avis de recherche' };
    }
}


// ===========================
// DUNGEON ACHIEVEMENTS (Manual management)
// ===========================

export async function addDungeonAchievement(
    dungeonId: string,
    challengeId: string,
    points: number = 10
): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const achievement = await db.dungeonAchievement.create({
            data: { dungeonId, challengeId, points },
            include: { challenge: true, dungeon: true }
        });

        revalidatePath('/god/game-data');
        return { success: true, data: achievement };
    } catch (error: any) {
        logger.error('[addDungeonAchievement] Error:', error);
        if (error.code === 'P2002') {
            return { success: false, error: 'Ce succès est déjà associé à ce donjon' };
        }
        return { success: false, error: 'Erreur lors de l\'ajout' };
    }
}

export async function removeDungeonAchievement(
    dungeonId: string,
    challengeId: string
): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await db.dungeonAchievement.delete({
            where: { dungeonId_challengeId: { dungeonId, challengeId } }
        });

        revalidatePath('/god/game-data');
        return { success: true };
    } catch (error) {
        logger.error('[removeDungeonAchievement] Error:', error);
        return { success: false, error: 'Erreur lors de la suppression' };
    }
}

export async function updateDungeonAchievementPoints(
    dungeonId: string,
    challengeId: string,
    points: number
): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const achievement = await db.dungeonAchievement.update({
            where: { dungeonId_challengeId: { dungeonId, challengeId } },
            data: { points }
        });

        revalidatePath('/god/game-data');
        return { success: true, data: achievement };
    } catch (error) {
        logger.error('[updateDungeonAchievementPoints] Error:', error);
        return { success: false, error: 'Erreur lors de la mise à jour' };
    }
}

// ===========================
// ZONES
// ===========================

const ZoneSchema = z.object({
    name: z.string().min(1, "Nom requis").max(100),
    level: z.number().min(1, "Niveau invalide").max(200),
    dpnlUrl: z.string().url("URL invalide").optional().or(z.literal("")),
    familyIds: z.array(z.string()).optional(),
    dungeonIds: z.array(z.string()).optional(),
});

export async function createZone(
    data: z.infer<typeof ZoneSchema>
): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = ZoneSchema.parse(data);
        const zone = await db.zone.create({
            data: {
                name: validated.name,
                level: validated.level,
                dpnlUrl: validated.dpnlUrl || null,
                families: validated.familyIds && validated.familyIds.length > 0 ? {
                    connect: validated.familyIds.map((id) => ({ id }))
                } : undefined,
                dungeons: validated.dungeonIds && validated.dungeonIds.length > 0 ? {
                    connect: validated.dungeonIds.map((id) => ({ id }))
                } : undefined,
            },
            include: {
                families: true,
                dungeons: true
            }
        });
        await logGameDataWrite('create-zone', zone.id, { name: zone.name });

        revalidatePath('/god/game-data');
        return { success: true, data: zone };
    } catch (error: any) {
        logger.error('[createZone] Error:', error);
        if (error.code === 'P2002') {
            return { success: false, error: 'Cette zone existe déjà' };
        }
        return { success: false, error: 'Erreur lors de la création' };
    }
}

export async function updateZone(
    id: string,
    data: z.infer<typeof ZoneSchema>
): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const validated = ZoneSchema.parse(data);
        const zone = await db.zone.update({
            where: { id },
            data: {
                name: validated.name,
                level: validated.level,
                dpnlUrl: validated.dpnlUrl || null,
                families: validated.familyIds ? {
                    set: validated.familyIds.map((id) => ({ id }))
                } : undefined,
                dungeons: validated.dungeonIds ? {
                    set: validated.dungeonIds.map((id) => ({ id }))
                } : undefined,
            },
            include: {
                families: true,
                dungeons: true
            }
        });
        await logGameDataWrite('update-zone', id, { name: zone.name });

        revalidatePath('/god/game-data');
        return { success: true, data: zone };
    } catch (error: any) {
        logger.error('[updateZone] Error:', error);
        return { success: false, error: 'Erreur lors de la mise à jour' };
    }
}

export async function deleteZone(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const target = await db.zone.findUnique({
            where: { id },
            select: { name: true }
        });
        if (target?.name) {
            addIgnoredZone(target.name);
        }
        await db.zone.delete({ where: { id } });
        await logGameDataWrite('delete-zone', id);
        revalidatePath('/god/game-data');
        return { success: true };
    } catch (error: any) {
        logger.error('[deleteZone] Error:', error);
        return { success: false, error: 'Erreur lors de la suppression' };
    }
}

// ===========================
// SEARCH & UTILS (For optimizations)
// ===========================

export async function searchZones(query: string = ""): Promise<ActionResponse<any[]>> {
    try {
        const zones = await db.zone.findMany({
            where: {
                name: { contains: query, mode: 'insensitive' }
            },
            include: {
                families: true,
                dungeons: true
            },
            take: 20,
            orderBy: { name: 'asc' }
        });
        return { success: true, data: zones };
    } catch (error) {
        logger.error('[searchZones] Error:', error);
        return { success: false, error: 'Erreur recherche zones' };
    }
}

export async function searchDungeons(query: string = ""): Promise<ActionResponse<any[]>> {
    try {
        const dungeons = await db.dungeon.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { bossName: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 20,
            orderBy: { level: 'desc' }
        });
        return { success: true, data: dungeons };
    } catch (error) {
        logger.error('[searchDungeons] Error:', error);
        return { success: false, error: 'Erreur recherche donjons' };
    }
}

export async function getAdminZones(
    filters: z.infer<typeof CommonFilterSchema> = {}
): Promise<ActionResponse<any[]>> {
    try {
        const validated = CommonFilterSchema.parse(filters);
        const whereClause: any = {};

        if (validated.search) {
            whereClause.name = { contains: validated.search, mode: 'insensitive' };
        }

        if (validated.minLevel !== undefined || validated.maxLevel !== undefined) {
            const levelFilter: any = {};
            if (typeof validated.minLevel === 'number') levelFilter.gte = validated.minLevel;
            if (typeof validated.maxLevel === 'number') levelFilter.lte = validated.maxLevel;
            if (Object.keys(levelFilter).length > 0) whereClause.level = levelFilter;
        }

        const zones = await db.zone.findMany({
            where: whereClause,
            include: {
                families: true,
                dungeons: true
            },
            orderBy: { name: 'asc' }
        });
        return { success: true, data: zones };
    } catch (error) {
        logger.error('[getAdminZones] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des zones' };
    }
}

// ===========================
// EXPORT / IMPORT (for beta/prod sync)
// ===========================

/**
 * Export all game data as JSON for cross-environment sync.
 * Includes: zones, families (with monsters), challenges, dungeons (with achievements).
 * IDs are exported for reference but the import uses name-based matching,
 * so the same export can be imported into any environment safely.
 */
export async function exportGameData(): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const [zones, families, challenges, dungeons] = await Promise.all([
            db.zone.findMany({ orderBy: { name: 'asc' } }),
            db.monsterFamily.findMany({
                include: {
                    monsters: true,
                    zones: { select: { id: true, name: true } }
                },
                orderBy: { name: 'asc' }
            }),
            db.challenge.findMany({ orderBy: { name: 'asc' } }),
            db.dungeon.findMany({
                include: {
                    achievements: {
                        include: { challenge: { select: { name: true, slug: true } } }
                    }
                },
                orderBy: { level: 'asc' }
            }),
        ]);

        const exportData = {
            version: "3.0",
            exportedAt: new Date().toISOString(),
            exportedBy: userId,
            data: {
                zones,
                families: families.map(f => ({
                    ...f,
                    zoneNames: f.zones?.map(z => z.name) || [],
                    zones: undefined,
                })),
                challenges,
                dungeons: dungeons.map(d => ({
                    ...d,
                    achievements: d.achievements.map(a => ({
                        ...a,
                        // Include challenge name for cross-env resolution
                        challengeName: a.challenge?.name || null,
                        challengeSlug: a.challenge?.slug || null,
                        challenge: undefined,
                    })),
                })),
            }
        };

        return { success: true, data: exportData };
    } catch (error) {
        logger.error('[exportGameData] Error:', error);
        return { success: false, error: 'Erreur lors de l\'export' };
    }
}

/**
 * Export game data directly to Git seed file
 * Safe for use in development environment only
 */
export async function exportGameDataToGit(): Promise<ActionResponse<string>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    // Security: Only allow in development
    if (process.env.NODE_ENV === 'production') {
        return { success: false, error: "Cette fonction n'est disponible qu'en développement" };
    }

    try {
        const result = await exportGameData();
        if (!result.success || !result.data) {
            return { success: false, error: result.error || 'Erreur export' };
        }

        // Write to seed file
        const seedFilePath = join(process.cwd(), 'prisma', 'seed-data', 'game-data.json');
        writeFileSync(seedFilePath, JSON.stringify(result.data, null, 2), 'utf-8');

        const d = result.data.data;
        return {
            success: true,
            data: `Export réussi ! Fichier sauvegardé dans prisma/seed-data/game-data.json\n\n` +
                `Zones: ${d.zones?.length || 0} | Familles: ${d.families?.length || 0} | ` +
                `Challenges: ${d.challenges?.length || 0} | Donjons: ${d.dungeons?.length || 0}\n\n` +
                `💡 Commit ce fichier dans Git pour versionner tes données !`
        };
    } catch (error: any) {
        logger.error('[exportGameDataToGit] Error:', error);
        return { success: false, error: `Erreur: ${error.message}` };
    }
}

/**
 * Import game data from JSON export. Handles cross-environment ID differences.
 * 
 * Strategy:
 *  - All entities are matched by their NATURAL KEY (name, name+bossName, etc.)
 *  - IDs from the source are remapped to the target DB's IDs
 *  - Cross-references (e.g. dungeon→challenge achievements) use remapped IDs
 *  - Entire import runs in a transaction for atomicity (safe for hot imports)
 *  - Supports both v2.0 and v3.0 export formats
 */
export async function importGameData(jsonData: string): Promise<ActionResponse<string>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const parsed = JSON.parse(jsonData);

        if (!parsed.version || !parsed.data) {
            return { success: false, error: 'Format de fichier invalide' };
        }

        const stats = { zones: 0, families: 0, challenges: 0, dungeons: 0, achievements: 0, skipped: 0 };
        const warnings: string[] = [];

        await db.$transaction(async (tx) => {
            // ============================
            // PHASE 1: Import Zones
            // ============================
            const zoneIdMap = new Map<string, string>(); // oldId → newId

            if (parsed.data.zones) {
                for (const zone of parsed.data.zones) {
                    const existing = await tx.zone.findUnique({ where: { name: zone.name } });

                    if (existing) {
                        await tx.zone.update({
                            where: { id: existing.id },
                            data: {
                                level: zone.level,
                                dpnlUrl: zone.dpnlUrl || null,
                            }
                        });
                        zoneIdMap.set(zone.id, existing.id);
                    } else {
                        const created = await tx.zone.create({
                            data: {
                                name: zone.name,
                                level: zone.level,
                                dpnlUrl: zone.dpnlUrl || null,
                            }
                        });
                        zoneIdMap.set(zone.id, created.id);
                    }
                    stats.zones++;
                }
            }

            // ============================
            // PHASE 2: Import Challenges
            // ============================
            const challengeIdMap = new Map<string, string>(); // oldId → newId

            if (parsed.data.challenges) {
                for (const challenge of parsed.data.challenges) {
                    // Find by name (natural unique key) — slug as fallback
                    const existing = await tx.challenge.findFirst({
                        where: {
                            OR: [
                                { name: challenge.name },
                                ...(challenge.slug ? [{ slug: challenge.slug }] : []),
                            ]
                        }
                    });

                    const slug = challenge.slug || challenge.name.toLowerCase()
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

                    if (existing) {
                        await tx.challenge.update({
                            where: { id: existing.id },
                            data: {
                                description: challenge.description,
                                iconUrl: challenge.iconUrl,
                                conditions: challenge.conditions || undefined,
                                slug: slug,
                            }
                        });
                        challengeIdMap.set(challenge.id, existing.id);
                    } else {
                        const created = await tx.challenge.create({
                            data: {
                                name: challenge.name,
                                slug: slug,
                                description: challenge.description,
                                iconUrl: challenge.iconUrl,
                                conditions: challenge.conditions || undefined,
                            }
                        });
                        challengeIdMap.set(challenge.id, created.id);
                    }
                    stats.challenges++;
                }
            }

            // ============================
            // PHASE 3: Import Families
            // ============================
            const familyIdMap = new Map<string, string>(); // oldId → newId

            if (parsed.data.families) {
                for (const family of parsed.data.families) {
                    const trimmedName = family.name.trim();
                    const existing = await tx.monsterFamily.findFirst({
                        where: { name: { equals: trimmedName, mode: 'insensitive' } }
                    });

                    if (existing) {
                        await tx.monsterFamily.update({
                            where: { id: existing.id },
                            data: {
                                level: family.level || null,
                                description: family.description || null,
                                imageUrl: family.imageUrl || null,
                            }
                        });
                        familyIdMap.set(family.id, existing.id);
                    } else {
                        const created = await tx.monsterFamily.create({
                            data: {
                                name: trimmedName,
                                level: family.level || null,
                                description: family.description || null,
                                imageUrl: family.imageUrl || null,
                            }
                        });
                        familyIdMap.set(family.id, created.id);
                    }

                    // Link to zones (v3.0 format: zoneNames)
                    const resolvedFamilyId = familyIdMap.get(family.id);
                    if (resolvedFamilyId && family.zoneNames && Array.isArray(family.zoneNames)) {
                        const zoneRecords = await tx.zone.findMany({
                            where: { name: { in: family.zoneNames } },
                            select: { id: true }
                        });
                        if (zoneRecords.length > 0) {
                            await tx.monsterFamily.update({
                                where: { id: resolvedFamilyId },
                                data: { zones: { set: zoneRecords.map(z => ({ id: z.id })) } }
                            });
                        }
                    }

                    stats.families++;
                }
            }

            // ============================
            // PHASE 4: Import Dungeons + Achievements
            // ============================
            if (parsed.data.dungeons) {
                for (const dungeon of parsed.data.dungeons) {
                    // Find by composite natural key: name + bossName
                    const existing = await tx.dungeon.findFirst({
                        where: { name: dungeon.name, bossName: dungeon.bossName }
                    });

                    let dungeonId: string;

                    if (existing) {
                        await tx.dungeon.update({
                            where: { id: existing.id },
                            data: {
                                level: dungeon.level,
                                dpnlUrl: dungeon.dpnlUrl || null,
                                imageUrl: dungeon.imageUrl || null,
                                isExpedition: dungeon.isExpedition ?? false,
                                expeditionModes: dungeon.expeditionModes || null,
                                expeditionMechanics: dungeon.expeditionMechanics || null,
                                isOcreQuest: dungeon.isOcreQuest ?? false,
                                mapId: dungeon.mapId ?? null,
                            }
                        });
                        dungeonId = existing.id;
                    } else {
                        const created = await tx.dungeon.create({
                            data: {
                                name: dungeon.name,
                                bossName: dungeon.bossName,
                                level: dungeon.level,
                                dpnlUrl: dungeon.dpnlUrl || null,
                                imageUrl: dungeon.imageUrl || null,
                                isExpedition: dungeon.isExpedition ?? false,
                                expeditionModes: dungeon.expeditionModes || null,
                                expeditionMechanics: dungeon.expeditionMechanics || null,
                                isOcreQuest: dungeon.isOcreQuest ?? false,
                                mapId: dungeon.mapId ?? null,
                            }
                        });
                        dungeonId = created.id;
                    }

                    // Import achievements with ID remapping
                    if (dungeon.achievements && Array.isArray(dungeon.achievements)) {
                        for (const ach of dungeon.achievements) {
                            // Resolve challengeId: try ID map first, then name/slug lookup
                            let resolvedChallengeId = challengeIdMap.get(ach.challengeId);

                            if (!resolvedChallengeId) {
                                // v3.0: use embedded challengeName/challengeSlug
                                // v2.0: lookup directly by old challengeId
                                const challengeLookup = await tx.challenge.findFirst({
                                    where: {
                                        OR: [
                                            ...(ach.challengeName ? [{ name: ach.challengeName }] : []),
                                            ...(ach.challengeSlug ? [{ slug: ach.challengeSlug }] : []),
                                            { id: ach.challengeId }, // last resort: same ID
                                        ]
                                    }
                                });

                                if (challengeLookup) {
                                    resolvedChallengeId = challengeLookup.id;
                                } else {
                                    warnings.push(`⚠️ Challenge introuvable pour succès donjon "${dungeon.name}" (challengeId: ${ach.challengeId})`);
                                    stats.skipped++;
                                    continue;
                                }
                            }

                            // Upsert the achievement
                            const existingAch = await tx.dungeonAchievement.findUnique({
                                where: {
                                    dungeonId_challengeId: {
                                        dungeonId: dungeonId,
                                        challengeId: resolvedChallengeId
                                    }
                                }
                            });

                            if (existingAch) {
                                await tx.dungeonAchievement.update({
                                    where: { id: existingAch.id },
                                    data: { points: ach.points || 10 }
                                });
                            } else {
                                await tx.dungeonAchievement.create({
                                    data: {
                                        dungeonId: dungeonId,
                                        challengeId: resolvedChallengeId,
                                        points: ach.points || 10,
                                    }
                                });
                            }
                            stats.achievements++;
                        }
                    }

                    stats.dungeons++;
                }
            }
        }, { timeout: 60000 }); // 60s timeout for large imports

        await logGameDataWrite('import-game-data');
        revalidatePath('/god/game-data');
        revalidatePath('/admin/missions');

        const summary = [
            `✅ Import terminé avec succès !`,
            ``,
            `📊 Résumé :`,
            stats.zones > 0 ? `  • Zones : ${stats.zones}` : null,
            `  • Familles : ${stats.families}`,
            `  • Challenges : ${stats.challenges}`,
            `  • Donjons : ${stats.dungeons}`,
            stats.achievements > 0 ? `  • Succès donjons : ${stats.achievements}` : null,
            stats.skipped > 0 ? `  • ⚠️ Ignorés : ${stats.skipped}` : null,
            ...warnings,
        ].filter(Boolean).join('\n');

        return { success: true, data: summary };
    } catch (error: any) {
        logger.error('[importGameData] Error:', error);

        // Provide user-friendly error messages
        if (error.code === 'P2002') {
            const field = error.meta?.target?.join(', ') || 'unknown';
            return { success: false, error: `Conflit de données : le champ (${field}) existe déjà avec une valeur différente. Vérifiez les données du fichier.` };
        }

        return { success: false, error: `Erreur lors de l'import: ${error.message}` };
    }
}
