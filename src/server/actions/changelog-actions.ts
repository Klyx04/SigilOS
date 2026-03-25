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
import { getAppBaseUrl } from '@/lib/utils';

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
// Discord & Platform Config
// ---------------------------------------------------------------------------

export async function getPlatformConfig() {
    try {
        let config = await db.platformConfig.findUnique({ where: { id: "singleton" } });
        if (!config) {
            config = await db.platformConfig.create({ data: { id: "singleton" } });
        }
        return { success: true, config };
    } catch (e) {
        return { success: false, error: "Erreur lecture config" };
    }
}

export async function updatePlatformConfig(data: { 
    hubChannelId?: string, 
    serviceStatusChannelId?: string,
    ticketAutoRoleId?: string,
    ticketSupportGuildId?: string,
    godNotifyChannelId?: string,
    godNotifyRoleId?: string,
    godNotifyWebEnabled?: boolean,
    statusIsLite?: boolean,
    statusMode?: string,
    statusMention?: string,
    statusFrequency?: number,
    nsfwFilterEnabled?: boolean
}) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: 'Unauthorized' };

    try {
        const config = await (db.platformConfig as any).upsert({
            where: { id: "singleton" },
            update: { 
                ...(data.hubChannelId !== undefined && { hubChannelId: data.hubChannelId || null }),
                ...(data.serviceStatusChannelId !== undefined && { serviceStatusChannelId: data.serviceStatusChannelId || null }),
                ...(data.ticketAutoRoleId !== undefined && { ticketAutoRoleId: data.ticketAutoRoleId || null }),
                ...(data.ticketSupportGuildId !== undefined && { ticketSupportGuildId: data.ticketSupportGuildId || null }),
                ...(data.godNotifyChannelId !== undefined && { godNotifyChannelId: data.godNotifyChannelId || null }),
                ...(data.godNotifyRoleId !== undefined && { godNotifyRoleId: data.godNotifyRoleId || null }),
                ...(data.godNotifyWebEnabled !== undefined && { godNotifyWebEnabled: data.godNotifyWebEnabled }),
                ...(data.statusIsLite !== undefined && { statusIsLite: data.statusIsLite }),
                ...(data.statusMode !== undefined && { statusMode: data.statusMode }),
                ...(data.statusMention !== undefined && { statusMention: data.statusMention }),
                ...(data.statusFrequency !== undefined && { statusFrequency: data.statusFrequency }),
                ...(data.nsfwFilterEnabled !== undefined && { nsfwFilterEnabled: data.nsfwFilterEnabled })
            },
            create: { 
                id: "singleton", 
                hubChannelId: data.hubChannelId || null,
                serviceStatusChannelId: data.serviceStatusChannelId || null,
                ticketAutoRoleId: data.ticketAutoRoleId || null,
                ticketSupportGuildId: data.ticketSupportGuildId || null,
                godNotifyChannelId: data.godNotifyChannelId || null,
                godNotifyRoleId: data.godNotifyRoleId || null,
                godNotifyWebEnabled: data.godNotifyWebEnabled ?? true,
                statusIsLite: data.statusIsLite || false,
                statusMode: data.statusMode || "living",
                statusMention: data.statusMention || "none",
                statusFrequency: data.statusFrequency || 15,
                nsfwFilterEnabled: data.nsfwFilterEnabled !== undefined ? data.nsfwFilterEnabled : true
            }
        });
        return { success: true, config };
    } catch (e) {
        console.error('[updatePlatformConfig]', e);
        return { success: false, error: "Erreur écriture config" };
    }
}

export async function testStatusPing() {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: 'Unauthorized' };

    try {
        const { sendGlobalStatusPing } = await import("./status-actions");
        return await sendGlobalStatusPing(true);
    } catch (e: any) {
        console.error('[testStatusPing]', e);
        return { success: false, error: e.message || "Erreur interne" };
    }
}

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
 * DISC-1 — Publish a changelog entry to the SigilOS Hub (official Discord).
 * Requires hubChannelId in PlatformConfig. Super-admin only.
 */
export async function sendChangelogToDiscord(entryId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: 'Unauthorized' };

    const platformConfig = await db.platformConfig.findUnique({ where: { id: "singleton" } });
    const hubChannelId = platformConfig?.hubChannelId;
    
    if (!hubChannelId) {
        return { success: false, error: 'Salon du Hub non configuré dans les paramètres GOD' };
    }

    if (!entryId || entryId.length > 64) return { success: false, error: 'ID invalide' };

    const entry = await db.changelogEntry.findUnique({ where: { id: entryId } });
    if (!entry) return { success: false, error: 'Entrée introuvable' };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sigilos.fr';
    const emoji = CATEGORY_EMOJI[entry.category] ?? '📝';
    const color = CATEGORY_COLOR[entry.category] ?? 0x9333ea;

    // SLIM FORMAT
    const fullDescription = [
        entry.summary || "_Améliorations et corrections de bugs._",
        '',
        `> 🔗 **[Consulter le changelog complet v${entry.version}](${appUrl}/changelog)**`
    ].join('\n');

    const embed = {
        embedTitle: `${emoji} SigilOS ${entry.version} — ${entry.title}`,
        embedUrl: `${appUrl}/changelog`,
        embedDescription: fullDescription.slice(0, 4096),
        embedColor: color,
        embedFooter: `SigilOS Updater • ${CATEGORY_FR[entry.category] ?? entry.category} • ${new Date(entry.publishedAt).toLocaleDateString('fr-FR')}`,
        embedThumbnail: `${getAppBaseUrl()}/assets/ui/logo-v2.png`
    };

    const { sendChannelMessage } = await import("@/server/discord");

    try {
        const mid = await sendChannelMessage(hubChannelId, "", embed);
        if (!mid) return { success: false, error: `Discord a rejeté le message (Salon introuvable ou permissions manquantes)` };
        return { success: true };
    } catch (error) {
        console.error('[Changelog Discord] Fetch error:', error);
        return { success: false, error: "Erreur réseau lors de l'envoi" };
    }
}


/**
 * Broadcast a SigilOS Changelog to ALL active guilds (systemNotifyChannelId)
 * Super-admin only.
 */
export async function broadcastChangelogToGuilds(entryId: string) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) return { success: false, error: 'Unauthorized' };

    const entry = await db.changelogEntry.findUnique({ where: { id: entryId } });
    if (!entry) return { success: false, error: 'Entrée introuvable' };

    const guilds = await db.guildConfig.findMany({
        where: { isActive: true, systemNotifyChannelId: { not: null } },
        select: { discordGuildId: true, systemNotifyChannelId: true, name: true }
    });

    const results = {
        total: guilds.length,
        success: 0,
        failed: 0,
        errors: [] as string[]
    };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sigilos.fr';
    const emoji = CATEGORY_EMOJI[entry.category] ?? '📝';
    const color = CATEGORY_COLOR[entry.category] ?? 0x9333ea;

    // SLIM FORMAT
    const fullDescription = [
        entry.summary || "_Améliorations et corrections de bugs._",
        '',
        `> 🔗 **[Découvrir les nouveautés v${entry.version} sur SigilOS](${appUrl}/changelog)**`
    ].join('\n');

    const embed = {
        embedTitle: `${emoji} SigilOS ${entry.version} — ${entry.title}`,
        embedUrl: `${appUrl}/changelog`,
        embedDescription: fullDescription.slice(0, 4096),
        embedColor: color,
        embedFooter: `SigilOS Updater • ${CATEGORY_FR[entry.category] ?? entry.category} • ${new Date(entry.publishedAt).toLocaleDateString('fr-FR')}`,
        embedThumbnail: `${getAppBaseUrl()}/assets/ui/logo-v2.png`
    };

    const { sendChannelMessage } = await import("@/server/discord");

    // Batch sending (serial to avoid rate limits)
    for (const guild of guilds) {
        try {
            const mid = await sendChannelMessage(guild.systemNotifyChannelId!, "", embed);
            if (mid) results.success++;
            else throw new Error(`API null response for ${guild.name}`);
        } catch (e) {
            results.failed++;
            results.errors.push(`${guild.name}: ${(e as Error).message}`);
        }
    }

    return { success: true, results };
}
