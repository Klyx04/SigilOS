"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { isSuperAdmin, getSuperAdminIds } from "./super-admin-actions";
import { createGodAuditLog } from "./audit-actions";

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

/**
 * ♻️ #168 — Rétention / purge automatique des comptes orphelins (RGPD).
 *
 * Contexte vérifié le 01/09 : un compte SANS guilde refusé à la connexion n'est JAMAIS
 * écrit en base (Auth.js v5 appelle `signIn` avant `createUser`/`linkAccount`).
 * En revanche, un EX-MEMBRE garde son `User` + `Account` (tokens Discord chiffrés) tant
 * qu'aucune suppression n'est demandée. Ce module purge automatiquement ces comptes
 * après une période de rétention sans profil ACTIVE.
 *
 * Règles de sécurité (fail-safe) :
 * - Durée de rétention : 90 jours par défaut (configurable).
 * - Un compte avec au moins un profil ACTIVE n'est JAMAIS touché.
 * - Un profil ARCHIVÉ n'est purgé que si sa `scheduledDeletion` est PASSÉE
 *   (grace period de 12 mois posée par la synchro membre parti) — les profils avec
 *   `scheduledDeletion` nulle (ex. bannis, archivage manuel) sont ignorés.
 * - Protection super-admin (un God ne peut jamais être purgé automatiquement).
 * - Un compte qui a créé des événements de guilde est conservé (audit).
 * - Purge en tâches de 50 comptes max par exécution (cron quotidien).
 */
export async function purgeOrphanAccounts(opts?: {
    retentionDays?: number;
    max?: number;
    allowCron?: boolean;
}): Promise<ActionResponse<{ deleted: number; scanned: number; skipped: number }>> {
    const retentionDays = Math.min(3650, Math.max(30, opts?.retentionDays || 90));
    const max = Math.min(500, Math.max(1, opts?.max || 50));
    const allowCron = opts?.allowCron === true;

    // Auth : super-admin (dashboard God) OU appel cron explicite (route /api/cron/account-retention).
    if (!allowCron) {
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) return { success: false, error: "Accès refusé" };
    }

    const now = new Date();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    try {
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

            // 4. Profils non-ACTIFS : on ne purge que si TOUS les profils sont en fin de grace
            //    (scheduledDeletion passée). Un profil avec scheduledDeletion nulle est ignoré
            //    (ex. banni, archivage manuel → pas de purge automatique).
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
                    source: allowCron ? "CRON" : "GOD",
                },
            });
        } catch {
            // Non bloquant
        }

        logger.info(`[AccountRetention] scanned=${scanned} deleted=${deleted} skipped=${skipped} (${retentionDays}j)`);
        return { success: true, data: { deleted, scanned, skipped } };
    } catch (error: any) {
        logger.error("[AccountRetention] Error:", error);
        return { success: false, error: error?.message || "Erreur lors de la purge des comptes orphelins" };
    }
}
