"use server";

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type ActionResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: string;
};

/**
 * 👤 Badges d'un profil membre — **lecture seule**.
 *
 * 🧭 Chantier « purge des onglets morts du God » (28/09/2026) : l'atelier
 * « Studio Badges » (création/édition/suppression d'un badge côté God) est
 * **supprimé** — il dupliquait le catalogue géré par le webhook Ko-fi et
 * n'était ouvert par aucun lien du produit. Ne survivent ici que les fonctions
 * réellement appelées : la vitrine de badges du profil
 * (`src/components/profile/badges-vitrine.tsx`). Les badges restent **attribués**
 * par `db.badge.upsert` dans le webhook Ko-fi (`src/app/api/webhooks/kofi`) et
 * consommés par `evaluateBadgeTriggersForProfile` (`badge-triggers.ts`).
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
