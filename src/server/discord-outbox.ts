import { createHash } from "crypto";
import { z } from "zod";
import { discordOutboxQueue } from "@/lib/queue/discord-outbox-queue";
import {
    postChannelMessage,
    deleteChannelMessage,
    patchChannelMessage,
    createForumThread,
} from "@/server/discord";
import {
    PermanentDiscordWriteError,
    getDiscordApiCode,
    getDiscordApiStatus,
    isPermanentDiscordWriteFailure,
} from "@/lib/discord-api-errors";
import {
    DiscordChannelBlockedError,
    isDiscordChannelBlocked,
} from "@/lib/discord-channel-health";
import { isDiscordSnowflake } from "@/lib/discord-ids";

// #223 P3.1 — Outbox des écritures Discord (BullMQ/Redis).
//
// Principe : quand le mode dégradé est activé (`DISCORD_OUTBOX_ENABLED=true`),
// les écritures Discord sont déposées dans une file Redis persistante au lieu d'un
// HTTP synchrone. Le worker `discord-outbox-worker` les flush quand Discord revient,
// avec retry exponentiel (429/5xx) et idempotency (jobId = hash stable du payload).
//
// Ce module est importable BOTH par Next.js (enqueue) ET par le worker (execute).
// Le payload est validé Zod à l'enqueue ET à l'exécution (fail-closed).

// ─── Schémas Zod (bordure : tout payload est validé) ──────────────────────────

const postMessageSchema = z.object({
    kind: z.literal("postMessage"),
    channelId: z.string().min(1).max(200),
    body: z.record(z.string(), z.unknown()),
    // Living status via outbox : le worker stocke le vrai ID posté sous cette
    // clé Redis (au lieu de perdre l'ID derrière `outbox:<jobId>`).
    storeMessageIdKey: z.string().min(1).max(200).optional(),
    storeMessageIdTTL: z.number().int().positive().max(90 * 24 * 3600).optional(),
});

const deleteMessageSchema = z.object({
    kind: z.literal("deleteMessage"),
    channelId: z.string().min(1).max(200),
    messageId: z.string().min(1).max(200),
});

const patchMessageSchema = z.object({
    kind: z.literal("patchMessage"),
    channelId: z.string().min(1).max(200),
    messageId: z.string().min(1).max(200),
    body: z.record(z.string(), z.unknown()),
});

const forumThreadSchema = z.object({
    kind: z.literal("forumThread"),
    channelId: z.string().min(1).max(200),
    body: z.record(z.string(), z.unknown()),
});

export const DiscordOutboxJobSchema = z.discriminatedUnion("kind", [
    postMessageSchema,
    deleteMessageSchema,
    patchMessageSchema,
    forumThreadSchema,
]);

export type DiscordOutboxJobData = z.infer<typeof DiscordOutboxJobSchema>;

export function isDiscordOutboxJobData(value: unknown): value is DiscordOutboxJobData {
    return DiscordOutboxJobSchema.safeParse(value).success;
}

// ID de message Discord = snowflake (15-21 chiffres) : règle partagée, module PUR
// `@/lib/discord-ids` (aucun cycle avec le core status-ping ni avec Discord).

// ─── Idempotency ───────────────────────────────────────────────────────────────

/** jobId stable = hash SHA-256 du payload : relancer le même job ne duplique pas l'écriture. */
function stableJobId(job: DiscordOutboxJobData): string {
    return createHash("sha256").update(JSON.stringify(job)).digest("hex");
}

// ─── Enqueue (côté Next.js / serveur) ─────────────────────────────────────────

export async function enqueueDiscordWrite(
    job: DiscordOutboxJobData,
    opts?: { jobId?: string }
): Promise<string> {
    const validated = DiscordOutboxJobSchema.parse(job); // fail-closed avant enqueue
    // 🛑 Disjoncteur (mesure du 25/09/2026) : un salon qui a refusé une écriture de
    // façon PERMANENTE (403/50001, 404, 401) est en pause. Y déposer un job est
    // inutile (il échouera), coûteux (une entrée de file + une alerte par échec) et
    // c'est exactement ce qui produisait le bruit à l'échelle — on refuse AVANT la file.
    if (await isDiscordChannelBlocked(validated.channelId)) {
        throw new DiscordChannelBlockedError(validated.channelId);
    }
    const jobId = opts?.jobId ?? stableJobId(validated);
    await discordOutboxQueue.add("discord-write", validated, { jobId });
    return jobId;
}

// ─── Exécution (côté worker) ──────────────────────────────────────────────────

/**
 * Exécute une écriture Discord depuis la file. En cas d'échec TRANSITOIRE
 * (réseau, 429, 5xx), THROW : BullMQ retente avec le backoff exponentiel.
 *
 * En cas de REFUS PERMANENT (4xx hors 429 : 400 corps invalide, 401 token,
 * 403 permissions, 404 salon supprimé), THROW `PermanentDiscordWriteError` :
 * le worker la convertit en `UnrecoverableError` → zéro retry inutile, alerte
 * immédiate et exploitable (statut HTTP + code Discord + salon).
 */
export async function executeDiscordWrite(
    job: DiscordOutboxJobData
): Promise<{ success: true; messageId?: string }> {
    const validated = DiscordOutboxJobSchema.parse(job);
    const channelId = validated.channelId;

    // 🛑 Disjoncteur : un job DÉJÀ en file au moment où le salon est tombé en panne
    // ne doit pas être rejoué (c'est le retry qui entretenait le bruit). Le worker
    // n'alerte pas sur cette erreur : le garde-fou fonctionne, ce n'est pas un incident.
    if (await isDiscordChannelBlocked(channelId)) {
        throw new DiscordChannelBlockedError(channelId);
    }

    try {
        return await dispatchDiscordWrite(validated);
    } catch (error) {
        if (isPermanentDiscordWriteFailure(error)) {
            const status = getDiscordApiStatus(error);
            const code = getDiscordApiCode(error);
            const reason = error instanceof Error ? error.message : String(error);
            throw new PermanentDiscordWriteError(
                `${reason}${status ? ` (HTTP ${status}` : " ("}${code !== undefined ? ` · code ${code}` : ""})`,
                { status: status || undefined, discordCode: code, channelId },
            );
        }
        throw error;
    }
}

async function dispatchDiscordWrite(
    validated: DiscordOutboxJobData
): Promise<{ success: true; messageId?: string }> {
    switch (validated.kind) {
        case "postMessage": {
            const messageId = await postChannelMessage(validated.channelId, validated.body);
            if (messageId === null) throw new Error("Discord outbox: postMessage a échoué");
            // Living status : ré-ancre le VRAI ID posté pour que le prochain
            // tick puisse PATCHer au lieu de recréer. Jamais de valeur non-snowflake.
            if (validated.storeMessageIdKey && isDiscordSnowflake(messageId)) {
                try {
                    const { redis } = await import("@/lib/redis");
                    await redis.set(
                        validated.storeMessageIdKey,
                        messageId,
                        "EX",
                        validated.storeMessageIdTTL ?? 60 * 60 * 24 * 30
                    );
                } catch (e) {
                    // Persistance best-effort : l'envoi a réussi, on ne fait pas
                    // échouer (retry) le job pour ça — le prochain tick recréera.
                    const { logger } = await import("@/lib/logger");
                    logger.warn("[Discord Outbox] Persistance ID message impossible:", e);
                }
            }
            return { success: true, messageId };
        }
        case "deleteMessage": {
            const ok = await deleteChannelMessage(validated.channelId, validated.messageId);
            if (!ok) throw new Error("Discord outbox: deleteMessage a échoué");
            return { success: true };
        }
        case "patchMessage": {
            const ok = await patchChannelMessage(validated.channelId, validated.messageId, validated.body);
            if (!ok) throw new Error("Discord outbox: patchMessage a échoué");
            return { success: true };
        }
        case "forumThread": {
            const thread = await createForumThread(validated.channelId, validated.body);
            if (!thread) throw new Error("Discord outbox: forumThread a échoué");
            return { success: true };
        }
    }
}
