"use server";

import { db } from "@/lib/prisma";
import { getUserContext, type ActionResponse } from "./user-actions";
import { logServiceActivity } from "./activity-log-actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ServiceCategory, ServiceStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type ServiceListingWithProfile = {
    id: string;
    guildId: string;
    profileId: string;
    category: ServiceCategory;
    status: ServiceStatus;
    title: string;
    description: string | null;
    price: string | null;
    availability: string | null;
    contactMethod: string | null;
    createdAt: Date;
    updatedAt: Date;
    // Phase 3 contextual fields
    dungeonId: string | null;
    dungeonName: string | null;
    dungeonImageUrl: string | null;
    selectedAchievements: string[] | null;
    selectedAchievementNames: string[] | null;
    questId: string | null;
    questName: string | null;
    dofusItemAnkamaId: number | null;
    dofusItemName: string | null;
    dofusItemIconUrl: string | null;
    priceTiers: { label: string; price: string }[] | null;
    craftMeta: { fmItems?: string; passTrans?: string; commandeExo?: string } | null;
    professions: string[] | null;
    profile: {
        id: string;
        pseudoDofus: string | null;
        discordNickname: string | null;
        classe: string | null;
        userId: string;
        availability: unknown | null;
        user: { name: string | null; image: string | null };
    };
};

// ---------------------------------------------------------------------------
// SCHEMAS
// ---------------------------------------------------------------------------

const createServiceSchema = z.object({
    category: z.nativeEnum(ServiceCategory),
    title: z.string().min(3, "Le titre doit faire au moins 3 caractères").max(100, "Le titre doit faire au maximum 100 caractères"),
    description: z.string().max(2000, "La description doit faire au maximum 2000 caractères").optional().nullable(),
    price: z.string().max(100, "Le prix doit faire au maximum 100 caractères").optional().nullable(),
    availability: z.string().max(200, "La disponibilité doit faire au maximum 200 caractères").optional().nullable(),
    contactMethod: z.string().max(100, "La méthode de contact doit faire au maximum 100 caractères").optional().nullable(),
    publishToDiscord: z.boolean().default(true),
    // Phase 3 contextual
    dungeonId: z.string().optional().nullable(),
    dungeonName: z.string().max(200).optional().nullable(),
    dungeonImageUrl: z.string().max(500).optional().nullable(),
    selectedAchievements: z.array(z.string()).optional().nullable(),
    selectedAchievementNames: z.array(z.string().max(200)).max(20).optional().nullable(),
    questId: z.string().optional().nullable(),
    questName: z.string().max(200).optional().nullable(),
    dofusItemAnkamaId: z.number().int().positive().optional().nullable(),
    dofusItemName: z.string().max(200).optional().nullable(),
    dofusItemIconUrl: z.string().max(500).optional().nullable(),
    priceTiers: z.array(z.object({ label: z.string().max(100), price: z.string().max(100) })).max(6).optional().nullable(),
    craftMeta: z.object({
        fmItems: z.string().max(100).optional(),
        passTrans: z.string().max(100).optional(),
        commandeExo: z.string().max(100).optional(),
    }).optional().nullable(),
    professions: z.array(z.string().max(50)).max(10).optional().nullable(),
});

const updateServiceSchema = z.object({
    title: z.string().min(3).max(100).optional(),
    description: z.string().max(2000).optional().nullable(),
    price: z.string().max(100).optional().nullable(),
    availability: z.string().max(200).optional().nullable(),
    contactMethod: z.string().max(100).optional().nullable(),
});

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

import { CATEGORY_LABELS, CATEGORY_EMOJIS, CATEGORY_COLORS_HEX } from "./services-constants";

function getName(p: { discordNickname?: string | null; pseudoDofus?: string | null; user?: { name?: string | null } | null }): string {
    return p.pseudoDofus || p.discordNickname || p.user?.name || "Membre";
}

// ---------------------------------------------------------------------------
// DISCORD EMBED
// ---------------------------------------------------------------------------

// Discord channel types
// 0 = GUILD_TEXT, 5 = GUILD_NEWS, 15 = GUILD_FORUM, 16 = GUILD_MEDIA
const FORUM_TYPES = [15, 16];

async function sendServiceDiscordNotification(
    discordGuildId: string,
    listingId: string,
    listing: {
        category: ServiceCategory;
        title: string;
        description: string | null;
        price: string | null;
        availability: string | null;
        contactMethod: string | null;
    },
    authorName: string
) {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: { servicesNotifyChannelId: true },
        });
        if (!guildConfig?.servicesNotifyChannelId) return;
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) return;

        const channelId = guildConfig.servicesNotifyChannelId;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";

        // -- Detect channel type --
        const channelInfoRes = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
            headers: { Authorization: `Bot ${token}` },
        });
        if (!channelInfoRes.ok) {
            console.error("[ServiceEmbed] Cannot fetch channel info:", await channelInfoRes.text());
            return;
        }
        const channelInfo = await channelInfoRes.json() as {
            type: number;
            available_tags?: { id: string; name: string; moderated?: boolean }[];
            flags?: number;
        };
        const isForum = FORUM_TYPES.includes(channelInfo.type);

        // -- Build embed content --
        const emoji = CATEGORY_EMOJIS[listing.category];
        const categoryLabel = CATEGORY_LABELS[listing.category];

        const descParts: string[] = [
            `**Catégorie :** ${emoji} ${categoryLabel}`,
        ];
        if (listing.description) descParts.push(`\n${listing.description}`);
        if (listing.price) descParts.push(`\n💰 **Tarif :** ${listing.price}`);
        if (listing.availability) descParts.push(`🕐 **Dispo :** ${listing.availability}`);
        if (listing.contactMethod) descParts.push(`📩 **Contact :** ${listing.contactMethod}`);

        const embed = {
            title: `${emoji} ${listing.title}`,
            description: descParts.join("\n"),
            color: CATEGORY_COLORS_HEX[listing.category as keyof typeof CATEGORY_COLORS_HEX],
            footer: { text: `Par ${authorName} • SigilOS Services` },
            timestamp: new Date().toISOString(),
        };

        const components = [{
            type: 1, components: [
                { type: 2, style: 1, label: "Contacter", emoji: { name: "📩" }, custom_id: `svc:contact:${listingId}` },
                { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: `${appUrl}/dashboard/${discordGuildId}/passages` },
            ]
        }];

        let res: Response;

        if (isForum) {
            // ── FORUM CHANNEL : POST /threads ──
            // Si le forum a des tags disponibles, on prend le 1er non-modéré pour
            // satisfaire l'éventuel requiresTag. L'admin peut ensuite retagger manuellement.
            const availableTags = channelInfo.available_tags || [];
            const firstUsableTag = availableTags.find(t => !t.moderated);
            const applied_tags = firstUsableTag ? [firstUsableTag.id] : [];

            const body: Record<string, unknown> = {
                name: `${emoji} ${listing.title}`.slice(0, 100), // thread title (max 100 chars)
                message: {
                    embeds: [embed],
                    components,
                },
            };
            if (applied_tags.length > 0) {
                body.applied_tags = applied_tags;
            }

            res = await fetch(`https://discord.com/api/v10/channels/${channelId}/threads`, {
                method: "POST",
                headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
        } else {
            // ── TEXTE CLASSIQUE : POST /messages ──
            res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                method: "POST",
                headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ embeds: [embed], components }),
            });
        }

        if (res.ok) {
            const m = await res.json() as { id: string };
            // Pour un forum, m.id est l'ID du thread (≠ messageId), on stocke quand même
            await db.serviceListing.update({
                where: { id: listingId },
                data: { discordMessageId: m.id, discordChannelId: channelId },
            });
        } else {
            const err = await res.json();
            console.error("[ServiceEmbed] Discord API error:", JSON.stringify(err));
        }
    } catch (error) {
        console.error("[sendServiceDiscordNotification]", error);
    }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getServiceListings(
    guildId: string,
    filters?: { category?: ServiceCategory; search?: string; profileId?: string }
): Promise<ActionResponse<ServiceListingWithProfile[]>> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember || !user.canViewServices) {
            return { success: false, error: "Accès refusé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const where: any = {
            guildId: guildConfig.id,
            status: { in: ["ACTIVE", "PAUSED"] as ServiceStatus[] },
        };

        if (filters?.category) {
            where.category = filters.category;
        }
        if (filters?.profileId) {
            where.profileId = filters.profileId;
        }
        if (filters?.search) {
            where.OR = [
                { title: { contains: filters.search, mode: "insensitive" } },
                { description: { contains: filters.search, mode: "insensitive" } },
            ];
        }

        const listings = await db.serviceListing.findMany({
            where,
            include: {
                profile: {
                    select: {
                        id: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        classe: true,
                        userId: true,
                        availability: true,
                        user: { select: { name: true, image: true } },
                    },
                },
            },
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        });

        return { success: true, data: listings as unknown as ServiceListingWithProfile[] };
    } catch (error) {
        console.error("[getServiceListings]", error);
        return { success: false, error: "Erreur interne" };
    }
}

export async function createServiceListing(
    guildId: string,
    input: z.infer<typeof createServiceSchema>
): Promise<ActionResponse<{ id: string }>> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember || !user.canCreateServices) {
            return { success: false, error: "Accès refusé" };
        }
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const parsed = createServiceSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Limit: max 10 active listings per user per guild
        const activeCount = await db.serviceListing.count({
            where: {
                guildId: guildConfig.id,
                profileId: user.profileId,
                status: { in: ["ACTIVE", "PAUSED"] },
            },
        });
        if (activeCount >= 10) {
            return { success: false, error: "Vous avez atteint la limite de 10 annonces actives." };
        }

        const toJson = (v: unknown) => v as import("@prisma/client").Prisma.InputJsonValue;
        const listing = await db.serviceListing.create({
            data: {
                guildId: guildConfig.id,
                profileId: user.profileId,
                category: parsed.data.category,
                title: parsed.data.title,
                description: parsed.data.description || null,
                price: parsed.data.price || null,
                availability: parsed.data.availability || null,
                contactMethod: parsed.data.contactMethod || null,
                // Phase 3 contextual
                dungeonId: parsed.data.dungeonId || null,
                dungeonName: parsed.data.dungeonName || null,
                dungeonImageUrl: parsed.data.dungeonImageUrl || null,
                selectedAchievements: parsed.data.selectedAchievements ? toJson(parsed.data.selectedAchievements) : undefined,
                selectedAchievementNames: parsed.data.selectedAchievementNames ? toJson(parsed.data.selectedAchievementNames) : undefined,
                questId: parsed.data.questId || null,
                questName: parsed.data.questName || null,
                dofusItemAnkamaId: parsed.data.dofusItemAnkamaId || null,
                dofusItemName: parsed.data.dofusItemName || null,
                dofusItemIconUrl: parsed.data.dofusItemIconUrl || null,
                priceTiers: parsed.data.priceTiers ? toJson(parsed.data.priceTiers) : undefined,
                craftMeta: parsed.data.craftMeta ? toJson(parsed.data.craftMeta) : undefined,
                professions: parsed.data.professions ? toJson(parsed.data.professions) : undefined,
            },
        });

        // Discord notification
        if (parsed.data.publishToDiscord) {
            const profile = await db.userProfile.findUnique({
                where: { id: user.profileId },
                select: { pseudoDofus: true, discordNickname: true, user: { select: { name: true } } },
            });
            const authorName = getName(profile || {});

            await sendServiceDiscordNotification(guildId, listing.id, {
                category: listing.category,
                title: listing.title,
                description: listing.description,
                price: listing.price,
                availability: listing.availability,
                contactMethod: listing.contactMethod,
            }, authorName);
        }

        // Immutable activity log
        await logServiceActivity({
            guildId: guildConfig.id,
            actorId: user.profileId,
            module: "SERVICE",
            action: "CREATED",
            entityId: listing.id,
            summary: `Service publié : ${listing.title} (${CATEGORY_LABELS[listing.category]})`,
            details: JSON.stringify({ category: listing.category, title: listing.title, price: listing.price }),
        });

        revalidatePath(`/dashboard/${guildId}/passages`);
        return { success: true, data: { id: listing.id } };
    } catch (error) {
        console.error("[createServiceListing]", error);
        return { success: false, error: "Erreur interne" };
    }
}

export async function updateServiceListing(
    guildId: string,
    listingId: string,
    input: z.infer<typeof updateServiceSchema>
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember) {
            return { success: false, error: "Accès refusé" };
        }

        const listing = await db.serviceListing.findUnique({
            where: { id: listingId },
            select: { profileId: true, guildId: true },
        });
        if (!listing) return { success: false, error: "Annonce introuvable" };
        if (listing.profileId !== user.profileId && !user.isAdmin) {
            return { success: false, error: "Vous ne pouvez modifier que vos propres annonces." };
        }

        const parsed = updateServiceSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
        }

        await db.serviceListing.update({
            where: { id: listingId },
            data: {
                ...(parsed.data.title && { title: parsed.data.title }),
                description: parsed.data.description ?? undefined,
                price: parsed.data.price ?? undefined,
                availability: parsed.data.availability ?? undefined,
                contactMethod: parsed.data.contactMethod ?? undefined,
            },
        });

        revalidatePath(`/dashboard/${guildId}/passages`);
        return { success: true };
    } catch (error) {
        console.error("[updateServiceListing]", error);
        return { success: false, error: "Erreur interne" };
    }
}

export async function toggleServiceStatus(
    guildId: string,
    listingId: string
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember) {
            return { success: false, error: "Accès refusé" };
        }

        const listing = await db.serviceListing.findUnique({
            where: { id: listingId },
            select: { profileId: true, status: true },
        });
        if (!listing) return { success: false, error: "Annonce introuvable" };
        if (listing.profileId !== user.profileId && !user.isAdmin) {
            return { success: false, error: "Vous ne pouvez modifier que vos propres annonces." };
        }

        const newStatus = listing.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
        await db.serviceListing.update({
            where: { id: listingId },
            data: { status: newStatus },
        });

        // Immutable activity log
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        if (guildConfig && user.profileId) {
            await logServiceActivity({
                guildId: guildConfig.id,
                actorId: user.profileId,
                module: "SERVICE",
                action: "STATUS_CHANGE",
                entityId: listingId,
                summary: `Service ${newStatus === "PAUSED" ? "mis en pause" : "réactivé"}`,
            });
        }

        revalidatePath(`/dashboard/${guildId}/passages`);
        return { success: true };
    } catch (error) {
        console.error("[toggleServiceStatus]", error);
        return { success: false, error: "Erreur interne" };
    }
}

export async function deleteServiceListing(
    guildId: string,
    listingId: string
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember) {
            return { success: false, error: "Accès refusé" };
        }

        const listing = await db.serviceListing.findUnique({
            where: { id: listingId },
            select: { profileId: true, discordChannelId: true, discordMessageId: true },
        });
        if (!listing) return { success: false, error: "Annonce introuvable" };
        if (listing.profileId !== user.profileId && !user.isAdmin) {
            return { success: false, error: "Seul l'auteur ou un admin peut supprimer cette annonce." };
        }

        // Delete Discord message if exists
        if (listing.discordChannelId && listing.discordMessageId) {
            try {
                const token = process.env.DISCORD_BOT_TOKEN;
                if (token) {
                    await fetch(`https://discord.com/api/v10/channels/${listing.discordChannelId}/messages/${listing.discordMessageId}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bot ${token}` },
                    });
                }
            } catch {
                // Silently fail — message may already be deleted
            }
        }

        await db.serviceListing.delete({ where: { id: listingId } });

        // Immutable activity log — log BEFORE delete uses snapshot
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        if (guildConfig && user.profileId) {
            await logServiceActivity({
                guildId: guildConfig.id,
                actorId: user.profileId,
                module: "SERVICE",
                action: "DELETED",
                entityId: listingId,
                summary: `Service supprimé (par ${user.isAdmin && listing.profileId !== user.profileId ? "admin" : "l'auteur"})`,
            });
        }

        revalidatePath(`/dashboard/${guildId}/passages`);
        return { success: true };
    } catch (error) {
        console.error("[deleteServiceListing]", error);
        return { success: false, error: "Erreur interne" };
    }
}

// ---------------------------------------------------------------------------
// INTERNAL VARIANTS (Discord interactions — no session required)
// ---------------------------------------------------------------------------

export async function internalContactService(
    listingId: string,
    contactProfileId: string,
    contactUserId: string
): Promise<ActionResponse<{ pseudo: string; contactMethod: string | null }>> {
    try {
        const listing = await db.serviceListing.findUnique({
            where: { id: listingId },
            include: {
                profile: {
                    select: {
                        pseudoDofus: true,
                        discordNickname: true,
                        userId: true,
                        user: { select: { name: true } },
                    },
                },
            },
        });

        if (!listing) return { success: false, error: "Annonce introuvable ou expirée." };
        if (listing.status !== "ACTIVE") return { success: false, error: "Cette annonce est en pause ou fermée." };

        const ownerName = getName(listing.profile);

        return {
            success: true,
            data: {
                pseudo: ownerName,
                contactMethod: listing.contactMethod,
            },
        };
    } catch (error) {
        console.error("[internalContactService]", error);
        return { success: false, error: "Erreur interne" };
    }
}

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------

export async function getServiceSettings(guildId: string): Promise<ActionResponse<{ servicesNotifyChannelId: string | null }>> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isAdmin) {
            return { success: false, error: "Admin requis" };
        }

        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { servicesNotifyChannelId: true },
        });

        return { success: true, data: { servicesNotifyChannelId: config?.servicesNotifyChannelId || null } };
    } catch (error) {
        console.error("[getServiceSettings]", error);
        return { success: false, error: "Erreur interne" };
    }
}

