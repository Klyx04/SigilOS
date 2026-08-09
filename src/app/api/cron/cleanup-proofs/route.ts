import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { sendChannelMessage } from "@/server/discord";
import { logger } from "@/lib/logger";
import { getDisplayName } from "@/lib/display-name";

// ---------------------------------------------------------------------------
// CLEANUP: supprime les screenshots de preuve
//  - Prêts/Coffre : après 7 jours
//  - Missions / Succès / Kamas PENDING : après 24h (auto-suppression si non validé)
// Route sécurisée par CRON_SECRET (appelée par le cron nightly du serveur)
//
// Appel depuis maintenance.sh (crontab 4h00):
//   curl -s -X POST https://sigilos.fr/api/cron/cleanup-proofs \
//     -H "Authorization: Bearer $CRON_SECRET"
// ---------------------------------------------------------------------------

const UPLOAD_BASE_DIR = path.join(process.cwd(), "public", "uploads", "guilds");
const PROOF_EXPIRY_DAYS = 7;
const PENDING_EXPIRY_HOURS = 24;

// Safely delete a local file from /uploads/guilds/{guildId}/proofs/{filename}
async function deleteLocalProof(proofUrl: string, internalGuildId: string): Promise<boolean> {
    try {
        const expectedPrefix = `/uploads/guilds/${internalGuildId}/proofs/`;
        if (!proofUrl.startsWith(expectedPrefix)) return false;

        const filename = proofUrl.slice(expectedPrefix.length);
        // Security: only allow UUID.webp filenames
        if (!/^[a-f0-9-]{36}\.webp$/.test(filename)) return false;

        const filePath = path.join(UPLOAD_BASE_DIR, internalGuildId, "proofs", filename);
        const normalizedPath = path.normalize(filePath);
        const expectedBase = path.normalize(path.join(UPLOAD_BASE_DIR, internalGuildId, "proofs"));
        if (!normalizedPath.startsWith(expectedBase)) return false;

        if (existsSync(filePath)) {
            await unlink(filePath);
        }
        return true;
    } catch {
        return false;
    }
}

// Safely delete a mission/achievement proof from /uploads/proofs/{discordGuildId}/{filename}
async function deleteMissionProof(proofUrl: string): Promise<boolean> {
    try {
        if (!proofUrl.startsWith("/uploads/proofs/")) return false;
        const parts = proofUrl.replace("/uploads/proofs/", "").split("/");
        if (parts.length !== 2) return false;
        const [discordGuildId, filename] = parts;
        // Security: only safe filename chars
        if (!/^[a-f0-9-]{36}\.webp$/.test(filename)) return false;
        if (!/^\d{17,20}$/.test(discordGuildId)) return false;

        const filePath = path.join(process.cwd(), "public", "uploads", "proofs", discordGuildId, filename);
        const safeBase = path.join(process.cwd(), "public", "uploads", "proofs", discordGuildId);
        if (!path.normalize(filePath).startsWith(path.normalize(safeBase))) return false;

        if (existsSync(filePath)) await unlink(filePath);
        return true;
    } catch {
        return false;
    }
}

// Get Discord user ID from NextAuth account
async function getDiscordId(userId: string): Promise<string | null> {
    const account = await db.account.findFirst({
        where: { userId, provider: "discord" },
        select: { providerAccountId: true },
    });
    return account?.providerAccountId ?? null;
}

export async function POST(request: NextRequest) {
    // Security: validate cron secret
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        logger.error("[cleanup-proofs] CRON_SECRET not configured");
        return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        logger.warn("[cleanup-proofs] Unauthorized cron attempt");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - PROOF_EXPIRY_DAYS);

    const stats = {
        loansProcessed: 0,
        vaultProcessed: 0,
        filesDeleted: 0,
        notificationsSent: 0,
        errors: [] as string[],
    };

    // ---------------------------------------------------------------------------
    // 1. LOANS — proofUrl et returnProofUrl expirés
    // ---------------------------------------------------------------------------
    try {
        const expiredLoans = await db.guildLoan.findMany({
            where: {
                lentAt: { lt: cutoff },
                proofUrl: { not: null },
            },
            select: {
                id: true,
                proofUrl: true,
                returnProofUrl: true,
                description: true,
                guildId: true,
                guild: {
                    select: {
                        discordGuildId: true,
                        loansNotifyChannelId: true,
                    },
                },
                lender: {
                    select: {
                        userId: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true } },
                    },
                },
                borrower: {
                    select: {
                        userId: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true } },
                    },
                },
            },
        });

        for (const loan of expiredLoans) {
            stats.loansProcessed++;
            const urlsToDelete = [loan.proofUrl, loan.returnProofUrl].filter(Boolean) as string[];

            try {
                // Delete files
                for (const url of urlsToDelete) {
                    const deleted = await deleteLocalProof(url, loan.guildId);
                    if (deleted) stats.filesDeleted++;
                }

                // Clear URLs in DB
                await db.guildLoan.update({
                    where: { id: loan.id },
                    data: { proofUrl: null, returnProofUrl: null },
                });

                // Discord ping notification
                if (loan.guild.loansNotifyChannelId) {
                    const lenderDiscordId = await getDiscordId(loan.lender.userId);
                    const borrowerDiscordId = await getDiscordId(loan.borrower.userId);

                    const lenderName = getDisplayName(loan.lender) || "Prêteur";
                    const borrowerName = getDisplayName(loan.borrower);

                    const mentions = [
                        lenderDiscordId ? `<@${lenderDiscordId}>` : lenderName,
                        borrowerDiscordId ? `<@${borrowerDiscordId}>` : borrowerName,
                    ].join(" ");

                    await sendChannelMessage(
                        loan.guild.loansNotifyChannelId,
                        mentions,
                        {
                            embedTitle: "🗑️ Screenshot de preuve expiré",
                            embedColor: 0x71717a, // zinc
                            embedFooter: "SigilOS • Rétention 7 jours",
                            fields: [
                                { name: "📋 Prêt", value: loan.description, inline: false },
                                { name: "📎 Prêteur", value: lenderName, inline: true },
                                { name: "🏦 Emprunteur", value: borrowerName, inline: true },
                                { name: "⏰ Info", value: `Le screenshot a été automatiquement supprimé après ${PROOF_EXPIRY_DAYS} jours. Si un litige subsiste, contactez un admin.`, inline: false },
                            ],
                        }
                    );
                    stats.notificationsSent++;
                }
            } catch (err) {
                stats.errors.push(`Loan ${loan.id}: ${err}`);
            }
        }
    } catch (err) {
        stats.errors.push(`Loans batch error: ${err}`);
    }

    // ---------------------------------------------------------------------------
    // 2. VAULT — proofUrl expirés
    // ---------------------------------------------------------------------------
    try {
        const expiredVault = await db.vaultEntry.findMany({
            where: {
                createdAt: { lt: cutoff },
                proofUrl: { not: null },
            },
            select: {
                id: true,
                proofUrl: true,
                itemName: true,
                action: true,
                guildId: true,
                guild: {
                    select: {
                        discordGuildId: true,
                        loansNotifyChannelId: true,
                    },
                },
                profile: {
                    select: {
                        userId: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true } },
                    },
                },
            },
        });

        for (const entry of expiredVault) {
            stats.vaultProcessed++;
            try {
                if (entry.proofUrl) {
                    const deleted = await deleteLocalProof(entry.proofUrl, entry.guildId);
                    if (deleted) stats.filesDeleted++;
                }

                await db.vaultEntry.update({
                    where: { id: entry.id },
                    data: { proofUrl: null },
                });

                // Discord ping notification
                if (entry.guild.loansNotifyChannelId) {
                    const memberDiscordId = await getDiscordId(entry.profile.userId);
                    const memberName = getDisplayName(entry.profile);
                    const mention = memberDiscordId ? `<@${memberDiscordId}>` : memberName;
                    const actionLabel = entry.action === "DEPOSIT" ? "Dépôt" : "Retrait";

                    await sendChannelMessage(
                        entry.guild.loansNotifyChannelId,
                        mention,
                        {
                            embedTitle: "🗑️ Screenshot coffre expiré",
                            embedColor: 0x71717a,
                            embedFooter: "SigilOS • Rétention 7 jours",
                            fields: [
                                { name: "📦 Item", value: entry.itemName, inline: true },
                                { name: "⚡ Action", value: actionLabel, inline: true },
                                { name: "👤 Membre", value: memberName, inline: true },
                                { name: "⏰ Info", value: `Screenshot supprimé automatiquement après ${PROOF_EXPIRY_DAYS} jours.`, inline: false },
                            ],
                        }
                    );
                    stats.notificationsSent++;
                }
            } catch (err) {
                stats.errors.push(`VaultEntry ${entry.id}: ${err}`);
            }
        }
    } catch (err) {
        stats.errors.push(`Vault batch error: ${err}`);
    }

    // ---------------------------------------------------------------------------
    // 3. LOANS ARCHIVÉS — suppression hard après 30 jours
    //    Cible : status RETURNED ou CANCELLED avec returnedAt (ou lentAt) > 30j
    // ---------------------------------------------------------------------------
    const ARCHIVE_EXPIRY_DAYS = 30;
    const archiveCutoff = new Date();
    archiveCutoff.setDate(archiveCutoff.getDate() - ARCHIVE_EXPIRY_DAYS);

    const extraStats = { loansDeleted: 0, archiveNotifsSent: 0 };

    try {
        const expiredArchivedLoans = await db.guildLoan.findMany({
            where: {
                status: { in: ["RETURNED", "CANCELLED"] },
                OR: [
                    { returnedAt: { lt: archiveCutoff } },
                    { lentAt: { lt: archiveCutoff }, returnedAt: null },
                ],
            },
            select: {
                id: true,
                description: true,
                status: true,
                proofUrl: true,
                returnProofUrl: true,
                guildId: true,
                guild: {
                    select: {
                        discordGuildId: true,
                        loansNotifyChannelId: true,
                    },
                },
                lender: {
                    select: {
                        userId: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true } },
                    },
                },
                borrower: {
                    select: {
                        userId: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true } },
                    },
                },
            },
        });

        for (const loan of expiredArchivedLoans) {
            try {
                // 1. Cleanup fichiers physiques résiduels
                const residualUrls = [loan.proofUrl, loan.returnProofUrl].filter(Boolean) as string[];
                for (const url of residualUrls) {
                    const deleted = await deleteLocalProof(url, loan.guildId);
                    if (deleted) stats.filesDeleted++;
                }

                // 2. Suppression hard en DB
                await db.guildLoan.delete({ where: { id: loan.id } });
                extraStats.loansDeleted++;

                // 3. Ping Discord optionnel (non-bloquant)
                if (loan.guild.loansNotifyChannelId) {
                    const lenderName = getDisplayName(loan.lender) || "Prêteur";
                    const borrowerName = getDisplayName(loan.borrower);
                    const lenderDiscordId = await getDiscordId(loan.lender.userId).catch(() => null);
                    const borrowerDiscordId = await getDiscordId(loan.borrower.userId).catch(() => null);
                    const mentions = [
                        lenderDiscordId ? `<@${lenderDiscordId}>` : lenderName,
                        borrowerDiscordId ? `<@${borrowerDiscordId}>` : borrowerName,
                    ].join(" ");

                    await sendChannelMessage(
                        loan.guild.loansNotifyChannelId,
                        mentions,
                        {
                            embedTitle: "🗂️ Prêt archivé supprimé",
                            embedColor: 0x52525b,
                            embedFooter: `SigilOS • Rétention archives ${ARCHIVE_EXPIRY_DAYS} jours`,
                            fields: [
                                { name: "📋 Prêt", value: loan.description, inline: false },
                                { name: "📎 Prêteur", value: lenderName, inline: true },
                                { name: "🏦 Emprunteur", value: borrowerName, inline: true },
                                { name: "✅ Statut", value: loan.status === "RETURNED" ? "Rendu" : "Annulé", inline: true },
                                { name: "ℹ️ Info", value: `Ce prêt a été purgé automatiquement après ${ARCHIVE_EXPIRY_DAYS} jours d'archivage.`, inline: false },
                            ],
                        }
                    ).catch(() => { }); // Non-bloquant
                    extraStats.archiveNotifsSent++;
                }
            } catch (err) {
                stats.errors.push(`ArchiveLoan ${loan.id}: ${err}`);
            }
        }
    } catch (err) {
        stats.errors.push(`Archive loans batch error: ${err}`);
    }

    // ---------------------------------------------------------------------------
    // 4. KAMA DONATIONS — auto-suppress PENDING donations after 24h
    // ---------------------------------------------------------------------------
    const kamaCutoff = new Date();
    kamaCutoff.setHours(kamaCutoff.getHours() - PENDING_EXPIRY_HOURS);

    const kamaStats = { kamaExpired: 0 };

    try {
        const kamaDb = db as any;

        const expiredKamaDonations = await kamaDb.kamaDonation.findMany({
            where: { status: "PENDING", createdAt: { lt: kamaCutoff } },
            select: {
                id: true, proofUrl: true, guildId: true,
                profile: { select: { userId: true, pseudoDofus: true, discordNickname: true, user: { select: { name: true } } } },
            },
        });

        for (const donation of expiredKamaDonations) {
            try {
                if (donation.proofUrl) { await deleteLocalProof(donation.proofUrl, donation.guildId); stats.filesDeleted++; }
                await (db as any).imageHash.deleteMany({ where: { guildId: donation.guildId, sourceType: "KAMA_DONATION", sourceId: donation.id } });
                await kamaDb.kamaDonation.delete({ where: { id: donation.id } });
                kamaStats.kamaExpired++;
            } catch (err) { stats.errors.push(`KamaDonation ${donation.id}: ${err}`); }
        }
    } catch (err) { stats.errors.push(`Kama donations batch error: ${err}`); }

    // ---------------------------------------------------------------------------
    // 5. MISSION SUBMISSIONS — auto-suppress PENDING after 24h
    // ---------------------------------------------------------------------------
    const missionStats = { missionsExpired: 0 };

    try {
        const expiredSubmissions = await db.submission.findMany({
            where: { status: "PENDING", createdAt: { lt: kamaCutoff } },
            select: { id: true, proofUrl: true },
        });

        for (const sub of expiredSubmissions) {
            try {
                if (sub.proofUrl) { await deleteMissionProof(sub.proofUrl); stats.filesDeleted++; }
                await (db as any).imageHash.deleteMany({ where: { sourceType: "MISSION", sourceId: sub.id } });
                await db.submission.delete({ where: { id: sub.id } });
                missionStats.missionsExpired++;
            } catch (err) { stats.errors.push(`Submission ${sub.id}: ${err}`); }
        }
    } catch (err) { stats.errors.push(`Mission submissions batch error: ${err}`); }

    // ---------------------------------------------------------------------------
    // 6. ACHIEVEMENT SUBMISSIONS — auto-suppress PENDING after 24h
    // ---------------------------------------------------------------------------
    const achievementStats = { achievementsExpired: 0 };

    try {
        const expiredAchievements = await (db as any).achievementSubmission.findMany({
            where: { status: "PENDING", createdAt: { lt: kamaCutoff } },
            select: { id: true, proofUrl: true, guildId: true },
        });

        for (const sub of expiredAchievements) {
            try {
                if (sub.proofUrl) {
                    // achievementSubmission proofs use /uploads/proofs/{discordGuildId}/ path
                    // or /uploads/guilds/{internalId}/proofs/ — try both
                    const deleted = await deleteMissionProof(sub.proofUrl) || await deleteLocalProof(sub.proofUrl, sub.guildId);
                    if (deleted) stats.filesDeleted++;
                }
                await (db as any).imageHash.deleteMany({ where: { sourceType: "ACHIEVEMENT", sourceId: sub.id } });
                await (db as any).achievementSubmission.delete({ where: { id: sub.id } });
                achievementStats.achievementsExpired++;
            } catch (err) { stats.errors.push(`Achievement ${sub.id}: ${err}`); }
        }
    } catch (err) { stats.errors.push(`Achievement submissions batch error: ${err}`); }

    logger.info("[cleanup-proofs] Done", { stats: { ...stats, ...extraStats, ...kamaStats, ...missionStats, ...achievementStats } });
    return NextResponse.json({ success: true, ...stats, ...extraStats, ...kamaStats, ...missionStats, ...achievementStats });
}
