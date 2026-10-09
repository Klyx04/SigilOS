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
import { resolveUniqueDungeonSlug } from "@/server/game/dungeon-slug";
import { bossSlugWithFallback } from "@/lib/boss-slug";
import { questMapImageUrl, questStartMapId } from "@/lib/dungeon-finder-utils";
import { buildGameQuestWhere, gameQuestPageWindow, type GameQuestFilters } from "@/lib/game-quests-filter";
import type { Prisma } from "@prisma/client";
import { NO_ACHIEVEMENT_CHALLENGE_SLUG, ensureNoAchievementChallengeId } from "@/lib/dungeon-no-achievement";
import { addIgnoredBounty, getIgnoredBounties, removeIgnoredBounty, type IgnoredBountyEntry } from "@/lib/bounty-ignore";
import {
    addIgnoredChallenge,
    addIgnoredDungeon,
    getIgnoredChallenges,
    getIgnoredDungeons,
    isIgnoredChallenge,
    isIgnoredDungeon,
    removeIgnoredChallenge,
    removeIgnoredDungeon,
    type IgnoredDungeonEntry,
} from "@/lib/game-data-ignores";

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
    /* Slug d'URL publique (`/boss/<slug>`) : optionnel. Vide ⇒ généré depuis le
       nom du boss à la création, et **inchangé** à la modification (une URL
       publiée ne doit pas bouger toute seule : les anciens slugs/ids restent
       servis en 308, mais on ne casse pas un lien indexé sans raison). */
    slug: z.string().max(150).optional().or(z.literal("")),
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
    /* Chantier « boss de raid » : coché en God. */
    isRaidBoss: z.boolean().default(false),
    raidId: z.string().optional().or(z.literal("")),
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
        // Créer à la main un succès précédemment supprimé lève son exclusion (anti-résurrection).
        removeIgnoredChallenge(challenge.slug);

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
        // Éditer un succès lève son exclusion (le God l'a réintégré explicitement).
        removeIgnoredChallenge(challenge.slug);

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
        /* 🛡️ Anti-résurrection : on lit AVANT de supprimer pour mémoriser ce que le God refuse
           (le seed de déploiement et les garanties de pseudo-succès respectent cette liste). */
        const target = await db.challenge.findUnique({ where: { id }, select: { slug: true, name: true } });
        await db.challenge.delete({ where: { id } });
        if (target?.slug) addIgnoredChallenge(target.slug, target.name);
        await logGameDataWrite('delete-challenge', id, { slug: target?.slug, name: target?.name });
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
        const { challengeIds, isNoAchievement, isAnomalyBoss, isRaidBoss, raidId, ...dungeonData } = validated;

        // Slug public `/boss/<slug>` : slugifié, et suffixé automatiquement s'il est
        // déjà pris (« minotoror », « minotoror-2 »).
        const slug = await resolveUniqueDungeonSlug(dungeonData.slug?.trim() || dungeonData.bossName);

        // Chantier double boss : conversion '' → null pour les champs de résolution Dofensive.
        const dungeon = await db.dungeon.create({
            data: {
                ...dungeonData,
                slug,
                isNoAchievement: !!isNoAchievement,
                isAnomalyBoss: !!isAnomalyBoss,
                isRaidBoss: !!isRaidBoss,
                raidId: raidId || null,
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
        // Créer à la main un donjon précédemment supprimé lève son exclusion (anti-résurrection).
        removeIgnoredDungeon({ name: dungeon.name, bossName: dungeon.bossName });

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
        const { challengeIds, isNoAchievement, isAnomalyBoss, isRaidBoss, raidId, ...dungeonData } = validated;

        // Update dungeon and sync achievements
        const dungeon = await db.$transaction(async (tx) => {
            // Slug d'URL : une valeur explicite est slugifiée et rendue unique ;
            // sinon le slug existant est **conservé** (l'URL publiée ne bouge pas
            // quand on corrige un nom, ou alors 308 dans l'autre sens).
            const requestedSlug = dungeonData.slug?.trim();
            const { slug: _requestedSlug, ...restDungeonData } = dungeonData;
            const slugUpdate = requestedSlug
                ? { slug: await resolveUniqueDungeonSlug(requestedSlug, { excludeId: id, client: tx }) }
                : {};

            // Update dungeon basic info
            const updated = await tx.dungeon.update({
                where: { id },
                data: {
                    ...restDungeonData,
                    ...slugUpdate,
                    isNoAchievement: !!isNoAchievement,
                    isAnomalyBoss: !!isAnomalyBoss,
                    isRaidBoss: !!isRaidBoss,
                    raidId: raidId || null,
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
        // Éditer un donjon lève son exclusion (le God l'a réintégré explicitement).
        if (dungeon) removeIgnoredDungeon({ name: dungeon.name, bossName: dungeon.bossName });
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
        /* 🛡️ Anti-résurrection : on lit AVANT de supprimer pour mémoriser ce que le God refuse —
           sans quoi le seed de déploiement et le siphon d'anomalie le recréaient. */
        const target = await db.dungeon.findUnique({
            where: { id },
            select: { name: true, bossName: true, slug: true, dofusdbId: true },
        });
        await db.dungeon.delete({ where: { id } });
        if (target) addIgnoredDungeon(target);
        await logGameDataWrite('delete-dungeon', id, { name: target?.name, bossName: target?.bossName });
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

/** Donjons supprimés (exclus du seed et du siphon) — affichés dans l'éditeur avec « Restaurer ». */
export async function getIgnoredDungeonsAction(): Promise<ActionResponse<{ entries: IgnoredDungeonEntry[] }>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };
    return { success: true, data: { entries: getIgnoredDungeons() } };
}

/** Réintègre un donjon exclu (le prochain seed/siphon peut alors le recréer). */
export async function restoreDungeonAction(input: {
    name: string;
    bossName: string;
}): Promise<ActionResponse<{ entries: IgnoredDungeonEntry[] }>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    const name = String(input?.name ?? "").trim();
    const bossName = String(input?.bossName ?? "").trim();
    if (!name || !bossName) return { success: false, error: "Donjon invalide" };

    try {
        const entries = removeIgnoredDungeon({ name, bossName });
        await logGameDataWrite('restore-dungeon', `${name} / ${bossName}`);
        revalidatePath('/god/game-data');
        revalidatePath('/admin/missions');
        return { success: true, data: { entries } };
    } catch (error: any) {
        logger.error('[restoreDungeonAction] Error:', error);
        return { success: false, error: 'Erreur lors de la restauration' };
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

/** 🎛️ Filtres + page de la liste des quêtes — bornés (jamais fait confiance au client). */
const GameQuestListSchema = z.object({
    search: z.string().trim().max(120).optional().default(''),
    category: z.string().trim().max(120).optional().default(''),
    levelMin: z.number().int().min(1).max(1000).nullable().optional().default(null),
    levelMax: z.number().int().min(1).max(1000).nullable().optional().default(null),
    source: z.enum(['ALL', 'DOFUSDB', 'MANUAL']).optional().default('ALL'),
    page: z.number().int().min(0).max(1000).optional().default(0),
});

export interface GameQuestListRow {
    id: string;
    name: string;
    dofusDbId: number | null;
    levelMin: number | null;
    levelMax: number | null;
    description: string | null;
    imageUrl: string | null;
    category: string | null;
}

export interface GameQuestListPage {
    quests: GameQuestListRow[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    /** Compteurs **réels** par catégorie, sous le filtre courant (jamais « 48 » pour 300). */
    counts: { category: string; count: number }[];
    /** Toutes les catégories existantes — remplit le sélecteur sans être tronquée par la page. */
    categories: string[];
}

/**
 * 🎒 Liste **paginée** des quêtes du panneau God.
 *
 * 🐛 Avant (mesure 10/10/2026) : `findMany` sans `select` ni `take` ⇒ ~2 000 quêtes et leur
 * `contentJson` dans le navigateur, une carte + une image peintes par quête. Les filtres, eux,
 * étaient calculés côté client : ils ne voyaient que ce qui était chargé. Ici : filtres **serveur**
 * (`buildGameQuestWhere`, module pur) + une page bornée (`GAME_QUESTS_PAGE_SIZE`), et des
 * compteurs par catégorie pour que l'en-tête de groupe dise le **vrai** total.
 */
export async function getGameQuests(raw: unknown = {}): Promise<ActionResponse<GameQuestListPage>> {
    try {
        if (!(await isSuperAdmin()) && !(await canAccessBrick('game-data'))) {
            return { success: false, error: 'Non autorisé' };
        }
        const parsed = GameQuestListSchema.safeParse(raw ?? {});
        if (!parsed.success) {
            return { success: false, error: 'Filtres invalides' };
        }
        const filters: GameQuestFilters = parsed.data;
        const where = buildGameQuestWhere(filters) as Prisma.GameQuestWhereInput;
        const { skip, take } = gameQuestPageWindow(filters.page);

        const [total, rows, grouped, allGrouped] = await Promise.all([
            db.gameQuest.count({ where }),
            db.gameQuest.findMany({
                where,
                orderBy: [{ category: 'asc' }, { name: 'asc' }],
                skip,
                take,
                // `contentJson` / `contentHash` sont volontairement **absents** : c'est le contenu
                // des étapes (~Ko par quête), inutile à une liste — c'est lui qui alourdissait la
                // réponse d'un facteur important.
                select: {
                    id: true,
                    name: true,
                    dofusDbId: true,
                    levelMin: true,
                    levelMax: true,
                    description: true,
                    imageUrl: true,
                    category: true,
                },
            }),
            db.gameQuest.groupBy({
                by: ['category'],
                where,
                _count: { _all: true },
                orderBy: { category: 'asc' },
            }),
            db.gameQuest.groupBy({
                by: ['category'],
                _count: { _all: true },
                orderBy: { category: 'asc' },
            }),
        ]);

        return {
            success: true,
            data: {
                quests: rows,
                total,
                page: filters.page,
                pageSize: take,
                hasMore: skip + rows.length < total,
                counts: grouped.map((g) => ({ category: g.category ?? 'Non classé', count: g._count._all })),
                categories: allGrouped
                    .map((g) => g.category)
                    .filter((c): c is string => typeof c === 'string' && c.trim() !== ''),
            },
        };
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
                            // 🖼️ Vrai visuel de la quête : la **carte de départ** DofusDB
                            // (`startPosition[].mapId`), servie par le dépôt en tuile du jeu.
                            // ⚠️ Mesure du 27/09/2026 : `/quests` **n'expose aucune image** — le
                            // `q?.img` d'avant n'existait pas, d'où 0/1 976 visuels en base.
                            imageUrl: questMapImageUrl(questStartMapId(q?.startPosition)),
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
    // Garde DANS le try : une exception du guard (session, DB) hors try remonte
    // en "An unexpected response was received from the server" côté client.
    try {
        const userId = await requireSuperAdmin();
        if (!userId) return { success: false, error: "Accès refusé" };

        const { siphonDungeonMonstersDataset } = await import("@/lib/dungeon-monsters-siphon");
        const result = await siphonDungeonMonstersDataset();
        revalidatePath('/god/game-data');
        return { success: true, data: result };
    } catch (error: any) {
        logger.error('[siphonDungeonMonstersDatasetAction] Error:', error);
        return { success: false, error: error?.message || 'Erreur lors du siphonnage des monstres et donjons' };
    }
}

// 🛡️ Fail-closed : super-admin OU sous-god avec la brique « game-data » — les avis de
// recherche sont un éditeur de cette interface (fusion D-4) : plus de brique ciblée
// « game-data-bounties » (un délégué qui ne l'avait que doit recevoir `game-data`).
async function requireGameDataBounties(): Promise<string | null> {
    const session = await auth();
    if (!session?.user?.id) return null;

    if (await isSuperAdmin()) return session.user.id;
    if (await canAccessBrick("game-data")) return session.user.id;

    return null;
}

/**
 * Siphon d'UNE race d'avis (journal temps réel côté God : 5 appels courts au
 * lieu d'un seul appel de 60 s+ sujet aux coupures/timeout). Même garde et
 * même idempotence que la passe complète.
 */
export async function siphonBountiesRaceAction(raceId: number): Promise<ActionResponse<{
    raceId: number;
    raceName: string;
    synced: number;
    unchanged: number;
    total: number;
    unproven: number;
    images: number;
    gradesBackfilled: number;
    dropsBackfilled: number;
    errors: string[];
}>> {
    try {
        const userId = await requireGameDataBounties();
        if (!userId) return { success: false, error: "Accès refusé" };

        const id = Math.floor(Number(raceId) || 0);
        const { BOUNTY_RACE_IDS, BOUNTY_RACE_NAMES } = await import("@/lib/bounty");
        if (!(BOUNTY_RACE_IDS as readonly number[]).includes(id)) {
            return { success: false, error: `Race inconnue : ${raceId}` };
        }

        const { syncBounties } = await import("@/lib/bounty-siphon");
        const result = await syncBounties([id]);
        await logGameDataWrite("siphon-bounties-race", `race-${id}-synced-${result.synced}`, {
            total: result.entries.length,
            unproven: result.unproven,
            errors: result.errors.length,
        });
        revalidatePath('/god/game-data');
        return {
            success: true,
            data: {
                raceId: id,
                raceName: BOUNTY_RACE_NAMES[id] ?? `Race ${id}`,
                synced: result.synced,
                unchanged: result.unchanged,
                total: result.entries.length,
                unproven: result.unproven,
                images: result.imagesSiphoned,
                gradesBackfilled: result.gradesBackfilled,
                dropsBackfilled: result.dropsBackfilled,
                errors: result.errors,
            },
        };
    } catch (error: any) {
        logger.error('[siphonBountiesRaceAction] Error:', error);
        return { success: false, error: error?.message || 'Erreur lors du siphon de la race' };
    }
}

/** Avis de recherche **supprimés** (exclus du siphon) — lecture God. */
export async function getIgnoredBountiesAction(): Promise<ActionResponse<{ entries: IgnoredBountyEntry[] }>> {
    try {
        const userId = await requireGameDataBounties();
        if (!userId) return { success: false, error: "Accès refusé" };
        return { success: true, data: { entries: getIgnoredBounties() } };
    } catch (error: any) {
        logger.error('[getIgnoredBountiesAction] Error:', error);
        return { success: false, error: error?.message || 'Erreur de lecture des exclusions' };
    }
}

/**
 * Lignes `Bounty` **orphelines** (ni dans les 5 races DofusDB, ni exclues) — revue God.
 * Source : l'instantané écrit par les passes COMPLÈTES (cron phase 4, worker BOUNTIES),
 * `null` tant qu'aucune passe complète n'a tourné. L'exclusion en masse passe par
 * `deleteBountyAction` (déjà testée), ligne par ligne ou en boucle côté client.
 */
export async function getBountyOrphansAction(): Promise<ActionResponse<{
    orphans: { id: string; dofusdbId: number | null; name: string; slug: string }[];
    total: number;
    updatedAt: string | null;
}>> {
    try {
        const userId = await requireGameDataBounties();
        if (!userId) return { success: false, error: "Accès refusé" };
        const { getBountyOrphansSnapshot } = await import("@/server/game-data-sync-state-store");
        const snapshot = await getBountyOrphansSnapshot();
        return {
            success: true,
            data: snapshot ?? { orphans: [], total: 0, updatedAt: null },
        };
    } catch (error: any) {
        logger.error('[getBountyOrphansAction] Error:', error);
        return { success: false, error: error?.message || 'Erreur de lecture des orphelins' };
    }
}

/**
 * Supprime un avis de recherche : la ligne `Bounty` (+ sa fiche `MonsterStat`) est retirée **et**
 * l'id entre dans la **liste d'exclusion** ⇒ le siphon ne le recrée pas à la passe suivante
 * (sans cette liste, la suppression serait annulée chaque nuit).
 */
export async function deleteBountyAction(bountyId: string): Promise<ActionResponse<{
    name: string;
    dofusdbId: number | null;
    entries: IgnoredBountyEntry[];
}>> {
    // Garde DANS le try (voir siphonDungeonMonstersDatasetAction).
    try {
        const userId = await requireGameDataBounties();
        if (!userId) return { success: false, error: "Accès refusé" };
        const bounty = await db.bounty.findUnique({
            where: { id: String(bountyId) },
            select: { id: true, name: true, dofusdbId: true },
        });
        if (!bounty) return { success: false, error: "Avis introuvable" };

        await db.bounty.delete({ where: { id: bounty.id } });
        if (bounty.dofusdbId) {
            /* La fiche de combat (sorts/butin/simulation) suit la suppression de l'avis. */
            await db.monsterStat.deleteMany({ where: { monsterId: bounty.dofusdbId } });
        }
        /* 🛡️ Exclusion TOUJOURS enregistrée (08/10/2026 : même sans `dofusdbId`) : une ligne
           purement historique (`dofusdbId` nul) supprimée sans exclusion était RECRÉÉE à la
           passe suivante quand son nom figure dans les races DofusDB — l'exclusion par nom
           (`dofusdbId: 0`, voir `bounty-ignore.ts`) ferme ce trou. */
        addIgnoredBounty(bounty.dofusdbId ?? 0, bounty.name);

        await logGameDataWrite("delete-bounty", bounty.name, { dofusdbId: bounty.dofusdbId });
        revalidatePath('/god/game-data');
        return {
            success: true,
            data: { name: bounty.name, dofusdbId: bounty.dofusdbId ?? null, entries: getIgnoredBounties() },
        };
    } catch (error: any) {
        logger.error('[deleteBountyAction] Error:', error);
        return { success: false, error: error?.message || 'Erreur lors de la suppression de l\'avis' };
    }
}

/** Réintègre un avis supprimé (le prochain siphon le recrée). */
export async function restoreBountyAction(dofusdbId: number, name?: string | null): Promise<ActionResponse<{ entries: IgnoredBountyEntry[] }>> {
    try {
        const userId = await requireGameDataBounties();
        if (!userId) return { success: false, error: "Accès refusé" };
        const id = Math.floor(Number(dofusdbId) || 0);
        // 🔶 Les exclusions sans id (`dofusdbId: 0`, lignes historiques) se réintègrent
        // par le nom normalisé — voir `removeIgnoredBounty`.
        if (id <= 0 && !String(name ?? "").trim()) return { success: false, error: "Identifiant invalide" };

        const entries = removeIgnoredBounty(id, name);
        await logGameDataWrite("restore-bounty", id > 0 ? `dofusdbId-${id}` : `nom-${String(name ?? "").trim()}`);
        revalidatePath('/god/game-data');
        return { success: true, data: { entries } };
    } catch (error: any) {
        logger.error('[restoreBountyAction] Error:', error);
        return { success: false, error: error?.message || 'Erreur lors de la réintégration' };
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
                /* 🛡️ Anti-résurrection : un succès supprimé à la main n'est pas réimporté. */
                const ignoredChallenges = getIgnoredChallenges();
                for (const challenge of parsed.data.challenges) {
                    if (isIgnoredChallenge(challenge.slug, ignoredChallenges)) {
                        stats.skipped++;
                        continue;
                    }
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
                /* 🛡️ Anti-résurrection : un donjon supprimé à la main n'est pas réimporté. */
                const ignoredDungeons = getIgnoredDungeons();
                for (const dungeon of parsed.data.dungeons) {
                    if (isIgnoredDungeon({ name: dungeon.name, bossName: dungeon.bossName }, ignoredDungeons)) {
                        stats.skipped++;
                        continue;
                    }
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
                                // Slug public généré depuis le nom du boss (unique, y
                                // compris au sein de ce lot d'import).
                                slug: await resolveUniqueDungeonSlug(dungeon.bossName, { client: tx }),
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
