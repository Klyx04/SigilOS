import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { getSuperAdminIds } from "./actions/super-admin-actions";
import { createGodAuditLog } from "./actions/audit-actions";

type CoreResult = {
    deleted: number;
    scanned: number;
    skipped: number;
};

/**
 * ♻️ #168 — Cœur de la rétention/purge des comptes orphelins (RGPD).
 *
 * ⚠️ SÉCURITÉ : ce module est VOLONTAIREMENT sans directive "use server" et SANS contrôle
 * d'auth : il n'est donc JAMAIS exposé comme endpoint de server action Next.js.
 * Seuls l'appellent des points déjà authentifiés :
 * - `purgeOrphanAccounts` (server action) après `isSuperAdmin()`,
 * - la route cron `/api/cron/account-retention` après `verifyCronSecret()`.
 *
 * Règles (fail-safe) : rétention 90j par défaut, purge seulement si TOUS les profils sont
 * en fin de grâce (`scheduledDeletion` passée), protections super-admin + guildEvents,
 * tâches de 50 max/exécution.
 */
export async function purgeOrphanAccountsCore(opts?: {
    retentionDays?: number;
    max?: number;
    source?: "CRON" | "GOD";
}): Promise<CoreResult> {
    const retentionDays = Math.min(3650, Math.max(30, opts?.retentionDays || 90));
    const max = Math.min(500, Math.max(1, opts?.max || 50));
    const source = opts?.source || "GOD";

    const now = new Date();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const superAdminIds = await getSuperAdminIds();

    // Comptes sans profil ACTIVE (ex-membres archivés/bannis, ou fantômes sans profil).
    const candidates = await db.user.findMany({
        where: {
            createdAt: { lt: cutoff },
            profiles: { none: { status: "ACTIVE" } },
        },
        include: {
            accounts: { select: { provider: true, providerAccountId: true } },
            profiles: {
                select: {
                    status: true,
                    scheduledDeletion: true,
                    archiveReason: true,
                },
            },
            _count: { select: { guildEvents: true } },
        },
        orderBy: { createdAt: "asc" },
        take: max,
    });

    let deleted = 0;
    let skipped = 0;
    const scanned = candidates.length;

    for (const user of candidates) {
        // 1. Protection super-admin.
        const discordId = user.accounts.find(a => a.provider === "discord")?.providerAccountId;
        if (discordId && superAdminIds.includes(discordId)) { skipped++; continue; }

        // 2. Audit : un compte ayant créé des événements de guilde est conservé.
        if (user._count.guildEvents > 0) { skipped++; continue; }

        // 3. Purge différée utilisateur en cours (deletionRequested/scheduledDeletion future).
        if (user.scheduledDeletion && user.scheduledDeletion > now) { skipped++; continue; }

        // 4. Profils non-ACTIFS : purge seulement si TOUS les profils sont en fin de grace.
        //    Un profil avec scheduledDeletion nulle (banni, archivage manuel) n'est jamais purgé.
        const profiles = user.profiles;
        if (profiles.length > 0) {
            const allGraceElapsed = profiles.every(p =>
                p.scheduledDeletion !== null && p.scheduledDeletion < now
            );
            if (!allGraceElapsed) { skipped++; continue; }
        }

        try {
            await db.user.delete({ where: { id: user.id } });
            deleted++;
        } catch (e) {
            logger.warn(`[AccountRetention] Échec purge user ${user.id}:`, e);
            skipped++;
        }
    }

    // 📝 Audit (non bloquant — le cron n'a pas de session).
    try {
        await createGodAuditLog({
            action: "GOD_USER_PLATFORM_BAN",
            targetType: "SYSTEM_GOD",
            metadata: {
                operation: "ORPHAN_ACCOUNT_RETENTION",
                retentionDays,
                scanned,
                deleted,
                skipped,
                source,
            },
        });
    } catch {
        // Non bloquant
    }

    logger.info(`[AccountRetention] source=${source} scanned=${scanned} deleted=${deleted} skipped=${skipped} (${retentionDays}j)`);
    return { deleted, scanned, skipped };
}
