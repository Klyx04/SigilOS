"use server";

import { db } from "@/lib/prisma";
import { getSuperAdminIds, isSuperAdmin } from "@/server/actions/super-admin-actions";
import { SystemIssueType, SystemIssueStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";

const SUPER_ADMINS = process.env.SUPER_ADMIN_IDS?.split(",") || [];

async function isGod() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return null;
    const session = await auth();
    if (!session?.user?.id) return null;
    return session.user.id;
}

export async function getSystemIssues() {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        const issues = await db.systemIssue.findMany({
            orderBy: [
                { status: 'asc' }, // A FAIRE first
                { createdAt: 'desc' },
            ],
        });
        return { success: true, data: issues };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getMemberSystemIssues(guildId: string) {
    const start = Date.now();
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    try {
        // 1. Resolve internal guild ID from Discord ID
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });

        if (!guildConfig) {
            logger.error(`[Tracker] Guild config not found for Discord ID: ${guildId}`);
            return { success: false, error: "Guilde introuvable" };
        }

        const internalGuildId = guildConfig.id;

        // 2. Double check membership for security
        const membership = await db.userProfile.findFirst({
            where: {
                guildId: internalGuildId,
                userId: session.user.id,
                status: "ACTIVE"
            }
        });

        if (!membership) {
            logger.error(`[Tracker] Access denied for user ${session.user.id} in guild ${internalGuildId}`);
            return { success: false, error: "Accès refusé" };
        }

        const issues = await db.systemIssue.findMany({
            orderBy: [
                { status: 'asc' },
                { createdAt: 'desc' },
            ],
        });
        
        logger.debug(`[PERF] getMemberSystemIssues took ${Date.now() - start}ms`);
        return { success: true, data: issues };
    } catch (e: any) {
        logger.error(`[Tracker] Error:`, { error: e });
        return { success: false, error: e.message };
    }
}

export async function createSystemIssue(data: {
    type: SystemIssueType;
    category: string;
    priority: string;
    description: string;
    forumLink?: string;
}) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        await db.systemIssue.create({
            data: {
                ...data,
                creatorId: adminId,
            }
        });
        revalidatePath("/god/bugs");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateSystemIssue(id: number, data: {
    type: SystemIssueType;
    category: string;
    priority: string;
    description: string;
    forumLink?: string;
}) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        await db.systemIssue.update({
            where: { id },
            data
        });
        revalidatePath("/god/bugs");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateSystemIssueStatus(id: number, status: SystemIssueStatus) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        await db.systemIssue.update({
            where: { id },
            data: { status }
        });
        revalidatePath("/god/bugs");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function deleteSystemIssue(id: number) {
    const adminId = await isGod();
    if (!adminId) return { success: false, error: "Non autorisé" };

    try {
        await db.systemIssue.delete({
            where: { id }
        });
        revalidatePath("/god/bugs");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
