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

        // P2 — un transfert réussi solde les éventuels claims de récupération ouverts.
        // Best-effort isolé : ne doit jamais faire échouer le transfert.
        try {
            await db.guildRecoveryClaim.updateMany({
                where: { guildId: guild.id, status: { in: ["PENDING", "ORPHAN_DETECTED"] } },
                data: { status: "APPROVED", decidedAt: new Date(), decidedBy: session.user.id },
            });
        } catch (err: unknown) {
            logger.warn("[GuildOwner] claim auto-resolve failed:", err);
        }

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

// ============================================================================
// P2 — Filet orphelin (zéro admin natif + zéro délégué)
// ============================================================================

/**
 * Membre actif le plus ancien d'une guilde (candidat récupérateur).
 * Retourne null si aucun profil ACTIF.
 */
export async function getOldestActiveMember(
    guildId: string
): Promise<{ userId: string; displayName: string } | null> {
    const guild = await db.guildConfig.findFirst({
        where: { OR: [{ id: guildId }, { discordGuildId: guildId }] },
        select: { id: true },
    });
    if (!guild) return null;
    const oldest = await db.userProfile.findFirst({
        where: { guildId: guild.id, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: {
            userId: true, pseudoDofus: true, discordNickname: true,
            user: { select: { name: true } },
        },
    });
    if (!oldest) return null;
    return {
        userId: oldest.userId,
        displayName: oldest.pseudoDofus || oldest.discordNickname || oldest.user?.name || "Membre",
    };
}

/**
 * Détection des guildes orphelines (cron quotidien) : aucun admin natif
 * Discord joignable ET aucune délégation god/rbac. Fail-safe : erreur Discord
 * sur une guilde = on la saute (retry demain), jamais de faux orphelin.
 * Tentative de succession d'abord (peut résoudre les cas owner-dérive),
 * puis drapeau SYSTEM + notif God si toujours orpheline. Dédupliqué par les
 * flags/claims ouverts.
 */
export async function detectOrphanGuilds(): Promise<{ checked: number; flagged: string[] }> {
    const { fetchGuild, fetchGuildRoles, listGuildMembers } = await import("@/server/discord");
    const guilds = await db.guildConfig.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, name: true, discordGuildId: true, ownerId: true, rolesMapping: true, usersMapping: true },
    });
    let checked = 0;
    const flagged: string[] = [];
    for (const guild of guilds) {
        if (!guild.discordGuildId) continue;
        checked += 1;
        try {
            const openClaim = await db.guildRecoveryClaim.findFirst({
                where: { guildId: guild.id, status: { in: ["PENDING", "ORPHAN_DETECTED"] } },
                select: { id: true },
            });
            if (openClaim) continue;

            // Délégations = continuité : pas orpheline.
            const mapping = (guild.rolesMapping || {}) as Record<string, string[]>;
            const usersMapping = (guild.usersMapping || {}) as Record<string, string[]>;
            const hasDelegation =
                Object.values(mapping).some((perms) => Array.isArray(perms) && (perms.includes("system:god") || perms.includes("system:rbac"))) ||
                Object.values(usersMapping).some((perms) => Array.isArray(perms) && (perms.includes("system:god") || perms.includes("system:rbac")));
            if (hasDelegation) continue;

            // Admins natifs live (owner Discord OU rôle 0x8).
            const [discordGuild, roles, members] = await Promise.all([
                fetchGuild(guild.discordGuildId).catch(() => null),
                fetchGuildRoles(guild.discordGuildId, { excludeManaged: false }).catch(() => null),
                listGuildMembers(guild.discordGuildId, 1000).catch(() => null),
            ]);
            if (!discordGuild || !roles || !members) continue; // Discord injoignable → retry demain
            const adminRoleIds = new Set(
                (roles as any[])
                    .filter((r: any) => { try { return (BigInt(r.permissions || 0) & 0x8n) === 0x8n; } catch { return false; } })
                    .map((r: any) => r.id)
            );
            const list: any[] = Array.isArray(members) ? members : (members as any)?.members || [];
            const ownerId = (discordGuild as any)?.owner_id as string | undefined;
            const hasNativeAdmin = list.some(
                (m: any) => m?.user?.id === ownerId || (m?.roles || []).some((r: string) => adminRoleIds.has(r))
            );
            if (hasNativeAdmin) continue;

            // Tentative de succession (cas owner-dérive) avant de draper.
            try {
                await handleGuildOwnerSuccession(guild.id);
            } catch { /* filet ci-dessous */ }

            await db.guildRecoveryClaim.create({
                data: { guildId: guild.id, claimantUserId: "SYSTEM", status: "ORPHAN_DETECTED" },
            });
            await notifyGod({
                title: "🏚️ Guilde orpheline détectée",
                message: `**${guild.name}** n'a plus aucun admin natif ni délégué joignable. Le membre actif le plus ancien peut déposer une demande de récupération (claim) ; approbation via transfert de propriété.`,
                type: "SYSTEM",
                success: false,
                metadata: { guildId: guild.id, discordGuildId: guild.discordGuildId, operation: "ORPHAN_DETECTED" },
            });
            flagged.push(guild.id);
        } catch (err) {
            logger.warn("[OrphanWatch] guild ignorée (erreur)", { guildId: guild.id, error: err instanceof Error ? err.message : String(err) });
        }
    }
    return { checked, flagged };
}

/**
 * État de récupération pour la bannière (vu par un membre de la guilde).
 */
export async function getRecoveryBannerState(
    discordGuildId: string
): Promise<{ flagged: boolean; pendingByMe: boolean; pendingExists: boolean; canClaim: boolean }> {
    const none = { flagged: false, pendingByMe: false, pendingExists: false, canClaim: false };
    const session = await auth();
    if (!session?.user?.id) return none;
    try {
        const guild = await db.guildConfig.findFirst({
            where: { discordGuildId },
            select: { id: true },
        });
        if (!guild) return none;
        const openClaims = await db.guildRecoveryClaim.findMany({
            where: { guildId: guild.id, status: { in: ["PENDING", "ORPHAN_DETECTED"] } },
            select: { claimantUserId: true, status: true },
        });
        if (openClaims.length === 0) return none;
        const pending = openClaims.find((c) => c.status === "PENDING");
        const flagged = openClaims.some((c) => c.status === "ORPHAN_DETECTED");
        const oldest = await getOldestActiveMember(guild.id);
        return {
            flagged,
            pendingByMe: !!pending && pending.claimantUserId === session.user.id,
            pendingExists: !!pending,
            canClaim: flagged && !pending && !!oldest && oldest.userId === session.user.id,
        };
    } catch {
        return none;
    }
}

/**
 * Déposer une demande de récupération (membre actif le plus ancien uniquement,
 * drapeau orphelin ouvert, aucune demande en cours). Jamais d'auto-élévation :
 * God approuve via le transfert existant.
 */
export async function claimGuildRecovery(discordGuildId: string): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non authentifié." };
    try {
        const guild = await db.guildConfig.findFirst({
            where: { discordGuildId },
            select: { id: true, name: true },
        });
        if (!guild) return { success: false, error: "Guilde introuvable." };
        const oldest = await getOldestActiveMember(guild.id);
        if (!oldest || oldest.userId !== session.user.id) {
            return { success: false, error: "Seul le membre actif le plus ancien peut déposer une demande." };
        }
        const openClaims = await db.guildRecoveryClaim.findMany({
            where: { guildId: guild.id, status: { in: ["PENDING", "ORPHAN_DETECTED"] } },
            select: { status: true },
        });
        if (!openClaims.some((c) => c.status === "ORPHAN_DETECTED")) {
            return { success: false, error: "Aucune situation d'orphelinat constatée pour cette guilde." };
        }
        if (openClaims.some((c) => c.status === "PENDING")) {
            return { success: false, error: "Une demande est déjà en cours d'examen." };
        }
        await db.guildRecoveryClaim.create({
            data: { guildId: guild.id, claimantUserId: session.user.id, status: "PENDING" },
        });
        await notifyGod({
            title: "🙋 Demande de récupération de guilde",
            message: `**${oldest.displayName}** demande la récupération de **${guild.name}** (guilde orpheline). Approuver via transfert de propriété, ou rejeter via résolution du claim.`,
            type: "SYSTEM",
            success: true,
            metadata: { guildId: guild.id, discordGuildId, claimantUserId: session.user.id, operation: "RECOVERY_CLAIM" },
        });
        return { success: true };
    } catch (error) {
        logger.error("[Recovery] claimGuildRecovery error:", error);
        return { success: false, error: "Échec du dépôt de la demande." };
    }
}

/**
 * P2 — Résoudre un claim (God uniquement). Le transfert effectif passe par
 * `transferGuildOwnership` existant ; cette action solde le suivi.
 */
export async function resolveRecoveryClaim(
    discordGuildId: string,
    decision: "APPROVED" | "REJECTED"
): Promise<{ success: boolean; error?: string }> {
    const callerIsGod = await isSuperAdmin();
    if (!callerIsGod) return { success: false, error: "Non autorisé." };
    if (decision !== "APPROVED" && decision !== "REJECTED") {
        return { success: false, error: "Décision invalide." };
    }
    try {
        const guild = await db.guildConfig.findFirst({
            where: { discordGuildId },
            select: { id: true },
        });
        if (!guild) return { success: false, error: "Guilde introuvable." };
        await db.guildRecoveryClaim.updateMany({
            where: { guildId: guild.id, status: { in: ["PENDING", "ORPHAN_DETECTED"] } },
            data: { status: decision, decidedAt: new Date(), decidedBy: "GOD" },
        });
        return { success: true };
    } catch (error) {
        logger.error("[Recovery] resolveRecoveryClaim error:", error);
        return { success: false, error: "Échec de la résolution." };
    }
}

export interface PilotSignal {
    /** Nombre de modules verrouillés par le staff. */
    locks: number;
    /** Claim/drapeau de récupération ouvert. */
    hasOpenClaim: boolean;
    /** Whitelist explicitement désactivée (gelée). */
    frozen: boolean;
}

/**
 * Signaux de pilotage cross-guilde pour le portail (« mes serveurs ») :
 * verrous staff, récupération en cours, gel. Calculés UNIQUEMENT pour les
 * guildes dont l'appelant est admin Discord natif (les autres sont ignorées
 * silencieusement — pas d'énumération). Borné à 20 guildes, fail-safe par
 * guilde (une guilde illisible ne fait jamais échouer les autres).
 */
export async function getPilotSignals(
    discordGuildIds: string[]
): Promise<Record<string, PilotSignal>> {
    const out: Record<string, PilotSignal> = {};
    const session = await auth();
    if (!session?.user?.id) return out;
    if (!Array.isArray(discordGuildIds) || discordGuildIds.length === 0) return out;
    const ids = [...new Set(discordGuildIds)]
        .filter((id) => typeof id === "string" && /^\d{5,25}$/.test(id))
        .slice(0, 20);
    await Promise.all(ids.map(async (id) => {
        try {
            const ctx = await getUserContext(id);
            if (!ctx.isDiscordAdmin) return;
            const [config, allowed] = await Promise.all([
                db.guildConfig.findUnique({
                    where: { discordGuildId: id },
                    select: { id: true, modules: { select: { disabledByGod: true } } },
                }).catch(() => null),
                db.allowedGuild.findUnique({
                    where: { discordGuildId: id },
                    select: { isActive: true },
                }).catch(() => null),
            ]);
            if (!config) return;
            const locks = Array.isArray((config.modules as any)?.disabledByGod)
                ? (config.modules as any).disabledByGod.filter((k: unknown) => k !== "admin")
                : [];
            const claim = await db.guildRecoveryClaim.findFirst({
                where: { guildId: config.id, status: { in: ["PENDING", "ORPHAN_DETECTED"] } },
                select: { id: true },
            }).catch(() => null);
            out[id] = {
                locks: locks.length,
                hasOpenClaim: !!claim,
                frozen: allowed ? !allowed.isActive : false,
            };
        } catch {
            /* guilde illisible → ignorée */
        }
    }));
    return out;
}
