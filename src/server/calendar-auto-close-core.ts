/**
 * Passe de fond du calendrier — **clôture d'office + purge Discord**, une seule source.
 *
 * Appelée uniquement par `/api/cron/calendar-auto-close` (secret cron) : aucune page
 * n'écrit plus en base à l'ouverture du calendrier (c'était la cause des raids
 * « clôturés » sans points et des rappels Discord jamais supprimés).
 *
 * Contrat :
 *  - **borne** la passe (`take`), pré-filtre SQL (`blindAutoCloseWhere`) puis tranche
 *    avec la règle pure `shouldBlindAutoClose` (les miroirs DJ/Songes sont écartés) ;
 *  - **garde d'état dans le `WHERE`** (`status: "PUBLISHED"`) : une clôture concurrente
 *    (capitaine, autre instance du cron) gagne, on ne réécrit jamais un statut ;
 *  - un raid clôturé d'office porte `metadata.closedBySystem` + `systemClosedAt` et
 *    **pas** `metadata.completedAt` : c'est ce qui le rend rattrapable par le capitaine ;
 *  - **purge** les messages de rappel (`metadata.reminderMessages`) et l'embed de
 *    publication, puis ne conserve que les refs réellement non supprimées.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isAgendaMirror } from "@/lib/agenda-mirror";
import { blindAutoCloseWhere, shouldBlindAutoClose } from "@/lib/calendar-auto-close";
import { isStandByActive } from "@/lib/group-standby";
import { Prisma } from "@prisma/client";
import {
    deleteEventDiscordMessage,
    deleteReminderMessageRefs,
    type ReminderMessageRef,
} from "@/server/calendar-message-cleanup";

/** Plafond par passe : la tâche tourne toutes les 10 min, jamais de balayage complet. */
const DEFAULT_LIMIT = 200;

export type CalendarAutoCloseSummary = {
    /** Événements examinés (pré-filtre SQL). */
    scanned: number;
    /** Événements effectivement clôturés par cette passe. */
    closed: number;
    /** Dont raids clôturés d'office (à compléter par le capitaine). */
    raidsClosedBySystem: number;
    /** Messages Discord supprimés (rappels + embed de publication). */
    purgedMessages: number;
    /** Événements dont la clôture ou la purge a échoué (rejoués à la passe suivante). */
    failed: number;
};

/**
 * Clôture les événements échus et supprime leurs messages Discord.
 * Idempotent : un événement déjà `COMPLETED` n'est jamais repris (statut dans le `WHERE`).
 */
export async function closeExpiredCalendarEvents(
    opts: { now?: Date; limit?: number } = {}
): Promise<CalendarAutoCloseSummary> {
    const now = opts.now ?? new Date();
    const summary: CalendarAutoCloseSummary = {
        scanned: 0,
        closed: 0,
        raidsClosedBySystem: 0,
        purgedMessages: 0,
        failed: 0,
    };

    const candidates = await db.guildEvent.findMany({
        where: {
            ...blindAutoCloseWhere(null, now),
            // Stand-by (30/10/2026) : un événement gelé n'est pas candidat à la clôture
            // d'office. Filtre SQL (`DbNull` = colonne NULL) pour qu'une passe saturée
            // d'événements suspendus ne prive pas les autres de leur clôture ; la règle
            // pure ci-dessous reste la seconde barrière.
            standBy: { equals: Prisma.DbNull },
        },
        select: {
            id: true,
            guildId: true,
            type: true,
            endDate: true,
            metadata: true,
            standBy: true,
            discordChannelId: true,
            discordMessageId: true,
        },
        orderBy: { endDate: "asc" },
        take: opts.limit ?? DEFAULT_LIMIT,
    });
    summary.scanned = candidates.length;

    for (const event of candidates) {
        const meta = (event.metadata as any) || {};
        // Miroirs DJ/Songes écartés : leur clôture appartient à `syncDjMirror`/`syncSongesMirror`.
        // Stand-by : un événement volontairement suspendu attend son réveil.
        if (!shouldBlindAutoClose({
            type: event.type,
            endDate: event.endDate,
            now,
            isMirror: isAgendaMirror(meta),
            isStandBy: isStandByActive(event.standBy),
        })) {
            continue;
        }

        const isRaid = event.type === "RAID_OFFICIAL";
        try {
            // Garde d'état dans le WHERE : jamais deux clôtures pour le même événement.
            const updated = await db.guildEvent.updateMany({
                where: { id: event.id, guildId: event.guildId, status: "PUBLISHED" },
                data: {
                    status: "COMPLETED",
                    metadata: isRaid ? { ...meta, closedBySystem: true, systemClosedAt: now.toISOString() } : meta,
                },
            });
            if (updated.count === 0) continue;

            summary.closed++;
            if (isRaid) summary.raidsClosedBySystem++;

            const refs: ReminderMessageRef[] = Array.isArray(meta.reminderMessages) ? meta.reminderMessages : [];
            const remaining = await deleteReminderMessageRefs(refs);
            summary.purgedMessages += refs.length - remaining.length;

            if (await deleteEventDiscordMessage({
                id: event.id,
                discordChannelId: event.discordChannelId,
                discordMessageId: event.discordMessageId,
            })) {
                summary.purgedMessages++;
            }

            // On ne réécrit `reminderMessages` que s'il reste des échecs : un envoi
            // dont le snowflake est encore en file (`outbox:`) est rejouable plus tard.
            if (remaining.length !== refs.length) {
                const fresh = await db.guildEvent.findUnique({
                    where: { id: event.id },
                    select: { metadata: true },
                });
                const freshMeta = (fresh?.metadata as any) || meta;
                await db.guildEvent
                    .update({ where: { id: event.id }, data: { metadata: { ...freshMeta, reminderMessages: remaining } } })
                    .catch(() => null);
            }
        } catch (error) {
            summary.failed++;
            logger.error("[CalendarAutoClose] Échec de la clôture d'office", {
                eventId: event.id,
                error: String(error),
            });
        }
    }

    if (summary.closed > 0 || summary.failed > 0) {
        logger.info("[CalendarAutoClose] Passe terminée", { ...summary });
    }
    return summary;
}
