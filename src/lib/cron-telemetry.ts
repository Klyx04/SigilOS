import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export interface CronExecutionRecord {
    id: string;
    name: string;
    schedule: string;
    lastRun: string | null;
    durationMs: number | null;
    status: "success" | "error" | "unknown";
    summary: string | null;
    details?: any;
    lines?: string[];
}

export const KNOWN_CRON_TASKS: Record<string, { name: string; schedule: string; logFile?: string }> = {
    backup_db: {
        name: "Backup BDD (GPG → R2)",
        schedule: "Quotidien 03h00",
        logFile: "backup.log",
    },
    maintenance: {
        name: "Maintenance VPS",
        schedule: "Quotidien 04h00",
        logFile: "maintenance.log",
    },
    cleanup_logs: {
        name: "Purge Logs d'Audit",
        schedule: "Quotidien 03h05",
        logFile: "cleanup-logs.log",
    },
    account_retention: {
        name: "Purge RGPD Comptes Orphelins",
        schedule: "Quotidien 06h00",
        logFile: "account-retention.log",
    },
    sync_members: {
        name: "Sync Membres Discord",
        schedule: "Toutes les 30 min",
        logFile: "sync-members.log",
    },
    avatar_resync: {
        name: "Resync Avatars Discord",
        schedule: "Quotidien 05h00",
        logFile: "avatar-resync.log",
    },
    mission_reset: {
        name: "Rappel Reset Missions",
        schedule: "Mardi 08h00",
        logFile: "missions_cron.log",
    },
    daily_summary: {
        name: "Rapport Quotidien Guilde",
        schedule: "Quotidien 08h30",
        logFile: "daily_report.log",
    },
    discord_status: {
        name: "Statut Discord",
        schedule: "Quotidien 09h00",
        logFile: "discord-status.log",
    },
    janitor: {
        name: "Janitor BDD (RGPD)",
        schedule: "Dans maintenance 04h00",
        logFile: "janitor.log",
    },
    cleanup_proofs: {
        name: "Purge Preuves Obsolètes",
        schedule: "Quotidien 04h10",
        logFile: "cleanup-proofs.log",
    },
    close_old_polls: {
        name: "Auto-clôture Sondages",
        schedule: "Quotidien 04h20",
        logFile: "close-old-polls.log",
    },
    sync_dofensive_maps: {
        name: "Sync Maps Dofensive",
        schedule: "Quotidien 03h30",
        logFile: "sync-dofensive-maps.log",
    },
    sync_monster_stats: {
        name: "Sync Stats Monstres",
        schedule: "Quotidien 03h45",
        logFile: "sync-monster-stats.log",
    },
    loan_reminders: {
        name: "Rappels Prêts Coffre",
        schedule: "Quotidien 12h00",
        logFile: "loan-reminders.log",
    },
};

const REDIS_PREFIX = "cron:telemetry:";
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 jours

/**
 * Enregistre le résultat de l'exécution d'un cron dans Redis.
 */
export async function recordCronExecution(
    cronId: string,
    result: {
        success: boolean;
        durationMs?: number;
        summary?: string;
        details?: any;
    }
) {
    try {
        const meta = KNOWN_CRON_TASKS[cronId] || {
            name: cronId,
            schedule: "Automatique",
        };

        const record: CronExecutionRecord = {
            id: cronId,
            name: meta.name,
            schedule: meta.schedule,
            lastRun: new Date().toISOString(),
            durationMs: result.durationMs ?? null,
            status: result.success ? "success" : "error",
            summary: result.summary ?? (result.success ? "Exécution réussie" : "Échec d'exécution"),
            details: result.details,
            lines: result.summary ? [result.summary] : [],
        };

        const key = `${REDIS_PREFIX}${cronId}`;
        await redis.set(key, JSON.stringify(record), "EX", TTL_SECONDS);

        // Ajout à la liste d'historique (10 dernières exécutions)
        const historyKey = `${REDIS_PREFIX}history:${cronId}`;
        await redis.lpush(historyKey, JSON.stringify(record));
        await redis.ltrim(historyKey, 0, 9);
        await redis.expire(historyKey, TTL_SECONDS);

        return true;
    } catch (err) {
        logger.error("[CronTelemetry] Failed to record cron execution:", { cronId, error: err });
        return false;
    }
}

/**
 * Récupère le statut de tous les crons enregistrés.
 */
export async function getAllCronStatuses(): Promise<CronExecutionRecord[]> {
    try {
        const cronIds = Object.keys(KNOWN_CRON_TASKS);
        const keys = cronIds.map((id) => `${REDIS_PREFIX}${id}`);
        const values = await redis.mget(...keys);

        return cronIds.map((id, index) => {
            const raw = values[index];
            const meta = KNOWN_CRON_TASKS[id];

            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    return {
                        ...parsed,
                        name: meta.name,
                        schedule: meta.schedule,
                    };
                } catch {
                    // Fallthrough to default unknown
                }
            }

            return {
                id,
                name: meta.name,
                schedule: meta.schedule,
                lastRun: null,
                durationMs: null,
                status: "unknown",
                summary: "Aucune exécution récente enregistrée",
                lines: [],
            };
        });
    } catch (err) {
        logger.error("[CronTelemetry] Failed to get all cron statuses:", { error: err });
        return Object.entries(KNOWN_CRON_TASKS).map(([id, meta]) => ({
            id,
            name: meta.name,
            schedule: meta.schedule,
            lastRun: null,
            durationMs: null,
            status: "unknown",
            summary: "Erreur de lecture Redis",
            lines: [],
        }));
    }
}
