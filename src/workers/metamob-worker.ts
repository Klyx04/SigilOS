import "dotenv/config";
import { Worker, Job } from "bullmq";
import { METAMOB_QUEUE_NAME, defaultQueueOptions } from "../lib/queue/metamob-queue";
import { db } from "../lib/prisma";
import { getQuestDetails, normalizeQuestMonster, MetamobApiError, type QuestMonster } from "../lib/metamob-client";
import { decrypt } from "../lib/encryption";
import { logger } from "../lib/logger";
import { sendGlobalStatusPingCore } from "../server/status-ping-core";
import { sendDailySummaryReport } from "../server/actions/daily-report-actions";
// ── Ladder Sync ──────────────────────────────────────────────────────────────
import { ladderSyncWorker, ladderQueue } from "./ladder-sync-worker";
// ── Discord Outbox (P3.1) : flush des écritures Discord en mode dégradé ───────
import { discordOutboxWorker } from "./discord-outbox-worker";

interface ExchangeJobData {
    guildId: string;
    userId: string;
}

logger.info(`[Worker] Démarrage du Background Worker pour la queue: ${METAMOB_QUEUE_NAME}...`);

// THE HEAVY LOGIC (Copied & adapted from findOcreExchangePartners)
async function processExchangeJob(job: Job<ExchangeJobData>) {
    const { guildId, userId } = job.data;
    logger.info(`[Worker] Traitement du Job ${job.id} pour l'utilisateur ${userId} (Guild: ${guildId})`);

    await job.updateProgress(10); // 10%

    if (!userId || !guildId) {
        logger.warn(`[Worker] Job ${job.id} ignoré: paramètres manquants (userId: ${userId}, guildId: ${guildId})`);
        return;
    }

    // 1. Get current user's profile
    const currentUserProfile = await db.userProfile.findFirst({
        where: { userId, guild: { discordGuildId: guildId }, status: "ACTIVE" },
        select: { metamobPseudo: true, metamobQuestSlug: true, metamobVerified: true, metamobApiKey: true },
    });

    if (!currentUserProfile?.metamobQuestSlug || !currentUserProfile?.metamobPseudo || !currentUserProfile.metamobVerified) {
        logger.warn(`[Worker] Profil Metamob incomplet ou non vérifié pour l'utilisateur ${userId}. Job annulé silencieusement.`);
        return;
    }

    const effectiveApiKey = currentUserProfile.metamobApiKey || undefined;

    await job.updateProgress(20);

    // 2. Fetch current user's quest to know their precise needs
    const currentUserQuest = await getQuestDetails(
        currentUserProfile.metamobPseudo!,
        currentUserProfile.metamobQuestSlug,
        { guildApiKey: effectiveApiKey, status: "all", limit: 200 }
    );

    const currentUserPQ = currentUserQuest.parallel_quests || 1;
    const neededMonsterIds = new Set<number>();

    const processUserMonsters = (monsters: QuestMonster[]) => {
        for (const m of monsters) {
            const normalized = normalizeQuestMonster(m, currentUserPQ);
            if (normalized.state === "MANQUANT") neededMonsterIds.add(normalized.id);
        }
    };

    processUserMonsters(currentUserQuest.monsters);

    if (currentUserQuest.pagination.total > 200) {
        let offset = 200;
        while (offset < currentUserQuest.pagination.total) {
            const page = await getQuestDetails(
                currentUserProfile.metamobPseudo!,
                currentUserProfile.metamobQuestSlug,
                { guildApiKey: effectiveApiKey, status: "all", limit: 200, offset }
            );
            processUserMonsters(page.monsters);
            offset += 200;
        }
    }

    await job.updateProgress(40);

    // 3. Get all OTHER guild members
    const guildMembers = await db.userProfile.findMany({
        where: {
            guild: { discordGuildId: guildId },
            status: "ACTIVE",
            metamobVerified: true,
            metamobPseudo: { not: null },
            metamobQuestSlug: { not: null },
            userId: { not: userId }, // Exclude self
        },
        select: { metamobPseudo: true, metamobQuestSlug: true, metamobApiKey: true, discordNickname: true, id: true, user: { select: { id: true, name: true, image: true } } },
    });

    const partners: any[] = [];
    const BATCH_SIZE = 3;
    let processedMembers = 0;

    // 4. Batch process API calls to avoid rate limits
    for (let i = 0; i < guildMembers.length; i += BATCH_SIZE) {
        const batch = guildMembers.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (member: any) => {
            if (!member.metamobPseudo || !member.metamobQuestSlug) return;

            try {
                const effectiveKey = decrypt(member.metamobApiKey) || effectiveApiKey;
                const firstPage = await getQuestDetails(
                    member.metamobPseudo,
                    member.metamobQuestSlug,
                    { guildApiKey: effectiveKey, status: "all", limit: 200 }
                );

                let allMonsters = [...firstPage.monsters];
                const pq = firstPage.parallel_quests || 1;
                let offset = 200;

                while (offset < firstPage.pagination.total) {
                    const nextPage = await getQuestDetails(
                        member.metamobPseudo,
                        member.metamobQuestSlug,
                        { guildApiKey: effectiveKey, status: "all", limit: 200, offset }
                    );
                    allMonsters = [...allMonsters, ...nextPage.monsters];
                    offset += 200;
                }

                // Calculate surplus
                const monstersTheyHave = allMonsters
                    .map(m => normalizeQuestMonster(m, pq))
                    .filter(normalized => normalized.state === "DOUBLON")
                    .map(normalized => {
                        const coversNeed = neededMonsterIds.has(normalized.id);
                        return {
                            id: normalized.id,
                            name: normalized.nameFr || "Inconnu",
                            imageUrl: normalized.image,
                            available: normalized.owned - pq,
                            needed: coversNeed ? 1 : 0,
                            coversNeed,
                        };
                    });

                if (monstersTheyHave.length > 0) {
                    // Calculate matches Score for sorting
                    const exactMatches = monstersTheyHave.filter(m => m.coversNeed).length;
                    const bonusScore = exactMatches * 10;
                    const volumeScore = monstersTheyHave.length;
                    const matchScore = bonusScore + volumeScore;

                    partners.push({
                        username: member.metamobPseudo,
                        characterName: member.discordNickname || member.user.name || member.metamobPseudo,
                        discordId: member.user.id,
                        discordAvatar: member.user.image,
                        profileId: member.id,
                        parallelQuests: pq,
                        monstersTheyHave: monstersTheyHave.sort((a, b) => (b.coversNeed ? 1 : 0) - (a.coversNeed ? 1 : 0)),
                        monstersYouHave: [], // We don't cross-calculate "monsters you have that they need" for now to save API calls
                        matchScore,
                    });
                }
            } catch (memberError: any) {
                logger.error(`[Worker] Erreur sync MetaMob pour ${member.metamobPseudo}:`, memberError);
            }
        }));

        processedMembers += batch.length;
        const progress = 40 + Math.floor((processedMembers / guildMembers.length) * 50);
        await job.updateProgress(progress);

        // Anti-spam delay between batches
        if (i + BATCH_SIZE < guildMembers.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    await job.updateProgress(100);
    logger.info(`[Worker] Job ${job.id} terminé avec ${partners.length} partenaires trouvés.`);

    // Return the JSON data directly to BullMQ
    // The caller (ocre-actions.ts) can retrieve it via Job.returnValue
    return partners;
}

// Create the Worker instance
const worker = new Worker(METAMOB_QUEUE_NAME, processExchangeJob, {
    ...defaultQueueOptions,
    concurrency: 2, // Process up to 2 syncs at the exact same time
});

worker.on("completed", async (job) => {
    logger.info(`[Worker] ✅ Job ${job.id} complété avec succès.`);
    
    // Notify God Dashboard for manual/critical syncs
    if (job.name === "manual-metamob-sync") {
        const { notifyGod } = await import("../server/actions/god-notif-actions");
        await notifyGod({
            title: "Sync Metamob (Dofusbook) Réussie",
            message: `La synchronisation manuelle pour l'utilisateur ${job.data.userId} s'est terminée avec succès.`,
            type: "WORKER_SYNC",
            success: true,
            metadata: { jobId: job.id, userId: job.data.userId, guildId: job.data.guildId }
        });
    }
});

worker.on("failed", async (job, err) => {
    logger.error(`[Worker] ❌ Job ${job?.id} a échoué: ${err.message}`);
    
    const { notifyGod } = await import("../server/actions/god-notif-actions");
    await notifyGod({
        title: "Sync Metamob (Dofusbook) ÉCHOUÉE",
        message: `Le job ${job?.id} a échoué : ${err.message}`,
        type: "WORKER_SYNC",
        success: false,
        ping: true,
        metadata: { jobId: job?.id, error: err.message, data: job?.data }
    });
});

// =============================================================================
// FUNC-02/03: CLEANUP WORKER (Purge Notifications + Expire OcreTradeRequests)
// =============================================================================

import { Queue } from "bullmq";

const CLEANUP_QUEUE_NAME = "sigilos-cleanup";

const cleanupQueue = new Queue(CLEANUP_QUEUE_NAME, defaultQueueOptions);

// Schedule the cleanup to run every day at 4:00 AM
cleanupQueue.add(
    "daily-cleanup",
    {},
    {
        repeat: { pattern: "0 4 * * *" }, // Every day at 04:00
        removeOnComplete: 5,
        removeOnFail: 3,
    }
);

const cleanupWorker = new Worker(
    CLEANUP_QUEUE_NAME,
    async (job) => {
        logger.info(`[Cleanup] Démarrage du nettoyage quotidien (Job: ${job.id})...`);

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // FUNC-02: Purge old read notifications (> 30 days)
        try {
            const deletedNotifs = await db.notification.deleteMany({
                where: {
                    read: true,
                    createdAt: { lt: thirtyDaysAgo },
                },
            });
            logger.info(`[Cleanup] 🗑️ ${deletedNotifs.count} notifications lues supprimées (> 30j).`);
        } catch (err) {
            logger.error("[Cleanup] Erreur purge notifications:", { error: String(err) });
        }

        // FUNC-03: Expire stale OcreTradeRequests (PENDING > 7 days → CANCELED)
        try {
            const expiredTrades = await db.ocreTradeRequest.updateMany({
                where: {
                    status: "PENDING",
                    createdAt: { lt: sevenDaysAgo },
                },
                data: {
                    status: "CANCELED",
                },
            });
            logger.info(`[Cleanup] ⏰ ${expiredTrades.count} demandes d'échange Ocre expirées (> 7j PENDING → CANCELED).`);
        } catch (err) {
            logger.error("[Cleanup] Erreur expiration OcreTradeRequests:", { error: String(err) });
        }

        // SONGES: Auto-reject expired join requests (PENDING > 24h)
        try {
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

            const expiredRequests = await db.dreamJoinRequest.findMany({
                where: {
                    status: "PENDING",
                    createdAt: { lt: oneDayAgo },
                },
                include: { run: { select: { difficulty: true, guildId: true } } },
            });

            if (expiredRequests.length > 0) {
                for (const req of expiredRequests) {
                    await db.dreamJoinRequest.update({
                        where: { id: req.id },
                        data: { status: "REJECTED", respondedAt: new Date() },
                    });

                    // Resolve internal guild ID (req.run.guildId est un discordGuildId)
                    const guild = await db.guildConfig.findUnique({
                        where: { discordGuildId: req.run.guildId },
                        select: { id: true },
                    });

                    // Notify user directly via DB
                    await db.notification.create({
                        data: {
                            userId: req.userId,
                            guildId: guild?.id || null,
                            type: "SYSTEM_INFO",
                            title: "Candidature expirée",
                            message: `Votre candidature pour la run ${req.run.difficulty} a expiré (aucune réponse du leader sous 24 heures).`,
                            link: `/dashboard/${req.run.guildId}/songes`,
                        },
                    });
                }
                logger.info(`[Cleanup] ⏳ ${expiredRequests.length} candidatures Songes expirées auto-rejetées.`);
            }
        } catch (err) {
            logger.error("[Cleanup] Erreur expiration candidatures Songes:", { error: String(err) });
        }

        // SONGES: Auto-abandon inactive runs (> 3 days without ANY member/floor/join activity)
        try {
            const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

            // On exclut les runs qui ont eu une candidature ou un floor actif récemment
            const inactiveRuns = await db.dreamRun.findMany({
                where: {
                    status: { in: ["RECRUITING", "IN_PROGRESS"] },
                    updatedAt: { lt: threeDaysAgo },
                    // Exclure les runs qui ont eu une récente joinRequest ou floor
                    joinRequests: { none: { createdAt: { gt: threeDaysAgo } } },
                    floors: { none: { completedAt: { gt: threeDaysAgo } } },
                },
                select: { id: true, guildId: true },
            });

            for (const run of inactiveRuns) {
                await db.dreamRun.update({
                    where: { id: run.id },
                    data: { status: "ABANDONED", completedAt: new Date() },
                });
            }

            if (inactiveRuns.length > 0) {
                logger.info(`[Cleanup] 🌙 ${inactiveRuns.length} runs Songes inactives abandonnées (> 3j sans activité).`);
            }
        } catch (err) {
            logger.error("[Cleanup] Erreur abandon runs Songes:", { error: String(err) });
        }

        logger.info(`[Cleanup] ✅ Nettoyage quotidien terminé.`);
    },
    {
        ...defaultQueueOptions,
        concurrency: 1,
    }
);

cleanupWorker.on("completed", (job) => {
    logger.info(`[Cleanup] ✅ Job ${job.id} terminé.`);
});

cleanupWorker.on("failed", (job, err) => {
    logger.error(`[Cleanup] ❌ Job ${job?.id} a échoué: ${err.message}`);
});

// =============================================================================
// 🛰️ CRON WORKER: Status Ping & Daily Summary
// =============================================================================

const CRON_QUEUE_NAME = "sigilos-cron-tasks";
const cronQueue = new Queue(CRON_QUEUE_NAME, defaultQueueOptions);

// 1. Status Ping (Every 15 minutes)
cronQueue.add(
    "status-ping",
    {},
    {
        repeat: { pattern: "*/15 * * * *" }, // Every 15 mins
        jobId: "status-ping-repeat",
        removeOnComplete: 10,
        removeOnFail: 5,
    }
);

// 2. Daily Summary (Every morning at 08:30)
cronQueue.add(
    "daily-summary",
    {},
    {
        repeat: { pattern: "30 8 * * *" }, // Daily at 08:30
        jobId: "daily-summary-repeat",
        removeOnComplete: 5,
        removeOnFail: 3,
    }
);

// 3. Discord Veille (mensuelle — 1er du mois à 09:00) : gardien automatique #223 D.
// Personne n'a besoin de s'en souvenir : le système surveille le changelog / docs Discord
// et alerte God si un changement inquiétant est détecté (détail : src/lib/discord-veille.ts).
cronQueue.add(
    "discord-watch",
    {},
    {
        repeat: { pattern: "0 9 1 * *" }, // 1st day of month at 09:00
        jobId: "discord-watch-repeat",
        removeOnComplete: 10,
        removeOnFail: 5,
    }
);

const cronWorker = new Worker(
    CRON_QUEUE_NAME,
    async (job) => {
        if (job.name === "status-ping") {
            logger.info("[Cron] Execution du Status Ping GLOBAL...");
            const res = await sendGlobalStatusPingCore();
            if (!res.success) logger.error(`[Cron] Status Ping échoué: ${res.error}`);
        }

        if (job.name === "daily-summary") {
            logger.info("[Cron] Execution du Daily Summary pour toutes les guildes...");
            
            const guilds = await db.guildConfig.findMany({
                where: { systemNotifyChannelId: { not: null } },
                select: { discordGuildId: true, name: true }
            });

            logger.info(`[Cron] Envoi du rapport à ${guilds.length} guildes...`);
            
            for (const guild of guilds) {
                try {
                    const res = await sendDailySummaryReport(guild.discordGuildId, false);
                    if (res.success) {
                        logger.info(`[Cron] ✅ Rapport envoyé pour ${guild.name}`);
                    } else {
                        logger.error(`[Cron] ❌ Échec rapport pour ${guild.name}: ${res.error}`);
                    }
                } catch (e) {
                    logger.error(`[Cron] ❌ Échec rapport pour ${guild.name}`, { error: String(e) });
                }
            }
        }

        if (job.name === "discord-watch") {
            logger.info("[Cron] Exécution de la VEILLE Discord mensuelle...");
            try {
                const { runDiscordVeille } = await import("../lib/discord-veille");
                const report = await runDiscordVeille();
                logger.info(`[Cron] Veille Discord terminée (anomalies: ${report.anomalies.length}, gateway: ${report.gatewayOk})`);
            } catch (e) {
                logger.error(`[Cron] Veille Discord échouée: ${String(e)}`);
            }
        }
    },
    {
        ...defaultQueueOptions,
        concurrency: 1,
    }
);

// Graceful shutdown
const shutdown = async () => {
    logger.info("[Worker] Extinction du Background Worker...");
    await worker.close();
    await cleanupWorker.close();
    await cleanupQueue.close();
    await cronWorker.close();
    await cronQueue.close();
    await ladderSyncWorker.close();
    await ladderQueue.close();
    await discordOutboxWorker.close();
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

