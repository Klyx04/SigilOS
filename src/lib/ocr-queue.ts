import { Queue } from "bullmq";
import { redis } from "./redis";

export const OCR_QUEUE_NAME = "ocr-processing";

let internalQueue: Queue | null = null;

// Lazy getter for the queue
export const getOcrQueue = () => {
    if (redis.status !== "ready" && redis.status !== "connecting") {
        return null;
    }

    if (!internalQueue) {
        internalQueue = new Queue(OCR_QUEUE_NAME, {
            connection: redis,
            defaultJobOptions: {
                attempts: 2,
                backoff: {
                    type: "exponential",
                    delay: 1000,
                },
                removeOnComplete: true,
                removeOnFail: 100,
            },
        });
    }
    return internalQueue;
};

export interface OcrJobData {
    imagePath: string;
    userId: string;
    guildId: string;
    type: "LADDER" | "MISSION";
    missionCategory?: string;
    missionPayload?: any;
}

export async function addOcrJob(data: OcrJobData) {
    const queue = getOcrQueue();
    if (!queue) {
        console.error("[OCR Queue] Redis unavailable, cannot add job.");
        return null;
    }
    return await queue.add("process-screenshot", data);
}
