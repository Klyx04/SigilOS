/**
 * Module « Marché » — entretien quotidien (S5.4).
 *
 * Certaines tâches ne sont **pas** des échéances d'annonce : elles réparent
 * l'état du module et n'ont de sens qu'**une fois par jour** (§15.1, étapes
 * 7-8) :
 *   7. **réconciliation Discord** — les messages dont l'état Discord ne
 *      correspond plus à l'état base (`syncStatus = FAILED` / `PENDING`) sont
 *      republiés/réécrits ; un message supprimé à la main est **recréé** ;
 *   8. purge des médias (S5.5) et purge des logs du marché (S5.6).
 *
 * Le cron `market-expire` tourne toutes les 10 minutes : sans garde, ces passes
 * seraient rejouées 144 fois par jour. Le verrou « une fois par jour » est donc
 * posé dans Redis (`SET NX EX 24 h`), en **fail-open** : si Redis est
 * indisponible on exécute la passe plutôt que de ne jamais l'exécuter — elle
 * est bornée (lot) et idempotente, une passe de trop ne coûte que de l'I/O.
 *
 * ⚠️ Fichier **serveur partagé** : ni `"use server"` (ce n'est pas une server
 * action), ni React. Toute la logique est appelable et testable directement
 * (S5.12) ; la route cron ne fait que l'appeler et compter.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { MARKET_AUDIT_ACTIONS } from "@/server/actions/market-constants";
import { writeMarketAuditLog } from "@/server/market/audit";
import { publishListingToDiscord, syncListingMessage } from "@/server/market/discord";

/** Statuts qui trahissent une divergence entre Discord et la base (§13.6). */
export const MARKET_DISCORD_STALE_STATUSES = ["FAILED", "PENDING"] as const;

/** Taille du lot par passe : on ne bloque jamais la base (§15.1 garde-fous). */
export const MARKET_DISCORD_RECONCILE_BATCH_SIZE = 25;

/** TTL du verrou quotidien (aligné sur la cadence « 1×/jour » du §15.1). */
export const MARKET_MAINTENANCE_LOCK_TTL_SECONDS = 24 * 60 * 60;

export type MarketMaintenanceGate = {
    /** `true` = la passe d'entretien doit s'exécuter maintenant. */
    run: boolean;
    /** `claimed` (verrou posé) · `already-ran` (déjà faite aujourd'hui) · `redis-unavailable`. */
    reason: "claimed" | "already-ran" | "redis-unavailable";
};

/**
 * Verrou quotidien de l'entretien (§15.1). Une clé par jour UTC en `SET NX EX` :
 * le cron peut être relancé autant de fois qu'il veut, la passe ne s'exécute
 * qu'une fois, et le TTL d'un jour garantit celle du lendemain.
 */
export async function claimMarketDailyMaintenance(now: Date = new Date()): Promise<MarketMaintenanceGate> {
    const day = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const key = `market:maintenance:${day}`;

    // Redis non connecté : ioredis mettrait la commande en file d'attente et la
    // requête cron attendrait une hypothétique reconnexion. On passe tout de suite.
    if (redis.status !== "ready") {
        logger.warn("[market] entretien quotidien : Redis indisponible — passe exécutée sans verrou");
        return { run: true, reason: "redis-unavailable" };
    }

    try {
        const claimed = await redis.set(key, "1", "EX", MARKET_MAINTENANCE_LOCK_TTL_SECONDS, "NX");
        const run = claimed === "OK";
        return { run, reason: run ? "claimed" : "already-ran" };
    } catch (error) {
        logger.warn("[market] entretien quotidien : verrou Redis en erreur — passe exécutée sans verrou", { err: error });
        return { run: true, reason: "redis-unavailable" };
    }
}

/**
 * Un `404` Discord à l'édition signifie que **le message n'existe plus**
 * (supprimé à la main, post forum fermé, salon recréé) : le §13.6 impose alors
 * de le **recréer** — réécrire un embed fantôme échouerait indéfiniment.
 * Pur (aucune I/O) → testable unitairement.
 */
export function isDiscordMessageGoneError(message: string | null | undefined): boolean {
    if (!message) return false;
    return /Discord Update Error:\s*404\b/.test(message) || /Unknown Message/i.test(message);
}

export type MarketDiscordReconcileOutcome = {
    /** Lignes divergentes lues dans cette passe (borné par le lot). */
    scanned: number;
    /** Embeds réécrits : la ligne repasse en `OK`. */
    resynced: number;
    /** Message absent côté Discord (`404`) : **recréé** (§13.6). */
    recreated: number;
    /** Toujours en échec après tentative (`FAILED`, relancé à la passe suivante). */
    stillFailed: number;
    /** Rien à faire : annonce archivée ou salon non configuré. */
    skipped: number;
    /** Le lot était plein : le reste partira à la passe du lendemain. */
    hasMore: boolean;
};

/**
 * Trace la réparation d'un message : « Discord et la base se sont recollés ».
 * `actorUserId = null` — c'est une réparation **automatique** (cron) ; une relance
 * manuelle (God/modo) porte au contraire son auteur (§13.4).
 */
async function auditDiscordRestored(params: {
    guildId: string;
    listingId: string;
    actorUserId: string | null;
    previousStatus: string;
    messageId: string | null;
    recreated: boolean;
}): Promise<void> {
    await writeMarketAuditLog({
        guildId: params.guildId,
        listingId: params.listingId,
        actorUserId: params.actorUserId,
        action: MARKET_AUDIT_ACTIONS.DISCORD_SYNC_RESTORED,
        previousData: { syncStatus: params.previousStatus },
        nextData: {
            syncStatus: "OK",
            messageId: params.messageId,
            ...(params.recreated ? { recreated: true } : {}),
        },
    });
}

/**
 * S5.4 — Réconciliation Discord (§13.6, §15.1 étape 7).
 *
 * Reprend les lignes `MarketDiscordMessage` dont l'état a divergé — les plus
 * anciennes d'abord (`lastSyncedAt` croissant), par lots — et tente de les
 * recoller :
 *   • `deletedAt` posé → **rien à faire** : une annonce archivée ne doit jamais
 *     être republiée (garde S5.1). La trace en base est conservée (aucune
 *     suppression) et la ligne est simplement ignorée par l'entretien ;
 *   • synchronisation nominale OK → `OK` + audit `DISCORD_SYNC_RESTORED` ;
 *   • `404` (message disparu) → on **recrée** le message (§13.6) puis audit ;
 *   • autre échec → la ligne reste `FAILED` avec son `lastError` (posé par le
 *     service Discord) : **aucun audit**, réécrire le même échec chaque jour
 *     noierait le journal sans rien apporter (l'information vit dans la ligne).
 *
 * La recréation n'a lieu que si la ligne était **encore** en statut divergent
 * (`updateMany` conditionnel) — si une transition concurrente l'a repassée en
 * `OK`, on ne crée pas de doublon de message (§13.7).
 *
 * Isolation multi-tenant : `guildConfigId` (id interne, **jamais** un snowflake)
 * restreint la passe à une guilde quand l'appelant le fournit.
 * `actorUserId` porte l'auteur d'une relance **manuelle** (God/modo) ; laissé
 * `null` par le cron, la réparation est alors purement automatique (§13.4).
 */
export async function reconcileMarketDiscordMessagesCore(
    params: { limit?: number; guildConfigId?: string; actorUserId?: string | null } = {}
): Promise<MarketDiscordReconcileOutcome> {
    const limit = params.limit ?? MARKET_DISCORD_RECONCILE_BATCH_SIZE;
    const outcome: MarketDiscordReconcileOutcome = {
        scanned: 0,
        resynced: 0,
        recreated: 0,
        stillFailed: 0,
        skipped: 0,
        hasMore: false,
    };

    const stale = await db.marketDiscordMessage.findMany({
        where: {
            syncStatus: { in: [...MARKET_DISCORD_STALE_STATUSES] },
            ...(params.guildConfigId ? { listing: { guildId: params.guildConfigId } } : {}),
        },
        orderBy: { lastSyncedAt: "asc" },
        take: limit + 1, // +1 : savoir s'il reste des lignes après ce lot
        select: {
            listingId: true,
            syncStatus: true,
            listing: { select: { guildId: true, deletedAt: true } },
        },
    });

    outcome.hasMore = stale.length > limit;
    const batch = outcome.hasMore ? stale.slice(0, limit) : stale;
    outcome.scanned = batch.length;
    return runReconcileBatch(batch, outcome, params.actorUserId ?? null);
}

/**
 * Boucle de réparation d'un lot (extraite de la passe pour rester lisible) :
 * chaque annonce est isolée, aucun échec ne propage.
 */
async function runReconcileBatch(
    batch: {
        listingId: string;
        syncStatus: string;
        listing: { guildId: string; deletedAt: Date | null };
    }[],
    outcome: MarketDiscordReconcileOutcome,
    actorUserId: string | null
): Promise<MarketDiscordReconcileOutcome> {
    for (const row of batch) {
        try {
            // Annonce archivée/supprimée : son message est définitivement hors sujet.
            if (row.listing.deletedAt) {
                outcome.skipped += 1;
                continue;
            }

            const result = await syncListingMessage(row.listingId);

            if (result.ok && result.skipped) {
                // Salon non configuré : rien à réparer tant qu'il n'existe pas.
                outcome.skipped += 1;
                continue;
            }

            if (result.ok) {
                outcome.resynced += 1;
                await auditDiscordRestored({
                    guildId: row.listing.guildId,
                    listingId: row.listingId,
                    actorUserId,
                    previousStatus: row.syncStatus,
                    messageId: result.messageId ?? null,
                    recreated: false,
                });
                logger.info("[market] réconciliation Discord : message resynchronisé", {
                    listingId: row.listingId,
                    previousStatus: row.syncStatus,
                });
                continue;
            }

            if (isDiscordMessageGoneError(result.error)) {
                // Le message n'existe plus : on repart d'une trace vide, ce qui
                // force la republication à créer un **nouveau** message au lieu de
                // réécrire dans le vide.
                const cleared = await db.marketDiscordMessage.updateMany({
                    where: {
                        listingId: row.listingId,
                        syncStatus: { in: [...MARKET_DISCORD_STALE_STATUSES] },
                    },
                    data: { discordMessageId: "" },
                });

                if (cleared.count > 0) {
                    const republished = await publishListingToDiscord(row.listingId);
                    if (republished.ok && !republished.skipped) {
                        outcome.recreated += 1;
                        await auditDiscordRestored({
                            guildId: row.listing.guildId,
                            listingId: row.listingId,
                            actorUserId,
                            previousStatus: row.syncStatus,
                            messageId: republished.messageId ?? null,
                            recreated: true,
                        });
                        logger.info("[market] réconciliation Discord : message recréé", {
                            listingId: row.listingId,
                        });
                        continue;
                    }
                }
            }

            outcome.stillFailed += 1;
            logger.warn("[market] réconciliation Discord : échec persistant", {
                listingId: row.listingId,
                err: result.error ?? "inconnu",
            });
        } catch (error) {
            outcome.stillFailed += 1;
            logger.error("[market] réconciliation Discord : erreur inattendue", {
                listingId: row.listingId,
                err: error,
            });
        }
    }

    if (outcome.scanned > 0 || outcome.hasMore) {
        logger.info("[market] réconciliation Discord terminée", { ...outcome });
    }

    return outcome;
}
