"use server";

import { db } from "@/lib/prisma";
import { getUserContext, checkGuildPermission, type ActionResponse } from "./user-actions";
import { auth } from "@/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { PrismaClient } from "@prisma/client";
import {
    KAMA_TRANCHE,
    KAMA_MAX_TRANCHES,
    KAMA_MAX_PER_WEEK,
    REWARDS_PER_TRANCHE
} from "@/lib/kama-constants";
import { getDofusWeek } from "@/lib/date-utils";
import { grantRewards } from "./mission-actions";
import { hashImage } from "@/lib/llm-ocr";
import { getDiscordPublicUrl } from "@/lib/storage-utils";

// Le client etendu ($extends) masque les types TS des modeles, on caste vers PrismaClient
// pour acceder a kamaDonation avec les bons types. En runtime, tout fonctionne correctement.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const kamaDb = db as unknown as PrismaClient;

type KamaDonationStatus = "PENDING" | "VALIDATED" | "REJECTED";

// ============================================================================
// TYPES
// ============================================================================

export type KamaDonationEntry = {
    id: string;
    guildId: string;
    profileId: string;
    amount: number;
    tranches: number;
    proofUrl: string | null;
    status: KamaDonationStatus;
    validatedById: string | null;
    validatedAt: Date | null;
    rejectedReason: string | null;
    note: string | null;
    weekNumber: number | null;
    yearNumber: number | null;
    createdAt: Date;
    profile: {
        id: string;
        pseudoDofus: string | null;
        discordNickname: string | null;
        discordRoleColor: number | null;
        user: { name: string | null; image: string | null };
    };
};

export type KamaWeeklyStatus = {
    submittedThisWeek: number;
    validatedThisWeek: number;
    tranchesLeft: number;
    canContribute: boolean;
    weekDonations: Array<{ id: string; amount: number; status: KamaDonationStatus }>;
};

export type KamaLadderEntry = {
    rank: number;
    profileId: string;
    pseudoDofus: string | null;
    discordNickname: string | null;
    discordRoleColor: number | null;
    discordImage: string | null;
    totalAmount: number;
    donationCount: number;
    isCurrentUser: boolean;
};

export type KamaStats = {
    totalValidated: number;
    totalPending: number;
    donorCount: number;
    weeklyTotal: number;
    weeklyPending: number;
};

// ============================================================================
// SCHEMAS
// ============================================================================

const submitDonationSchema = z.object({
    guildId: z.string().min(1),
    tranches: z.number().int().min(1, "Minimum 1 tranche").max(KAMA_MAX_TRANCHES, `Maximum ${KAMA_MAX_TRANCHES} tranches`),
    note: z.string().max(300).optional().nullable(),
});

const reviewDonationSchema = z.object({
    guildId: z.string().min(1),
    donationId: z.string().min(1),
    action: z.enum(["VALIDATE", "REJECT"]),
    rejectedReason: z.string().max(200).optional().nullable(),
});

// ============================================================================
// HELPER
// ============================================================================
const profileSelect = {
    id: true,
    pseudoDofus: true,
    discordNickname: true,
    discordRoleColor: true,
    user: { select: { name: true, image: true } },
} as const;

// ============================================================================
// GET MY WEEKLY KAMA STATUS
// ============================================================================

export async function getMyWeeklyKamaStatus(
    guildId: string
): Promise<ActionResponse<KamaWeeklyStatus>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const user = await getUserContext(guildId);
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const { week, year } = getDofusWeek();

        const weekDonations: Array<{ id: string; amount: number; status: string }> = await kamaDb.kamaDonation.findMany({
            where: {
                guildId: guildConfig.id,
                profileId: user.profileId,
                weekNumber: week,
                yearNumber: year,
                status: { not: "REJECTED" },
            },
            select: { id: true, amount: true, status: true },
        });

        const submittedThisWeek = weekDonations.reduce((s, d) => s + d.amount, 0);
        const validatedThisWeek = weekDonations
            .filter(d => d.status === "VALIDATED")
            .reduce((s, d) => s + d.amount, 0);

        const tranchesUsed = Math.floor(submittedThisWeek / KAMA_TRANCHE);
        const tranchesLeft = Math.max(0, KAMA_MAX_TRANCHES - tranchesUsed);

        return {
            success: true,
            data: {
                submittedThisWeek,
                validatedThisWeek,
                tranchesLeft,
                canContribute: tranchesLeft > 0,
                weekDonations: weekDonations.map(d => ({
                    id: d.id,
                    amount: d.amount,
                    status: d.status as KamaDonationStatus,
                })),
            },
        };
    } catch (error) {
        logger.error("getMyWeeklyKamaStatus error", { error, guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// SUBMIT DONATION
// ============================================================================

export async function submitKamaDonation(
    input: z.infer<typeof submitDonationSchema>,
    proofFormData: FormData
): Promise<ActionResponse<{ id: string }>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, input.guildId, PERMISSIONS.COMMUNITY_ACCESS);
    if (!guard.allowed) return { success: false, error: guard.error };

    const parsed = submitDonationSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message || "Donnees invalides" };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: input.guildId },
            select: { id: true, kamaNotifyChannelId: true, kamaNotifyRoleId: true } as Record<string, true>,
        }) as { id: string; kamaNotifyChannelId: string | null; kamaNotifyRoleId: string | null } | null;
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const user = await getUserContext(input.guildId);
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const { week, year } = getDofusWeek();

        // Server-side weekly limit check
        const existingWeek = await kamaDb.kamaDonation.aggregate({
            where: {
                guildId: guildConfig.id,
                profileId: user.profileId,
                weekNumber: week,
                yearNumber: year,
                status: { not: "REJECTED" },
            },
            _sum: { amount: true },
        });
        const alreadyThisWeek: number = existingWeek._sum.amount ?? 0;
        const requestedAmount = parsed.data.tranches * KAMA_TRANCHE;

        if (alreadyThisWeek + requestedAmount > KAMA_MAX_PER_WEEK) {
            const remaining = KAMA_MAX_PER_WEEK - alreadyThisWeek;
            const tranchesLeft = Math.floor(remaining / KAMA_TRANCHE);
            return {
                success: false,
                error: `Limite hebdomadaire depassee. Il vous reste ${tranchesLeft} tranche(s) (${remaining.toLocaleString("fr-FR")} kamas max).`,
            };
        }

        // --- ANTI-DUPLICATE IMAGE CHECK ---
        const file = proofFormData.get("file") as File | null;
        if (!file) return { success: false, error: "Aucun fichier fourni" };
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const imageHash = await hashImage(fileBuffer);
        const existingHash = await db.imageHash.findFirst({
            where: { hash: imageHash }
        });
        if (existingHash) {
            return { success: false, error: "Cette image a déjà été utilisée pour une contribution dans cette guilde." };
        }

        // Re-build FormData since we consumed the file
        const rebuiltFormData = new FormData();
        rebuiltFormData.set("file", new File([fileBuffer], file.name, { type: file.type }));

        // Upload proof (required)
        const { uploadProofImage } = await import("./upload-actions");
        const uploadResult = await uploadProofImage(guildConfig.id, rebuiltFormData);
        if (!uploadResult.success || !uploadResult.url) {
            return { success: false, error: uploadResult.error || "Erreur upload screenshot" };
        }

        const donation = await kamaDb.kamaDonation.create({
            data: {
                guildId: guildConfig.id,
                profileId: user.profileId,
                amount: requestedAmount,
                proofUrl: uploadResult.url,
                note: parsed.data.note || null,
                weekNumber: week,
                yearNumber: year,
                status: "PENDING",
            },
        });

        // Store image hash to prevent reuse
        await (db as any).imageHash.create({
            data: {
                guildId: guildConfig.id,
                hash: imageHash,
                sourceType: "KAMA_DONATION",
                sourceId: donation.id,
                uploaderId: session!.user!.id,
            },
        });

        revalidatePath(`/dashboard/${input.guildId}/missions`);
        revalidatePath(`/dashboard/${input.guildId}/ladder`);
        logger.info("KamaDonation submitted", { donationId: donation.id, guildId: input.guildId, amount: requestedAmount });

        // Discord notification
        if (guildConfig.kamaNotifyChannelId) {
            try {
                const { sendChannelMessage } = await import("@/server/discord");
                const profile = await db.userProfile.findFirst({
                    where: { id: user.profileId!, guildId: guildConfig.id },
                    select: { discordNickname: true, pseudoDofus: true, user: { select: { name: true } } },
                });
                const userName = profile?.discordNickname || profile?.pseudoDofus || profile?.user?.name || "Un membre";
                const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/${input.guildId}/admin/validation`;
                const absoluteImageUrl = getDiscordPublicUrl(uploadResult.url);
                const mentionRole = (guildConfig as any).kamaNotifyRoleId;
                const content = mentionRole ? (mentionRole === "everyone" ? "Bonjour @everyone !" : `Bonjour <@&${mentionRole}> !`) : "Bonjour le Staff !";

                const discordMsgId = await sendChannelMessage(guildConfig.kamaNotifyChannelId, content, {
                    embedTitle: "💰 Nouvelle Contribution Kamas",
                    embedDescription: `**${userName}** a soumis un don de **${requestedAmount.toLocaleString("fr-FR")} kamas** (${parsed.data.tranches} tranche${parsed.data.tranches > 1 ? "s" : ""}).`,
                    embedColor: 0xeab308,
                    embedUrl: dashUrl,
                    embedImage: absoluteImageUrl,
                    embedFooter: "SigilOS • Contributions Kamas",
                    components: [
                        {
                            type: 1,
                            components: [
                                { type: 2, style: 3, label: "✅ Valider", custom_id: `validate:kama:${donation.id}:${input.guildId}` },
                                { type: 2, style: 4, label: "❌ Rejeter", custom_id: `validate:kama_reject:${donation.id}:${input.guildId}` },
                            ],
                        },
                    ],
                });

                // Save discordMessageId for later deletion on validation/rejection
                if (discordMsgId) {
                    await kamaDb.kamaDonation.update({
                        where: { id: donation.id },
                        data: { discordMessageId: `${guildConfig.kamaNotifyChannelId}:${discordMsgId}` },
                    });
                }
            } catch (discordError) {
                logger.error("[KamaDonation] Discord Notification Error", { error: discordError });
            }
        }

        return { success: true, data: { id: donation.id } };
    } catch (error) {
        logger.error("submitKamaDonation error", { error, guildId: input.guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// GET DONATIONS (list for admin panel)
// ============================================================================

export async function getKamaDonations(
    guildId: string,
    filters?: { status?: KamaDonationStatus; profileId?: string; week?: number; year?: number; limit?: number }
): Promise<ActionResponse<KamaDonationEntry[]>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const where: Record<string, unknown> = { guildId: guildConfig.id };
        if (filters?.status) where.status = filters.status;
        if (filters?.profileId) where.profileId = filters.profileId;
        if (filters?.week) where.weekNumber = filters.week;
        if (filters?.year) where.yearNumber = filters.year;

        const entries: unknown[] = await kamaDb.kamaDonation.findMany({
            where,
            include: { profile: { select: profileSelect } },
            orderBy: { createdAt: "desc" },
            take: filters?.limit || 50,
        });

        const data = (entries as Array<{ amount: number } & Record<string, unknown>>).map(e => ({
            ...e,
            tranches: Math.round((e.amount as number) / KAMA_TRANCHE),
        })) as KamaDonationEntry[];

        return { success: true, data };
    } catch (error) {
        logger.error("getKamaDonations error", { error, guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// REVIEW (admin)
// ============================================================================

export async function reviewKamaDonation(
    input: z.infer<typeof reviewDonationSchema>
): Promise<ActionResponse> {
    const session = await auth();
    const guard = await checkGuildPermission(session, input.guildId, PERMISSIONS.MISSIONS_OFFICER);
    if (!guard.allowed) return { success: false, error: guard.error };

    const parsed = reviewDonationSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: input.guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const user = await getUserContext(input.guildId);
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const { week, year } = getDofusWeek();
        const donation = await kamaDb.kamaDonation.findFirst({
            where: { id: input.donationId, guildId: guildConfig.id },
            select: { id: true, status: true, discordMessageId: true, proofUrl: true, amount: true, profileId: true, weekNumber: true, yearNumber: true },
        });
        if (!donation) return { success: false, error: "Donation introuvable" };
        if (donation.status !== "PENDING") return { success: false, error: "Cette donation a deja ete traitee" };

        const newStatus = parsed.data.action === "VALIDATE" ? "VALIDATED" : "REJECTED";

        await kamaDb.kamaDonation.update({
            where: { id: donation.id },
            data: {
                status: newStatus,
                validatedById: user.profileId,
                validatedAt: new Date(),
                rejectedReason: parsed.data.action === "REJECT"
                    ? (parsed.data.rejectedReason || "Refuse par un administrateur")
                    : null,
            },
        });

        if (newStatus === "VALIDATED") {
            const tranches = Math.floor(donation.amount / KAMA_TRANCHE);
            const addedXp = tranches * REWARDS_PER_TRANCHE.xp;
            const addedGuildatons = tranches * REWARDS_PER_TRANCHE.guildatons;
            await grantRewards(donation.profileId, addedXp, addedGuildatons, donation.weekNumber || week, donation.yearNumber || year);
        }

        // Delete Discord embed (dashboard validation path)
        if (donation.discordMessageId?.includes(":")) {
            const [channelId, msgId] = donation.discordMessageId.split(":");
            if (channelId && msgId) {
                try {
                    const { deleteChannelMessage } = await import("@/server/discord");
                    await deleteChannelMessage(channelId, msgId);
                } catch (e) {
                    logger.error("[KamaReview] Failed to delete Discord embed", { error: e });
                }
            }
        }

        // Delete proof file and image hash
        if (donation.proofUrl) {
            const { deleteProofFile } = await import("@/lib/storage-utils");
            await deleteProofFile(donation.proofUrl);
            await (db as any).imageHash.deleteMany({
                where: { guildId: guildConfig.id, sourceType: "KAMA_DONATION", sourceId: donation.id },
            });
        }

        revalidatePath(`/dashboard/${input.guildId}/missions`);
        revalidatePath(`/dashboard/${input.guildId}/ladder`);

        // 🔥 Real-time Discord Update
        const { refreshMissionDiscordEmbed } = await import("./mission-actions");
        await refreshMissionDiscordEmbed(input.guildId);

        return { success: true };
    } catch (error) {
        logger.error("reviewKamaDonation error", { error, guildId: input.guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// KAMA LADDER
// ============================================================================

export async function getKamaLadder(
    guildId: string,
    period: "week" | "month" | "alltime" = "alltime"
): Promise<ActionResponse<KamaLadderEntry[]>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const currentProfile = await db.userProfile.findFirst({
            where: { userId: session!.user!.id!, guildId: guildConfig.id },
            select: { id: true },
        });

        const now = new Date();
        const where: Record<string, unknown> = { guildId: guildConfig.id, status: "VALIDATED" };

        if (period === "week") {
            const { week, year } = getDofusWeek();
            where.weekNumber = week;
            where.yearNumber = year;
        } else if (period === "month") {
            where.createdAt = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
        }

        const donations: Array<{ profileId: string; amount: number; profile: Record<string, unknown> }> = await kamaDb.kamaDonation.findMany({
            where,
            select: { profileId: true, amount: true, profile: { select: profileSelect } },
        });

        const map = new Map<string, { amount: number; count: number; profile: Record<string, unknown> }>();
        for (const d of donations) {
            const existing = map.get(d.profileId);
            if (existing) { existing.amount += d.amount; existing.count += 1; }
            else map.set(d.profileId, { amount: d.amount, count: 1, profile: d.profile });
        }

        const ladder: KamaLadderEntry[] = Array.from(map.entries())
            .sort(([, a], [, b]) => b.amount - a.amount)
            .map(([profileId, { amount, count, profile }], idx) => ({
                rank: idx + 1,
                profileId,
                pseudoDofus: (profile as KamaLadderEntry).pseudoDofus,
                discordNickname: (profile as KamaLadderEntry).discordNickname,
                discordRoleColor: (profile as KamaLadderEntry).discordRoleColor,
                discordImage: ((profile as Record<string, unknown>).user as { image?: string | null })?.image ?? null,
                totalAmount: amount,
                donationCount: count,
                isCurrentUser: profileId === currentProfile?.id,
            }));

        return { success: true, data: ladder };
    } catch (error) {
        logger.error("getKamaLadder error", { error, guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// STATS
// ============================================================================

export async function getKamaStats(guildId: string): Promise<ActionResponse<KamaStats>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const { week, year } = getDofusWeek();

        const [validated, pending, weeklyVal, weeklyPend] = await Promise.all([
            kamaDb.kamaDonation.aggregate({ where: { guildId: guildConfig.id, status: "VALIDATED" }, _sum: { amount: true } }),
            kamaDb.kamaDonation.aggregate({ where: { guildId: guildConfig.id, status: "PENDING" }, _sum: { amount: true } }),
            kamaDb.kamaDonation.aggregate({ where: { guildId: guildConfig.id, status: "VALIDATED", weekNumber: week, yearNumber: year }, _sum: { amount: true } }),
            kamaDb.kamaDonation.aggregate({ where: { guildId: guildConfig.id, status: "PENDING", weekNumber: week, yearNumber: year }, _sum: { amount: true } }),
        ]);

        const donors: unknown[] = await kamaDb.kamaDonation.findMany({
            where: { guildId: guildConfig.id, status: "VALIDATED" },
            select: { profileId: true },
            distinct: ["profileId"],
        });

        return {
            success: true,
            data: {
                totalValidated: validated._sum.amount ?? 0,
                totalPending: pending._sum.amount ?? 0,
                donorCount: donors.length,
                weeklyTotal: weeklyVal._sum.amount ?? 0,
                weeklyPending: weeklyPend._sum.amount ?? 0,
            },
        };
    } catch (error) {
        logger.error("getKamaStats error", { error, guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// WEEKLY KAMA SUMMARY (vue récap semaine — accessible membres + officiers)
// ============================================================================

export type KamaWeeklyMemberSummary = {
    profileId: string;
    pseudoDofus: string | null;
    discordNickname: string | null;
    discordRoleColor: number | null;
    discordImage: string | null;
    totalAmount: number;
    fourWeekAmount: number;
    purpleKamasBalance: number;
    purpleKamasEarned: number;
    purpleKamasConsumed: number;
    tranches: number;
    status: "VALIDATED" | "PENDING" | "MIXED" | "REJECTED";
    hasValidated: boolean;
    hasPending: boolean;
    donationCount: number;
    /** Only populated for MISSIONS_OFFICER / admin */
    proofUrls: string[];
    donations: Array<{
        id: string;
        amount: number;
        status: "PENDING" | "VALIDATED" | "REJECTED";
        createdAt: Date;
    }>;
};

export type KamaWeeklySummaryResult = {
    week: number;
    year: number;
    members: KamaWeeklyMemberSummary[];
    totalValidated: number;
    totalPending: number;
    memberCount: number;
};

export async function getWeeklyKamaSummary(
    guildId: string
): Promise<ActionResponse<KamaWeeklySummaryResult>> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        // Check if viewer is officer/admin (to expose proof URLs)
        const isOfficer = await checkGuildPermission(session, guildId, PERMISSIONS.MISSIONS_OFFICER);

        const { week, year } = getDofusWeek();

        // 4-week window calculation
        const fourWeeksCutoff = new Date();
        fourWeeksCutoff.setDate(fourWeeksCutoff.getDate() - 28);

        // Fetch all validated donations per profile for 4-week cumulative sum and total all-time
        const allValidatedDonations: Array<{ profileId: string; amount: number; createdAt: Date }> = await kamaDb.kamaDonation.findMany({
            where: {
                guildId: guildConfig.id,
                status: "VALIDATED",
            },
            select: { profileId: true, amount: true, createdAt: true },
        });

        // Fetch profiles to get purpleKamasConsumed
        const profilesMap = new Map<string, { purpleKamasConsumed: number }>();
        const profilesList = await db.userProfile.findMany({
            where: { guildId: guildConfig.id },
            select: { id: true, purpleKamasConsumed: true }
        });
        for (const p of profilesList) {
            profilesMap.set(p.id, { purpleKamasConsumed: p.purpleKamasConsumed || 0 });
        }

        // Pre-aggregate 4-week amounts and all-time totals by profileId
        const fourWeekSums = new Map<string, number>();
        const allTimeSums = new Map<string, number>();
        for (const d of allValidatedDonations) {
            allTimeSums.set(d.profileId, (allTimeSums.get(d.profileId) || 0) + d.amount);
            if (new Date(d.createdAt) >= fourWeeksCutoff) {
                fourWeekSums.set(d.profileId, (fourWeekSums.get(d.profileId) || 0) + d.amount);
            }
        }

        const rawDonations: Array<{
            id: string;
            profileId: string;
            amount: number;
            status: string;
            proofUrl: string | null;
            createdAt: Date;
            profile: {
                id: string;
                pseudoDofus: string | null;
                discordNickname: string | null;
                discordRoleColor: number | null;
                user: { name: string | null; image: string | null };
            };
        }> = await kamaDb.kamaDonation.findMany({
            where: {
                guildId: guildConfig.id,
                weekNumber: week,
                yearNumber: year,
                status: { not: "REJECTED" },
            },
            include: { profile: { select: profileSelect } },
            orderBy: { createdAt: "asc" },
        });

        // Group by profileId
        const map = new Map<string, KamaWeeklyMemberSummary>();
        for (const d of rawDonations) {
            const existing = map.get(d.profileId);
            const dStatus = d.status as "PENDING" | "VALIDATED" | "REJECTED";
            const profileMeta = profilesMap.get(d.profileId) || { purpleKamasConsumed: 0 };
            const allTime = allTimeSums.get(d.profileId) || 0;
            const fourWeek = fourWeekSums.get(d.profileId) || 0;
            const purpleKamasEarned = Math.floor(allTime / 1000);
            const purpleKamasConsumed = profileMeta.purpleKamasConsumed;
            const purpleKamasBalance = Math.max(0, purpleKamasEarned - purpleKamasConsumed);

            if (existing) {
                existing.totalAmount += d.amount;
                existing.tranches = Math.round(existing.totalAmount / KAMA_TRANCHE);
                existing.donationCount += 1;
                if (dStatus === "VALIDATED") existing.hasValidated = true;
                if (dStatus === "PENDING") existing.hasPending = true;
                if (isOfficer.allowed && d.proofUrl) existing.proofUrls.push(d.proofUrl);
                existing.donations.push({ id: d.id, amount: d.amount, status: dStatus, createdAt: d.createdAt });
            } else {
                map.set(d.profileId, {
                    profileId: d.profileId,
                    pseudoDofus: d.profile.pseudoDofus,
                    discordNickname: d.profile.discordNickname,
                    discordRoleColor: d.profile.discordRoleColor,
                    discordImage: d.profile.user?.image ?? null,
                    totalAmount: d.amount,
                    fourWeekAmount: fourWeek,
                    purpleKamasEarned,
                    purpleKamasConsumed,
                    purpleKamasBalance,
                    tranches: Math.round(d.amount / KAMA_TRANCHE),
                    status: dStatus === "VALIDATED" ? "VALIDATED" : "PENDING",
                    hasValidated: dStatus === "VALIDATED",
                    hasPending: dStatus === "PENDING",
                    donationCount: 1,
                    proofUrls: isOfficer.allowed && d.proofUrl ? [d.proofUrl] : [],
                    donations: [{ id: d.id, amount: d.amount, status: dStatus, createdAt: d.createdAt }],
                });
            }
        }

        // Also include profiles that have donations in 4-week window or purple kamas balance even if no donation this week
        for (const [profId, fourWeekAmt] of fourWeekSums.entries()) {
            if (!map.has(profId)) {
                const p = profilesList.find(pr => pr.id === profId);
                const profDetails = await db.userProfile.findUnique({
                    where: { id: profId },
                    select: profileSelect
                });
                if (profDetails) {
                    const profileMeta = profilesMap.get(profId) || { purpleKamasConsumed: 0 };
                    const allTime = allTimeSums.get(profId) || 0;
                    const purpleKamasEarned = Math.floor(allTime / 1000);
                    const purpleKamasConsumed = profileMeta.purpleKamasConsumed;
                    const purpleKamasBalance = Math.max(0, purpleKamasEarned - purpleKamasConsumed);

                    map.set(profId, {
                        profileId: profId,
                        pseudoDofus: profDetails.pseudoDofus,
                        discordNickname: profDetails.discordNickname,
                        discordRoleColor: profDetails.discordRoleColor,
                        discordImage: profDetails.user?.image ?? null,
                        totalAmount: 0,
                        fourWeekAmount: fourWeekAmt,
                        purpleKamasEarned,
                        purpleKamasConsumed,
                        purpleKamasBalance,
                        tranches: 0,
                        status: "VALIDATED",
                        hasValidated: true,
                        hasPending: false,
                        donationCount: 0,
                        proofUrls: [],
                        donations: [],
                    });
                }
            }
        }

        // Resolve final status per member
        const members: KamaWeeklyMemberSummary[] = Array.from(map.values())
            .map(m => ({
                ...m,
                status: (m.hasValidated && m.hasPending ? "MIXED" : m.hasValidated ? "VALIDATED" : "PENDING") as KamaWeeklyMemberSummary["status"],
            }))
            .sort((a, b) => b.purpleKamasBalance - a.purpleKamasBalance || b.fourWeekAmount - a.fourWeekAmount);

        const totalValidated = members.reduce((acc, m) => acc + (m.hasValidated ? m.donations.filter(d => d.status === "VALIDATED").reduce((s, d) => s + d.amount, 0) : 0), 0);
        const totalPending = members.reduce((acc, m) => acc + m.donations.filter(d => d.status === "PENDING").reduce((s, d) => s + d.amount, 0), 0);

        return {
            success: true,
            data: {
                week,
                year,
                members,
                totalValidated,
                totalPending,
                memberCount: members.length,
            },
        };
    } catch (error) {
        logger.error("getWeeklyKamaSummary error", { error, guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// DELETE (pending, owner or admin)
// ============================================================================

export async function deleteKamaDonation(
    guildId: string,
    donationId: string
): Promise<ActionResponse> {
    const session = await auth();
    const guard = await checkGuildPermission(session, guildId, PERMISSIONS.COMMUNITY_ACCESS);
    if (!guard.allowed) return { success: false, error: guard.error };

    try {
        const user = await getUserContext(guildId);
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const donation: { id: string; profileId: string; status: string; proofUrl: string | null } | null =
            await kamaDb.kamaDonation.findFirst({
                where: { id: donationId, guildId: guildConfig.id },
                select: { id: true, profileId: true, status: true, proofUrl: true },
            });
        if (!donation) return { success: false, error: "Donation introuvable" };

        const isOwner = donation.profileId === user.profileId;
        if (!isOwner && !user.isAdmin) return { success: false, error: "Acces refuse" };
        if (isOwner && donation.status !== "PENDING") return { success: false, error: "Vous ne pouvez supprimer qu une donation en attente." };

        if (donation.proofUrl) {
            const { deleteProofFile } = await import("@/lib/storage-utils");
            await deleteProofFile(donation.proofUrl);
        }

        // Clean up associated imageHash
        try {
            await (db as any).imageHash.deleteMany({
                where: { guildId: guildConfig.id, sourceType: "KAMA_DONATION", sourceId: donation.id },
            });
        } catch (e) { logger.error("deleteKamaDonation hash cleanup", { e }); }

        await kamaDb.kamaDonation.delete({ where: { id: donation.id } });
        revalidatePath(`/dashboard/${guildId}/missions`);
        revalidatePath(`/dashboard/${guildId}/ladder`);
        return { success: true };
    } catch (error) {
        logger.error("deleteKamaDonation error", { error, guildId });
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================================================
// GET USER RAID ELIGIBILITY (kamas gate for RAID_OFFICIAL)
// Returns the user's validated kamas total for the current Dofus week
// and whether they meet the 30 000 threshold.
// ============================================================================

export async function getUserRaidEligibility(guildId: string): Promise<{
    success: boolean;
    totalDonated?: number;
    isEligible?: boolean;
    weekNumber?: number;
    yearNumber?: number;
    error?: string;
}> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Non authentifié" };

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findFirst({
            where: { userId: session.user.id, guildId: guildConfig.id },
            select: { id: true, purpleKamasConsumed: true },
        });
        if (!profile) return { success: false, error: "Profil introuvable" };

        const { week, year } = getDofusWeek();

        const result = await kamaDb.kamaDonation.aggregate({
            _sum: { amount: true },
            where: {
                profileId: profile.id,
                status: "VALIDATED",
            },
        });

        const totalDonated = result._sum.amount ?? 0;
        const purpleKamasEarned = Math.floor(totalDonated / 1000);
        const purpleKamasBalance = Math.max(0, purpleKamasEarned - (profile.purpleKamasConsumed || 0));

        return {
            success: true,
            totalDonated,
            isEligible: purpleKamasBalance >= 30,
            weekNumber: week,
            yearNumber: year,
        };
    } catch (error) {
        logger.error("getUserRaidEligibility error", { error, guildId });
        return { success: false, error: "Erreur serveur" };
    }
}
