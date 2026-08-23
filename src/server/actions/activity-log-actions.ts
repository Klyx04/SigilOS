"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";

/**
 * Immutable activity logger for the Services module.
 * Creates audit entries that are NEVER deleted or modified.
 * Visible to involved parties for dispute resolution.
 */

type LogModule = "SERVICE" | "LOAN" | "VAULT";
type LogAction = "CREATED" | "UPDATED" | "DELETED" | "STATUS_CHANGE" | "RETURNED" | "CANCELLED" | "PARTIAL_RETURN";

interface LogEntry {
    guildId: string;     // Internal Prisma guild ID
    actorId: string;     // Profile ID of the actor
    module: LogModule;
    action: LogAction;
    entityId: string;
    summary: string;     // Human-readable summary
    details?: string;    // JSON with before/after state
    metadata?: string;   // Extra JSON (screenshot URLs, etc.)
}

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

/**
 * Get activity logs for a specific entity (service/loan/vault entry).
 * Returns chronological timeline visible to all guild members.
 */
export async function getActivityLogs(
    guildId: string,
    entityId: string
): Promise<{
    id: string;
    module: string;
    action: string;
    summary: string;
    details: string | null;
    metadata: string | null;
    createdAt: Date;
    actor: {
        pseudoDofus: string | null;
        discordNickname: string | null;
        user: { name: string | null; image: string | null };
    };
}[]> {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return [];

        return await db.serviceActivityLog.findMany({
            where: { guildId: guildConfig.id, entityId },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                module: true,
                action: true,
                summary: true,
                details: true,
                metadata: true,
                createdAt: true,
                actor: {
                    select: {
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true, image: true } },
                    },
                },
            },
        });
    } catch (error) {
        logger.error("[getActivityLogs]", error);
        return [];
    }
}

/**
 * Get recent logs for the whole module (admin overview).
 */
export async function getModuleLogs(
    guildId: string,
    module?: LogModule,
    limit = 50
): Promise<{
    id: string;
    module: string;
    action: string;
    entityId: string;
    summary: string;
    createdAt: Date;
    actor: {
        pseudoDofus: string | null;
        discordNickname: string | null;
        user: { name: string | null; image: string | null };
    };
}[]> {
    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return [];

        const where: any = { guildId: guildConfig.id };
        if (module) where.module = module;

        return await db.serviceActivityLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
            select: {
                id: true,
                module: true,
                action: true,
                entityId: true,
                summary: true,
                createdAt: true,
                actor: {
                    select: {
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true, image: true } },
                    },
                },
            },
        });
    } catch (error) {
        logger.error("[getModuleLogs]", error);
        return [];
    }
}
