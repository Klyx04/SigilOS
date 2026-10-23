/**
 * Rappel automatique H-1 des posts **DJ / Quêtes** datés.
 *
 * Demande user (28/09/2026) : « produis un rappel auto 1 h avant pour les post
 * dj quetes songes / event calendrier ».
 *
 * Invariants (sans migration de schéma) :
 *  1. Seuls les posts avec `targetDate` définie sont éligibles (post sans date
 *     = planif indéfinie → jamais de ping auto).
 *  2. Un seul ping par échéance : marqueur `dungeonsJson._h1ReminderSentAt`
 *     (ISO) + garde de l'échéance (`_h1ReminderFor` = targetDate ISO). Si la
 *     date est replanifiée, `updateDjPost` efface le marqueur.
 *  3. Silence 30 min après un rappel manuel (`lastReminderAt`).
 *  4. Ping uniquement des ACCEPTED avec compte Discord — jamais de rôle.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAppBaseUrl } from "@/lib/utils";
import { sendChannelMessage } from "@/server/discord";
import { buildRaidReminderMentions, raidReminderLeadLabel } from "@/lib/raid-reminder";
import { shouldSendScheduledH1Reminder } from "@/lib/h1-reminder";
import { getMultiDungeons, isDjDungeonClosed, withDjDungeonReminder } from "@/lib/dungeon-finder-utils";

const SCAN_HORIZON_MS = 24 * 60 * 60 * 1000;

/**
 * **Session** = une échéance à rappeler. Un post simple en a une (sa `targetDate`) ; un post
 * multi en a **une par donjon daté** — le post lui-même n'a pas de `targetDate` (colonne
 * `null`), d'où l'absence historique de rappel sur les posts multi.
 */
type ReminderSession = {
    /** Index du donjon dans l'enveloppe ; `null` = post simple. */
    index: number | null;
    date: Date;
    title: string;
    participantUserIds: string[];
    /** Marqueur du rappel déjà envoyé pour CETTE échéance (jamais celui d'une autre). */
    autoSentAt: string | null;
};

/** Marqueur H-1 d'un donjon : il ne vaut que pour SON échéance. */
function markerForEntry(entry: { _h1SentAt?: unknown; _h1For?: unknown }, date: Date): string | null {
    const iso = date.toISOString();
    const forDate = typeof entry._h1For === "string" ? entry._h1For : null;
    const sentAt = typeof entry._h1SentAt === "string" ? entry._h1SentAt : null;
    return sentAt && forDate === iso ? sentAt : null;
}

/**
 * Échéances d'un post — **jamais** un donjon clôturé ni un donjon sans date.
 * Les index renvoyés sont ceux de `dungeonsJson`, donc utilisables tels quels pour écrire
 * le marqueur du bon donjon.
 */
function buildSessions(post: any): ReminderSession[] {
    const entries = getMultiDungeons(post.dungeonsJson);
    if (entries.length === 0) {
        if (!post.targetDate) return [];
        const date = new Date(post.targetDate);
        if (Number.isNaN(date.getTime())) return [];
        const { sentAt, forDate } = readH1Marker(post.dungeonsJson);
        return [{
            index: null,
            date,
            title: post.questName || post.titanName || post.dungeon?.name || "Groupe Donjon/Quête",
            participantUserIds: post.participants.map((p: any) => p.userId),
            autoSentAt: sentAt && forDate === date.toISOString() ? sentAt : null,
        }];
    }

    const sessions: ReminderSession[] = [];
    entries.forEach((entry, index) => {
        // Donjon clôturé individuellement ⇒ plus de groupe à prévenir.
        if (isDjDungeonClosed(entry)) return;
        if (!entry?.targetDate) return;
        const date = new Date(entry.targetDate);
        if (Number.isNaN(date.getTime())) return;
        sessions.push({
            index,
            date,
            title: entry.name || `Donjon ${index + 1}`,
            // Inscrits de CE donjon (une ligne `dungeonIndex = null` compte pour tous : posts
            // créés avant le multi-donjons).
            participantUserIds: post.participants
                .filter((p: any) => p.dungeonIndex === index || p.dungeonIndex == null)
                .map((p: any) => p.userId),
            autoSentAt: markerForEntry(entry, date),
        });
    });
    return sessions;
}


export type DjReminderOutcome = {
    sent: boolean;
    reason: string;
    pinged: number;
};

export type DjReminderRunSummary = {
    scanned: number;
    sent: number;
    failed: number;
    pinged: number;
    skipped: Record<string, number>;
};

function readH1Marker(dungeonsJson: unknown): { sentAt: string | null; forDate: string | null } {
    const o = (dungeonsJson as Record<string, unknown> | null) || null;
    const sentAt = typeof o?.["_h1ReminderSentAt"] === "string" ? (o["_h1ReminderSentAt"] as string) : null;
    const forDate = typeof o?.["_h1ReminderFor"] === "string" ? (o["_h1ReminderFor"] as string) : null;
    return { sentAt, forDate };
}

export async function sendDjReminders(
    opts: { now?: Date; limit?: number } = {}
): Promise<DjReminderRunSummary> {
    const now = opts.now ?? new Date();
    const summary: DjReminderRunSummary = { scanned: 0, sent: 0, failed: 0, pinged: 0, skipped: {} };
    const bump = (reason: string) => {
        summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1;
    };

    const scanSelect = {
        id: true,
        guildId: true,
        targetDate: true,
        discordChannelId: true,
        lastReminderAt: true,
        dungeonsJson: true,
        dungeon: { select: { name: true } },
        questName: true,
        titanName: true,
        participants: {
            where: { status: "ACCEPTED" },
            // `dungeonIndex` : un rappel de donjon ne prévient QUE les inscrits de ce donjon.
            select: { userId: true, dungeonIndex: true },
        },
        profile: { select: { userId: true } },
        guild: { select: { discordGuildId: true, name: true, djNotifyChannelId: true } },
    } as const;

    // ① Posts SIMPLES datés — filtre SQL historique (verrouillé par
    //    `tests/unit/h1-reminders-wiring.test.ts` : un post sans date ne reçoit jamais de ping).
    const singleCandidates = await (db as any).djSearchPost.findMany({
        where: {
            status: { in: ["OPEN", "FULL"] },
            targetDate: { not: null, gt: now, lte: new Date(now.getTime() + SCAN_HORIZON_MS) },
        },
        select: scanSelect,
        orderBy: { targetDate: "asc" },
        take: opts.limit ?? 100,
    });

    // ② Posts MULTI — `targetDate` (colonne) est NULL : les échéances vivent dans
    //    `_items[i].targetDate`. Sans cette seconde requête, **aucun rappel ne partait**
    //    sur un post multi (mesure du 23/10/2026).
    const multiCandidates = await (db as any).djSearchPost.findMany({
        where: {
            status: { in: ["OPEN", "FULL"] },
            targetDate: null,
        },
        select: scanSelect,
        orderBy: { createdAt: "desc" },
        take: opts.limit ?? 100,
    });

    const candidates = [...singleCandidates, ...multiCandidates];
    summary.scanned = candidates.length;

    for (const post of candidates) {
        const channelId = post.discordChannelId || post.guild?.djNotifyChannelId || null;
        const sessions = buildSessions(post);
        if (sessions.length === 0) {
            bump("no-date");
            continue;
        }

        // Marqueurs posés PENDANT cette exécution : deux donjons rappelés à la suite ne
        // doivent pas s'écraser l'un l'autre.
        let workingJson: unknown = post.dungeonsJson;

        for (const session of sessions) {
        const decision = shouldSendScheduledH1Reminder({
            date: session.date,
            now,
            channelId,
            participantCount: session.participantUserIds.length,
            autoSentAt: session.autoSentAt,
            manualAt: post.lastReminderAt,
            open: true,
        });
        if (!decision.send) {
            bump(decision.reason);
            continue;
        }

        try {
            const targetUserIds = Array.from(new Set([...session.participantUserIds, post.profile?.userId].filter(Boolean)));
            const accounts = await db.account.findMany({
                where: { userId: { in: targetUserIds }, provider: "discord" },
                select: { providerAccountId: true },
            });
            const mentions = buildRaidReminderMentions(accounts.map((a) => a.providerAccountId));
            if (!mentions) {
                bump("no-discord-account");
                continue;
            }

            const title = session.title;
            const startTs = Math.floor(session.date.getTime() / 1000);
            const dashboardUrl = `${getAppBaseUrl()}/dashboard/${post.guild?.discordGuildId}/donjons-et-quetes`;
            // Un message par donjon : la clé porte l'index, sinon deux donjons rappelés le
            // même jour écraseraient la même référence Redis.
            const reminderMsgKey = `dj-reminder:msg:${post.id}:${session.index ?? "s"}:${now.getTime()}`;

            const messageId = await sendChannelMessage(
                channelId as string,
                `🔔 **Rappel — départ dans ${raidReminderLeadLabel(decision.leadMinutes)}**\n${mentions}`,
                {
                    embedTitle: `🔔 ${title} — dans ${raidReminderLeadLabel(decision.leadMinutes)}`,
                    embedColor: 0xff6b35,
                    embedUrl: dashboardUrl,
                    embedFooter: `SigilOS • ${post.guild?.name ?? "Guilde"} • Acceptés & leader notifiés`,
                    fields: [
                        { name: "⏰ Début", value: `<t:${startTs}:t> (<t:${startTs}:R>)`, inline: true },
                        { name: "👥 Acceptés", value: `${session.participantUserIds.length}`, inline: true },
                    ],
                    storeMessageIdKey: reminderMsgKey,
                    storeMessageIdTTL: 30 * 24 * 3600,
                }
            );
            if (!messageId) {
                bump("discord-refused");
                continue;
            }

            // Post simple : marqueurs d'enveloppe (comportement historique).
            // Post multi : marqueurs DU DONJON (`_items[i]._h1SentAt/_h1For`), sinon le
            // deuxième donjon daté du même post ne recevrait jamais son rappel.
            const sentAtIso = now.toISOString();
            const forIso = session.date.toISOString();
            let nextJson: Record<string, unknown> | null;
            if (session.index === null) {
                const currentJson =
                    workingJson && typeof workingJson === "object" && !Array.isArray(workingJson)
                        ? (workingJson as Record<string, unknown>)
                        : {};
                nextJson = { ...currentJson, _h1ReminderSentAt: sentAtIso, _h1ReminderFor: forIso };
            } else {
                nextJson = withDjDungeonReminder(workingJson, session.index, sentAtIso, forIso);
            }
            if (nextJson) {
                workingJson = nextJson;
                await (db as any).djSearchPost
                    .update({ where: { id: post.id }, data: { dungeonsJson: nextJson } })
                    .catch(() => null);
            }

            summary.sent++;
            summary.pinged += mentions.split(" ").length;
            logger.info("[DjReminder] Ping H-1 envoyé", { postId: post.id, dungeonIndex: session.index });
        } catch (error) {
            summary.failed++;
            logger.error("[DjReminder] Échec du rappel", { postId: post.id, dungeonIndex: session.index, error: String(error) });
        }
        }
    }

    return summary;
}
