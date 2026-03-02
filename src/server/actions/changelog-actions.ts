/**
 * 📝 Changelog - Server Actions
 * 
 * SECURITY: Create/Update/Delete = Super-admin only
 * Viewing = Public access
 */

'use server';

import { z } from 'zod';
import { db } from '@/lib/prisma';
import { isSuperAdmin } from './super-admin-actions';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { ChangelogCategory } from '@prisma/client';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const ChangelogSchema = z.object({
    version: z.string().min(1).max(32).trim(),
    title: z.string().min(1).max(120).trim(),
    summary: z.string().min(1).max(500).trim(),
    content: z.string().min(1).max(20000).trim(),
    category: z.nativeEnum(ChangelogCategory),
    isInternal: z.boolean().optional().default(false),
});

const ChangelogUpdateSchema = ChangelogSchema.partial();

type CreateChangelogInput = z.infer<typeof ChangelogSchema>;

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new changelog entry (super-admin only)
 */
export async function createChangelogEntry(input: CreateChangelogInput) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    const parsed = ChangelogSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.errors[0]?.message ?? 'Données invalides' };
    }

    try {
        const session = await auth();

        const entry = await db.changelogEntry.create({
            data: {
                ...parsed.data,
                publishedBy: session?.user?.id || 'UNKNOWN'
            }
        });

        revalidatePath('/changelog');
        revalidatePath('/god/changelog');

        return { success: true, entry };
    } catch (error) {
        console.error('[Changelog] Create error:', error);
        return { success: false, error: 'Failed to create changelog entry' };
    }
}

/**
 * Update an existing changelog entry (super-admin only)
 */
export async function updateChangelogEntry(id: string, input: Partial<CreateChangelogInput>) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    if (!id || typeof id !== 'string' || id.length > 64) {
        return { success: false, error: 'ID invalide' };
    }

    const parsed = ChangelogUpdateSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.errors[0]?.message ?? 'Données invalides' };
    }

    try {
        const entry = await db.changelogEntry.update({
            where: { id },
            data: parsed.data
        });

        revalidatePath('/changelog');
        revalidatePath('/god/changelog');

        return { success: true, entry };
    } catch (error) {
        console.error('[Changelog] Update error:', error);
        return { success: false, error: 'Failed to update changelog entry' };
    }
}

/**
 * Delete a changelog entry (super-admin only)
 */
export async function deleteChangelogEntry(id: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    if (!id || typeof id !== 'string' || id.length > 64) {
        return { success: false, error: 'ID invalide' };
    }

    try {
        await db.changelogEntry.delete({
            where: { id }
        });

        revalidatePath('/changelog');
        revalidatePath('/god/changelog');

        return { success: true };
    } catch (error) {
        console.error('[Changelog] Delete error:', error);
        return { success: false, error: 'Failed to delete changelog entry' };
    }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get all changelog entries (public access)
 * Optional category filter
 */
export async function getChangelogEntries(category?: ChangelogCategory, onlyPublic: boolean = false) {
    try {
        const where: Record<string, unknown> = {};
        if (category) where.category = category;
        if (onlyPublic) where.isInternal = false;

        const entries = await db.changelogEntry.findMany({
            where: Object.keys(where).length > 0 ? where : undefined,
            orderBy: { publishedAt: 'desc' }
        });

        return entries.map(e => ({
            ...e,
            publishedAt: e.publishedAt.toISOString()
        }));
    } catch (error) {
        console.error('[Changelog] Fetch error:', error);
        return [];
    }
}

/**
 * Get a single changelog entry by ID
 */
export async function getChangelogEntry(id: string) {
    try {
        const entry = await db.changelogEntry.findUnique({
            where: { id }
        });

        if (!entry) return null;

        return {
            ...entry,
            publishedAt: entry.publishedAt.toISOString()
        };
    } catch (error) {
        console.error('[Changelog] Fetch single error:', error);
        return null;
    }
}

/**
 * Get the latest published changelog entry
 */
export async function getLatestChangelogEntry() {
    try {
        const entry = await db.changelogEntry.findFirst({
            orderBy: { publishedAt: 'desc' }
        });

        if (!entry) return null;

        return {
            ...entry,
            publishedAt: entry.publishedAt.toISOString()
        };
    } catch (error) {
        console.error('[Changelog] Fetch latest error:', error);
        return null;
    }
}

/**
 * Check if the user should see the changelog modal
 */
export async function checkChangelogVisibility() {
    const session = await auth();
    if (!session?.user?.id) return { show: false };

    try {
        const [user, latest] = await Promise.all([
            db.user.findUnique({
                where: { id: session.user.id },
                select: { lastSeenChangelogId: true }
            }),
            getLatestChangelogEntry()
        ]);

        if (!latest) return { show: false };
        if (user?.lastSeenChangelogId === latest.id) return { show: false };

        return { show: true, changelog: latest };
    } catch (error) {
        console.error('[Changelog] Visibility check error:', error);
        return { show: false };
    }
}

/**
 * Mark a changelog entry as seen by the user
 */
export async function markChangelogAsSeen(changelogId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false };

    try {
        await db.user.update({
            where: { id: session.user.id },
            data: { lastSeenChangelogId: changelogId }
        });

        return { success: true };
    } catch (error) {
        console.error('[Changelog] Mark as seen error:', error);
        return { success: false };
    }
}
