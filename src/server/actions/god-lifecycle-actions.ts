/**
 * 🔒 GOD - Lifecycle Management Server Actions
 * 
 * SECURITY: Super-admin only
 * 
 * Actions:
 * - softDeleteGuild
 * - reactivateGuild
 * - hardDeleteGuild
 * - softDeleteProfile
 * - reactivateProfile
 * - hardDeleteProfile
 */

'use server';

import { db } from '@/lib/prisma';
import { isSuperAdmin } from './super-admin-actions';
import { revalidatePath } from 'next/cache';

export async function softDeleteGuild(
    guildId: string,
    reason: string,
    graceDays: number = 30
) {
    // Security check
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const scheduledDeletion = new Date();
        scheduledDeletion.setDate(scheduledDeletion.getDate() + graceDays);

        await db.guildConfig.update({
            where: { id: guildId },
            data: {
                isActive: false,
                deletedAt: new Date(),
                deletionReason: reason,
                scheduledDeletion
            }
        });

        // Also soft delete all profiles
        await db.userProfile.updateMany({
            where: { guildId },
            data: {
                status: 'ARCHIVED',
                archivedAt: new Date(),
                archiveReason: 'GUILD_DELETED',
                scheduledDeletion
            }
        });

        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        console.error('[GOD] softDeleteGuild error:', error);
        return { success: false, error: 'Failed to soft delete guild' };
    }
}

export async function reactivateGuild(guildId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        await db.guildConfig.update({
            where: { id: guildId },
            data: {
                isActive: true,
                deletedAt: null,
                deletionReason: null,
                scheduledDeletion: null
            }
        });

        // Also reactivate profiles
        await db.userProfile.updateMany({
            where: {
                guildId,
                archiveReason: 'GUILD_DELETED'
            },
            data: {
                status: 'ACTIVE',
                archivedAt: null,
                archiveReason: null,
                scheduledDeletion: null
            }
        });

        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        console.error('[GOD] reactivateGuild error:', error);
        return { success: false, error: 'Failed to reactivate guild' };
    }
}

export async function hardDeleteGuild(guildId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        // Cascade delete configured in schema
        await db.guildConfig.delete({
            where: { id: guildId }
        });

        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        console.error('[GOD] hardDeleteGuild error:', error);
        return { success: false, error: 'Failed to hard delete guild' };
    }
}

export async function softDeleteProfile(
    profileId: string,
    reason: string,
    graceDays: number = 7
) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const scheduledDeletion = new Date();
        scheduledDeletion.setDate(scheduledDeletion.getDate() + graceDays);

        await db.userProfile.update({
            where: { id: profileId },
            data: {
                status: 'ARCHIVED',
                archivedAt: new Date(),
                archiveReason: reason,
                scheduledDeletion
            }
        });

        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        console.error('[GOD] softDeleteProfile error:', error);
        return { success: false, error: 'Failed to soft delete profile' };
    }
}

export async function reactivateProfile(profileId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        await db.userProfile.update({
            where: { id: profileId },
            data: {
                status: 'ACTIVE',
                archivedAt: null,
                archiveReason: null,
                scheduledDeletion: null
            }
        });

        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        console.error('[GOD] reactivateProfile error:', error);
        return { success: false, error: 'Failed to reactivate profile' };
    }
}

export async function hardDeleteProfile(profileId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        await db.userProfile.delete({
            where: { id: profileId }
        });

        revalidatePath('/god');
        return { success: true };
    } catch (error) {
        console.error('[GOD] hardDeleteProfile error:', error);
        return { success: false, error: 'Failed to hard delete profile' };
    }
}

/**
 * Get soft-deleted guilds
 */
export async function getSoftDeletedGuilds() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return [];

    return db.guildConfig.findMany({
        where: {
            isActive: false,
            deletedAt: { not: null }
        },
        include: {
            _count: { select: { profiles: true } }
        },
        orderBy: { scheduledDeletion: 'asc' }
    });
}

/**
 * Get soft-deleted profiles
 */
export async function getSoftDeletedProfiles() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return [];

    return db.userProfile.findMany({
        where: {
            status: 'ARCHIVED',
            archivedAt: { not: null }
        },
        include: {
            guild: { select: { name: true } },
            user: { select: { name: true } }
        },
        orderBy: { scheduledDeletion: 'asc' }
    });
}
