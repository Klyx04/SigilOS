import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

// Define the name of our queue
export const METAMOB_QUEUE_NAME = "metamob-sync";

// Shared connection options for BullMQ
export const defaultQueueOptions = {
    connection: redis as any,
    defaultJobOptions: {
        removeOnComplete: {
            age: 600, // keep up to 10 minutes
            count: 100, // keep up to 100 jobs
        },
        removeOnFail: {
            age: 24 * 3600,
            count: 1000
        },
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
};

// Singleton queue instance
const globalForQueue = global as unknown as { metamobQueue: Queue | undefined };

export const metamobQueue =
    globalForQueue.metamobQueue ?? new Queue(METAMOB_QUEUE_NAME, defaultQueueOptions);

if (process.env.NODE_ENV !== "production") {
    globalForQueue.metamobQueue = metamobQueue;
}
