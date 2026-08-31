"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import { getUserContext, invalidateUserContextCache } from "@/server/actions/user-actions";
import { fetchGuild, sendChannelMessage } from "@/server/discord";
import { createAuditLog } from "@/server/actions/audit-actions";
import { notifyGod } from "@/server/actions/god-notif-actions";

/**
 * 👑 Transférer manuellement la propriété d'une guilde (Propriétaire actuel ou SuperAdmin)
 * Requiert une double confirmation via le nom exact de la guilde pour éviter tout clic accidentel.
 */
export async function transferGuildOwnershipAction(
    guildId: string,
    newOwnerUserId: string,
    confirmationGuildName: string
) {
    if (!guildId || !newOwnerUserId || typeof newOwnerUserId !== "string" || !newOwnerUserId.trim()) {
        return { success: false, error: "Paramètres manquants ou invalides." };
    }

    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Non authentifié." };
        }

        const callerIsGod = await isSuperAdmin();
        const ctx = await getUserContext(guildId);

        // Résolution de la guilde
        const guild = await db.guildConfig.findFirst({
            where: {
                OR: [
                    { id: guildId },
                    { discordGuildId: guildId }
                ]
            },
            select: { id: true, name: true, ownerId: true, discordGuildId: true, lifecycleNotifyChannelId: true, systemNotifyChannelId: true }
        });

        if (!guild) {
            return { success: false, error: "Guilde introuvable." };
        }

        // Autorisation : SuperAdmin OU Propriétaire actuel de la guilde
        const isCurrentOwner = guild.ownerId === session.user.id || (ctx.isAdmin && guild.ownerId === session.user.id);
        if (!callerIsGod && !isCurrentOwner) {
            return { success: false, error: "Seul le propriétaire actuel ou un SuperAdmin peut transférer la guilde." };
        }

        // Double confirmation par le nom de guilde (pour éviter tout miss-click)
        const normalizedInput = (confirmationGuildName || "").trim().toLowerCase();
        const normalizedGuildName = (guild.name || "").trim().toLowerCase();
        if (normalizedInput !== normalizedGuildName) {
            return { success: false, error: `Confirmation incorrecte. Tapez exactement "${guild.name}" pour valider.` };
        }

        // Garde anti no-op
        if (guild.ownerId === newOwnerUserId) {
            return { success: false, error: "Cet utilisateur est déjà propriétaire de la guilde." };
        }

        // Le destinataire doit être un membre ACTIF de cette guilde
        const targetMember = await db.userProfile.findFirst({
            where: { userId: newOwnerUserId, guildId: guild.id, status: "ACTIVE" },
            include: { user: { select: { name: true } } }
        });

        if (!targetMember) {
            return { success: false, error: "Le destinataire doit être un membre actif de cette guilde." };
        }

        // Mise à jour de la propriété
        await db.guildConfig.update({
            where: { id: guild.id },
            data: { ownerId: newOwnerUserId }
        });

        const actorName = session.user.name || "Inconnu";
        const newOwnerName = targetMember.pseudoDofus || targetMember.discordNickname || targetMember.user?.name || "Nouveau Propriétaire";

        // Audit Log
        await createAuditLog({
            guildId: guild.discordGuildId || guild.id,
            action: "GUILD_CONFIG_UPDATED" as any,
            actorUserId: session.user.id,
            actorName,
            targetType: "GUILD" as any,
            targetId: guild.id,
            metadata: {
                actionDetail: "TRANSFER_OWNERSHIP",
                previousOwnerId: guild.ownerId,
                newOwnerId: newOwnerUserId,
                newOwnerName
            }
        });

        // Alerte Discord dans le salon de logs staff si configuré
        const staffNotifyChannelId = guild.lifecycleNotifyChannelId || guild.systemNotifyChannelId;
        if (staffNotifyChannelId) {
            await sendChannelMessage(staffNotifyChannelId, {
                embeds: [{
                    title: "👑 Transfert de Propriété de Guilde",
                    description: `La propriété de l'espace SigilOS de **${guild.name}** a été transférée avec succès.\n\n👤 **Nouveau Propriétaire** : <@${targetMember.userId}> (${newOwnerName})\n🛡️ **Effectué par** : ${actorName}`,
                    color: 0xf59e0b,
                    timestamp: new Date().toISOString(),
                    footer: { text: "SigilOS • Sécurité & Gouvernance" }
                }]
            } as any).catch((err: unknown) => logger.warn("[GuildOwner] Discord notification failed:", err));
        }

        // Notification GOD
        await notifyGod({
            title: "👑 Propriété de Guilde Transférée",
            message: `Guilde: **${guild.name}**\nNouveau propriétaire: **${newOwnerName}**\nPar: **${actorName}**`,
            type: "SYSTEM",
            success: true,
            metadata: { guildId: guild.id, newOwnerUserId, performedBy: actorName }
        });

        // Invalidation des caches
        if (guild.ownerId) {
            await invalidateUserContextCache(guild.ownerId, guild.id, guild.discordGuildId || undefined);
        }
        await invalidateUserContextCache(newOwnerUserId, guild.id, guild.discordGuildId || undefined);

        revalidatePath(`/dashboard/${guild.discordGuildId || guild.id}`, "layout");
        revalidatePath(`/dashboard/${guild.discordGuildId || guild.id}/admin/members`);

        return { success: true, newOwnerName };
    } catch (error) {
        logger.error("[GuildOwner] transferGuildOwnershipAction error:", error);
        return { success: false, error: "Échec du transfert de propriété." };
    }
}

/**
 * 🛡️ Succession automatique fail-safe de la propriété d'une guilde
 * Déclenché lorsqu'un propriétaire supprime son compte, quitte Discord ou est archivé/banni.
 */
export async function handleGuildOwnerSuccession(guildId: string, exOwnerUserId?: string) {
    try {
        const guild = await db.guildConfig.findFirst({
            where: {
                OR: [
                    { id: guildId },
                    { discordGuildId: guildId }
                ]
            },
            select: { id: true, name: true, ownerId: true, discordGuildId: true, lifecycleNotifyChannelId: true, systemNotifyChannelId: true }
        });

        if (!guild) {
            logger.warn(`[GuildSuccession] Guild not found: ${guildId}`);
            return { success: false, error: "Guilde introuvable." };
        }

        // Si l'owner actuel est toujours actif et qu'aucun exOwnerUserId spécifique n'est ciblé, vérifier son statut
        if (guild.ownerId && (!exOwnerUserId || guild.ownerId === exOwnerUserId)) {
            const currentOwnerProfile = await db.userProfile.findFirst({
                where: { userId: guild.ownerId, guildId: guild.id, status: "ACTIVE" }
            });

            // Si le propriétaire actuel est toujours un membre actif et valide, aucune succession requise
            if (currentOwnerProfile && !exOwnerUserId) {
                return { success: true, unchanged: true, ownerId: guild.ownerId };
            }
        }

        logger.info(`[GuildSuccession] Initiating automatic succession for guild ${guild.name} (${guild.id})`);

        let newOwnerUserId: string | null = null;
        let successionReason = "AUTOMATIC_SUCCESSION";
        let newOwnerName = "Membre";

        // 1. Priorité 1 : Vérifier le propriétaire réel du serveur Discord via l'API Discord
        if (guild.discordGuildId) {
            try {
                const discordGuild = await fetchGuild(guild.discordGuildId);
                if (discordGuild?.owner_id) {
                    // Trouver le compte SigilOS lié à ce snowflake Discord
                    const discordOwnerAccount = await db.account.findFirst({
                        where: { provider: "discord", providerAccountId: discordGuild.owner_id },
                        select: { userId: true }
                    });

                    if (discordOwnerAccount?.userId) {
                        const discordOwnerProfile = await db.userProfile.findFirst({
                            where: { userId: discordOwnerAccount.userId, guildId: guild.id, status: "ACTIVE" },
                            include: { user: { select: { name: true } } }
                        });

                        if (discordOwnerProfile) {
                            newOwnerUserId = discordOwnerProfile.userId;
                            newOwnerName = discordOwnerProfile.pseudoDofus || discordOwnerProfile.discordNickname || discordOwnerProfile.user?.name || "Discord Owner";
                            successionReason = "DISCORD_SERVER_OWNER_INHERITANCE";
                        }
                    }
                }
            } catch (err: unknown) {
                logger.warn(`[GuildSuccession] Discord fetchGuild failed for ${guild.discordGuildId}:`, err);
            }
        }

        // 2. Priorité 2 : Trouver le membre actif le plus ancien ayant un rôle d'administration / RBAC
        if (!newOwnerUserId) {
            const activeAdminProfile = await db.userProfile.findFirst({
                where: {
                    guildId: guild.id,
                    status: "ACTIVE",
                    userId: { not: guild.ownerId || undefined }
                },
                orderBy: { createdAt: "asc" },
                include: { user: { select: { name: true } } }
            });

            if (activeAdminProfile) {
                newOwnerUserId = activeAdminProfile.userId;
                newOwnerName = activeAdminProfile.pseudoDofus || activeAdminProfile.discordNickname || activeAdminProfile.user?.name || "Senior Member";
                successionReason = "SENIOR_MEMBER_SUCCESSION";
            }
        }

        if (!newOwnerUserId) {
            logger.warn(`[GuildSuccession] No eligible successor found for guild ${guild.name} (${guild.id})`);
            return { success: false, error: "Aucun successeur éligible trouvé." };
        }

        // Appliquer la succession
        await db.guildConfig.update({
            where: { id: guild.id },
            data: { ownerId: newOwnerUserId }
        });

        // Audit Log
        await createAuditLog({
            guildId: guild.discordGuildId || guild.id,
            action: "GUILD_CONFIG_UPDATED" as any,
            actorUserId: "system",
            actorName: "Système de Succession Automatique",
            targetType: "GUILD" as any,
            targetId: guild.id,
            metadata: {
                actionDetail: "AUTOMATIC_OWNERSHIP_SUCCESSION",
                reason: successionReason,
                previousOwnerId: guild.ownerId,
                newOwnerId: newOwnerUserId,
                newOwnerName
            }
        });

        // Alerte Discord Staff
        const staffNotifyChannelId = guild.lifecycleNotifyChannelId || guild.systemNotifyChannelId;
        if (staffNotifyChannelId) {
            await sendChannelMessage(staffNotifyChannelId, {
                embeds: [{
                    title: "🛡️ Succession Automatique de Propriété",
                    description: `L'ancien propriétaire n'étant plus actif, la propriété de l'espace SigilOS de **${guild.name}** a été transmise automatiquement.\n\n👑 **Nouveau Propriétaire** : <@${newOwnerUserId}> (${newOwnerName})\n📋 **Motif** : ${successionReason === "DISCORD_SERVER_OWNER_INHERITANCE" ? "Propriétaire légitime du serveur Discord" : "Membre actif référent le plus ancien"}`,
                    color: 0x3b82f6,
                    timestamp: new Date().toISOString(),
                    footer: { text: "SigilOS • Fail-Safe Protection" }
                }]
            } as any).catch((err: unknown) => logger.warn("[GuildSuccession] Discord alert failed:", err));
        }

        // Notification GOD
        await notifyGod({
            title: "🛡️ Succession Automatique Effectuée",
            message: `Guilde: **${guild.name}**\nNouveau propriétaire: **${newOwnerName}**\nMotif: **${successionReason}**`,
            type: "SYSTEM",
            success: true,
            metadata: { guildId: guild.id, newOwnerUserId, successionReason }
        });

        if (guild.ownerId) {
            await invalidateUserContextCache(guild.ownerId, guild.id, guild.discordGuildId || undefined);
        }
        await invalidateUserContextCache(newOwnerUserId, guild.id, guild.discordGuildId || undefined);

        return { success: true, newOwnerUserId, newOwnerName, successionReason };
    } catch (error) {
        logger.error("[GuildSuccession] handleGuildOwnerSuccession error:", error);
        return { success: false, error: "Erreur lors de la succession automatique." };
    }
}
