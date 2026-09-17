"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserContext, type ActionResponse } from "./user-actions";
import { z } from "zod";
import { createAuditLog } from "./audit-actions";
import { differenceInDays } from "date-fns";

// ==========================================
// TYPES
// ==========================================

export interface MemberAltInfo {
    pseudo: string;
    classe?: string;
    level?: number;
}

export interface LifecycleMemberSummary {
    id: string;
    userId: string;
    discordId: string;
    displayName: string;
    pseudoDofus: string | null;
    discordNickname: string | null;
    ankamaId: string | null;
    avatar: string | null;
    status: "ACTIVE" | "ARCHIVED" | "BANNED";
    lifecycleStatus: "CANDIDATE" | "ARRIVING" | "TRIAL" | "CONFIRMED";
    createdAt: string;
    joinedAt: string;
    seniorityDays: number;
    trialEndsAt: string | null;
    trialRemainingDays: number | null;
    recruitedById: string | null;
    recruiterName: string | null;
    recruiterAvatar: string | null;
    mules: MemberAltInfo[];
    muleCount: number;
    departureReason: string | null;
    departureCategory: string | null;
    archivedAt: string | null;
    staffNotes: string | null;
    discordMessageCountWeekly: number;
    discordVoiceTimeWeekly: number;
}

export interface RecruiterLeaderboardEntry {
    recruiterId: string;
    recruiterName: string;
    recruiterAvatar: string | null;
    totalRecruits: number;
    activeRecruits: number;
    confirmedRecruits: number;
    retentionRate: number; // percentage
}

export interface GuildLifecycleConfigData {
    trialEnabled: boolean;
    trialDurationDays: number;
    muleLimitEnabled: boolean;
    maxGuildMules: number;
    recruitmentAlertChannelId: string | null;
    arrivingRoleId: string | null;
    trialRoleId: string | null;
    confirmedRoleId: string | null;
    recruitmentWelcomeTemplate: string | null;
}

export interface GuildLifecycleData {
    config: GuildLifecycleConfigData;
    members: LifecycleMemberSummary[];
    trialMembers: LifecycleMemberSummary[];
    departedMembers: LifecycleMemberSummary[];
    recruiterLeaderboard: RecruiterLeaderboardEntry[];
    totalActiveCount: number;
    totalTrialCount: number;
    totalMulesCount: number;
    mulesAvailableCount: number | null;
    totalDepartedCount: number;
}

// ==========================================
// SCHEMAS
// ==========================================

const updateConfigSchema = z.object({
    trialEnabled: z.boolean(),
    trialDurationDays: z.number().int().min(1).max(90),
    muleLimitEnabled: z.boolean(),
    maxGuildMules: z.number().int().min(0).max(500),
    recruitmentAlertChannelId: z.string().nullable().optional(),
    arrivingRoleId: z.string().nullable().optional(),
    trialRoleId: z.string().nullable().optional(),
    confirmedRoleId: z.string().nullable().optional(),
    recruitmentWelcomeTemplate: z.string().max(2000).nullable().optional(),
});

const updateStatusSchema = z.object({
    profileId: z.string().min(1),
    lifecycleStatus: z.enum(["CANDIDATE", "ARRIVING", "TRIAL", "CONFIRMED"]),
    trialEndsAt: z.string().datetime().nullable().optional(),
    notes: z.string().max(1000).optional(),
});

const departureSchema = z.object({
    profileId: z.string().min(1),
    reason: z.string().min(1, "Veuillez renseigner un motif").max(500),
    category: z.enum(["VOLUNTARY", "INACTIVITY", "BEHAVIOR", "OTHER"]),
    isBan: z.boolean().default(false),
});

const altsSchema = z.object({
    profileId: z.string().min(1),
    alts: z.array(
        z.union([
            z.string().min(1).max(30),
            z.object({
                pseudo: z.string().min(1).max(30),
                classe: z.string().optional(),
                level: z.number().int().min(1).max(200).optional(),
            })
        ])
    ),
});

// ==========================================
// ACTIONS
// ==========================================

/**
 * Récupère l'ensemble des données de cycle de vie de la guilde en une requête optimisée.
 */
export async function getGuildLifecycleData(guildId: string): Promise<ActionResponse<GuildLifecycleData>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    if (!guildId) return { success: false, error: "ID de guilde manquant" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                id: true,
                trialEnabled: true,
                trialDurationDays: true,
                muleLimitEnabled: true,
                maxGuildMules: true,
                recruitmentAlertChannelId: true,
                arrivingRoleId: true,
                trialRoleId: true,
                confirmedRoleId: true,
                recruitmentWelcomeTemplate: true,
            }
        });

        if (!guild) return { success: false, error: "Guilde introuvable" };

        const now = new Date();

        const profiles = await db.userProfile.findMany({
            where: { guildId: guild.id },
            select: {
                id: true,
                userId: true,
                pseudoDofus: true,
                discordNickname: true,
                ankamaId: true,
                status: true,
                lifecycleStatus: true,
                createdAt: true,
                updatedAt: true,
                archivedAt: true,
                departureReason: true,
                departureCategory: true,
                staffNotes: true,
                trialEndsAt: true,
                recruitedById: true,
                altPseudos: true,
                discordMessageCountWeekly: true,
                discordVoiceTimeWeekly: true,
                user: {
                    select: {
                        name: true,
                        image: true,
                        accounts: {
                            where: { provider: "discord" },
                            select: { providerAccountId: true }
                        }
                    }
                },
                recruitedByProfile: {
                    select: {
                        id: true,
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { name: true, image: true } }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        // 1. Transformer les profils
        const mappedMembers: LifecycleMemberSummary[] = profiles.map(p => {
            const discordId = p.user?.accounts?.[0]?.providerAccountId || "";
            const displayName = p.pseudoDofus || p.discordNickname || p.user?.name || "Membre";
            const seniorityDays = differenceInDays(now, p.createdAt);

            let trialRemainingDays: number | null = null;
            if (p.trialEndsAt) {
                trialRemainingDays = differenceInDays(p.trialEndsAt, now);
            }

            // Normaliser les mules
            const rawAlts = Array.isArray(p.altPseudos) ? p.altPseudos : [];
            const mules: MemberAltInfo[] = rawAlts.map((alt: any) => {
                if (typeof alt === "string") return { pseudo: alt };
                if (alt && typeof alt === "object" && alt.pseudo) {
                    return {
                        pseudo: String(alt.pseudo),
                        classe: alt.classe ? String(alt.classe) : undefined,
                        level: typeof alt.level === "number" ? alt.level : undefined
                    };
                }
                return { pseudo: "Inconnu" };
            }).filter(m => m.pseudo && m.pseudo !== "Inconnu");

            const recruiterName = p.recruitedByProfile
                ? (p.recruitedByProfile.pseudoDofus || p.recruitedByProfile.discordNickname || p.recruitedByProfile.user?.name || null)
                : null;
            const recruiterAvatar = p.recruitedByProfile?.user?.image || null;

            return {
                id: p.id,
                userId: p.userId,
                discordId,
                displayName,
                pseudoDofus: p.pseudoDofus,
                discordNickname: p.discordNickname,
                ankamaId: p.ankamaId,
                avatar: p.user?.image || null,
                status: p.status as "ACTIVE" | "ARCHIVED" | "BANNED",
                lifecycleStatus: (p.lifecycleStatus as any) || "CONFIRMED",
                createdAt: p.createdAt.toISOString(),
                joinedAt: p.createdAt.toISOString(),
                seniorityDays: Math.max(0, seniorityDays),
                trialEndsAt: p.trialEndsAt ? p.trialEndsAt.toISOString() : null,
                trialRemainingDays,
                recruitedById: p.recruitedById,
                recruiterName,
                recruiterAvatar,
                mules,
                muleCount: mules.length,
                departureReason: p.departureReason,
                departureCategory: p.departureCategory,
                archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
                staffNotes: p.staffNotes,
                discordMessageCountWeekly: p.discordMessageCountWeekly || 0,
                discordVoiceTimeWeekly: p.discordVoiceTimeWeekly || 0,
            };
        });

        // 2. Séparer les listes
        const activeMembers = mappedMembers.filter(m => m.status === "ACTIVE");
        const trialMembers = mappedMembers.filter(m => m.status === "ACTIVE" && m.lifecycleStatus === "TRIAL");
        const departedMembers = mappedMembers.filter(m => m.status !== "ACTIVE" || m.departureReason !== null);

        // 3. Calculer les statistiques globales de mules
        const totalMulesCount = activeMembers.reduce((acc, m) => acc + m.muleCount, 0);
        const mulesAvailableCount = guild.muleLimitEnabled
            ? Math.max(0, guild.maxGuildMules - totalMulesCount)
            : null;

        // 4. Calculer le classement des recruteurs
        const recruiterMap = new Map<string, {
            recruiterId: string;
            recruiterName: string;
            recruiterAvatar: string | null;
            total: number;
            active: number;
            confirmed: number;
        }>();

        for (const m of mappedMembers) {
            if (!m.recruitedById || !m.recruiterName) continue;
            const existing = recruiterMap.get(m.recruitedById) || {
                recruiterId: m.recruitedById,
                recruiterName: m.recruiterName,
                recruiterAvatar: m.recruiterAvatar,
                total: 0,
                active: 0,
                confirmed: 0,
            };

            existing.total += 1;
            if (m.status === "ACTIVE") {
                existing.active += 1;
                if (m.lifecycleStatus === "CONFIRMED") {
                    existing.confirmed += 1;
                }
            }
            recruiterMap.set(m.recruitedById, existing);
        }

        const recruiterLeaderboard: RecruiterLeaderboardEntry[] = Array.from(recruiterMap.values())
            .map(r => ({
                recruiterId: r.recruiterId,
                recruiterName: r.recruiterName,
                recruiterAvatar: r.recruiterAvatar,
                totalRecruits: r.total,
                activeRecruits: r.active,
                confirmedRecruits: r.confirmed,
                retentionRate: r.total > 0 ? Math.round((r.active / r.total) * 100) : 100,
            }))
            .sort((a, b) => b.totalRecruits - a.totalRecruits);

        return {
            success: true,
            data: {
                config: {
                    trialEnabled: guild.trialEnabled,
                    trialDurationDays: guild.trialDurationDays,
                    muleLimitEnabled: guild.muleLimitEnabled,
                    maxGuildMules: guild.maxGuildMules,
                    recruitmentAlertChannelId: guild.recruitmentAlertChannelId,
                    arrivingRoleId: guild.arrivingRoleId,
                    trialRoleId: guild.trialRoleId,
                    confirmedRoleId: guild.confirmedRoleId,
                    recruitmentWelcomeTemplate: guild.recruitmentWelcomeTemplate,
                },
                members: activeMembers,
                trialMembers,
                departedMembers,
                recruiterLeaderboard,
                totalActiveCount: activeMembers.length,
                totalTrialCount: trialMembers.length,
                totalMulesCount,
                mulesAvailableCount,
                totalDepartedCount: departedMembers.length,
            }
        };

    } catch (err: any) {
        logger.error("[getGuildLifecycleData] Erreur critique:", err);
        return { success: false, error: "Impossible de charger les données des membres" };
    }
}

/**
 * Met à jour le statut du cycle de vie d'un membre (ex: valider essai, passer en essai, etc.).
 */
export async function updateMemberLifecycleStatus(
    guildId: string,
    profileId: string,
    lifecycleStatus: "CANDIDATE" | "ARRIVING" | "TRIAL" | "CONFIRMED",
    options?: { trialEndsAt?: string | null; notes?: string }
): Promise<ActionResponse<{ message: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    const validated = updateStatusSchema.safeParse({ profileId, lifecycleStatus, ...options });
    if (!validated.success) {
        return { success: false, error: validated.error.errors[0]?.message || "Données invalides" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, trialDurationDays: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        let computedTrialEndsAt = options?.trialEndsAt ? new Date(options.trialEndsAt) : undefined;
        if (lifecycleStatus === "TRIAL" && !computedTrialEndsAt) {
            const now = new Date();
            now.setDate(now.getDate() + (guild.trialDurationDays || 14));
            computedTrialEndsAt = now;
        }

        const profile = await db.userProfile.findFirst({
            where: { id: profileId, guildId: guild.id },
            select: { id: true, pseudoDofus: true, discordNickname: true, lifecycleStatus: true }
        });

        if (!profile) return { success: false, error: "Profil membre introuvable" };

        await db.userProfile.update({
            where: { id: profile.id },
            data: {
                lifecycleStatus,
                trialEndsAt: computedTrialEndsAt ?? null,
                ...(options?.notes ? { staffNotes: options.notes } : {})
            }
        });

        const actorId = session.user.id;
        await createAuditLog({
            guildId: guild.id,
            actorUserId: actorId,
            actorName: ctx.name || "Staff",
            action: "SETTINGS_UPDATED",
            targetType: "USER_PROFILE",
            targetId: profile.id,
            oldValue: { status: profile.lifecycleStatus },
            newValue: { status: lifecycleStatus, trialEndsAt: computedTrialEndsAt },
            metadata: {
                memberName: profile.pseudoDofus || profile.discordNickname || "Membre"
            }
        });

        return { success: true, data: { message: "Statut mis à jour avec succès" } };
    } catch (err: any) {
        logger.error("[updateMemberLifecycleStatus] Erreur:", err);
        return { success: false, error: "Erreur lors de la mise à jour du statut" };
    }
}

/**
 * Valide l'essai d'un membre directement (raccourci 1 clic).
 */
export async function validateMemberTrial(guildId: string, profileId: string): Promise<ActionResponse<{ message: string }>> {
    return updateMemberLifecycleStatus(guildId, profileId, "CONFIRMED", { trialEndsAt: null });
}

/**
 * Prolonge la période d'essai d'un membre de X jours.
 */
export async function extendMemberTrial(
    guildId: string,
    profileId: string,
    additionalDays: number = 7
): Promise<ActionResponse<{ message: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findFirst({
            where: { id: profileId, guildId: guild.id },
            select: { id: true, trialEndsAt: true }
        });

        if (!profile) return { success: false, error: "Profil membre introuvable" };

        const baseDate = profile.trialEndsAt && profile.trialEndsAt > new Date()
            ? new Date(profile.trialEndsAt)
            : new Date();
        baseDate.setDate(baseDate.getDate() + additionalDays);

        await db.userProfile.update({
            where: { id: profile.id },
            data: {
                lifecycleStatus: "TRIAL",
                trialEndsAt: baseDate
            }
        });

        return { success: true, data: { message: `Période d'essai prolongée de ${additionalDays} jours` } };
    } catch (err: any) {
        logger.error("[extendMemberTrial] Erreur:", err);
        return { success: false, error: "Erreur lors de la prolongation de l'essai" };
    }
}

/**
 * Enregistre le départ ou le ban d'un membre avec motif archivé.
 */
export async function recordMemberDeparture(
    guildId: string,
    data: { profileId: string; reason: string; category: "VOLUNTARY" | "INACTIVITY" | "BEHAVIOR" | "OTHER"; isBan?: boolean }
): Promise<ActionResponse<{ message: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    const currentUserId: string = session.user.id;

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    const validated = departureSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, error: validated.error.errors[0]?.message || "Motif invalide" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findFirst({
            where: { id: data.profileId, guildId: guild.id },
            select: {
                id: true,
                userId: true,
                pseudoDofus: true,
                discordNickname: true,
                user: {
                    select: {
                        name: true,
                        accounts: {
                            where: { provider: "discord" },
                            select: { providerAccountId: true }
                        }
                    }
                }
            }
        });

        if (!profile) return { success: false, error: "Profil membre introuvable" };

        const targetStatus = data.isBan ? "BANNED" : "ARCHIVED";
        const discordId = profile.user?.accounts?.[0]?.providerAccountId;
        const memberName = profile.pseudoDofus || profile.discordNickname || profile.user?.name || "Membre";

        await db.$transaction(async (tx) => {
            await tx.userProfile.update({
                where: { id: profile.id },
                data: {
                    status: targetStatus,
                    archivedAt: new Date(),
                    departureReason: data.reason,
                    departureCategory: data.category,
                }
            });

            if (data.isBan && discordId) {
                await tx.guildMemberBan.upsert({
                    where: { guildId_discordId: { guildId: guild.id, discordId } },
                    create: {
                        guildId: guild.id,
                        discordId,
                        reason: data.reason,
                        bannedBy: currentUserId,
                        bannedByName: ctx.name || "Admin",
                        memberName,
                    },
                    update: {
                        reason: data.reason,
                        bannedBy: currentUserId,
                        bannedByName: ctx.name || "Admin",
                        memberName,
                        liftedAt: null,
                    }
                });
            }
        });

        await createAuditLog({
            guildId: guild.id,
            actorUserId: currentUserId,
            actorName: ctx.name || "Staff",
            action: data.isBan ? "MEMBER_BANNED" : "PROFILE_ARCHIVED",
            targetType: "USER_PROFILE",
            targetId: profile.id,
            oldValue: { status: "ACTIVE" },
            newValue: { status: targetStatus, reason: data.reason, category: data.category },
            metadata: { memberName }
        });

        return { success: true, data: { message: data.isBan ? "Membre banni et archivé" : "Départ enregistré" } };
    } catch (err: any) {
        logger.error("[recordMemberDeparture] Erreur:", err);
        return { success: false, error: "Erreur lors de l'enregistrement du départ" };
    }
}

/**
 * Réintègre un ancien membre (passe de ARCHIVED/BANNED à ACTIVE).
 */
export async function reintegrateMember(guildId: string, profileId: string): Promise<ActionResponse<{ message: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const profile = await db.userProfile.findFirst({
            where: { id: profileId, guildId: guild.id },
            select: {
                id: true,
                user: {
                    select: {
                        accounts: {
                            where: { provider: "discord" },
                            select: { providerAccountId: true }
                        }
                    }
                }
            }
        });

        if (!profile) return { success: false, error: "Profil membre introuvable" };
        const discordId = profile.user?.accounts?.[0]?.providerAccountId;

        // #4 validé : pas de réintégration SigilOS tant que le ban Discord est actif.
        // Sinon on affiche ACTIVE alors que le mec ne peut même pas revenir sur le serveur.
        if (discordId) {
            try {
                const { fetchGuildBans } = await import("@/server/discord");
                const bans = await fetchGuildBans(guildId);
                if (bans.some((b) => b.user.id === discordId)) {
                    return { success: false, error: "Toujours banni sur Discord — débannis-le d'abord sur Discord avant de le réintégrer." };
                }
            } catch (err) {
                logger.error("[reintegrateMember] Vérification ban Discord impossible:", err);
                return { success: false, error: "Vérification du ban Discord impossible — réessaie plus tard." };
            }
        }

        await db.$transaction(async (tx) => {
            await tx.userProfile.update({
                where: { id: profile.id },
                data: {
                    status: "ACTIVE",
                    lifecycleStatus: "CONFIRMED",
                    archivedAt: null,
                    departureReason: null,
                    departureCategory: null,
                }
            });

            if (discordId) {
                await tx.guildMemberBan.deleteMany({
                    where: { guildId: guild.id, discordId }
                });
            }
        });

        return { success: true, data: { message: "Membre réintégré avec succès" } };
    } catch (err: any) {
        logger.error("[reintegrateMember] Erreur:", err);
        return { success: false, error: "Erreur lors de la réintégration" };
    }
}

/**
 * Modifie le recruteur assigné à un membre.
 */
export async function updateMemberRecruiter(
    guildId: string,
    profileId: string,
    recruiterProfileId: string | null
): Promise<ActionResponse<{ message: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        await db.userProfile.update({
            where: { id: profileId, guildId: guild.id },
            data: { recruitedById: recruiterProfileId }
        });

        return { success: true, data: { message: "Recruteur mis à jour" } };
    } catch (err: any) {
        logger.error("[updateMemberRecruiter] Erreur:", err);
        return { success: false, error: "Erreur lors de l'assignation du recruteur" };
    }
}

/**
 * Met à jour les mules déclarées pour un membre (depuis l'admin ou le profil).
 */
export async function updateMemberAlts(
    guildId: string,
    profileId: string,
    alts: Array<{ pseudo: string; classe?: string; level?: number } | string>
): Promise<ActionResponse<{ message: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    const validated = altsSchema.safeParse({ profileId, alts });
    if (!validated.success) {
        return { success: false, error: validated.error.errors[0]?.message || "Format des mules invalide" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        await db.userProfile.update({
            where: { id: profileId, guildId: guild.id },
            data: { altPseudos: alts as any }
        });

        return { success: true, data: { message: "Mules mises à jour" } };
    } catch (err: any) {
        logger.error("[updateMemberAlts] Erreur:", err);
        return { success: false, error: "Erreur lors de la mise à jour des mules" };
    }
}

/**
 * Met à jour les notes privées du staff sur un membre.
 */
export async function updateMemberStaffNotes(
    guildId: string,
    profileId: string,
    staffNotes: string
): Promise<ActionResponse<{ message: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        await db.userProfile.update({
            where: { id: profileId, guildId: guild.id },
            data: { staffNotes: staffNotes.slice(0, 2000) }
        });

        return { success: true, data: { message: "Notes enregistrées" } };
    } catch (err: any) {
        logger.error("[updateMemberStaffNotes] Erreur:", err);
        return { success: false, error: "Erreur lors de la mise à jour des notes" };
    }
}

/**
 * Met à jour la configuration du cycle de vie et du recrutement pour la guilde.
 */
export async function updateGuildLifecycleConfig(
    guildId: string,
    configData: GuildLifecycleConfigData
): Promise<ActionResponse<{ message: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin) {
        return { success: false, error: "Permission Administrateur requise" };
    }

    const validated = updateConfigSchema.safeParse(configData);
    if (!validated.success) {
        return { success: false, error: validated.error.errors[0]?.message || "Paramètres invalides" };
    }

    try {
        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: {
                trialEnabled: validated.data.trialEnabled,
                trialDurationDays: validated.data.trialDurationDays,
                muleLimitEnabled: validated.data.muleLimitEnabled,
                maxGuildMules: validated.data.maxGuildMules,
                recruitmentAlertChannelId: validated.data.recruitmentAlertChannelId || null,
                arrivingRoleId: validated.data.arrivingRoleId || null,
                trialRoleId: validated.data.trialRoleId || null,
                confirmedRoleId: validated.data.confirmedRoleId || null,
                recruitmentWelcomeTemplate: validated.data.recruitmentWelcomeTemplate || null,
            }
        });

        return { success: true, data: { message: "Configuration du recrutement enregistrée" } };
    } catch (err: any) {
        logger.error("[updateGuildLifecycleConfig] Erreur:", err);
        return { success: false, error: "Erreur lors de la sauvegarde des paramètres" };
    }
}
