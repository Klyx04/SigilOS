/**
 * Santé des salons Discord — **disjoncteur par salon** (anti-boucle et anti-bruit).
 *
 * ── Pourquoi ce module existe (mesure du 25/09/2026) ─────────────────────────
 * Deux incidents distincts ont été mesurés en bêta :
 *  ① **La boucle** : le salon de notifications God est inaccessible (403 · code
 *     50001) → l'écriture part dans la file `discord-outbox` → refus permanent →
 *     alerte → *cette alerte repartait sur Discord par la même file* → 4 575
 *     alertes en 90 min (~0,85/s). Corrigé par `webOnly` (`notifyGod`).
 *  ② **Le bruit qui reste** : un salon mort **continue d'être écrit** par les
 *     tâches récurrentes. Mesuré : le salon `1468401237186707588` échouait
 *     **exactement à `:10:00` de chaque heure** (18:10:00.87 puis 19:10:00.447)
 *     parce que le status-ping (cron toutes les 5 min, garde-fou de fréquence
 *     60 min) réessayait indéfiniment — sans back-off ni plafond. À l'échelle
 *     (N salons morts × 5 000 guildes), ce seul mécanisme produit des dizaines de
 *     milliers d'alertes par jour et noie les alertes métier.
 *
 * Ce module coupe ② à la racine : **un salon qui refuse une écriture de façon
 * PERMANENTE (4xx hors 429 : 400, 401, 403, 404) est mis en pause d'écriture**
 * pour tout le monde — l'outbox n'y remet plus de job, l'appelant reçoit `null`
 * au lieu d'un job condamné. La pause est temporaire : son expiration **est la
 * sonde** qui détecte la réparation du salon.
 *
 * ── Garanties ────────────────────────────────────────────────────────────────
 *  · **Bruit borné par le COMPTEUR, pas par le TTL** : l'alerte par salon n'est
 *    émise que sur le **premier** échec d'un épisode (`failureCount === 1`, le
 *    compteur étant remis à zéro par la première écriture réussie). Un salon
 *    durablement mort cesse donc d'alerter après sa première panne, tout en
 *    continuant d'être **sondé** (c'est la sonde qui détecte la réparation).
 *  · **Silence borné** : la pause dure 15 min puis 1 h au plus ⇒ une permission
 *    réparée par un humain est reprise en ≤ 1 h, jamais « pour toujours ».
 *  · **Auto-guérison** : toute écriture réussie efface la pause ET le compteur.
 *  · **Fail-open assumé** : si Redis est injoignable, on ne bloque pas (le pire
 *    cas reste borné par `webOnly` + la déduplication des alertes). Refuser
 *    toutes les écritures sur une panne de Redis serait une panne auto-infligée.
 *  · **Clés préfixées par l'environnement** : les deux Redis sont **séparés**
 *    depuis le 09/08 (`docs/MAINTENANCE.md` §3c, chantier I-07), mais le préfixe
 *    `sigilos:{beta,prod}:` garde le disjoncteur juste si une instance venait à
 *    être mutualisée — et il évite qu'une panne bêta bloque un salon en production.
 *
 * ⚠️ Fichier **serveur partagé** (Next + worker) : ni `"use server"`, ni React.
 */

import { redis } from "./redis";
import { logger } from "./logger";

/** Durée de pause d'un salon après un PREMIER échec permanent. */
export const DISCORD_CHANNEL_BLOCK_FIRST_TTL_SECONDS = 15 * 60;

/** Durée de pause maximale (salon durablement mort) : borne le silence à 1 h. */
export const DISCORD_CHANNEL_BLOCK_MAX_TTL_SECONDS = 60 * 60;

/** Durée de vie du compteur d'échecs consécutifs (déclin après 24 h sans échec). */
export const DISCORD_CHANNEL_FAILURE_COUNTER_TTL_SECONDS = 24 * 60 * 60;

/** Plafond du nombre de salons listés dans une alerte agrégée. */
export const DISCORD_BLOCKED_CHANNEL_LIST_LIMIT = 50;

/** Nom d'erreur marquant « salon en pause d'écriture » (jamais un incident). */
export const DISCORD_CHANNEL_BLOCKED_ERROR = "DiscordChannelBlocked";

/** Erreur levée quand une écriture est refusée par le disjoncteur. */
export class DiscordChannelBlockedError extends Error {
    readonly channelId: string;

    constructor(channelId: string, failures = 1) {
        super(
            `Salon Discord ${channelId} en pause d'écriture (échec permanent récent, ${failures} échec(s) consécutif(s))`,
        );
        this.name = DISCORD_CHANNEL_BLOCKED_ERROR;
        this.channelId = channelId;
    }
}

/** `true` si l'erreur provient du disjoncteur (et non d'un refus Discord). */
export function isDiscordChannelBlockedError(error: unknown): boolean {
    return (error as { name?: unknown } | null)?.name === DISCORD_CHANNEL_BLOCKED_ERROR;
}

function envSuffix(): string {
    return process.env.NODE_ENV === "production" ? "prod" : "beta";
}

/**
 * Le client Redis est-il prêt à répondre ?
 *
 * Indispensable : avec ioredis, une commande émise hors-ligne part en **file
 * d'attente** (elle ne rejette pas) — l'appelant resterait suspendu. Le disjoncteur
 * étant une optimisation d'observabilité, il doit s'effacer (fail-open) plutôt que
 * de retarder une écriture. Couvre aussi les tests et le dev sans Redis.
 */
function isRedisReady(): boolean {
    return (redis as { status?: string }).status === "ready";
}

/** Clé Redis de la pause d'un salon (`sigilos:<env>:discord:channel_blocked:<id>`). */
export function discordChannelBlockKey(channelId: string): string {
    return `sigilos:${envSuffix()}:discord:channel_blocked:${channelId}`;
}

/** Clé Redis du compteur d'échecs consécutifs d'un salon. */
export function discordChannelFailureKey(channelId: string): string {
    return `sigilos:${envSuffix()}:discord:channel_failures:${channelId}`;
}

/** Clé Redis de l'index des salons en pause (ZSET salon → dernier échec). */
export function discordChannelBlockIndexKey(): string {
    return `sigilos:${envSuffix()}:discord:channel_blocked_index`;
}

/**
 * Durée de pause (secondes) selon le nombre d'échecs consécutifs.
 * 1 échec → 15 min · ≥ 2 → 1 h. Pur (testé unitairement).
 */
export function discordBlockTtlSeconds(failureCount: number): number {
    if (!Number.isFinite(failureCount) || failureCount <= 1) {
        return DISCORD_CHANNEL_BLOCK_FIRST_TTL_SECONDS;
    }
    return DISCORD_CHANNEL_BLOCK_MAX_TTL_SECONDS;
}

/** Ce salon est-il en pause d'écriture ? (fail-open si Redis est injoignable) */
export async function isDiscordChannelBlocked(channelId: string): Promise<boolean> {
    if (!channelId || !isRedisReady()) return false;
    try {
        const raw = await redis.get(discordChannelBlockKey(channelId));
        return !!raw;
    } catch (e) {
        logger.warn("[DiscordHealth] Lecture de la pause impossible — écriture laissée passer", {
            channelId,
            error: (e as Error).message,
        });
        return false;
    }
}

export type DiscordChannelBlockResult = {
    /** Le salon était déjà en pause (aucune information nouvelle à alerter). */
    alreadyBlocked: boolean;
    /** Nombre d'échecs consécutifs depuis le dernier succès (1 = premier). */
    failureCount: number;
    /** Salons actuellement en pause (liste plafonnée, du plus ancien au plus récent). */
    blockedChannels: string[];
    /** Nombre total de salons en pause. */
    blockedCount: number;
};

const EMPTY_BLOCK_RESULT: DiscordChannelBlockResult = {
    alreadyBlocked: false,
    failureCount: 0,
    blockedChannels: [],
    blockedCount: 0,
};

/**
 * Met un salon en pause d'écriture et renvoie l'état agrégé.
 *
 * **Idempotent dans un épisode** : le compteur n'est incrémenté que si le salon
 * n'était PAS déjà en pause. Appeler la fonction deux fois pour le même échec
 * (ex. `executeDiscordWrite` puis le worker) n'escalade donc pas artificiellement
 * la durée, et `failureCount === 1` signifie bien « premier échec depuis le
 * dernier succès » — c'est ce que lit l'alerte.
 *
 * Best-effort : ne lève jamais (un incident d'observabilité ne doit pas casser
 * le flux qui l'a déclenché).
 */
export async function markDiscordChannelBlocked(
    channelId: string,
    reason: Record<string, unknown> = {},
): Promise<DiscordChannelBlockResult> {
    if (!channelId) return EMPTY_BLOCK_RESULT;
    if (!isRedisReady()) {
        // Pas de disjoncteur sans Redis : on rend un résultat neutre pour que
        // l'appelant ALERTE quand même (un salon en panne ne doit pas devenir
        // silencieux parce que Redis est tombé).
        logger.warn("[DiscordHealth] Redis indisponible — salon non mis en pause", { channelId });
        return EMPTY_BLOCK_RESULT;
    }
    try {
        const alreadyBlocked = !!(await redis.get(discordChannelBlockKey(channelId)));
        const failureCount = alreadyBlocked
            ? Number.parseInt((await redis.get(discordChannelFailureKey(channelId))) ?? "1", 10) || 1
            : await redis.incr(discordChannelFailureKey(channelId));
        await redis.expire(
            discordChannelFailureKey(channelId),
            DISCORD_CHANNEL_FAILURE_COUNTER_TTL_SECONDS,
        );
        const ttl = discordBlockTtlSeconds(failureCount);
        await redis.set(
            discordChannelBlockKey(channelId),
            JSON.stringify({ at: Date.now(), failures: failureCount, ttl, ...reason }),
            "EX",
            ttl,
        );
        await redis.zadd(discordChannelBlockIndexKey(), Date.now(), channelId);
        await redis.zremrangebyscore(
            discordChannelBlockIndexKey(),
            0,
            Date.now() - DISCORD_CHANNEL_BLOCK_MAX_TTL_SECONDS * 1000,
        );
        const blockedChannels = await listBlockedDiscordChannels();
        return {
            alreadyBlocked,
            failureCount,
            blockedChannels,
            blockedCount: blockedChannels.length,
        };
    } catch (e) {
        logger.warn("[DiscordHealth] Mise en pause impossible (Redis) — poursuite du flux", {
            channelId,
            error: (e as Error).message,
        });
        return EMPTY_BLOCK_RESULT;
    }
}

/** Efface la pause et le compteur d'échecs (écriture réussie = salon sain). */
export async function clearDiscordChannelBlock(channelId: string): Promise<void> {
    if (!channelId || !isRedisReady()) return;
    try {
        await redis.del(discordChannelBlockKey(channelId));
        await redis.del(discordChannelFailureKey(channelId));
        await redis.zrem(discordChannelBlockIndexKey(), channelId);
    } catch (e) {
        logger.warn("[DiscordHealth] Levée de la pause impossible (Redis)", {
            channelId,
            error: (e as Error).message,
        });
    }
}

/** Salons actuellement en pause (liste plafonnée). Jamais bloquant. */
export async function listBlockedDiscordChannels(): Promise<string[]> {
    if (!isRedisReady()) return [];
    try {
        await redis.zremrangebyscore(
            discordChannelBlockIndexKey(),
            0,
            Date.now() - DISCORD_CHANNEL_BLOCK_MAX_TTL_SECONDS * 1000,
        );
        return await redis.zrange(
            discordChannelBlockIndexKey(),
            0,
            DISCORD_BLOCKED_CHANNEL_LIST_LIMIT - 1,
        );
    } catch (e) {
        logger.warn("[DiscordHealth] Liste des salons en pause indisponible", {
            error: (e as Error).message,
        });
        return [];
    }
}
