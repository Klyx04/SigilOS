"use server";

/**
 * God — visiteurs (V3-b) : **réinitialisation de visibilité**.
 *
 * Action **réversible** : les trois consentements repassent à `false` (le défaut
 * fail-closed du schéma). Aucune donnée n'est supprimée — le visiteur peut les
 * réactiver lui-même depuis son espace.
 *
 * Garde : super-admin, avant toute lecture. Rate limit Redis, garde d'état dans le
 * `WHERE` (course), journal God existant (`GOD_CONFIG_OVERRIDE`, cible `PROFILE`).
 * Aucune donnée personnelle dans le log : l'id du profil, jamais le discordId.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { isSuperAdmin } from "./super-admin-actions";
import { createGodAuditLog } from "./audit-actions";

const ResetSchema = z.object({
    profileId: z.string().min(8, "Profil invalide").max(64, "Profil invalide"),
});

const DeleteSchema = z.object({
    profileId: z.string().min(8, "Profil invalide").max(64, "Profil invalide"),
});

export type GodVisitorDeleteResult = { success: boolean; error?: string; banned?: boolean };

/**
 * V3-c — **suppression complète** du compte visiteur.
 *
 * Ordre volontaire : on **bannit d'abord** le `discordId` (sinon l'identifiant
 * disparaît avec le compte et la personne peut revenir), puis on supprime le `User`
 * (cascade : `Account`, `Session`, `PublicProfile`, profils de guilde…).
 *
 * Refus fail-closed si le compte possède une guilde : la suppression laisserait une
 * guilde orpheline. Le propriétaire doit être transféré d'abord.
 */
export async function deleteGodVisitorUser(raw: unknown): Promise<GodVisitorDeleteResult> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };
    if (!(await isSuperAdmin())) return { success: false, error: "Non autorisé" };

    const parsed = DeleteSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: "Requête invalide" };

    const limited = await rateLimit(`god:visitor-delete:${session.user.id}`, 3, 60_000);
    if (!limited.success) {
        return { success: false, error: "Trop de suppressions rapprochées — patiente une minute." };
    }

    try {
        const profile = await db.publicProfile.findUnique({
            where: { id: parsed.data.profileId },
            select: {
                id: true,
                userId: true,
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
        if (!profile) return { success: false, error: "Profil introuvable" };

        const discordId = profile.user.accounts[0]?.providerAccountId ?? null;

        // Propriétaire d'une guilde (ownerId peut être un UUID interne ou un snowflake).
        let ownsGuild = true;
        try {
            const owned = await db.guildConfig.findFirst({
                where: {
                    OR: [
                        { ownerId: profile.userId },
                        ...(discordId ? [{ ownerId: discordId }] : []),
                    ],
                },
                select: { id: true },
            });
            ownsGuild = !!owned;
        } catch {
            ownsGuild = true; // fail-closed
        }
        if (ownsGuild) {
            return {
                success: false,
                error: "Ce compte possède une guilde — transfère la propriété avant de le supprimer.",
            };
        }

        // 1) Ban d'abord : l'identifiant Discord doit survivre à la suppression du compte.
        let banned = false;
        if (discordId) {
            const existing = await db.platformBan
                .findUnique({ where: { discordId }, select: { id: true } })
                .catch(() => null);
            if (!existing) {
                await db.platformBan.create({
                    data: {
                        entityType: "USER",
                        discordId,
                        reason: "Suppression du compte visiteur (God)",
                        bannedBy: session.user.id,
                    },
                });
                banned = true;
            }
        }

        // 2) Suppression complète du User (cascades Prisma).
        await db.user.delete({ where: { id: profile.userId } });

        // 3) Journal God — aucun identifiant Discord dans le log.
        await createGodAuditLog({
            action: "GOD_USER_PLATFORM_BAN",
            targetType: "USER",
            targetId: profile.userId,
            metadata: { operation: "DELETE_VISITOR_USER", banned },
        }).catch(() => null);

        revalidatePath("/god");
        return { success: true, banned };
    } catch (error) {
        logger.error("[god-visitor-actions] Suppression du compte visiteur échouée", {
            cause: error instanceof Error ? error.message : "unknown",
        });
        return { success: false, error: "Échec de la suppression" };
    }
}


export type GodVisitorActionResult = { success: boolean; error?: string };

export async function resetGodVisitorVisibility(raw: unknown): Promise<GodVisitorActionResult> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    // Fail-closed AVANT toute lecture : les visiteurs sont un périmètre plateforme.
    if (!(await isSuperAdmin())) return { success: false, error: "Non autorisé" };

    const parsed = ResetSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: "Requête invalide" };

    const limited = await rateLimit(`god:visitor-visibility:${session.user.id}`, 10, 60_000);
    if (!limited.success) {
        return { success: false, error: "Trop de modifications rapprochées — patiente une minute." };
    }

    try {
        const current = await db.publicProfile.findUnique({
            where: { id: parsed.data.profileId },
            select: {
                id: true,
                showOnDirectory: true,
                showPresence: true,
                showRushProgress: true,
            },
        });
        if (!current) return { success: false, error: "Profil introuvable" };

        // Déjà masqué : idempotent, aucune écriture ni log.
        if (!current.showOnDirectory && !current.showPresence && !current.showRushProgress) {
            return { success: true };
        }

        // Garde d'état : les trois valeurs lues doivent encore être celles en base.
        const updated = await db.publicProfile.updateMany({
            where: {
                id: current.id,
                showOnDirectory: current.showOnDirectory,
                showPresence: current.showPresence,
                showRushProgress: current.showRushProgress,
            },
            data: {
                showOnDirectory: false,
                showPresence: false,
                showRushProgress: false,
            },
        });
        if (updated.count === 0) {
            return { success: false, error: "Profil modifié entre-temps — recharge la page." };
        }

        await createGodAuditLog({
            action: "GOD_CONFIG_OVERRIDE",
            targetType: "PROFILE",
            targetId: current.id,
            oldValue: {
                showOnDirectory: current.showOnDirectory,
                showPresence: current.showPresence,
                showRushProgress: current.showRushProgress,
            },
            newValue: { showOnDirectory: false, showPresence: false, showRushProgress: false },
            metadata: { operation: "RESET_VISITOR_VISIBILITY" },
        }).catch(() => null);

        revalidatePath("/god");
        return { success: true };
    } catch (error) {
        logger.error("[god-visitor-actions] Réinitialisation de visibilité échouée", {
            cause: error instanceof Error ? error.message : "unknown",
        });
        return { success: false, error: "Échec de la réinitialisation" };
    }
}
