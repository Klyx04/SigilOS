/**
 * Module « Marché » — journal d'audit (`MarketAuditLog`).
 *
 * ⚠️ Fichier **serveur partagé** : ni `"use server"` (ce n'est pas un server
 * action), ni React. Il est utilisé par les server actions du dashboard **et**
 * par le moteur de réservation appelé depuis Discord : une **seule** écriture
 * d'audit pour tout le module (§13.4 — aucune logique dupliquée).
 *
 * La journalisation ne doit **jamais** faire échouer l'action métier : une
 * erreur d'écriture est loguée et avalée.
 */

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

/** Journalise une transition dans `MarketAuditLog` (jamais bloquant). */
export async function writeMarketAuditLog(params: {
    guildId: string;
    listingId?: string | null;
    actorUserId?: string | null;
    action: string;
    previousData?: unknown;
    nextData?: unknown;
    reason?: string | null;
}): Promise<void> {
    try {
        await db.marketAuditLog.create({
            data: {
                guildId: params.guildId,
                listingId: params.listingId ?? null,
                actorUserId: params.actorUserId ?? null,
                action: params.action,
                previousData: (params.previousData ?? null) as Prisma.InputJsonValue,
                nextData: (params.nextData ?? null) as Prisma.InputJsonValue,
                reason: params.reason ?? null,
            },
        });
    } catch (error) {
        // Le journal ne doit JAMAIS faire échouer l'action métier.
        logger.error("[market] audit log failed", { action: params.action, err: error });
    }
}
