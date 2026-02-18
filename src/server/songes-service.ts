import { db } from "@/lib/prisma";
import { sendChannelMessage, updateChannelMessage, validateChannelBelongsToGuild } from "@/server/discord";
import { getAppBaseUrl } from "@/lib/utils";

// ============================================
// CONSTANTS
// ============================================

const MAX_MEMBERS = 4;

const DIFFICULTY_CONFIG: Record<string, { emoji: string; color: number; label: string }> = {
    REVE_I: { emoji: "🟢", color: 0x22c55e, label: "Rêve I" },
    REVE_II: { emoji: "🟢", color: 0x22c55e, label: "Rêve II" },
    REVE_III: { emoji: "🟢", color: 0x22c55e, label: "Rêve III" },
    PARADOXE_I: { emoji: "🟡", color: 0xf59e0b, label: "Paradoxe I" },
    PARADOXE_II: { emoji: "🟡", color: 0xf59e0b, label: "Paradoxe II" },
    PARADOXE_III: { emoji: "🟡", color: 0xf59e0b, label: "Paradoxe III" },
    PARADOXE_IV: { emoji: "🟡", color: 0xf59e0b, label: "Paradoxe IV" },
    CAUCHEMAR_I: { emoji: "🔴", color: 0xdc2626, label: "Cauchemar I" },
    CAUCHEMAR_II: { emoji: "🔴", color: 0xdc2626, label: "Cauchemar II" },
    CAUCHEMAR_III: { emoji: "🔴", color: 0xdc2626, label: "Cauchemar III" },
};

const OBJECTIVE_LABELS: Record<string, string> = {
    MISSION_GUILDE: "🎯 Mission Guilde",
    DROP_LEGENDE: "💎 Drop Légende",
    SUCCES_NO_ACHAT: "🏆 Succès No Achat",
    FUN: "🎮 Fun",
    QUETE: "📜 Quête",
};

// ============================================
// HELPERS
// ============================================

async function getGuildConfig(guildId: string) {
    return db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true, songesNotifyChannelId: true },
    });
}

async function getUserDisplayName(userId: string, internalGuildId: string): Promise<string> {
    const profile = await db.userProfile.findFirst({
        where: { userId, guildId: internalGuildId },
        select: { discordNickname: true, pseudoDofus: true, user: { select: { name: true } } },
    });
    return profile?.discordNickname || profile?.pseudoDofus || profile?.user?.name || "Joueur";
}

async function getDiscordId(userId: string): Promise<string | null> {
    const account = await db.account.findFirst({
        where: { userId, provider: "discord" },
        select: { providerAccountId: true },
    });
    return account?.providerAccountId || null;
}

// ============================================
// BUILD EMBED DATA
// ============================================

async function buildRunEmbedData(guildId: string, runId: string) {
    const guildConfig = await getGuildConfig(guildId);
    if (!guildConfig) return null;

    const run = await db.dreamRun.findFirst({
        where: { id: runId, guildId },
        include: {
            members: { orderBy: { slot: "asc" } },
            waitlist: { orderBy: { position: "asc" } },
        },
    });
    if (!run) return null;

    const diffConfig = DIFFICULTY_CONFIG[run.difficulty] || { emoji: "🌙", color: 0x9333ea, label: run.difficulty };

    // Robust URL detection: prioritize app URL but fallback to NextAuth URL
    // If the context suggests we are in a beta environment, force beta link
    const publicUrl = getAppBaseUrl();
    const dashboardUrl = `${publicUrl}/dashboard/${guildId}/songes/${run.id}`;

    // Get leader name
    const leaderName = await getUserDisplayName(run.leaderId, guildConfig.id);

    // Get member names
    const memberNames: string[] = [];
    for (const m of run.members) {
        const name = await getUserDisplayName(m.userId, guildConfig.id);
        memberNames.push(`• ${name}`);
    }
    const membersList = memberNames.length > 0 ? memberNames.join("\n") : "*Aucun membre*";

    // Get waitlist names
    const waitlistNames: string[] = [];
    for (const w of run.waitlist) {
        const name = await getUserDisplayName(w.userId, guildConfig.id);
        waitlistNames.push(`• ${name}`);
    }
    const waitlistList = waitlistNames.length > 0 ? waitlistNames.join("\n") : "*Personne en file d'attente*";

    // Format objectives
    const objectivesStr = run.objectives.length > 0
        ? run.objectives.map(o => OBJECTIVE_LABELS[o] || o).join(", ")
        : "*Aucun objectif*";

    const fields = [
        { name: "💀 Difficulté", value: `${diffConfig.emoji} **${diffConfig.label}**`, inline: true },
        { name: "👑 Leader", value: `**${leaderName}**`, inline: true },
        { name: "👥 Places", value: `**${run.members.length}/${MAX_MEMBERS}**`, inline: true },
        { name: "🎯 Objectifs", value: objectivesStr, inline: false },
        { name: `✅ Équipe (${run.members.length})`, value: membersList, inline: true },
        { name: `⏳ File d'attente (${run.waitlist.length})`, value: waitlistList, inline: true },
        { name: "🔗 Dashboard", value: `[📋 Voir la Run](${dashboardUrl})`, inline: false },
    ];

    const isOpen = run.status === "RECRUITING" || run.status === "IN_PROGRESS";
    const statusText = run.status === "RECRUITING" ? "🟢 Recrutement"
        : run.status === "IN_PROGRESS" ? "🟡 En cours"
            : run.status === "COMPLETED" ? "✅ Terminée"
                : run.status === "FAILED" ? "💀 Échouée"
                    : "🔴 Abandonnée";

    const components = isOpen ? [
        {
            type: 1, // Action Row
            components: [
                {
                    type: 2, // Button
                    style: 1, // Primary (Blurple)
                    label: "Postuler",
                    emoji: { name: "📩" },
                    custom_id: `songes:join:${run.id}`,
                },
                {
                    type: 2, // Button
                    style: 4, // Danger (Red)
                    label: "Quitter",
                    emoji: { name: "🚪" },
                    custom_id: `songes:leave:${run.id}`,
                },
            ],
        },
    ] : [];

    return {
        run,
        guildConfig,
        diffConfig,
        fields,
        components,
        statusText,
        dashboardUrl,
    };
}

// ============================================
// PUBLISH DISCORD RUN
// ============================================

export async function publishDiscordRun(guildId: string, runId: string) {
    try {
        const data = await buildRunEmbedData(guildId, runId);
        if (!data) return { success: false, error: "Données introuvables" };

        const { run, guildConfig, diffConfig, fields, components, statusText } = data;

        if (!guildConfig.songesNotifyChannelId) {
            return { success: false, error: "Canal Discord Songes non configuré" };
        }

        // Validate channel belongs to this guild
        const isValid = await validateChannelBelongsToGuild(guildConfig.songesNotifyChannelId, guildId);
        if (!isValid) {
            return { success: false, error: "Canal Discord invalide" };
        }

        const messageId = await sendChannelMessage(
            guildConfig.songesNotifyChannelId,
            "",
            {
                embedTitle: `🌙 Run Songes — ${diffConfig.label}`,
                embedColor: diffConfig.color,
                embedThumbnail: "https://plutonio.fr/i/sigil_songes.png",
                fields,
                embedFooter: `Statut: ${statusText}`,
                components,
            }
        );

        if (messageId) {
            await db.dreamRun.update({
                where: { id: runId },
                data: {
                    discordMessageId: messageId,
                    discordChannelId: guildConfig.songesNotifyChannelId,
                },
            });
            return { success: true };
        }

        return { success: false, error: "Erreur lors de l'envoi Discord" };
    } catch (error) {
        console.error("[Songes Service] publishDiscordRun Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================
// UPDATE DISCORD RUN EMBED
// ============================================

export async function updateDiscordRunEmbed(guildId: string, runId: string) {
    try {
        const data = await buildRunEmbedData(guildId, runId);
        if (!data) return;

        const { run, diffConfig, fields, components, statusText } = data;

        if (!run.discordMessageId || !run.discordChannelId) return;

        await updateChannelMessage(
            run.discordChannelId,
            run.discordMessageId,
            "",
            {
                embedTitle: `🌙 Run Songes — ${diffConfig.label}`,
                embedColor: diffConfig.color,
                embedThumbnail: "https://plutonio.fr/i/sigil_songes.png",
                fields,
                embedFooter: `Statut: ${statusText}`,
                components,
            }
        );
    } catch (error) {
        console.error("[Songes Service] updateDiscordRunEmbed Error:", error);
    }
}

// ============================================
// PROCESS RUN JOIN (from Discord button)
// Creates a DreamJoinRequest (candidature), NOT a direct member add.
// The leader must accept/reject from the dashboard.
// ============================================

export async function processRunJoin(guildId: string, runId: string, userId: string, classe: string, message: string) {
    try {
        const guildConfig = await getGuildConfig(guildId);
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const run = await db.dreamRun.findFirst({
            where: { id: runId, guildId },
            include: {
                members: { orderBy: { slot: "asc" } },
            },
        });

        if (!run) return { success: false, error: "Run non trouvée" };

        // Leader cannot apply to their own run
        if (run.leaderId === userId) {
            return { success: false, error: "Tu es le leader de cette run !" };
        }

        if (run.status !== "RECRUITING" && run.status !== "IN_PROGRESS") {
            return { success: false, error: "Cette run n'accepte plus de candidatures" };
        }

        // Already a member?
        if (run.members.some(m => m.userId === userId)) {
            return { success: false, error: "Tu es déjà dans cette run" };
        }

        // Already has a pending request?
        const existingPending = await db.dreamJoinRequest.findFirst({
            where: { runId: run.id, userId, status: "PENDING" },
        });
        if (existingPending) {
            return { success: false, error: "Tu as déjà une candidature en cours pour cette run" };
        }

        // Anti-spam: check if a notification was sent to the leader about this user in the last 5 min
        const candidateName = await getUserDisplayName(userId, guildConfig.id);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentSpam = await db.notification.findFirst({
            where: {
                userId: run.leaderId,
                title: "Nouvelle candidature Songes",
                message: { contains: candidateName },
                createdAt: { gt: fiveMinutesAgo },
            },
        });

        if (recentSpam) {
            const remainingMs = 5 * 60 * 1000 - (Date.now() - recentSpam.createdAt.getTime());
            if (remainingMs > 0) {
                const minutes = Math.floor(remainingMs / 60000);
                const seconds = Math.floor((remainingMs % 60000) / 1000);
                return { success: false, error: `Patiente encore ${minutes}m ${seconds}s avant de postuler.` };
            }
        }

        // Delete old ACCEPTED/REJECTED requests to allow re-application
        await db.dreamJoinRequest.deleteMany({
            where: {
                runId: run.id,
                userId,
                status: { in: ["ACCEPTED", "REJECTED"] },
            },
        });

        // Create the candidature
        await db.dreamJoinRequest.create({
            data: {
                runId: run.id,
                userId,
                classe: classe,
                message: message || "Candidature via Discord",
            },
        });

        // Notify leader in-app
        const publicUrl = getAppBaseUrl();
        const dashboardUrl = `${publicUrl}/dashboard/${guildId}/songes/${run.id}`;

        await db.notification.create({
            data: {
                userId: run.leaderId,
                title: "Nouvelle candidature Songes",
                message: `**${candidateName}** (**${classe}**) souhaite rejoindre votre run ${run.difficulty}. [Voir la run](${dashboardUrl})`,
                type: "SYSTEM_INFO",
                link: `/dashboard/${guildId}/songes/${run.id}`,
            },
        });

        // Ping leader in Discord channel
        if (run.discordChannelId) {
            const leaderDiscordId = await getDiscordId(run.leaderId);
            const leaderMention = leaderDiscordId ? `<@${leaderDiscordId}>` : "Leader";

            await sendChannelMessage(
                run.discordChannelId,
                `📩 ${leaderMention} — **${candidateName}** (**${classe}**) a postulé pour votre run Songes ! Acceptez ou refusez depuis le [dashboard](${dashboardUrl}).`,
            );
        }

        return { success: true };
    } catch (error) {
        console.error("[Songes Service] processRunJoin Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================
// PROCESS RUN LEAVE (from Discord button)
// Handles: member leave, waitlist leave, and candidature cancel
// ============================================

export async function processRunLeave(guildId: string, runId: string, userId: string) {
    try {
        const guildConfig = await getGuildConfig(guildId);
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const run = await db.dreamRun.findFirst({
            where: { id: runId, guildId },
            include: {
                members: { orderBy: { slot: "asc" } },
                waitlist: { orderBy: { position: "asc" } },
            },
        });

        if (!run) return { success: false, error: "Run non trouvée" };

        // Cannot leave if you're the leader
        if (run.leaderId === userId) {
            return { success: false, error: "Le leader ne peut pas quitter depuis Discord. Utilise le dashboard." };
        }

        // 1. Check if member → leave + promote waitlist
        const member = run.members.find(m => m.userId === userId);
        if (member) {
            await db.dreamRunMember.delete({ where: { id: member.id } });

            // Promote first from waitlist
            const firstWaitlisted = run.waitlist[0];
            if (firstWaitlisted) {
                await db.$transaction([
                    db.dreamRunMember.create({
                        data: {
                            runId,
                            userId: firstWaitlisted.userId,
                            slot: member.slot,
                        },
                    }),
                    db.dreamWaitlist.delete({ where: { id: firstWaitlisted.id } }),
                    db.dreamWaitlist.updateMany({
                        where: { runId, position: { gt: firstWaitlisted.position } },
                        data: { position: { decrement: 1 } },
                    }),
                ]);

                // Notify promoted user in channel
                if (run.discordChannelId) {
                    const promotedDiscordId = await getDiscordId(firstWaitlisted.userId);
                    const promotedName = await getUserDisplayName(firstWaitlisted.userId, guildConfig.id);
                    const mention = promotedDiscordId ? `<@${promotedDiscordId}>` : promotedName;
                    await sendChannelMessage(
                        run.discordChannelId,
                        `🎉 ${mention} — Une place s'est libérée ! Tu as été promu dans la run Songes.`,
                    );
                }
            }

            await updateDiscordRunEmbed(guildId, runId);
            return { success: true };
        }

        // 2. Check if on waitlist → remove
        const waitlisted = run.waitlist.find(w => w.userId === userId);
        if (waitlisted) {
            await db.$transaction([
                db.dreamWaitlist.delete({ where: { id: waitlisted.id } }),
                db.dreamWaitlist.updateMany({
                    where: { runId, position: { gt: waitlisted.position } },
                    data: { position: { decrement: 1 } },
                }),
            ]);

            await updateDiscordRunEmbed(guildId, runId);
            return { success: true };
        }

        // 3. Check if has pending candidature → cancel it
        const pendingRequest = await db.dreamJoinRequest.findFirst({
            where: { runId: run.id, userId, status: "PENDING" },
        });
        if (pendingRequest) {
            await db.dreamJoinRequest.delete({ where: { id: pendingRequest.id } });
            return { success: true };
        }

        return { success: false, error: "Tu n'es ni dans cette run, ni en file d'attente, ni candidat" };
    } catch (error) {
        console.error("[Songes Service] processRunLeave Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

