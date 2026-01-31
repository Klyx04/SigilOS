import { Worker, Job } from "bullmq";
import { redis } from "./redis";
import { OCR_QUEUE_NAME, OcrJobData } from "./ocr-queue";
import { db } from "./prisma";
import { readFile } from "fs/promises";
import { analyzeMissionScreenshot } from "./ocr";
// We will later import specialized functions for ladder

let internalWorker: Worker | null = null;

export const initOcrWorker = () => {
    if (redis.status !== "ready") {
        console.warn("[Worker] Redis not ready, worker will not start.");
        return null;
    }

    if (!internalWorker) {
        internalWorker = new Worker(
            OCR_QUEUE_NAME,
            async (job: Job<OcrJobData>) => {
                const { imagePath, userId, guildId, type, missionCategory, missionPayload } = job.data;

                console.log(`[Worker] Starting job ${job.id} for user ${userId} (${type})`);

                try {
                    const imageBuffer = await readFile(imagePath);

                    if (type === "MISSION") {
                        const result = await analyzeMissionScreenshot(
                            imageBuffer,
                            missionCategory as any,
                            missionPayload
                        );
                        console.log(`[Worker] Job ${job.id} done: ${result.isValid ? "VALID" : "INVALID"}`);
                    }
                    return { success: true };
                } catch (error) {
                    console.error(`[Worker] Job ${job.id} failed:`, error);
                    throw error;
                }
            },
            {
                connection: redis,
                concurrency: 1,
            }
        );

        internalWorker.on("completed", (job) => {
            console.log(`[Worker] Job ${job.id} completed successfully`);
        });

        internalWorker.on("failed", (job, err) => {
            console.error(`[Worker] Job ${job?.id || "unknown"} failed with error: ${err.message}`);
        });
    }
    return internalWorker;
};

// Auto-init only if we are on server-side and redis might be ready
if (typeof window === "undefined") {
    redis.on("ready", () => {
        console.log("[Worker] Redis is ready, initializing OCR worker...");
        initOcrWorker();
    });
}
