import "dotenv/config";
import { UnrecoverableError, Worker } from "bullmq";
import { DISCORD_OUTBOX_QUEUE_NAME, discordOutboxQueueOptions } from "../lib/queue/discord-outbox-queue";
import { executeDiscordWrite, isDiscordOutboxJobData, type DiscordOutboxJobData } from "../server/discord-outbox";
import { logger } from "../lib/logger";
import {
    buildAggregateOutboxFailureAlert,
    buildDiscordOutboxFailureAlert,
    getDiscordApiCode,
    getDiscordApiStatus,
    isPermanentDiscordWriteFailure,
} from "../lib/discord-api-errors";
import {
    clearDiscordChannelBlock,
    isDiscordChannelBlockedError,
    markDiscordChannelBlocked,
} from "../lib/discord-channel-health";
import { runInOutboxFailureContext } from "../lib/discord-outbox-context";

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

/**
 * Fenêtre de l'alerte **par salon** (filet de sécurité : la vraie borne est le
 * compteur d'échecs du disjoncteur, qui ne laisse alerter que le premier échec
 * d'un épisode).
 */
const DISCORD_OUTBOX_CHANNEL_ALERT_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Fenêtre de l'alerte **agrégée** « plusieurs salons inaccessibles ». */
const DISCORD_OUTBOX_AGGREGATE_ALERT_WINDOW_MS = 6 * 60 * 60 * 1000;

/** Marque une erreur définitive pour BullMQ (aucun retry) en gardant le diagnostic. */
function toUnrecoverable(error: unknown, channelId?: string): UnrecoverableError {
    const message = error instanceof Error ? error.message : String(error);
    const unrecoverable = new UnrecoverableError(message);
    // Statut + code Discord + salon : consommés par l'alerte God.
    Object.assign(unrecoverable, {
        status: getDiscordApiStatus(error) || undefined,
        discordCode: getDiscordApiCode(error),
        channelId: (error as { channelId?: string } | null)?.channelId ?? channelId,
        // Le refus vient du DISJONCTEUR, pas de Discord : le `failed` handler ne doit
        // pas alerter (le garde-fou fonctionne — il n'y a rien à réparer côté code).
        channelBlocked: isDiscordChannelBlockedError(error),
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
            // 🛑 Disjoncteur : le salon est en pause d'écriture ⇒ échec DÉFINITIF
            // immédiat (zéro retry) et sans alerte — cf. le `failed` handler ci-dessous.
            if (isDiscordChannelBlockedError(error)) {
                throw toUnrecoverable(error, data.channelId);
            }
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
    // Écriture réussie ⇒ le salon répond : on lève la pause ET on remet le compteur
    // d'échecs consécutifs à zéro. Sans ce reset, une pause de 1 h survivrait à la
    // réparation et le compteur ferait taire l'alerte d'une panne future.
    const channelId = (job.data as Partial<DiscordOutboxJobData> | undefined)?.channelId;
    if (channelId) void clearDiscordChannelBlock(channelId);
});

worker.on("failed", async (job, err) => {
    // 🛑 Le job a été refusé par le DISJONCTEUR (salon en pause) : c'est le garde-fou
    // qui fonctionne, pas un incident — aucune alerte, sinon le bruit reviendrait par
    // cette porte (une alerte par tick de cron et par salon).
    if (isDiscordChannelBlockedError(err) || (err as { channelBlocked?: boolean } | null)?.channelBlocked) {
        logger.warn(`[DiscordOutbox] Job ${job?.id} non exécuté — salon en pause d'écriture`);
        return;
    }

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
            const failedChannelId = (err as { channelId?: string } | null)?.channelId ?? data.channelId;

            // ① Mise en pause du salon : un refus permanent (403/50001, 404, 401) ne doit
            // plus être retenté — ni par la file, ni par les crons qui le sollicitaient.
            // C'est LA correction d'échelle : mesuré à `:10:00` de chaque heure, le salon
            // `1468401237186707588` était réessayé indéfiniment.
            const block = failedChannelId
                ? await markDiscordChannelBlocked(failedChannelId, {
                    jobId: job.id,
                    kind: data.kind,
                    status: getDiscordApiStatus(err),
                    code: getDiscordApiCode(err),
                })
                : null;

            // ② Alerte par salon — UNIQUEMENT au premier échec depuis le dernier succès
            // (`failureCount === 1`). Un salon durablement mort est signalé une fois puis
            // sondé en silence : à 5 000 guildes, c'est la différence entre 24 alertes par
            // jour et par salon, et une alerte au total.
            if (!block || block.failureCount <= 1) {
                // `runInOutboxFailureContext` : cette alerte est émise pendant le traitement
                // d'un échec d'écriture — le contexte lui interdit tout envoi Discord, même
                // si un futur appelant oubliait `webOnly` (anti-boucle structurel).
                await runInOutboxFailureContext(() => notifyGod({
                    ...buildDiscordOutboxFailureAlert({
                        jobId: job.id,
                        kind: data.kind,
                        channelId: failedChannelId,
                        attempts: job.attemptsMade,
                        error: err,
                    }),
                    // 🛑 ANTI-BOUCLE (mesure du 25/09/2026 : 4 575 alertes + 4 575 jobs en
                    // 90 minutes) — cette alerte décrit un échec d'écriture Discord : si
                    // elle repartait sur Discord (`sendChannelMessage` → même file), elle
                    // recréerait un job qui échouerait → une alerte → etc. Elle reste **web**.
                    webOnly: true,
                    // Fenêtre large (6 h) : la vraie borne est le compteur ci-dessus ; ceci
                    // n'est qu'un filet si le compteur Redis est indisponible.
                    dedupeKey: `discord-outbox:${failedChannelId ?? "sans-salon"}`,
                    dedupeWindowMs: DISCORD_OUTBOX_CHANNEL_ALERT_WINDOW_MS,
                }));
            }

            // ③ Alerte AGRÉGÉE dès que PLUSIEURS salons sont en pause : c'est le signal
            // d'échelle (un salon isolé est déjà couvert par ②), lui aussi plafonné.
            if (block && !block.alreadyBlocked && block.blockedCount > 1) {
                await runInOutboxFailureContext(() => notifyGod({
                    ...buildAggregateOutboxFailureAlert({
                        channels: block.blockedChannels,
                        total: block.blockedCount,
                        kind: data.kind,
                    }),
                    webOnly: true,
                    dedupeKey: "discord-outbox:salons-inaccessibles",
                    dedupeWindowMs: DISCORD_OUTBOX_AGGREGATE_ALERT_WINDOW_MS,
                }));
            }
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

