import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sendChannelMessage, updateChannelMessage } from "@/server/discord";

const REDIS_STATUS_MSG_KEY = process.env.NODE_ENV === "production" ? "sigilos:discord_status_message_id_prod" : "sigilos:discord_status_message_id_beta";
const REDIS_STATUS_LAST_TS_KEY = process.env.NODE_ENV === "production" ? "sigilos:discord_status_last_ts_prod" : "sigilos:discord_status_last_ts_beta";

export interface StatusPingCoreOptions {
    mode?: 'living' | 'notification';
    isLite?: boolean;
    targetChannelId?: string;
    /**
     * Bypass du garde-fou de fréquence (envois manuels God / TEST PING :
     * l'opérateur veut un envoi immédiat, pas un skip silencieux).
     */
    force?: boolean;
    /** Source pour les logs (worker | cron:status-ping | cron:discord-status | manual). */
    source?: string;
}

// ─── Helpers purs (testés unitairement, sans I/O) ───────────────────────────

/** Un ID de message Discord est un snowflake : 15 à 21 chiffres. */
export function isDiscordSnowflake(v: unknown): v is string {
    return typeof v === "string" && /^\d{15,21}$/.test(v);
}

export const STATUS_PING_DEFAULT_FREQUENCY_MIN = 15;

/**
 * Fréquence assainie (minutes) : entier > 0, repli 15, borné à 24 h.
 * Le réglage God (`PlatformConfig.statusFrequency`) passe toujours par ici.
 */
export function resolveStatusFrequency(raw: unknown): number {
    const n = typeof raw === "string" ? Number.parseInt(raw, 10) : (raw as number);
    if (!Number.isFinite(n)) return STATUS_PING_DEFAULT_FREQUENCY_MIN;
    const minutes = Math.floor(n);
    if (minutes < 1) return STATUS_PING_DEFAULT_FREQUENCY_MIN;
    return Math.min(minutes, 1440);
}

/**
 * Garde-fou anti-spam : on saute le tick si le dernier envoi est plus récent
 * que `frequencyMin` (marge de 45 s pour absorber la dérive des schedulers).
 * C'est LUI qui rend le réglage God 5m/15m/1h effectif, quel que soit
 * l'orchestrateur (worker BullMQ toutes les 5 min, crons HTTP, UptimeRobot).
 */
export function shouldSkipStatusPing(
    lastTsMs: number | null | undefined,
    nowMs: number,
    frequencyMin: number
): boolean {
    if (!lastTsMs || !Number.isFinite(lastTsMs) || lastTsMs <= 0) return false;
    const elapsed = nowMs - lastTsMs;
    if (elapsed < 0) return false; // Horloge incohérente → on envoie (fail-open sur le monitoring).
    return elapsed < frequencyMin * 60_000 - 45_000;
}

/**
 * 🛰️ Core SANS contrôle d'accès : envoie un ping d'état des services sur Discord
 * (Living Status — met à jour le même message si possible).
 *
 * ⚠️ Réservé aux contextes système déjà authentifiés en amont :
 * routes cron protégées par `verifyCronSecret` (fail-closed) et worker BullMQ.
 * Les appels directs (navigateur / action serveur) DOIVENT passer par
 * `sendGlobalStatusPing` (`status-actions.ts`) qui exige `isSuperAdmin()`.
 */
export async function sendGlobalStatusPingCore(
    options: StatusPingCoreOptions = {}
) {
    const { mode, isLite, targetChannelId, force, source } = options;
    const src = source ?? "unknown";

    try {
        const config = await db.platformConfig.findUnique({
            where: { id: "singleton" },
            select: {
                serviceStatusChannelId: true,
                statusIsLite: true,
                statusMode: true,
                statusMention: true,
                statusFrequency: true,
            }
        });

        const channelId = targetChannelId || config?.serviceStatusChannelId;

        if (!channelId) {
            return { success: false, error: "Salon d'état des services non configuré." };
        }

        const effectiveMode = mode || (config?.statusMode as 'living' | 'notification') || 'living';
        const effectiveLite = isLite !== undefined ? isLite : (config?.statusIsLite || false);
        const frequencyMin = resolveStatusFrequency((config as { statusFrequency?: unknown } | null)?.statusFrequency);

        // Garde-fou de fréquence (réglage God 5m/15m/1h) — fail-soft : si Redis
        // est injoignable on ENVOIE quand même (le monitoring ne doit pas se
        // taire à cause de sa propre dépendance).
        if (!force) {
            try {
                const lastTsRaw = await redis.get(REDIS_STATUS_LAST_TS_KEY);
                const lastTs = lastTsRaw ? Number.parseInt(lastTsRaw, 10) : null;
                if (shouldSkipStatusPing(Number.isFinite(lastTs) ? lastTs : null, Date.now(), frequencyMin)) {
                    return {
                        success: true,
                        skipped: true as const,
                        action: "skipped" as const,
                        frequencyMin,
                        stats: { channelId },
                    };
                }
            } catch (e) {
                logger.warn(`[Status Ping] Garde-fou fréquence injoignable (envoi forcé quand même) [${src}]`, e);
            }
        }

        // 1. Health Checks
        const startDb = performance.now();
        await db.$queryRaw`SELECT 1`;
        const dbLatency = Math.round(performance.now() - startDb);
        const isDbOk = dbLatency < 500;

        let isRedisOk = false;
        let redisLatency = 0;
        try {
            const startRedis = performance.now();
            const pong = await redis.ping();
            redisLatency = Math.round(performance.now() - startRedis);
            isRedisOk = pong === "PONG";
        } catch (e) {
            logger.error("[Status Ping] Redis error:", e);
        }

        // 2. Dynamic Info
        const isBeta = process.env.NEXT_PUBLIC_APP_URL?.includes("beta") || process.env.NODE_ENV !== "production";
        const envName = isBeta ? "Beta / Test" : "Production";

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
        const statusUrl = `${appUrl}/status`;

        // Final Health Calc
        const systemStatus = isDbOk && isRedisOk ? "OPERATIONAL" : (!isDbOk && !isRedisOk ? "CRITICAL" : "DEGRADED");
        const statusColor = systemStatus === "OPERATIONAL" ? 0x10b981 : (systemStatus === "DEGRADED" ? 0xf59e0b : 0xef4444);

        // 3. Build the Embed — langage GRAND PUBLIC uniquement : aucune techno
        // interne ne fuite (pas de PostgreSQL/Redis/latences/uptime/version =
        // surface de reconnaissance offerte). Les mesures restent collectées
        // pour les logs/télémétrie God, pas pour le salon public.
        const okMark = "✅";
        const koMark = "⚠️";
        const allOk = systemStatus === "OPERATIONAL";
        const checkLine = allOk
            ? `${okMark} Tous les systèmes sont opérationnels.`
            : `${koMark} Certains services sont perturbés, on s'en occupe.`;
        const verifyTs = Math.floor(Date.now() / 1000);
        const timingLine = `Dernier contrôle : <t:${verifyTs}:R> • prochain dans ~${frequencyMin} min`;

        const fields = effectiveLite ? [
            {
                name: "Système",
                value: allOk ? `${okMark} Opérationnel` : `${koMark} Perturbé`,
                inline: true
            },
            {
                name: "Dernier contrôle",
                value: `<t:${verifyTs}:R>`,
                inline: true
            },
            {
                name: "Environnement",
                value: `\`${envName}\``,
                inline: true
            }
        ] : [
            {
                name: "📡 État des Services",
                value: checkLine,
                inline: false
            },
            {
                name: "🤖 Bot Discord",
                value: allOk ? `${okMark} En ligne` : `${koMark} Perturbé`,
                inline: true
            },
            {
                name: "🌐 Site & application",
                value: allOk ? `${okMark} En ligne` : `${koMark} Perturbés`,
                inline: true
            },
            {
                name: "💾 Données des guildes",
                value: isDbOk ? `${okMark} Accessibles` : `${koMark} Ralenties`,
                inline: true
            },
            {
                name: "🌍 Environnement",
                value: `\`${envName}\``,
                inline: true
            },
            {
                name: "🕐 Contrôles automatiques",
                value: timingLine,
                inline: false
            }
        ];

        const embed = {
            embedTitle: `🛰️ SigilOS — État des Systèmes`,
            embedUrl: statusUrl,
            embedDescription: !effectiveLite && systemStatus !== "OPERATIONAL"
                ? "Nos équipes (enfin, le robot de maintenance) analysent actuellement l'incident."
                : undefined,
            embedColor: statusColor,
            embedThumbnail: effectiveLite ? undefined : "https://sigilos.fr/assets/ui/logo-v2.png",
            fields,
            embedFooter: `SigilOS Status • Mise à jour auto`,
        };

        // 3. Dispatch Logic (Living Status : UN SEUL embed édité en place).
        let previousMessageId: string | null = null;
        try {
            previousMessageId = await redis.get(REDIS_STATUS_MSG_KEY);
        } catch (e) {
            logger.warn(`[Status Ping] Lecture ID message impossible (création) [${src}]`, e);
        }
        // L'ID stocké DOIT être un snowflake Discord. Toute autre valeur
        // (ex. `outbox:<jobId>` si l'outbox est activée un jour, corruption)
        // est ignorée au lieu de faire échouer le PATCH en boucle — c'était
        // le pattern qui transformait le living status en spam (1 nouveau
        // message par tick, jamais d'édition).
        const updatableId = isDiscordSnowflake(previousMessageId) ? previousMessageId : null;
        if (previousMessageId && !updatableId) {
            logger.warn(`[Status Ping] ID message stocké invalide, ignoré (nouveau message) [${src}]`, { previousMessageId });
        }

        let actionTaken = "created";
        let finalMessageId: string | null = null;

        // Mode 'living': try to update the old message
        if (effectiveMode === 'living' && updatableId) {
            try {
                const updated = await updateChannelMessage(channelId, updatableId, "", embed);
                if (updated) {
                    finalMessageId = updatableId;
                    actionTaken = "updated";
                }
            } catch (e) {
                // Message supprimé / salon inaccessible / 429 persistant :
                // on retombe sur la création + on ré-ancre la nouvelle ID.
                logger.warn(`[Status Ping] Living update failed, sending new message [${src}]`, { channelId, messageId: updatableId, error: String(e) });
            }
        }

        // Mode 'notification' OR update failed: send a new message
        if (!finalMessageId) {
            const mentionContent = config?.statusMention === 'none' ? "" : (config?.statusMention || "");
            finalMessageId = await sendChannelMessage(channelId, mentionContent, embed);
            if (finalMessageId && effectiveMode === 'living' && isDiscordSnowflake(finalMessageId)) {
                // Only save specifically for living status (et seulement les
                // vrais IDs — jamais `outbox:<jobId>`).
                try {
                    await redis.set(REDIS_STATUS_MSG_KEY, finalMessageId, "EX", 60 * 60 * 24 * 30);
                } catch (e) {
                    logger.warn(`[Status Ping] Persistance ID message impossible (prochain tick recréera) [${src}]`, e);
                }
            }
        }

        // Horodatage du dernier envoi effectif → garde-fou de fréquence.
        if (finalMessageId) {
            try {
                await redis.set(REDIS_STATUS_LAST_TS_KEY, String(Date.now()), "EX", 60 * 60 * 24 * 7);
            } catch (e) {
                logger.warn(`[Status Ping] Persistance horodatage impossible [${src}]`, e);
            }
        }

        return {
            success: true,
            action: actionTaken,
            messageId: finalMessageId,
            frequencyMin,
            stats: {
                systemStatus,
                dbLatency,
                redisLatency,
                channelId
            }
        };

    } catch (error: any) {
        logger.error("[Status Action] Critical Failure:", error);
        return { success: false, error: error.message || "Erreur de connexion Discord (vérifiez l'ID du salon)" };
    }
}
