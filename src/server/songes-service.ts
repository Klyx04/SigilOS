import { db } from "@/lib/prisma";
import { sendChannelMessage, updateChannelMessage, validateChannelBelongsToGuild, fetchChannel, createForumPost } from "@/server/discord";
import { getAppBaseUrl } from "@/lib/utils";
import { createNotification } from "@/server/actions/notification-actions";
import { buildClassDispatchFields, buildClassSelectRow, type DispatchEntry } from "@/server/discord-class-dispatch";

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

const EPREUVE_META: Record<string, { icon: string; label: string }> = {
    FONSOCAC: { icon: "⚔️", label: "Épreuve FONSOCAC" },
    REVERSED: { icon: "🔄", label: "Épreuve REVERSED" },
    NILEZAFF: { icon: "🌀", label: "Épreuve NILEZAFF" },
    SINJSONJ: { icon: "🐵", label: "Épreuve SINJSONJ" },
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

async function getUserProfileData(userId: string, internalGuildId: string) {
    const profile = await db.userProfile.findFirst({
        where: { userId, guildId: internalGuildId },
        select: {
            discordNickname: true,
            pseudoDofus: true,
            classe: true,
            user: { select: { name: true, image: true } }
        },
    });

    return {
        name: profile?.discordNickname || profile?.pseudoDofus || profile?.user?.name || "Joueur",
        avatar: profile?.user?.image || null,
        classe: profile?.classe || null
    };
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
            joinRequests: { orderBy: { createdAt: "desc" } },
        },
    });
    if (!run) return null;

    const diffConfig = DIFFICULTY_CONFIG[run.difficulty] || { emoji: "🌙", color: 0x9333ea, label: run.difficulty };

    // Robust URL detection: prioritize app URL but fallback to NextAuth URL
    // If the context suggests we are in a beta environment, force beta link
    const publicUrl = getAppBaseUrl();
    const dashboardUrl = `${publicUrl}/dashboard/${guildId}/songes`;

    // Get leader more info
    const leaderProfile = await getUserProfileData(run.leaderId, guildConfig.id);

    // Get member details for list — dispatch par classe (UN field inline PAR classe).
    const teamEntries: DispatchEntry[] = [];
    for (const m of run.members) {
        const p = await getUserProfileData(m.userId, guildConfig.id);
        const reqClass = run.joinRequests.find(r => r.userId === m.userId)?.classe;
        const displayClass = reqClass || p.classe;

        // Add stuff info if available
        let stuffInfo = "";
        const memberStuff = m as any;
        if (memberStuff.linkedStuffId && memberStuff.linkedStuffUrl) {
            stuffInfo = ` 🛡️ [${memberStuff.linkedStuffName || "Stuff"}](${memberStuff.linkedStuffUrl})`;
        }

        teamEntries.push({ line: `• **${p.name}**${stuffInfo}`, classe: displayClass });
    }
    const teamFields = buildClassDispatchFields(teamEntries, {
        emptyField: { name: `✅ Équipe (${run.members.length})`, value: "*Aucun membre*" },
        maxGroups: 15,
    });

    // Get waitlist details
    const waitlistLines: string[] = [];
    for (const w of run.waitlist) {
        const p = await getUserProfileData(w.userId, guildConfig.id);
        const reqClass = run.joinRequests.find(r => r.userId === w.userId)?.classe;
        const displayClass = reqClass || p.classe;
        const classTag = displayClass ? `[${displayClass}] ` : "";
        waitlistLines.push(`• ${classTag}${p.name}`);
    }
    const waitlistList = waitlistLines.length > 0 ? waitlistLines.join("\n") : "*Personne en file d'attente*";

    // Format objectives
    const objectivesStr = run.objectives.length > 0
        ? run.objectives.map(o => OBJECTIVE_LABELS[o] || o).join(", ")
        : "*Aucun objectif*";

    // Épreuve de Songe (if applicable)
    const epreuveMeta = run.epreuveCode ? EPREUVE_META[run.epreuveCode] : null;
    const embedTitle = epreuveMeta
        ? `${epreuveMeta.icon} ${epreuveMeta.label} — ${diffConfig.label}`
        : `🌙 Run Songes — ${diffConfig.label}`;

    const fields = [
        { name: "💀 Difficulté", value: `${diffConfig.emoji} **${diffConfig.label}**`, inline: true },
        { name: "👑 Leader", value: `**${leaderProfile.name}**`, inline: true },
        { name: "👥 Places", value: `**${run.members.length}/${MAX_MEMBERS}**`, inline: true },
        ...(run.scheduledAt ? [{ 
            name: "📅 Date & Heure", 
            value: `<t:${Math.floor(run.scheduledAt.getTime() / 1000)}:F> (<t:${Math.floor(run.scheduledAt.getTime() / 1000)}:R>)`, 
            inline: false 
        }] : []),
        ...(epreuveMeta ? [{ name: "🏆 Épreuve de Songe", value: `${epreuveMeta.icon} **${epreuveMeta.label}**\n*Pas de butin ni d'expérience*`, inline: false }] : []),
        { name: "🎯 Objectifs", value: objectivesStr, inline: false },
        ...teamFields,
        { name: `⏳ File d'attente (${run.waitlist.length})`, value: waitlistList, inline: true },
        { name: "🔗 Dashboard", value: `[📋 Voir la Run](${dashboardUrl})`, inline: false },
    ];

    // Tier Image mapping for Discord (absolute URL required)
    const tierImageKey = run.difficulty?.toLowerCase()
        .replace('_iv', '4')
        .replace('_iii', '3')
        .replace('_ii', '2')
        .replace('_i', '1') || 'reve1';
    const thumbnailUrl = `${publicUrl}/assets/missions/${tierImageKey}.png`;

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
        // Menu classe en PLUS des boutons : postuler avec cette classe (ou changer
        // la sienne si déjà candidat / membre).
        buildClassSelectRow(`songes:class:${run.id}`, "Choisir ma classe pour cette run…"),
    ] : [];

    return {
        run,
        guildConfig,
        diffConfig,
        fields,
        components,
        statusText,
        dashboardUrl,
        leaderProfile,
        embedTitle,
        thumbnailUrl,
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

        const roleMentions = run.mentionRoleId ? run.mentionRoleId.split(",").map(id => `<@&${id.trim()}>`).join(" ") : "";
        const creatorDiscordId = await getDiscordId(run.leaderId);
        const creatorMention = creatorDiscordId ? `<@${creatorDiscordId}>` : "";
        const mentions = [creatorMention, roleMentions].filter(Boolean).join(" ");
        
        const channel = await fetchChannel(guildConfig.songesNotifyChannelId);
        
        let messageId: string | null = null;
        let finalChannelId = guildConfig.songesNotifyChannelId;

        const messageOptions = {
            embedTitle: data.embedTitle,
            embedColor: diffConfig.color,
            embedThumbnail: data.thumbnailUrl,
            embedAuthor: {
                name: `Proposée par ${data.leaderProfile.name}`,
                iconUrl: data.leaderProfile.avatar || undefined
            },
            fields,
            embedFooter: `Statut: ${statusText}`,
            components,
        };

        if (channel && channel.type === 15) {
            // C'est un salon forum
            const res = await createForumPost(
                guildConfig.songesNotifyChannelId,
                data.embedTitle,
                mentions,
                messageOptions
            );
            if (res) {
                messageId = res.messageId;
                finalChannelId = res.id; // The thread ID
            }
        } else {
            // Salon textuel classique
            messageId = await sendChannelMessage(
                guildConfig.songesNotifyChannelId,
                mentions,
                messageOptions
            );
        }

        if (messageId) {
            await db.dreamRun.update({
                where: { id: runId },
                data: {
                    discordMessageId: messageId,
                    discordChannelId: finalChannelId,
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
                embedTitle: data.embedTitle,
                embedColor: diffConfig.color,
                embedThumbnail: data.thumbnailUrl,
                embedAuthor: {
                    name: `Proposée par ${data.leaderProfile.name}`,
                    iconUrl: data.leaderProfile.avatar || undefined
                },
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
// DELETE DISCORD RUN EMBED
// ============================================

export async function deleteDiscordRunEmbed(guildId: string, runId: string) {
    try {
        const run = await db.dreamRun.findFirst({
            where: { id: runId, guildId },
            select: { discordChannelId: true, discordMessageId: true }
        });

        if (run?.discordChannelId && run?.discordMessageId) {
            const { deleteChannelMessage } = await import("@/server/discord");
            await deleteChannelMessage(run.discordChannelId, run.discordMessageId);

            // Clean up DB references
            await db.dreamRun.update({
                where: { id: runId },
                data: { discordMessageId: null, discordChannelId: null }
            });
        }

        // Clean up join requests messages as well
        await deleteRunJoinRequestsDiscordMessages(guildId, runId);

        // Clean up reminders as well
        await deleteRunRemindersDiscordMessages(guildId, runId);
    } catch (error) {
        console.error("[Songes Service] deleteDiscordRunEmbed Error:", error);
    }
}

/**
 * Deletes all Discord embed messages sent for join requests of a specific run.
 */
export async function deleteRunJoinRequestsDiscordMessages(guildId: string, runId: string) {
    try {
        const requests = await db.dreamJoinRequest.findMany({
            where: { runId },
            select: { id: true, discordChannelId: true, discordMessageId: true }
        });

        const { deleteChannelMessage } = await import("@/server/discord");

        for (const req of requests) {
            if (req.discordChannelId && req.discordMessageId) {
                await deleteChannelMessage(req.discordChannelId, req.discordMessageId);
            }
        }
    } catch (error) {
        console.error("[Songes Service] deleteRunJoinRequestsDiscordMessages Error:", error);
    }
}

/**
 * Deletes all Discord leader reminder messages sent for a specific run.
 */
export async function deleteRunRemindersDiscordMessages(guildId: string, runId: string) {
    try {
        const reminders = await db.dreamRunReminder.findMany({
            where: { runId },
            select: { id: true, discordChannelId: true, discordMessageId: true }
        });

        const { deleteChannelMessage } = await import("@/server/discord");

        for (const rem of reminders) {
            if (rem.discordChannelId && rem.discordMessageId) {
                await deleteChannelMessage(rem.discordChannelId, rem.discordMessageId);
            }
        }
    } catch (error) {
        console.error("[Songes Service] deleteRunRemindersDiscordMessages Error:", error);
    }
}

// ============================================
// NOTIFY ALL MEMBERS (Ping)
// ============================================

export async function notifyRunMembers(guildId: string, runId: string, message: string = "Le leader demande votre attention !") {
    try {
        const embedData = await buildRunEmbedData(guildId, runId);
        if (!embedData) return { success: false, error: "Données de la run introuvables" };

        const { run, diffConfig, dashboardUrl, fields } = embedData;
        if (!run.discordChannelId) return { success: false, error: "Run ou canal introuvable" };

        const mentions: string[] = [];
        for (const member of run.members) {
            const discordId = await getDiscordId(member.userId);
            if (discordId) mentions.push(`<@${discordId}>`);
        }

        if (mentions.length === 0) return { success: false, error: "Aucun ID Discord trouvé" };

        const { sendChannelMessage } = await import("@/server/discord");

        // Build a nice reminder embed
        const messageId = await sendChannelMessage(
            run.discordChannelId,
            message, // Becomes embed.description
            {
                mentionContent: mentions.join(" "), // Triggers the ping
                embedTitle: `🔔 Rappel Songes : ${diffConfig.emoji} ${diffConfig.label}${embedData.run.epreuveCode ? ` — ${EPREUVE_META[embedData.run.epreuveCode]?.label ?? ""}` : ""}`,
                embedUrl: dashboardUrl,
                embedColor: diffConfig.color,
                fields: [
                    { name: "🛡️ Étage", value: `**${run.currentFloor || 0}**`, inline: true },
                    ...fields.filter(f =>
                        f.name.includes("Équipe") ||
                        f.name.includes("Places")
                    ),
                    ...(embedData.run.epreuveCode && EPREUVE_META[embedData.run.epreuveCode]
                        ? [{ name: "🏆 Épreuve", value: `${EPREUVE_META[embedData.run.epreuveCode].icon} **${EPREUVE_META[embedData.run.epreuveCode].label}**`, inline: true }]
                        : []),
                ],
                embedFooter: `SigilOS • Songes Infinis`,
                embedThumbnail: embedData.thumbnailUrl
            }
        );

        return { success: true, messageId };
    } catch (error) {
        console.error("[Songes Service] notifyRunMembers Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================
// CLEANUP INACTIVE RUNS
// ============================================

export async function cleanupInactiveRuns(guildId: string) {
    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

        // Find runs with no activity for 3 days
        const inactiveRuns = await db.dreamRun.findMany({
            where: {
                guildId,
                status: { in: ["RECRUITING", "IN_PROGRESS"] },
                updatedAt: { lt: threeDaysAgo }
            },
            select: { id: true }
        });

        for (const run of inactiveRuns) {
            // Remove embed first
            await deleteDiscordRunEmbed(guildId, run.id);

            // Mark as abandoned
            await db.dreamRun.update({
                where: { id: run.id },
                data: {
                    status: "ABANDONED",
                    completedAt: new Date()
                }
            });
        }
    } catch (error) {
        console.error("[Songes Service] cleanupInactiveRuns Error:", error);
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
        const requesterProfile = await getUserProfileData(userId, guildConfig.id);
        const candidateName = requesterProfile.name;
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
        const dashboardUrl = `${publicUrl}/dashboard/${guildId}/songes`;

        // Notify leader in-app
        await createNotification(
            run.leaderId,
            "SONGES_JOIN_REQUEST",
            "Candidature Songes",
            `**${candidateName}** (${classe}) • Run ${run.difficulty}`,
            `/dashboard/${guildId}/songes`,
            guildId
        );

        // Ping leader in Discord channel
        if (run.discordChannelId) {
            const leaderDiscordId = await getDiscordId(run.leaderId);
            const leaderMention = leaderDiscordId ? `<@${leaderDiscordId}>` : "Leader";

            await sendChannelMessage(
                run.discordChannelId,
                `📩 ${leaderMention} — **${candidateName}** (${classe}) a postulé ! [Dashboard](${dashboardUrl})`,
                { suppressEmbeds: true },
            );
        }

        return { success: true };
    } catch (error) {
        console.error("[Songes Service] processRunJoin Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

/**
 * Met à jour la classe d'un candidat/membre EXISTANT (menu select Discord).
 * - Candidature PENDING → classe de la demande mise à jour.
 * - Membre → classe de sa demande (ACCEPTED…) mise à jour si elle existe,
 *   sinon classe du profil (repli d'affichage de l'embed).
 * Retourne `{ updated: false }` si ni membre ni candidat : l'appelant bascule
 * alors sur `processRunJoin` (nouvelle candidature avec cette classe).
 */
export async function updateRunCandidateClass(
    guildId: string,
    runId: string,
    userId: string,
    classe: string
): Promise<{ success: boolean; error?: string; updated?: boolean }> {
    try {
        const guildConfig = await getGuildConfig(guildId);
        if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

        const run = await db.dreamRun.findFirst({
            where: { id: runId, guildId },
            include: { members: { select: { userId: true } } },
        });
        if (!run) return { success: false, error: "Run non trouvée" };
        if (run.status !== "RECRUITING" && run.status !== "IN_PROGRESS") {
            return { success: false, error: "Cette run n'accepte plus de candidatures" };
        }
        if (run.leaderId === userId) {
            return { success: false, error: "Tu es le leader de cette run !" };
        }

        const cleanClasse = classe.trim().slice(0, 30);
        const isMember = run.members.some((m) => m.userId === userId);

        const latestRequest = await db.dreamJoinRequest.findFirst({
            where: { runId: run.id, userId },
            orderBy: { createdAt: "desc" },
        });

        if (latestRequest) {
            if (latestRequest.status !== "PENDING" && !isMember) {
                // Demande traitée (refusée…) et pas membre → nouvelle candidature.
                return { success: true, updated: false };
            }
            await db.dreamJoinRequest.update({
                where: { id: latestRequest.id },
                data: { classe: cleanClasse },
            });
        } else if (isMember) {
            // Membre sans demande (ajouté à la main) → repli profil (affiché par l'embed).
            await db.userProfile.updateMany({
                where: { userId, guildId: guildConfig.id },
                data: { classe: cleanClasse },
            });
        } else {
            return { success: true, updated: false };
        }

        await updateDiscordRunEmbed(guildId, runId).catch(() => { });
        return { success: true, updated: true };
    } catch (error) {
        console.error("[Songes Service] updateRunCandidateClass Error:", error);
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
                    const promotedProfile = await getUserProfileData(firstWaitlisted.userId, guildConfig.id);
                    const promotedName = promotedProfile.name;
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

