"use server";

/**
 * Chantier Y (lot Y-3) — réglages « Rôles automatiques par ancienneté » : lecture et écriture.
 *
 * Les types, les bornes et les règles pures vivent dans `src/lib/seniority-roles.ts` (un
 * fichier `"use server"` ne peut exporter que des fonctions async). Ici : l'auth, la
 * validation Zod **bornée**, le rate limit, la vérification du salon et l'écriture.
 *
 * Toute écriture exige `canManageMembers` (ou admin) — **le même drapeau que l'onglet**,
 * revérifié côté serveur : masquer un onglet ne ferme pas une action (fail-closed).
 */

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { getUserContext } from "@/server/actions/user-actions";
import { computeSeniorityDays, resolveJoinedAt } from "@/lib/member-registry";
import { normalizeDiscordAvatarUrl } from "@/lib/discord-avatars";
import {
    SENIORITY_ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH,
    SENIORITY_ANNOUNCEMENT_EXTRA_VARIABLES,
    SENIORITY_ANNOUNCEMENT_MESSAGE_MAX_LENGTH,
    SENIORITY_ANNOUNCEMENT_TITLE_MAX_LENGTH,
    SENIORITY_ANNOUNCEMENT_VARIABLE_ALIASES,
    SENIORITY_ANNOUNCEMENT_VARIABLES,
    SENIORITY_ROLES_MAX_DAYS,
    SENIORITY_ROLES_MAX_ROLES_PER_TIER,
    SENIORITY_ROLES_MAX_TIERS,
    SENIORITY_ROLES_MIN_DAYS,
    SENIORITY_UPCOMING_WINDOW_DAYS,
    findUnknownAnnouncementVariables,
    mergeSeniorityRolesConfig,
    normalizeSeniorityTiers,
    resolveSeniorityRoleTier,
    resolveUpcomingTierChange,
    type SeniorityAnnouncementConfig,
    type SeniorityTier,
} from "@/lib/seniority-roles";

/** Plafond d'affichage de la liste « Prochains paliers » : l'écran reste lisible. */
const MAX_UPCOMING = 25;

/**
 * Rappel lisible des variables **réellement** remplacées. Mesure du 18/10/2026 : `{rôles}`
 * accentué traînait dans une configuration réelle et s'affichait littéralement dans l'embed.
 * L'alias est toléré, la faute de frappe restante est signalée à l'enregistrement.
 */
const KNOWN_ANNOUNCEMENT_VARIABLES = [
    ...SENIORITY_ANNOUNCEMENT_VARIABLES,
    ...Object.keys(SENIORITY_ANNOUNCEMENT_VARIABLE_ALIASES),
    ...SENIORITY_ANNOUNCEMENT_EXTRA_VARIABLES,
]
    .map((variable) => `{${variable}}`)
    .join(", ");

/** Fenêtre d'anti-rafale du bouton « Synchroniser maintenant » (une passe coûte des appels Discord). */
const SYNC_COOLDOWN_SECONDS = 5 * 60;

/** Identifiant Discord (snowflake) — même borne que le reste du dépôt. */
const SNOWFLAKE = z.string().regex(/^\d{17,20}$/, "Identifiant Discord invalide");

/** Bornes partagées avec la règle pure : jamais une valeur que la règle refuserait ensuite. */
const SETTINGS_SCHEMA = z
    .object({
        enabled: z.boolean(),
        tiers: z
            .array(
                z.object({
                    days: z.number().int().min(SENIORITY_ROLES_MIN_DAYS).max(SENIORITY_ROLES_MAX_DAYS),
                    roleIds: z.array(SNOWFLAKE).min(1).max(SENIORITY_ROLES_MAX_ROLES_PER_TIER),
                    // Texte propre au palier (facultatif) : mêmes bornes que le message global.
                    // Un champ absent ou vide n'est pas une surcharge : c'est un héritage.
                    announcement: z
                        .object({
                            messageTemplate: z
                                .string()
                                .trim()
                                .min(1)
                                .max(SENIORITY_ANNOUNCEMENT_MESSAGE_MAX_LENGTH)
                                .optional(),
                            embedTitle: z
                                .string()
                                .trim()
                                .min(1)
                                .max(SENIORITY_ANNOUNCEMENT_TITLE_MAX_LENGTH)
                                .optional(),
                            embedDescription: z
                                .string()
                                .trim()
                                .min(1)
                                .max(SENIORITY_ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH)
                                .optional(),
                        })
                        .strict()
                        .optional(),
                }),
            )
            .max(SENIORITY_ROLES_MAX_TIERS),
        announcement: z.object({
            messageTemplate: z.string().trim().min(1).max(SENIORITY_ANNOUNCEMENT_MESSAGE_MAX_LENGTH),
            embedTitle: z.string().trim().min(1).max(SENIORITY_ANNOUNCEMENT_TITLE_MAX_LENGTH),
            embedDescription: z.string().trim().min(1).max(SENIORITY_ANNOUNCEMENT_DESCRIPTION_MAX_LENGTH),
            color: z.number().int().min(0).max(0xffffff),
            thumbnail: z.enum(["avatar", "guild", "none"]),
        }),
    })
    .strict();

/** Un membre qui franchira bientôt son prochain palier (vue informative, aucune action). */
export interface UpcomingSeniorityMember {
    displayName: string;
    avatarUrl: string | null;
    seniorityDays: number;
    /** Seuil du palier visé. */
    tierDays: number;
    /** Jours restants avant de le franchir. */
    daysUntil: number;
}

export interface SeniorityRolesSettingsPayload {
    enabled: boolean;
    channelId: string | null;
    tiers: SeniorityTier[];
    announcement: SeniorityAnnouncementConfig;
    /** Marqueur d'activation : `null` tant que le module n'a jamais été mis en service. */
    activatedAt: string | null;
    /** Nom de la guilde — sert l'aperçu du message (variable `{guilde}`). */
    guildName: string;
    /** Icône de la guilde — sert l'aperçu quand la miniature est « icône de guilde ». */
    guildIconUrl: string | null;
    /** Répartition **lue à l'instant** : membres actifs ayant atteint chaque palier (index de `tiers`). */
    tierCounts: number[];
    /** Membres actifs sous le premier palier. */
    belowFirstTier: number;
    /** Membres qui franchiront un palier dans les `SENIORITY_UPCOMING_WINDOW_DAYS` jours, du plus proche au plus lointain. */
    upcoming: UpcomingSeniorityMember[];
    /** Nombre total avant plafond d'affichage (pour dire « 25 affichés sur 42 »). */
    upcomingTotal: number;
    announcements: { total: number; lastAt: string | null };
    /** Dernière passe connue du robot (télémétrie des crons) — `null` si jamais passée. */
    lastRun: { at: string | null; status: string; summary: string | null } | null;
}

/** Garde commune lecture/écriture : le drapeau de l'onglet, revérifié ici. */
async function requireMemberManager(guildId: string) {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.isMember) return { allowed: false as const, error: "Non autorisé" };
    const allowed = !!ctx.isAdmin || !!ctx.canManageMembers;
    return {
        allowed,
        error: allowed ? null : "Permission requise (Gestion des membres)",
        ctx,
    };
}

/** Lecture des réglages **et** de l'état lisible (répartition, annonces, dernière passe). */
export async function getSeniorityRolesSettings(guildId: string) {
    const access = await requireMemberManager(guildId);
    if (!access.allowed) return { success: false as const, error: access.error };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: {
                id: true,
                name: true,
                iconUrl: true,
                seniorityRolesEnabled: true,
                seniorityRolesChannelId: true,
                seniorityRolesTiers: true,
                seniorityRolesAnnouncement: true,
                seniorityRolesActivatedAt: true,
            },
        });
        if (!guild) return { success: false as const, error: "Guilde introuvable" };

        const config = mergeSeniorityRolesConfig(guild);

        // Répartition : **une** lecture des membres actifs, puis un calcul pur (jamais une
        // requête par membre). Les paliers relus sont déjà triés par `mergeSeniorityRolesConfig`.
        const profiles = await db.userProfile.findMany({
            where: { guildId: guild.id, status: "ACTIVE" },
            select: {
                guildJoinedAt: true,
                discordJoinedAt: true,
                createdAt: true,
                pseudoDofus: true,
                discordNickname: true,
                user: { select: { name: true, image: true } },
            },
        });
        const now = new Date();
        const tierCounts = config.tiers.map(() => 0);
        let belowFirstTier = 0;
        const upcomingCandidates: UpcomingSeniorityMember[] = [];

        for (const profile of profiles) {
            const joinedAtIso = resolveJoinedAt({
                guildJoinedAt: profile.guildJoinedAt ? profile.guildJoinedAt.toISOString() : null,
                discordJoinedAt: profile.discordJoinedAt ? profile.discordJoinedAt.toISOString() : null,
                createdAt: profile.createdAt.toISOString(),
            });
            const seniorityDays = computeSeniorityDays(joinedAtIso, now);
            const tierIndex = resolveSeniorityRoleTier(config.tiers, seniorityDays);
            if (tierIndex < 0) belowFirstTier += 1;
            else tierCounts[tierIndex] += 1;

            // « Prochains paliers » : seulement ceux qui franchiront un palier **bientôt**
            // (fenêtre de 30 jours). Vue informative : rien n'est écrit, rien n'est annoncé.
            const upcomingTier = resolveUpcomingTierChange({ tiers: config.tiers, seniorityDays });
            if (upcomingTier && upcomingTier.daysUntil <= SENIORITY_UPCOMING_WINDOW_DAYS) {
                upcomingCandidates.push({
                    displayName: profile.pseudoDofus || profile.discordNickname || profile.user?.name || "Membre",
                    avatarUrl: normalizeDiscordAvatarUrl(profile.user?.image ?? null, 64),
                    seniorityDays,
                    tierDays: upcomingTier.tierDays,
                    daysUntil: upcomingTier.daysUntil,
                });
            }
        }

        // Du plus proche au plus lointain, puis alphabétique — et plafonné pour l'écran.
        const upcomingTotal = upcomingCandidates.length;
        const upcoming = upcomingCandidates
            .sort((a, b) => a.daysUntil - b.daysUntil || a.displayName.localeCompare(b.displayName))
            .slice(0, MAX_UPCOMING);

        const [announcementTotal, lastAnnouncement] = await Promise.all([
            db.seniorityRoleAnnouncement.count({ where: { guildId: guild.id } }),
            db.seniorityRoleAnnouncement.findFirst({
                where: { guildId: guild.id },
                orderBy: { announcedAt: "desc" },
                select: { announcedAt: true },
            }),
        ]);

        // Dernière passe : télémétrie des crons. **Jamais bloquante** — un écran de réglages
        // ne dépend pas de l'observabilité (Redis muet ⇒ on ne l'affiche simplement pas).
        let lastRun: SeniorityRolesSettingsPayload["lastRun"] = null;
        try {
            const { getAllCronStatuses } = await import("@/lib/cron-telemetry");
            const record = (await getAllCronStatuses()).find((entry) => entry.id === "seniority_roles");
            if (record) lastRun = { at: record.lastRun, status: record.status, summary: record.summary };
        } catch (error) {
            logger.warn("[SeniorityRoles] Télémétrie du cron illisible (non bloquant)", { error: String(error) });
        }

        const data: SeniorityRolesSettingsPayload = {
            ...config,
            activatedAt: guild.seniorityRolesActivatedAt ? guild.seniorityRolesActivatedAt.toISOString() : null,
            guildName: guild.name,
            guildIconUrl: guild.iconUrl,
            tierCounts,
            belowFirstTier,
            upcoming,
            upcomingTotal,
            announcements: {
                total: announcementTotal,
                lastAt: lastAnnouncement?.announcedAt.toISOString() ?? null,
            },
            lastRun,
        };

        return { success: true as const, data };
    } catch (e) {
        logger.error("[getSeniorityRolesSettings] error:", e);
        return { success: false as const, error: "Erreur serveur" };
    }
}

/**
 * Écriture des réglages — **mêmes bornes que la règle pure** (Zod), salon vérifié auprès de
 * Discord, rate limit par utilisateur, et marqueur d'activation posé **une seule fois**.
 */
export async function updateSeniorityRolesSettings(guildId: string, input: unknown) {
    const access = await requireMemberManager(guildId);
    if (!access.allowed) return { success: false as const, error: access.error };

    const limit = await rateLimit(`seniority-roles-config:${access.ctx?.id ?? "anon"}`, 10, 60_000);
    if (!limit.success) {
        return { success: false as const, error: "Trop de modifications d'affilée : réessaie dans une minute" };
    }

    const parsed = SETTINGS_SCHEMA.safeParse(input);
    if (!parsed.success) {
        return { success: false as const, error: "Configuration invalide : vérifie les seuils et les rôles" };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, seniorityRolesActivatedAt: true },
        });
        if (!guild) return { success: false as const, error: "Guilde introuvable" };

        // Marqueur d'activation : posé **à la première mise en service**, jamais déplacé.
        // Il sépare un franchissement à fêter d'un rattrapage (lot Y-2) : le déplacer ferait
        // refêter des paliers déjà passés.
        const activatedAt = guild.seniorityRolesActivatedAt ?? (parsed.data.enabled ? new Date() : null);

        // 🔎 Variables inconnues : on **enregistre quand même** (le texte reste modifiable), mais
        // on le dit. Sans cet avertissement, une faute de frappe s'affiche dans l'embed public.
        const templates = [
            parsed.data.announcement.messageTemplate,
            parsed.data.announcement.embedTitle,
            parsed.data.announcement.embedDescription,
            ...parsed.data.tiers.flatMap((tier) => [
                tier.announcement?.messageTemplate,
                tier.announcement?.embedTitle,
                tier.announcement?.embedDescription,
            ]),
        ].filter((value): value is string => typeof value === "string" && value.length > 0);
        const unknownVariables = [
            ...new Set(templates.flatMap((template) => findUnknownAnnouncementVariables(template))),
        ];
        const warnings = unknownVariables.map(
            (name) =>
                `Variable inconnue « {${name}} » : elle restera affichée telle quelle. Variables valides : ${KNOWN_ANNOUNCEMENT_VARIABLES}.`,
        );

        await db.guildConfig.update({
            where: { id: guild.id },
            data: {
                seniorityRolesEnabled: parsed.data.enabled,
                // On stocke **normalisé** (trié, dédoublonné, borné) : la base ne contient
                // jamais une config que la règle devrait ensuite rattraper.
                seniorityRolesTiers: normalizeSeniorityTiers(parsed.data.tiers) as unknown as Prisma.InputJsonValue,
                seniorityRolesAnnouncement: parsed.data.announcement as unknown as Prisma.InputJsonValue,
                seniorityRolesActivatedAt: activatedAt,
            },
        });

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true as const, warnings };
    } catch (e) {
        logger.error("[updateSeniorityRolesSettings] error:", e);
        return { success: false as const, error: "Erreur serveur" };
    }
}

const CHANNEL_SCHEMA = z
    .object({
        channelId: SNOWFLAKE.nullable(),
    })
    .strict();

/**
 * Réglage du **salon de l'annonce** — écrit par l'onglet `Paramètres → Ancienneté`, là où tous les
 * salons du dépôt se déclarent.
 *
 * Pourquoi une action à part : **une porte par réglage**. L'onglet Membres n'écrit plus ce champ (il
 * n'en a plus l'éditeur) et cette action n'écrit que celui-là — aucun des deux écrans ne peut donc
 * écraser les réglages de l'autre.
 */
export async function updateSeniorityRolesChannel(guildId: string, input: unknown) {
    const access = await requireMemberManager(guildId);
    if (!access.allowed) return { success: false as const, error: access.error };

    const limit = await rateLimit(`seniority-roles-channel:${access.ctx?.id ?? "anon"}`, 10, 60_000);
    if (!limit.success) {
        return { success: false as const, error: "Trop de modifications d'affilée : réessaie dans une minute" };
    }

    const parsed = CHANNEL_SCHEMA.safeParse(input);
    if (!parsed.success) return { success: false as const, error: "Salon invalide" };

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guild) return { success: false as const, error: "Guilde introuvable" };

        if (parsed.data.channelId) {
            // 🔒 Isolation : un salon d'une autre guilde (ou inexistant) est refusé ici, pas
            // seulement masqué à l'écran.
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const valid = await validateChannelBelongsToGuild(parsed.data.channelId, guildId);
            if (!valid) return { success: false as const, error: "Ce salon n'appartient pas à votre serveur Discord" };
        }

        await db.guildConfig.update({
            where: { id: guild.id },
            data: { seniorityRolesChannelId: parsed.data.channelId },
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return { success: true as const };
    } catch (e) {
        logger.error("[updateSeniorityRolesChannel] error:", e);
        return { success: false as const, error: "Erreur serveur" };
    }
}

/**
 * « Synchroniser maintenant » — passe **à la demande**, sur une seule guilde.
 *
 * Pourquoi une action dédiée : le cron est quotidien et son résumé vivait hors de l'écran ;
 * l'administrateur ne pouvait donc jamais vérifier qu'un réglage produisait un effet. Cette
 * passe renvoie le bilan **complet** (membres lus, rôles posés, paliers silencieux) — c'est
 * aussi elle qui déclenche le **rattrapage**, jamais le cron (un déploiement ne doit pas
 * inonder un salon).
 *
 * Garde-fous : même drapeau que l'onglet (`canManageMembers`), `rateLimit` 1 passe / 5 min
 * par guilde (une passe coûte un appel paginé + une écriture par rôle modifié).
 */
export async function syncSeniorityRolesNow(
    guildId: string,
    options: { announceRetroactive?: boolean } = {},
) {
    const access = await requireMemberManager(guildId);
    if (!access.allowed) return { success: false as const, error: access.error };

    const limit = await rateLimit(`seniority-sync:${guildId}`, 1, SYNC_COOLDOWN_SECONDS);
    if (!limit.success) {
        return {
            success: false as const,
            error: "Une synchronisation vient d'être lancée : réessaie dans quelques minutes",
        };
    }

    try {
        const guild = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guild) return { success: false as const, error: "Guilde introuvable" };

        const { syncSeniorityRolesCore } = await import("@/server/seniority-roles-core");
        const result = await syncSeniorityRolesCore({
            onlyGuildId: guild.id,
            announceRetroactive: options.announceRetroactive === true,
        });

        revalidatePath(`/dashboard/${guildId}/admin/members`);
        return {
            success: result.guildsErrored === 0,
            error: result.errors[0] ?? null,
            summary: {
                processed: result.guildsProcessed,
                skipped: result.guildsSkipped,
                errored: result.guildsErrored,
                membersChecked: result.membersChecked,
                membersUnregistered: result.membersUnregistered,
                rolesAdded: result.rolesAdded,
                rolesRemoved: result.rolesRemoved,
                announcementsSent: result.announcementsSent,
                retroactiveTiersMuted: result.retroactiveTiersMuted,
                retroactiveAnnouncementsSent: result.retroactiveAnnouncementsSent,
                retroactiveAnnouncementsPending: result.retroactiveAnnouncementsPending,
            },
            details: result.details,
        };
    } catch (e) {
        logger.error("[syncSeniorityRolesNow] error:", e);
        return { success: false as const, error: "Erreur serveur" };
    }
}