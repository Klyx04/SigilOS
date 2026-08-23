import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Types de motif d'une tentative de connexion refusée (observabilité God).
 */
export type AccessAttemptReason =
    | "NO_MANAGED_GUILD" // Discord OK, mais aucune guilde gérée/whitelistée
    | "DISCORD_API_ERROR"; // API @me/guilds KO (rate-limit/5xx/réseau) ET pas de profil connu

/**
 * Enregistre une tentative de connexion REFUSÉE (fail-closed).
 * NON BLOQUANT : le sign-in ne doit jamais dépendre de la traçabilité. Toute
 * erreur BDD est capturée et loguée, jamais propagée à l'appelant.
 */
export async function logAccessAttempt(discordId: string, reason: AccessAttemptReason): Promise<void> {
    try {
        await prisma.accessAttempt.create({
            data: { discordId, reason }
        });
    } catch (e) {
        logger.error("[AccessAttempt] Failed to record refused sign-in:", e);
    }
}

/**
 * Fail-open CIBLÉ pour le sign-in.
 * Renvoie `true` UNIQUEMENT si l'utilisateur Discord est un membre ACTIVE connu
 * d'au moins une guilde gérée (guildConfig active OU whitelistée active).
 * Utilisé quand l'API Discord `@me/guilds` est KO (rate-limit/5xx) ou en retard
 * (nouvelle guilde pas encore remontée), afin de ne pas bloquer un membre
 * légitime. Un inconnu (aucun profil) renvoie TOUJOURS `false` → fail-closed.
 */
export async function hasActiveProfileInManagedGuild(discordId: string): Promise<boolean> {
    try {
        const account = await prisma.account.findFirst({
            where: { provider: "discord", providerAccountId: discordId },
            select: { userId: true }
        });
        if (!account?.userId) return false;

        const profile = await prisma.userProfile.findFirst({
            where: { userId: account.userId, status: "ACTIVE" },
            select: { guild: { select: { discordGuildId: true } } }
        });
        if (!profile?.guild?.discordGuildId) return false;

        const discordGuildId = profile.guild.discordGuildId;
        const [config, allowed] = await Promise.all([
            prisma.guildConfig.findFirst({
                where: { discordGuildId, isActive: true },
                select: { id: true }
            }),
            prisma.allowedGuild.findFirst({
                where: { discordGuildId, isActive: true },
                select: { id: true }
            })
        ]);

        return !!(config || allowed);
    } catch (e) {
        // Fail-closed : on n'autorise JAMAIS un inconnu si la vérif échoue.
        logger.error("[AccessAttempt] hasActiveProfileInManagedGuild failed:", e);
        return false;
    }
}
