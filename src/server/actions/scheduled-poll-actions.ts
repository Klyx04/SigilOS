"use server";

/**
 * Sondages **programmés** (module staff `scheduledPolls`) — server actions.
 *
 * Le module est **staff** : la porte d'entrée est `ctx.canSchedulePolls`, qui
 * encode **deux** conditions indissociables (même mécanique que les autres
 * modules) :
 * 1. le **module effectif** — toggle de guilde ET verrous God (plateforme ou
 *    guilde) sont déjà appliqués par `getUserContext` ⇒ module coupé = accès
 *    fermé, y compris pour un admin ;
 * 2. la **permission RBAC** `staff:scheduled_polls` (les admins Discord et le
 *    God passent).
 *
 * Les règles métier (3 créneaux maximum, minute unique, bornes de date) sont
 * pures et testées à part (`@/lib/polls/scheduling`) : ici on ne fait que les
 * **appliquer** avec le cloisonnement de guilde et le rate-limit.
 *
 * Le passage à l'échéance vit dans `src/server/scheduled-polls-core.ts` (core,
 * sans `"use server"`, puisqu'il n'a pas de garde d'accès propre).
 */

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUserContext } from "@/server/actions/user-actions";
import { createAuditLog } from "@/server/actions/audit-actions";
import { sanitizeHtml, sanitizeName } from "@/lib/security";
import { rateLimit } from "@/lib/ratelimit";
import {
    MAX_DURATION_HOURS,
    MAX_REPEAT_EVERY,
    MAX_REPEAT_UNTIL_DAYS,
    MAX_SCHEDULED_POLLS,
    MIN_DURATION_HOURS,
    REPEAT_EVERY_ERROR,
    REPEAT_UNTIL_ERROR,
    SLOT_LIMIT_ERROR,
    canScheduleAnotherPoll,
    findMinuteConflict,
    remainingSlots,
    validateScheduledAt,
} from "@/lib/polls/scheduling";
import {
    POLL_DESCRIPTION_MAX_LENGTH,
    POLL_DESCRIPTION_MIN_LENGTH,
    POLL_OPTION_LABEL_MAX_LENGTH,
    POLL_OPTION_MAX_COUNT,
    POLL_OPTION_MIN_COUNT,
    POLL_TITLE_MAX_LENGTH,
    POLL_TITLE_MIN_LENGTH,
} from "@/lib/polls/limits";

export type ScheduledPollResponse<T = unknown> = {
    success: boolean;
    error?: string;
    data?: T;
};

const POLL_CATEGORIES = ["SUGGESTION", "AMELIORATION", "EVENT", "MISSION", "AUTRE"] as const;

/** Bornes du formulaire : bornes **strictes**, jamais une valeur hors plage écrite en base. */
const CreateScheduledPollSchema = z.object({
    guildId: z.string().min(1),
    title: z.string().trim().min(POLL_TITLE_MIN_LENGTH, `Titre trop court (min ${POLL_TITLE_MIN_LENGTH} caractères)`).max(POLL_TITLE_MAX_LENGTH, `Titre trop long (max ${POLL_TITLE_MAX_LENGTH} caractères)`),
    description: z.string().trim().min(POLL_DESCRIPTION_MIN_LENGTH, `Description trop courte (min ${POLL_DESCRIPTION_MIN_LENGTH} caractères)`).max(POLL_DESCRIPTION_MAX_LENGTH, `Description trop longue (max ${POLL_DESCRIPTION_MAX_LENGTH} caractères)`),
    category: z.enum(POLL_CATEGORIES),
    options: z.array(z.object({
        label: z.string().trim().min(1).max(POLL_OPTION_LABEL_MAX_LENGTH),
        emoji: z.string().max(10).optional(),
    })).min(POLL_OPTION_MIN_COUNT, `Au moins ${POLL_OPTION_MIN_COUNT} choix`).max(POLL_OPTION_MAX_COUNT, `${POLL_OPTION_MAX_COUNT} choix maximum`),
    allowMultipleVotes: z.boolean().default(false),
    scheduledAt: z.string().datetime({ message: "Date de programmation invalide" }),
    durationHours: z.number().int().min(MIN_DURATION_HOURS).max(MAX_DURATION_HOURS).nullish(),
    // Répétition : « tous les N jours / semaines / mois », fin facultative.
    repeatEvery: z.number().int().min(1).max(MAX_REPEAT_EVERY).nullish(),
    repeatUnit: z.enum(["DAYS", "WEEKS", "MONTHS"]).nullish(),
    repeatUntil: z.string().datetime({ message: "Fin de répétition invalide" }).nullish(),
    mentionRoleIds: z.array(z.string().regex(/^\d{17,20}$/, "Rôle Discord invalide")).max(10).default([]),
    externalUrl: z.string().url().nullish().or(z.literal("")),
}).strict();

const UpdateScheduledPollSchema = CreateScheduledPollSchema.extend({
    slotId: z.string().min(1),
}).strict();

/** Accès staff : module effectif **et** permission, fail-closed. */
async function requireScheduledPollsStaff(discordGuildId: string): Promise<
    | { ok: true; userId: string; profileId: string | null; name: string; isAdmin: boolean }
    | { ok: false; error: string }
> {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Non authentifié" };

    const ctx = await getUserContext(discordGuildId);
    if (!ctx.isAuthenticated || !ctx.isMember) return { ok: false, error: "Accès refusé" };
    // `canSchedulePolls` = permission `staff:scheduled_polls` (ou admin) **ET**
    // module effectif (toggle de guilde + verrous God). Rien à recalculer ici.
    if (!ctx.canSchedulePolls) return { ok: false, error: "Permission requise : Sondages programmés." };

    return { ok: true, userId: session.user.id, profileId: ctx.profileId ?? null, name: ctx.name || "Staff", isAdmin: !!ctx.isAdmin };
}

// --- Paramètres (onglet Paramètres → Sondages, 2ᵉ encart) ---

/**
 * Accès aux **réglages du module** : soit un admin/`system:config` (encart de
 * Paramètres → Sondages), soit un rôle qui détient `staff:scheduled_polls`
 * (page du Centre de contrôle). Fail-closed : les deux échouent ⇒ refus.
 *
 * Pourquoi ce « ou » : le module est **staff**, sa configuration doit donc être
 * accessible au rôle qui le gère, sans lui ouvrir tout l'écran Paramètres.
 */
async function requireScheduledPollSettingsAccess(discordGuildId: string, context: string): Promise<{ ok: boolean; error?: string }> {
    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(discordGuildId, context);
    if (guard.isAuthorized) return { ok: true };

    const staff = await requireScheduledPollsStaff(discordGuildId);
    if (staff.ok) return { ok: true };

    return { ok: false, error: guard.error || staff.error || "Accès refusé" };
}

export async function getScheduledPollSettings(guildId: string): Promise<ScheduledPollResponse<{
    scheduledPollsChannelId: string | null;
    scheduledPollsPingRoleIds: string[];
    scheduledPollsDurationH: number | null;
}>> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const access = await requireScheduledPollSettingsAccess(guildId, "Lecture des paramètres de Sondages programmés");
    if (!access.ok) return { success: false, error: access.error };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { scheduledPollsChannelId: true, scheduledPollsPingRoleIds: true, scheduledPollsDurationH: true },
        });
        if (!config) return { success: false, error: "Guilde introuvable" };

        return {
            success: true,
            data: {
                scheduledPollsChannelId: config.scheduledPollsChannelId,
                scheduledPollsPingRoleIds: config.scheduledPollsPingRoleIds || [],
                scheduledPollsDurationH: config.scheduledPollsDurationH,
            },
        };
    } catch (error) {
        logger.error("[ScheduledPolls] getScheduledPollSettings error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

const UpdateScheduledPollSettingsSchema = z.object({
    scheduledPollsChannelId: z.string().regex(/^\d{17,20}$/, "Salon Discord invalide").nullable().optional(),
    scheduledPollsDurationH: z.number().int().min(MIN_DURATION_HOURS).max(MAX_DURATION_HOURS).nullable().optional(),
}).strict();

export async function updateScheduledPollSettings(
    guildId: string,
    rawData: unknown,
): Promise<ScheduledPollResponse> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    const parsed = UpdateScheduledPollSettingsSchema.safeParse(rawData);
    if (!parsed.success) return { success: false, error: "Données invalides" };

    const access = await requireScheduledPollSettingsAccess(guildId, "Mise à jour des paramètres de Sondages programmés");
    if (!access.ok) return { success: false, error: access.error };

    try {
        if (parsed.data.scheduledPollsChannelId) {
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const valid = await validateChannelBelongsToGuild(parsed.data.scheduledPollsChannelId, guildId);
            if (!valid) return { success: false, error: "Ce salon n'appartient pas à votre serveur Discord" };
        }

        const updateData: { scheduledPollsChannelId?: string | null; scheduledPollsDurationH?: number | null } = {};
        if (parsed.data.scheduledPollsChannelId !== undefined) {
            updateData.scheduledPollsChannelId = parsed.data.scheduledPollsChannelId;
        }
        if (parsed.data.scheduledPollsDurationH !== undefined) {
            updateData.scheduledPollsDurationH = parsed.data.scheduledPollsDurationH;
        }

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: updateData,
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        logger.error("[ScheduledPolls] updateScheduledPollSettings error", { error });
        return { success: false, error: "Erreur serveur" };
    }
}

// --- Créneaux (page staff « Sondages programmés ») ---

/** Cloisonnement : la guilde est résolue côté serveur, jamais depuis le client. */
async function getGuildOrThrow(discordGuildId: string) {
    return db.guildConfig.findUniqueOrThrow({
        where: { discordGuildId },
        select: {
            id: true,
            discordGuildId: true,
            scheduledPollsChannelId: true,
            scheduledPollsPingRoleIds: true,
            scheduledPollsDurationH: true,
        },
    });
}

export interface ScheduledPollSlotView {
    id: string;
    title: string;
    description: string | null;
    category: string;
    status: string;
    scheduledAt: string;
    durationHours: number | null;
    /** Répétition : intervalle + unité, et fin facultative (ISO). */
    repeatEvery: number | null;
    repeatUnit: string | null;
    repeatUntil: string | null;
    discordChannelId: string | null;
    mentionRoleIds: string[];
    mentionEveryone: boolean;
    allowMultipleVotes: boolean;
    externalUrl: string | null;
    options: { id: string; label: string; emoji: string | null; order: number }[];
    createdPollId: string | null;
    lastError: string | null;
    publishedAt: string | null;
    cancelledAt: string | null;
    creatorName: string;
}

export interface ScheduledPollBoard {
    slots: ScheduledPollSlotView[];
    /** Créneaux en attente (ils occupent une place). */
    pendingCount: number;
    /** Places restantes avant le plafond. */
    slotsLeft: number;
    maxSlots: number;
    /** Durée de vote par défaut des paramètres (proposée dans le formulaire). */
    defaultDurationH: number | null;
    /** Salon par défaut des paramètres (indiqué à côté du sélecteur). */
    defaultChannelId: string | null;
}

/**
 * Validation commune création/modification : bornes de date, minute libre,
 * plafond de créneaux et pings whitelistés. Le **salon** n'est plus validé ici :
 * ce n'est plus un champ du créneau (réglage de guilde, Paramètres → Sondages).
 * Toute règle métier vient de `@/lib/polls/scheduling` (testée) ; ici on la
 * confronte à l'état réel de la guilde.
 */
async function validateSlot(
    data: z.infer<typeof CreateScheduledPollSchema>,
    guild: Awaited<ReturnType<typeof getGuildOrThrow>>,
    discordGuildId: string,
    ignoreId?: string,
): Promise<
    | { ok: true; scheduledAt: Date; mentionRoleId: string | null; repeatEvery: number | null; repeatUnit: "DAYS" | "WEEKS" | "MONTHS" | null; repeatUntil: Date | null }
    | { ok: false; error: string }
> {
    const when = new Date(data.scheduledAt);
    const bounds = validateScheduledAt(when);
    if (!bounds.ok) return { ok: false, error: bounds.error || "Date invalide" };

    // Répétition : soit rien, soit un couple intervalle + unité (jamais un demi-état).
    let repeatEvery: number | null = null;
    let repeatUnit: "DAYS" | "WEEKS" | "MONTHS" | null = null;
    let repeatUntil: Date | null = null;
    if (data.repeatEvery || data.repeatUnit || data.repeatUntil) {
        if (!data.repeatEvery || !data.repeatUnit) {
            return { ok: false, error: "Répétition incomplète : choisissez un intervalle et une unité." };
        }
        if (data.repeatEvery < 1 || data.repeatEvery > MAX_REPEAT_EVERY) {
            return { ok: false, error: REPEAT_EVERY_ERROR };
        }
        repeatEvery = data.repeatEvery;
        repeatUnit = data.repeatUnit;

        if (data.repeatUntil) {
            const until = new Date(data.repeatUntil);
            if (Number.isNaN(until.getTime()) || until.getTime() <= when.getTime()) {
                return { ok: false, error: "La fin de répétition doit être postérieure au premier créneau." };
            }
            if ((until.getTime() - Date.now()) / 86_400_000 > MAX_REPEAT_UNTIL_DAYS) {
                return { ok: false, error: REPEAT_UNTIL_ERROR };
            }
            repeatUntil = until;
        }
    }

    const pending = await db.scheduledPoll.findMany({
        where: { guildId: guild.id, status: { in: ["SCHEDULED", "PUBLISHING"] } },
        select: { id: true, scheduledAt: true },
    });

    // Plafond : création seulement (une modification ne consomme pas de place).
    if (!ignoreId && !canScheduleAnotherPoll(pending.length)) {
        return { ok: false, error: SLOT_LIMIT_ERROR };
    }

    const conflict = findMinuteConflict(when, pending, ignoreId);
    if (conflict) {
        return { ok: false, error: "Un sondage programmé occupe déjà ce créneau (même date, même heure, même minute)." };
    }

    // ⛔ Salon : réglage de **guilde** (Paramètres → Sondages), plus un choix du
    // créneau (14/10/2026). Le créneau ne porte donc plus de salon : le moteur
    // publie dans `guild.scheduledPollsChannelId` (et refuse d'office si vide).
    // 🔒 SECURITY: whitelist des rôles de ping appliquée identiquement aux
    // admins et au staff (fail-closed, pattern du module Sondages).
    const allowedRoleIds: string[] = guild.scheduledPollsPingRoleIds || [];
    const invalidRoles = data.mentionRoleIds.filter((id) => !allowedRoleIds.includes(id));
    if (invalidRoles.length > 0) {
        logger.error(`[Security] Ping de rôle(s) non whitelisté(s) ${invalidRoles.join(", ")} (Sondages programmés)`);
    }
    const kept = data.mentionRoleIds.filter((id) => allowedRoleIds.includes(id));

    return { ok: true, scheduledAt: when, mentionRoleId: kept.length > 0 ? kept.join(",") : null, repeatEvery, repeatUnit, repeatUntil };
}

/**
 * Tableau de bord staff : les créneaux de la guilde (en attente **et** passés,
 * pour la traçabilité), les places restantes et les défauts de configuration.
 */
export async function getScheduledPolls(guildId: string): Promise<ScheduledPollResponse<ScheduledPollBoard>> {
    const access = await requireScheduledPollsStaff(guildId);
    if (!access.ok) return { success: false, error: access.error };

    try {
        const guild = await getGuildOrThrow(guildId);

        const slots = await db.scheduledPoll.findMany({
            where: { guildId: guild.id },
            include: { options: { orderBy: { order: "asc" } } },
            orderBy: [{ scheduledAt: "desc" }],
            take: 100,
        });

        const pendingCount = slots.filter((s) => s.status === "SCHEDULED" || s.status === "PUBLISHING").length;

        return {
            success: true,
            data: {
                slots: slots.map((slot) => ({
                    id: slot.id,
                    title: slot.title,
                    description: slot.description,
                    category: slot.category,
                    status: slot.status,
                    scheduledAt: slot.scheduledAt.toISOString(),
                    durationHours: slot.durationHours,
                    repeatEvery: slot.repeatEvery,
                    repeatUnit: slot.repeatUnit,
                    repeatUntil: slot.repeatUntil ? slot.repeatUntil.toISOString() : null,
                    discordChannelId: slot.discordChannelId,
                    mentionRoleIds: slot.mentionRoleId ? slot.mentionRoleId.split(",").filter(Boolean) : [],
                    mentionEveryone: slot.mentionEveryone,
                    allowMultipleVotes: slot.allowMultipleVotes,
                    externalUrl: slot.externalUrl,
                    options: slot.options.map((o) => ({ id: o.id, label: o.label, emoji: o.emoji, order: o.order })),
                    createdPollId: slot.createdPollId,
                    lastError: slot.lastError,
                    publishedAt: slot.publishedAt ? slot.publishedAt.toISOString() : null,
                    cancelledAt: slot.cancelledAt ? slot.cancelledAt.toISOString() : null,
                    creatorName: slot.creatorName,
                })),
                pendingCount,
                slotsLeft: remainingSlots(pendingCount),
                maxSlots: MAX_SCHEDULED_POLLS,
                defaultDurationH: guild.scheduledPollsDurationH,
                defaultChannelId: guild.scheduledPollsChannelId,
            },
        };
    } catch (error) {
        logger.error("[ScheduledPolls] getScheduledPolls error", { error, guildId });
        return { success: false, error: "Erreur serveur" };
    }
}


export async function createScheduledPoll(rawData: unknown): Promise<ScheduledPollResponse<{ slotId: string }>> {
    const parsed = CreateScheduledPollSchema.safeParse(rawData);
    if (!parsed.success) {
        return { success: false, error: "Données invalides : " + (parsed.error.issues[0]?.message || "champ refusé") };
    }
    const data = parsed.data;

    const access = await requireScheduledPollsStaff(data.guildId);
    if (!access.ok) return { success: false, error: access.error };
    if (!access.profileId) return { success: false, error: "Profil introuvable" };

    const limited = await rateLimit(`scheduled-poll:create:${access.userId}`, 5, 60_000);
    if (!limited.success) return { success: false, error: "Trop de créneaux créés, réessaie dans une minute." };

    try {
        const guild = await getGuildOrThrow(data.guildId);
        const checked = await validateSlot(data, guild, data.guildId);
        if (!checked.ok) return { success: false, error: checked.error };

        const slot = await db.scheduledPoll.create({
            data: {
                guildId: guild.id,
                createdById: access.profileId,
                creatorName: access.name,
                title: sanitizeName(data.title, 200) || data.title,
                description: sanitizeHtml(data.description || null, 2000) || null,
                category: data.category,
                options: {
                    create: data.options.map((opt, index) => ({
                        label: sanitizeName(opt.label, 200) || opt.label,
                        emoji: opt.emoji || null,
                        order: index,
                    })),
                },
                allowMultipleVotes: data.allowMultipleVotes,
                // ⛔ Anonymat retiré (14/10/2026) : le champ n'est plus accepté
                // (schéma `.strict()`) et aucun sondage anonyme n'est créé.
                isAnonymous: false,
                externalUrl: data.externalUrl || null,
                scheduledAt: checked.scheduledAt,
                durationHours: data.durationHours ?? null,
                repeatEvery: checked.repeatEvery,
                repeatUnit: checked.repeatUnit,
                repeatUntil: checked.repeatUntil,
                // ⛔ Plus de salon par créneau : la publication suit le réglage de
                // guilde (Paramètres → Sondages). Un créneau d'avant garde le sien
                // (il reste prioritaire côté moteur), on ne le réécrit plus.
                discordChannelId: null,
                // Jamais @everyone depuis un créneau (même règle que le
                // formulaire du module Sondages) : seuls les rôles whitelistés.
                mentionEveryone: false,
                mentionRoleId: checked.mentionRoleId,
            },
            select: { id: true },
        });

        await createAuditLog({
            guildId: data.guildId,
            actorUserId: access.userId,
            actorName: access.name,
            action: "SCHEDULED_POLL_CREATED",
            targetType: "SCHEDULED_POLL",
            targetId: slot.id,
            metadata: {
                title: data.title,
                category: data.category,
                scheduledAt: checked.scheduledAt.toISOString(),
                optionsCount: data.options.length,
            },
        });

        revalidatePath(`/dashboard/${data.guildId}/admin/sondages-programmes`);
        return { success: true, data: { slotId: slot.id } };
    } catch (error) {
        // Course perdue sur la contrainte d'unicité (guildId, scheduledAt).
        if ((error as { code?: string })?.code === "P2002") {
            return { success: false, error: "Ce créneau est déjà pris (même date, même minute)." };
        }
        logger.error("[ScheduledPolls] createScheduledPoll error", { error, guildId: data.guildId });
        return { success: false, error: "Erreur lors de la création du créneau" };
    }
}

export async function updateScheduledPoll(rawData: unknown): Promise<ScheduledPollResponse> {
    const parsed = UpdateScheduledPollSchema.safeParse(rawData);
    if (!parsed.success) {
        return { success: false, error: "Données invalides : " + (parsed.error.issues[0]?.message || "champ refusé") };
    }
    const data = parsed.data;

    const access = await requireScheduledPollsStaff(data.guildId);
    if (!access.ok) return { success: false, error: access.error };

    try {
        const guild = await getGuildOrThrow(data.guildId);
        const existing = await db.scheduledPoll.findUnique({
            where: { id: data.slotId },
            select: { id: true, guildId: true, status: true },
        });
        if (!existing) return { success: false, error: "Créneau introuvable" };
        // 🔒 SECURITY: cloisonnement de guilde — la cible doit appartenir à la guilde.
        if (existing.guildId !== guild.id) {
            logger.error(`[Security] Cross-guild scheduled slot update attempt! User ${access.userId} tried ${data.slotId}`);
            return { success: false, error: "Accès refusé" };
        }
        if (existing.status !== "SCHEDULED") {
            return { success: false, error: "Seul un créneau en attente peut être modifié." };
        }

        const checked = await validateSlot(data, guild, data.guildId, existing.id);
        if (!checked.ok) return { success: false, error: checked.error };

        await db.$transaction(async (tx) => {
            await tx.scheduledPollOption.deleteMany({ where: { scheduledPollId: existing.id } });
            await tx.scheduledPoll.update({
                where: { id: existing.id },
                data: {
                    title: sanitizeName(data.title, 200) || data.title,
                    description: sanitizeHtml(data.description || null, 2000) || null,
                    category: data.category,
                    allowMultipleVotes: data.allowMultipleVotes,
                    isAnonymous: false,
                    externalUrl: data.externalUrl || null,
                    scheduledAt: checked.scheduledAt,
                    durationHours: data.durationHours ?? null,
                    repeatEvery: checked.repeatEvery,
                    repeatUnit: checked.repeatUnit,
                    repeatUntil: checked.repeatUntil,
                    discordChannelId: null,
                    mentionRoleId: checked.mentionRoleId,
                    options: {
                        create: data.options.map((opt, index) => ({
                            label: sanitizeName(opt.label, 200) || opt.label,
                            emoji: opt.emoji || null,
                            order: index,
                        })),
                    },
                },
            });
        });

        await createAuditLog({
            guildId: data.guildId,
            actorUserId: access.userId,
            actorName: access.name,
            action: "SCHEDULED_POLL_UPDATED",
            targetType: "SCHEDULED_POLL",
            targetId: existing.id,
            metadata: { title: data.title, scheduledAt: checked.scheduledAt.toISOString() },
        });

        revalidatePath(`/dashboard/${data.guildId}/admin/sondages-programmes`);
        return { success: true };
    } catch (error) {
        if ((error as { code?: string })?.code === "P2002") {
            return { success: false, error: "Ce créneau est déjà pris (même date, même minute)." };
        }
        logger.error("[ScheduledPolls] updateScheduledPoll error", { error, slotId: data.slotId });
        return { success: false, error: "Erreur lors de la modification du créneau" };
    }
}

export async function cancelScheduledPoll(guildId: string, slotId: string): Promise<ScheduledPollResponse> {
    const access = await requireScheduledPollsStaff(guildId);
    if (!access.ok) return { success: false, error: access.error };

    try {
        const guild = await getGuildOrThrow(guildId);
        const slot = await db.scheduledPoll.findUnique({
            where: { id: slotId },
            select: { id: true, guildId: true, status: true, title: true },
        });
        if (!slot) return { success: false, error: "Créneau introuvable" };
        if (slot.guildId !== guild.id) return { success: false, error: "Accès refusé" };
        if (slot.status !== "SCHEDULED" && slot.status !== "PUBLISHING") {
            return { success: false, error: "Ce créneau n'est plus en attente : il n'y a rien à annuler." };
        }

        // Garde d'état : deux annulations simultanées ne font pas d'écriture fantôme.
        const cancelled = await db.scheduledPoll.updateMany({
            where: { id: slotId, status: { in: ["SCHEDULED", "PUBLISHING"] } },
            data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: access.profileId },
        });
        if (cancelled.count === 0) {
            return { success: false, error: "Ce créneau vient d'être traité (publié ou annulé)." };
        }

        await createAuditLog({
            guildId,
            actorUserId: access.userId,
            actorName: access.name,
            action: "SCHEDULED_POLL_CANCELLED",
            targetType: "SCHEDULED_POLL",
            targetId: slotId,
            metadata: { title: slot.title },
        });

        revalidatePath(`/dashboard/${guildId}/admin/sondages-programmes`);
        return { success: true };
    } catch (error) {
        logger.error("[ScheduledPolls] cancelScheduledPoll error", { error, slotId });
        return { success: false, error: "Erreur lors de l'annulation du créneau" };
    }
}

/**
 * « Publier maintenant » : suit **exactement** le chemin du cron (revendication
 * atomique puis publication) — il n'existe qu'une seule façon de publier un
 * sondage programmé, donc un seul jeu de règles (verrou God, salon, mentions).
 */
export async function publishScheduledPollNow(guildId: string, slotId: string): Promise<ScheduledPollResponse<{ pollId?: string }>> {
    const access = await requireScheduledPollsStaff(guildId);
    if (!access.ok) return { success: false, error: access.error };

    const limited = await rateLimit(`scheduled-poll:publish:${access.userId}`, 10, 60_000);
    if (!limited.success) return { success: false, error: "Trop de publications rapprochées — patiente une minute." };

    try {
        const guild = await getGuildOrThrow(guildId);
        const slot = await db.scheduledPoll.findUnique({
            where: { id: slotId },
            select: { id: true, guildId: true, status: true, title: true },
        });
        if (!slot) return { success: false, error: "Créneau introuvable" };
        if (slot.guildId !== guild.id) return { success: false, error: "Accès refusé" };
        if (slot.status !== "SCHEDULED") {
            return { success: false, error: "Ce créneau a déjà été publié, annulé ou est en cours de traitement." };
        }

        const { publishScheduledSlotNow } = await import("@/server/scheduled-polls-core");
        const result = await publishScheduledSlotNow(slotId);
        if (!result.success) return { success: false, error: result.error };

        const published = await db.scheduledPoll.findUnique({ where: { id: slotId }, select: { createdPollId: true } });

        await createAuditLog({
            guildId,
            actorUserId: access.userId,
            actorName: access.name,
            action: "SCHEDULED_POLL_PUBLISHED",
            targetType: "SCHEDULED_POLL",
            targetId: slotId,
            metadata: { title: slot.title, pollId: published?.createdPollId ?? null, manual: true },
        });

        revalidatePath(`/dashboard/${guildId}/admin/sondages-programmes`);
        revalidatePath(`/dashboard/${guildId}/sondages`);
        return { success: true, data: { pollId: published?.createdPollId ?? undefined } };
    } catch (error) {
        logger.error("[ScheduledPolls] publishScheduledPollNow error", { error, slotId });
        return { success: false, error: "Erreur lors de la publication du créneau" };
    }
}
