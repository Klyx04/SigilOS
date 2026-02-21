'use server';

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { z } from "zod";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { revalidatePath } from "next/cache";
import { writeFileSync } from "fs";
import { join } from "path";

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
    imageUrl: z.string().optional().or(z.literal("")),
    isExpedition: z.boolean().default(false),
    expeditionModes: z.array(z.enum(["BRAVOURE", "AUDACE", "NORMAL"])).optional(),
    expeditionMechanics: z.string().optional(),
    challengeIds: z.array(z.string()).optional(),
});

// --- Helper: Check super-admin access ---

async function requireSuperAdmin(): Promise<string | null> {
    const session = await auth();
    if (!session?.user?.id) return null;

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return null;

    return session.user.id;
}

// ===========================
// MONSTER FAMILIES
// ===========================

const FamilyFilterSchema = z.object({
    zoneId: z.string().optional(),
    search: z.string().optional(),
});

export async function getMonsterFamilies(
    filters: z.infer<typeof FamilyFilterSchema> = {}
): Promise<ActionResponse<any[]>> {
    try {
        const whereClause: any = {};

        if (filters.zoneId) {
            whereClause.zones = { some: { id: filters.zoneId } };
        }

        if (filters.search) {
            whereClause.name = { contains: filters.search, mode: 'insensitive' };
        }

        const families = await db.monsterFamily.findMany({
            where: whereClause,
            include: {
                _count: { select: { monsters: true } },
                zones: { select: { id: true, name: true } }
            },
            take: filters.search ? 20 : 100, // Limit results if searching
            orderBy: { level: 'asc' }
        });
        return { success: true, data: families };
    } catch (error) {
        console.error('[getMonsterFamilies] Error:', error);
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

        revalidatePath('/god/game-data');
        return { success: true, data: family };
    } catch (error: any) {
        console.error('[createMonsterFamily] Error:', error);
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

        revalidatePath('/god/game-data');
        return { success: true, data: family };
    } catch (error: any) {
        console.error('[updateMonsterFamily] Error:', error);
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
        await db.monsterFamily.delete({ where: { id } });
        revalidatePath('/god/game-data');
        return { success: true };
    } catch (error: any) {
        console.error('[deleteMonsterFamily] Error:', error);
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
        console.error('[getChallenges] Error:', error);
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

        revalidatePath('/god/game-data');
        return { success: true, data: challenge };
    } catch (error: any) {
        console.error('[createChallenge] Error:', error);
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

        revalidatePath('/god/game-data');
        return { success: true, data: challenge };
    } catch (error: any) {
        console.error('[updateChallenge] Error:', error);
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
        revalidatePath('/god/game-data');
        return { success: true };
    } catch (error: any) {
        console.error('[deleteChallenge] Error:', error);
        if (error.code === 'P2003') {
            return { success: false, error: 'Impossible de supprimer : des donjons sont associés' };
        }
        return { success: false, error: 'Erreur lors de la suppression' };
    }
}

// ===========================
// DUNGEONS
// ===========================

export async function getDungeonsWithAchievements(): Promise<ActionResponse<any[]>> {
    try {
        const dungeons = await db.dungeon.findMany({
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
        console.error('[getDungeonsWithAchievements] Error:', error);
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
        const { challengeIds, ...dungeonData } = validated;

        const dungeon = await db.dungeon.create({
            data: {
                ...dungeonData,
                dpnlUrl: dungeonData.dpnlUrl || null,
                imageUrl: dungeonData.imageUrl || null,
                expeditionModes: (dungeonData.expeditionModes || null) as any,
                expeditionMechanics: dungeonData.expeditionMechanics || null,
                achievements: challengeIds ? {
                    create: challengeIds.map(challengeId => ({
                        challengeId,
                        points: 10, // Default value
                    }))
                } : undefined
            },
            include: {
                achievements: { include: { challenge: true } }
            }
        });

        revalidatePath('/god/game-data');
        revalidatePath('/admin/missions');
        return { success: true, data: dungeon };
    } catch (error: any) {
        console.error('[createDungeon] Error:', error);
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
        const { challengeIds, ...dungeonData } = validated;

        // Update dungeon and sync achievements
        const dungeon = await db.$transaction(async (tx) => {
            // Update dungeon basic info
            const updated = await tx.dungeon.update({
                where: { id },
                data: {
                    ...dungeonData,
                    dpnlUrl: dungeonData.dpnlUrl || null,
                    imageUrl: dungeonData.imageUrl || null,
                    expeditionModes: (dungeonData.expeditionModes || null) as any,
                    expeditionMechanics: dungeonData.expeditionMechanics || null,
                }
            });

            // Sync achievements if provided
            if (challengeIds) {
                // Delete removed achievements
                await tx.dungeonAchievement.deleteMany({
                    where: {
                        dungeonId: id,
                        challengeId: { notIn: challengeIds }
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

        revalidatePath('/god/game-data');
        revalidatePath('/admin/missions');
        return { success: true, data: dungeon };
    } catch (error: any) {
        console.error('[updateDungeon] Error:', error);
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
        revalidatePath('/god/game-data');
        revalidatePath('/admin/missions');
        return { success: true };
    } catch (error: any) {
        console.error('[deleteDungeon] Error:', error);
        if (error.code === 'P2003') {
            return { success: false, error: 'Impossible de supprimer : des missions sont associées' };
        }
        return { success: false, error: 'Erreur lors de la suppression' };
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
        console.error('[addDungeonAchievement] Error:', error);
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
        console.error('[removeDungeonAchievement] Error:', error);
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
        console.error('[updateDungeonAchievementPoints] Error:', error);
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

        revalidatePath('/god/game-data');
        return { success: true, data: zone };
    } catch (error: any) {
        console.error('[createZone] Error:', error);
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

        revalidatePath('/god/game-data');
        return { success: true, data: zone };
    } catch (error: any) {
        console.error('[updateZone] Error:', error);
        return { success: false, error: 'Erreur lors de la mise à jour' };
    }
}

export async function deleteZone(id: string): Promise<ActionResponse> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        await db.zone.delete({ where: { id } });
        revalidatePath('/god/game-data');
        return { success: true };
    } catch (error: any) {
        console.error('[deleteZone] Error:', error);
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
        console.error('[searchZones] Error:', error);
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
        console.error('[searchDungeons] Error:', error);
        return { success: false, error: 'Erreur recherche donjons' };
    }
}

export async function getAdminZones(): Promise<ActionResponse<any[]>> {
    try {
        const zones = await db.zone.findMany({
            include: {
                families: true,
                dungeons: true
            },
            orderBy: { name: 'asc' }
        });
        return { success: true, data: zones };
    } catch (error) {
        console.error('[getAdminZones] Error:', error);
        return { success: false, error: 'Erreur lors du chargement des zones' };
    }
}

// ===========================
// EXPORT / IMPORT (for beta/prod sync)
// ===========================

export async function exportGameData(): Promise<ActionResponse<any>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const families = await db.monsterFamily.findMany({ include: { monsters: true } });
        const challenges = await db.challenge.findMany();
        const dungeons = await db.dungeon.findMany({
            include: { achievements: true }
        });

        const exportData = {
            version: "2.0",
            exportedAt: new Date().toISOString(),
            exportedBy: userId,
            data: { families, challenges, dungeons }
        };

        return { success: true, data: exportData };
    } catch (error) {
        console.error('[exportGameData] Error:', error);
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
        // Fetch all data with zones included
        const zones = await db.zone.findMany();
        const families = await db.monsterFamily.findMany({
            include: {
                zones: { select: { id: true } }
            }
        });
        const challenges = await db.challenge.findMany();
        const dungeons = await db.dungeon.findMany({
            include: { achievements: true }
        });

        const exportData = {
            version: "2.0",
            exportedAt: new Date().toISOString(),
            exportedBy: userId,
            data: {
                zones,
                families: families.map(f => ({
                    ...f,
                    zones: undefined, // Remove relation, keep only metadata
                    zoneIds: f.zones?.map(z => z.id) || []
                })),
                challenges,
                dungeons
            }
        };

        // Write to seed file
        const seedFilePath = join(process.cwd(), 'prisma', 'seed-data', 'game-data.json');
        writeFileSync(seedFilePath, JSON.stringify(exportData, null, 2), 'utf-8');

        console.log(`✅ [EXPORT] Game data exported to ${seedFilePath}`);

        return {
            success: true,
            data: `Export réussi ! Fichier sauvegardé dans prisma/seed-data/game-data.json\n\n` +
                `Zones: ${zones.length} | Familles: ${families.length} | ` +
                `Challenges: ${challenges.length} | Donjons: ${dungeons.length}\n\n` +
                `💡 Commit ce fichier dans Git pour versionner tes données !`
        };
    } catch (error: any) {
        console.error('[exportGameDataToGit] Error:', error);
        return { success: false, error: `Erreur: ${error.message}` };
    }
}

export async function importGameData(jsonData: string): Promise<ActionResponse<string>> {
    const userId = await requireSuperAdmin();
    if (!userId) return { success: false, error: "Accès refusé" };

    try {
        const parsed = JSON.parse(jsonData);

        if (!parsed.version || !parsed.data) {
            return { success: false, error: 'Format de fichier invalide' };
        }

        let importedCount = 0;

        // Import families (without monsters for now)
        if (parsed.data.families) {
            for (const family of parsed.data.families) {
                await db.monsterFamily.upsert({
                    where: { name: family.name },
                    update: {
                        description: family.description,
                        imageUrl: family.imageUrl,
                    },
                    create: {
                        name: family.name,
                        description: family.description,
                        imageUrl: family.imageUrl,
                    }
                });
                importedCount++;
            }
        }

        // Import challenges
        if (parsed.data.challenges) {
            for (const challenge of parsed.data.challenges) {
                await db.challenge.upsert({
                    where: { slug: challenge.slug },
                    update: {
                        name: challenge.name,
                        description: challenge.description,
                        iconUrl: challenge.iconUrl,
                        conditions: challenge.conditions,
                    },
                    create: {
                        name: challenge.name,
                        slug: challenge.slug,
                        description: challenge.description,
                        iconUrl: challenge.iconUrl,
                        conditions: challenge.conditions,
                    }
                });
                importedCount++;
            }
        }

        // Import dungeons with achievements
        if (parsed.data.dungeons) {
            for (const dungeon of parsed.data.dungeons) {
                const created = await db.dungeon.upsert({
                    // @ts-ignore - Prisma typing glitch on GitHub Actions CI cache
                    where: { name_bossName: { name: dungeon.name, bossName: dungeon.bossName } },
                    update: {
                        level: dungeon.level,
                        dpnlUrl: dungeon.dpnlUrl,
                        imageUrl: dungeon.imageUrl,
                        isExpedition: dungeon.isExpedition,
                        expeditionModes: dungeon.expeditionModes,
                        expeditionMechanics: dungeon.expeditionMechanics,
                    },
                    create: {
                        name: dungeon.name,
                        bossName: dungeon.bossName,
                        level: dungeon.level,
                        dpnlUrl: dungeon.dpnlUrl,
                        imageUrl: dungeon.imageUrl,
                        isExpedition: dungeon.isExpedition,
                        expeditionModes: dungeon.expeditionModes,
                        expeditionMechanics: dungeon.expeditionMechanics,
                    }
                });

                // Import achievements
                if (dungeon.achievements) {
                    for (const ach of dungeon.achievements) {
                        await db.dungeonAchievement.upsert({
                            where: {
                                dungeonId_challengeId: {
                                    dungeonId: created.id,
                                    challengeId: ach.challengeId
                                }
                            },
                            update: { points: ach.points },
                            create: {
                                dungeonId: created.id,
                                challengeId: ach.challengeId,
                                points: ach.points
                            }
                        });
                    }
                }

                importedCount++;
            }
        }

        revalidatePath('/god/game-data');
        revalidatePath('/admin/missions');

        return {
            success: true,
            data: `${importedCount} entrées importées avec succès`
        };
    } catch (error: any) {
        console.error('[importGameData] Error:', error);
        return { success: false, error: `Erreur lors de l'import: ${error.message}` };
    }
}
