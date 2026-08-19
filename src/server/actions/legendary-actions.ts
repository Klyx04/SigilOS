"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { z } from "zod";
import { downloadExternalImage } from "@/lib/image-downloader";


export type ActionResponse<T = null> = {
    success: boolean;
    error?: string;
    data?: T;
};

/**
 * Récupère tous les objets légendaires avec l'indication si l'utilisateur peut les crafter
 * basé sur ses métiers niveau 200.
 */
export async function getLegendaryCraftingData(guildId: string, targetProfileId?: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findUnique({
            where: targetProfileId ? { id: targetProfileId } : {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: guildConfig.id
                }
            },
            include: {
                legendaryCrafts: true
            }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        // 1. Extraire les métiers niveau 200 (les métiers stockés sont déjà niveau 200)
        const userMetiers = (profile.metiers as string[]) || [];
        const jobsAt200 = userMetiers.map(m => m.toLowerCase());

        // 2. Récupérer tous les items légendaires
        const allItems = await db.legendaryItem.findMany({
            orderBy: { name: "asc" }
        });

        // 3. Mapper les items avec l'éligibilité et le statut actuel
        const items = allItems.map(item => {
            const isEligible = jobsAt200.includes(item.jobRequired.toLowerCase());
            const canCraft = profile.legendaryCrafts.some(lc => lc.id === item.id);
            return {
                ...item,
                isEligible,
                canCraft
            };
        });

        return {
            success: true,
            data: {
                items,
                jobsAt200,
                hasLegendaryPrerequisites: profile.hasLegendaryPrerequisites
            }
        };
    } catch (error) {
        logger.error("Get Legendary Crafting Data Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Synchronise les objets légendaires de l'utilisateur.
 * S'il a les prérequis, on lui connecte tous les objets correspondant à ses métiers.
 * Sinon, on lui retire tout.
 */
export async function syncLegendaryCrafts(guildId: string, hasPrerequisites: boolean) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: guildConfig.id
                }
            }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        if (hasPrerequisites) {
            // Trouver les métiers du joueur
            const userMetiers = (profile.metiers as string[]) || [];
            const jobsAt200 = userMetiers.map(m => m.toLowerCase());

            // Trouver les items correspondants
            const eligibleItems = await db.legendaryItem.findMany({
                where: {
                    jobRequired: {
                        in: jobsAt200,
                        mode: "insensitive"
                    }
                },
                select: { id: true }
            });

            // Connecter ces items (et déconnecter les autres au cas où il a perdu un métier)
            await db.userProfile.update({
                where: { id: profile.id },
                data: {
                    hasLegendaryPrerequisites: true,
                    legendaryCrafts: {
                        set: eligibleItems.map(item => ({ id: item.id }))
                    }
                }
            });
        } else {
            // Retirer tous les items
            await db.userProfile.update({
                where: { id: profile.id },
                data: {
                    hasLegendaryPrerequisites: false,
                    legendaryCrafts: {
                        set: []
                    }
                }
            });
        }

        revalidatePath(`/dashboard/${guildId}/profile`);
        return { success: true };
    } catch (error) {
        logger.error("Sync Legendary Crafts Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Bascule le statut "Familier/Montilier/Monture Légendaire" de l'utilisateur.
 */
export async function toggleLegendaryPet(guildId: string, enabled: boolean): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        await db.userProfile.update({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: guildConfig.id
                }
            },
            data: { hasLegendaryPet: enabled }
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        return { success: true };
    } catch (error) {
        logger.error("Toggle Legendary Pet Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// GOD ACTIONS — Super Admin only
// ============================================================================

const LegendaryItemSchema = z.object({
    name: z.string().min(1),
    category: z.string().min(1),
    jobRequired: z.string().min(1),
    imageUrl: z.string().optional().nullable(),
});

export async function getLegendaryItems() {
    const admin = await isSuperAdmin();
    if (!admin) return { success: false, error: "Unauthorized" };

    try {
        const items = await db.legendaryItem.findMany({
            orderBy: { name: "asc" },
            include: { _count: { select: { crafters: true } } }
        });
        return { success: true, data: items };
    } catch (error) {
        logger.error("Get Legendary Items Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function createLegendaryItem(data: z.infer<typeof LegendaryItemSchema>) {
    const admin = await isSuperAdmin();
    if (!admin) return { success: false, error: "Unauthorized" };

    const validation = LegendaryItemSchema.safeParse(data);
    if (!validation.success) return { success: false, error: "Données invalides" };

    const itemData = { ...validation.data };

    // Siphon image si externe
    if (itemData.imageUrl && (itemData.imageUrl.startsWith("http://") || itemData.imageUrl.startsWith("https://"))) {
        try {
            const slug = itemData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            // Le répertoire de destination (`public/game-data/legendary`) est une CONSTANTE
            // gérée dans image-downloader.ts (destDirFor("legendary")) — on ne passe ici que
            // le nom de fichier (le slug est assaini par le regex ci-dessus).
            const downloadResult = await downloadExternalImage(itemData.imageUrl, `${slug}.webp`, "legendary");
            if (downloadResult.success && downloadResult.path) {
                itemData.imageUrl = downloadResult.path;
            }
        } catch (e) {
            logger.error("Auto-siphoning on create failed", { error: e });
        }
    }

    try {
        const item = await db.legendaryItem.create({ data: itemData });
        return { success: true, data: item };
    } catch (error) {
        logger.error("Create Legendary Item Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateLegendaryItem(id: string, data: z.infer<typeof LegendaryItemSchema>) {
    const admin = await isSuperAdmin();
    if (!admin) return { success: false, error: "Unauthorized" };

    const validation = LegendaryItemSchema.safeParse(data);
    if (!validation.success) return { success: false, error: "Données invalides" };

    const itemData = { ...validation.data };

    // Siphon image si externe
    if (itemData.imageUrl && (itemData.imageUrl.startsWith("http://") || itemData.imageUrl.startsWith("https://"))) {
        try {
            const slug = itemData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            // Le répertoire de destination (`public/game-data/legendary`) est une CONSTANTE
            // gérée dans image-downloader.ts (destDirFor("legendary")) — on ne passe ici que
            // le nom de fichier (le slug est assaini par le regex ci-dessus).
            const downloadResult = await downloadExternalImage(itemData.imageUrl, `${slug}.webp`, "legendary");
            if (downloadResult.success && downloadResult.path) {
                itemData.imageUrl = downloadResult.path;
            }
        } catch (e) {
            logger.error("Auto-siphoning on update failed", { error: e });
        }
    }

    try {
        const item = await db.legendaryItem.update({ where: { id }, data: itemData });
        revalidatePath("/god/game-data");
        return { success: true, data: item };
    } catch (error) {
        logger.error("Update Legendary Item Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

export async function deleteLegendaryItem(id: string) {
    const admin = await isSuperAdmin();
    if (!admin) return { success: false, error: "Unauthorized" };

    try {
        await db.legendaryItem.delete({ where: { id } });
        revalidatePath("/god/game-data");
        return { success: true };
    } catch (error) {
        logger.error("Delete Legendary Item Error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}
