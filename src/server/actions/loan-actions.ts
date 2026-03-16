"use server";

import { db } from "@/lib/prisma";
import { getUserContext, type ActionResponse } from "./user-actions";
import { logServiceActivity } from "./activity-log-actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LoanType, LoanStatus } from "@prisma/client";
import { sendChannelMessage, validateChannelBelongsToGuild } from "@/server/discord";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

async function getDiscordId(userId: string): Promise<string | null> {
    const account = await db.account.findFirst({
        where: { userId, provider: "discord" },
        select: { providerAccountId: true },
    });
    return account?.providerAccountId ?? null;
}

import { LOAN_TYPE_LABELS, LOAN_STATUS_LABELS } from "./services-constants";
import { hashImage } from "@/lib/llm-ocr";

const profileSelect = {
    id: true,
    pseudoDofus: true,
    discordNickname: true,
    userId: true,
    user: { select: { name: true, image: true } },
};

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type LoanWithProfiles = {
    id: string;
    guildId: string;
    type: LoanType;
    status: LoanStatus;
    description: string;
    amount: string | null;
    proofUrl: string | null;
    returnProofUrl: string | null;
    linkedItemName: string | null;
    linkedItemIconUrl: string | null;
    lentAt: Date;
    dueDate: Date | null;
    returnedAt: Date | null;
    notes: string | null;
    lender: {
        id: string;
        pseudoDofus: string | null;
        discordNickname: string | null;
        userId: string;
        user: { name: string | null; image: string | null };
    };
    borrower: {
        id: string;
        pseudoDofus: string | null;
        discordNickname: string | null;
        userId: string;
        user: { name: string | null; image: string | null };
    };
};

// ---------------------------------------------------------------------------
// SCHEMAS
// ---------------------------------------------------------------------------

const createLoanSchema = z.object({
    borrowerProfileId: z.string().min(1, "Sélectionnez un emprunteur"),
    type: z.nativeEnum(LoanType),
    description: z.string().min(3, "Description requise (min 3 car.)").max(200),
    amount: z.string().max(100).optional().nullable(),
    dueDate: z.string().optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    linkedItemName: z.string().max(200).optional().nullable(),
    linkedItemIconUrl: z.string().url().optional().nullable(),
    notifyDiscord: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getLoans(
    guildId: string,
    filters?: { status?: LoanStatus; profileId?: string }
): Promise<ActionResponse<LoanWithProfiles[]>> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember || !user.canViewServices) {
            return { success: false, error: "Accès refusé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const where: any = { guildId: guildConfig.id };

        if (filters?.status) {
            where.status = filters.status;
        }
        if (filters?.profileId) {
            where.OR = [
                { lenderId: filters.profileId },
                { borrowerId: filters.profileId },
            ];
        }

        const loans = await db.guildLoan.findMany({
            where,
            include: {
                lender: { select: profileSelect },
                borrower: { select: profileSelect },
            },
            orderBy: [{ status: "asc" }, { lentAt: "desc" }],
        });

        return { success: true, data: loans as unknown as LoanWithProfiles[] };
    } catch (error) {
        console.error("[getLoans]", error);
        return { success: false, error: "Erreur interne" };
    }
}

export async function createLoan(
    guildId: string,
    input: z.infer<typeof createLoanSchema>,
    proofFormData?: FormData
): Promise<ActionResponse<{ id: string }>> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember || !user.canCreateServices) {
            return { success: false, error: "Accès refusé" };
        }
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const parsed = createLoanSchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
        }

        if (parsed.data.borrowerProfileId === user.profileId) {
            return { success: false, error: "Vous ne pouvez pas vous prêter à vous-même." };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, serviceLoansEnabled: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        if (!guildConfig.serviceLoansEnabled && !user.isAdmin) {
            return { success: false, error: "Le service de prêts est actuellement en maintenance." };
        }

        // Verify borrower belongs to same guild
        const borrower = await db.userProfile.findUnique({
            where: { id: parsed.data.borrowerProfileId },
            select: { guildId: true },
        });
        if (!borrower || borrower.guildId !== guildConfig.id) {
            return { success: false, error: "L'emprunteur ne fait pas partie de cette guilde." };
        }

        // Handle proof upload
        let proofUrl: string | null = null;
        let finalImageHash: string | null = null;

        if (proofFormData) {
            const file = proofFormData.get("file") as File | null;
            if (file) {
                const buffer = Buffer.from(await file.arrayBuffer());
                finalImageHash = await hashImage(buffer);

                const existingHash = await db.imageHash.findFirst({
                    where: { hash: finalImageHash }
                });

                if (existingHash) {
                    return { success: false, error: "Cette image a déjà été utilisée pour une preuve dans l'application." };
                }

                const { uploadProofImage } = await import("./upload-actions");
                const uploadResult = await uploadProofImage(guildConfig.id, proofFormData);
                if (uploadResult.success && uploadResult.url) {
                    proofUrl = uploadResult.url;

                    // Store hash
                    await (db as any).imageHash.create({
                        data: {
                            guildId: guildConfig.id,
                            hash: finalImageHash,
                            sourceType: "LOAN",
                            sourceId: "PENDING", // Temporary
                            uploaderId: user.id!
                        }
                    });
                }
            }
        }

        const loan = await db.guildLoan.create({
            data: {
                guildId: guildConfig.id,
                lenderId: user.profileId,
                borrowerId: parsed.data.borrowerProfileId,
                type: parsed.data.type,
                description: parsed.data.description,
                amount: parsed.data.amount || null,
                proofUrl,
                dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
                notes: parsed.data.notes || null,
                linkedItemName: parsed.data.linkedItemName || null,
                linkedItemIconUrl: parsed.data.linkedItemIconUrl || null,
            },
        });

        // Update image hash with the real sourceId
        if (proofUrl && finalImageHash) {
            await (db as any).imageHash.update({
                where: { hash: finalImageHash },
                data: { sourceId: loan.id }
            });
        }

        // Immutable activity log
        const borrowerProfile = await db.userProfile.findUnique({
            where: { id: parsed.data.borrowerProfileId },
            select: { pseudoDofus: true, discordNickname: true, userId: true, user: { select: { name: true, image: true } } },
        });
        const lenderProfile = await db.userProfile.findUnique({
            where: { id: user.profileId },
            select: { pseudoDofus: true, discordNickname: true, userId: true, user: { select: { name: true, image: true } } },
        });
        const borrowerName = borrowerProfile?.pseudoDofus || borrowerProfile?.discordNickname || borrowerProfile?.user?.name || "Membre";
        const lenderName = lenderProfile?.pseudoDofus || lenderProfile?.discordNickname || lenderProfile?.user?.name || "Membre";

        await logServiceActivity({
            guildId: guildConfig.id,
            actorId: user.profileId,
            module: "LOAN",
            action: "CREATED",
            entityId: loan.id,
            summary: `Prêt créé : ${parsed.data.description} → ${borrowerName}`,
            details: JSON.stringify({ type: parsed.data.type, amount: parsed.data.amount, borrowerId: parsed.data.borrowerProfileId }),
            metadata: proofUrl ? JSON.stringify({ proofUrl }) : undefined,
        });

        // ── Discord Embed ──────────────────────────────────────────────────────
        if (parsed.data.notifyDiscord) {
            try {
                const guildFull = await db.guildConfig.findUnique({
                    where: { id: guildConfig.id },
                    select: { discordGuildId: true, loansNotifyChannelId: true },
                });
                const channelId = guildFull?.loansNotifyChannelId;

                if (channelId) {
                    // SECURITY: Validate channel belongs to this guild
                    const valid = await validateChannelBelongsToGuild(channelId, guildId);
                    if (valid) {
                        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
                        const dashboardUrl = `${appUrl}/dashboard/${guildId}/passages`;
                        // Discord needs an absolute URL for embedImage
                        const publicProofUrl = proofUrl
                            ? (proofUrl.startsWith("http") ? proofUrl : `${appUrl}${proofUrl}`)
                            : undefined;

                        // Discord mentions
                        const lenderDiscordId = await getDiscordId(lenderProfile?.userId || "").catch(() => null);
                        const borrowerDiscordId = await getDiscordId(borrowerProfile?.userId || "").catch(() => null);
                        const lenderMention = lenderDiscordId ? `<@${lenderDiscordId}>` : lenderName;
                        const borrowerMention = borrowerDiscordId ? `<@${borrowerDiscordId}>` : borrowerName;

                        const fields = [
                            { name: "📝 Description", value: parsed.data.description, inline: false },
                            { name: "💰 Montant / Quantité", value: parsed.data.amount || "_Non précisé_", inline: true },
                            { name: "📅 Échéance", value: parsed.data.dueDate ? new Date(parsed.data.dueDate).toLocaleDateString("fr-FR") : "_Aucune_", inline: true },
                            { name: "⚖️ Type", value: LOAN_TYPE_LABELS[parsed.data.type] ?? parsed.data.type, inline: true },
                            { name: "📎 Prêteur", value: lenderMention, inline: true },
                            { name: "🏦 Emprunteur", value: borrowerMention, inline: true },
                        ];

                        if (parsed.data.linkedItemName) {
                            fields.push({ name: "📦 Item lié", value: parsed.data.linkedItemName, inline: true });
                        }
                        fields.push({ name: "🔗 Voir sur le dashboard", value: `[Ouvrir SigilOS](${dashboardUrl})`, inline: false });

                        await sendChannelMessage(
                            channelId,
                            "",
                            {
                                embedTitle: `🤝 Nouveau prêt — ${parsed.data.description}`,
                                embedColor: 0xf59e0b,
                                embedFooter: "SigilOS • Coffre & Prêts",
                                embedThumbnail: parsed.data.linkedItemIconUrl || undefined,
                                embedImage: publicProofUrl,
                                fields,
                            }
                        );
                    } else {
                        console.warn(`[createLoan] Channel ${channelId} invalid for guild ${guildId}, skipping Discord notify`);
                    }
                }
            } catch (discordErr) {
                // Non-blocking: Discord failure must not break the loan creation
                console.error("[createLoan] Discord notify failed:", discordErr);
            }
        }

        revalidatePath(`/dashboard/${guildId}/passages`);
        return { success: true, data: { id: loan.id } };
    } catch (error) {
        console.error("[createLoan]", error);
        return { success: false, error: "Erreur interne" };
    }
}

export async function markLoanReturned(
    guildId: string,
    loanId: string,
    returnProofFormData?: FormData,
    partial?: boolean
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember) {
            return { success: false, error: "Accès refusé" };
        }

        const loan = await db.guildLoan.findUnique({
            where: { id: loanId },
            select: { lenderId: true, borrowerId: true, status: true, guildId: true },
        });
        if (!loan) return { success: false, error: "Prêt introuvable" };
        if (loan.lenderId !== user.profileId && !user.isAdmin) {
            return { success: false, error: "Seul le prêteur ou un admin peut marquer ce prêt comme rendu." };
        }
        if (loan.status === "RETURNED" || loan.status === "CANCELLED") {
            return { success: false, error: "Ce prêt est déjà clos." };
        }

        let returnProofUrl: string | null = null;
        if (returnProofFormData) {
            const file = returnProofFormData.get("file") as File | null;
            if (file) {
                const buffer = Buffer.from(await file.arrayBuffer());
                const imageHash = await hashImage(buffer);

                const existingHash = await db.imageHash.findFirst({
                    where: { hash: imageHash }
                });

                if (existingHash) {
                    return { success: false, error: "Cette image a déjà été utilisée pour une preuve dans l'application." };
                }

                const { uploadProofImage } = await import("./upload-actions");
                const uploadResult = await uploadProofImage(loan.guildId, returnProofFormData);
                if (uploadResult.success && uploadResult.url) {
                    returnProofUrl = uploadResult.url;

                    // Store hash
                    await (db as any).imageHash.create({
                        data: {
                            guildId: loan.guildId,
                            hash: imageHash,
                            sourceType: "LOAN_RETURN",
                            sourceId: loanId,
                            uploaderId: user.id!
                        }
                    });
                }
            }
        }

        await db.guildLoan.update({
            where: { id: loanId },
            data: {
                status: partial ? "PARTIAL" : "RETURNED",
                returnedAt: new Date(),
                ...(returnProofUrl && { returnProofUrl }),
            },
        });

        // Auto-cleanup: si RETURNED (pas PARTIAL), supprimer les screenshots du VPS
        if (!partial) {
            const loanForCleanup = await db.guildLoan.findUnique({
                where: { id: loanId },
                select: { proofUrl: true, returnProofUrl: true, guildId: true },
            });
            if (loanForCleanup) {
                const urlsToDelete = [loanForCleanup.proofUrl, returnProofUrl || loanForCleanup.returnProofUrl].filter(Boolean) as string[];
                const { deleteProofFile } = await import("@/lib/storage-utils");
                for (const url of urlsToDelete) {
                    await deleteProofFile(url);
                }
                // Effacer les URLs en DB immédiatement
                await db.guildLoan.update({
                    where: { id: loanId },
                    data: { proofUrl: null, returnProofUrl: null },
                });
            }
        }

        // Immutable activity log
        if (user.profileId) {
            await logServiceActivity({
                guildId: loan.guildId,
                actorId: user.profileId,
                module: "LOAN",
                action: partial ? "PARTIAL_RETURN" : "RETURNED",
                entityId: loanId,
                summary: `Prêt marqué comme ${partial ? "partiellement rendu" : "rendu"}`,
                metadata: returnProofUrl ? JSON.stringify({ returnProofUrl }) : undefined,
            });
        }

        revalidatePath(`/dashboard/${guildId}/passages`);
        return { success: true };
    } catch (error) {
        console.error("[markLoanReturned]", error);
        return { success: false, error: "Erreur interne" };
    }
}

export async function cancelLoan(
    guildId: string,
    loanId: string
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember) {
            return { success: false, error: "Accès refusé" };
        }

        const loan = await db.guildLoan.findUnique({
            where: { id: loanId },
            select: { lenderId: true, status: true, guildId: true },
        });
        if (!loan) return { success: false, error: "Prêt introuvable" };
        if (loan.lenderId !== user.profileId && !user.isAdmin) {
            return { success: false, error: "Seul le prêteur ou un admin peut annuler ce prêt." };
        }

        // Auto-cleanup: supprimer les screenshots lors de l'annulation
        const loanForCleanup = await db.guildLoan.findUnique({
            where: { id: loanId },
            select: { proofUrl: true, returnProofUrl: true, guildId: true },
        });

        await db.guildLoan.update({
            where: { id: loanId },
            data: { status: "CANCELLED" },
        });

        if (loanForCleanup) {
            const urlsToDelete = [loanForCleanup.proofUrl, loanForCleanup.returnProofUrl].filter(Boolean) as string[];
            const { deleteProofFile } = await import("@/lib/storage-utils");
            for (const url of urlsToDelete) {
                await deleteProofFile(url);
            }
            await db.guildLoan.update({
                where: { id: loanId },
                data: { proofUrl: null, returnProofUrl: null },
            });
        }

        // Immutable activity log
        if (user.profileId) {
            await logServiceActivity({
                guildId: loan.guildId,
                actorId: user.profileId,
                module: "LOAN",
                action: "CANCELLED",
                entityId: loanId,
                summary: `Prêt annulé (par ${user.isAdmin && loan.lenderId !== user.profileId ? "admin" : "le prêteur"})`,
            });
        }

        revalidatePath(`/dashboard/${guildId}/passages`);
        return { success: true };
    } catch (error) {
        console.error("[cancelLoan]", error);
        return { success: false, error: "Erreur interne" };
    }
}
