"use server";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import { logger } from "@/lib/logger";
import { getGameDisplayName } from "@/lib/display-name";

/**
 * Route image provider URLs through the internal proxy to bypass anti-hotlink
 * protections (Barbofus, DofusSkinManga, Dofusbook) when Discord fetches the embed image.
 * Discord's fetchers don't send browser-like headers, so these providers refuse
 * to serve the image and Discord falls back to the provider logo or broken image.
 * Returns undefined only if the URL is invalid.
 */
function resolveDiscordImage(rawImage: string, baseUrl?: string): string | undefined {
    try {
        let cleanImage = rawImage.trim();
        if (cleanImage.startsWith("//")) {
            cleanImage = `https:${cleanImage}`;
        }
        const parsedUrl = baseUrl ? new URL(cleanImage, baseUrl) : new URL(cleanImage);
        const host = parsedUrl.hostname.toLowerCase();
        const isProtectedProvider = 
            host === "barbofus.com" || host.endsWith(".barbofus.com") ||
            host === "dofusskinmanga.com" || host.endsWith(".dofusskinmanga.com") ||
            host === "dofusbook.net" || host.endsWith(".dofusbook.net") ||
            host === "d-bk.net" || host.endsWith(".d-bk.net");

        if (isProtectedProvider) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://beta.sigilos.fr";
            return `${appUrl}/api/proxy-image?url=${encodeURIComponent(parsedUrl.href)}`;
        }
        return parsedUrl.href;
    } catch {
        return undefined;
    }
}

const PAGE_SIZE = 24; // 24 cards per page (6 col × 4 rows)

export type GalleryBuild = {
    id: string;
    name: string;
    url: string;
    tags?: string[];
    classId?: string | number; // stored as string ("cra", "roublard") or number from legacy data
    previewData?: any; // Cached build info
    source?: "dofusbook";
    author: {
        id: string;
        name: string;
        image: string | null;
    };
    votesCount: number;
    hasVoted: boolean;
    createdAt?: string | null; // Date d'ajout du stuff
    updatedAt?: string | null; // Date de dernière modification
};

export type GalleryPage = {
    builds: GalleryBuild[];
    total: number;
    hasMore: boolean;
    nextPage: number | null;
    isDiscordShareConfigured: boolean;
};

export type GallerySkin = {
    id: string;
    name: string;
    url: string;
    provider: string;
    thumbnailUrl: string | null;
    equipment?: any;
    colors?: any;
    metadata: any;
    author: {
        id: string;
        name: string;
        image: string | null;
    };
    votesCount: number;
    hasVoted: boolean;
    createdAt: Date;
};

export type GallerySkinPage = {
    skins: GallerySkin[];
    total: number;
    hasMore: boolean;
    nextPage: number | null;
    isDiscordShareConfigured: boolean;
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
    tags?: string[],
    classId?: string,
    sortBy?: "newest" | "votes",
    source?: "dofusbook"
): Promise<ActionResponse<GalleryPage>> {
    if (!guildId) return { success: false, error: "ID de guilde requis" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.canViewStuffGallery) {
        return { success: false, error: "Accès refusé" };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, name: true, stuffGalleryChannelId: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const [profiles, allVotes] = await Promise.all([
            // Optimization: Fetch profiles and filter in memory
            db.userProfile.findMany({
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
            }),
            // Fetch all votes for this guild
            db.buildVote.findMany({
                where: { guildId: guildConfig.id },
                select: { buildId: true, userId: true }
            })
        ]);



        // Create vote maps for quick access
        const votesCountMap = new Map<string, number>();
        const userVotesSet = new Set<string>(); // Set of buildIds voted by current user

        allVotes.forEach((vote: { buildId: string, userId: string }) => {
            votesCountMap.set(vote.buildId, (votesCountMap.get(vote.buildId) || 0) + 1);
            if (user.id && vote.userId === user.id) {
                userVotesSet.add(vote.buildId);
            }
        });

        // Flatten all builds from all profiles into one list
        let allBuilds: GalleryBuild[] = [];
        profiles.forEach((profile: any) => {
            // Safety check: ensure links is actually an array
            if (!profile.dofusBookLinks || !Array.isArray(profile.dofusBookLinks)) {
                return;
            }

            const links = profile.dofusBookLinks as any[];
            links.forEach((link, idx) => {
                if (link?.url && link?.name) {
                    const isDofusRoom = /dofusroom\.com/.test(link.url);
                    if (isDofusRoom) return; // Skip DofusRoom links completely

                    const buildId = link.id || `${profile.id}-${idx}`; // Prefer real id if exists
                    const buildSource = "dofusbook" as const;
                    
                    const buildIdMatch = link.url.match(/(?:equipement\/(?:[a-z]+\/)?([\d]+)|d-bk\.net\/(?:fr\/)?d\/([a-zA-Z0-9]+))/i);
                    const parsedId = buildIdMatch ? (buildIdMatch[1] || buildIdMatch[2]) : null;
                    const numericMatch = parsedId?.match(/^(\d+)/);
                    const numericId = numericMatch ? numericMatch[1] : parsedId;
                    const thumbnail = link.previewData?.thumbnail || (numericId ? `https://static.dofusbook.net/equipement/render/${numericId}.png` : null);

                    allBuilds.push({
                        id: buildId,
                        name: link.name,
                        url: link.url,
                        tags: link.tags || [],
                        classId: link.classId,
                        source: buildSource,
                        previewData: {
                            ...link.previewData,
                            thumbnail
                        },
                        author: {
                            id: profile.id,
                            name: getGameDisplayName(profile),
                            image: profile.user.image
                        },
                        votesCount: votesCountMap.get(buildId) || 0,
                        hasVoted: userVotesSet.has(buildId),
                        createdAt: link.createdAt || null,
                        updatedAt: link.updatedAt || null
                    });
                }
            });
        });



        // Apply sort
        if (sortBy === "votes") {
            allBuilds = allBuilds.sort((a, b) => b.votesCount - a.votesCount);
        } else {
            // Default: newest first (by updatedAt or createdAt timestamp if available)
            allBuilds = allBuilds.sort((a, b) => {
                const dateA = a.updatedAt || a.createdAt;
                const dateB = b.updatedAt || b.createdAt;
                if (dateA && dateB) {
                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                }
                if (dateA) return -1;
                if (dateB) return 1;
                return 0;
            });
        }

        // Apply search filter server-side
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            allBuilds = allBuilds.filter(b =>
                b.name.toLowerCase().includes(q) ||
                b.author.name.toLowerCase().includes(q)
            );
        }

        // Apply tag filter server-side (multi-sélection : TOUS les tags sélectionnés doivent être présents)
        if (tags && tags.length > 0) {
            allBuilds = allBuilds.filter(b => tags.every(t => b.tags?.includes(t)));
        }

        // Apply class filter server-side
        if (classId) {
            allBuilds = allBuilds.filter(b => String(b.classId) === classId);
        }

        // Apply source filter server-side
        if (source) {
            allBuilds = allBuilds.filter(b => b.source === source);
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
                nextPage: hasMore ? page + 1 : null,
                isDiscordShareConfigured: !!guildConfig.stuffGalleryChannelId
            }
        };
    } catch (error: any) {
        logger.error("Get Stuff Gallery Page Error:", { error });
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
        const { revalidatePath } = await import("next/cache");
        const isDofusRoom = /dofusroom\.com/.test(buildUrl);
        if (isDofusRoom) {
            return { success: false, error: "L'intégration DofusRoom a été supprimée." };
        }
        let previewData = null;

        const { getDofusbookPreview } = await import("./dofusbook-actions");
        const res = await getDofusbookPreview(buildUrl, true);
        if (!res.success || !res.data) {
            return { success: false, error: res.error || "Impossible de récupérer les données" };
        }
        previewData = res.data;

        // 2. Update user profile dofusBookLinks
        const profile = await db.userProfile.findUnique({
            where: { id: profileId },
            select: { id: true, dofusBookLinks: true }
        });

        if (!profile) return { success: false, error: "Profil introuvable" };

        const links = (profile.dofusBookLinks as any[]) || [];
        const updatedLinks = links.map(link => {
            if (link.url === buildUrl) {
                return { ...link, previewData, source: "dofusbook" as const };
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
        logger.error("Refresh Build Metadata Error:", { error });
        return { success: false, error: "Erreur serveur lors du rafraîchissement" };
    }
}

/**
 * Paginated skin gallery.
 * Returns PAGE_SIZE (24) skins per page, filtered server-side.
 */
export async function getSkinGalleryPage(
    guildId: string,
    page: number = 1,
    searchQuery?: string,
    classFilter?: string,
    genderFilter?: string,
    sortBy: "newest" | "votes" = "newest"
): Promise<ActionResponse<GallerySkinPage>> {
    if (!guildId) return { success: false, error: "ID de guilde requis" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.canViewStuffGallery) {
        return { success: false, error: "Accès refusé" };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, skinGalleryChannelId: true }
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const offset = (page - 1) * PAGE_SIZE;

        // Build filtering conditions
        const where: Prisma.UserSkinWhereInput = {
            profile: {
                guildId: guildConfig.id,
                status: "ACTIVE"
            }
        };

        if (searchQuery) {
            where.OR = [
                { name: { contains: searchQuery, mode: 'insensitive' } },
                { profile: { pseudoDofus: { contains: searchQuery, mode: 'insensitive' } } },
                { profile: { discordNickname: { contains: searchQuery, mode: 'insensitive' } } }
            ];
        }

        // Advanced filter for Barbofus skins (metadata-based)
        if (classFilter || genderFilter) {
            // Note: Handle legacy values (Homme, Femme, symbols) for robust filtering
            const genderValues = genderFilter === "M" 
                ? ["M", "Homme", "♂", "Mâle"]
                : ["F", "Femme", "♀", "Femelle"];

            const conditions: Prisma.UserSkinWhereInput[] = [];

            if (classFilter) {
                const targetClass = DOFUS_CLASSES.find(c => c.icon.includes(`/${classFilter}.png`));
                const classValues = [classFilter];
                if (targetClass) classValues.push(targetClass.name);

                conditions.push({ 
                    OR: classValues.map(v => ({ metadata: { path: ["class"], equals: v } }))
                });
            }

            if (genderFilter) {
                conditions.push({ 
                    OR: genderValues.map(v => ({ metadata: { path: ["gender"], equals: v } }))
                });
            }

            if (conditions.length > 0) {
                where.AND = conditions;
            }
        }


        const [skins, total] = await Promise.all([
            db.userSkin.findMany({
                where,
                include: {
                    profile: {
                        select: {
                            id: true,
                            pseudoDofus: true,
                            discordNickname: true,
                            user: { select: { name: true, image: true } }
                        }
                    },
                    _count: {
                        select: { votes: true }
                    },
                    votes: {
                        where: { userId: user.id },
                        take: 1
                    }
                },
                orderBy: sortBy === "votes" ? { votes: { _count: 'desc' } } : { createdAt: 'desc' },
                skip: offset,
                take: PAGE_SIZE
            }),
            db.userSkin.count({ where })
        ]);

        const mappedSkins: GallerySkin[] = skins.map(s => ({
            id: s.id,
            name: s.name,
            url: s.url,
            provider: s.provider,
            thumbnailUrl: s.thumbnailUrl,
            equipment: s.equipment,
            colors: s.colors,
            metadata: s.metadata,
            author: {
                id: s.profile.id,
                name: getGameDisplayName(s.profile),
                image: s.profile.user.image
            },
            votesCount: s._count.votes,
            hasVoted: s.votes.length > 0,
            createdAt: s.createdAt
        }));

        const hasMore = offset + PAGE_SIZE < total;

        return {
            success: true,
            data: {
                skins: mappedSkins,
                total,
                hasMore,
                nextPage: hasMore ? page + 1 : null,
                isDiscordShareConfigured: !!guildConfig.skinGalleryChannelId
            }
        };
    } catch (error) {
        logger.error("Get Skin Gallery Page Error:", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Toggle vote for a skin in the gallery.
 */
export async function toggleSkinVote(guildId: string, skinId: string): Promise<ActionResponse<{ voted: boolean }>> {
    if (!guildId || !skinId) return { success: false, error: "Paramètres invalides" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.id) {
        return { success: false, error: "Vous devez être connecté pour voter" };
    }

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const existingVote = await db.skinVote.findUnique({
            where: {
                skinId_userId: {
                    skinId,
                    userId: user.id
                }
            }
        });

        if (existingVote) {
            await db.skinVote.delete({ where: { id: existingVote.id } });
            return { success: true, data: { voted: false } };
        } else {
            await db.skinVote.create({
                data: {
                    skinId,
                    userId: user.id,
                    guildId: guildConfig.id
                }
            });
            return { success: true, data: { voted: true } };
        }
    } catch (error) {
        logger.error("Toggle Skin Vote Error:", { error });
        return { success: false, error: "Erreur serveur lors du vote" };
    }
}

/**
 * Share a gallery item (Stuff or Skin) to Discord.
 * Enforces rate limiting and handles Forum vs Text channels.
 */
export async function shareGalleryItemOnDiscord(
    guildId: string,
    itemId: string,
    type: "STUFF" | "SKIN",
    authorProfileId?: string
): Promise<ActionResponse> {
    if (!guildId || !itemId) return { success: false, error: "Paramètres invalides" };

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.id || !user.profileId) {
        return { success: false, error: "Vous devez être connecté pour partager" };
    }

    let embedImage: string | undefined = undefined;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://beta.sigilos.fr";
    try {
        const { fetchChannel, sendChannelMessage, createForumPost } = await import("@/server/discord");

        // 1. Fetch SHARER Profile and check Rate Limit
        const sharerProfile = await db.userProfile.findUnique({
            where: { id: user.profileId },
            select: { id: true, lastGalleryShareAt: true, pseudoDofus: true, discordNickname: true }
        });

        if (!sharerProfile) return { success: false, error: "Profil introuvable" };

        const COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
        if (sharerProfile.lastGalleryShareAt) {
            const elapsed = Date.now() - sharerProfile.lastGalleryShareAt.getTime();
            if (elapsed < COOLDOWN_MS) {
                const remainingSeconds = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
                const minutes = Math.floor(remainingSeconds / 60);
                const seconds = remainingSeconds % 60;
                return { 
                    success: false, 
                    error: `Anti-spam : veuillez patienter ${minutes > 0 ? `${minutes}m ` : ""}${seconds}s.` 
                };
            }
        }

        // 2. Fetch Guild Config for Channels
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { skinGalleryChannelId: true, stuffGalleryChannelId: true, id: true }
        });

        const channelId = type === "STUFF" ? guildConfig?.stuffGalleryChannelId : guildConfig?.skinGalleryChannelId;
        if (!channelId) return { success: false, error: "Le salon de partage n'est pas configuré pour cette guilde." };

        // 3. Fetch Item Details
        let embedTitle = "";
        let embedDescription = "";
        let embedThumbnail = "";
        let embedUrl = "";
        const fields: any[] = [];
        let itemName = "";
        let authorName = "Un membre";

        if (type === "STUFF") {
            // Find build globally in the guild if authorProfileId is known
            let build: any = null;
            let targetProfileId = authorProfileId;

            if (authorProfileId) {
                const profile = await db.userProfile.findUnique({
                    where: { id: authorProfileId },
                    select: { dofusBookLinks: true, pseudoDofus: true, discordNickname: true }
                });
                build = (profile?.dofusBookLinks as any[])?.find(b => b.id === itemId);
                authorName = profile?.pseudoDofus || profile?.discordNickname || authorName;
            } else {
                // Fallback search in all guild profiles (Active)
                const profiles = await db.userProfile.findMany({
                    where: { guildId: guildConfig?.id, status: 'ACTIVE' },
                    select: { id: true, dofusBookLinks: true, pseudoDofus: true, discordNickname: true }
                });
                for (const p of profiles) {
                    const b = (p.dofusBookLinks as any[])?.find(x => x.id === itemId);
                    if (b) {
                        build = b;
                        authorName = p.pseudoDofus || p.discordNickname || authorName;
                        targetProfileId = p.id;
                        break;
                    }
                }
            }
            if (!build) return { success: false, error: "Build introuvable" };

            // Opportunistic Auto-Bake: If previewData is missing or empty, fetch it live before sending to Discord
            if (!build.previewData || !build.previewData.stats) {
                try {
                    const { getDofusbookPreview } = await import("./dofusbook-actions");
                    const previewRes = await getDofusbookPreview(build.url);
                    if (previewRes.success && previewRes.data) {
                        build.previewData = previewRes.data;

                        // Save updated previewData back to user profile asynchronously
                        if (targetProfileId) {
                            const profileObj = await db.userProfile.findUnique({
                                where: { id: targetProfileId },
                                select: { dofusBookLinks: true }
                            });
                            const updatedLinks = ((profileObj?.dofusBookLinks as any[]) || []).map(l =>
                                l.id === build.id ? { ...l, previewData: previewRes.data, source: "dofusbook" } : l
                            );
                            await db.userProfile.update({
                                where: { id: targetProfileId },
                                data: { dofusBookLinks: updatedLinks as any }
                            }).catch(() => {});
                        }
                    }
                } catch {
                    // Ignore error, fallback to stored build info
                }
            }

            itemName = build.name;
            const pd = build.previewData;
            const className = pd?.className || (build.classId ? String(build.classId) : "");
            const levelStr = pd?.level ? ` · Niv. ${pd.level}` : "";
            
            embedTitle = `🛡️ Build : ${build.name}${className ? ` (${className}${levelStr})` : ""}`;
            embedUrl = build.url;
            const classNum = pd?.classId || build.classId;
            embedThumbnail = classNum 
                ? `${appUrl}/assets/dofus/classes/${classNum === 19 ? 20 : classNum}.png`
                : `${appUrl}/assets/ui/logo-v2.png`;

            // Extract numeric ID to generate the official Dofusbook render screenshot card
            const buildIdMatch = build.url.match(/(?:equipement\/(?:[a-z]+\/)?([\d]+)|d-bk\.net\/(?:fr\/)?d\/([a-zA-Z0-9]+))/i);
            const parsedId = buildIdMatch ? (buildIdMatch[1] || buildIdMatch[2]) : null;
            const numericMatch = parsedId?.match(/^(\d+)/);
            const numericId = numericMatch ? numericMatch[1] : parsedId;

            const flashRenderUrl = numericId 
                ? `https://static.dofusbook.net/equipement/render/${numericId}.png`
                : pd?.thumbnail;

            if (flashRenderUrl) {
                embedImage = resolveDiscordImage(flashRenderUrl, build.url);
            } else {
                embedImage = undefined;
            }

            // 1. ⚔️ Caractéristiques principales
            if (pd?.stats) {
                const { pa = 6, pm = 3, po = 0, vit = 0, ini = 0, cc = 0, invo = 1 } = pd.stats;
                fields.push({
                    name: "⚔️ Caractéristiques",
                    value: `**${pa}** PA · **${pm}** PM · **${po}** PO\n💖 **${vit.toLocaleString("fr-FR")}** Vitalité\n⚡ **${ini.toLocaleString("fr-FR")}** Ini · **${invo}** Invo · **${cc}%** Crit`,
                    inline: true,
                });
            }

            // 2. 🌀 Éléments & Puissance
            if (pd?.elements) {
                const elNames: Record<string, string> = {
                    fo: "Terre",
                    in: "Feu",
                    ch: "Eau",
                    ag: "Air",
                    pu: "Puissance",
                    sa: "Sagesse",
                };
                const activeElements: string[] = [];
                Object.entries(pd.elements).forEach(([key, val]) => {
                    if (val && Number(val) > 0) {
                        const label = elNames[key] || key;
                        activeElements.push(`**+${val}** ${label}`);
                    }
                });
                if (activeElements.length > 0) {
                    fields.push({
                        name: "🌀 Éléments principaux",
                        value: activeElements.join("\n"),
                        inline: true,
                    });
                }
            }

            // 3. 🛡️ Résistances %
            if (pd?.resists) {
                const r = pd.resists;
                fields.push({
                    name: "🛡️ Résistances %",
                    value: `⚪ **${r.neutre || 0}%** N  |  🟤 **${r.terre || 0}%** T  |  🔴 **${r.feu || 0}%** F\n🔵 **${r.eau || 0}%** E  |  🟢 **${r.air || 0}%** A`,
                    inline: false,
                });
            }

            // 4. 🎒 Équipements équipés
            if (pd?.items && typeof pd.items === "object") {
                const itemNames: string[] = [];
                Object.values(pd.items).forEach((it: any) => {
                    if (it && it.name) {
                        itemNames.push(`• ${it.name}`);
                    }
                });
                if (itemNames.length > 0) {
                    let itemsStr = itemNames.join("\n");
                    if (itemsStr.length > 1000) {
                        itemsStr = itemsStr.slice(0, 980) + "\n• ... et autres équipements";
                    }
                    fields.push({
                        name: `🎒 Équipements (${itemNames.length})`,
                        value: itemsStr,
                        inline: false,
                    });
                }
            }

            // 5. ✨ Panoplies actives
            if (Array.isArray(pd?.cloths) && pd.cloths.length > 0) {
                const clothStr = pd.cloths.map((c: any) => `• **${c.name}** (${c.count}/${c.total})`).join("\n");
                if (clothStr.length <= 1024) {
                    fields.push({
                        name: "✨ Panoplies actives",
                        value: clothStr,
                        inline: false,
                    });
                }
            }

            // 6. 🏷️ Tags
            if (build.tags && build.tags.length > 0) {
                fields.push({
                    name: "🏷️ Tags",
                    value: build.tags.map((t: string) => `\`${t}\``).join(" "),
                    inline: true,
                });
            }
        } else {
            // Fetch skin from DB with Guild isolation
            const skin = await db.userSkin.findFirst({
                where: { 
                    id: itemId,
                    profile: { guildId: guildConfig?.id }
                },
                include: { profile: { select: { pseudoDofus: true, discordNickname: true } } }
            });
            if (!skin) return { success: false, error: "Skin introuvable" };

            // --- OPPORTUNISTIC RE-SCRAPE ---
            // If thumbnailUrl is missing, empty or relative, try to re-scrape the skin metadata
            // to fetch the image before sending to Discord.
            if (!skin.thumbnailUrl || !skin.thumbnailUrl.trim() || (!skin.thumbnailUrl.startsWith("http://") && !skin.thumbnailUrl.startsWith("https://") && !skin.thumbnailUrl.startsWith("//"))) {
                try {
                    const { scrapeSkinMetadata } = await import("./skin-actions");
                    const freshData = await scrapeSkinMetadata(skin.url);
                    if (freshData.thumbnailUrl) {
                        // Update DB cache for future shares
                        await db.userSkin.update({
                            where: { id: skin.id },
                            data: { thumbnailUrl: freshData.thumbnailUrl }
                        }).catch(() => {});
                        skin.thumbnailUrl = freshData.thumbnailUrl;
                    }
                } catch {
                    // Scrape failed, continue with no image
                }
            }

            itemName = skin.name;
            authorName = skin.profile.pseudoDofus || skin.profile.discordNickname || authorName;
            embedTitle = `✨ Skin : ${skin.name}`;
            embedUrl = skin.url;
            embedDescription = `Look partagé par **${authorName}**.`;
            
            // Premium UI 2026: Large image for the skin + Provider icon as thumbnail
            let rawImage = skin.thumbnailUrl?.trim();
            if (rawImage) {
                embedImage = resolveDiscordImage(rawImage, skin.url);
            } else {
                embedImage = undefined;
            }

            // Set valid thumbnail: class icon if available, otherwise SigilOS logo
            const skinClassId = (skin.metadata as any)?.class;
            const skinClassNum = skinClassId ? Number(skinClassId) : null;
            embedThumbnail = skinClassNum 
                ? `${appUrl}/assets/dofus/classes/${skinClassNum === 19 ? 20 : skinClassNum}.png`
                : `${appUrl}/assets/ui/logo-v2.png`;
            
            if ((skin.metadata as any)?.class) {
                const classData = DOFUS_CLASSES.find(c => {
                    const match = c.icon.match(/\/(\d+)\.png$/);
                    return match && match[1] === String((skin.metadata as any).class);
                });
                fields.push({ name: "Classe", value: classData ? classData.name : String((skin.metadata as any).class), inline: true });
            }
            if ((skin.metadata as any)?.gender) {
                fields.push({ name: "Sexe", value: String((skin.metadata as any).gender), inline: true });
            }
            if (Array.isArray(skin.equipment) && skin.equipment.length > 0) {
                const itemsList = skin.equipment.map((eq: any) => `• ${eq.name}${eq.type ? ` *(${eq.type})*` : ''}`).join("\n");
                if (itemsList.length <= 1024) {
                    fields.push({ name: "Équipements", value: itemsList, inline: false });
                }
            }

        }

        // 4. Determine Channel Type and Send
        const channelInfo = await fetchChannel(channelId);
        if (!channelInfo) return { success: false, error: "Impossible de joindre le salon Discord." };

        const embedOptions = {
            embedTitle,
            embedDescription,
            embedUrl,
            embedThumbnail,
            embedImage, // Large image added
            embedColor: type === "STUFF" ? 0x10b981 : 0xec4899,
            fields,
            embedFooter: `Partagé depuis SigilOS · ${new Date().toLocaleDateString()}`
        };

        let shareResult: any = null;
        try {
            if (channelInfo.type === 15) {
                // FORUM
                shareResult = await createForumPost(channelId, itemName, `Nouveau partage de ${type.toLowerCase()}`, embedOptions);
            } else {
                // TEXT CHANNEL
                shareResult = await sendChannelMessage(channelId, "", embedOptions);
            }
            logger.info(`[Gallery Share] Success: ${type} ${itemId} shared on channel ${channelId}. Result ID: ${channelInfo.type === 15 ? shareResult?.messageId : shareResult}`);
        } catch (discordError) {
            logger.error("[Gallery Share] Discord API Error:", { discordError });
            return { success: false, error: "Le salon Discord a refusé le message ou est mal configuré." };
        }

        // 5. Update last share time and SAVE discordMessageId
        const messageId = channelInfo.type === 15 ? shareResult?.messageId : shareResult;
        
        // Safety check to avoid Prisma errors if messageId is somehow weird
        if (!messageId || typeof messageId !== 'string') {
            logger.warn("[Gallery Share] No valid messageId returned from Discord, skipped DB link save.");
        }
        
        if (type === "STUFF") {
            // Find and update the JSON entry
            const profile = await db.userProfile.findUnique({
                where: { id: user.profileId },
                select: { dofusBookLinks: true }
            });
            const links = (profile?.dofusBookLinks as any[]) || [];
            const updatedLinks = links.map(l => l.id === itemId ? { ...l, discordMessageId: messageId } : l);
            
            await db.userProfile.update({
                where: { id: user.profileId },
                data: { 
                    dofusBookLinks: updatedLinks as any,
                    lastGalleryShareAt: new Date() 
                }
            });
        } else {
            // Update the column in UserSkin
            await db.userSkin.update({
                where: { id: itemId },
                data: { discordMessageId: messageId }
            });
            
            await db.userProfile.update({
                where: { id: user.profileId },
                data: { lastGalleryShareAt: new Date() }
            });
        }

        revalidatePath(`/dashboard/${guildId}/galerie-stuff`);

        return { success: true };
    } catch (error) {
        logger.error("Share Gallery Item Error:", { error });
        return { success: false, error: "Erreur lors du partage sur Discord" };
    }
}

/**
 * Sync deletion from Discord to Dashboard
 * Triggered by MESSAGE_DELETE webhook
 */
export async function handleDiscordGalleryDelete(discordGuildId: string, discordMessageId: string): Promise<void> {
    try {
        // 1. Try to find and delete in UserSkin
        const skin = await db.userSkin.findFirst({
            where: { discordMessageId },
            select: { id: true }
        });

        if (skin) {
            await db.userSkin.delete({ where: { id: skin.id } });
            logger.info(`[Gallery Sync] Deleted skin ${skin.id} after Discord message deletion`);
            revalidatePath(`/dashboard/${discordGuildId}/galerie-stuff`);
            return;
        }

        // 2. Try to find in UserProfile (JSON dofusBookLinks)
        // Find the guild internal ID first
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { id: true }
        });
        if (!guild) return;

        // Fetch all active profiles in the guild
        const profiles = await db.userProfile.findMany({
            where: { guildId: guild.id },
            select: { id: true, dofusBookLinks: true }
        });

        for (const profile of profiles) {
            const links = (profile.dofusBookLinks as any[]) || [];
            const found = links.find(l => l.discordMessageId === discordMessageId);
            if (found) {
                const updatedLinks = links.filter(l => l.discordMessageId !== discordMessageId);
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: { dofusBookLinks: updatedLinks as any }
                });
                logger.info(`[Gallery Sync] Removed stuff link from profile ${profile.id} after Discord message deletion`);
                revalidatePath(`/dashboard/${discordGuildId}/galerie-stuff`);
                return;
            }
        }
    } catch (error) {
        logger.error("[Gallery Sync] Deletion sync error:", { error });
    }
}
