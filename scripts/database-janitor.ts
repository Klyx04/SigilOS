#!/usr/bin/env tsx
/**
 * 🧹 Unified Database Janitor Script
 * 
 * Tasks:
 * 1. GDPR: Delete User + Account records with no UserProfile (>7 days).
 * 2. Audit: Delete audit logs older than 30 days.
 * 6. Anti-surcharge : purge des notifications de dialogue service.
 * 
 * Usage:
 *   npx tsx scripts/database-janitor.ts           # Dry-run (default)
 *   npx tsx scripts/database-janitor.ts --execute  # Actually delete
 * 
 * Intended to be run as a cron job on the VPS.
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { AUDIT_RETENTION_DAYS, MS_PER_DAY } from '../src/lib/audit-retention-policy';

const GRACE_PERIOD_DAYS = 7;
// ⚠️ Politique d'audit : SOURCE UNIQUE dans `src/lib/audit-retention-policy.ts`
// (import relatif — ce script ne connaît pas les alias `@/`, il est bundlé par
// esbuild sans résolution de chemins). Avant l'audit du 24/09, ce script purgeait
// les logs God à 30 j alors que la décision user est **90 j**.
const AUDIT_RETENTION_DAYS_GUILD = AUDIT_RETENTION_DAYS.GUILD;
const AUDIT_RETENTION_DAYS_GOD = AUDIT_RETENTION_DAYS.GOD;
const GOD_NOTIF_RETENTION_DAYS = 90;
// Rétention des journaux/grants God (P4) — limite la croissance des tables PIM.
const GOD_LOG_RETENTION_DAYS = 90;
const GOD_GRANT_RETENTION_DAYS = 90;
const GOD_DELEGATE_RETENTION_DAYS = 90;
// Rétention des tentatives de connexion refusées (PII minimale, bornée).
const ACCESS_ATTEMPT_RETENTION_DAYS = 90;

async function main() {
    const isDryRun = !process.argv.includes('--execute');

    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required to run the database janitor.');
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool as any);
    const db = new PrismaClient({ adapter });

    console.log('--------------------------------------------------');
    console.log(`🧹 Database Janitor - ${new Date().toISOString()}`);
    if (isDryRun) console.log('🧪 DRY RUN MODE - No data will be modified.');
    console.log('--------------------------------------------------');

    try {
        // 1. Orphan User Cleanup (GDPR)
        const orphanCutoff = new Date();
        orphanCutoff.setDate(orphanCutoff.getDate() - GRACE_PERIOD_DAYS);

        const orphans = await db.user.findMany({
            where: {
                createdAt: { lt: orphanCutoff },
                profiles: { none: {} },
            },
            select: { id: true, name: true, email: true }
        });

        console.log(`[GDPR] Found ${orphans.length} orphan user(s) (no profile, > ${GRACE_PERIOD_DAYS}d old)`);

        if (orphans.length > 0) {
            if (isDryRun) {
                orphans.forEach(u => console.log(`  [DRY] Would delete user: ${u.name || u.email || u.id}`));
            } else {
                const result = await db.user.deleteMany({
                    where: { id: { in: orphans.map(u => u.id) } }
                });
                console.log(`  [DEL] Successfully deleted ${result.count} orphan user(s).`);
            }
        }

        // 2. Audit Log Cleanup — 30 j pour les journaux de guilde, 90 j pour les
        //    actions plateforme (`isGodLog: true`, sans guilde). Deux coupures
        //    distinctes : c'est la politique décidée le 24/09/2026.
        const now2 = new Date();
        const guildCutoff = new Date(now2.getTime() - AUDIT_RETENTION_DAYS_GUILD * MS_PER_DAY);
        const godCutoff = new Date(now2.getTime() - AUDIT_RETENTION_DAYS_GOD * MS_PER_DAY);

        const [guildAuditCount, godAuditCount] = await Promise.all([
            db.auditLog.count({ where: { isGodLog: false, createdAt: { lt: guildCutoff } } }),
            db.auditLog.count({ where: { isGodLog: true, createdAt: { lt: godCutoff } } }),
        ]);

        console.log(`[Audit] Found ${guildAuditCount} guild audit log(s) older than ${AUDIT_RETENTION_DAYS_GUILD} days and ${godAuditCount} God log(s) older than ${AUDIT_RETENTION_DAYS_GOD} days.`);

        if (guildAuditCount + godAuditCount > 0) {
            if (isDryRun) {
                console.log(`  [DRY] Would delete ${guildAuditCount + godAuditCount} audit log entries.`);
            } else {
                const [guildRemoved, godRemoved] = await Promise.all([
                    db.auditLog.deleteMany({ where: { isGodLog: false, createdAt: { lt: guildCutoff } } }),
                    db.auditLog.deleteMany({ where: { isGodLog: true, createdAt: { lt: godCutoff } } }),
                ]);
                console.log(`  [DEL] Successfully deleted ${guildRemoved.count} guild + ${godRemoved.count} God audit log entries.`);
            }
        }

        // 3. Scheduled Hard Deletions (Guilds & Profiles)
        const now = new Date();

        // Guilds
        const expiredGuilds = await db.guildConfig.findMany({
            where: { scheduledDeletion: { lt: now } },
            select: { id: true, name: true }
        });

        console.log(`[Lifecycle] Found ${expiredGuilds.length} expired guild(s) for hard deletion.`);
        if (expiredGuilds.length > 0) {
            if (isDryRun) {
                expiredGuilds.forEach(g => console.log(`  [DRY] Would hard delete guild: ${g.name} (${g.id})`));
            } else {
                for (const g of expiredGuilds) {
                    await db.guildConfig.delete({ where: { id: g.id } });
                    console.log(`  [DEL] Hard deleted guild: ${g.name}`);
                }
            }
        }

        // Profiles
        const expiredProfiles = await db.userProfile.findMany({
            where: { scheduledDeletion: { lt: now } },
            select: { id: true, userId: true, guildId: true }
        });

        console.log(`[Lifecycle] Found ${expiredProfiles.length} expired profile(s) for hard deletion.`);
        if (expiredProfiles.length > 0) {
            if (isDryRun) {
                console.log(`  [DRY] Would hard delete ${expiredProfiles.length} profiles.`);
            } else {
                const result = await db.userProfile.deleteMany({
                    where: { id: { in: expiredProfiles.map(p => p.id) } }
                });
                console.log(`  [DEL] Successfully hard deleted ${result.count} profile(s).`);
            }
        }

        // 4. Poll Cleanup (Storage Management)
        const pollCutoff = new Date();
        pollCutoff.setFullYear(pollCutoff.getFullYear() - 1); // 1 year retention

        const oldPolls = await db.poll.findMany({
            where: {
                status: { in: ["CLOSED", "CANCELLED"] },
                closedAt: { lt: pollCutoff }
            },
            select: { id: true, title: true }
        });

        console.log(`[Polls] Found ${oldPolls.length} legacy polls (closed/cancelled > 1 year).`);
        if (oldPolls.length > 0) {
            if (isDryRun) {
                oldPolls.forEach(p => console.log(`  [DRY] Would delete legacy poll: ${p.title} (${p.id})`));
            } else {
                const result = await db.poll.deleteMany({
                    where: { id: { in: oldPolls.map(p => p.id) } }
                });
                console.log(`  [DEL] Successfully archived/deleted ${result.count} legacy polls.`);
            }
        }

        // 5. GodNotification Cleanup (90 days retention)
        const godNotifCutoff = new Date();
        godNotifCutoff.setDate(godNotifCutoff.getDate() - GOD_NOTIF_RETENTION_DAYS);

        const oldNotifsCount = await (db as any).godNotification.count({
            where: { createdAt: { lt: godNotifCutoff } }
        });

        console.log(`[GodNotif] Found ${oldNotifsCount} notifications older than ${GOD_NOTIF_RETENTION_DAYS} days.`);

        if (oldNotifsCount > 0) {
            if (isDryRun) {
                console.log(`  [DRY] Would delete ${oldNotifsCount} old god notifications.`);
            } else {
                const result = await (db as any).godNotification.deleteMany({
                    where: { createdAt: { lt: godNotifCutoff } }
                });
                console.log(`  [DEL] Successfully deleted ${result.count} old god notifications.`);
            }
        }

        // 7. GodAccessLog Cleanup (P4 — journaux d'accès God > 90 jours)
        const godAccessLogCutoff = new Date();
        godAccessLogCutoff.setDate(godAccessLogCutoff.getDate() - GOD_LOG_RETENTION_DAYS);

        const oldGodAccessLogs = await (db as any).godAccessLog.count({
            where: { createdAt: { lt: godAccessLogCutoff } }
        });
        console.log(`[GodAccessLog] Found ${oldGodAccessLogs} access log(s) older than ${GOD_LOG_RETENTION_DAYS} days.`);
        if (oldGodAccessLogs > 0) {
            if (isDryRun) {
                console.log(`  [DRY] Would delete ${oldGodAccessLogs} god access log entries.`);
            } else {
                const res = await (db as any).godAccessLog.deleteMany({
                    where: { createdAt: { lt: godAccessLogCutoff } }
                });
                console.log(`  [DEL] Successfully deleted ${res.count} god access log entries.`);
            }
        }

        // 8. GodSessionLog Cleanup (P4 — sessions God terminées/inactives > 90 jours)
        const godSessionLogCutoff = new Date();
        godSessionLogCutoff.setDate(godSessionLogCutoff.getDate() - GOD_LOG_RETENTION_DAYS);

        const oldGodSessions = await (db as any).godSessionLog.count({
            where: { endedAt: { lt: godSessionLogCutoff } }
        });
        console.log(`[GodSessionLog] Found ${oldGodSessions} ended session(s) older than ${GOD_LOG_RETENTION_DAYS} days.`);
        if (oldGodSessions > 0) {
            if (isDryRun) {
                console.log(`  [DRY] Would delete ${oldGodSessions} ended god session(s).`);
            } else {
                const res = await (db as any).godSessionLog.deleteMany({
                    where: { endedAt: { lt: godSessionLogCutoff } }
                });
                console.log(`  [DEL] Successfully deleted ${res.count} ended god session(s).`);
            }
        }

        // 9. GodAccessGrant Cleanup (P4 — grants révoqués/expirés > 90 jours)
        const godGrantCutoff = new Date();
        godGrantCutoff.setDate(godGrantCutoff.getDate() - GOD_GRANT_RETENTION_DAYS);

        const oldGrants = await (db as any).godAccessGrant.count({
            where: {
                OR: [
                    { revokedAt: { lt: godGrantCutoff } },
                    { revokedAt: null, expiresAt: { lt: godGrantCutoff } },
                ],
            }
        });
        console.log(`[GodAccessGrant] Found ${oldGrants} revoked/expired grant(s) older than ${GOD_GRANT_RETENTION_DAYS} days.`);
        if (oldGrants > 0) {
            if (isDryRun) {
                console.log(`  [DRY] Would delete ${oldGrants} revoked/expired grant(s).`);
            } else {
                const res = await (db as any).godAccessGrant.deleteMany({
                    where: {
                        OR: [
                            { revokedAt: { lt: godGrantCutoff } },
                            { revokedAt: null, expiresAt: { lt: godGrantCutoff } },
                        ],
                    }
                });
                console.log(`  [DEL] Successfully deleted ${res.count} revoked/expired grant(s).`);
            }
        }

        // 10. GodDelegate Cleanup (P4 — délégués révoqués > 90 jours, grants déjà purgés)
        const godDelegateCutoff = new Date();
        godDelegateCutoff.setDate(godDelegateCutoff.getDate() - GOD_DELEGATE_RETENTION_DAYS);

        const oldDelegates = await (db as any).godDelegate.count({
            where: { revokedAt: { lt: godDelegateCutoff } }
        });
        console.log(`[GodDelegate] Found ${oldDelegates} revoked delegate(s) older than ${GOD_DELEGATE_RETENTION_DAYS} days.`);
        if (oldDelegates > 0) {
            if (isDryRun) {
                console.log(`  [DRY] Would delete ${oldDelegates} revoked delegate(s).`);
            } else {
                const res = await (db as any).godDelegate.deleteMany({
                    where: { revokedAt: { lt: godDelegateCutoff } }
                });
                console.log(`  [DEL] Successfully deleted ${res.count} revoked delegate(s).`);
            }
        }

        // 11. AccessAttempt Cleanup (rétention bornée des connexions refusées, PII)
        const accessAttemptCutoff = new Date();
        accessAttemptCutoff.setDate(accessAttemptCutoff.getDate() - ACCESS_ATTEMPT_RETENTION_DAYS);

        const oldAccessAttempts = await (db as any).accessAttempt.count({
            where: { createdAt: { lt: accessAttemptCutoff } }
        });
        console.log(`[AccessAttempt] Found ${oldAccessAttempts} refused sign-in(s) older than ${ACCESS_ATTEMPT_RETENTION_DAYS} days.`);
        if (oldAccessAttempts > 0) {
            if (isDryRun) {
                console.log(`  [DRY] Would delete ${oldAccessAttempts} refused sign-in record(s).`);
            } else {
                const res = await (db as any).accessAttempt.deleteMany({
                    where: { createdAt: { lt: accessAttemptCutoff } }
                });
                console.log(`  [DEL] Successfully deleted ${res.count} refused sign-in record(s).`);
            }
        }

        // 6. Service Dialogue Notifications Cleanup (anti-surcharge)
        // Les notifications de mini-dialogue service (SERVICE_REQUEST / SERVICE_REPLY)
        // sont éphémères : le contenu vit sur Discord. On purge après TTL court :
        //  - non lues : 14 jours (pour laisser le destinataire répondre)
        //  - lues : 30 jours (traçabilité légère, pas d'accumulation)
        const SERVICE_UNREAD_RETENTION_DAYS = 14;
        const SERVICE_READ_RETENTION_DAYS = 30;

        const serviceUnreadCutoff = new Date();
        serviceUnreadCutoff.setDate(serviceUnreadCutoff.getDate() - SERVICE_UNREAD_RETENTION_DAYS);
        const serviceReadCutoff = new Date();
        serviceReadCutoff.setDate(serviceReadCutoff.getDate() - SERVICE_READ_RETENTION_DAYS);

        const serviceNotifsCount = await db.notification.count({
            where: {
                type: { in: ["SERVICE_REQUEST", "SERVICE_REPLY"] },
                OR: [
                    { read: false, createdAt: { lt: serviceUnreadCutoff } },
                    { read: true, createdAt: { lt: serviceReadCutoff } },
                ],
            }
        });

        console.log(`[ServiceDialogue] Found ${serviceNotifsCount} service dialogue notification(s) past retention.`);

        if (serviceNotifsCount > 0) {
            if (isDryRun) {
                console.log(`  [DRY] Would delete ${serviceNotifsCount} old service dialogue notifications.`);
            } else {
                const result = await db.notification.deleteMany({
                    where: {
                        type: { in: ["SERVICE_REQUEST", "SERVICE_REPLY"] },
                        OR: [
                            { read: false, createdAt: { lt: serviceUnreadCutoff } },
                            { read: true, createdAt: { lt: serviceReadCutoff } },
                        ],
                    }
                });
                console.log(`  [DEL] Successfully deleted ${result.count} old service dialogue notifications.`);
            }
        }

        console.log('--------------------------------------------------');
        console.log(`✨ Janitor finished! ${isDryRun ? 'Dry run complete.' : 'Maintenance executed successfully.'}`);
    } catch (error) {
        console.error('❌ Janitor failed with error:', error);
        process.exit(1);
    } finally {
        await db.$disconnect();
        await pool.end();
    }
}

main();