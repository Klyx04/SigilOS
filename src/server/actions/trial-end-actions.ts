"use server";

import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { getUserContext, type ActionResponse } from "./user-actions";
import { validateChannelBelongsToGuild } from "@/server/discord";
import { postServiceMessage } from "@/server/discord-services";
import { getAppBaseUrl } from "@/lib/utils";
import { isTrialEnded, trialEndNoticeKey } from "@/lib/trial-end";
import { DEFAULT_TRIAL_DURATION_DAYS } from "@/lib/member-roster";
import { z } from "zod";

/** Durée d'essai : bornée (1 à 90 jours) — durée par défaut du calcul de la fin d'essai. */
const trialDurationSchema = z.number().int().min(1).max(90);

/**
 * 🎓 **Fin d'essai** : salon qui reçoit l'embed.
 *
 * Aucun état supplémentaire en base : l'idempotence (« un seul embed par membre et par
 * échéance ») vit dans Redis (`SET NX`), pas dans une colonne. Reprogrammer l'essai
 * réautorise donc un embed à la nouvelle date.
 */

export async function getTrialEndSettings(
    guildId: string
): Promise<ActionResponse<{ channelId: string | null; trialDurationDays: number }>> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isAdmin) return { success: false, error: "Admin requis" };

        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { trialEndNotifyChannelId: true, trialDurationDays: true },
        });
        return {
            success: true,
            data: {
                channelId: config?.trialEndNotifyChannelId || null,
                trialDurationDays: config?.trialDurationDays ?? DEFAULT_TRIAL_DURATION_DAYS,
            },
        };
    } catch (error) {
        logger.error("[getTrialEndSettings] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}

export async function updateTrialEndSettings(
    guildId: string,
    channelId: string | null,
    trialDurationDays?: number
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isAdmin) return { success: false, error: "Admin requis" };

        const next = channelId?.trim() || null;
        if (next) {
            const belongs = await validateChannelBelongsToGuild(next, guildId);
            if (!belongs) return { success: false, error: "Le salon sélectionné n'appartient pas à ce serveur Discord." };
        }

        // La durée n'est écrite que si elle est fournie (un enregistrement du seul salon
        // ne doit pas écraser un réglage existant).
        let duration: number | undefined;
        if (trialDurationDays !== undefined) {
            const parsed = trialDurationSchema.safeParse(trialDurationDays);
            if (!parsed.success) return { success: false, error: "Durée d'essai invalide (1 à 90 jours)." };
            duration = parsed.data;
        }

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: {
                trialEndNotifyChannelId: next,
                ...(duration !== undefined ? { trialDurationDays: duration } : {}),
            },
        });
        return { success: true };
    } catch (error) {
        logger.error("[updateTrialEndSettings] failed", { err: error });
        return { success: false, error: "Erreur interne" };
    }
}
/**
 * Publie l'embed « fin d'essai » des membres dont l'échéance est passée (une fois chacun).
 * Appelé par le cron `sync-members` : pas de nouvelle tâche planifiée.
 */
export async function notifyEndedTrialsForGuild(
    discordGuildId: string
): Promise<{ checked: number; notified: number }> {
    const result = { checked: 0, notified: 0 };

    const guild = await db.guildConfig.findUnique({
        where: { discordGuildId },
        select: { id: true, name: true, trialEndNotifyChannelId: true, rolesMapping: true },
    });
    if (!guild?.trialEndNotifyChannelId) return result;

    // Ping des **rôles staff autorisés** (permission « Gérer les membres ») : l'oubli de
    // validation tombe sur les bonnes personnes, sans nommer de rôle en dur.
    // Demande du 29/10/2026 — pas de second rappel, on renforce celui qui existe déjà.
    const staffMentions = Object.entries((guild.rolesMapping ?? {}) as Record<string, unknown>)
        .filter(([, perms]) => Array.isArray(perms) && perms.includes("staff:member_mgmt"))
        .map(([roleId]) => `<@&${roleId}>`)
        .join(" ");

    const now = new Date();
    const appUrl = getAppBaseUrl();

    // Deux sources : profils dashboard et lignes de registre des membres hors dashboard.
    const [profiles, entries] = await Promise.all([
        db.userProfile.findMany({
            where: { guildId: guild.id, trialValidated: false, trialEndsAt: { not: null } },
            select: {
                id: true,
                pseudoDofus: true,
                discordNickname: true,
                trialEndsAt: true,
                user: { select: { name: true } },
            },
        }),
        db.memberRegistryEntry.findMany({
            where: { guildId: guild.id, trialValidated: false, trialEndsAt: { not: null } },
            select: { id: true, discordId: true, pseudoDofus: true, trialEndsAt: true },
        }),
    ]);

    const candidates = [
        ...profiles.map((profile) => ({
            memberKey: profile.id,
            displayName: profile.pseudoDofus || profile.discordNickname || profile.user?.name || "Membre",
            endsAt: profile.trialEndsAt,
            scope: "Profil dashboard",
        })),
        ...entries.map((entry) => ({
            memberKey: entry.discordId,
            displayName: entry.pseudoDofus || entry.discordId,
            endsAt: entry.trialEndsAt,
            scope: "Registre staff",
        })),
    ];

    for (const candidate of candidates) {
        if (!candidate.endsAt || !isTrialEnded({ validated: false, endsAt: candidate.endsAt, now })) continue;
        result.checked += 1;

        const key = trialEndNoticeKey(guild.id, candidate.memberKey, candidate.endsAt);
        const claimed = await redis.set(key, "1", "EX", 90 * 24 * 60 * 60, "NX").catch(() => "OK");
        if (claimed !== "OK") continue;

        const sent = await postServiceMessage(
            guild.trialEndNotifyChannelId,
            {
                embeds: [{
                    title: "⏳ Fin d'essai",
                    description: [
                        ...(staffMentions ? [staffMentions] : []),
                        `**Membre :** ${candidate.displayName}`,
                        `**Échéance :** ${candidate.endsAt.toLocaleDateString("fr-FR")}`,
                        `**Source :** ${candidate.scope}`,
                        "",
                        "L'essai n'est **pas** validé automatiquement : le staff tranche (valider ou reprogrammer).",
                    ].join("\n"),
                    color: 0xf59e0b,
                    timestamp: now.toISOString(),
                    footer: { text: `SigilOS • ${guild.name}` },
                    url: `${appUrl}/dashboard/${discordGuildId}/admin/members`,
                }],
            },
            `⏳ Fin d'essai — ${candidate.displayName}`
        ).catch((error) => {
            logger.warn("[trial-end] envoi impossible", { err: String(error) });
            return null;
        });

        if (sent) {
            result.notified += 1;
        } else {
            // Échec d'envoi : on relâche la clé pour retenter au prochain passage.
            await redis.del(key).catch(() => {});
        }
    }

    return result;
}

