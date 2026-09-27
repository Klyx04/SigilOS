/**
 * Rappel automatique H-1 pour les **événements non-raid** du calendrier.
 *
 * Couvre : SONGES_RUN, DUNGEON_FARM, SESSION_MISSIONS, EVENT_GUILD, SORTIE_FARM,
 *          GUILD_MISSION, SOCIAL, OTHERS (tout type sauf RAID_OFFICIAL géré par
 *          `raid-reminder-service.ts`).
 *
 * Demande user (28/09/2026) : « produis un rappel auto 1 h avant pour les posts
 * DJ/quêtes/songes/event calendrier ».
 *
 * Invariants :
 *  1. Un seul rappel par événement (`metadata.eventReminderSentAt`).
 *  2. Ignoré si `startDate` est null (post sans date = planif indéfinie).
 *  3. Silence 30 min après un rappel MANUEL (`lastRemindedAt`).
 *  4. Ping uniquement des inscrits REGISTERED + CONFIRMED — jamais de rôles.
 *  5. Sans `calendarNotifyChannelId` configuré → pas de ping Discord.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/utils";
import { sendChannelMessage } from "@/server/discord";
import { buildRaidReminderMentions, raidReminderLeadLabel, resolveRaidReminderLeadMinutes, RAID_REMINDER_MANUAL_MUTE_MS } from "@/lib/raid-reminder";

/** Fenêtre de scan : 24 h max (couvre tous les notifyBefore possibles). */
const SCAN_HORIZON_MS = 24 * 60 * 60 * 1000;

/** Types d'événements gérés par ce service (RAID_OFFICIAL → raid-reminder-service). */
const EVENT_TYPES_HANDLED = [
    "SONGES_RUN",
    "DUNGEON_FARM",
    "SESSION_MISSIONS",
    "EVENT_GUILD",
    "SORTIE_FARM",
    "GUILD_MISSION",
    "ALMANAX_BONUS",
    "OFFICIAL_RESET",
    "SOCIAL",
    "OTHERS",
];

const TYPE_META: Record<string, { emoji: string; color: number; label: string }> = {
    SONGES_RUN:       { emoji: "🌙", color: 0x6366f1, label: "Songes" },
    DUNGEON_FARM:     { emoji: "🏰", color: 0xec4899, label: "Donjon Farm" },
    SESSION_MISSIONS: { emoji: "🎯", color: 0x3b82f6, label: "Missions" },
    EVENT_GUILD:      { emoji: "🎉", color: 0x8b5cf6, label: "Événement" },
    SORTIE_FARM:      { emoji: "🌾", color: 0x22c55e, label: "Farm" },
    GUILD_MISSION:    { emoji: "📋", color: 0x06b6d4, label: "Mission Guilde" },
    ALMANAX_BONUS:    { emoji: "✨", color: 0xf59e0b, label: "Almanax" },
    OFFICIAL_RESET:   { emoji: "🔄", color: 0x64748b, label: "Reset" },
    SOCIAL:           { emoji: "🍻", color: 0xf97316, label: "Social" },
    OTHERS:           { emoji: "📅", color: 0x9333ea, label: "Événement" },
};

export type EventReminderOutcome = {
    sent: boolean;
    reason: string;
    pinged: number;
    leadMinutes?: number;
    messageId?: string | null;
};

export type EventReminderRunSummary = {
    scanned: number;
    sent: number;
    failed: number;
    pinged: number;
    skipped: Record<string, number>;
    reminders: { eventId: string; title: string; pinged: number; leadMinutes: number }[];
};

type EventRow = {
    id: string;
    guildId: string;
    title: string;
    type: string;
    status: string;
    startDate: Date;
    maxParticipants: number | null;
    notifyBefore: number | null;
    discordChannelId: string | null;
    metadata: unknown;
    lastRemindedAt: Date | null;
    participants: { userId: string }[];
};

type GuildRow = {
    id: string;
    name: string | null;
    discordGuildId: string;
    calendarNotifyChannelId: string | null;
};

function shouldSendEventReminder(args: {
    event: EventRow;
    now: Date;
    channelId: string | null;
}): { send: boolean; reason: string; leadMinutes: number } {
    const { event, now, channelId } = args;
    const leadMinutes = resolveRaidReminderLeadMinutes(event.notifyBefore);

    if (!EVENT_TYPES_HANDLED.includes(event.type)) {
        return { send: false, reason: "type-not-handled", leadMinutes };
    }
    if (event.status !== "PUBLISHED") {
        return { send: false, reason: "not-published", leadMinutes };
    }
    if (!event.startDate) {
        return { send: false, reason: "no-date", leadMinutes };
    }
    if (!channelId) {
        return { send: false, reason: "no-channel", leadMinutes };
    }
    if (event.participants.length === 0) {
        return { send: false, reason: "no-participants", leadMinutes };
    }

    // Idempotence : déjà envoyé ?
    const meta = (event.metadata as Record<string, unknown> | null) || {};
    if (meta.eventReminderSentAt) {
        return { send: false, reason: "already-sent", leadMinutes };
    }

    // Silence 30 min après rappel manuel
    if (event.lastRemindedAt) {
        const sinceManual = now.getTime() - new Date(event.lastRemindedAt).getTime();
        if (sinceManual >= 0 && sinceManual < RAID_REMINDER_MANUAL_MUTE_MS) {
            return { send: false, reason: "manual-recent", leadMinutes };
        }
    }

    const msUntilStart = event.startDate.getTime() - now.getTime();
    if (msUntilStart <= 0) return { send: false, reason: "already-started", leadMinutes };
    if (msUntilStart > leadMinutes * 60 * 1000) return { send: false, reason: "too-early", leadMinutes };

    return { send: true, reason: "ok", leadMinutes };
}

async function deliverEventReminder(args: {
    guildConfig: GuildRow;
    event: EventRow;
    now: Date;
}): Promise<EventReminderOutcome> {
    const { guildConfig, event, now } = args;
    const meta = (event.metadata as Record<string, unknown> | null) || {};

    // Salon : celui de l'embed ou le salon calendrier configuré
    const channelId = event.discordChannelId || guildConfig.calendarNotifyChannelId;

    const decision = shouldSendEventReminder({ event, now, channelId });
    if (!decision.send) {
        return { sent: false, reason: decision.reason, pinged: 0, leadMinutes: decision.leadMinutes };
    }

    // Discord IDs des inscrits
    const accounts = await db.account.findMany({
        where: { userId: { in: event.participants.map((p) => p.userId) }, provider: "discord" },
        select: { providerAccountId: true },
    });
    const mentions = buildRaidReminderMentions(accounts.map((a) => a.providerAccountId));
    if (!mentions) {
        return { sent: false, reason: "no-discord-account", pinged: 0, leadMinutes: decision.leadMinutes };
    }

    const leadLabel = raidReminderLeadLabel(decision.leadMinutes);
    const startTs = Math.floor(event.startDate.getTime() / 1000);
    const dashboardUrl = `${getAppBaseUrl()}/dashboard/${guildConfig.discordGuildId}/calendar?event=${event.id}`;
    const typeMeta = TYPE_META[event.type] ?? TYPE_META.OTHERS;

    // Clé Redis unique par message (même raison que les raids : ne jamais
    // écraser la résolution d'un rappel précédent du même événement).
    const reminderMsgKey = `event-reminder:msg:${event.id}:${now.getTime()}`;
    const messageId = await sendChannelMessage(
        channelId as string,
        `${typeMeta.emoji} **Rappel — départ dans ${leadLabel}**\n${mentions}`,
        {
            embedTitle: `${typeMeta.emoji} ${event.title} — dans ${leadLabel}`,
            embedColor: 0xff6b35,
            embedUrl: dashboardUrl,
            embedFooter: `SigilOS • ${guildConfig.name ?? "Guilde"} • Seuls les inscrits sont notifiés`,
            fields: [
                { name: "⏰ Début", value: `<t:${startTs}:t> (<t:${startTs}:R>)`, inline: true },
                {
                    name: "👥 Inscrits",
                    value: `${event.participants.length}${event.maxParticipants ? `/${event.maxParticipants}` : ""}`,
                    inline: true,
                },
                { name: `${typeMeta.emoji} Type`, value: typeMeta.label, inline: true },
            ],
            storeMessageIdKey: reminderMsgKey,
            storeMessageIdTTL: 30 * 24 * 3600,
        }
    );

    if (!messageId) {
        return { sent: false, reason: "discord-refused", pinged: 0, leadMinutes: decision.leadMinutes };
    }

    const pingedCount = mentions ? mentions.split(" ").length : 0;
    const existingReminders = Array.isArray(meta.reminderMessages) ? meta.reminderMessages : [];

    await db.guildEvent
        .update({
            where: { id: event.id, guildId: guildConfig.id },
            data: {
                metadata: {
                    ...meta,
                    eventReminderSentAt: now.toISOString(),
                    reminderMessages: [...existingReminders, { channelId, messageId, messageKey: reminderMsgKey }],
                },
            },
        })
        .catch(() => null);

    logger.info("[EventReminder] Ping envoyé", {
        eventId: event.id,
        type: event.type,
        channelId,
        pinged: pingedCount,
        leadMinutes: decision.leadMinutes,
    });

    return {
        sent: true,
        reason: "sent",
        pinged: pingedCount,
        leadMinutes: decision.leadMinutes,
        messageId,
    };
}

/**
 * Passe de rappel pour **tous** les événements non-raid à venir (entrée du cron).
 */
export async function sendEventReminders(
    opts: { now?: Date; limit?: number } = {}
): Promise<EventReminderRunSummary> {
    const now = opts.now ?? new Date();
    const summary: EventReminderRunSummary = {
        scanned: 0,
        sent: 0,
        failed: 0,
        pinged: 0,
        skipped: {},
        reminders: [],
    };
    const bump = (reason: string) => {
        summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
    };

    const candidates: any[] = await (db as any).guildEvent.findMany({
        where: {
            type: { in: EVENT_TYPES_HANDLED as any },
            status: "PUBLISHED",
            startDate: { gt: now, lte: new Date(now.getTime() + SCAN_HORIZON_MS) },
        },
        select: {
            id: true,
            guildId: true,
            title: true,
            type: true,
            status: true,
            startDate: true,
            maxParticipants: true,
            notifyBefore: true,
            discordChannelId: true,
            metadata: true,
            lastRemindedAt: true,
            participants: {
                where: { status: { in: ["REGISTERED", "CONFIRMED"] } },
                select: { userId: true },
            },
            guild: { select: { discordGuildId: true } },
        },
        orderBy: { startDate: "asc" },
        take: opts.limit ?? 100,
    });

    summary.scanned = candidates.length;

    const guildCache = new Map<string, GuildRow | null>();

    for (const event of candidates) {
        const discordGuildId = event.guild?.discordGuildId;
        if (!discordGuildId) {
            bump("guild-not-found");
            continue;
        }

        let guildConfig = guildCache.get(event.guildId);
        if (guildConfig === undefined) {
            guildConfig = await db.guildConfig.findUnique({
                where: { id: event.guildId },
                select: {
                    id: true,
                    name: true,
                    discordGuildId: true,
                    calendarNotifyChannelId: true,
                },
            });
            guildCache.set(event.guildId, guildConfig);
        }
        if (!guildConfig) {
            bump("guild-not-found");
            continue;
        }

        try {
            const outcome = await deliverEventReminder({ guildConfig, event: event as any, now });
            if (outcome.sent) {
                summary.sent++;
                summary.pinged += outcome.pinged;
                summary.reminders.push({
                    eventId: event.id,
                    title: event.title,
                    pinged: outcome.pinged,
                    leadMinutes: outcome.leadMinutes ?? 0,
                });
            } else {
                bump(outcome.reason);
            }
        } catch (error) {
            summary.failed++;
            logger.error("[EventReminder] Échec du rappel", { eventId: event.id, error: String(error) });
        }
    }

    return summary;
}
