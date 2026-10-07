/**
 * SigilOS — Ladder Sync Worker
 * ============================================================
 * Synchronises Dofus ladder data (success points + general XP)
 * into UserProfile for every active member of every guild.
 *
 * Data source: Cloudflare Worker (dofus-ladder-proxy)
 *   GET <DOFUS_LADDER_WORKER_URL>?server_id=295&name=Pseudo&type=succes
 *   GET <DOFUS_LADDER_WORKER_URL>?server_id=295&name=Pseudo&type=general
 *
 * ─── Anti-ban / Rate limit strategy ──────────────────────────────────────────
 *
 * The CF Worker itself calls dofus.com which uses Cloudflare for DDoS
 * protection. Sending too many simultaneous requests risks triggering
 * a bot-detection challenge (JS challenge, captcha, or IP-level block).
 *
 * Mitigations applied here:
 *   1. STRICTLY SEQUENTIAL per-profile processing (no parallel fetches)
 *   2. Random jitter between each call  (BASE_DELAY + 0-JITTER_MAX ms)
 *   3. HTTP 429 / 503 → exponential backoff with max 3 retries
 *   4. Shuffle profiles order each run (no predictable timing signature)
 *   5. `ladderLastSyncAt` timestamp check — skip profiles synced < 22h ago
 *      (safe guard if cron fires twice / multiple guilds share same player)
 *   6. Zéro 429 mortel : après 5 rate-limits consécutifs, PAUSE LONGUE
 *      (cooldown 5 min) puis reprise — jamais d'abandon sur un simple orage
 *      429. Passé 12 cooldowns d'affilée (ladder vraiment KO), on s'arrête et
 *      la reprise se fait au run suivant (cutoff 22 h — rien n'est perdu).
 *   7. Pas de cap de durée : un run (forcé ou cron) va AU BOUT, même pour
 *      5000 profils (~7-8 h). Concurrence à 1, cutoff 22 h : les relances
 *      ne retraitent que le reste.
 *
 * Schedule: Every day at 03:00 (cron via BullMQ repeat)
 *
 * Env vars required:
 *   DOFUS_LADDER_WORKER_URL  — URL of the deployed Cloudflare Worker
 *   DOFUS_LADDER_WORKER_KEY  — X-SigilOS-Key secret header
 */

import "dotenv/config";
import { Worker, Queue, Job } from "bullmq";
import { defaultQueueOptions } from "../lib/queue/metamob-queue";
import { db } from "../lib/prisma";
import { logger } from "../lib/logger";

// ─── Config ──────────────────────────────────────────────────────────────────

const LADDER_QUEUE_NAME = "sigilos-ladder-sync";
const WORKER_URL = process.env.DOFUS_LADDER_WORKER_URL;
const WORKER_KEY = process.env.DOFUS_LADDER_WORKER_KEY;

// Minimum delay between two calls to the CF Worker (ms)
// 1 call / 2s = 30 calls/min → very reasonable
const BASE_DELAY_MS = 2000;
// Added random jitter on top of base delay to avoid clock-signature detection
const JITTER_MAX_MS = 1000;
// Min hours between two syncs for the same profile (prevents double-sync)
const MIN_HOURS_BETWEEN_SYNC = 22;
// If this many consecutive 429/503 errors occur, take a long cooldown
// instead of aborting (see strategy §6 above)
const MAX_CONSECUTIVE_ERRORS = 5;
// Long pause after a rate-limit storm (ms) — then resume where we stopped
const COOLDOWN_MS = 5 * 60 * 1000;
// Past this many cooldowns in a single run, the ladder is really down — stop,
// the next run resumes (22 h cutoff — nothing is lost)
const MAX_COOLDOWNS = 12;
// Max retries per individual request
const MAX_RETRIES = 3;

// ─── Types ────────────────────────────────────────────────────────────────────

interface CFSuccesResponse {
    found: boolean;
    points?: number;
    level?: number;
}

interface CFGeneralResponse {
    found: boolean;
    totalXp?: string;  // raw string to preserve BigInt precision
    level?: number;
    classe?: string;
}

type CFResponse = CFSuccesResponse | CFGeneralResponse;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Random int between min and max (inclusive) */
function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Shuffles array in-place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Polite pause with jitter */
async function politeDelay(): Promise<void> {
    const ms = BASE_DELAY_MS + randomBetween(0, JITTER_MAX_MS);
    await new Promise(r => setTimeout(r, ms));
}

/**
 * Fetch one ladder type for one character from the Cloudflare Worker.
 * Implements retry with exponential backoff on 429/503.
 * Returns the payload (check `.found`) — null only if WORKER_URL is missing.
 *
 * @throws {Error} on technical failure (timeout/429-503 exhausted/HTTP error :
 * `CF_TIMEOUT:` / `RATE_LIMIT:` / `CF_HTTP:`) so the caller counts it as
 * errored WITHOUT stamping lastLadderUpdate (retry next run).
 */
async function fetchFromCloudflare(
    pseudo: string,
    serverId: string,
    type: "succes" | "general",
    attempt = 0
): Promise<CFResponse | null> {
    if (!WORKER_URL) return null;

    const url = `${WORKER_URL}?server_id=${encodeURIComponent(serverId)}&name=${encodeURIComponent(pseudo)}&type=${type}`;
    const headers: Record<string, string> = { "Accept": "application/json" };
    if (WORKER_KEY) headers["X-SigilOS-Key"] = WORKER_KEY;

    let res: Response;
    try {
        res = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(20_000),
        });
    } catch (err: any) {
        // Network timeout or connection error → technical failure, NOT "not found".
        // Throw so the caller counts it as errored (no lastLadderUpdate stamp).
        if (attempt < MAX_RETRIES) {
            const backoff = (attempt + 1) * 3000 + randomBetween(0, 2000);
            logger.warn(`[LadderSync] Timeout ${pseudo} (${type}), retry ${attempt + 1}/${MAX_RETRIES} dans ${backoff}ms`);
            await new Promise(r => setTimeout(r, backoff));
            return fetchFromCloudflare(pseudo, serverId, type, attempt + 1);
        }
        throw new Error(`CF_TIMEOUT:${err.message}`);
    }

    // Rate limited → exponential backoff + retry
    if (res.status === 429 || res.status === 503) {
        if (attempt < MAX_RETRIES) {
            const retryAfter = parseInt(res.headers.get("Retry-After") || "0", 10);
            // Respect Retry-After header if present, otherwise exponential backoff
            const backoff = retryAfter * 1000 || (Math.pow(2, attempt + 1) * 5000 + randomBetween(0, 3000));
            logger.warn(`[LadderSync] ${res.status} pour ${pseudo} (${type}) — backoff ${backoff}ms (retry ${attempt + 1}/${MAX_RETRIES})`);
            await new Promise(r => setTimeout(r, backoff));
            return fetchFromCloudflare(pseudo, serverId, type, attempt + 1);
        }
        // Signal to caller that this was a rate limit failure (not just "not found")
        throw new Error(`RATE_LIMIT:${res.status}`);
    }

    if (!res.ok) {
        // 401/500/... — panne technique, PAS un pseudo introuvable. Throw pour
        // compter en erreur (sans stamper lastLadderUpdate : on réessaiera).
        throw new Error(`CF_HTTP:${res.status}`);
    }

    return await res.json() as CFResponse;
}

// ─── Queue setup ──────────────────────────────────────────────────────────────

const ladderQueue = new Queue(LADDER_QUEUE_NAME, defaultQueueOptions);

// Register the daily cron job (idempotent — BullMQ deduplicates by jobId)
ladderQueue.add(
    "daily-ladder-sync",
    {},
    {
        repeat: { pattern: "0 3 * * *" }, // Every day at 03:00 (server time)
        jobId: "ladder-sync-cron",         // Stable ID prevents duplicate crons
        removeOnComplete: 5,
        removeOnFail: 3,
    }
);

logger.info(`[LadderSync] Queue "${LADDER_QUEUE_NAME}" initialisée — cron 03:00 quotidien.`);

// ─── Main Job Processor ───────────────────────────────────────────────────────

async function processLadderSync(job: Job) {
    if (!WORKER_URL) {
        logger.error("[LadderSync] DOFUS_LADDER_WORKER_URL manquante — sync abandonnée.");
        return { synced: 0, notFound: 0, errored: 0, total: 0, cooldowns: 0, aborted: true };
    }

    logger.info(`[LadderSync] ⚔️ Démarrage (Job ${job.id})...`);
    await job.updateProgress(0);

    const isForced = job.data?.force === true;
    
    // ── 1. Fetch eligible profiles ────────────────────────────────────────────
    // Only sync guilds with ladderSync module enabled AND dofusServerId configured
    // Use lastLadderUpdate (existing field) to skip profiles synced < 22h ago unless forced
    const cutoff = new Date(Date.now() - MIN_HOURS_BETWEEN_SYNC * 60 * 60 * 1000);

    const whereClause: any = {
        status: "ACTIVE",
        pseudoDofus: { not: null },
        guild: {
            dofusServerId: { not: null },
            // Only sync guilds that have explicitly enabled the ladderSync module
            modules: { ladderSync: true },
        },
    };

    if (!isForced) {
        whereClause.OR = [
            { lastLadderUpdate: null },
            { lastLadderUpdate: { lt: cutoff } },
        ];
    }

    const profiles = await db.userProfile.findMany({
        where: whereClause,
        select: {
            id: true,
            pseudoDofus: true,
            guild: {
                select: { dofusServerId: true },
            },
        },
    });

    if (profiles.length === 0) {
        logger.info("[LadderSync] Tous les profils sont à jour (< 22h). Rien à sync.");
        return { synced: 0, notFound: 0, errored: 0, total: 0, cooldowns: 0, aborted: false };
    }

    // ── 2. Shuffle to avoid predictable timing ────────────────────────────────
    const shuffled = shuffle([...profiles]);
    logger.info(`[LadderSync] ${shuffled.length} profils à synchroniser (ordre aléatoire).`);

    let synced = 0;
    let notFound = 0;
    let errored = 0;
    let consecutiveRateLimits = 0;
    let cooldowns = 0;
    let aborted = false;

    // ── 3. STRICTLY SEQUENTIAL — one profile at a time ───────────────────────
    for (let i = 0; i < shuffled.length; i++) {
        // Rate-limit storm → long cooldown then RESUME (never abort on 429s).
        // Only a truly dead ladder (MAX_COOLDOWNS) stops the run — resume next time.
        if (consecutiveRateLimits >= MAX_CONSECUTIVE_ERRORS) {
            cooldowns++;
            if (cooldowns > MAX_COOLDOWNS) {
                logger.error(`[LadderSync] ⛔ ${MAX_COOLDOWNS} cooldowns épuisés — sync interrompue (${i}/${shuffled.length} profils traités). Reprise au prochain run.`);
                aborted = true;
                break;
            }
            logger.warn(`[LadderSync] ⏸️ ${MAX_CONSECUTIVE_ERRORS} rate-limits consécutifs — pause ${COOLDOWN_MS / 60000} min (cooldown ${cooldowns}/${MAX_COOLDOWNS}), reprise ensuite.`);
            await new Promise(r => setTimeout(r, COOLDOWN_MS));
            consecutiveRateLimits = 0;
        }

        const profile = shuffled[i];
        const pseudo = profile.pseudoDofus!;
        const serverId = profile.guild.dofusServerId!;

        try {
            // ── Call 1: Success points ────────────────────────────────────────
            const succesData = await fetchFromCloudflare(pseudo, serverId, "succes") as CFSuccesResponse | null;

            // Polite delay between the two calls for the SAME profile
            await politeDelay();

            // ── Call 2: General XP ────────────────────────────────────────────
            const generalData = await fetchFromCloudflare(pseudo, serverId, "general") as CFGeneralResponse | null;

            // Reset consecutive error counter on success
            consecutiveRateLimits = 0;

            // ── Build update payload ──────────────────────────────────────────
            const updateData: Record<string, unknown> = {
                lastLadderUpdate: new Date(),
            };

            if (succesData?.found && typeof succesData.points === "number") {
                updateData.successPoints = succesData.points;
                if (typeof succesData.level === "number") {
                    updateData.dofusLevel = succesData.level;
                }
            }

            if (generalData?.found) {
                if (generalData.totalXp) {
                    // SECURITY FIX (F-26): bound the XP string to avoid absurd values
                    const cleanXp = generalData.totalXp.replace(/\D/g, "").slice(0, 15);
                    if (cleanXp) updateData.totalXp = BigInt(cleanXp);
                }
                if (generalData.level && !updateData.dofusLevel) {
                    updateData.dofusLevel = Math.min(Math.max(Number(generalData.level), 1), 300);
                }
                if (generalData.classe) {
                    // SECURITY FIX (F-26): bound class name length (Dofus classes are short)
                    updateData.classe = String(generalData.classe).slice(0, 50);
                }
            }

            // If neither ladder found this character, still stamp the sync time
            // so we don't re-try them within 22h
            if (!succesData?.found && !generalData?.found) {
                notFound++;
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: { lastLadderUpdate: new Date() },
                });
            } else {
                await db.userProfile.update({
                    where: { id: profile.id },
                    data: updateData,
                });
                synced++;
            }

        } catch (err: any) {
            errored++;
            if (err.message?.startsWith("RATE_LIMIT:")) {
                consecutiveRateLimits++;
                logger.warn(`[LadderSync] Rate-limit consécutif ${consecutiveRateLimits}/${MAX_CONSECUTIVE_ERRORS} pour ${pseudo}`);
            } else {
                consecutiveRateLimits = 0; // Non-rate-limit errors don't count
                logger.error(`[LadderSync] Erreur sync ${pseudo}: ${err.message}`);
            }
        }

        // ── Polite delay between profiles (ALWAYS, even after errors) ─────────
        if (i < shuffled.length - 1) {
            await politeDelay();
        }

        // Update progress every 10 profiles
        if (i % 10 === 0) {
            await job.updateProgress(Math.min(99, Math.floor((i / shuffled.length) * 100)));
        }
    }

    await job.updateProgress(100);
    logger.info(
        `[LadderSync] ✅ Terminé. Synced: ${synced} | NotFound: ${notFound} | Errors: ${errored} | Cooldowns: ${cooldowns} | Total: ${shuffled.length}`
    );
    return { synced, notFound, errored, total: shuffled.length, cooldowns, aborted };
}

// ─── Worker Instance ──────────────────────────────────────────────────────────

const ladderSyncWorker = new Worker(
    LADDER_QUEUE_NAME,
    processLadderSync,
    {
        ...defaultQueueOptions,
        concurrency: 1,
    }
);

ladderSyncWorker.on("completed", async (job) => {
    logger.info(`[LadderSync] ✅ Job ${job.id} terminé.`);
    const summary = (job.returnvalue ?? {}) as {
        synced?: number; notFound?: number; errored?: number;
        total?: number; cooldowns?: number; aborted?: boolean;
    };
    const message = `Sync ladder terminée (worker) : ${summary.synced ?? "?"} OK, ${summary.notFound ?? "?"} introuvables, ${summary.errored ?? "?"} erreurs${summary.cooldowns ? `, ${summary.cooldowns} cooldown(s)` : ""}${summary.aborted ? " — INTERROMPUE (reprise au prochain run)" : ""}.`;

    // Cache ladder périmé par le run : sans ça, le module affiche encore les
    // 0 pendant 5-10 min après un force (faux « ça n'a rien fait »).
    try {
        const { clearCachePattern } = await import("../lib/cache");
        await clearCachePattern("ladder:*");
    } catch (e) {
        logger.warn("[LadderSync] Invalidation cache impossible:", e);
    }

    // Télémétrie God (onglet cron-status) : sans ça, la sync tourne (toutes les
    // 12h) mais le panneau affiche "Jamais" en permanence.
    try {
        const { recordCronExecution } = await import("../lib/cron-telemetry");
        await recordCronExecution("ladder_sync", {
            success: !summary.aborted,
            summary: message,
            details: { jobId: job.id, ...summary },
        });
    } catch (e) {
        logger.warn("[LadderSync] Télémétrie impossible:", e);
    }

    const { notifyGod } = await import("../server/actions/god-notif-actions");
    await notifyGod({
        title: summary.aborted ? "Ladder Background Sync Interrompue" : "Ladder Background Sync Réussie",
        message,
        type: "WORKER_SYNC",
        success: !summary.aborted,
        metadata: { jobId: job.id, timestamp: new Date().toISOString(), ...summary }
    });
});

ladderSyncWorker.on("failed", async (job, err) => {
    logger.error(`[LadderSync] ❌ Job ${job?.id} a échoué: ${err.message}`);

    try {
        const { recordCronExecution } = await import("../lib/cron-telemetry");
        await recordCronExecution("ladder_sync", {
            success: false,
            summary: `Échec sync ladder: ${err.message}`,
        });
    } catch (e) {
        logger.warn("[LadderSync] Télémétrie impossible:", e);
    }

    const { notifyGod } = await import("../server/actions/god-notif-actions");
    await notifyGod({
        title: "Ladder Background Sync ÉCHOUÉE",
        message: `Le job de synchronisation ladder ${job?.id} a échoué : ${err.message}`,
        type: "WORKER_SYNC",
        success: false,
        ping: true,
        metadata: { jobId: job?.id, error: err.message }
    });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export { ladderSyncWorker, ladderQueue };

// ─── Direct Execution for Testing ─────────────────────────────────────────────
// Removed to prevent bundle issue where require.main === module evaluates to true in the worker's esbuild output.
