import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { sendChannelMessage } from "@/server/discord";
import { logger } from "@/lib/logger";
import { getDisplayName } from "@/lib/display-name";
import { deleteProofFile } from "@/lib/storage-utils";

// ---------------------------------------------------------------------------
// CLEANUP: supprime les screenshots de preuve
//  - Prêts/Coffre : après 7 jours
//  - Missions / Succès / Kamas PENDING : après 24h (auto-suppression si non validé)
// Route sécurisée par CRON_SECRET (appelée par le cron nightly du serveur)
//
// Appel depuis maintenance.sh (crontab 4h00):
//   curl -s -X POST https://sigilos.fr/api/cron/cleanup-proofs \
//     -H "Authorization: Bearer $CRON_SECRET"
//
// F-17 (17/08) : les uploads vivent désormais dans `private_uploads` avec des URLs
// `/api/storage/...`. Les anciens helpers (`public/uploads` + `/uploads/...`) ne
// supprimaient RIEN → fichiers orphelins à vie sur le VPS. On passe par
// `deleteProofFile` (storage-utils) qui gère `/uploads/` ET `/api/storage/`.
// ---------------------------------------------------------------------------

const PROOF_EXPIRY_DAYS = 7;
const PENDING_EXPIRY_HOURS = 24;

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
                discordChannelId: true,
                discordMessageId: true,
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
                // #201 — supprimer l'embed Discord avant les fichiers (sinon image noire)
                if (loan.discordChannelId && loan.discordMessageId) {
                    try {
                        const { deleteChannelMessage } = await import("@/server/discord");
                        await deleteChannelMessage(loan.discordChannelId, loan.discordMessageId);
                    } catch (discordErr) {
                        stats.errors.push(`Loan ${loan.id} embed delete: ${discordErr}`);
                    }
                }

                // Delete files (F-17 : deleteProofFile gère les URLs /api/storage/ actuelles)
                for (const url of urlsToDelete) {
                    await deleteProofFile(url);
                    stats.filesDeleted++;
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
                discordChannelId: true,
                discordMessageId: true,
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
                // #201 — supprimer l'embed Discord avant le fichier (sinon image noire)
                if (entry.discordChannelId && entry.discordMessageId) {
                    try {
                        const { deleteChannelMessage } = await import("@/server/discord");
                        await deleteChannelMessage(entry.discordChannelId, entry.discordMessageId);
                    } catch (discordErr) {
                        stats.errors.push(`VaultEntry ${entry.id} embed delete: ${discordErr}`);
                    }
                }

                if (entry.proofUrl) {
                    await deleteProofFile(entry.proofUrl);
                    stats.filesDeleted++;
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

    const extraStats = { loansDeleted: 0, archiveNotifsSent: 0, remindersSent: 0 };

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
                discordChannelId: true,
                discordMessageId: true,
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
                // #201 — supprimer l'embed Discord résiduel avant le hard delete (sinon image noire)
                if (loan.discordChannelId && loan.discordMessageId) {
                    try {
                        const { deleteChannelMessage } = await import("@/server/discord");
                        await deleteChannelMessage(loan.discordChannelId, loan.discordMessageId);
                    } catch (discordErr) {
                        stats.errors.push(`ArchiveLoan ${loan.id} embed delete: ${discordErr}`);
                    }
                }

                // 1. Cleanup fichiers physiques résiduels (F-17)
                const residualUrls = [loan.proofUrl, loan.returnProofUrl].filter(Boolean) as string[];
                for (const url of residualUrls) {
                    await deleteProofFile(url);
                    stats.filesDeleted++;
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
                if (donation.proofUrl) { await deleteProofFile(donation.proofUrl); stats.filesDeleted++; }
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
                if (sub.proofUrl) { await deleteProofFile(sub.proofUrl); stats.filesDeleted++; }
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
                    // achievementSubmission proofs utilisent /api/storage/ (F-17)
                    await deleteProofFile(sub.proofUrl);
                    stats.filesDeleted++;
                }
                await (db as any).imageHash.deleteMany({ where: { sourceType: "ACHIEVEMENT", sourceId: sub.id } });
                await (db as any).achievementSubmission.delete({ where: { id: sub.id } });
                achievementStats.achievementsExpired++;
            } catch (err) { stats.errors.push(`Achievement ${sub.id}: ${err}`); }
        }
    } catch (err) { stats.errors.push(`Achievement submissions batch error: ${err}`); }

    // ---------------------------------------------------------------------------
    // 7. LOAN REMINDERS — rappels prêts non clos (#71)
    //    Déclenchés avec le nettoyage nocturne (aucune ligne crontab à ajouter),
    //    idempotent via lastReminderAt (max 1 rappel / 24h par prêt).
    //    Une route dédiée `/api/cron/loan-reminders` existe aussi pour un créneau
    //    matinal optionnel.
    // ---------------------------------------------------------------------------
    try {
        const { sendLoanReminders } = await import("@/server/actions/loan-reminder-actions");
        const reminderSummary = await sendLoanReminders();
        extraStats.remindersSent = reminderSummary.reminded;
        if (reminderSummary.failed > 0) {
            stats.errors.push(`LoanReminders: ${reminderSummary.errors.join("; ")}`);
        }
    } catch (err) {
        stats.errors.push(`LoanReminders batch error: ${err}`);
    }

    logger.info("[cleanup-proofs] Done", { stats: { ...stats, ...extraStats, ...kamaStats, ...missionStats, ...achievementStats } });
    return NextResponse.json({ success: true, ...stats, ...extraStats, ...kamaStats, ...missionStats, ...achievementStats });
}
