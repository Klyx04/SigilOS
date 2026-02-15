#!/usr/bin/env tsx
/**
 * 🧹 Unified Database Janitor Script
 * 
 * Tasks:
 * 1. GDPR: Delete User + Account records with no UserProfile (>7 days).
 * 2. Audit: Delete audit logs older than 30 days.
 * 
 * Usage:
 *   npx tsx scripts/database-janitor.ts           # Dry-run (default)
 *   npx tsx scripts/database-janitor.ts --execute  # Actually delete
 * 
 * Intended to be run as a cron job on the VPS.
 */

import { PrismaClient } from '@prisma/client';

const GRACE_PERIOD_DAYS = 7;
const AUDIT_RETENTION_DAYS = 30;

async function main() {
    const isDryRun = !process.argv.includes('--execute');
    const db = new PrismaClient();

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

        // 2. Audit Log Cleanup
        const auditCutoff = new Date();
        auditCutoff.setDate(auditCutoff.getDate() - AUDIT_RETENTION_DAYS);

        const auditCount = await db.auditLog.count({
            where: { createdAt: { lt: auditCutoff } }
        });

        console.log(`[Audit] Found ${auditCount} audit logs older than ${AUDIT_RETENTION_DAYS} days.`);

        if (auditCount > 0) {
            if (isDryRun) {
                console.log(`  [DRY] Would delete ${auditCount} audit log entries.`);
            } else {
                const result = await db.auditLog.deleteMany({
                    where: { createdAt: { lt: auditCutoff } }
                });
                console.log(`  [DEL] Successfully deleted ${result.count} audit log entries.`);
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

        console.log('--------------------------------------------------');
        console.log(`✨ Janitor finished! ${isDryRun ? 'Dry run complete.' : 'Maintenance executed successfully.'}`);
    } catch (error) {
        console.error('❌ Janitor failed with error:', error);
        process.exit(1);
    } finally {
        await db.$disconnect();
    }
}

main();
