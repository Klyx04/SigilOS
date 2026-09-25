/**
 * Purge des logs d'audit (`AuditLog`) — **core serveur**, PAS une server action.
 *
 * ⚠️ Ce fichier n'a délibérément **aucun `"use server"`** : l'ancien
 * `cleanupGlobalAuditLogs` vivait dans `src/server/actions/audit-actions.ts`
 * (`"use server"`) et avait perdu sa garde `isSuperAdmin()` (retirée pour le cron)
 * ⇒ un export de server action **sans contrôle d'accès** supprimait des milliers
 * de lignes. Le pattern correct est celui du marché (`src/server/market/retention.ts`) :
 * le core ne décide de rien, et **chaque appelant garde ses droits** —
 * `verifyCronSecret` (route cron) ou `getUserContext` (page guilde).
 *
 * Rétention (décision user, audit du 24/09/2026) : **90 j God / 30 j guilde**
 * (`src/lib/audit-retention-policy.ts`). Supprimer par lot, jamais un
 * `deleteMany` global sans borne : une table qui déborde ne doit pas bloquer une
 * passe (ni la page qui la déclenche).
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
    AUDIT_PURGE_BATCH_SIZE,
    auditPurgeCutoff,
    resolveAuditRetentionDays,
} from "@/lib/audit-retention-policy";

export type AuditPurgeOutcome = {
    /** Configurations de guilde balayées par la passe. */
    guilds: number;
    /** Lignes examinées (bornées par le lot de chaque périmètre). */
    scanned: number;
    /** Lignes supprimées au total (`godDeleted + guildDeleted`). */
    deleted: number;
    /** Logs plateforme (`isGodLog: true`, sans guilde) supprimés. */
    godDeleted: number;
    /** Logs de guilde supprimés. */
    guildDeleted: number;
    /** Périmètres isolés sur erreur : la passe ne s'arrête jamais pour un seul. */
    failed: number;
    /** Un périmètre avait plus de travail que son lot : le reste attend la passe suivante. */
    hasMore: boolean;
};

/** Supprime un périmètre en **un** lot, conditions **rejouées** dans le `deleteMany`. */
async function purgeOneScope(
    args: {
        where: Record<string, unknown>;
        cutoff: Date;
        limit: number;
    },
): Promise<{ scanned: number; deleted: number; hasMore: boolean }> {
    const due = await db.auditLog.findMany({
        where: { ...args.where, createdAt: { lt: args.cutoff } },
        orderBy: { createdAt: "asc" },
        take: args.limit + 1, // +1 : savoir s'il reste du travail après ce lot
        select: { id: true },
    });

    const hasMore = due.length > args.limit;
    const batch = hasMore ? due.slice(0, args.limit) : due;
    if (batch.length === 0) return { scanned: 0, deleted: 0, hasMore: false };

    const removed = await db.auditLog.deleteMany({
        where: {
            ...args.where,
            createdAt: { lt: args.cutoff },
            id: { in: batch.map((log) => log.id) },
        },
    });

    return { scanned: batch.length, deleted: removed.count, hasMore };
}

/**
 * Purge les logs échus : **logs God** (`isGodLog: true`, sans `guildId`) à 90 j,
 * puis **logs de guilde** à 30 j, guilde par guilde (`GuildConfig.id` interne,
 * jamais un snowflake), par lot de `AUDIT_PURGE_BATCH_SIZE`.
 *
 * Idempotent : seules les lignes déjà échues partent, relancer la passe ne fait
 * rien de plus. Aucune trace n'est écrite dans le journal purgé (elle vivrait
 * dans la télémétrie du cron `cleanup_logs`).
 */
export async function purgeAuditLogsCore(
    params: { now?: Date; limit?: number; guildConfigId?: string } = {}
): Promise<AuditPurgeOutcome> {
    const now = params.now ?? new Date();
    const limit = params.limit ?? AUDIT_PURGE_BATCH_SIZE;
    const outcome: AuditPurgeOutcome = {
        guilds: 0,
        scanned: 0,
        deleted: 0,
        godDeleted: 0,
        guildDeleted: 0,
        failed: 0,
        hasMore: false,
    };

    // 1. Périmètre plateforme (90 j) — une seule requête, sans boucle de guildes.
    //    Sauté quand la passe est déclenchée par une page de guilde (purge lazy) :
    //    une visite d'admin ne doit pas vider le journal de la plateforme.
    if (!params.guildConfigId) {
        try {
            const god = await purgeOneScope({
                where: { isGodLog: true },
                cutoff: auditPurgeCutoff(now, true),
                limit,
            });
            outcome.godDeleted = god.deleted;
            outcome.scanned += god.scanned;
            if (god.hasMore) outcome.hasMore = true;
        } catch (error) {
            outcome.failed += 1;
            logger.error("[audit] purge des logs God — périmètre ignoré", { err: error });
        }
    }

    // 2. Périmètre guilde (30 j) — la coupure est la même pour tous, mais la
    //    sélection reste épinglée sur l'id interne de chaque guilde.
    const guilds = await db.guildConfig.findMany({
        where: params.guildConfigId ? { id: params.guildConfigId } : undefined,
        orderBy: { id: "asc" },
        select: { id: true },
    });

    const guildCutoff = auditPurgeCutoff(now, false);
    for (const guild of guilds) {
        outcome.guilds += 1;
        try {
            const scope = await purgeOneScope({
                where: { guildId: guild.id, isGodLog: false },
                cutoff: guildCutoff,
                limit,
            });
            outcome.guildDeleted += scope.deleted;
            outcome.scanned += scope.scanned;
            if (scope.hasMore) outcome.hasMore = true;
        } catch (error) {
            outcome.failed += 1;
            logger.error("[audit] purge des logs — guilde ignorée", { guildConfigId: guild.id, err: error });
        }
    }

    outcome.deleted = outcome.godDeleted + outcome.guildDeleted;

    if (outcome.deleted > 0 || outcome.hasMore || outcome.failed > 0) {
        logger.info("[audit] purge des logs terminée", {
            ...outcome,
            godRetentionDays: resolveAuditRetentionDays(true),
            guildRetentionDays: resolveAuditRetentionDays(false),
        });
    }

    return outcome;
}
