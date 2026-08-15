"use server";

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendChannelMessage, validateChannelBelongsToGuild } from "@/server/discord";

/**
 * Chantier #71 (résiduel) — rappel automatique des prêts non clos.
 *
 * Appelé par la route cron `src/app/api/cron/loan-reminders/route.ts`
 * (crontab VPS, protégé par `x-cron-secret`).
 *
 * - Cible : prêts ACTIFS dont l'échéance est dépassée OU arrive dans < 24h.
 * - Idempotence : `lastReminderAt` (max 1 rappel / 24h par prêt) — jamais de re-ping.
 * - Canal : `loansNotifyChannelId` de la guilde (validé appartenance guild).
 * - Ping Discord de l'emprunteur ET du prêteur (mention, pas de MP privé).
 * - Non bloquant : un échec Discord n'interrompt pas les autres guildes.
 */

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 rappel max / 24h par prêt
const REMINDER_LEAD_TIME_MS = 24 * 60 * 60 * 1000; // rappeler si échéance < 24h ou dépassée

async function getDiscordId(userId: string): Promise<string | null> {
    const account = await db.account.findFirst({
        where: { userId, provider: "discord" },
        select: { providerAccountId: true },
    });
    return account?.providerAccountId ?? null;
}

export async function sendLoanReminders(): Promise<{ total: number; reminded: number; failed: number; errors: string[] }> {
    const results = { total: 0, reminded: 0, failed: 0, errors: [] as string[] };
    const now = new Date();
    const soon = new Date(now.getTime() + REMINDER_LEAD_TIME_MS);
    const cooldownThreshold = new Date(now.getTime() - REMINDER_COOLDOWN_MS);

    const loans = await db.guildLoan.findMany({
        where: {
            status: "ACTIVE",
            dueDate: { lte: soon },
            OR: [
                { lastReminderAt: null },
                { lastReminderAt: { lt: cooldownThreshold } },
            ],
        },
        include: {
            guild: { select: { discordGuildId: true, loansNotifyChannelId: true, name: true } },
            borrower: { select: { userId: true, pseudoDofus: true, discordNickname: true } },
            lender: { select: { userId: true, pseudoDofus: true, discordNickname: true } },
        },
    });

    results.total = loans.length;

    for (const loan of loans) {
        try {
            const channelId = loan.guild.loansNotifyChannelId;
            if (!channelId) {
                // Aucun canal de prêts configuré → on ne marque pas lastReminderAt,
                // on retentera quand le canal sera configuré (pas de ping perdu).
                continue;
            }

            const valid = await validateChannelBelongsToGuild(channelId, loan.guild.discordGuildId);
            if (!valid) continue;

            const lenderDiscordId = await getDiscordId(loan.lender.userId);
            const borrowerDiscordId = await getDiscordId(loan.borrower.userId);
            const lenderName = loan.lender.pseudoDofus || loan.lender.discordNickname || "Prêteur";
            const borrowerName = loan.borrower.pseudoDofus || loan.borrower.discordNickname || "Emprunteur";
            const lenderMention = lenderDiscordId ? `<@${lenderDiscordId}>` : lenderName;
            const borrowerMention = borrowerDiscordId ? `<@${borrowerDiscordId}>` : borrowerName;

            const isOverdue = loan.dueDate && loan.dueDate.getTime() < now.getTime();
            const dueLabel = loan.dueDate ? new Date(loan.dueDate).toLocaleDateString("fr-FR") : "proche";
            const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr"}/dashboard/${loan.guild.discordGuildId}/services?tab=prets`;

            await sendChannelMessage(
                channelId,
                "",
                {
                    embedTitle: isOverdue
                        ? `⏰ Prêt en retard — ${loan.description}`
                        : `⏳ Prêt à échéance proche — ${loan.description}`,
                    embedColor: isOverdue ? 0xef4444 : 0xf59e0b,
                    embedFooter: "SigilOS • Rappel automatique des prêts",
                    fields: [
                        { name: "📝 Description", value: loan.description, inline: false },
                        { name: "📅 Échéance", value: dueLabel, inline: true },
                        { name: "📎 Prêteur", value: lenderMention, inline: true },
                        { name: "🏦 Emprunteur", value: borrowerMention, inline: true },
                        { name: "🔗 Voir sur le dashboard", value: `[Ouvrir SigilOS](${dashboardUrl})`, inline: false },
                    ],
                }
            );

            await db.guildLoan.update({
                where: { id: loan.id },
                data: { lastReminderAt: new Date() },
            });
            results.reminded++;
        } catch (err) {
            results.failed++;
            results.errors.push(`${loan.guild.name}: ${(err as Error).message}`);
            logger.error("[LoanReminder] Failed", { error: (err as Error).message, loanId: loan.id });
        }
    }

    return results;
}