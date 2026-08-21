import { createHash } from "crypto";
import { z } from "zod";
import { discordOutboxQueue } from "@/lib/queue/discord-outbox-queue";
import {
    postChannelMessage,
    deleteChannelMessage,
    patchChannelMessage,
    createForumThread,
} from "@/server/discord";

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
    const jobId = opts?.jobId ?? stableJobId(validated);
    await discordOutboxQueue.add("discord-write", validated, { jobId });
    return jobId;
}

// ─── Exécution (côté worker) ──────────────────────────────────────────────────

/**
 * Exécute une écriture Discord depuis la file. En cas d'échec (réseau, 429/5xx),
 * THROW : BullMQ retente avec le backoff exponentiel configuré. Les erreurs
 * permanentes (4xx) finissent par dépasser `attempts` et sont loggées/dropées.
 */
export async function executeDiscordWrite(
    job: DiscordOutboxJobData
): Promise<{ success: true; messageId?: string }> {
    const validated = DiscordOutboxJobSchema.parse(job);

    switch (validated.kind) {
        case "postMessage": {
            const messageId = await postChannelMessage(validated.channelId, validated.body);
            if (messageId === null) throw new Error("Discord outbox: postMessage a échoué");
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
