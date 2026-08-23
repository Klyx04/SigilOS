import { Queue } from "bullmq";
import { defaultQueueOptions } from "./metamob-queue";

// Queue name — must match the one in ladder-sync-worker.ts
export const LADDER_QUEUE_NAME = "sigilos-ladder-sync";

// Singleton queue instance (queue only — no worker created here)
// This file is safe to import from Next.js server actions.
const globalForQueue = global as unknown as { ladderQueue: Queue | undefined };

export const ladderQueue =
    globalForQueue.ladderQueue ?? new Queue(LADDER_QUEUE_NAME, defaultQueueOptions);

if (process.env.NODE_ENV !== "production") {
    globalForQueue.ladderQueue = ladderQueue;
}
