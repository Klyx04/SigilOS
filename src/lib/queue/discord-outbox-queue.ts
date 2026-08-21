import { Queue } from "bullmq";
import { defaultQueueOptions } from "./metamob-queue";

// Queue name — must match the one in discord-outbox-worker.ts
export const DISCORD_OUTBOX_QUEUE_NAME = "discord-outbox";

// #223 P3.1 — Outbox des écritures Discord : retry PERSISTANT 429/5xx (Redis).
// 8 tentatives max, backoff exponentiel (5s, 10s, 20s...) : suffisant pour des
// coupures Discord > 30 s sans flooder l'API quand elle revient.
export const discordOutboxQueueOptions = {
    ...defaultQueueOptions,
    defaultJobOptions: {
        ...defaultQueueOptions.defaultJobOptions,
        attempts: 8,
        backoff: {
            type: "exponential" as const,
            delay: 5000,
        },
    },
};

// Singleton queue instance (queue only — no worker created here)
// This file is safe to import from Next.js server actions.
const globalForQueue = global as unknown as { discordOutboxQueue: Queue | undefined };

export const discordOutboxQueue =
    globalForQueue.discordOutboxQueue ?? new Queue(DISCORD_OUTBOX_QUEUE_NAME, discordOutboxQueueOptions);

if (process.env.NODE_ENV !== "production") {
    globalForQueue.discordOutboxQueue = discordOutboxQueue;
}
