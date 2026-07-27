"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionResponse } from "./admin-actions";
import { sendChannelMessage, fetchGuildRoles, validateChannelBelongsToGuild } from "@/server/discord";
import { emitGuildActivity } from "./activity-actions";

const WelcomeSettingsSchema = z.object({
    guildId: z.string(),
    enabled: z.boolean(),
    channelId: z.string().nullable(),
    template: z.string().nullable(),
    discordTemplate: z.string().nullable(),
    mentionRoleId: z.string().nullable(),
    dashboardEnabled: z.boolean().default(true),
    discordEnabled: z.boolean().default(false),
});

const WelcomeBadgeSchema = z.object({
    guildId: z.string(),
    badgeName: z.string().min(1).max(50),
});

const GrantBadgeSchema = z.object({
    guildId: z.string(),
    profileId: z.string(),
    days: z.number().min(1).max(365),
});

export async function getOnboardingSettings(guildId: string) {
    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Unauthorized" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                welcomeEnabled: true,
                welcomeNotifyChannelId: true,
                welcomeMessageTemplate: true,
                welcomeDiscordMessageTemplate: true,
                welcomeMentionRoleId: true,
                welcomeDashboardEnabled: true,
                welcomeDiscordEnabled: true,
                welcomeBadgeName: true,
            }
        });

        if (!guild) return { success: false, error: "Guild not found" };

        // 3. Fetch Discord Roles for selection
        const roles = await fetchGuildRoles(guildId, { excludeManaged: true }).catch(() => []);

        return JSON.parse(JSON.stringify({
            success: true,
            data: {
                enabled: guild.welcomeEnabled,
                channelId: guild.welcomeNotifyChannelId,
                template: guild.welcomeMessageTemplate,
                discordTemplate: guild.welcomeDiscordMessageTemplate,
                mentionRoleId: guild.welcomeMentionRoleId,
                dashboardEnabled: guild.welcomeDashboardEnabled,
                discordEnabled: guild.welcomeDiscordEnabled,
                welcomeBadgeName: guild.welcomeBadgeName,
                availableRoles: roles.map(r => ({ id: r.id, name: r.name })),
            }
        }));
    } catch (e) {
        console.error("Failed to get onboarding settings", e);
        return { success: false, error: "Database error" };
    }
}

export async function updateWelcomeSettings(data: z.infer<typeof WelcomeSettingsSchema>) {
    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(data.guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error || "Unauthorized" };

    try {
        // SECURITY: Validate that the channel belongs to the guild
        if (data.channelId) {
            const isValid = await validateChannelBelongsToGuild(data.channelId, data.guildId);
            if (!isValid) {
                return { success: false, error: "Le salon Discord saisi n'appartient pas à ce serveur." };
            }
        }

        await db.guildConfig.update({
            where: { discordGuildId: data.guildId },
            data: {
                welcomeEnabled: data.enabled,
                welcomeNotifyChannelId: data.channelId,
                welcomeMessageTemplate: data.template,
                welcomeDiscordMessageTemplate: data.discordTemplate,
                welcomeMentionRoleId: data.mentionRoleId,
                welcomeDashboardEnabled: data.dashboardEnabled,
                welcomeDiscordEnabled: data.discordEnabled,
            }
        });

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateGuildCache } = await import("./user-actions");
        await invalidateGuildCache(data.guildId);

        revalidatePath(`/dashboard/${data.guildId}/admin/settings`);
        return { success: true };
    } catch (e) {
        console.error("Failed to update welcome settings", e);
        return { success: false, error: "Database error" };
    }
}

export async function updateWelcomeBadgeName(data: z.infer<typeof WelcomeBadgeSchema>) {
    const user = await getUserContext(data.guildId);
    if (!user.isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.update({
            where: { discordGuildId: data.guildId },
            data: {
                welcomeBadgeName: data.badgeName,
            },
            select: { id: true }
        });

        if (guildConfig) {
            await db.sigilRole.upsert({
                where: {
                    guildId_slug: {
                        guildId: guildConfig.id,
                        slug: "probation" // Keep internal slug for backwards compatibility if needed, or change it
                    }
                },
                update: { label: data.badgeName },
                create: {
                    guildId: guildConfig.id,
                    slug: "probation",
                    label: data.badgeName,
                    permissions: [],
                    color: "#f59e0b" // Amber 500
                }
            });
        }

        // 🛡️ CRITICAL: Invalidate Server-side memory cache
        const { invalidateGuildCache } = await import("./user-actions");
        await invalidateGuildCache(data.guildId);

        revalidatePath(`/dashboard/${data.guildId}/admin/settings`);
        revalidatePath(`/dashboard/${data.guildId}/profile`);
        return { success: true };
    } catch (e) {
        console.error("Failed to update welcome badge name", e);
        return { success: false, error: "Database error" };
    }
}

export async function grantWelcomeBadge(data: z.infer<typeof GrantBadgeSchema>) {
    const user = await getUserContext(data.guildId);
    if (!user.isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: data.guildId },
            select: { id: true, welcomeBadgeName: true }
        });
        if (!guild) return { success: false, error: "Guild not found" };

        const role = await db.sigilRole.upsert({
            where: {
                guildId_slug: {
                    guildId: guild.id,
                    slug: "probation"
                }
            },
            update: { label: guild.welcomeBadgeName },
            create: {
                guildId: guild.id,
                slug: "probation",
                label: guild.welcomeBadgeName,
                permissions: [],
                color: "#f59e0b"
            }
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + data.days);

        await db.sigilRoleGrant.upsert({
            where: {
                roleId_profileId: {
                    roleId: role.id,
                    profileId: data.profileId
                }
            },
            update: {
                expiresAt,
                revokedAt: null,
                grantedBy: user.profileId!
            },
            create: {
                roleId: role.id,
                profileId: data.profileId,
                expiresAt,
                grantedBy: user.profileId!
            }
        });

        revalidatePath(`/dashboard/${data.guildId}/profile`);
        revalidatePath(`/dashboard/${data.guildId}/members`);
        return { success: true };
    } catch (e) {
        console.error("Failed to grant welcome badge", e);
        return { success: false, error: "Database error" };
    }
}

export async function sendWelcomeMessage(guildId: string, memberProfileId: string) {
    const user = await getUserContext(guildId);
    if (!user.isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            include: { modules: true },
        });

        if (!guild) return { success: false, error: "Guild not found" };

        const memberProfile = await db.userProfile.findUnique({
            where: { id: memberProfileId },
            include: { user: true }
        });

        if (!memberProfile) return { success: false, error: "Membre introuvable" };

        const channelId = guild.welcomeNotifyChannelId;
        const template = guild.welcomeMessageTemplate || "Bienvenue {member} parmi nous !";
        const discordTemplate = guild.welcomeDiscordMessageTemplate || template;

        // 1. Emit Guild Activity (for Dashboard feed)
        await emitGuildActivity(
            guild.id,
            "NEW_MEMBER",
            memberProfile.pseudoDofus || memberProfile.discordNickname || memberProfile.user.name || "Nouveau membre",
            memberProfile.user.image,
            { message: template.replace(/{member}/g, "").replace(/{user}/g, "").replace(/{guild}/g, guild.name) }
        );

        // 2. Publish to Dashboard if configured
        if (guild.welcomeDashboardEnabled) {
            const memberName = memberProfile.pseudoDofus || memberProfile.discordNickname || memberProfile.user.name || "Nouveau membre";
            const content = template
                .replace(/{member}/g, `**${memberName}**`)
                .replace(/{user}/g, `**${memberName}**`)
                .replace(/{nickname}/g, `**${memberName}**`)
                .replace(/{guild}/g, `**${guild.name}**`)
                .replace(/{server}/g, `**${guild.name}**`);

            await db.memberWelcome.create({
                data: {
                    guildId: guild.id,
                    profileId: memberProfile.id,
                    content: content,
                }
            });
        }

        // 3. Publish to Discord if configured
        if (guild.welcomeDiscordEnabled && channelId) {
            // Fetch Discord Account ID for real mention
            const discordAccount = await db.account.findFirst({
                where: { userId: memberProfile.userId, provider: "discord" }
            });

            const memberName = memberProfile.pseudoDofus || memberProfile.discordNickname || memberProfile.user.name || "Nouveau membre";
            const memberMention = discordAccount ? `<@${discordAccount.providerAccountId}>` : `**${memberName}**`;

            // Keep the welcome text clean for the embed description
            const welcomeDescription = discordTemplate
                .replace(/{member}/g, memberMention)
                .replace(/{user}/g, memberMention)
                .replace(/{nickname}/g, memberMention)
                .replace(/{guild}/g, `**${guild.name}**`)
                .replace(/{server}/g, `**${guild.name}**`);

            // Pings go outside the embed (trigger notification)
            const mentionRoleId = guild.welcomeMentionRoleId;
            let groupPing = "";
            if (mentionRoleId === "everyone") groupPing = "@everyone";
            else if (mentionRoleId) groupPing = `<@&${mentionRoleId}>`;

            // Combine role ping and user ping for maximum attention
            const pings = [groupPing, discordAccount ? memberMention : ""].filter(Boolean).join(" ");

            await sendChannelMessage(channelId, "", {
                mentionContent: pings,
                embedTitle: `✨ Une nouvelle légende rejoint ${guild.name} !`,
                embedDescription: welcomeDescription,
                embedColor: 0xf59e0b, // Amber 500
                embedThumbnail: memberProfile.user.image || undefined,
                embedImage: (guild as any).presentationBannerUrl || undefined,
                embedFooter: `Souhaité par ${user.name} • SigilOS`,
            });
        }

        revalidatePath(`/dashboard/${guildId}`);
        return { success: true };
    } catch (e) {
        console.error("Failed to send welcome message", e);
        return { success: false, error: "Database error" };
    }
}

const IntroductionSchema = z.string().max(5000, "La présentation est trop longue (max 5000 caractères)");

export async function saveMemberIntroduction(guildId: string, introduction: string, targetUserId?: string) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Non autorisé" };

    try {
        // Validation & Sanitization
        const validation = IntroductionSchema.safeParse(introduction);
        if (!validation.success) {
            return { success: false, error: validation.error.errors[0].message };
        }

        // Simple HTML stripping to ensure double-layer security (client-side React already escapes)
        const sanitized = introduction.replace(/<[^>]*>?/gm, '').trim();

        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        // --- SECURITY: RBAC / OWNERSHIP CHECK ---
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated) return { success: false, error: "Unauthorized" };

        const effectiveUserId = (user.isSuperAdmin && targetUserId) ? targetUserId : session.user.id;
        const isOwner = effectiveUserId === session.user.id;
        const isGod = user.isSuperAdmin;

        if (!isOwner && !isGod) {
            return { success: false, error: "Vous n'avez pas la permission de modifier cette présentation." };
        }

        await db.userProfile.update({
            where: {
                userId_guildId: {
                    userId: effectiveUserId as string,
                    guildId: guild.id
                }
            },
            data: { introduction: sanitized }
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        return { success: true };
    } catch (e) {
        console.error("Failed to save introduction", e);
        return { success: false, error: "Erreur lors de la sauvegarde" };
    }
}

export async function getWelcomePosts(guildId: string) {
    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { posts: [], reactorNames: {} };

        const posts = await db.memberWelcome.findMany({
            where: { guildId: guild.id },
            include: {
                profile: {
                    include: { user: true }
                }
            },
            orderBy: { createdAt: "desc" },
            take: 50
        });

        // Collect names of all reactors for tooltips
        const allReactorIds = new Set<string>();
        posts.forEach(post => {
            const reactions = (post.reactions as Record<string, string[]>) || {};
            Object.values(reactions).flat().forEach(id => {
                if (id) allReactorIds.add(id);
            });
        });

        const reactorProfiles = await db.userProfile.findMany({
            where: { id: { in: Array.from(allReactorIds) } },
            select: { 
                id: true, 
                pseudoDofus: true, 
                discordNickname: true,
                user: { select: { name: true } } 
            }
        });

        const reactorNames: Record<string, string> = {};
        reactorProfiles.forEach(p => {
            reactorNames[p.id] = p.pseudoDofus || p.discordNickname || p.user.name || "Inconnu";
        });

        return {
            posts: JSON.parse(JSON.stringify(posts, (_, v) => typeof v === "bigint" ? v.toString() : v)),

            reactorNames
        };
    } catch (e) {
        console.error("Failed to get welcome posts", e);
        return { posts: [], reactorNames: {} };
    }
}

export async function toggleWelcomeReaction(welcomeId: string, emoji: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    // Input validation
    if (!welcomeId || typeof emoji !== "string" || emoji.length > 10) {
        return { success: false, error: "Paramètres invalides" };
    }

    try {
        const welcome = await db.memberWelcome.findUnique({
            where: { id: welcomeId },
            include: { guild: true }
        });
        if (!welcome) return { success: false, error: "Post non trouvé" };

        // FIX: Use direct DB lookup instead of getUserContext (avoids Discord API calls on every emoji click
        // which caused race conditions / "Non membre" errors under spam)
        const profile = await db.userProfile.findUnique({
            where: {
                userId_guildId: {
                    userId: session.user.id,
                    guildId: welcome.guild.id
                }
            },
            select: { id: true, status: true }
        });

        if (!profile || profile.status !== "ACTIVE") {
            return { success: false, error: "Non membre" };
        }

        const profileId = profile.id;
        const reactions = (welcome.reactions as Record<string, string[]>) ?? {};

        if (!reactions[emoji]) {
            reactions[emoji] = [profileId];
        } else {
            const index = reactions[emoji].indexOf(profileId);
            if (index > -1) {
                reactions[emoji].splice(index, 1);
                if (reactions[emoji].length === 0) delete reactions[emoji];
            } else {
                reactions[emoji].push(profileId);
            }
        }

        await db.memberWelcome.update({
            where: { id: welcomeId },
            data: { reactions }
        });

        revalidatePath(`/dashboard/${welcome.guild.discordGuildId}`);
        revalidatePath(`/dashboard/${welcome.guild.discordGuildId}/welcome`);
        return { success: true };
    } catch (e) {
        console.error("[toggleWelcomeReaction] Failed", e);
        return { success: false, error: "Erreur serveur, réessaie dans un instant." };
    }
}
