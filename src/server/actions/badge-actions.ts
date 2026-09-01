"use server";

import { z } from "zod";
import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { createAuditLog } from "@/server/actions/audit-actions";
import { notifyGod } from "@/server/actions/god-notif-actions";

export type ActionResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
};

const BadgeSchema = z.object({
    id: z.string().optional(),
    slug: z.string().min(2).max(100),
    name: z.string().min(2, "Nom requis").max(100),
    description: z.string().max(500).optional().nullable(),
    imageUrl: z.string().min(1, "Image requise"),
    rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"]).default("COMMON"),
    category: z.enum(["COMMUNITY", "GAMEPLAY", "EVENT", "STAFF", "GUILD"]).default("COMMUNITY"),
    isSecret: z.boolean().default(false),
    isGodOnly: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
    triggerType: z.string().default("MANUAL"),
    triggerValue: z.string().optional().nullable(),
    triggerMetadata: z.any().optional().nullable(),
});

/**
 * 🏅 Récupère le catalogue de badges complet (God ou Membre)
 */
export async function getBadgesCatalogAction(): Promise<ActionResponse<any[]>> {
    try {
        const badges = await (db as any).badge.findMany({
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
            include: {
                _count: {
                    select: { userBadges: true }
                }
            }
        });

        return { success: true, data: badges };
    } catch (error) {
        logger.error("[BadgeActions] getBadgesCatalogAction error:", error);
        return { success: false, error: "Échec du chargement des badges." };
    }
}

/**
 * 🛠️ Créer ou modifier un badge (SuperAdmin / God)
 */
export async function upsertBadgeAction(data: z.infer<typeof BadgeSchema>): Promise<ActionResponse> {
    const isGod = await isSuperAdmin();
    if (!isGod) return { success: false, error: "Accès refusé (SuperAdmin requis)." };

    const parsed = BadgeSchema.safeParse(data);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message || "Données invalides." };
    }

    try {
        const { id, ...badgeData } = parsed.data;

        let badge;
        if (id) {
            badge = await (db as any).badge.update({
                where: { id },
                data: badgeData
            });
        } else {
            badge = await (db as any).badge.create({
                data: badgeData
            });
        }

        revalidatePath("/god", "layout");
        revalidatePath("/god?tab=badges");

        return { success: true, data: badge };
    } catch (error: any) {
        logger.error("[BadgeActions] upsertBadgeAction error:", error);
        if (error.code === "P2002") {
            return { success: false, error: "Un badge avec ce slug existe déjà." };
        }
        return { success: false, error: "Échec de l'enregistrement du badge." };
    }
}

/**
 * 🗑️ Supprimer un badge (SuperAdmin / God)
 */
export async function deleteBadgeAction(badgeId: string): Promise<ActionResponse> {
    const isGod = await isSuperAdmin();
    if (!isGod) return { success: false, error: "Accès refusé (SuperAdmin requis)." };

    try {
        await (db as any).badge.delete({
            where: { id: badgeId }
        });

        revalidatePath("/god", "layout");
        revalidatePath("/god?tab=badges");

        return { success: true };
    } catch (error) {
        logger.error("[BadgeActions] deleteBadgeAction error:", error);
        return { success: false, error: "Échec de la suppression du badge." };
    }
}

/**
 * 🎁 Attribuer un badge à un profil membre (God ou Staff Guilde)
 */
export async function grantBadgeToProfileAction(
    guildId: string,
    profileId: string,
    badgeId: string,
    reason?: string
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié." };

    const isGod = await isSuperAdmin();
    const ctx = await getUserContext(guildId);

    if (!isGod && !ctx.isAdmin) {
        return { success: false, error: "Permissions insuffisantes pour attribuer un badge." };
    }

    try {
        const badge = await (db as any).badge.findUnique({
            where: { id: badgeId }
        });

        if (!badge) return { success: false, error: "Badge introuvable." };
        if (badge.isGodOnly && !isGod) {
            return { success: false, error: "Ce badge exclusif ne peut être attribué que par le SuperAdmin." };
        }

        const userBadge = await (db as any).userBadge.upsert({
            where: { profileId_badgeId: { profileId, badgeId } },
            create: {
                profileId,
                badgeId,
                source: isGod ? "GOD" : "STAFF",
                reason: reason || "Attribution par le staff"
            },
            update: {
                reason: reason || undefined
            }
        });

        revalidatePath(`/dashboard/${guildId}/profil`, "layout");

        return { success: true, data: userBadge };
    } catch (error) {
        logger.error("[BadgeActions] grantBadgeToProfileAction error:", error);
        return { success: false, error: "Échec de l'attribution du badge." };
    }
}

/**
 * 🚫 Révoquer un badge d'un profil membre
 */
export async function revokeBadgeFromProfileAction(
    guildId: string,
    profileId: string,
    badgeId: string
): Promise<ActionResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié." };

    const isGod = await isSuperAdmin();
    const ctx = await getUserContext(guildId);

    if (!isGod && !ctx.isAdmin) {
        return { success: false, error: "Permissions insuffisantes pour révoquer un badge." };
    }

    try {
        await (db as any).userBadge.deleteMany({
            where: { profileId, badgeId }
        });

        revalidatePath(`/dashboard/${guildId}/profil`, "layout");

        return { success: true };
    } catch (error) {
        logger.error("[BadgeActions] revokeBadgeFromProfileAction error:", error);
        return { success: false, error: "Échec de la révocation du badge." };
    }
}

/**
 * 👤 Récupérer les badges d'un profil utilisateur
 */
export async function getProfileBadgesAction(profileId: string): Promise<ActionResponse<any[]>> {
    try {
        const userBadges = await (db as any).userBadge.findMany({
            where: { profileId },
            include: {
                badge: true
            },
            orderBy: [
                { badge: { sortOrder: "asc" } },
                { unlockedAt: "desc" }
            ]
        });

        return {
            success: true,
            data: userBadges.map((ub: any) => ({
                id: ub.badge.id,
                slug: ub.badge.slug,
                name: ub.badge.name,
                description: ub.badge.description,
                imageUrl: ub.badge.imageUrl,
                rarity: ub.badge.rarity,
                category: ub.badge.category,
                unlockedAt: ub.unlockedAt.toISOString(),
                source: ub.source,
                reason: ub.reason
            }))
        };
    } catch (error) {
        logger.error("[BadgeActions] getProfileBadgesAction error:", error);
        return { success: false, error: "Échec de la récupération des badges du profil." };
    }
}
