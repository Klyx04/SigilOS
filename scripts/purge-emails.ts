/**
 * RGPD Email Purge Script
 * -----------------------
 * Sets email, emailVerified, and emailBackup to NULL for all users.
 * Run ONCE after deploying the scope change (email scope removed from Discord OAuth).
 *
 * Usage (on VPS):
 *   npx tsx scripts/purge-emails.ts          → dry-run (safe, no changes)
 *   npx tsx scripts/purge-emails.ts --commit  → applies the purge for real
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const isDryRun = !process.argv.includes("--commit");

async function main() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  🔒 SigilOS — RGPD Email Purge");
    console.log(`  Mode : ${isDryRun ? "DRY-RUN (no changes)" : "⚠️  COMMIT (real purge)"}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // 1. Count users with at least one email field set
    const [withEmail, withEmailVerified, withEmailBackup] = await Promise.all([
        prisma.user.count({ where: { email: { not: null } } }),
        prisma.user.count({ where: { emailVerified: { not: null } } }),
        prisma.user.count({ where: { emailBackup: { not: null } } }),
    ]);

    const totalUsers = await prisma.user.count();

    console.log(`📊 Users total              : ${totalUsers}`);
    console.log(`📧 Users with email         : ${withEmail}`);
    console.log(`✅ Users with emailVerified : ${withEmailVerified}`);
    console.log(`📦 Users with emailBackup   : ${withEmailBackup}`);
    console.log("");

    if (withEmail === 0 && withEmailVerified === 0 && withEmailBackup === 0) {
        console.log("✅ Nothing to purge. Database is already clean.");
        return;
    }

    if (isDryRun) {
        console.log("🔍 DRY-RUN: No changes applied.");
        console.log("   Re-run with --commit to apply the purge:\n");
        console.log("   npx tsx scripts/purge-emails.ts --commit\n");
        return;
    }

    // 2. Nullify email fields for ALL users
    console.log("🧹 Purging email fields...");

    const result = await prisma.user.updateMany({
        where: {
            OR: [
                { email: { not: null } },
                { emailVerified: { not: null } },
                { emailBackup: { not: null } },
            ],
        },
        data: {
            email: null,
            emailVerified: null,
            emailBackup: null,
        },
    });

    console.log(`\n✅ Purge complete! ${result.count} user(s) updated.`);
    console.log("   Fields cleared: email, emailVerified, emailBackup");
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("   RGPD compliance: ✅ No email addresses in DB");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
    .catch((e) => {
        console.error("❌ Error during purge:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
