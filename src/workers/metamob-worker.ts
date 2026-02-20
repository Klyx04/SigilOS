import "dotenv/config";
import { Worker, Job } from "bullmq";
import { METAMOB_QUEUE_NAME, defaultQueueOptions } from "../lib/queue/metamob-queue";
import { db } from "../lib/prisma";
import { getQuestDetails, normalizeQuestMonster, MetamobApiError, type QuestMonster } from "../lib/metamob-client";
import { decrypt } from "../lib/encryption";
import { logger } from "../lib/logger";

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
        select: { metamobPseudo: true, metamobQuestSlug: true, metamobVerified: true, metamobApiKey: true, guild: { select: { metamobApiKey: true } } },
    });

    if (!currentUserProfile?.metamobQuestSlug || !currentUserProfile?.metamobPseudo || !currentUserProfile.metamobVerified) {
        logger.warn(`[Worker] Profil Metamob incomplet ou non vérifié pour l'utilisateur ${userId}. Job annulé silencieusement.`);
        return;
    }

    const effectiveApiKey = decrypt(currentUserProfile.metamobApiKey) || decrypt(currentUserProfile.guild?.metamobApiKey) || undefined;

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

worker.on("completed", (job) => {
    logger.info(`[Worker] ✅ Job ${job.id} complété avec succès.`);
});

worker.on("failed", (job, err) => {
    logger.error(`[Worker] ❌ Job ${job?.id} a échoué: ${err.message}`);
});

// Graceful shutdown
const shutdown = async () => {
    logger.info("[Worker] Extinction du Background Worker...");
    await worker.close();
    process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
