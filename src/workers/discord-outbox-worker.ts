import "dotenv/config";
import { Worker } from "bullmq";
import { DISCORD_OUTBOX_QUEUE_NAME, discordOutboxQueueOptions } from "../lib/queue/discord-outbox-queue";
import { executeDiscordWrite, isDiscordOutboxJobData } from "../server/discord-outbox";
import { logger } from "../lib/logger";

/**
 * #223 P3.1 — Discord Outbox Worker.
 * Consomme la file `discord-outbox` et flush les écritures Discord mises en file
 * (mode dégradé). Retry exponentiel 429/5xx géré par BullMQ (attempts/backoff).
 * Échec définitif → alerte God (observabilité), jamais de perte silencieuse.
 */

logger.info(`[Worker] Démarrage du Discord Outbox Worker (queue: ${DISCORD_OUTBOX_QUEUE_NAME})...`);

const worker = new Worker(
    DISCORD_OUTBOX_QUEUE_NAME,
    async (job) => {
        if (!isDiscordOutboxJobData(job.data)) {
            throw new Error(`Discord outbox: payload de job invalide (${job.id}) — rejeté`);
        }
        await executeDiscordWrite(job.data);
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

    // Alerte God uniquement sur l'échec DÉFINITIF (dernière tentative) — pas de spam.
    const maxAttempts = job?.opts.attempts ?? 8;
    if (job && job.attemptsMade >= maxAttempts) {
        try {
            const { notifyGod } = await import("../server/actions/god-notif-actions");
            await notifyGod({
                title: "Discord Outbox : écriture abandonnée",
                message: `L'écriture Discord ${job.id} (${(job.data as { kind?: string })?.kind}) a échoué définitivement après ${maxAttempts} tentatives : ${err.message}`,
                type: "SYSTEM",
                success: false,
                ping: true,
                metadata: { jobId: job.id, kind: (job.data as { kind?: string })?.kind, attempts: maxAttempts },
            });
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

