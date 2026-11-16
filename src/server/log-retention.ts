/**
 * Purge de la télémétrie (`TelemetryEvent`, 90 j) et du journal d'activité
 * (`ServiceActivityLog`, 365 j) — **core serveur**, PAS une server action.
 *
 * ⚠️ Ce fichier n'a délibérément **aucun `"use server"`** : un export appelable
 * par le client sans garde est une porte de suppression. Chaque appelant garde
 * ses droits : `verifyCronSecret` (route cron) ou script VPS.
 *
 * Deux tables, deux stratégies :
 *   • `TelemetryEvent` a un index `[createdAt]` : une seule boucle par date suffit ;
 *   • `ServiceActivityLog` n'a **aucun index sur `createdAt` seul** : on boucle par
 *     `GuildConfig.id` interne (jamais un snowflake), ce qui utilise le préfixe
 *     `guildId` de `[guildId, module, createdAt]`.
 *
 * Dans les deux cas : par lot, condition d'état **rejouée** dans la suppression
 * conditionnelle, idempotent, compteurs seulement dans les logs (jamais de
 * contenu d'événement, de pseudo ni d'identifiant de guilde).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
    LOG_PURGE_BATCH_SIZE,
    LOG_PURGE_MAX_BATCHES,
    LOG_RETENTION_DAYS,
    buildServiceActivityPurgeWhere,
    buildTelemetryPurgeWhere,
    logPurgeCutoff,
} from "@/lib/telemetry-retention-policy";

export type LogPurgeOutcome = {
    /** Lignes examinées (bornées par le lot de la passe). */
    scanned: number;
    /** Lignes supprimées. */
    deleted: number;
    /** Il restait du travail après le budget de lots. */
    hasMore: boolean;
    /** Lots isolés sur erreur : la passe ne s'arrête jamais pour un seul. */
    failed: number;
};

export type ServiceActivityPurgeOutcome = LogPurgeOutcome & {
    /** Configurations de guilde balayées. */
    guilds: number;
};

type BatchOutcome = { scanned: number; deleted: number; hasMore: boolean };

/** Supprime **un** lot de télémétrie ; conditions rejouées dans la suppression. */
async function purgeTelemetryBatch(args: { cutoff: Date; limit: number }): Promise<BatchOutcome> {
    const due = await db.telemetryEvent.findMany({
        where: buildTelemetryPurgeWhere(args.cutoff),
        orderBy: { createdAt: "asc" },
        take: args.limit + 1, // +1 : savoir s'il reste du travail après ce lot
        select: { id: true },
    });

    const hasMore = due.length > args.limit;
    const batch = hasMore ? due.slice(0, args.limit) : due;
    if (batch.length === 0) return { scanned: 0, deleted: 0, hasMore: false };

    const removed = await db.telemetryEvent.deleteMany({
        where: {
            ...buildTelemetryPurgeWhere(args.cutoff),
            id: { in: batch.map((event) => event.id) },
        },
    });

    return { scanned: batch.length, deleted: removed.count, hasMore };
}

/**
 * Purge les événements de télémétrie échus. `maxBatches` borne la passe ;
 * `hasMore` reste vrai si le budget a été atteint avant la fin du travail.
 *
 * Idempotent : seules les lignes déjà échues partent, relancer la passe ne fait
 * rien de plus. Aucune trace n'est écrite dans la table purgée (elle vivrait
 * dans la télémétrie du cron `cleanup_logs`).
 */
export async function purgeTelemetryEventsCore(
    params: { now?: Date; limit?: number; maxBatches?: number } = {}
): Promise<LogPurgeOutcome> {
    const now = params.now ?? new Date();
    const limit = params.limit ?? LOG_PURGE_BATCH_SIZE;
    const maxBatches = params.maxBatches ?? LOG_PURGE_MAX_BATCHES;
    const cutoff = logPurgeCutoff(now, LOG_RETENTION_DAYS.TELEMETRY);
    const outcome: LogPurgeOutcome = { scanned: 0, deleted: 0, hasMore: false, failed: 0 };

    for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
        try {
            const batch = await purgeTelemetryBatch({ cutoff, limit });
            outcome.scanned += batch.scanned;
            outcome.deleted += batch.deleted;
            outcome.hasMore = batch.hasMore;
            if (!batch.hasMore) break;
        } catch (error) {
            outcome.failed += 1;
            // On ne sait pas s'il reste du travail : la passe suivante réessaiera.
            outcome.hasMore = true;
            logger.error("[log-retention] purge de la télémétrie — lot ignoré", { err: error });
            break;
        }
    }

    if (outcome.deleted > 0 || outcome.hasMore || outcome.failed > 0) {
        logger.info("[log-retention] purge de la télémétrie terminée", {
            ...outcome,
            retentionDays: LOG_RETENTION_DAYS.TELEMETRY,
        });
    }

    return outcome;
}

/** Supprime **un** lot du journal d'activité d'une guilde. */
async function purgeServiceActivityBatch(args: {
    guildId: string;
    cutoff: Date;
    limit: number;
}): Promise<BatchOutcome> {
    const due = await db.serviceActivityLog.findMany({
        where: { guildId: args.guildId, ...buildServiceActivityPurgeWhere(args.cutoff) },
        orderBy: { createdAt: "asc" },
        take: args.limit + 1, // +1 : savoir s'il reste du travail après ce lot
        select: { id: true },
    });

    const hasMore = due.length > args.limit;
    const batch = hasMore ? due.slice(0, args.limit) : due;
    if (batch.length === 0) return { scanned: 0, deleted: 0, hasMore: false };

    const removed = await db.serviceActivityLog.deleteMany({
        where: {
            guildId: args.guildId,
            ...buildServiceActivityPurgeWhere(args.cutoff),
            id: { in: batch.map((log) => log.id) },
        },
    });

    return { scanned: batch.length, deleted: removed.count, hasMore };
}

/**
 * Purge le journal d'activité échu, **guilde par guilde**. Un seul lot par
 * guilde et par passe : une guilde très chargée ne monopolise pas le budget,
 * les autres avancent. Le budget global `maxBatches` borne la durée du cron.
 */
export async function purgeServiceActivityCore(
    params: { now?: Date; limit?: number; maxBatches?: number } = {}
): Promise<ServiceActivityPurgeOutcome> {
    const now = params.now ?? new Date();
    const limit = params.limit ?? LOG_PURGE_BATCH_SIZE;
    const maxBatches = params.maxBatches ?? LOG_PURGE_MAX_BATCHES;
    const cutoff = logPurgeCutoff(now, LOG_RETENTION_DAYS.SERVICE_ACTIVITY);
    const outcome: ServiceActivityPurgeOutcome = {
        guilds: 0,
        scanned: 0,
        deleted: 0,
        hasMore: false,
        failed: 0,
    };

    const guilds = await db.guildConfig.findMany({
        orderBy: { id: "asc" },
        select: { id: true },
    });

    let batchesUsed = 0;
    let visited = 0;
    for (const guild of guilds) {
        visited += 1;
        outcome.guilds += 1;
        try {
            const batch = await purgeServiceActivityBatch({ guildId: guild.id, cutoff, limit });
            outcome.scanned += batch.scanned;
            outcome.deleted += batch.deleted;
            if (batch.hasMore) outcome.hasMore = true;
            if (batch.scanned > 0) batchesUsed += 1;
            if (batchesUsed >= maxBatches) {
                // Budget atteint : les guildes non visitées (ou les lots restants)
                // attendent la passe suivante. `hasMore` le dit au cron.
                if (visited < guilds.length || batch.hasMore) outcome.hasMore = true;
                break;
            }
        } catch (error) {
            outcome.failed += 1;
            outcome.hasMore = true;
            // Jamais d'identifiant de guilde dans les logs (règle : rien de sensible).
            logger.error("[log-retention] purge du journal d'activité — guilde ignorée", { err: error });
        }
    }

    if (outcome.deleted > 0 || outcome.hasMore || outcome.failed > 0) {
        logger.info("[log-retention] purge du journal d'activité terminée", {
            ...outcome,
            retentionDays: LOG_RETENTION_DAYS.SERVICE_ACTIVITY,
        });
    }

    return outcome;
}
