"use server";

import { logger } from "@/lib/logger";
import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { getUserContext, type ActionResponse } from "./user-actions";
import { z } from "zod";
import { createAuditLog } from "./audit-actions";
import { differenceInDays } from "date-fns";
import {
    ANKAMA_ID_PATTERN,
    MAX_REGISTRY_COMMENTS,
    REGISTRY_COMMENT_MAX_LENGTH,
    canAddRegistryComment,
    computeSeniorityDays,
    getTrialDecision,
    type RegistryComment,
} from "@/lib/member-registry";
// Lot 2 — photo serveur d'une fiche : la fusion est une règle pure (`src/lib/member-roster.ts`).
import type { MemberRosterSnapshot } from "@/lib/member-roster";
import {
    describePresenceProfile,
    resolveDiscordPresenceProfile,
    type DiscordPresenceProfile,
    type PresenceCounters,
} from "@/lib/ladder-presence";

// ==========================================
// TYPES
// ==========================================

export interface MemberAltInfo {
    pseudo: string;
    classe?: string;
    level?: number;
    /** Mule déclarée « en guilde en jeu » (onglet Mules) — optionnel, rétrocompatible. */
    inGameGuild?: boolean;
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
    /** Essai validé (Oui) ou non (Non / Prolongé via trialEndsAt). */
    trialValidated: boolean;
    createdAt: string;
    joinedAt: string;
    /** Date d'arrivée manuelle (registre). Null = repli sur createdAt. */
    guildJoinedAt: string | null;
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
    /** Commentaires du staff, du plus ancien au plus récent (10 max). */
    comments: RegistryComment[];
    discordMessageCountWeekly: number;
    discordVoiceTimeWeekly: number;
    /** Vacances déclarées (édition staff depuis la modale membre). */
    vacationStart: string | null;
    vacationEnd: string | null;
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

const trialStateSchema = z.object({
    validated: z.boolean(),
    trialEndsAt: z.string().datetime().nullable().optional(),
});

const departureSchema = z.object({
    profileId: z.string().min(1),
    reason: z.string().min(1, "Veuillez renseigner un motif").max(500),
    category: z.enum(["VOLUNTARY", "INACTIVITY", "BEHAVIOR", "OTHER"]),
    isBan: z.boolean().default(false),
});

const registryIdentitySchema = z.object({
    pseudoDofus: z.string().max(30).nullable().optional(),
    // Pas de pseudo serveur ici : il se remplit et se met à jour seul depuis Discord.
    ankamaId: z
        .string()
        .max(60)
        .nullable()
        .optional()
        .refine((v) => v === null || v === undefined || v === "" || ANKAMA_ID_PATTERN.test(v.trim()), {
            message: "Tag Ankama invalide (format Nom#0000)",
        }),
    guildJoinedAt: z.string().datetime().nullable().optional(),
});

const registryCommentSchema = z.object({
    body: z.string().trim().min(1, "Commentaire vide").max(REGISTRY_COMMENT_MAX_LENGTH),
});

const altsSchema = z.object({
    alts: z.array(
        z.union([
            z.string().min(1).max(30),
            z.object({
                pseudo: z.string().min(1).max(30),
                classe: z.string().nullable().optional(),
                level: z.number().int().min(1).max(400).nullable().optional(),
                /**
                 * Tag « en guilde en jeu » (onglet Mules). Sans cette clé, le schéma
                 * **supprimait** la coche à chaque enregistrement depuis la modale.
                 */
                inGameGuild: z.boolean().optional(),
            })
        ])
    ),
});

// ==========================================
// SUJET DU REGISTRE — profil dashboard OU membre Discord hors dashboard
// ==========================================

/**
 * Sujet d'une écriture du registre : **soit** un profil dashboard (`profileId`), **soit** un
 * membre Discord sans profil (`discordId`) — jamais les deux, jamais aucun.
 *
 * C'est ce qui rend les « hors dashboard » éditables sans leur fabriquer un compte plateforme
 * (chantier B-2, décision voie ① : table dédiée `MemberRegistryEntry`).
 */
export type RegistrySubject =
    | { profileId: string; discordId?: undefined }
    | { discordId: string; profileId?: undefined };

const subjectSchema = z.union([
    z.object({ profileId: z.string().min(1) }),
    z.object({ discordId: z.string().min(1) }),
]);

type RegistryTarget = { kind: "profile"; profileId: string } | { kind: "discord"; discordId: string };

/** Normalise un sujet validé en cible d'écriture (profil ou ligne de registre Discord). */
function resolveRegistryTarget(subject: RegistrySubject): RegistryTarget {
    if (typeof subject?.profileId === "string" && subject.profileId.length > 0) {
        return { kind: "profile", profileId: subject.profileId };
    }
    return { kind: "discord", discordId: String(subject?.discordId ?? "") };
}

/** Charge la guilde (id interne) ou renvoie `null`. */
async function resolveGuildId(discordGuildId: string): Promise<string | null> {
    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true },
    });
    return guild?.id ?? null;
}

/** Normalise le JSON `altPseudos` en mules exploitables (chaîne historique ou objet). */
function normalizeMules(raw: unknown): MemberAltInfo[] {
    const list = Array.isArray(raw) ? raw : [];
    return list
        .map((alt: unknown): MemberAltInfo | null => {
            if (typeof alt === "string") return { pseudo: alt };
            if (alt && typeof alt === "object" && "pseudo" in alt) {
                const candidate = alt as { pseudo?: unknown; classe?: unknown; level?: unknown; inGameGuild?: unknown };
                return {
                    pseudo: String(candidate.pseudo),
                    classe: candidate.classe ? String(candidate.classe) : undefined,
                    level: typeof candidate.level === "number" ? candidate.level : undefined,
                    // Le tag « en guilde en jeu » vit dans le même JSON : il doit survivre
                    // à toute relecture (sinon le compteur de l'onglet Mules retombe à 0).
                    ...(candidate.inGameGuild === true ? { inGameGuild: true } : {}),
                };
            }
            return null;
        })
        .filter((mule): mule is MemberAltInfo => !!mule && !!mule.pseudo && mule.pseudo !== "Inconnu");
}

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
                trialValidated: true,
                createdAt: true,
                guildJoinedAt: true,
                updatedAt: true,
                archivedAt: true,
                departureReason: true,
                departureCategory: true,
                registryComments: {
                    select: { id: true, body: true, authorName: true, authorUserId: true, createdAt: true },
                    orderBy: { createdAt: "asc" },
                    take: MAX_REGISTRY_COMMENTS,
                },
                trialEndsAt: true,
                recruitedById: true,
                altPseudos: true,
                discordMessageCountWeekly: true,
                discordVoiceTimeWeekly: true,
                vacationStart: true,
                vacationEnd: true,
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
            // Registre : la date d'arrivée manuelle prime, repli sur la création du profil.
            const joinedAtDate = p.guildJoinedAt ?? p.createdAt;
            const seniorityDays = differenceInDays(now, joinedAtDate);

            let trialRemainingDays: number | null = null;
            if (p.trialEndsAt) {
                trialRemainingDays = differenceInDays(p.trialEndsAt, now);
            }

            // Normaliser les mules
            const mules: MemberAltInfo[] = normalizeMules(p.altPseudos);

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
                trialValidated: p.trialValidated ?? false,
                createdAt: p.createdAt.toISOString(),
                joinedAt: joinedAtDate.toISOString(),
                guildJoinedAt: p.guildJoinedAt ? p.guildJoinedAt.toISOString() : null,
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
                comments: p.registryComments.map((c) => ({
                    id: c.id,
                    body: c.body,
                    authorName: c.authorName,
                    authorUserId: c.authorUserId,
                    createdAt: c.createdAt.toISOString(),
                })),
                discordMessageCountWeekly: p.discordMessageCountWeekly || 0,
                discordVoiceTimeWeekly: p.discordVoiceTimeWeekly || 0,
                vacationStart: p.vacationStart ? p.vacationStart.toISOString() : null,
                vacationEnd: p.vacationEnd ? p.vacationEnd.toISOString() : null,
            };
        });

        // 2. Séparer les listes
        const activeMembers = mappedMembers.filter(m => m.status === "ACTIVE");
        const trialMembers = mappedMembers.filter(m => m.status === "ACTIVE" && !m.trialValidated);
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
                if (m.trialValidated) {
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
/** Données du registre saisies pour un membre **sans profil dashboard** (B-2). */
export interface RegistryDiscordEntry {
    pseudoDofus: string | null;
    ankamaId: string | null;
    guildJoinedAt: string | null;
    recruitedById: string | null;
    trialValidated: boolean;
    trialEndsAt: string | null;
    mules: MemberAltInfo[];
    comments: RegistryComment[];
}

/** Un membre **Discord sans profil dashboard** — vu par le bot, éditable via le registre. */
export interface RegistryDiscordOnlyMember {
    discordId: string;
    displayName: string;
    username: string;
    avatar: string | null;
    joinedAt: string | null;
    roles: string[];
    /** Date d'arrivée retenue : saisie du registre si présente, sinon arrivée Discord. */
    joinedAtResolved: string | null;
    seniorityDays: number;
    /** Ligne de registre (null tant que le staff n'a rien saisi). */
    entry: RegistryDiscordEntry | null;
    recruiterName: string | null;
    recruiterAvatar: string | null;
}

/** Rôle Discord de la guilde (id + libellé + couleur + position hiérarchique). */
export interface RegistryDiscordRole {
    id: string;
    name: string;
    color: number;
    position: number;
}

/**
 * Index Discord du registre recrutement — ce que la base **ne peut pas** dire seule.
 *
 * 🐛 Constat user du 27/09/2026 : « je comprends pas pk les non présents dashboard y sont pas ».
 * Mesure : le registre est construit sur `userProfile` (les **profils dashboard**) — un membre
 * présent sur Discord **sans profil** n'existe donc pas dans la liste, alors que l'onglet Audit,
 * lui, le compte (`hasDashboardProfile: false`). Et sans les rôles Discord du membre, impossible de
 * **cibler un rôle** dans le registre (la base ne cache que le rôle principal :
 * `UserProfile.discordRoleName`/`discordRoleColor`).
 *
 * `discordAvailable: false` ⇒ Discord injoignable (ou bot sans droits) : le registre reste
 * parfaitement utilisable, seules les colonnes Discord sont vides (jamais d'écran d'erreur).
 */
export interface MemberRegistryDiscordIndex {
    discordAvailable: boolean;
    roles: RegistryDiscordRole[];
    /** Rôles Discord du membre, indexés par `userProfile.id`. */
    rolesByProfileId: Record<string, string[]>;
    /** Membres Discord **hors bots** sans profil dashboard, triés par nom. */
    discordOnly: RegistryDiscordOnlyMember[];
}

/**
 * Index Discord du registre : rôles par profil dashboard + membres Discord hors dashboard.
 *
 * Lecture seule, mise en cache par la couche Discord (`listGuildMembers` 10 min,
 * `fetchGuildRoles` 15 s). Fail-soft : une panne Discord ne casse pas le registre.
 */
export async function getMemberRegistryDiscordIndex(
    guildId: string
): Promise<ActionResponse<MemberRegistryDiscordIndex>> {
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
            select: { id: true },
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const [{ listGuildMembers, fetchGuildRoles }, { buildGuildAvatarUrl, buildDiscordAvatarUrl, getDefaultDiscordAvatar }] = await Promise.all([
            import("@/server/discord"),
            import("@/lib/discord-avatars"),
        ]);

        const [discordMembers, discordRoles, profiles, entries, entryComments, recruiters] = await Promise.all([
            // Panne Discord ⇒ listes vides, jamais une exception qui casse le registre.
            listGuildMembers(guildId, 1000).catch(() => [] as Awaited<ReturnType<typeof listGuildMembers>>),
            fetchGuildRoles(guildId, { excludeManaged: false }).catch(() => []),
            db.userProfile.findMany({
                where: { guildId: guild.id },
                select: {
                    id: true,
                    user: {
                        select: {
                            accounts: {
                                where: { provider: "discord" },
                                select: { providerAccountId: true },
                            },
                        },
                    },
                },
            }),
            // B-2 : lignes de registre des membres **sans profil dashboard**.
            db.memberRegistryEntry.findMany({ where: { guildId: guild.id } }),
            db.memberRegistryComment.findMany({
                where: { guildId: guild.id, discordId: { not: null } },
                orderBy: { createdAt: "asc" },
            }),
            db.userProfile.findMany({
                where: { guildId: guild.id },
                select: {
                    id: true,
                    pseudoDofus: true,
                    discordNickname: true,
                    user: { select: { name: true, image: true } },
                },
            }),
        ]);

        const recruiterById = new Map(
            recruiters.map((recruiter) => [
                recruiter.id,
                {
                    name: recruiter.pseudoDofus || recruiter.discordNickname || recruiter.user?.name || null,
                    avatar: recruiter.user?.image || null,
                },
            ])
        );

        const commentsByDiscordId = new Map<string, RegistryComment[]>();
        for (const comment of entryComments) {
            const key = String(comment.discordId ?? "");
            if (!key) continue;
            const list = commentsByDiscordId.get(key) ?? [];
            if (list.length < MAX_REGISTRY_COMMENTS) {
                list.push({
                    id: comment.id,
                    body: comment.body,
                    authorName: comment.authorName,
                    authorUserId: comment.authorUserId,
                    createdAt: comment.createdAt.toISOString(),
                });
                commentsByDiscordId.set(key, list);
            }
        }

        const entryByDiscordId = new Map(entries.map((entry) => [entry.discordId, entry]));

        const profileIdByDiscordId = new Map<string, string>();
        for (const profile of profiles) {
            const discordId = profile.user?.accounts?.[0]?.providerAccountId;
            if (discordId) profileIdByDiscordId.set(discordId, profile.id);
        }

        const rolesByProfileId: Record<string, string[]> = {};
        const discordOnly: RegistryDiscordOnlyMember[] = [];
        const seen = new Set<string>();

        for (const member of discordMembers) {
            const discordId = String(member?.user?.id ?? "");
            if (!discordId || member?.user?.bot || seen.has(discordId)) continue;
            seen.add(discordId);

            const roles = Array.isArray(member.roles) ? member.roles.map(String) : [];
            const profileId = profileIdByDiscordId.get(discordId);
            if (profileId) {
                rolesByProfileId[profileId] = roles;
                continue;
            }

            const entry = entryByDiscordId.get(discordId);
            const joinedAtResolved = entry?.guildJoinedAt?.toISOString() ?? (member.joined_at ?? null);
            const recruiter = entry?.recruitedById ? recruiterById.get(entry.recruitedById) : undefined;

            discordOnly.push({
                discordId,
                displayName: String(member.nick || member.user.global_name || member.user.username || discordId),
                username: String(member.user.username ?? ""),
                // Avatar : d'abord celui **du serveur**, sinon celui du compte Discord, sinon
                // l'avatar par défaut de Discord. Avant, le hash *global* était glissé dans
                // l'URL *de guilde* → 404 silencieux et initiales à la place de la photo.
                avatar: member.avatar
                    ? buildGuildAvatarUrl(guildId, discordId, member.avatar, 128)
                    : buildDiscordAvatarUrl(discordId, member.user.avatar || null, 128) ??
                      getDefaultDiscordAvatar(discordId),
                joinedAt: member.joined_at ?? null,
                roles,
                joinedAtResolved,
                seniorityDays: joinedAtResolved ? computeSeniorityDays(joinedAtResolved) : 0,
                entry: entry
                    ? {
                          pseudoDofus: entry.pseudoDofus,
                          ankamaId: entry.ankamaId,
                          guildJoinedAt: entry.guildJoinedAt ? entry.guildJoinedAt.toISOString() : null,
                          recruitedById: entry.recruitedById,
                          trialValidated: entry.trialValidated,
                          trialEndsAt: entry.trialEndsAt ? entry.trialEndsAt.toISOString() : null,
                          mules: normalizeMules(entry.altPseudos),
                          comments: commentsByDiscordId.get(discordId) ?? [],
                      }
                    : null,
                recruiterName: recruiter?.name ?? null,
                recruiterAvatar: recruiter?.avatar ?? null,
            });
        }

        discordOnly.sort((a, b) => a.displayName.localeCompare(b.displayName, "fr"));

        return {
            success: true,
            data: {
                discordAvailable: seen.size > 0,
                roles: discordRoles.map((role) => ({
                    id: role.id,
                    name: role.name,
                    color: role.color,
                    position: role.position,
                    // Rôle **géré par une intégration/bot** : proposé nulle part dans le
                    // choix des rôles « en guilde en jeu » (on ne gère pas ces rôles).
                    managed: role.managed === true,
                })),
                rolesByProfileId,
                discordOnly,
            },
        };
    } catch (err: any) {
        logger.error("[getMemberRegistryDiscordIndex] Erreur critique:", err);
        return { success: false, error: "Impossible de charger les rôles Discord du registre" };
    }
}



/**
 * État d'essai d'un membre (registre) : Oui = validé, Non = en essai jusqu'à
 * la date de reconduction (ou sans fin si null). Source unique d'écriture.
 */
export async function setMemberTrialState(
    guildId: string,
    subject: RegistrySubject,
    input: { validated: boolean; trialEndsAt?: string | null }
): Promise<ActionResponse<{ message: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    if (!subjectSchema.safeParse(subject).success) return { success: false, error: "Sujet invalide" };

    const validated = trialStateSchema.safeParse(input);
    if (!validated.success) {
        return { success: false, error: validated.error.issues[0]?.message || "Données invalides" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const target = resolveRegistryTarget(subject);
        const trialEndsAt = validated.data.validated
            ? null
            : validated.data.trialEndsAt
              ? new Date(validated.data.trialEndsAt)
              : null;
        const data = { trialValidated: validated.data.validated, trialEndsAt };

        if (target.kind === "profile") {
            const profile = await db.userProfile.findFirst({
                where: { id: target.profileId, guildId: guild.id },
                select: { id: true, pseudoDofus: true, discordNickname: true, trialValidated: true, trialEndsAt: true },
            });
            if (!profile) return { success: false, error: "Profil membre introuvable" };

            await db.userProfile.update({ where: { id: profile.id }, data });

            await createAuditLog({
                guildId,
                actorUserId: session.user.id,
                actorName: ctx.name || "Staff",
                action: "SETTINGS_UPDATED",
                targetType: "USER_PROFILE",
                targetId: profile.id,
                oldValue: { trialValidated: profile.trialValidated, trialEndsAt: profile.trialEndsAt },
                newValue: data,
                metadata: {
                    memberName: profile.pseudoDofus || profile.discordNickname || "Membre",
                    source: "registre",
                },
            });
        } else {
            const entry = await db.memberRegistryEntry.upsert({
                where: { guildId_discordId: { guildId: guild.id, discordId: target.discordId } },
                create: { guildId: guild.id, discordId: target.discordId, ...data },
                update: data,
            });

            await createAuditLog({
                guildId,
                actorUserId: session.user.id,
                actorName: ctx.name || "Staff",
                action: "SETTINGS_UPDATED",
                targetType: "USER_PROFILE",
                targetId: entry.id,
                oldValue: {},
                newValue: data,
                metadata: { memberName: entry.pseudoDofus || target.discordId, source: "registre", scope: "DISCORD_ONLY" },
            });
        }

        return {
            success: true,
            data: { message: validated.data.validated ? "Essai validé" : "Essai mis à jour" },
        };
    } catch (err: unknown) {
        logger.error("[setMemberTrialState] Erreur:", err);
        return { success: false, error: "Erreur lors de la mise à jour de l'essai" };
    }
}

/**
 * Valide l'essai d'un membre directement (raccourci 1 clic).
 */
export async function validateMemberTrial(guildId: string, subject: RegistrySubject): Promise<ActionResponse<{ message: string }>> {
    return setMemberTrialState(guildId, subject, { validated: true });
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
        return { success: false, error: validated.error.issues[0]?.message || "Motif invalide" };
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
            guildId,
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
                    trialValidated: true,
                    trialEndsAt: null,
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
    subject: RegistrySubject,
    recruiterProfileId: string | null
): Promise<ActionResponse<{ message: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    if (!subjectSchema.safeParse(subject).success) return { success: false, error: "Sujet invalide" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const target = resolveRegistryTarget(subject);

        if (recruiterProfileId) {
            const recruiter = await db.userProfile.findFirst({
                where: { id: recruiterProfileId, guildId: guild.id },
                select: { id: true }
            });
            if (!recruiter) return { success: false, error: "Recruteur invalide pour cette guilde" };
        }

        if (target.kind === "profile") {
            const profile = await db.userProfile.findFirst({
                where: { id: target.profileId, guildId: guild.id },
                select: { id: true },
            });
            if (!profile) return { success: false, error: "Profil membre introuvable" };
            await db.userProfile.update({
                where: { id: profile.id },
                data: { recruitedById: recruiterProfileId },
            });
        } else {
            await db.memberRegistryEntry.upsert({
                where: { guildId_discordId: { guildId: guild.id, discordId: target.discordId } },
                create: { guildId: guild.id, discordId: target.discordId, recruitedById: recruiterProfileId },
                update: { recruitedById: recruiterProfileId },
            });
        }

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
    subject: RegistrySubject,
    alts: Array<{ pseudo: string; classe?: string; level?: number; inGameGuild?: boolean } | string>
): Promise<ActionResponse<{ message: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    if (!subjectSchema.safeParse(subject).success) return { success: false, error: "Sujet invalide" };

    const validated = altsSchema.safeParse({ alts });
    if (!validated.success) {
        return { success: false, error: validated.error.issues[0]?.message || "Format des mules invalide" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const target = resolveRegistryTarget(subject);

        if (target.kind === "profile") {
            const profile = await db.userProfile.findFirst({
                where: { id: target.profileId, guildId: guild.id },
                select: { id: true },
            });
            if (!profile) return { success: false, error: "Profil membre introuvable" };
            await db.userProfile.update({
                where: { id: profile.id },
                data: { altPseudos: alts as never },
            });
        } else {
            await db.memberRegistryEntry.upsert({
                where: { guildId_discordId: { guildId: guild.id, discordId: target.discordId } },
                create: { guildId: guild.id, discordId: target.discordId, altPseudos: alts as never },
                update: { altPseudos: alts as never },
            });
        }

        return { success: true, data: { message: "Mules mises à jour" } };
    } catch (err: any) {
        logger.error("[updateMemberAlts] Erreur:", err);
        return { success: false, error: "Erreur lors de la mise à jour des mules" };
    }
}

/**
 * Ajoute un commentaire du staff au registre d'un membre : horodaté et signé.
 * Le plafond (10 par membre) est revérifié en base juste avant l'écriture —
 * jamais déduit de l'écran.
 */
export async function addMemberRegistryComment(
    guildId: string,
    subject: RegistrySubject,
    input: z.infer<typeof registryCommentSchema>
): Promise<ActionResponse<{ message: string; comment: RegistryComment }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    if (!subjectSchema.safeParse(subject).success) return { success: false, error: "Sujet invalide" };

    const validated = registryCommentSchema.safeParse(input);
    if (!validated.success) {
        return { success: false, error: validated.error.issues[0]?.message || "Commentaire invalide" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const target = resolveRegistryTarget(subject);

        let commentTarget: { guildId: string; profileId?: string; discordId?: string };
        if (target.kind === "profile") {
            const profile = await db.userProfile.findFirst({
                where: { id: target.profileId, guildId: guild.id },
                select: { id: true, _count: { select: { registryComments: true } } },
            });
            if (!profile) return { success: false, error: "Profil membre introuvable" };
            if (!canAddRegistryComment(profile._count.registryComments)) {
                return { success: false, error: `Maximum ${MAX_REGISTRY_COMMENTS} commentaires par membre` };
            }
            commentTarget = { guildId: guild.id, profileId: profile.id };
        } else {
            const existing = await db.memberRegistryComment.count({
                where: { guildId: guild.id, discordId: target.discordId },
            });
            if (!canAddRegistryComment(existing)) {
                return { success: false, error: `Maximum ${MAX_REGISTRY_COMMENTS} commentaires par membre` };
            }
            commentTarget = { guildId: guild.id, discordId: target.discordId };
        }

        const created = await db.memberRegistryComment.create({
            data: {
                ...commentTarget,
                authorUserId: session.user.id,
                authorName: ctx.name || "Staff",
                body: validated.data.body,
            },
            select: { id: true, body: true, authorName: true, authorUserId: true, createdAt: true }
        });

        await createAuditLog({
            guildId,
            actorUserId: session.user.id,
            actorName: ctx.name || "Staff",
            action: "SETTINGS_UPDATED",
            targetType: "USER_PROFILE",
            targetId: created.id,
            metadata: { source: "registre", kind: "registry_comment", commentId: created.id },
        });

        return {
            success: true,
            data: {
                message: "Commentaire ajouté",
                comment: { ...created, createdAt: created.createdAt.toISOString() },
            },
        };
    } catch (err: unknown) {
        logger.error("[addMemberRegistryComment] Erreur:", err);
        return { success: false, error: "Erreur lors de l'ajout du commentaire" };
    }
}

/**
 * Édition du registre (une ligne = un membre) : identités saisies à la main,
 * date d'arrivée manuelle et commentaires staff. L'ancienneté et l'ID Discord
 * restent calculés / peuplés seuls côté lecture.
 */
export async function updateMemberRegistryIdentity(
    guildId: string,
    subject: RegistrySubject,
    input: z.infer<typeof registryIdentitySchema>
): Promise<ActionResponse<{ message: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    if (!subjectSchema.safeParse(subject).success) return { success: false, error: "Sujet invalide" };

    const validated = registryIdentitySchema.safeParse(input);
    if (!validated.success) {
        return { success: false, error: validated.error.issues[0]?.message || "Données invalides" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const target = resolveRegistryTarget(subject);

        const data: Record<string, unknown> = {};
        // 🔎 Vérification ladder du pseudo (demande user du 25/10/2026) : elle n'a lieu que si
        // le module « Ladder Ankama » est **actif** pour la guilde. Sinon (`toggle` off côté
        // God) on enregistre la saisie manuelle telle quelle, sans appel réseau.
        let ladderNote = "";
        if (validated.data.pseudoDofus !== undefined) {
            const rawPseudo = validated.data.pseudoDofus?.trim() || "";
            let finalPseudo = rawPseudo ? rawPseudo : null;

            if (rawPseudo) {
                try {
                    const { isModuleEnabled } = await import("./module-actions");
                    const ladderEnabled = await isModuleEnabled(guildId, "ladderSync");
                    if (ladderEnabled) {
                        const { verifyDofusPseudo } = await import("./profile-actions");
                        const check = await verifyDofusPseudo(rawPseudo, guildId);
                        if (!check.success) {
                            // Fail-closed : un pseudo introuvable n'est jamais enregistré.
                            return { success: false, error: check.error || "Pseudo introuvable sur le ladder." };
                        }
                        const info = (check.data ?? {}) as { character_name?: string | null; level?: number | null; manualFallback?: boolean };
                        // Orthographe **officielle** du personnage : c'est elle qui part dans le profil.
                        if (info.character_name) finalPseudo = String(info.character_name).trim() || finalPseudo;
                        ladderNote = info.manualFallback
                            ? " (saisie manuelle autorisée par l'administration)"
                            : typeof info.level === "number"
                              ? ` — vérifié sur le ladder (niv. ${info.level})`
                              : " — vérifié sur le ladder";
                    } else {
                        ladderNote = " (vérification ladder désactivée pour cette guilde)";
                    }
                } catch (ladderErr) {
                    logger.warn("[updateMemberRegistryIdentity] vérification ladder impossible", { err: String(ladderErr) });
                    return { success: false, error: "Vérification ladder indisponible — réessaie ou demande le mode manuel." };
                }
            }

            data.pseudoDofus = finalPseudo;
        }
        if (validated.data.ankamaId !== undefined) {
            const v = validated.data.ankamaId?.trim();
            data.ankamaId = v ? v : null;
        }
        if (validated.data.guildJoinedAt !== undefined) {
            data.guildJoinedAt = validated.data.guildJoinedAt ? new Date(validated.data.guildJoinedAt) : null;
        }
        if (Object.keys(data).length === 0) {
            return { success: true, data: { message: "Rien à mettre à jour" } };
        }

        if (target.kind === "profile") {
            const profile = await db.userProfile.findFirst({
                where: { id: target.profileId, guildId: guild.id },
                select: { id: true, pseudoDofus: true, ankamaId: true, guildJoinedAt: true },
            });
            if (!profile) return { success: false, error: "Profil membre introuvable" };

            await db.userProfile.update({ where: { id: profile.id }, data: data as never });

            await createAuditLog({
                guildId,
                actorUserId: session.user.id,
                actorName: ctx.name || "Staff",
                action: "SETTINGS_UPDATED",
                targetType: "USER_PROFILE",
                targetId: profile.id,
                oldValue: {
                    pseudoDofus: profile.pseudoDofus,
                    ankamaId: profile.ankamaId,
                    guildJoinedAt: profile.guildJoinedAt,
                },
                newValue: data,
                metadata: { source: "registre" },
            });
        } else {
            const previous = await db.memberRegistryEntry.findUnique({
                where: { guildId_discordId: { guildId: guild.id, discordId: target.discordId } },
                select: { id: true, pseudoDofus: true, ankamaId: true, guildJoinedAt: true },
            });

            await db.memberRegistryEntry.upsert({
                where: { guildId_discordId: { guildId: guild.id, discordId: target.discordId } },
                create: { guildId: guild.id, discordId: target.discordId, ...data } as never,
                update: data as never,
            });

            await createAuditLog({
                guildId,
                actorUserId: session.user.id,
                actorName: ctx.name || "Staff",
                action: "SETTINGS_UPDATED",
                targetType: "USER_PROFILE",
                targetId: previous?.id ?? target.discordId,
                oldValue: {
                    pseudoDofus: previous?.pseudoDofus ?? null,
                    ankamaId: previous?.ankamaId ?? null,
                    guildJoinedAt: previous?.guildJoinedAt ?? null,
                },
                newValue: data,
                metadata: { source: "registre", scope: "DISCORD_ONLY" },
            });
        }

        return { success: true, data: { message: `Ligne du registre mise à jour${ladderNote}` } };
    } catch (err: unknown) {
        logger.error("[updateMemberRegistryIdentity] Erreur:", err);
        return { success: false, error: "Erreur lors de la mise à jour du registre" };
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
        return { success: false, error: validated.error.issues[0]?.message || "Paramètres invalides" };
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

// ==========================================
// PRÉSENCE DISCORD PAR MEMBRE (onglet de la fiche)
// ==========================================

/**
 * Mesure brute du bot pour **tous** les membres (`DiscordMemberActivity`, lot 7) :
 * compteurs et horodatages seulement, aucun contenu de message.
 */
export type MemberActivitySnapshot = {
    messagesTotal: number;
    /** Secondes cumulées → minutes arrondies (l'unité de l'écran). */
    voiceMinutesTotal: number;
    firstSeenAt: string;
    lastSeenAt: string;
    lastMessageAt: string | null;
    lastVoiceAt: string | null;
    /** Renseigné quand le membre a quitté le serveur Discord (purge à 365 j). */
    leftDiscordAt: string | null;
};

export type MemberDiscordPresence = {
    /** `false` = aucune mesure (ni profil, ni ligne `DiscordMemberActivity`). */
    tracked: boolean;
    /**
     * D'où vient la mesure : compteurs riches d'un **profil** (fenêtres hebdo/mois) ou
     * ligne **tous membres** écrite par le bot (`DiscordMemberActivity`, lot 7).
     */
    source: "profile" | "member" | "none";
    voiceWeekly: number;
    voiceMonthly: number;
    voiceTotal: number;
    messagesTotal: number;
    charactersTotal: number;
    repliesTotal: number;
    reactionsReceivedTotal: number;
    streamTotal: number;
    lastMessageAt: string | null;
    lastVoiceAt: string | null;
    lastReactionAt: string | null;
    profileWeekly: DiscordPresenceProfile | null;
    profileMonthly: DiscordPresenceProfile | null;
    noteWeekly: string | null;
    noteMonthly: string | null;
    /** Mesure brute (tous les membres) — `null` tant que le bot n'a jamais vu la personne. */
    memberActivity: MemberActivitySnapshot | null;
};

const UNTRACKED_PRESENCE: MemberDiscordPresence = {
    tracked: false,
    source: "none",
    voiceWeekly: 0,
    voiceMonthly: 0,
    voiceTotal: 0,
    messagesTotal: 0,
    charactersTotal: 0,
    repliesTotal: 0,
    reactionsReceivedTotal: 0,
    streamTotal: 0,
    lastMessageAt: null,
    lastVoiceAt: null,
    lastReactionAt: null,
    profileWeekly: null,
    profileMonthly: null,
    noteWeekly: null,
    noteMonthly: null,
    memberActivity: null,
};

/** Lit la ligne `DiscordMemberActivity` d'un membre (tous, inscrit ou non) — lot 7. */
async function readMemberActivity(
    guildId: string,
    discordId: string
): Promise<MemberActivitySnapshot | null> {
    const row = await db.discordMemberActivity.findUnique({
        where: { guildId_discordId: { guildId, discordId } },
        select: {
            messagesTotal: true,
            voiceSecondsTotal: true,
            firstSeenAt: true,
            lastSeenAt: true,
            lastMessageAt: true,
            lastVoiceAt: true,
            leftDiscordAt: true,
        },
    });
    if (!row) return null;
    return {
        messagesTotal: row.messagesTotal,
        voiceMinutesTotal: Math.round(row.voiceSecondsTotal / 60),
        firstSeenAt: row.firstSeenAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
        lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
        lastVoiceAt: row.lastVoiceAt ? row.lastVoiceAt.toISOString() : null,
        leftDiscordAt: row.leftDiscordAt ? row.leftDiscordAt.toISOString() : null,
    };
}

/**
 * Activité Discord mesurée d'un membre (onglet « Activité Discord » de la fiche).
 * Lecture staff (`isAdmin` ou `canManageMembers`), sujet vérifié, guilde
 * cloisonnée.
 *
 * Deux sources, jamais mélangées : les compteurs **riches** d'un profil (fenêtres
 * hebdo/mensuelle) et la mesure **tous membres** du bot (`DiscordMemberActivity`, lot 7).
 * Un hors-dashboard mesuré n'est donc plus « non mesuré » — et un membre jamais vu le dit.
 */
export async function getMemberDiscordPresence(
    guildId: string,
    subject: RegistrySubject
): Promise<ActionResponse<MemberDiscordPresence>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    if (!guildId) return { success: false, error: "ID de guilde manquant" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    const parsed = subjectSchema.safeParse(subject);
    if (!parsed.success) return { success: false, error: "Sujet invalide" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const target = resolveRegistryTarget(parsed.data as RegistrySubject);

        // Membre Discord sans profil : la mesure « tous membres » (lot 7) répond seule.
        if (target.kind !== "profile") {
            const activity = await readMemberActivity(guild.id, target.discordId);
            if (!activity) return { success: true, data: UNTRACKED_PRESENCE };
            return {
                success: true,
                data: {
                    ...UNTRACKED_PRESENCE,
                    tracked: true,
                    source: "member",
                    voiceTotal: activity.voiceMinutesTotal,
                    messagesTotal: activity.messagesTotal,
                    lastMessageAt: activity.lastMessageAt,
                    lastVoiceAt: activity.lastVoiceAt,
                    memberActivity: activity,
                },
            };
        }

        const profile = await db.userProfile.findUnique({
            where: { id: target.profileId },
            select: {
                guildId: true,
                discordVoiceTimeWeekly: true,
                discordVoiceTimeMonthly: true,
                discordVoiceTimeTotal: true,
                discordMessageCountTotal: true,
                discordCharactersTotal: true,
                discordRepliesTotal: true,
                discordReactionsReceivedTotal: true,
                discordVoiceStreamTimeTotal: true,
                lastDiscordMessageAt: true,
                lastDiscordVoiceAt: true,
                lastDiscordReactionAt: true,
                user: {
                    select: {
                        accounts: {
                            where: { provider: "discord" },
                            select: { providerAccountId: true },
                            take: 1,
                        },
                    },
                },
            },
        });
        if (!profile || profile.guildId !== guild.id) {
            return { success: false, error: "Cible invalide pour cette guilde" };
        }

        // La mesure « tous membres » complète le profil (départ Discord, dernière présence).
        const discordId = profile.user?.accounts?.[0]?.providerAccountId ?? null;
        const memberActivity = discordId ? await readMemberActivity(guild.id, discordId) : null;

        const counters: PresenceCounters = {
            voiceWeekly: profile.discordVoiceTimeWeekly || 0,
            voiceMonthly: profile.discordVoiceTimeMonthly || 0,
            voiceTotal: profile.discordVoiceTimeTotal || 0,
            messagesTotal: profile.discordMessageCountTotal || 0,
            charactersTotal: profile.discordCharactersTotal || 0,
            repliesTotal: profile.discordRepliesTotal || 0,
            reactionsReceivedTotal: profile.discordReactionsReceivedTotal || 0,
            streamTotal: profile.discordVoiceStreamTimeTotal || 0,
            lastMessageAt: profile.lastDiscordMessageAt || null,
            lastVoiceAt: profile.lastDiscordVoiceAt || null,
            lastReactionAt: profile.lastDiscordReactionAt || null,
        };
        const profileWeekly = resolveDiscordPresenceProfile(counters, "weekly");
        const profileMonthly = resolveDiscordPresenceProfile(counters, "monthly");
        const iso = (d: Date | null) => (d ? d.toISOString() : null);

        return {
            success: true,
            data: {
                tracked: true,
                source: "profile",
                voiceWeekly: counters.voiceWeekly,
                voiceMonthly: counters.voiceMonthly,
                voiceTotal: counters.voiceTotal,
                messagesTotal: counters.messagesTotal,
                charactersTotal: counters.charactersTotal,
                repliesTotal: counters.repliesTotal,
                reactionsReceivedTotal: counters.reactionsReceivedTotal,
                streamTotal: counters.streamTotal,
                lastMessageAt: iso(profile.lastDiscordMessageAt),
                lastVoiceAt: iso(profile.lastDiscordVoiceAt),
                lastReactionAt: iso(profile.lastDiscordReactionAt),
                profileWeekly,
                profileMonthly,
                noteWeekly: describePresenceProfile(profileWeekly, "weekly"),
                noteMonthly: describePresenceProfile(profileMonthly, "monthly"),
                memberActivity,
            },
        };
    } catch (err: unknown) {
        logger.error("[getMemberDiscordPresence] Erreur:", err);
        return { success: false, error: "Erreur lors de la lecture de l'activité Discord" };
    }
}

// ==========================================
// LOT 2 — PHOTO SERVEUR DE LA FICHE MEMBRE
// ==========================================

/** Commentaire Prisma → type du registre (une seule conversion). */
function toRegistryComment(comment: {
    id: string;
    body: string;
    authorName: string;
    authorUserId: string | null;
    createdAt: Date;
}): RegistryComment {
    return {
        id: comment.id,
        body: comment.body,
        authorName: comment.authorName,
        authorUserId: comment.authorUserId,
        createdAt: comment.createdAt.toISOString(),
    };
}

/**
 * Relit **en base** les valeurs éditables d'une fiche membre — lot 2.
 *
 * Mesure (18/10/2026) : après un enregistrement, la modale gardait ses valeurs locales
 * (`row` figé, aucun resync) ⇒ un pseudo saisi «  Bob  » restait affiché avec ses espaces
 * alors que la base stocke « Bob », un membre archivé gardait le badge « Actif », un
 * commentaire ajouté n'apparaissait pas. Cette lecture ciblée rend la vérité du serveur
 * (une seule fiche : aucun rechargement du roster, aucun appel Discord).
 *
 * Lecture seule · RBAC fail-closed (`isAdmin` ou `canManageMembers`) · cible vérifiée
 * **dans la guilde** avant toute lecture · `readAt` vient de l'horloge **serveur**.
 */
export async function getMemberRegistrySnapshot(
    guildId: string,
    subject: RegistrySubject
): Promise<ActionResponse<MemberRosterSnapshot>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    if (!guildId) return { success: false, error: "ID de guilde manquant" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    const parsed = subjectSchema.safeParse(subject);
    if (!parsed.success) return { success: false, error: "Sujet invalide" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, trialDurationDays: true },
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const target = resolveRegistryTarget(parsed.data as RegistrySubject);
        const now = new Date();
        const readAt = now.toISOString();

        if (target.kind === "profile") {
            const profile = await db.userProfile.findFirst({
                where: { id: target.profileId, guildId: guild.id },
                select: {
                    pseudoDofus: true,
                    discordNickname: true,
                    ankamaId: true,
                    status: true,
                    trialValidated: true,
                    trialEndsAt: true,
                    createdAt: true,
                    guildJoinedAt: true,
                    altPseudos: true,
                    vacationStart: true,
                    vacationEnd: true,
                    user: { select: { name: true } },
                    recruitedByProfile: {
                        select: {
                            id: true,
                            pseudoDofus: true,
                            discordNickname: true,
                            user: { select: { name: true, image: true } },
                        },
                    },
                    registryComments: {
                        select: { id: true, body: true, authorName: true, authorUserId: true, createdAt: true },
                        orderBy: { createdAt: "asc" },
                        take: MAX_REGISTRY_COMMENTS,
                    },
                },
            });
            if (!profile) return { success: false, error: "Cible invalide pour cette guilde" };

            const joinedAtDate = profile.guildJoinedAt ?? profile.createdAt;
            const trialEndsAt = profile.trialEndsAt ? profile.trialEndsAt.toISOString() : null;
            const recruiterName = profile.recruitedByProfile
                ? profile.recruitedByProfile.pseudoDofus ||
                  profile.recruitedByProfile.discordNickname ||
                  profile.recruitedByProfile.user?.name ||
                  null
                : null;

            return {
                success: true,
                data: {
                    dashboard: true,
                    displayName:
                        profile.pseudoDofus || profile.discordNickname || profile.user?.name || null,
                    pseudoDofus: profile.pseudoDofus,
                    ankamaId: profile.ankamaId,
                    status: profile.status,
                    joinedAt: joinedAtDate.toISOString(),
                    seniorityDays: computeSeniorityDays(joinedAtDate.toISOString(), now),
                    trial: {
                        validated: profile.trialValidated,
                        endsAt: trialEndsAt,
                        remainingDays: profile.trialEndsAt ? differenceInDays(profile.trialEndsAt, now) : null,
                        decision: getTrialDecision({
                            trialValidated: profile.trialValidated,
                            trialEndsAt,
                            joinedAtIso: joinedAtDate.toISOString(),
                            trialDurationDays: guild.trialDurationDays,
                            now,
                        }),
                    },
                    recruiter: profile.recruitedByProfile
                        ? {
                              id: profile.recruitedByProfile.id,
                              name: recruiterName || "Membre",
                              avatar: profile.recruitedByProfile.user?.image || null,
                          }
                        : null,
                    mules: normalizeMules(profile.altPseudos),
                    comments: profile.registryComments.map(toRegistryComment),
                    vacationStart: profile.vacationStart ? profile.vacationStart.toISOString() : null,
                    vacationEnd: profile.vacationEnd ? profile.vacationEnd.toISOString() : null,
                    readAt,
                },
            };
        }

        // Membre Discord hors dashboard : la ligne de registre peut ne pas exister encore.
        const entry = await db.memberRegistryEntry.findUnique({
            where: { guildId_discordId: { guildId: guild.id, discordId: target.discordId } },
            select: {
                pseudoDofus: true,
                ankamaId: true,
                guildJoinedAt: true,
                recruitedById: true,
                trialValidated: true,
                trialEndsAt: true,
                altPseudos: true,
            },
        });
        const comments = await db.memberRegistryComment.findMany({
            where: { guildId: guild.id, discordId: target.discordId },
            select: { id: true, body: true, authorName: true, authorUserId: true, createdAt: true },
            orderBy: { createdAt: "asc" },
            take: MAX_REGISTRY_COMMENTS,
        });

        const recruiter = entry?.recruitedById
            ? await db.userProfile.findFirst({
                  where: { id: entry.recruitedById, guildId: guild.id },
                  select: {
                      id: true,
                      pseudoDofus: true,
                      discordNickname: true,
                      user: { select: { name: true, image: true } },
                  },
              })
            : null;

        const joinedAt = entry?.guildJoinedAt ? entry.guildJoinedAt.toISOString() : null;
        const trialEndsAt = entry?.trialEndsAt ? entry.trialEndsAt.toISOString() : null;
        const recruiterName = recruiter
            ? recruiter.pseudoDofus || recruiter.discordNickname || recruiter.user?.name || null
            : null;

        return {
            success: true,
            data: {
                dashboard: false,
                // Nom et date Discord : mesurés par le bot, absents de la base ⇒ la fusion
                // de la ligne (`applyRosterSnapshot`) les conserve (`null` = « je ne sais pas »).
                displayName: null,
                pseudoDofus: entry?.pseudoDofus ?? null,
                ankamaId: entry?.ankamaId ?? null,
                status: null,
                joinedAt,
                seniorityDays: joinedAt ? computeSeniorityDays(joinedAt, now) : null,
                trial: entry
                    ? {
                          validated: entry.trialValidated,
                          endsAt: trialEndsAt,
                          remainingDays: entry.trialEndsAt ? differenceInDays(entry.trialEndsAt, now) : null,
                          decision: getTrialDecision({
                              trialValidated: entry.trialValidated,
                              trialEndsAt,
                              joinedAtIso: joinedAt ?? now.toISOString(),
                              trialDurationDays: guild.trialDurationDays,
                              now,
                          }),
                      }
                    : null,
                recruiter: recruiter
                    ? {
                          id: recruiter.id,
                          name: recruiterName || "Membre",
                          avatar: recruiter.user?.image || null,
                      }
                    : null,
                mules: entry ? normalizeMules(entry.altPseudos) : [],
                comments: comments.map(toRegistryComment),
                vacationStart: null,
                vacationEnd: null,
                readAt,
            },
        };
    } catch (err: unknown) {
        logger.error("[getMemberRegistrySnapshot] Erreur:", err);
        return { success: false, error: "Erreur lors de la relecture de la fiche" };
    }
}

// ==========================================
// LOT 4 — JOURNAL DU STAFF : ÉDITION / SUPPRESSION AUDITÉES
// ==========================================

const registryCommentEditSchema = z.object({
    commentId: z.string().min(1).max(64),
    body: z.string().trim().min(1, "Commentaire vide").max(REGISTRY_COMMENT_MAX_LENGTH),
});

/** Périmètre d'un commentaire : la guilde **et** le membre visé (profil ou Discord). */
function commentScope(guildId: string, target: RegistryTarget) {
    return target.kind === "profile"
        ? { guildId, profileId: target.profileId }
        : { guildId, discordId: target.discordId };
}

/**
 * Édite un commentaire du journal du staff — **avec trace** (lot 4).
 *
 * Le commentaire est retrouvé par `id` **dans la guilde et sur le membre visé** : un
 * identifiant d'une autre fiche (ou d'une autre guilde) ne peut pas être édité.
 * L'auteur d'origine est conservé ; l'audit dit qui a modifié quoi.
 */
export async function updateMemberRegistryComment(
    guildId: string,
    subject: RegistrySubject,
    input: { commentId: string; body: string }
): Promise<ActionResponse<{ message: string; comment: RegistryComment }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    if (!subjectSchema.safeParse(subject).success) return { success: false, error: "Sujet invalide" };

    const validated = registryCommentEditSchema.safeParse(input);
    if (!validated.success) {
        return { success: false, error: validated.error.issues[0]?.message || "Commentaire invalide" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const target = resolveRegistryTarget(subject);
        const scope = commentScope(guild.id, target);
        const previous = await db.memberRegistryComment.findFirst({
            where: { id: validated.data.commentId, ...scope },
            select: { id: true, body: true },
        });
        if (!previous) return { success: false, error: "Commentaire introuvable sur cette fiche" };

        const updated = await db.memberRegistryComment.update({
            where: { id: previous.id },
            data: { body: validated.data.body },
            select: { id: true, body: true, authorName: true, authorUserId: true, createdAt: true },
        });

        await createAuditLog({
            guildId,
            actorUserId: session.user.id,
            actorName: ctx.name || "Staff",
            action: "MEMBER_COMMENT_UPDATED",
            targetType: "USER_PROFILE",
            targetId: updated.id,
            oldValue: { body: previous.body },
            newValue: { body: updated.body },
            metadata: { source: "registre", kind: "registry_comment", commentId: updated.id },
        });

        return {
            success: true,
            data: { message: "Commentaire modifié", comment: toRegistryComment(updated) },
        };
    } catch (err: unknown) {
        logger.error("[updateMemberRegistryComment] Erreur:", err);
        return { success: false, error: "Erreur lors de la modification du commentaire" };
    }
}

/**
 * Supprime un commentaire du journal du staff — **avec trace** (lot 4).
 *
 * Même périmètre que l'édition (guilde + membre visé). L'audit conserve le corps
 * supprimé : une suppression n'efface jamais la trace de ce qui a été dit.
 */
export async function deleteMemberRegistryComment(
    guildId: string,
    subject: RegistrySubject,
    commentId: string
): Promise<ActionResponse<{ message: string }>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    const ctx = await getUserContext(guildId);
    if (!ctx.isAdmin && !ctx.canManageMembers) {
        return { success: false, error: "Permission 'Gérer les membres' requise" };
    }

    if (!subjectSchema.safeParse(subject).success) return { success: false, error: "Sujet invalide" };
    const parsedId = z.string().min(1).max(64).safeParse(commentId);
    if (!parsedId.success) return { success: false, error: "Commentaire invalide" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guild) return { success: false, error: "Guilde introuvable" };

        const target = resolveRegistryTarget(subject);
        const scope = commentScope(guild.id, target);
        const previous = await db.memberRegistryComment.findFirst({
            where: { id: parsedId.data, ...scope },
            select: { id: true, body: true },
        });
        if (!previous) return { success: false, error: "Commentaire introuvable sur cette fiche" };

        await db.memberRegistryComment.delete({ where: { id: previous.id } });

        await createAuditLog({
            guildId,
            actorUserId: session.user.id,
            actorName: ctx.name || "Staff",
            action: "MEMBER_COMMENT_DELETED",
            targetType: "USER_PROFILE",
            targetId: previous.id,
            oldValue: { body: previous.body },
            metadata: { source: "registre", kind: "registry_comment", commentId: previous.id },
        });

        return { success: true, data: { message: "Commentaire supprimé" } };
    } catch (err: unknown) {
        logger.error("[deleteMemberRegistryComment] Erreur:", err);
        return { success: false, error: "Erreur lors de la suppression du commentaire" };
    }
}
