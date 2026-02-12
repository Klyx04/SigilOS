import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { updateChannelMessage, sendChannelMessage } from "@/server/discord";

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
    "OFFICIAL_RESET": "calendar_raid_official.png"
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
    OFFICIAL_RESET: { emoji: "🔄", color: 0x64748b, label: "Reset" }
};

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
    if (event.participants.length > 0) return { success: false, error: "Déjà inscrit" };

    // Check raid 1/week rule
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

    // Determine position
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

    // Update Discord Embed (Fire and Forget)
    updateDiscordEventEmbed(guildId, eventId).catch(err => console.error("Background Embed Update Error:", err));

    // Revalidate Calendar Page AND Dashboard Layout (for Ticker)
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

    const wasRegistered = participant.status === "REGISTERED";

    // Delete participation
    await db.eventParticipant.delete({
        where: { id: participant.id }
    });

    // Auto-promote first reserve if was registered
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
            // Optional: Send DM to promoted user
        }
    }

    // Reorder positions
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

    // Update Discord Embed (Fire and Forget)
    updateDiscordEventEmbed(guildId, eventId).catch(err => console.error("Background Embed Update Error:", err));

    // Revalidate Calendar Page AND Dashboard Layout (for Ticker)
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
                // Include participants count for initial render
                _count: { select: { participants: true } }
            }
        });

        if (!event) return { success: false, error: "Événement introuvable" };

        // 1. Prepare Payload
        const typeConfig = EVENT_CONFIG[event.type] || { emoji: "📅", color: 0x9333ea, label: event.type };
        const imageName = EVENT_IMAGES[event.type] || "calendar_event_guild.png";
        const publicUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.vercel.app";
        const imageUrl = `${publicUrl}/assets/calendar/${imageName}`;

        const dateStr = new Date(event.startDate).toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long' });
        const timeStr = new Date(event.startDate).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
        const endTimeStr = new Date(event.endDate).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });

        const fields = [
            { name: "📅 Date", value: dateStr.charAt(0).toUpperCase() + dateStr.slice(1), inline: true },
            { name: "⏰ Horaire", value: `${timeStr} - ${endTimeStr}`, inline: true },
            { name: "👥 Places", value: `0/${event.maxParticipants || "∞"}`, inline: true },
            { name: "🔗 Lien", value: `[Voir l'événement](${publicUrl}/dashboard/${guildId}/calendar?event=${event.id})`, inline: true },
            { name: "📝 Description", value: event.description || "*Pas de description*", inline: false },
            { name: `✅ Inscrits (0)`, value: "*Aucun inscrit*", inline: true },
            { name: `⏳ File d'attente (0)`, value: "*Personne en file d'attente*", inline: true },
        ];

        const components = [
            {
                type: 1,
                components: [
                    { type: 2, style: 1, label: "S'inscrire", emoji: { name: "✅" }, custom_id: `calendar:join:${event.id}` },
                    { type: 2, style: 4, label: "Se désinscrire", emoji: { name: "🚪" }, custom_id: `calendar:leave:${event.id}` }
                ]
            }
        ];

        // 2. Send Message
        const messageId = await sendChannelMessage(
            guildConfig.calendarNotifyChannelId,
            "",
            {
                embedTitle: `${typeConfig.emoji} ${event.title}`,
                embedColor: typeConfig.color,
                embedImage: imageUrl,
                fields: fields,
                embedFooter: "Statut: 🟢 Ouvert",
                components: components
            }
        );

        if (messageId) {
            // 3. Save Message ID and Channel ID
            await db.guildEvent.update({
                where: { id: eventId },
                data: {
                    discordMessageId: messageId,
                    discordChannelId: guildConfig.calendarNotifyChannelId,
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

        // Visual Config matches createLogic...
        const typeConfig = EVENT_CONFIG[event.type] || { emoji: "📅", color: 0x9333ea, label: event.type };
        const imageName = EVENT_IMAGES[event.type] || "calendar_event_guild.png";

        // Use a publicly accessible URL for the image (assuming we host them)
        // For now, let's assume we have a base URL. If we don't, we might need to skip image valid url.
        // We will assume 'https://sigilos.app/assets/calendar/' + imageName
        // Replace with your actual domain
        const publicUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.vercel.app";
        const imageUrl = `${publicUrl}/assets/calendar/${imageName}`;

        // Build Participant Lists
        const registered = event.participants.filter(p => p.status === "REGISTERED" || p.status === "CONFIRMED");
        const reserve = event.participants.filter(p => p.status === "RESERVE");

        // Helper to format names
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

        // Date formatting (simple)
        const dateStr = new Date(event.startDate).toLocaleDateString("fr-FR", { weekday: 'long', day: 'numeric', month: 'long' });
        const timeStr = new Date(event.startDate).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });
        const endTimeStr = new Date(event.endDate).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' });

        const fields = [
            { name: "📅 Date", value: dateStr.charAt(0).toUpperCase() + dateStr.slice(1), inline: true },
            { name: "⏰ Horaire", value: `${timeStr} - ${endTimeStr}`, inline: true },
            { name: "👥 Places", value: `${registered.length}/${event.maxParticipants || "∞"}`, inline: true },
            { name: "🔗 Lien", value: `[Voir l'événement](${publicUrl}/dashboard/${guildId}/calendar?event=${event.id})`, inline: true },
            { name: "📝 Description", value: event.description || "*Pas de description*", inline: false },
            // SEPARATED LISTS
            { name: `✅ Inscrits (${registered.length})`, value: registeredList, inline: true },
            { name: `⏳ File d'attente (${reserve.length})`, value: reserveList, inline: true },
        ];

        // Interactive Buttons
        const components = [
            {
                type: 1, // Action Row
                components: [
                    {
                        type: 2, // Button
                        style: 1, // Primary (Blurple)
                        label: "S'inscrire",
                        emoji: { name: "✅" },
                        custom_id: `calendar:join:${event.id}`
                    },
                    {
                        type: 2, // Button
                        style: 4, // Danger (Red)
                        label: "Se désinscrire",
                        emoji: { name: "🚪" },
                        custom_id: `calendar:leave:${event.id}`
                    }
                ]
            }
        ];

        await updateChannelMessage(
            event.discordChannelId,
            event.discordMessageId,
            "", // No plain content update
            {
                embedTitle: `${typeConfig.emoji} ${event.title}`,
                embedColor: typeConfig.color,
                embedImage: imageUrl,
                fields: fields,
                embedFooter: `Statut: ${event.status === "PUBLISHED" ? "🟢 Ouvert" : "🔴 Fermé"}`,
                components: components
            }
        );

    } catch (error) {
        console.error("[Calendar Service] updateDiscordEventEmbed Error:", error);
    }
}
