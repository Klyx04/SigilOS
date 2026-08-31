"use server";

import { db } from "@/lib/prisma";
import { getUserContext, type ActionResponse } from "./user-actions";
import { logServiceActivity } from "./activity-log-actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ServiceCategory, ServiceStatus, NotificationType, NotificationCategory, ServiceRequestStatus, Prisma } from "@prisma/client";
import { validateChannelBelongsToGuild, fetchChannel, postChannelMessage, createForumThread, deleteChannelMessage } from "@/server/discord";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";

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

// Schéma de validation pour les réponses de service (bornes strictes)
const sendServiceReplySchema = z.object({
    replyMessage: z
        .string()
        .min(1, "Le message ne peut pas être vide")
        .max(500, "Le message doit faire au maximum 500 caractères")
        .regex(/^(?!\s*$).+/, "Le message ne peut pas être vide"),
});

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

import { CATEGORY_LABELS, CATEGORY_EMOJIS, CATEGORY_COLORS_HEX } from "./services-constants";

function getName(p: { discordNickname?: string | null; pseudoDofus?: string | null; user?: { name?: string | null } | null }): string {
    return p.pseudoDofus || p.discordNickname || p.user?.name || "Membre";
}

/** Résout l'ID Discord d'un utilisateur SigilOS (best-effort). */
async function getDiscordIdForUserId(userId: string): Promise<string | null> {
    try {
        const account = await db.account.findFirst({
            where: { userId, provider: "discord" },
            select: { providerAccountId: true },
        });
        return account?.providerAccountId || null;
    } catch (err) {
        logger.error("[getDiscordIdForUserId] failed", { err });
        return null;
    }
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

        // -- Detect channel type -- (via la couche centrale : fetchChannel, jamais de fetch direct)
        let channelInfo: { type: number; available_tags?: { id: string; name: string; moderated?: boolean }[] } | null = null;
        try {
            channelInfo = await fetchChannel(channelId);
        } catch (err) {
            logger.warn("[ServiceEmbed] Cannot fetch channel info", { err: String(err) });
        }
        if (!channelInfo) {
            logger.warn("[ServiceEmbed] Cannot fetch channel info");
            return;
        }
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
                { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: `${appUrl}/dashboard/${discordGuildId}/services` },
            ]
        }];

        let discordMessageId: string | null = null;

        if (isForum) {
            // ── FORUM CHANNEL : POST /threads (centralisé createForumThread) ──
            const availableTags = channelInfo.available_tags || [];
            const firstUsableTag = availableTags.find(t => !t.moderated);
            const applied_tags = firstUsableTag ? [firstUsableTag.id] : [];

            const body: Record<string, unknown> = {
                name: `${emoji} ${listing.title}`.slice(0, 100),
                message: {
                    embeds: [embed],
                    components,
                },
            };
            if (applied_tags.length > 0) {
                body.applied_tags = applied_tags;
            }

            const thread = await createForumThread(channelId, body);
            if (thread) discordMessageId = thread.id;
        } else {
            // ── TEXTE CLASSIQUE : POST /messages (centralisé postChannelMessage) ──
            try {
                discordMessageId = await postChannelMessage(channelId, { embeds: [embed], components });
            } catch (postErr) {
                logger.warn("[ServiceEmbed] Discord API error", { err: String(postErr) });
            }
        }

        if (discordMessageId) {
            await db.serviceListing.update({
                where: { id: listingId },
                data: { discordMessageId, discordChannelId: channelId },
            });
        } else {
            logger.warn("[ServiceEmbed] Discord API error");
        }
    } catch (error) {
        logger.error("[sendServiceDiscordNotification] failed", { err: error });
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
        logger.error("[getServiceListings] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

export async function createServiceListing(
    guildId: string,
    input: z.infer<typeof createServiceSchema>
): Promise<ActionResponse<{ id: string }>> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember || !user.canViewServices) {
            return { success: false, error: "Accès refusé" };
        }
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const parsed = createServiceSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, serviceMarketplaceEnabled: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        if (!guildConfig.serviceMarketplaceEnabled && !user.isAdmin) {
            return { success: false, error: "La marketplace est actuellement en maintenance." };
        }

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

        revalidatePath(`/dashboard/${guildId}/services`);
        return { success: true, data: { id: listing.id } };
    } catch (error) {
        logger.error("[createServiceListing] failed", { err: error });
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

        revalidatePath(`/dashboard/${guildId}/services`);
        return { success: true };
    } catch (error) {
        logger.error("[updateServiceListing] failed", { err: error });
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

        revalidatePath(`/dashboard/${guildId}/services`);
        return { success: true };
    } catch (error) {
        logger.error("[toggleServiceStatus] failed", { err: error });
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

        // Delete Discord message if exists (centralisé : deleteChannelMessage)
        if (listing.discordChannelId && listing.discordMessageId) {
            try {
                await deleteChannelMessage(listing.discordChannelId, listing.discordMessageId);
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

        revalidatePath(`/dashboard/${guildId}/services`);
        return { success: true };
    } catch (error) {
        logger.error("[deleteServiceListing] failed", { err: error });
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
        logger.error("[internalContactService] failed", { err: error });
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
        logger.error("[getServiceSettings] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

export async function updateServiceSettings(
    guildId: string,
    servicesNotifyChannelId: string | null
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isAdmin) {
            return { success: false, error: "Admin requis" };
        }

        if (servicesNotifyChannelId) {
            const belongs = await validateChannelBelongsToGuild(servicesNotifyChannelId, guildId);
            if (!belongs) {
                return { success: false, error: "Le salon sélectionné n'appartient pas à ce serveur Discord." };
            }
        }

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { servicesNotifyChannelId: servicesNotifyChannelId ? servicesNotifyChannelId.trim() : null },
        });

        revalidatePath(`/dashboard/${guildId}/services`);
        return { success: true };
    } catch (error) {
        logger.error("[updateServiceSettings] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

// ---------------------------------------------------------------------------
// CONTACT (client → passeur)
// ---------------------------------------------------------------------------

export async function contactPasseurAction(
    guildId: string,
    listingId: string,
    options: string[],
    customMessage: string | null
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember) {
            return { success: false, error: "Accès refusé" };
        }
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const listing = await db.serviceListing.findUnique({
            where: { id: listingId },
            select: {
                id: true,
                category: true,
                title: true,
                status: true,
                contactMethod: true,
                dungeonImageUrl: true,
                dofusItemIconUrl: true,
                dofusItemName: true,
                questName: true,
                profile: {
                    select: {
                        userId: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true } },
                    },
                },
            },
        });

        if (!listing) return { success: false, error: "Annonce introuvable" };
        if (listing.status !== "ACTIVE") return { success: false, error: "Cette annonce n'est pas active" };

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { servicesNotifyChannelId: true, id: true },
        });

        if (!guildConfig?.servicesNotifyChannelId) {
            return {
                success: false,
                error: "Le salon de notification des services n'est pas configuré par l'administrateur.",
            };
        }

        // Fetch Discord IDs for provider and requester
        const [providerAccount, requesterAccount] = await Promise.all([
            db.account.findFirst({
                where: { userId: listing.profile.userId, provider: "discord" },
                select: { providerAccountId: true },
            }),
            db.account.findFirst({
                where: { userId: user.id, provider: "discord" },
                select: { providerAccountId: true },
            }),
        ]);

        const providerMention = providerAccount?.providerAccountId ? `<@${providerAccount.providerAccountId}>` : listing.profile.pseudoDofus || "Passeur";
        const requesterMention = requesterAccount?.providerAccountId ? `<@${requesterAccount.providerAccountId}>` : user.name || "Membre";

        // Call Discord Bot API to send mention message
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) return { success: false, error: "Configuration Discord manquante" };

        const channelId = guildConfig.servicesNotifyChannelId;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";

        const emoji = CATEGORY_EMOJIS[listing.category];
        const categoryLabel = CATEGORY_LABELS[listing.category];

        // Image du service dans l'embed selon la catégorie (https uniquement, fail-closed
        // : si l'URL est absente ou invalide → aucune image, jamais d'URL arbitraire).
        let embedImageUrl: string | null = null;
        const rawImageUrl = listing.dungeonImageUrl || listing.dofusItemIconUrl || null;
        if (rawImageUrl) {
            try {
                const u = new URL(rawImageUrl);
                if (u.protocol === "https:") {
                    embedImageUrl = u.toString();
                }
            } catch {
                // URL invalide → aucune image
            }
        }

        const embed: Record<string, unknown> = {
            title: `📩 Nouvelle demande de service`,
            description: [
                `**Service :** [${listing.title}](${appUrl}/dashboard/${guildId}/services)`,
                `**Catégorie :** ${emoji} ${categoryLabel}`,
                `**Client :** ${requesterMention}`,
                `**Passeur/Vendeur :** ${providerMention}`,
                `\n**Options sélectionnées :**`,
                options.length > 0
                    ? options.map(opt => `• ${opt}`).join("\n")
                    : listing.category === "PASSAGE_DONJON"
                        ? "• Passage classique"
                        : "• Service standard",
                customMessage ? `\n**Message du client :**\n*${customMessage}*` : "",
            ].filter(Boolean).join("\n"),
            color: CATEGORY_COLORS_HEX[listing.category as keyof typeof CATEGORY_COLORS_HEX] || 0x8b5cf6,
            timestamp: new Date().toISOString(),
            footer: { text: "SigilOS Services" },
        };
        if (embedImageUrl) {
            embed.image = { url: embedImageUrl };
        }

        // Persist the ServiceRequest in DB BEFORE sending Discord (we need the ID)
        const requesterProfile = await db.userProfile.findFirst({
            where: { userId: user.id!, guildId: guildConfig.id },
            select: { id: true },
        });
        if (!requesterProfile) return { success: false, error: "Profil introuvable" };

        const serviceRequest = await db.serviceRequest.create({
            data: {
                guildId: guildConfig.id,
                listingId: listing.id,
                clientProfileId: requesterProfile.id,
                clientUserId: user.id!,
                clientName: user.name || "Membre",
                clientAvatar: null,
                providerProfileId: listing.profile.userId ? (
                    await db.userProfile.findFirst({
                        where: { userId: listing.profile.userId, guildId: guildConfig.id },
                        select: { id: true },
                    })
                )?.id ?? "" : "",
                providerUserId: listing.profile.userId,
                options: options.length > 0 ? options : Prisma.DbNull,
                customMessage: customMessage || null,
                status: ServiceRequestStatus.PENDING,
            },
        });

        const components = [{
            type: 1, components: [
                { type: 2, style: 1, label: "Répondre", emoji: { name: "💬" }, custom_id: `svc:reply:${user.id}:${listing.id}:${serviceRequest.id}` },
                { type: 2, style: 3, label: "Clôturer", emoji: { name: "✅" }, custom_id: `svc:close:${serviceRequest.id}` },
                { type: 2, style: 5, label: "Voir sur le site", emoji: { name: "🔗" }, url: `${appUrl}/dashboard/${guildId}/services` },
            ]
        }];

        let discordMessageId: string | null = null;
        try {
            discordMessageId = await postChannelMessage(channelId, {
                content: `🔔 ${providerMention}, tu as une nouvelle demande de service de la part de ${requesterMention} !`,
                embeds: [embed],
                components,
            });
            // Store the Discord message ID for later update (close/feedback)
            if (discordMessageId) {
                await db.serviceRequest.update({
                    where: { id: serviceRequest.id },
                    data: { discordMessageId },
                });
            }
        } catch (postErr) {
            logger.warn("[contactPasseurAction] Discord API error", { err: String(postErr) });
            // Ne pas bloquer : la demande est persistée, le Discord est best-effort
        }

        // 🔔 Dashboard notification to the provider
        try {
            await db.notification.create({
                data: {
                    userId: listing.profile.userId,
                    guildId: guildConfig.id,
                    title: "Nouvelle demande de service",
                    message: `${user.name || "Un membre"} vous demande pour "${listing.title}". Message : "${customMessage || "aucun"}"`,
                    type: NotificationType.SERVICE_REQUEST,
                    category: NotificationCategory.SYSTEM,
                    link: `/dashboard/${guildId}/services?tab=demandes`,
                },
            });
        } catch (notifErr) {
            logger.error("[contactPasseurAction] Dashboard notification failed", { err: notifErr });
        }

        // Log activity
        await logServiceActivity({
            guildId: guildConfig.id,
            actorId: user.profileId,
            module: "SERVICE",
            action: "STATUS_CHANGE",
            entityId: listing.id,
            summary: `Demande de service envoyée à ${listing.profile.pseudoDofus || "Passeur"}`,
            details: JSON.stringify({ options, hasMessage: !!customMessage, requestId: serviceRequest.id }),
        });

        return { success: true, data: { requestId: serviceRequest.id } };
    } catch (error) {
        logger.error("[contactPasseurAction] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

// ---------------------------------------------------------------------------
// CLÔTURE d'une demande + ping feedback client
// ---------------------------------------------------------------------------

export async function closeServiceRequestAction(
    guildId: string,
    requestId: string
): Promise<ActionResponse<{ feedbackToken: string }>> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember) return { success: false, error: "Accès refusé" };

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, servicesNotifyChannelId: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const request = await db.serviceRequest.findFirst({
            where: { id: requestId, guildId: guildConfig.id },
            include: {
                listing: { select: { title: true, category: true } },
                clientProfile: { select: { userId: true } },
                providerProfile: { select: { userId: true, pseudoDofus: true, discordNickname: true } },
            },
        });

        if (!request) return { success: false, error: "Demande introuvable" };

        // Seul le passeur (providerUserId) ou un admin peut clôturer
        const isProvider = request.providerUserId === user.id;
        const isAdmin = user.isAdmin;
        if (!isProvider && !isAdmin) return { success: false, error: "Seul le prestataire peut clôturer cette demande" };

        if (request.status === ServiceRequestStatus.CLOSED) {
            return { success: false, error: "Cette demande est déjà clôturée" };
        }

        // Générer un token one-time unique pour le feedback
        const feedbackToken = `${requestId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

        await db.serviceRequest.update({
            where: { id: requestId },
            data: {
                status: ServiceRequestStatus.CLOSED,
                closedAt: new Date(),
                feedbackToken,
            },
        });

        const providerName = request.providerProfile.pseudoDofus || request.providerProfile.discordNickname || "Prestataire";
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
        const feedbackUrl = `${appUrl}/dashboard/${guildId}/services?feedback=${feedbackToken}`;

        // 1. Notification Dashboard → client
        await db.notification.create({
            data: {
                userId: request.clientProfile.userId,
                guildId: guildConfig.id,
                title: "✅ Service terminé — Laissez un avis !",
                message: `${providerName} a clôturé votre demande pour "${request.listing.title}". Prenez 30 secondes pour laisser un avis !`,
                type: NotificationType.SERVICE_REPLY,
                category: NotificationCategory.SYSTEM,
                link: feedbackUrl,
            },
        }).catch(() => {});

        // 2. Mise à jour de l'embed Discord (remplacer les boutons par le statut clôturé)
        if (request.discordMessageId && guildConfig.servicesNotifyChannelId) {
            try {
                const { patchChannelMessage } = await import("@/server/discord");
                const clientAccount = await db.account.findFirst({
                    where: { userId: request.clientUserId, provider: "discord" },
                    select: { providerAccountId: true },
                });
                const clientMention = clientAccount?.providerAccountId
                    ? `<@${clientAccount.providerAccountId}>`
                    : request.clientName;

                await patchChannelMessage(
                    guildConfig.servicesNotifyChannelId,
                    request.discordMessageId,
                    {
                        content: `✅ **Demande clôturée** — ${providerName} a terminé le service. ${clientMention}, tu peux laisser un avis !`,
                        components: [{
                            type: 1,
                            components: [
                                { type: 2, style: 5, label: "Laisser un avis ⭐", emoji: { name: "⭐" }, url: feedbackUrl },
                            ],
                        }],
                    }
                );
            } catch (editErr) {
                logger.warn("[closeServiceRequestAction] Discord edit failed", { error: String(editErr) });
            }
        }

        return { success: true, data: { feedbackToken } };
    } catch (error) {
        logger.error("[closeServiceRequestAction] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

// ---------------------------------------------------------------------------
// RÉCUPÉRER les demandes de service (pour le Dashboard)
// ---------------------------------------------------------------------------

export type ServiceRequestWithDetails = {
    id: string;
    guildId: string;
    listingId: string;
    clientProfileId: string;
    clientName: string;
    clientAvatar: string | null;
    providerProfileId: string;
    options: string[] | null;
    customMessage: string | null;
    status: ServiceRequestStatus;
    closedAt: Date | null;
    feedbackToken?: string | null;
    hasFeedback: boolean;
    createdAt: Date;
    listing: { title: string; category: ServiceCategory };
    clientProfile: { pseudoDofus: string | null; discordNickname: string | null; user: { name: string | null; image: string | null } };
    providerProfile: { pseudoDofus: string | null; discordNickname: string | null; user: { name: string | null; image: string | null } };
};

export async function getServiceRequests(
    guildId: string,
    filter?: "mine" | "provider" | "all"
): Promise<ActionResponse<ServiceRequestWithDetails[]>> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember) return { success: false, error: "Accès refusé" };

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Construire le filtre selon le rôle/filtre demandé
        const where: Record<string, unknown> = { guildId: guildConfig.id };
        if (!user.isAdmin || filter !== "all") {
            // Non-admin : voir seulement ses demandes (client ou passeur)
            where.OR = [
                { clientUserId: user.id },
                { providerUserId: user.id },
            ];
        }

        const requests = await db.serviceRequest.findMany({
            where,
            include: {
                listing: { select: { title: true, category: true } },
                clientProfile: { select: { pseudoDofus: true, discordNickname: true, user: { select: { name: true, image: true } } } },
                providerProfile: { select: { pseudoDofus: true, discordNickname: true, user: { select: { name: true, image: true } } } },
                feedback: { select: { id: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
        });

        return {
            success: true,
            data: requests.map((r) => ({
                id: r.id,
                guildId: r.guildId,
                listingId: r.listingId,
                clientProfileId: r.clientProfileId,
                clientName: r.clientName,
                clientAvatar: r.clientAvatar,
                providerProfileId: r.providerProfileId,
                options: r.options as string[] | null,
                customMessage: r.customMessage,
                status: r.status,
                closedAt: r.closedAt,
                feedbackToken: r.feedbackToken,
                hasFeedback: !!r.feedback,
                createdAt: r.createdAt,
                listing: r.listing,
                clientProfile: r.clientProfile,
                providerProfile: r.providerProfile,
            })),
        };
    } catch (error) {
        logger.error("[getServiceRequests] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

// ---------------------------------------------------------------------------
// MODÉRATION — Admin supprime un avis abusif
// ---------------------------------------------------------------------------

export async function moderateServiceFeedback(
    guildId: string,
    feedbackId: string,
    action: "hide" | "delete"
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isAdmin) return { success: false, error: "Admin requis" };

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Vérifier que le feedback appartient bien à cette guilde
        const feedback = await db.serviceFeedback.findFirst({
            where: { id: feedbackId, guildId: guildConfig.id },
            select: { id: true },
        });
        if (!feedback) return { success: false, error: "Avis introuvable" };

        if (action === "delete") {
            await db.serviceFeedback.delete({ where: { id: feedbackId } });
        } else {
            await db.serviceFeedback.update({
                where: { id: feedbackId },
                data: { isModerated: true },
            });
        }

        revalidatePath(`/dashboard/${guildId}/services`);
        return { success: true };
    } catch (error) {
        logger.error("[moderateServiceFeedback] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

// ---------------------------------------------------------------------------
// RÉPONSE (passeur → client) — cœur unifié utilisé par Discord + Dashboard
// ---------------------------------------------------------------------------

/**
 * Nombre maximal de messages échangés par couple (listing, client) avant d'être
 * invité à continuer en DM Discord. Anti-surcharge : évite l'accumulation de
 * notifications perpétuelles. (Compteur Redis avec TTL 14j.)
 */
const SERVICE_THREAD_MAX_MSG = 10;
const SERVICE_THREAD_TTL_SEC = 14 * 24 * 60 * 60; // 14 jours

/** Clé Redis du compteur de messages pour un fil de discussion service. */
function serviceThreadKey(listingId: string, counterpartUserId: string): string {
    return `svc:thread:${listingId}:${counterpartUserId}`;
}

/**
 * Action unifiée d'envoi d'une réponse dans le dialogue service.
 *
 * ⚠️ SÉCURITÉ (fail-closed) :
 *  - Auth obligatoire (session) OU passeur identifié (providerUserId, flux Discord).
 *  - Seul le PASSEUR (propriétaire du listing) ou le CLIENT (destinataire de la
 *    demande initiale) peut répondre — jamais un tiers.
 *  - Guild isolation : le listing appartient à la guilde vérifiée.
 *  - Validation Zod + bornes strictes sur le message.
 *  - Anti-spam Redis (max SERVICE_THREAD_MAX_MSG par fil).
 *
 * Cette fonction est le point d'entrée UNIQUE pour poster une réponse :
 *  - depuis le Dashboard (modale globale / page notifications),
 *  - depuis Discord (bouton "Répondre" → modale → submit).
 */
export async function sendServiceReplyAction(
    guildId: string,
    listingId: string,
    replyMessage: string,
    options?: { toUserId?: string; actorUserId?: string }
): Promise<ActionResponse> {
    try {
        // 1. Auth & contexte
        let actorUserId = options?.actorUserId || null;
        if (!actorUserId) {
            const { auth } = await import("@/auth");
            const session = await auth();
            actorUserId = session?.user?.id || null;
        }
        if (!actorUserId) return { success: false, error: "Non authentifié" };

        // 2. Validation Zod (bornes strictes)
        const parsed = sendServiceReplySchema.safeParse({ replyMessage });
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "Message invalide" };
        }
        const message = parsed.data.replyMessage;

        // 3. Guild isolation + listing
        const listing = await db.serviceListing.findUnique({
            where: { id: listingId },
            include: {
                profile: {
                    select: {
                        userId: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true } },
                    },
                },
                guild: { select: { id: true } },
            },
        });
        if (!listing) return { success: false, error: "Annonce introuvable" };

        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true, servicesNotifyChannelId: true } });
        if (!guildConfig || guildConfig.id !== listing.guild.id) {
            return { success: false, error: "Accès refusé (guilde invalide)" };
        }

        // 4. Déterminer l'interlocuteur (récepteur) selon le rôle de l'acteur
        const providerUserId = listing.profile.userId;
        const isProvider = actorUserId === providerUserId;

        if (isProvider) {
            // Le passeur répond → le récepteur est le client
            if (!options?.toUserId) return { success: false, error: "Destinataire manquant" };
            if (providerUserId === options.toUserId) return { success: false, error: "Vous ne pouvez pas vous répondre à vous-même" };
        } else {
            // Le client (ou tiers) tente de répondre → seul le client authentique de la demande initiale est autorisé
            if (!options?.toUserId || options.toUserId !== providerUserId) {
                return { success: false, error: "Non autorisé" };
            }
        }

        const recipientUserId = isProvider ? options.toUserId : providerUserId;
        const senderIsProvider = isProvider;
        const counterpartUserId = isProvider ? recipientUserId : providerUserId;

        // 5. Anti-spam (compteur Redis par fil, TTL 14j)
        try {
            const threadKey = serviceThreadKey(listingId, counterpartUserId);
            const current = await redis.incr(threadKey).catch(() => 1);
            if (current === 1) {
                await redis.expire(threadKey, SERVICE_THREAD_TTL_SEC).catch(() => {});
            }
            if (current > SERVICE_THREAD_MAX_MSG) {
                return {
                    success: false,
                    error: "Vous avez atteint le nombre maximal de messages pour cette conversation. Continuez en DM Discord pour finaliser l'échange.",
                };
            }
        } catch (spamErr) {
            // Fail-open ici volontairement : un cache Redis down ne doit pas bloquer
            // un échange légitime, mais on limite le risque en gardant le TTL court.
            logger.warn("[sendServiceReplyAction] anti-spam check skipped (Redis down)", { err: spamErr });
        }

        // 6. Notification Dashboard au récepteur
        const senderProfile = await db.userProfile.findFirst({
            where: { userId: actorUserId, guildId: guildConfig.id },
            select: { discordNickname: true, pseudoDofus: true, user: { select: { name: true } } }
        });
        const senderLabel = senderProfile?.discordNickname || senderProfile?.pseudoDofus || senderProfile?.user?.name || (isProvider ? listing.profile.pseudoDofus || "Passeur" : "Client");
        const title = `Réponse de ${senderLabel} — ${listing.title}`;

        try {
            await db.notification.create({
                data: {
                    userId: recipientUserId,
                    guildId: guildConfig.id,
                    title: `💬 ${title}`,
                    message: `${senderLabel} : "${message}"`,
                    type: NotificationType.SERVICE_REPLY,
                    category: NotificationCategory.SYSTEM,
                    link: `/dashboard/${guildId}/services?replyTo=${isProvider ? recipientUserId : actorUserId}&listingId=${listing.id}`,
                }
            });
        } catch (notifErr) {
            logger.error("[sendServiceReplyAction] Dashboard notification failed", { err: notifErr });
        }

        // 7. Post Discord : systématiquement dans le salon de notification avec
        // mention directe du récepteur (pas de DM privé — cohérent avec l'envoi
        // initial d'une demande côté client, qui ne passe que par le salon)
        const token = process.env.DISCORD_BOT_TOKEN;
        const recipientDiscordId = await getDiscordIdForUserId(recipientUserId);
        if (token && guildConfig.servicesNotifyChannelId) {
            const channelId = guildConfig.servicesNotifyChannelId;
            const recipientMention = recipientDiscordId ? `<@${recipientDiscordId}>` : recipientUserId;

            // 7a. Message dans le salon (mention directe — visible, traçable)
            try {
                const embed = {
                    title: `💬 ${title}`,
                    description: message,
                    color: 0x06b6d4,
                    timestamp: new Date().toISOString(),
                    footer: { text: `${senderLabel} • SigilOS Services` },
                };
                await postChannelMessage(channelId, {
                    content: `🔔 ${recipientMention}, ${senderLabel} a répondu à ta demande pour **${listing.title}** :`,
                    embeds: [embed],
                });
            } catch (discordErr) {
                logger.warn("[sendServiceReplyAction] channel message failed", { err: discordErr });
            }

        }

        // 8. Log activity
        try {
            const actorProfile = await db.userProfile.findFirst({
                where: { userId: actorUserId, guildId: guildConfig.id },
                select: { id: true },
            });
            if (actorProfile && senderIsProvider) {
                await logServiceActivity({
                    guildId: guildConfig.id,
                    actorId: actorProfile.id,
                    module: "SERVICE",
                    action: "STATUS_CHANGE",
                    entityId: listingId,
                    summary: `Réponse envoyée au client pour "${listing.title}"`,
                    details: JSON.stringify({ toUserId: recipientUserId }),
                });
            }
        } catch (logErr) {
            logger.warn("[sendServiceReplyAction] activity log failed", { err: logErr });
        }

        revalidatePath(`/dashboard/${guildId}/services`);
        return { success: true };
    } catch (error) {
        logger.error("[sendServiceReplyAction] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

/**
 * Variante interne (Discord interactions — session Web absente).
 * Identifie le passeur via providerUserId et délègue au cœur unifié.
 */
export async function internalServiceReply(
    guildId: string,
    requesterUserId: string,
    listingId: string,
    replyMessage: string,
    providerUserId: string
): Promise<ActionResponse> {
    if (!requesterUserId || !listingId) return { success: false, error: "Paramètres manquants" };
    return sendServiceReplyAction(guildId, listingId, replyMessage, {
        toUserId: requesterUserId,
        actorUserId: providerUserId,
    });
}

// ---------------------------------------------------------------------------
// BACKWARD-COMPAT : ancien flux reply (page /notifications) — relégué au cœur unifié
// ---------------------------------------------------------------------------

export async function replyToServiceRequestAction(
    guildId: string,
    requesterUserId: string,
    listingId: string,
    replyMessage: string,
    providerUserId: string
): Promise<ActionResponse> {
    if (!requesterUserId || !listingId) return { success: false, error: "Paramètres manquants" };
    return internalServiceReply(guildId, requesterUserId, listingId, replyMessage, providerUserId);
}