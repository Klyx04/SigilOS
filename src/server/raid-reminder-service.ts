/**
 * Rappel automatique des **raids** : un ping des **inscrits** (et d'eux seuls),
 * envoyé dans le salon du raid `notifyBefore` minutes avant le départ (60 par
 * défaut) — voir `src/lib/raid-reminder.ts` pour la décision (pure, testée).
 *
 * Demandé le 19/09/2026 : « un ping qui ping uniquement les membres inscrits (et
 * pas les rôles mentionnés dans l'embed) 1 h avant un raid, un ping automatique
 * de rappel ».
 *
 * Ce service ne fait que l'**I/O** : lire l'événement, résoudre les comptes
 * Discord des inscrits, poster le message, marquer l'événement. Branché sur
 * `/api/cron/raid-reminders` (toutes les 10 min) ; il est aussi appelable à la
 * demande (test/diagnostic) via `sendRaidReminderForEvent`.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/utils";
import { sendChannelMessage } from "@/server/discord";
import {
    buildRaidReminderMentions,
    pickRaidReminderChannelId,
    raidReminderLeadLabel,
    shouldSendRaidReminder,
    type RaidChannelConfig,
} from "@/lib/raid-reminder";

export type RaidReminderOutcome = {
    sent: boolean;
    /** `sent`, ou la raison du refus (`too-early`, `already-sent`, `no-participants`…). */
    reason: string;
    /** Nombre d'inscrits réellement pingés. */
    pinged: number;
    leadMinutes?: number;
    messageId?: string | null;
};

export type RaidReminderRunSummary = {
    scanned: number;
    sent: number;
    failed: number;
    pinged: number;
    skipped: Record<string, number>;
    reminders: { eventId: string; title: string; pinged: number; leadMinutes: number }[];
};

/** Fenêtre de scan du cron : couvre tous les `notifyBefore` possibles (24 h max). */
const SCAN_HORIZON_MS = 24 * 60 * 60 * 1000;

type RaidEventRow = {
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

type GuildRow = RaidChannelConfig & { id: string; name: string | null };

/** Nombre de mentions dans un `content` de ping (séparateur espace). */
function countMentions(mentions: string): number {
    return mentions ? mentions.split(" ").length : 0;
}

/**
 * Rappel pour un événement **déjà chargé** : décision (pure) → ping → marqueurs.
 *
 * Le `content` ne contient QUE les mentions des inscrits : c'est la seule source
 * de ping côté Discord (`allowed_mentions` est construit à partir du contenu), donc
 * aucun rôle de l'embed ni `@everyone` ne peut être notifié par ce message.
 */
async function deliverRaidReminder(args: {
    guildId: string;
    guildConfig: GuildRow;
    event: RaidEventRow;
    now: Date;
}): Promise<RaidReminderOutcome> {
    const { guildId, guildConfig, event, now } = args;
    const meta = (event.metadata as Record<string, unknown> | null) || {};
    const channelId = event.discordChannelId || pickRaidReminderChannelId(guildConfig, meta.raidType);

    const decision = shouldSendRaidReminder({
        type: event.type,
        status: event.status,
        startDate: event.startDate,
        now,
        notifyBefore: event.notifyBefore,
        channelId,
        registeredCount: event.participants.length,
        autoReminderSentAt: (meta.raidReminderSentAt as string | undefined) ?? null,
        manualReminderAt: event.lastRemindedAt,
    });
    if (!decision.send) {
        return { sent: false, reason: decision.reason, pinged: 0, leadMinutes: decision.leadMinutes };
    }

    // Inscrits = REGISTERED + CONFIRMED (les « inscrits » de l'embed) — la file
    // d'attente n'est pas pingée : elle n'est pas inscrite.
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
    const dashboardUrl = `${getAppBaseUrl()}/dashboard/${guildId}/calendar?event=${event.id}`;

    const messageId = await sendChannelMessage(
        channelId as string,
        `🔔 **Rappel raid — départ dans ${leadLabel}** (rendez-vous en jeu / vocal)\n${mentions}`,
        {
            embedTitle: `🔔 ${event.title} — dans ${leadLabel}`,
            embedColor: 0xff6b35,
            embedUrl: dashboardUrl,
            embedFooter: `SigilOS • ${guildConfig.name ?? "Guilde"} • Seuls les inscrits sont notifiés`,
            fields: [
                { name: "⏰ Départ", value: `<t:${startTs}:t> (<t:${startTs}:R>)`, inline: true },
                {
                    name: "👥 Inscrits",
                    value: `${event.participants.length}${event.maxParticipants ? `/${event.maxParticipants}` : ""}`,
                    inline: true,
                },
                { name: "💡 Avant de partir", value: "Vérifie ta classe sur le dashboard et prépare ton stuff.", inline: false },
            ],
        }
    );

    if (!messageId) {
        return { sent: false, reason: "discord-refused", pinged: 0, leadMinutes: decision.leadMinutes };
    }

    // Idempotence (`raidReminderSentAt`) + nettoyage à la clôture de l'événement
    // (`reminderMessages` est déjà purgé par cancel / complete / auto-close).
    const existingReminders = Array.isArray(meta.reminderMessages) ? meta.reminderMessages : [];
    await db.guildEvent
        .update({
            where: { id: event.id, guildId: guildConfig.id },
            data: {
                metadata: {
                    ...meta,
                    raidReminderSentAt: now.toISOString(),
                    reminderMessages: [...existingReminders, { channelId, messageId }],
                },
            },
        })
        .catch(() => null);

    logger.info("[RaidReminder] Ping des inscrits envoyé", {
        eventId: event.id,
        channelId,
        pinged: countMentions(mentions),
        leadMinutes: decision.leadMinutes,
    });

    return {
        sent: true,
        reason: "sent",
        pinged: countMentions(mentions),
        leadMinutes: decision.leadMinutes,
        messageId,
    };
}

/**
 * Rappel d'un raid précis (idempotent). Utilisé par le cron **et** par les
 * diagnostics (`scratch/`), afin de ne jamais dupliquer la logique de décision.
 */
export async function sendRaidReminderForEvent(
    guildId: string,
    eventId: string,
    opts: { now?: Date } = {}
): Promise<RaidReminderOutcome> {
    const now = opts.now ?? new Date();

    const guildConfig = await db.guildConfig.findUnique({
        where: { discordGuildId: guildId },
        select: {
            id: true,
            name: true,
            raidNotifyChannelId: true,
            raidGigalodonNotifyChannelId: true,
            raidSanctuaireNotifyChannelId: true,
            calendarNotifyChannelId: true,
        },
    });
    if (!guildConfig) return { sent: false, reason: "guild-not-found", pinged: 0 };

    const event = await db.guildEvent.findUnique({
        where: { id: eventId, guildId: guildConfig.id },
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
        },
    });
    if (!event) return { sent: false, reason: "not-found", pinged: 0 };

    return deliverRaidReminder({ guildId, guildConfig, event, now });
}

/**
 * Passe de rappel pour **tous** les raids à venir (entrée du cron).
 * Un raid déjà rappelé, encore hors fenêtre ou sans inscrit est compté comme
 * « sauté » : il sera repris à la passe suivante (jamais de double ping).
 */
export async function sendRaidReminders(
    opts: { now?: Date; limit?: number } = {}
): Promise<RaidReminderRunSummary> {
    const now = opts.now ?? new Date();
    const summary: RaidReminderRunSummary = {
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

    const candidates = await db.guildEvent.findMany({
        where: {
            type: "RAID_OFFICIAL",
            status: "PUBLISHED",
            startDate: { gt: now, lte: new Date(now.getTime() + SCAN_HORIZON_MS) },
            discordChannelId: { not: null },
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
        take: opts.limit ?? 50,
    });

    summary.scanned = candidates.length;

    // Une seule lecture de configuration par guilde, quel que soit le nombre de raids.
    const guildCache = new Map<string, GuildRow | null>();

    for (const event of candidates) {
        const guildId = event.guild?.discordGuildId;
        if (!guildId) {
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
                    raidNotifyChannelId: true,
                    raidGigalodonNotifyChannelId: true,
                    raidSanctuaireNotifyChannelId: true,
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
            const outcome = await deliverRaidReminder({ guildId, guildConfig, event, now });
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
            logger.error("[RaidReminder] Échec du rappel", { eventId: event.id, error: String(error) });
        }
    }

    return summary;
}
