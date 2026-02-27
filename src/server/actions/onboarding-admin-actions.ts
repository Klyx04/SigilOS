"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionResponse } from "./admin-actions";
import { sendChannelMessage, fetchGuildRoles } from "@/server/discord";
import { emitGuildActivity } from "./activity-actions";

const WelcomeSettingsSchema = z.object({
    guildId: z.string(),
    enabled: z.boolean(),
    channelId: z.string().nullable(),
    template: z.string().nullable(),
    mentionRoleId: z.string().nullable(),
    dashboardEnabled: z.boolean().default(true),
    discordEnabled: z.boolean().default(false),
});

const ProbationRoleSchema = z.object({
    guildId: z.string(),
    roleName: z.string().min(1).max(50),
});

const GrantProbationSchema = z.object({
    guildId: z.string(),
    profileId: z.string(),
    days: z.number().min(1).max(365),
});

export async function getOnboardingSettings(guildId: string) {
    const user = await getUserContext(guildId);
    if (!user.isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                welcomeEnabled: true,
                welcomeNotifyChannelId: true,
                welcomeMessageTemplate: true,
                welcomeMentionRoleId: true,
                welcomeDashboardEnabled: true,
                welcomeDiscordEnabled: true,
                probationRoleName: true,
            }
        });

        if (!guild) return { success: false, error: "Guild not found" };

        // 3. Fetch Discord Roles for selection
        const roles = await fetchGuildRoles(guildId, { excludeManaged: true }).catch(() => []);

        return {
            success: true,
            data: {
                enabled: guild.welcomeEnabled,
                channelId: guild.welcomeNotifyChannelId,
                template: guild.welcomeMessageTemplate,
                mentionRoleId: guild.welcomeMentionRoleId,
                dashboardEnabled: guild.welcomeDashboardEnabled,
                discordEnabled: guild.welcomeDiscordEnabled,
                probationRoleName: guild.probationRoleName,
                availableRoles: roles.map(r => ({ id: r.id, name: r.name })),
            }
        };
    } catch (e) {
        console.error("Failed to get onboarding settings", e);
        return { success: false, error: "Database error" };
    }
}

export async function updateWelcomeSettings(data: z.infer<typeof WelcomeSettingsSchema>) {
    const user = await getUserContext(data.guildId);
    if (!user.isAdmin) return { success: false, error: "Unauthorized" };

    try {
        await db.guildConfig.update({
            where: { discordGuildId: data.guildId },
            data: {
                welcomeEnabled: data.enabled,
                welcomeNotifyChannelId: data.channelId,
                welcomeMessageTemplate: data.template,
                welcomeMentionRoleId: data.mentionRoleId,
                welcomeDashboardEnabled: data.dashboardEnabled,
                welcomeDiscordEnabled: data.discordEnabled,
            }
        });

        revalidatePath(`/dashboard/${data.guildId}/admin/settings`);
        return { success: true };
    } catch (e) {
        console.error("Failed to update welcome settings", e);
        return { success: false, error: "Database error" };
    }
}

export async function updateProbationRoleName(data: z.infer<typeof ProbationRoleSchema>) {
    const user = await getUserContext(data.guildId);
    if (!user.isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const guildConfig = await db.guildConfig.update({
            where: { discordGuildId: data.guildId },
            data: {
                probationRoleName: data.roleName,
            },
            select: { id: true }
        });

        if (guildConfig) {
            await db.sigilRole.upsert({
                where: {
                    guildId_slug: {
                        guildId: guildConfig.id,
                        slug: "probation"
                    }
                },
                update: { label: data.roleName },
                create: {
                    guildId: guildConfig.id,
                    slug: "probation",
                    label: data.roleName,
                    permissions: [],
                    color: "#f59e0b" // Amber 500
                }
            });
        }

        revalidatePath(`/dashboard/${data.guildId}/admin/settings`);
        revalidatePath(`/dashboard/${data.guildId}/profile`);
        return { success: true };
    } catch (e) {
        console.error("Failed to update probation role name", e);
        return { success: false, error: "Database error" };
    }
}

export async function grantProbationRole(data: z.infer<typeof GrantProbationSchema>) {
    const user = await getUserContext(data.guildId);
    if (!user.isAdmin) return { success: false, error: "Unauthorized" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: data.guildId },
            select: { id: true, probationRoleName: true }
        });
        if (!guild) return { success: false, error: "Guild not found" };

        const role = await db.sigilRole.upsert({
            where: {
                guildId_slug: {
                    guildId: guild.id,
                    slug: "probation"
                }
            },
            update: { label: guild.probationRoleName },
            create: {
                guildId: guild.id,
                slug: "probation",
                label: guild.probationRoleName,
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
        console.error("Failed to grant probation role", e);
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

        // 1. Emit Guild Activity (for Dashboard feed)
        await emitGuildActivity(
            guild.id,
            "NEW_MEMBER",
            memberProfile.pseudoDofus || memberProfile.discordNickname || memberProfile.user.name || "Nouveau membre",
            memberProfile.user.image,
            { message: template.replace(/{member}/g, "").replace(/{guild}/g, guild.name) }
        );

        // 2. Publish to Dashboard if configured
        if (guild.welcomeDashboardEnabled) {
            const memberName = memberProfile.pseudoDofus || memberProfile.discordNickname || memberProfile.user.name || "Nouveau membre";
            const content = template
                .replace(/{member}/g, `**${memberName}**`)
                .replace(/{guild}/g, `**${guild.name}**`);

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
            const welcomeDescription = template
                .replace(/{member}/g, memberMention)
                .replace(/{guild}/g, `**${guild.name}**`);

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
                embedColor: 0x10b981, // Emerald 500
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

export async function saveMemberIntroduction(guildId: string, introduction: string) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        await db.userProfile.update({
            where: {
                userId_guildId: {
                    userId: session.user.id as string,
                    guildId: guild.id
                }
            },
            data: { introduction }
        });

        revalidatePath(`/dashboard/${guildId}/profile`);
        return { success: true };
    } catch (e) {
        console.error("Failed to save introduction", e);
        return { success: false, error: "Database error" };
    }
}

export async function getWelcomePosts(guildId: string) {
    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return [];

        return await db.memberWelcome.findMany({
            where: { guildId: guild.id },
            include: {
                profile: {
                    include: { user: true }
                }
            },
            orderBy: { createdAt: "desc" },
            take: 50
        });
    } catch (e) {
        console.error("Failed to get welcome posts", e);
        return [];
    }
}

export async function toggleWelcomeReaction(welcomeId: string, emoji: string) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    try {
        const welcome = await db.memberWelcome.findUnique({
            where: { id: welcomeId },
            include: { guild: true }
        });
        if (!welcome) return { success: false, error: "Post non trouvé" };

        const userContext = await getUserContext(welcome.guild.discordGuildId);
        if (!userContext.isMember) return { success: false, error: "Non membre" };

        const reactions = (welcome.reactions as any) || {};
        const profileId = userContext.profileId!;

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

        revalidatePath(`/dashboard/${welcome.guild.discordGuildId}/welcome`);
        return { success: true };
    } catch (e) {
        console.error("Failed to toggle reaction", e);
        return { success: false, error: "Database error" };
    }
}
