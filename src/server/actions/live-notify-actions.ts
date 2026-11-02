"use server";

/**
 * Réglages des **annonces de live** — salon + rôles à ping, décidés par le staff de la guilde.
 *
 * 📌 Décision du 02/11/2026 : le salon est **explicite** (`null` = module éteint) et le ping est
 * **choisi** (liste vide = sans ping, jamais un repli sur `@everyone`). Un live est annoncé une
 * seule fois par session, par le cron `live-watch` — ces actions ne font que configurer.
 *
 * 🔒 RBAC **fail-closed** : `requireGuildConfigAccess` avant toute lecture ou écriture, Zod borné,
 * rate limit Redis sur les mutations, et vérification que le salon **et** les rôles appartiennent
 * bien au serveur avant d'enregistrer.
 */
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { z } from "zod";
import { buildLiveAnnouncement, LIVE_MAX_PING_ROLES, sanitizePingRoleIds } from "@/lib/live-notify";

const SNOWFLAKE = /^\d{17,20}$/;

const SettingsSchema = z.object({
    channelId: z
        .string()
        .regex(SNOWFLAKE, "Identifiant de salon invalide.")
        .nullable(),
    pingRoleIds: z
        .array(z.string().regex(SNOWFLAKE, "Identifiant de rôle invalide."))
        .max(LIVE_MAX_PING_ROLES, `Au maximum ${LIVE_MAX_PING_ROLES} rôles.`)
        .default([]),
    youtubeEnabled: z.boolean().default(true),
});

export async function getLiveNotifySettings(guildId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Non connecté." };

    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId);
    if (!guard.isAuthorized) {
        return { success: false as const, error: guard.error ?? "Accès refusé." };
    }

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { liveNotifyChannelId: true, livePingRoleIds: true, notifyYouTubeUploads: true },
        });
        return {
            success: true as const,
            data: {
                channelId: config?.liveNotifyChannelId ?? null,
                pingRoleIds: sanitizePingRoleIds(config?.livePingRoleIds),
                youtubeEnabled: config?.notifyYouTubeUploads ?? true,
            },
        };
    } catch (error) {
        logger.error("[live-notify] lecture des réglages échouée", {
            err: error instanceof Error ? error.message : String(error),
        });
        return { success: false as const, error: "Erreur de lecture." };
    }
}

export async function saveLiveNotifySettings(
    guildId: string,
    input: { channelId: string | null; pingRoleIds: string[]; youtubeEnabled: boolean },
): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non connecté." };

    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error ?? "Accès refusé." };

    const limited = await rateLimit(`live-notify-save:${session.user.id}`, 10, 60_000);
    if (!limited.success) return { success: false, error: "Trop de tentatives. Réessaie dans une minute." };

    const parsed = SettingsSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Réglages invalides." };
    }
    const channelId = parsed.data.channelId;
    const pingRoleIds = sanitizePingRoleIds(parsed.data.pingRoleIds);

    try {
        if (channelId) {
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const valid = await validateChannelBelongsToGuild(channelId, guildId);
            if (!valid) return { success: false, error: "Ce salon n'appartient pas à votre serveur Discord." };
        }

        if (pingRoleIds.length > 0) {
            const { fetchGuildRoles } = await import("@/server/discord");
            const roles = await fetchGuildRoles(guildId, { excludeManaged: false }).catch(() => null);
            if (!roles) return { success: false, error: "Impossible de vérifier les rôles du serveur." };
            const known = new Set(roles.map((role) => role.id));
            if (pingRoleIds.some((id) => !known.has(id))) {
                return { success: false, error: "Un des rôles choisis n'appartient pas à votre serveur." };
            }
        }

        const updated = await db.guildConfig.updateMany({
            where: { discordGuildId: guildId },
            data: {
                liveNotifyChannelId: channelId,
                livePingRoleIds: pingRoleIds,
                notifyYouTubeUploads: parsed.data.youtubeEnabled,
            },
        });
        if (updated.count !== 1) return { success: false, error: "Guilde introuvable." };

        const { revalidatePath } = await import("next/cache");
        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        logger.error("[live-notify] enregistrement échoué", {
            err: error instanceof Error ? error.message : String(error),
        });
        return { success: false, error: "Erreur inattendue. Réessaie dans un instant." };
    }
}

/**
 * Envoie un embed de démonstration dans le salon configuré — sans ping, et sans consommer la clé
 * d'anti-doublon (ce n'est pas un live).
 */
export async function sendLiveNotifyTest(guildId: string): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non connecté." };

    const { requireGuildConfigAccess } = await import("./guards");
    const guard = await requireGuildConfigAccess(guildId);
    if (!guard.isAuthorized) return { success: false, error: guard.error ?? "Accès refusé." };

    const limited = await rateLimit(`live-notify-test:${session.user.id}`, 3, 10 * 60_000);
    if (!limited.success) return { success: false, error: "Trop de tests. Réessaie dans quelques minutes." };

    try {
        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { liveNotifyChannelId: true },
        });
        if (!config?.liveNotifyChannelId) {
            return { success: false, error: "Choisis d'abord un salon, puis enregistre." };
        }

        const now = new Date();
        const payload = buildLiveAnnouncement(
            {
                id: "test",
                login: "sigilos",
                displayName: "Test SigilOS",
                title: "Ceci est un test : voilà exactement à quoi ressemblera une annonce de live.",
                gameName: "Dofus",
                viewers: 42,
                startedAt: new Date(now.getTime() - 12 * 60_000),
                thumbnailUrl: null,
                avatarUrl: null,
            },
            { now, pingRoleIds: [] },
        );

        const { sendChannelMessage } = await import("@/server/discord");
        const messageId = await sendChannelMessage(config.liveNotifyChannelId, "", payload);
        if (!messageId) {
            return { success: false, error: "Discord n'a pas accepté le message (salon en pause ?)." };
        }
        return { success: true };
    } catch (error) {
        logger.error("[live-notify] test d'envoi échoué", {
            err: error instanceof Error ? error.message : String(error),
        });
        return { success: false, error: "Erreur inattendue. Réessaie dans un instant." };
    }
}
