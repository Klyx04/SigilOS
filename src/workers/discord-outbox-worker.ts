import "dotenv/config";
import { UnrecoverableError, Worker } from "bullmq";
import { DISCORD_OUTBOX_QUEUE_NAME, discordOutboxQueueOptions } from "../lib/queue/discord-outbox-queue";
import { executeDiscordWrite, isDiscordOutboxJobData, type DiscordOutboxJobData } from "../server/discord-outbox";
import { logger } from "../lib/logger";
import {
    buildDiscordOutboxFailureAlert,
    getDiscordApiCode,
    getDiscordApiStatus,
    isPermanentDiscordWriteFailure,
} from "../lib/discord-api-errors";

/**
 * #223 P3.1 — Discord Outbox Worker.
 * Consomme la file `discord-outbox` et flush les écritures Discord mises en file
 * (mode dégradé). Retry exponentiel 429/5xx géré par BullMQ (attempts/backoff).
 * Échec définitif → alerte God (observabilité), jamais de perte silencieuse.
 *
 * Refus PERMANENT (4xx hors 429, payload invalide) → `UnrecoverableError` :
 * aucune des 8 tentatives n'a la moindre chance d'aboutir, on alerte donc tout de
 * suite, avec statut HTTP + code Discord + salon. L'ancienne alerte
 * (« Discord a refusé la demande », sans salon ni statut) était
 * indiagnostiquable — voir `src/lib/discord-api-errors.ts`.
 */

logger.info(`[Worker] Démarrage du Discord Outbox Worker (queue: ${DISCORD_OUTBOX_QUEUE_NAME})...`);

/** Marque une erreur définitive pour BullMQ (aucun retry) en gardant le diagnostic. */
function toUnrecoverable(error: unknown, channelId?: string): UnrecoverableError {
    const message = error instanceof Error ? error.message : String(error);
    const unrecoverable = new UnrecoverableError(message);
    // Statut + code Discord + salon : consommés par l'alerte God.
    Object.assign(unrecoverable, {
        status: getDiscordApiStatus(error) || undefined,
        discordCode: getDiscordApiCode(error),
        channelId: (error as { channelId?: string } | null)?.channelId ?? channelId,
    });
    return unrecoverable;
}

const worker = new Worker(
    DISCORD_OUTBOX_QUEUE_NAME,
    async (job) => {
        if (!isDiscordOutboxJobData(job.data)) {
            // Payload invalide = définitif (rejouer ne peut pas le réparer).
            throw toUnrecoverable(new Error(`Discord outbox: payload de job invalide (${job.id}) — rejeté`));
        }
        const data = job.data as DiscordOutboxJobData;
        try {
            await executeDiscordWrite(data);
        } catch (error) {
            const permanent = isPermanentDiscordWriteFailure(error);
            logger.warn(`[DiscordOutbox] Job ${job.id} en échec — classification`, {
                kind: data.kind,
                channelId: data.channelId,
                permanent,
            });
            if (permanent) {
                throw toUnrecoverable(error, data.channelId);
            }
            throw error;
        }
    },
    {
        ...discordOutboxQueueOptions,
        concurrency: 1,
    }
);

worker.on("completed", (job) => {
    logger.info(`[DiscordOutbox] ✅ Job ${job.id} flushé vers Discord.`);
});

worker.on("failed", async (job, err) => {
    logger.error(`[DiscordOutbox] ❌ Job ${job?.id} a échoué: ${err.message}`);

    // Alerte God uniquement sur l'échec DÉFINITIF — pas de spam :
    //  - `UnrecoverableError` (refus permanent 4xx hors 429, payload invalide)
    //    échoue à la 1re tentative mais ne sera JAMAIS rejoué ;
    //  - sinon, la dernière tentative prévue par la file (8) est atteinte.
    const maxAttempts = job?.opts.attempts ?? 8;
    const isDefinitive = !!job && (job.attemptsMade >= maxAttempts || err?.name === "UnrecoverableError");

    if (isDefinitive && job) {
        try {
            const { notifyGod } = await import("../server/actions/god-notif-actions");
            const data = (job.data ?? {}) as Partial<DiscordOutboxJobData> & { channelId?: string };
            await notifyGod(
                buildDiscordOutboxFailureAlert({
                    jobId: job.id,
                    kind: data.kind,
                    channelId: (err as { channelId?: string } | null)?.channelId ?? data.channelId,
                    attempts: job.attemptsMade,
                    error: err,
                })
            );
        } catch (notifyErr) {
            logger.warn("[DiscordOutbox] notifyGod échoué:", { error: String(notifyErr) });
        }
    }
});

// Graceful shutdown
const shutdown = async () => {
    logger.info("[Worker] Extinction du Discord Outbox Worker...");
    await worker.close();
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Exporté pour être branché sur l'arrêt propre du worker principal (metamob-worker).
export { worker as discordOutboxWorker };

