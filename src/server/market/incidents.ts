/**
 * Module « Marché » — détection d'incidents & alerte God (S5.10 / S8.19, §17/§18).
 *
 * Trois signaux sont remontés depuis la passe du cron `market-expire` : des
 * **échecs de synchronisation Discord persistants**, un **volume de médias
 * anormal** et des **signalements `OPEN` qui traînent**. Chacun déclenche au
 * plus **une** notification God par fenêtre (`SET … EX … NX`, patron
 * `claimMarketDailyMaintenance`).
 *
 * 🔒 Garanties (checklist §0 sécurité) :
 *   · **jamais bloquant** — `notifyGod` est appelé dans un `try/catch` local et
 *     le core ne lève jamais : un échec d'alerte ne peut pas faire échouer la
 *     passe du cron (donc pas de `recordCronExecution(success: false)` trompeur) ;
 *   · **throttle Redis fail-closed** — si Redis est indisponible **ou** en
 *     erreur, on **ne notifie pas** (jamais de « fail-open » qui inonderait le
 *     salon God) ; l'incident reste visible dans l'onglet God « Marché » ;
 *   · **aucun contenu sensible** — les messages ne portent que des **compteurs et
 *     des seuils** : jamais un pseudo, un snowflake, un montant, un
 *     `lastError` brut ni un token ;
 *   · **lectures bornées** — uniquement des `count()` / `aggregate()` agrégés
 *     (§16.2 : aucune donnée d'une guilde exposée nominativement).
 *
 * ⚠️ Fichier **serveur partagé** : ni `"use server"`, ni React — testable
 * directement (patron `maintenance.ts`).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { notifyGod } from "@/server/actions/god-notif-actions";

/** Types d'incident surveillés (union fermée : une clé Redis par type). */
export type MarketIncidentKind = "DISCORD_SYNC_FAILED" | "MEDIA_VOLUME" | "STALE_OPEN_REPORTS";

/** Nombre de messages Discord en échec à partir duquel on alerte. */
export const MARKET_INCIDENT_FAILED_SYNC_THRESHOLD = 5;

/** Volume de preuves à partir duquel on alerte (500 Mo). */
export const MARKET_INCIDENT_MEDIA_BYTES_THRESHOLD = 500 * 1024 * 1024;

/** Âge à partir duquel un signalement encore `OPEN` est considéré comme qui traîne (48 h). */
export const MARKET_INCIDENT_OPEN_REPORT_AGE_HOURS = 48;

/** Fenêtre d'anti-spam : au plus **une** alerte par type toutes les 6 h. */
export const MARKET_INCIDENT_ALERT_WINDOW_SECONDS = 6 * 60 * 60;

/** Instantané des compteurs surveillés (agrégats **sans** donnée personnelle). */
export type MarketIncidentSnapshot = {
    /** Messages `syncStatus = "FAILED"` dont l'annonce est encore vivante. */
    discordFailed: number;
    /** Nombre de preuves stockées. */
    mediaCount: number;
    /** Poids total des preuves (octets). */
    mediaBytes: number;
    /** Signalements `OPEN` plus vieux que `MARKET_INCIDENT_OPEN_REPORT_AGE_HOURS`. */
    staleOpenReports: number;
};

const EMPTY_SNAPSHOT: MarketIncidentSnapshot = {
    discordFailed: 0,
    mediaCount: 0,
    mediaBytes: 0,
    staleOpenReports: 0,
};

/**
 * Lit les compteurs surveillés (3 requêtes agrégées bornées, aucun `findMany`).
 * Ne lève jamais : renvoie un instantané nul + `logger.error` en cas d'échec.
 */
export async function detectMarketIncidentsCore(
    params: { now?: Date } = {}
): Promise<MarketIncidentSnapshot> {
    const now = params.now ?? new Date();

    try {
        const [discordFailed, mediaCount, mediaAggregate, staleOpenReports] = await Promise.all([
            db.marketDiscordMessage.count({
                // Une annonce archivée/supprimée n'a plus de message à réparer.
                where: { syncStatus: "FAILED", listing: { deletedAt: null } },
            }),
            db.marketListingMedia.count(),
            db.marketListingMedia.aggregate({ _sum: { sizeBytes: true } }),
            db.marketReport.count({
                where: {
                    status: "OPEN",
                    createdAt: { lt: new Date(now.getTime() - MARKET_INCIDENT_OPEN_REPORT_AGE_HOURS * 60 * 60 * 1000) },
                },
            }),
        ]);

        return {
            discordFailed,
            mediaCount,
            mediaBytes: mediaAggregate._sum.sizeBytes ?? 0,
            staleOpenReports,
        };
    } catch (error) {
        logger.error("[market] detectMarketIncidentsCore failed", { err: error });
        return { ...EMPTY_SNAPSHOT };
    }
}

/**
 * Verrou d'anti-spam Redis : `SET clé 1 EX <fenêtre> NX` (patron
 * `claimMarketDailyMaintenance`).
 *
 * **Fail-closed** : Redis indisponible ou en erreur ⇒ `false` ⇒ **aucune**
 * notification. On préfère rater une alerte (l'incident reste visible dans
 * l'onglet God « Marché ») plutôt que d'inonder le salon God à chaque passe.
 */
export async function claimMarketIncidentAlert(
    kind: MarketIncidentKind,
    windowSeconds: number = MARKET_INCIDENT_ALERT_WINDOW_SECONDS
): Promise<boolean> {
    const ttl = Number.isFinite(windowSeconds) && windowSeconds > 0
        ? Math.floor(windowSeconds)
        : MARKET_INCIDENT_ALERT_WINDOW_SECONDS;

    if (redis.status !== "ready") {
        logger.warn("[market] alerte incident : Redis indisponible — notification retenue (fail-closed)", { kind });
        return false;
    }

    try {
        const claimed = await redis.set(`market:incident:${kind}`, "1", "EX", ttl, "NX");
        return claimed === "OK";
    } catch (error) {
        logger.warn("[market] alerte incident : verrou Redis en erreur — notification retenue (fail-closed)", {
            kind,
            err: error,
        });
        return false;
    }
}

/** Titre + message d'une alerte — **purs**, agrégats et seuils uniquement. */
export function buildMarketIncidentCopy(
    kind: MarketIncidentKind,
    snapshot: MarketIncidentSnapshot
): { title: string; message: string } {
    switch (kind) {
        case "DISCORD_SYNC_FAILED":
            return {
                title: "Marché — synchronisation Discord en échec",
                message:
                    `${snapshot.discordFailed} annonce(s) ont un message Discord en échec de synchronisation ` +
                    `(seuil d'alerte : ${MARKET_INCIDENT_FAILED_SYNC_THRESHOLD}). ` +
                    `Relance la réconciliation depuis l'onglet God « Marché ».`,
            };
        case "MEDIA_VOLUME":
            return {
                title: "Marché — volume de preuves anormal",
                message:
                    `${snapshot.mediaCount} fichier(s) de preuve pour ${Math.round(snapshot.mediaBytes / (1024 * 1024))} Mo ` +
                    `(seuil d'alerte : ${Math.round(MARKET_INCIDENT_MEDIA_BYTES_THRESHOLD / (1024 * 1024))} Mo). ` +
                    `Vérifie la purge des médias depuis l'onglet God « Marché ».`,
            };
        case "STALE_OPEN_REPORTS":
            return {
                title: "Marché — signalements non traités",
                message:
                    `${snapshot.staleOpenReports} signalement(s) encore ouverts depuis plus de ` +
                    `${MARKET_INCIDENT_OPEN_REPORT_AGE_HOURS} h. ` +
                    `Traite-les depuis l'écran de modération du module Marché.`,
            };
    }
}

/** Un incident est-il déclenché pour cet instantané ? (pur, seuils bornés) */
export function isMarketIncidentTriggered(kind: MarketIncidentKind, snapshot: MarketIncidentSnapshot): boolean {
    switch (kind) {
        case "DISCORD_SYNC_FAILED":
            return snapshot.discordFailed >= MARKET_INCIDENT_FAILED_SYNC_THRESHOLD;
        case "MEDIA_VOLUME":
            return snapshot.mediaBytes >= MARKET_INCIDENT_MEDIA_BYTES_THRESHOLD;
        case "STALE_OPEN_REPORTS":
            return snapshot.staleOpenReports > 0;
    }
}

/** Ordre stable des types (déterminisme des tests et des messages). */
export const MARKET_INCIDENT_KINDS: MarketIncidentKind[] = [
    "DISCORD_SYNC_FAILED",
    "MEDIA_VOLUME",
    "STALE_OPEN_REPORTS",
];


/** Bilan d'une passe d'alerte (jamais d'exception : `alerted` vide en erreur). */
export type MarketIncidentAlertOutcome = {
    snapshot: MarketIncidentSnapshot;
    /** Types réellement notifiés (verrou Redis obtenu + `notifyGod` sans erreur). */
    alerted: MarketIncidentKind[];
};

/**
 * Détecte puis notifie la God team — **une fois par type et par fenêtre**.
 *
 * ⚠️ Appelée par le cron `market-expire` : elle ne lève **jamais** et n'attend
 * que des écritures bornées. `notifyGod` est encapsulé localement, donc une
 * panne Discord/DB de la notification n'affecte ni la passe ni la télémétrie.
 */
export async function notifyMarketIncidentsCore(
    params: { now?: Date } = {}
): Promise<MarketIncidentAlertOutcome> {
    const snapshot = await detectMarketIncidentsCore(params);
    const alerted: MarketIncidentKind[] = [];

    for (const kind of MARKET_INCIDENT_KINDS) {
        try {
            if (!isMarketIncidentTriggered(kind, snapshot)) continue;

            // Anti-spam : au plus une alerte par type et par fenêtre (fail-closed).
            const claimed = await claimMarketIncidentAlert(kind);
            if (!claimed) continue;

            const copy = buildMarketIncidentCopy(kind, snapshot);
            await notifyGod({
                title: copy.title,
                message: copy.message,
                type: "SYSTEM",
                success: false,
                // Agrégats seuls : jamais de pseudo, de snowflake ni d'erreur brute.
                metadata: {
                    kind,
                    discordFailed: snapshot.discordFailed,
                    mediaCount: snapshot.mediaCount,
                    mediaBytes: snapshot.mediaBytes,
                    staleOpenReports: snapshot.staleOpenReports,
                },
            });

            alerted.push(kind);
            logger.warn("[market] incident marché signalé à la God team", { kind });
        } catch (error) {
            // Jamais bloquant : l'incident reste visible dans l'onglet God « Marché ».
            logger.error("[market] notification d'incident différée", { kind, err: String(error) });
        }
    }

    return { snapshot, alerted };
}

