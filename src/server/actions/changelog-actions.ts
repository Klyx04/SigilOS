/**
 * 📝 Changelog - Server Actions
 * 
 * SECURITY: Create/Update/Delete = Super-admin only
 * Viewing = Public access
 */

'use server';

import { db } from '@/lib/prisma';
import { isSuperAdmin } from './super-admin-actions';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { ChangelogCategory } from '@prisma/client';

interface CreateChangelogInput {
    version: string;
    title: string;
    summary: string;  // Short marketing description
    content: string;  // Full markdown content
    category: ChangelogCategory;
}

/**
 * Create a new changelog entry (super-admin only)
 */
export async function createChangelogEntry(input: CreateChangelogInput) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const session = await auth();

        const entry = await db.changelogEntry.create({
            data: {
                ...input,
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

    try {
        const entry = await db.changelogEntry.update({
            where: { id },
            data: input
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

/**
 * Get all changelog entries (public access)
 * Optional category filter
 */
export async function getChangelogEntries(category?: ChangelogCategory) {
    try {
        const entries = await db.changelogEntry.findMany({
            where: category ? { category } : undefined,
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
