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

// ---------------------------------------------------------------------------
// Discord
// ---------------------------------------------------------------------------

const CATEGORY_EMOJI: Record<string, string> = {
    FEATURE: '✨', BUGFIX: '🐛', SECURITY: '🔒', PERFORMANCE: '⚡', DOCUMENTATION: '📄'
};
const CATEGORY_COLOR: Record<string, number> = {
    FEATURE: 0x22c55e, BUGFIX: 0xf59e0b, SECURITY: 0xef4444, PERFORMANCE: 0x3b82f6, DOCUMENTATION: 0xa855f7
};
const CATEGORY_FR: Record<string, string> = {
    FEATURE: 'Fonctionnalité', BUGFIX: 'Correction', SECURITY: 'Sécurité', PERFORMANCE: 'Performance', DOCUMENTATION: 'Documentation'
};

/**
 * DISC-1 — Publish a changelog entry to the SigilOS Discord via webhook.
 * Requires SIGILOS_CHANGELOG_WEBHOOK_URL in env. Super-admin only.
 */
export async function sendChangelogToDiscord(entryId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: 'Unauthorized' };

    const webhookUrl = process.env.SIGILOS_CHANGELOG_WEBHOOK_URL;
    if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        return { success: false, error: 'Webhook non configuré — ajouter SIGILOS_CHANGELOG_WEBHOOK_URL dans le .env' };
    }

    if (!entryId || entryId.length > 64) return { success: false, error: 'ID invalide' };

    const entry = await db.changelogEntry.findUnique({ where: { id: entryId } });
    if (!entry) return { success: false, error: 'Entrée introuvable' };

    // HTML → lisible pour Discord
    const plainContent = entry.content
        .replace(/<li>/gi, '• ')
        .replace(/<\/li>/gi, '\n')
        .replace(/<h[1-6][^>]*>/gi, '**')
        .replace(/<\/h[1-6]>/gi, '**\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, 1024);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sigilos.fr';
    const emoji = CATEGORY_EMOJI[entry.category] ?? '📝';
    const color = CATEGORY_COLOR[entry.category] ?? 0x9333ea;

    const body = {
        embeds: [{
            title: `${emoji} ${entry.version} — ${entry.title}`,
            url: `${appUrl}/changelog`,
            description: entry.summary,
            color,
            fields: plainContent ? [
                { name: '📋 Changements', value: plainContent, inline: false }
            ] : [],
            footer: {
                text: `SigilOS Changelog • ${CATEGORY_FR[entry.category] ?? entry.category} • ${new Date(entry.publishedAt).toLocaleDateString('fr-FR')}`,
                icon_url: 'https://i.imgur.com/AfFp7pu.png'
            },
            timestamp: new Date().toISOString(),
        }]
    };

    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            cache: 'no-store',
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[Changelog Discord] Webhook error:', res.status, errText);
            return { success: false, error: `Discord a rejeté le message (${res.status})` };
        }

        return { success: true };
    } catch (error) {
        console.error('[Changelog Discord] Fetch error:', error);
        return { success: false, error: "Erreur réseau lors de l'envoi" };
    }
}
