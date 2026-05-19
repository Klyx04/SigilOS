import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { updateChannelMessage, sendChannelMessage, fetchChannel, createForumPost } from "@/server/discord";
import { getAppBaseUrl } from "@/lib/utils";

// Map event types to premium image filenames
const EVENT_IMAGES: Record<string, string> = {
    "RAID_OFFICIAL": "calendar_raid_official.png",
    "EVENT_GUILD": "calendar_event_guild.png",
    "SESSION_MISSIONS": "calendar_session_missions.png",
    "SORTIE_FARM": "calendar_boss_farm.png",
    // Fallbacks
    "GUILD_MISSION": "calendar_guild_mission.png",
    "SONGES_RUN": "calendar_songes_run.png",
    "DUNGEON_FARM": "calendar_dungeon_farm.png",
    "SOCIAL": "calendar_social.png",
    "ALMANAX_BONUS": "calendar_almanax_bonus.png",
    "OFFICIAL_RESET": "calendar_raid_official.png",
    "OTHERS": "calendar_autres.png"
};

// Map event types to emojis and colors
const EVENT_CONFIG: Record<string, { emoji: string; color: number; label: string }> = {
    RAID_OFFICIAL: { emoji: "⚔️", color: 0xef4444, label: "Raid 3.6" },
    EVENT_GUILD: { emoji: "🎉", color: 0x8b5cf6, label: "Event Guilde" },
    SESSION_MISSIONS: { emoji: "🎯", color: 0x3b82f6, label: "Missions Guilde" },
    SORTIE_FARM: { emoji: "🌾", color: 0x22c55e, label: "Sortie Farm" },
    // Fallbacks
    ALMANAX_BONUS: { emoji: "✨", color: 0xf59e0b, label: "Almanax" },
    GUILD_MISSION: { emoji: "📋", color: 0x06b6d4, label: "Missions" },
    SONGES_RUN: { emoji: "🌙", color: 0x6366f1, label: "Songes" },
    DUNGEON_FARM: { emoji: "🏰", color: 0xec4899, label: "Donjon" },
    SOCIAL: { emoji: "🍻", color: 0xf97316, label: "Social" },
    OFFICIAL_RESET: { emoji: "🔄", color: 0x64748b, label: "Reset" },
    OTHERS: { emoji: "💠", color: 0x94a3b8, label: "Autres" },
    // Categories for missions
    DONJON: { emoji: "⚔️", color: 0xef4444, label: "Donjon" },
    REGULATION: { emoji: "💀", color: 0x10b981, label: "Régulation" },
    ANOMALIE: { emoji: "⚡", color: 0xd946ef, label: "Anomalie" },
    SONGES: { emoji: "🌙", color: 0x22d3ee, label: "Songes" },
    EXPEDITION: { emoji: "⌛", color: 0xf59e0b, label: "Expédition" },
};

async function getDiscordId(userId: string): Promise<string | null> {
    const account = await db.account.findFirst({
        where: { userId, provider: "discord" },
        select: { providerAccountId: true },
    });
    return account?.providerAccountId || null;
}

// Rate limiting for interactions (prevent Discord embed hammer)
const interactionCooldowns = new Map<string, number>();
const INTERACTION_COOLDOWN_MS = 10 * 1000; // 10 seconds

export async function processRegistration(guildId: string, eventId: string, userId: string, data?: { classe?: string; comment?: string }) {
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true }
    });
    if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

    const event = await db.guildEvent.findUnique({
        where: { id: eventId, guildId: guildConfig.id },
        include: {
            _count: { select: { participants: { where: { status: "REGISTERED" } } } },
            participants: { where: { userId: userId } }
        }
    });

    if (!event) return { success: false, error: "Événement introuvable" };
    if (event.status !== "PUBLISHED") return { success: false, error: "Inscriptions fermées" };

    // RBAC: Raids require RAID_MEMBER permission to participate
    if (event.type === "RAID_OFFICIAL") {
        const { getUserContext } = await import("@/server/actions/user-actions");
        const ctx = await getUserContext(guildId);
        if (!ctx.isAdmin && !ctx.canJoinRaid) {
            return { success: false, error: "Permission requise: Participation aux Raids" };
        }
    }

    const cooldownKey = `${userId}:${eventId}`;
    const lastAction = interactionCooldowns.get(cooldownKey) || 0;
    if (Date.now() - lastAction < INTERACTION_COOLDOWN_MS) {
        return { success: false, error: "Doucement ! Patiente quelques secondes entre tes actions." };
    }
    interactionCooldowns.set(cooldownKey, Date.now());

    if (event.participants.length > 0) return { success: false, error: "Déjà inscrit" };

    if (event.type === "RAID_OFFICIAL") {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);

        const existingRaid = await db.eventParticipant.findFirst({
            where: {
                userId: userId,
                status: "REGISTERED",
                event: {
                    guildId: guildConfig.id,
                    type: "RAID_OFFICIAL",
                    status: "COMPLETED",
                    startDate: { gte: weekStart }
                }
            }
        });

        if (existingRaid) {
            return { success: false, error: "Tu as déjà participé à un Raid cette semaine" };
        }
    }

    const currentCount = event._count.participants;
    const maxParticipants = event.maxParticipants || 999;
    const isReserve = currentCount >= maxParticipants;

    await db.eventParticipant.create({
        data: {
            eventId,
            userId: userId,
            status: isReserve ? "RESERVE" : "REGISTERED",
            position: currentCount + 1,
            classe: data?.classe,
            comment: data?.comment
        }
    });

    updateDiscordEventEmbed(guildId, eventId).catch(err => console.error("Background Embed Update Error:", err));

    revalidatePath(`/dashboard/${guildId}/calendar`);
    revalidatePath(`/dashboard/${guildId}`, "layout");
    return { success: true, isReserve };
}

export async function processUnregistration(guildId: string, eventId: string, userId: string) {
    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: { id: true }
    });
    if (!guildConfig) return { success: false, error: "Guilde non trouvée" };

    const participant = await db.eventParticipant.findUnique({
        where: { eventId_userId: { eventId, userId } },
        include: { event: true }
    });

    if (!participant) return { success: false, error: "Non inscrit" };

    const cooldownKey = `${userId}:${eventId}`;
    const lastAction = interactionCooldowns.get(cooldownKey) || 0;
    if (Date.now() - lastAction < INTERACTION_COOLDOWN_MS) {
        return { success: false, error: "Patiente quelques secondes avant d'annuler." };
    }
    interactionCooldowns.set(cooldownKey, Date.now());

    const wasRegistered = participant.status === "REGISTERED";

    await db.eventParticipant.delete({
        where: { id: participant.id }
    });

    if (wasRegistered) {
        const firstReserve = await db.eventParticipant.findFirst({
            where: { eventId, status: "RESERVE" },
            orderBy: { position: "asc" }
        });

        if (firstReserve) {
            await db.eventParticipant.update({
                where: { id: firstReserve.id },
                data: {
                    status: "REGISTERED",
                    promotedAt: new Date()
                }
            });
        }
    }

    const participants = await db.eventParticipant.findMany({
        where: { eventId },
        orderBy: { position: "asc" }
    });

    for (let i = 0; i < participants.length; i++) {
        await db.eventParticipant.update({
            where: { id: participants[i].id },
            data: { position: i + 1 }
        });
    }

    updateDiscordEventEmbed(guildId, eventId).catch(err => console.error("Background Embed Update Error:", err));

    revalidatePath(`/dashboard/${guildId}/calendar`);
    revalidatePath(`/dashboard/${guildId}`, "layout");
    return { success: true };
}

export async function publishDiscordEvent(guildId: string, eventId: string) {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, calendarNotifyChannelId: true }
        });

        if (!guildConfig || !guildConfig.calendarNotifyChannelId) {
            return { success: false, error: "Canal Discord non configuré" };
        }

        const event = await db.guildEvent.findUnique({
            where: { id: eventId },
            include: {
                _count: { select: { participants: true } }
            }
        });

        if (!event) return { success: false, error: "Événement introuvable" };

        const typeConfig = EVENT_CONFIG[event.type] || { emoji: "📅", color: 0x9333ea, label: event.type };
        const imageName = EVENT_IMAGES[event.type] || "calendar_event_guild.png";
        const publicUrl = getAppBaseUrl();
        const imageUrl = `${publicUrl}/assets/calendar/${imageName}`;

        // Fetch Mentions from metadata
        const meta = event.metadata as any;
        const mentionRoleIds: string[] = meta?.mentionRoleIds || [];
        const roleMentions = mentionRoleIds.length > 0 
            ? mentionRoleIds.map(id => `<@&${id}>`).join(" ") 
            : "";
            
        const creatorDiscordId = await getDiscordId(event.creatorId);
        const creatorMention = creatorDiscordId ? `<@${creatorDiscordId}>` : "";
        const mentionContent = [creatorMention, roleMentions].filter(Boolean).join(" ");

        // Fetch Missions if any
        const missionIds = meta?.missionIds || [];
        let missions: any[] = [];
        let missionThumbnail: string | undefined = undefined;

        if (missionIds.length > 0) {
            missions = await db.mission.findMany({
                where: { id: { in: missionIds } },
                select: { title: true, category: true, payload: true }
            });

            if (missions.length > 0) {
                const first = missions[0];
                const p = first.payload as any;
                if (first.category === 'SONGES') {
                    const diff: string = (p.difficulty || 'Reve').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const levelMap: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };
                    const lvl = levelMap[p.level as string] || 1;
                    missionThumbnail = `${publicUrl}/assets/missions/${diff}${lvl}.png`;
                } else {
                    missionThumbnail = p.imageUrl || p.image;
                }
            }
        }

        const startTs = Math.floor(new Date(event.startDate).getTime() / 1000);
        const endTs = Math.floor(new Date(event.endDate).getTime() / 1000);

        const isRaid = event.type === "RAID_OFFICIAL";
        const raidMeta = isRaid ? (event.metadata as any) : null;

        const fields = [
            { name: "📅 Date", value: `<t:${startTs}:d> (<t:${startTs}:D>)`, inline: true },
            { name: "⏰ Horaire", value: `<t:${startTs}:t> - <t:${endTs}:t> (<t:${startTs}:R>)`, inline: true },
            { name: "👥 Places", value: `0/${event.maxParticipants || "∞"}`, inline: true },
            { name: "🔗 Lien", value: `[Voir l'événement](${publicUrl}/dashboard/${guildId}/calendar?event=${event.id})`, inline: true },
        ];

        if (isRaid && raidMeta) {
            if (raidMeta.raidLabel) fields.push({ name: "⚔️ Type de Raid", value: `**${raidMeta.raidLabel}**`, inline: true });
            if (raidMeta.raidCaptain) fields.push({ name: "👑 Capitaine", value: `**${raidMeta.raidCaptain}**`, inline: true });
            fields.push({ 
                name: "🌐 Visibilité", 
                value: raidMeta.openToExternal ? "🟢 Ouvert aux extérieurs" : "🔒 Guilde uniquement", 
                inline: true 
            });
        }

        fields.push({ name: "📝 Description", value: event.description || "*Pas de description*", inline: false });

        if (missions.length > 0) {
            const missionText = missions.map(m => {
                const catConfig = EVENT_CONFIG[m.category] || { emoji: "🎯" };
                const title = m.title || (m.payload as any).dungeonName || (m.payload as any).monsterName || "Objectif";
                return `${catConfig.emoji} **${title}**`;
            }).join("\n");
            fields.push({ name: "🎯 Objectifs de la session", value: missionText, inline: false });
        }

        fields.push(
            { name: `✅ Inscrits (0)`, value: "*Aucun inscrit*", inline: true },
            { name: `⏳ File d'attente (0)`, value: "*Personne en file d'attente*", inline: true },
        );

        const components = [
            {
                type: 1,
                components: [
                    { type: 2, style: 1, label: "S'inscrire", emoji: { name: "✅" }, custom_id: `calendar:join:${event.id}` },
                    { type: 2, style: 4, label: "Se désinscrire", emoji: { name: "🚪" }, custom_id: `calendar:leave:${event.id}` }
                ]
            }
        ];

        const messageOptions = {
            embedTitle: `${typeConfig.emoji} ${event.title}`,
            embedColor: typeConfig.color,
            embedImage: imageUrl,
            embedThumbnail: missionThumbnail,
            fields: fields,
            embedFooter: "Statut: 🟢 Ouvert",
            components: components
        };

        const channel = await fetchChannel(guildConfig.calendarNotifyChannelId);
        let messageId: string | null = null;
        let finalChannelId = guildConfig.calendarNotifyChannelId;

        if (channel && channel.type === 15) {
            const res = await createForumPost(
                guildConfig.calendarNotifyChannelId,
                `${typeConfig.emoji} ${event.title}`,
                "",
                messageOptions
            );
            if (res) {
                messageId = res.messageId;
                finalChannelId = res.id;
            }
        } else {
            messageId = await sendChannelMessage(
                guildConfig.calendarNotifyChannelId,
                mentionContent,
                messageOptions
            );
        }

        if (messageId) {
            await db.guildEvent.update({
                where: { id: eventId },
                data: {
                    discordMessageId: messageId,
                    discordChannelId: finalChannelId,
                    status: "PUBLISHED"
                }
            });
            return { success: true };
        } else {
            return { success: false, error: "Erreur lors de l'envoi Discord" };
        }

    } catch (error) {
        console.error("[Calendar Service] publishDiscordEvent Error:", error);
        return { success: false, error: "Erreur serveur" };
    }
}

export async function updateDiscordEventEmbed(guildId: string, eventId: string) {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, calendarNotifyChannelId: true }
        });
        if (!guildConfig || !guildConfig.calendarNotifyChannelId) return;

        const event = await db.guildEvent.findUnique({
            where: { id: eventId },
            include: {
                participants: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                profiles: {
                                    where: { guildId: guildConfig.id },
                                    select: { discordNickname: true }
                                }
                            }
                        }
                    },
                    orderBy: { position: "asc" }
                }
            }
        });

        if (!event || !event.discordMessageId || !event.discordChannelId) return;

        const typeConfig = EVENT_CONFIG[event.type] || { emoji: "📅", color: 0x9333ea, label: event.type };
        const imageName = EVENT_IMAGES[event.type] || "calendar_event_guild.png";
        const publicUrl = getAppBaseUrl();
        const imageUrl = `${publicUrl}/assets/calendar/${imageName}`;

        // Fetch Missions
        const meta = event.metadata as any;
        const missionIds = meta?.missionIds || [];
        let missions: any[] = [];
        let missionThumbnail: string | undefined = undefined;

        if (missionIds.length > 0) {
            missions = await db.mission.findMany({
                where: { id: { in: missionIds } },
                select: { title: true, category: true, payload: true }
            });

            if (missions.length > 0) {
                const first = missions[0];
                const p = first.payload as any;
                if (first.category === 'SONGES') {
                    const diff: string = (p.difficulty || 'Reve').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const levelMap: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };
                    const lvl = levelMap[p.level as string] || 1;
                    missionThumbnail = `${publicUrl}/assets/missions/${diff}${lvl}.png`;
                } else {
                    missionThumbnail = p.imageUrl || p.image;
                }
            }
        }

        const registered = event.participants.filter(p => p.status === "REGISTERED" || p.status === "CONFIRMED");
        const reserve = event.participants.filter(p => p.status === "RESERVE");

        const formatParticipant = (p: any) => {
            const name = p.user.profiles[0]?.discordNickname || p.user.name || "Inconnu";
            const classe = p.classe ? `(${p.classe})` : "";
            return `• ${name} ${classe}`;
        };

        const registeredList = registered.length > 0
            ? registered.map(formatParticipant).join("\n")
            : "*Aucun inscrit*";

        const reserveList = reserve.length > 0
            ? reserve.map(formatParticipant).join("\n")
            : "*Personne en file d'attente*";

        const startTs = Math.floor(new Date(event.startDate).getTime() / 1000);
        const endTs = Math.floor(new Date(event.endDate).getTime() / 1000);

        const isRaid = event.type === "RAID_OFFICIAL";
        const raidMeta = isRaid ? (event.metadata as any) : null;

        const fields = [
            { name: "📅 Date", value: `<t:${startTs}:d> (<t:${startTs}:D>)`, inline: true },
            { name: "⏰ Horaire", value: `<t:${startTs}:t> - <t:${endTs}:t> (<t:${startTs}:R>)`, inline: true },
            { name: "👥 Places", value: `${registered.length}/${event.maxParticipants || "∞"}`, inline: true },
            { name: "🔗 Lien", value: `[Voir l'événement](${publicUrl}/dashboard/${guildId}/calendar?event=${event.id})`, inline: true },
        ];

        if (isRaid && raidMeta) {
            if (raidMeta.raidLabel) fields.push({ name: "⚔️ Type de Raid", value: `**${raidMeta.raidLabel}**`, inline: true });
            if (raidMeta.raidCaptain) fields.push({ name: "👑 Capitaine", value: `**${raidMeta.raidCaptain}**`, inline: true });
            fields.push({ 
                name: "🌐 Visibilité", 
                value: raidMeta.openToExternal ? "🟢 Ouvert aux extérieurs" : "🔒 Guilde uniquement", 
                inline: true 
            });
        }

        fields.push({ name: "📝 Description", value: event.description || "*Pas de description*", inline: false });

        if (missions.length > 0) {
            const missionText = missions.map(m => {
                const catConfig = EVENT_CONFIG[m.category] || { emoji: "🎯" };
                const title = m.title || (m.payload as any).dungeonName || (m.payload as any).monsterName || "Objectif";
                return `${catConfig.emoji} **${title}**`;
            }).join("\n");
            fields.push({ name: "🎯 Objectifs de la session", value: missionText, inline: false });
        }

        fields.push(
            { name: `✅ Inscrits (${registered.length})`, value: registeredList, inline: true },
            { name: `⏳ File d'attente (${reserve.length})`, value: reserveList, inline: true },
        );

        const components = [
            {
                type: 1,
                components: [
                    { type: 2, style: 1, label: "S'inscrire", emoji: { name: "✅" }, custom_id: `calendar:join:${event.id}` },
                    { type: 2, style: 4, label: "Se désinscrire", emoji: { name: "🚪" }, custom_id: `calendar:leave:${event.id}` }
                ]
            }
        ];

        await updateChannelMessage(
            event.discordChannelId,
            event.discordMessageId,
            "",
            {
                embedTitle: `${typeConfig.emoji} ${event.title}`,
                embedColor: typeConfig.color,
                embedImage: imageUrl,
                embedThumbnail: missionThumbnail,
                fields: fields,
                embedFooter: `Statut: ${event.status === "PUBLISHED" ? "🟢 Ouvert" : "🔴 Fermé"}`,
                components: components
            }
        );

    } catch (error) {
        console.error("[Calendar Service] updateDiscordEventEmbed Error:", error);
    }
}
