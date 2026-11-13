// Journal d'activité du module Services — **écriture** (noyau, pas une action).
//
// Audit du 06/11/2026 : `logServiceActivity` vivait dans un fichier `"use server"`, donc
// chaque export devenait une action appelable depuis un navigateur — y compris celle-ci,
// qui écrit une ligne d'audit avec l'identifiant de guilde qu'on lui donne. Sortie du
// dossier d'actions : les appelants (actions de prêts et de services, déjà gardées) sont
// les seuls à pouvoir l'atteindre.

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Modules tracés par ce journal. Les valeurs **SERVICE / LOAN / VAULT** sont celles du module
 * Services (historique) ; les suivantes sont l'**activité de guilde** (chantier **N**, lot **N-2**) :
 * elles alimentent le flux de vie de la guilde (`unified-activity-actions.ts`) et, depuis là, les
 * annonces affichées en haut à droite. La correspondance type ↔ module vit dans
 * `GUILD_ACTIVITY_MODULE_BY_KIND` (`src/lib/guild-activity.ts`) — une seule source.
 */
export type LogModule =
    | "SERVICE"
    | "LOAN"
    | "VAULT"
    | "MISSIONS"
    | "DONJONS"
    | "SONGES"
    | "OCRE"
    | "EVENTS"
    | "SUCCES"
    | "DOFUS"
    | "PALIERS"
    | "LADDER"
    | "OBJECTIFS";

export type LogAction =
    | "CREATED"
    | "UPDATED"
    | "DELETED"
    | "STATUS_CHANGE"
    | "RETURNED"
    | "CANCELLED"
    | "PARTIAL_RETURN"
    /** Activité de guilde (chantier N) : une validation, ou un palier franchi. */
    | "VALIDATED"
    | "MILESTONE";

export interface LogEntry {
    guildId: string;     // Internal Prisma guild ID
    actorId: string;     // Profile ID of the actor
    module: LogModule;
    action: LogAction;
    entityId: string;
    summary: string;     // Human-readable summary
    details?: string;    // JSON with before/after state
    metadata?: string;   // Extra JSON (screenshot URLs, etc.)
}

/**
 * Journal immuable du module Services : les entrées ne sont jamais modifiées ni supprimées.
 * Un échec d'écriture ne casse **jamais** l'opération principale.
 */
export async function logServiceActivity(entry: LogEntry): Promise<void> {
    try {
        await db.serviceActivityLog.create({
            data: {
                guildId: entry.guildId,
                actorId: entry.actorId,
                module: entry.module,
                action: entry.action,
                entityId: entry.entityId,
                summary: entry.summary,
                details: entry.details || null,
                metadata: entry.metadata || null,
            },
        });
    } catch (error) {
        // Never let logging failure break the main operation
        logger.error("[ServiceActivityLog] Failed to log:", error);
    }
}
