/**
 * Module « Marché » — rétention (§15.2) : **médias** (S5.5) et **logs d'audit**
 * (S5.6).
 *
 * Une annonce garde ses preuves tant qu'elle **vit**. À sa fin de vie
 * (`SOLD`, `WITHDRAWN`, archivage automatique J+20…), les fichiers ne servent
 * plus qu'à l'historique de litige — et seulement aussi longtemps que la
 * guilde l'a décidé (`marketMediaRetentionDays` : 30 j par défaut, bornes
 * 7–180, §9.1). Au-delà, ils sont purgés.
 *
 * Ce module est le **seul** endroit du marché qui supprime des médias :
 *   • il travaille **par lot** (jamais la base d'un coup, §15.1) ;
 *   • il ne touche **jamais** une annonce vivante — la fin de vie est estimée
 *     sur les horodatages d'archivage (`deletedAt` / `soldAt` / `withdrawnAt`) ;
 *   • il supprime **le fichier d'abord**, la ligne ensuite : l'inverse ferait
 *     d'un fichier resté sur le disque une donnée indétectable (§13.4) ;
 *   • il **audite** chaque annonce purgée (`MEDIA_PURGED`) — une purge est un
 *     acte, elle laisse une trace ;
 *   • il est **idempotent** : le filtre `media: { some: {} }` écarte les
 *     annonces dont les médias sont déjà partis ; relancer la passe (cron
 *     10 min, relance manuelle) ne fait donc rien de plus.
 *
 * La **seconde moitié** de ce fichier (S5.6) applique exactement la même
 * philosophie aux **logs d'audit** du marché (`marketLogRetentionDays` : 365 j
 * par défaut, bornes 30–730, §9.1), purgés par le cron `cleanup-logs` : un
 * journal de transitions n'a pas vocation à croître sans borne, mais il n'est
 * jamais purgé avant son échéance ni en dehors de sa guilde.
 *
 * ⚠️ Fichier **serveur partagé** : ni `"use server"`, ni React — appelable et
 * testable directement (S5.12), exactement comme `maintenance.ts`.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { deleteStoredFile } from "@/lib/storage-utils";
import {
    MARKET_AUDIT_ACTIONS,
    MARKET_SETTINGS_BOUNDS,
    MARKET_SETTINGS_DEFAULTS,
} from "@/server/actions/market-constants";
import { writeMarketAuditLog } from "@/server/market/audit";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Taille du lot par passe et par guilde : on ne bloque jamais la base (§15.1). */
export const MARKET_MEDIA_PURGE_BATCH_SIZE = 100;

/**
 * Fin de vie d'une annonce : la purge ne vise que des annonces **terminées**
 * (archivées, vendues ou retirées) **avant** la date de coupure. Une annonce
 * active, réservée ou en brouillon n'a pas de fin de vie : elle garde ses
 * preuves, quel que soit l'âge de ses fichiers.
 */
export function marketListingEndOfLifeWhere(cutoff: Date): Prisma.MarketListingWhereInput {
    return {
        OR: [
            // Archivage automatique J+20 (§11.6) ou suppression par le vendeur.
            { deletedAt: { not: null, lt: cutoff } },
            // Vente conclue (S4.7) : l'annonce est terminée, pas supprimée.
            { soldAt: { not: null, lt: cutoff } },
            // Retrait vendeur ou modération (S4.11).
            { withdrawnAt: { not: null, lt: cutoff } },
            // Filet de sécurité : un statut `EXPIRED` posé sans horodatage dédié
            // retombe sur la dernière mise à jour de l'annonce (aucun code ne
            // pose ce statut aujourd'hui, mais la rétention ne doit pas s'y perdre).
            { status: "EXPIRED", updatedAt: { lt: cutoff } },
        ],
    };
}

/**
 * Ramène un réglage de guilde dans ses bornes (§9.1) : valeur absente, nulle ou
 * aberrante → défaut du module. La rétention ne peut donc jamais être `0 j`
 * (purge immédiate des preuves d'une annonce vendue) ni « infinie ».
 */
export function resolveMarketMediaRetentionDays(value: number | null | undefined): number {
    const bounds = MARKET_SETTINGS_BOUNDS.marketMediaRetentionDays;
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return MARKET_SETTINGS_DEFAULTS.marketMediaRetentionDays;
    }
    return Math.min(Math.max(Math.floor(value), bounds.min), bounds.max);
}

/** Date de coupure : « ce qui est terminé depuis **plus** de N jours ». */
export function marketMediaPurgeCutoff(now: Date, retentionDays: number): Date {
    return new Date(now.getTime() - resolveMarketMediaRetentionDays(retentionDays) * MS_PER_DAY);
}

export type MarketMediaPurgeOutcome = {
    /** Annonces de fin de vie examinées dans cette passe (borné par le lot). */
    scanned: number;
    /** Annonces dont les médias ont réellement été purgés. */
    purgedListings: number;
    /** Lignes `MarketListingMedia` supprimées. */
    mediaDeleted: number;
    /** Fichiers effectivement supprimés du disque. */
    filesDeleted: number;
    /** Fichiers déjà absents (ou clés non gérées) : ligne purgée sans I/O. */
    filesMissing: number;
    /** Fichiers refusés / erreur disque : orphelins à surveiller (God, S5.9). */
    filesFailed: number;
    /** Volume des médias purgés (somme des `sizeBytes`). */
    bytesDeleted: number;
    /** Annonces sorties du lot entre la lecture et l'écriture (reprise/restauration). */
    skipped: number;
    /** Annonces isolées sur erreur : la passe ne s'arrête jamais pour si peu. */
    failed: number;
    /** Une guilde avait plus de travail que le lot : le reste attend la passe suivante. */
    hasMore: boolean;
};

/**
 * S5.5 — Purge des médias des annonces terminées (§15.2, étape 8 du cron).
 *
 * Appelée par l'entretien **1×/jour** de `market-expire` (sans `guildConfigId`,
 * donc pour toutes les guildes) ou par la relance manuelle d'un modérateur
 * (`purgeMarketMedia`, bornée à **sa** guilde via son id interne, §16.2).
 *
 * `actorUserId` porte l'auteur d'une purge **manuelle** ; `null` = purge
 * automatique du cron (§13.4). Le résultat ne contient que des compteurs :
 * aucun montant, aucun pseudo, aucune clé de stockage (§13.7).
 */
export async function purgeMarketListingMediaCore(
    params: { now?: Date; limit?: number; guildConfigId?: string; actorUserId?: string | null } = {}
): Promise<MarketMediaPurgeOutcome> {
    const now = params.now ?? new Date();
    const limit = params.limit ?? MARKET_MEDIA_PURGE_BATCH_SIZE;
    const outcome: MarketMediaPurgeOutcome = {
        scanned: 0,
        purgedListings: 0,
        mediaDeleted: 0,
        filesDeleted: 0,
        filesMissing: 0,
        filesFailed: 0,
        bytesDeleted: 0,
        skipped: 0,
        failed: 0,
        hasMore: false,
    };

    // La rétention est un réglage **de guilde** (§9.1) : la passe balaie les
    // configurations, mais les données restent filtrées par l'id interne
    // `GuildConfig.id` — jamais par un snowflake (§16.2).
    const guilds = await db.guildConfig.findMany({
        where: params.guildConfigId ? { id: params.guildConfigId } : undefined,
        orderBy: { id: "asc" },
        select: { id: true, marketMediaRetentionDays: true },
    });

    for (const guild of guilds) {
        const retentionDays = resolveMarketMediaRetentionDays(guild.marketMediaRetentionDays);
        const cutoff = marketMediaPurgeCutoff(now, retentionDays);

        const due = await db.marketListing.findMany({
            where: {
                guildId: guild.id,
                // Idempotence : une annonce dont les médias sont déjà partis
                // n'est plus éligible — sinon elle occuperait le lot à vie.
                media: { some: {} },
                ...marketListingEndOfLifeWhere(cutoff),
            },
            orderBy: { updatedAt: "asc" },
            take: limit + 1, // +1 : savoir s'il reste du travail après ce lot
            select: {
                id: true,
                guildId: true,
                media: { select: { id: true, storageKey: true, sizeBytes: true } },
            },
        });

        if (due.length > limit) outcome.hasMore = true;
        const batch = due.length > limit ? due.slice(0, limit) : due;
        outcome.scanned += batch.length;

        for (const listing of batch) {
            try {
                // Garde de course : si l'annonce est revenue à la vie entre la
                // lecture et l'écriture (reprise, ou restauration par un
                // modérateur), on ne touche à rien — une annonce vivante garde
                // ses preuves. Mêmes conditions que la lecture, rejouées ici.
                const stillDone = await db.marketListing.findFirst({
                    where: {
                        id: listing.id,
                        guildId: guild.id,
                        media: { some: {} },
                        ...marketListingEndOfLifeWhere(cutoff),
                    },
                    select: { id: true },
                });
                if (!stillDone) {
                    outcome.skipped += 1;
                    continue;
                }
                // Fichiers **d'abord** : supprimer la ligne avant le fichier
                // perdrait la seule trace du fichier (orphelin indétectable).
                let filesDeleted = 0;
                let filesMissing = 0;
                let filesFailed = 0;
                let bytes = 0;
                for (const media of listing.media) {
                    const result = await deleteStoredFile(media.storageKey);
                    if (result === "deleted") filesDeleted += 1;
                    else if (result === "failed" || result === "blocked") filesFailed += 1;
                    else filesMissing += 1;
                    bytes += media.sizeBytes;
                }

                // Lignes ensuite, `listingId` **épinglé en plus** des ids lus :
                // une ligne déplacée entre-temps n'est jamais purgée par erreur.
                const removed = await db.marketListingMedia.deleteMany({
                    where: { listingId: listing.id, id: { in: listing.media.map((m) => m.id) } },
                });

                outcome.purgedListings += 1;
                outcome.mediaDeleted += removed.count;
                outcome.filesDeleted += filesDeleted;
                outcome.filesMissing += filesMissing;
                outcome.filesFailed += filesFailed;
                outcome.bytesDeleted += bytes;

                await writeMarketAuditLog({
                    guildId: listing.guildId,
                    listingId: listing.id,
                    actorUserId: params.actorUserId ?? null,
                    action: MARKET_AUDIT_ACTIONS.MEDIA_PURGED,
                    previousData: { media: listing.media.length, bytes },
                    nextData: {
                        media: 0,
                        filesDeleted,
                        filesMissing,
                        filesFailed,
                        retentionDays,
                    },
                });

                if (filesFailed > 0) {
                    // Le journal des passes reste un **récapitulatif** (§15.1) :
                    // ne sont détaillées que les situations qui méritent un humain.
                    logger.warn("[market] purge des médias : fichiers non supprimés (orphelins ?)", {
                        listingId: listing.id,
                        guildConfigId: listing.guildId,
                        filesFailed,
                    });
                }
            } catch (error) {
                outcome.failed += 1;
                logger.error("[market] purge des médias — annonce ignorée", {
                    listingId: listing.id,
                    guildConfigId: listing.guildId,
                    err: error,
                });
            }
        }
    }

    if (outcome.scanned > 0 || outcome.hasMore) {
        logger.info("[market] purge des médias terminée", { ...outcome });
    }

    return outcome;
}

// ---------------------------------------------------------------------------
// S5.6 — RÉTENTION DES LOGS D'AUDIT (`marketLogRetentionDays`, §15.2)
// ---------------------------------------------------------------------------

/**
 * Taille du lot par guilde et par passe. Le cron `cleanup-logs` tourne **1×/j**
 * et l'index `@@index([guildId, createdAt])` porte la sélection : un lot large
 * évite des dizaines de passes sans jamais charger une table entière (§15.1).
 */
export const MARKET_LOG_PURGE_BATCH_SIZE = 500;

/**
 * Ramène `marketLogRetentionDays` dans ses bornes (§9.1) : valeur absente ou
 * aberrante → défaut du module (365 j). La rétention ne peut donc jamais être
 * `0 j` (un journal effacé à la transition qui l'a écrit) ni « infinie ».
 */
export function resolveMarketLogRetentionDays(value: number | null | undefined): number {
    const bounds = MARKET_SETTINGS_BOUNDS.marketLogRetentionDays;
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return MARKET_SETTINGS_DEFAULTS.marketLogRetentionDays;
    }
    return Math.min(Math.max(Math.floor(value), bounds.min), bounds.max);
}

/** Date de coupure : « ce qui a été journalisé **avant** N jours ». */
export function marketLogPurgeCutoff(now: Date, retentionDays: number): Date {
    return new Date(now.getTime() - resolveMarketLogRetentionDays(retentionDays) * MS_PER_DAY);
}

export type MarketLogPurgeOutcome = {
    /** Configurations de guilde balayées par la passe. */
    guilds: number;
    /** Lignes d'audit examinées (bornées par le lot de chaque guilde). */
    scanned: number;
    /** Lignes d'audit supprimées. */
    deleted: number;
    /** Guildes isolées sur erreur : la passe ne s'arrête jamais pour une guilde. */
    failed: number;
    /** Une guilde avait plus de travail que son lot : le reste attend la passe suivante. */
    hasMore: boolean;
};

/**
 * S5.6 — Purge des **logs d'audit du marché** échus (§15.2).
 *
 * Appelée **1×/jour** par `/api/cron/cleanup-logs` (même famille que le
 * nettoyage des logs d'audit globaux) : la rétention étant un réglage **de
 * guilde** (§9.1), la passe balaie les configurations, mais chaque `where`
 * reste épinglé sur l'id **interne** (`GuildConfig.id`) — jamais un snowflake
 * (§16.2), et jamais un `deleteMany` global qui ferait déborder une guilde sur
 * l'autre.
 *
 * Garanties :
 *   • **âge seul** : une ligne plus jeune que la coupure de **sa** guilde n'est
 *     jamais touchée — deux guildes ne purgent pas au même moment ;
 *   • **par lot** (`MARKET_LOG_PURGE_BATCH_SIZE`) + `hasMore` : la base n'est
 *     jamais bloquée par une passe ;
 *   • **idempotent** : seules les lignes déjà échues sont supprimées, relancer
 *     la passe ne fait donc rien de plus ;
 *   • **les annonces ne sont jamais supprimées** : la purge ne touche que
 *     `MarketAuditLog`. Le marché **n'efface pas** une annonce (§11.10) — ses
 *     offres, réservations et signalements restent attachés à une annonce
 *     seulement archivée ; seuls les **logs** ont une durée de vie (§15.2) ;
 *   • **pas d'audit de purge** : journaliser la purge dans le journal purgé le
 *     recréerait indéfiniment. La trace vit dans la **télémétrie** du cron
 *     (`cleanup_logs`, God → Tâches CRON, §15.3).
 *
 * Le résultat ne contient que des compteurs : aucun montant, aucun pseudo,
 * aucune donnée d'annonce (§13.7).
 */
export async function purgeMarketAuditLogsCore(
    params: { now?: Date; limit?: number; guildConfigId?: string } = {}
): Promise<MarketLogPurgeOutcome> {
    const now = params.now ?? new Date();
    const limit = params.limit ?? MARKET_LOG_PURGE_BATCH_SIZE;
    const outcome: MarketLogPurgeOutcome = {
        guilds: 0,
        scanned: 0,
        deleted: 0,
        failed: 0,
        hasMore: false,
    };

    const guilds = await db.guildConfig.findMany({
        where: params.guildConfigId ? { id: params.guildConfigId } : undefined,
        orderBy: { id: "asc" },
        select: { id: true, marketLogRetentionDays: true },
    });

    for (const guild of guilds) {
        outcome.guilds += 1;
        try {
            const retentionDays = resolveMarketLogRetentionDays(guild.marketLogRetentionDays);
            const cutoff = marketLogPurgeCutoff(now, retentionDays);

            const due = await db.marketAuditLog.findMany({
                where: { guildId: guild.id, createdAt: { lt: cutoff } },
                orderBy: { createdAt: "asc" },
                take: limit + 1, // +1 : savoir s'il reste du travail après ce lot
                select: { id: true },
            });

            if (due.length > limit) outcome.hasMore = true;
            const batch = due.length > limit ? due.slice(0, limit) : due;
            outcome.scanned += batch.length;
            if (batch.length === 0) continue;

            // Conditions **rejouées** dans le `deleteMany` (guilde + coupure +
            // ids lus) : rien d'autre que ce lot ne peut être emporté.
            const removed = await db.marketAuditLog.deleteMany({
                where: {
                    guildId: guild.id,
                    createdAt: { lt: cutoff },
                    id: { in: batch.map((log) => log.id) },
                },
            });
            outcome.deleted += removed.count;
        } catch (error) {
            outcome.failed += 1;
            logger.error("[market] purge des logs d'audit — guilde ignorée", {
                guildConfigId: guild.id,
                err: error,
            });
        }
    }

    if (outcome.deleted > 0 || outcome.hasMore || outcome.failed > 0) {
        // Récapitulatif de passe (§15.1) : jamais une ligne par log purgé.
        logger.info("[market] purge des logs d'audit terminée", { ...outcome });
    }

    return outcome;
}
