"use server";

/**
 * Cycle de vie d'une guilde — **côté propriétaire** (jamais God : il a `god-lifecycle-actions`).
 *
 * 📌 Décision du 01/11/2026 : un propriétaire doit pouvoir retirer **sa** guilde du produit sans
 * passer par Discord ni par le support. Ce n'est pas une suppression instantanée :
 * - la guilde est **désactivée** (`isActive=false`, `deletedAt`, `deletionReason=OWNER_REQUEST`) ;
 * - une échéance est posée (`scheduledDeletion = J+30`) ;
 * - les profils sont **archivés** (`GUILD_DELETED`) — jamais supprimés ;
 * - les caches sont purgés (sinon les membres naviguent 60 s sur une guilde morte) ;
 * - les admins de la guilde et God sont prévenus.
 *
 * La suppression physique reste God (`hardDeleteGuild`), et la purge à échéance est un lot séparé.
 * Le bot **reste** dans le serveur : c'est ce qui rend une restauration possible sans réinvitation.
 */
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/ratelimit";
import { GUILD_DELETION_GRACE_DAYS, isDeletionConfirmationValid } from "@/lib/guild-deletion";

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60_000;

export async function requestGuildDeletion(
    guildId: string,
    confirmation: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non connecté." };
        }

        // 🔒 RBAC fail-closed : propriétaire Discord **live**, avant toute écriture.
        const { requireGuildOwner } = await import("./guards");
        const guard = await requireGuildOwner(guildId, "Suppression de guilde (propriétaire)");
        if (!guard.isAuthorized) {
            return { success: false, error: guard.error ?? "Action réservée au propriétaire du serveur." };
        }

        const limited = await rateLimit(
            `guild-delete:${session.user.id}`,
            RATE_LIMIT_MAX,
            RATE_LIMIT_WINDOW_MS,
        );
        if (!limited.success) {
            return { success: false, error: "Trop de tentatives. Réessaie dans quelques minutes." };
        }

        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, name: true, isActive: true, deletedAt: true, systemNotifyChannelId: true },
        });
        if (!config) {
            return { success: false, error: "Guilde introuvable." };
        }
        if (!config.isActive || config.deletedAt) {
            return { success: false, error: "Cette guilde est déjà désactivée." };
        }
        if (!isDeletionConfirmationValid(confirmation, config.name)) {
            return { success: false, error: "Le nom saisi ne correspond pas à celui de la guilde." };
        }

        const scheduledDeletion = new Date(Date.now() + GUILD_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

        // 🏁 Garde d'état **dans le WHERE** : deux onglets ouverts ne désactivent pas deux fois.
        const updated = await db.guildConfig.updateMany({
            where: { id: config.id, isActive: true, deletedAt: null },
            data: {
                isActive: false,
                deletedAt: new Date(),
                deletionReason: "OWNER_REQUEST",
                scheduledDeletion,
            },
        });
        if (updated.count !== 1) {
            return { success: false, error: "Cette guilde est déjà désactivée." };
        }

        await db.userProfile.updateMany({
            where: { guildId: config.id },
            data: {
                status: "ARCHIVED",
                archivedAt: new Date(),
                archiveReason: "GUILD_DELETED",
                scheduledDeletion,
            },
        });

        await db.auditLog.create({
            data: {
                guildId: config.id,
                actorUserId: session.user.id,
                actorName: session.user.name ?? "Propriétaire",
                action: "GUILD_DELETE_REQUESTED",
                targetType: "GUILD",
                targetId: config.id,
                oldValue: { isActive: true, deletedAt: null },
                newValue: {
                    isActive: false,
                    deletionReason: "OWNER_REQUEST",
                    scheduledDeletion: scheduledDeletion.toISOString(),
                },
                metadata: { via: "dashboard/pilotage" },
            },
        });

        // Éviction immédiate des caches : sans cela, les membres gardent leur contexte (Redis
        // `user:ctx:*`, config mémoire, whitelist 60 s) et naviguent sur une guilde morte.
        const { purgeGuildCaches } = await import("./god-lifecycle-actions");
        await purgeGuildCaches(guildId);

        // Prévenir les admins de la guilde (best-effort : un salon absent n'annule pas la demande).
        if (config.systemNotifyChannelId) {
            try {
                const { sendChannelMessage } = await import("@/server/discord");
                const echeance = scheduledDeletion.toLocaleDateString("fr-FR");
                await sendChannelMessage(
                    config.systemNotifyChannelId,
                    `⚠️ **SigilOS a été désactivé sur ce serveur** à la demande de son propriétaire.\n` +
                        `Les membres n'ont plus accès au tableau de bord et les boutons déjà postés ne répondent plus.\n` +
                        `La suppression définitive est planifiée au **${echeance}** — d'ici là, le propriétaire peut demander la restauration au support.`,
                );
            } catch (error) {
                logger.warn("[guild-lifecycle] notification des admins échouée", {
                    err: error instanceof Error ? error.message : String(error),
                });
            }
        }

        try {
            const { notifyGod } = await import("./god-notif-actions");
            await notifyGod({
                title: "🏰 Guilde désactivée par son propriétaire",
                message: `La guilde « ${config.name} » a été désactivée à la demande de son propriétaire.\nSuppression planifiée au ${scheduledDeletion.toISOString()} (grâce de ${GUILD_DELETION_GRACE_DAYS} jours).`,
                type: "SYSTEM",
                success: true,
                metadata: { guildId: config.id, operation: "GUILD_DELETE_REQUESTED" },
            });
        } catch (error) {
            logger.warn("[guild-lifecycle] notification God échouée", {
                err: error instanceof Error ? error.message : String(error),
            });
        }

        return { success: true };
    } catch (error) {
        logger.error("[guild-lifecycle] requestGuildDeletion a échoué", {
            err: error instanceof Error ? error.message : String(error),
        });
        return { success: false, error: "Erreur inattendue. Réessaie dans un instant." };
    }
}
