"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { Prisma } from "@prisma/client";

const PAGE_SIZE = 24; // 24 cards per page (6 col × 4 rows)

export type GalleryBuild = {
    id: string;
    name: string;
    url: string;
    tags?: string[];
    classId?: string | number; // stored as string ("cra", "roublard") or number from legacy data
    previewData?: any; // Cached build info
    author: {
        id: string;
        name: string;
        image: string | null;
    };
};

export type GalleryPage = {
    builds: GalleryBuild[];
    total: number;
    hasMore: boolean;
    nextPage: number | null;
};

type ActionResponse<T = null> = {
    success: boolean;
    error?: string;
    data?: T;
};

/**
 * Paginated stuff gallery — scales to hundreds of builds.
 * Returns PAGE_SIZE (24) builds per page, filtered server-side.
 * Security: auth + canViewStuffGallery check enforced.
 */
export async function getStuffGalleryPage(
    guildId: string,
    page: number = 1,
    searchQuery?: string,
    tag?: string,
    classId?: string
): Promise<ActionResponse<GalleryPage>> {
    if (!guildId) return { success: false, error: "ID de guilde requis" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.canViewStuffGallery) {
        return { success: false, error: "Accès refusé" };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, name: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Optimization: Don't use Prisma.AnyNull for JSON as it can be flaky depending on DB state.
        // Fetch profiles and filter in memory since guilds are usually < 500 members.
        const profiles = await db.userProfile.findMany({
            where: {
                guildId: guildConfig.id,
                status: "ACTIVE",
            },
            select: {
                id: true,
                pseudoDofus: true,
                discordNickname: true,
                dofusBookLinks: true,
                user: { select: { name: true, image: true } }
            },
        });

        console.log(`[Gallery] Found ${profiles.length} active profiles for guild ${guildConfig.name}`);

        // Flatten all builds from all profiles into one list
        let allBuilds: GalleryBuild[] = [];
        profiles.forEach(profile => {
            // Safety check: ensure links is actually an array
            if (!profile.dofusBookLinks || !Array.isArray(profile.dofusBookLinks)) {
                return;
            }

            const links = profile.dofusBookLinks as any[];
            links.forEach((link, idx) => {
                if (link?.url && link?.name) {
                    allBuilds.push({
                        id: `${profile.id}-${idx}`,
                        name: link.name,
                        url: link.url,
                        tags: link.tags || [],
                        classId: link.classId,
                        previewData: link.previewData,
                        author: {
                            id: profile.id,
                            name: profile.pseudoDofus || profile.discordNickname || profile.user.name || "Membre",
                            image: profile.user.image
                        }
                    });
                }
            });
        });

        console.log(`[Gallery] Total builds flattened: ${allBuilds.length}`);

        // Most recently added first (by reverse index since we push them in profile order)
        allBuilds = allBuilds.reverse();

        // Apply search filter server-side
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            allBuilds = allBuilds.filter(b =>
                b.name.toLowerCase().includes(q) ||
                b.author.name.toLowerCase().includes(q)
            );
        }

        // Apply tag filter server-side
        if (tag) {
            allBuilds = allBuilds.filter(b => b.tags?.includes(tag));
        }

        // Apply class filter server-side
        if (classId) {
            allBuilds = allBuilds.filter(b => String(b.classId) === classId);
        }

        const total = allBuilds.length;
        const offset = (page - 1) * PAGE_SIZE;
        const pageBuilds = allBuilds.slice(offset, offset + PAGE_SIZE);
        const hasMore = offset + PAGE_SIZE < total;

        return {
            success: true,
            data: {
                builds: pageBuilds,
                total,
                hasMore,
                nextPage: hasMore ? page + 1 : null
            }
        };
    } catch (error: any) {
        console.error("Get Stuff Gallery Page Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Force re-fetch of Dofusbook metadata for a specific build in the gallery.
 * This updates the previewData in the user's profile.
 */
export async function refreshBuildMetadata(
    guildId: string,
    profileId: string,
    buildUrl: string
): Promise<ActionResponse> {
    if (!guildId || !profileId || !buildUrl) return { success: false, error: "Paramètres manquants" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return { success: false, error: "Non authentifié" };

    try {
        const { getDofusbookPreview } = await import("./dofusbook-actions");
        const { revalidatePath } = await import("next/cache");

        // 1. Fetch metadata from Dofusbook
        const res = await getDofusbookPreview(buildUrl);
        if (!res.success || !res.data) {
            return { success: false, error: res.error || "Impossible de récupérer les données" };
        }

        // 2. Update user profile dofusBookLinks
        const profile = await db.userProfile.findUnique({
            where: { id: profileId },
            select: { id: true, dofusBookLinks: true }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        const links = (profile.dofusBookLinks as any[]) || [];
        const updatedLinks = links.map(link => {
            if (link.url === buildUrl) {
                return { ...link, previewData: res.data };
            }
            return link;
        });

        await db.userProfile.update({
            where: { id: profileId },
            data: { dofusBookLinks: updatedLinks as any }
        });

        // 3. Revalidate
        revalidatePath(`/dashboard/${guildId}/galerie-stuff`);
        revalidatePath(`/dashboard/${guildId}/members/${profileId}`);

        return { success: true };
    } catch (error) {
        console.error("Refresh Build Metadata Error:", error);
        return { success: false, error: "Erreur serveur lors du rafraîchissement" };
    }
}
