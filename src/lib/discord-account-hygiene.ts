import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * #223 P3.2 — Révocation de session Auth.js sur `APPLICATION_DEAUTHORIZED`.
 *
 * Quand un utilisateur retire l'autorisation SigilOS depuis Discord, le webhook
 * events reçoit `APPLICATION_DEAUTHORIZED`. On fait alors de l'hygiène de compte :
 *   1. Dé-liaison OAuth : suppression du lien Account (provider discord) → le
 *      refresh / re-signin via Discord échoue (`invalid_grant` équivaut à un
 *      deauthorized, cf. doc résilience §5.3).
 *   2. Invalidation des sessions Auth.js (pattern `lifecycle-actions.ts`).
 *
 * BEST-EFFORT : ne throw jamais (l'ACK 204 du webhook doit toujours partir).
 */

export type DiscordDeauthorizeResult =
    | { revoked: true; userId: string }
    | { revoked: false; reason: "invalid-discord-id" | "no-account" | "error" };

export async function revokeDiscordAccountSession(discordUserId: string): Promise<DiscordDeauthorizeResult> {
    // Snowflakes Discord : 15 à 21 chiffres décimaux. Tout le reste est refusé (fail-closed).
    if (!discordUserId || !/^\d{15,21}$/.test(discordUserId)) {
        logger.warn("[DiscordAccountHygiene] discordUserId invalide, ignoré");
        return { revoked: false, reason: "invalid-discord-id" };
    }

    try {
        const account = await db.account.findFirst({
            where: { provider: "discord", providerAccountId: discordUserId },
            select: { userId: true },
        });

        if (!account) {
            logger.info("[DiscordAccountHygiene] Aucun compte SigilOS lié à ce discordId (no-op)");
            return { revoked: false, reason: "no-account" };
        }

        const userId = account.userId;

        // 1. Dé-liaison OAuth (supprime aussi les tokens chiffrés via le cascade Prisma).
        await db.account.deleteMany({ where: { userId, provider: "discord" } });

        // 2. Invalidation des sessions (même pattern que deleteProfileByAdmin / reactivateProfile).
        await db.session.deleteMany({ where: { userId } });

        logger.warn("[DiscordAccountHygiene] Session Discord révoquée", { discordUserId, userId });
        return { revoked: true, userId };
    } catch (error) {
        logger.error("[DiscordAccountHygiene] Échec de la révocation (best-effort):", { error });
        return { revoked: false, reason: "error" };
    }
}
