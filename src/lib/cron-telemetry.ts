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
    cleanup_inactive_service_requests: {
        name: "Purge Demandes de Service Inactives",
        schedule: "Quotidien 04h40",
        logFile: "cleanup-inactive-service-requests.log",
    },
    check_links: {
        name: "Vérificateur de liens DofusDB/Dofensive",
        schedule: "Dimanches 04h15 (UTC)",
        logFile: "check-links.log",
    },
    cleanup_inactive_posts: {
        name: "Relance & Clôture Posts Inactifs (DJ/Quêtes/Songes)",
        schedule: "Quotidien 04h35 (UTC)",
        logFile: "cleanup-inactive-posts.log",
    },
    guild_orphan_watch: {
        name: "Détection Guildes Orphelines",
        schedule: "Quotidien 04h25 (UTC)",
        logFile: "guild-orphan-watch.log",
    },
    ladder_sync: {
        name: "Sync Ladder Général/Succès",
        schedule: "Toutes les 12h",
        logFile: "ladder-sync.log",
    },
    status_ping: {
        name: "Ping Statut Global",
        schedule: "Toutes les 5 min (garde-fou fréquence God)",
        logFile: "status-ping.log",
    },
    data_watch: {
        name: "Guetteur Nouveautés DofusDB",
        schedule: "Hebdo dimanches 05h00 (UTC)",
        logFile: "data-watch.log",
    },
    market_expire: {
        name: "Marché — Fins de vie & Rappels",
        schedule: "Toutes les 10 min",
        logFile: "market-expire.log",
    },
    raid_reminders: {
        name: "Rappel Raids — ping des inscrits (1 h avant)",
        schedule: "Toutes les 10 min",
        logFile: "raid-reminders.log",
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
 * 🚨 Constat ops (14/09/2026) — **un cron refusé n'écrivait rien**.
 *
 * Avec un `x-cron-secret` absent ou erroné, la route renvoie `401` **avant**
 * `recordCronExecution` : le panneau **God → Tâches CRON** restait donc
 * « Inconnu » / « Jamais », indiscernable d'une tâche qui n'a jamais été
 * appelée (constat user : « la crontab est mise depuis hier, toujours en
 * inconnu »). On trace désormais **le refus lui-même** — sans secret, sans
 * payload, sans donnée de guilde.
 *
 * 🛡️ Throttle **Redis `SET NX EX 600`** : la route de cron est publique, un
 * tiers ne peut donc pas remplir Redis (au plus **une** trace par tâche et par
 * 10 minutes). Redis indisponible ⇒ aucune trace (l'appelant l'ignore).
 */
export async function recordCronRefusal(cronId: string): Promise<boolean> {
    try {
        const claimed = await redis.set(`cron:refusal:${cronId}`, "1", "EX", 600, "NX");
        if (!claimed) return false;
        return await recordCronExecution(cronId, {
            success: false,
            summary:
                "Refusé (401) : en-tête « x-cron-secret » absent ou invalide — vérifier la ligne de crontab (secret réel + URL de CET environnement) puis relancer.",
        });
    } catch (err) {
        logger.error("[CronTelemetry] Failed to record cron refusal:", { cronId, error: err });
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

/**
 * Récupère l'historique des exécutions (10 dernières) d'un cron depuis Redis.
 */
export async function getCronHistory(cronId: string): Promise<CronExecutionRecord[]> {
    try {
        const historyKey = `${REDIS_PREFIX}history:${cronId}`;
        const rows = await redis.lrange(historyKey, 0, 9);
        return rows
            .map((raw) => {
                try {
                    return JSON.parse(raw) as CronExecutionRecord;
                } catch {
                    return null;
                }
            })
            .filter((r): r is CronExecutionRecord => r !== null);
    } catch (err) {
        logger.error("[CronTelemetry] Failed to get cron history:", { cronId, error: err });
        return [];
    }
}
