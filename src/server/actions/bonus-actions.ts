"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { BonusType, BonusStatus, MentionType, GuildBonus } from "@prisma/client";
import { getUserContext } from "./user-actions";
import { z } from "zod";

// --- Types ---

type ActionResponse<T = void> = {
    success: boolean;
    error?: string;
    data?: T;
};

// --- Input Validation Schemas ---

const purchaseBonusSchema = z.object({
    guildId: z.string().min(1, "guildId requis"),
    bonusType: z.nativeEnum(BonusType),
    channelId: z.string().regex(/^\d{17,20}$/, "ID Discord invalide").optional(),
    mentionType: z.nativeEnum(MentionType).default(MentionType.NONE),
    roleId: z.string().regex(/^\d{17,20}$/, "ID rôle invalide").optional(),
});

const cancelBonusSchema = z.object({
    bonusId: z.string().min(1, "bonusId requis"),
    guildId: z.string().min(1, "guildId requis"),
});

// Bonus configuration
const BONUS_CONFIG: Record<BonusType, { name: string; description: string; cost: number; duration: number }> = {
    FORTUNE: {
        name: "Oracle de Fortune",
        description: "+50% chances de loot sur les monstres",
        cost: 20,
        duration: 2 * 60 * 60 * 1000, // 2h in ms
    },
    GLADIATOR: {
        name: "Oracle de Gladiateur",
        description: "+50% gains en Kolizéum",
        cost: 20,
        duration: 2 * 60 * 60 * 1000,
    },
    HARVESTER: {
        name: "Oracle de Récolteur",
        description: "Possibilité d'obtenir des Rékloots en récolte",
        cost: 50,
        duration: 2 * 60 * 60 * 1000,
    },
    WISDOM: {
        name: "Oracle de Savoir",
        description: "+50% d'expérience sur toutes les missions",
        cost: 20,
        duration: 2 * 60 * 60 * 1000,
    },
    DIVINE: {
        name: "Oracle Divin",
        description: "Déclenche l'événement Moissonneuse Batteuse",
        cost: 200,
        duration: 2 * 60 * 60 * 1000,
    },
};

// --- Helper Functions ---

/**
 * Require authenticated user, return userId
 */
async function requireAuth(): Promise<string> {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Non authentifié");
    }
    return session.user.id;
}

/**
 * Require authenticated member of the guild
 */
async function requireMember(guildId: string) {
    await requireAuth();
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated || !ctx.isMember) {
        throw new Error("Non autorisé");
    }
    return ctx;
}

/**
 * Require authenticated admin of the guild
 */
async function requireAdmin(guildId: string) {
    const ctx = await requireMember(guildId);
    if (!ctx.isAdmin) {
        throw new Error("Permissions insuffisantes - Admin requis");
    }
    return ctx;
}

/**
 * Require authenticated user with bonus manage permission
 */
async function requireBonusManage(guildId: string) {
    const ctx = await requireMember(guildId);
    if (!ctx.canManageBonus) {
        throw new Error("Permissions insuffisantes - Gestion des bonus requise");
    }
    return ctx;
}

// --- Public Functions ---

/**
 * Get Discord roles for a guild (for dropdown)
 */
export async function getGuildRoles(guildId: string): Promise<ActionResponse<any[]>> {
    try {
        await requireMember(guildId);

        const { fetchGuildRoles } = await import("@/server/discord");
        const roles = await fetchGuildRoles(guildId, { excludeManaged: true });

        const filteredRoles = roles
            .filter((r: { name: string }) => r.name !== "@everyone")
            .map((r: { id: string; name: string; color: number; position: number }) => ({
                id: r.id,
                name: r.name,
                color: r.color,
                position: r.position,
            }));

        return { success: true, data: filteredRoles };
    } catch (error) {
        return { success: false, error: (error as Error).message, data: [] };
    }
}

/**
 * Get all bonuses for a guild
 */
export async function getGuildBonuses(
    guildId: string
): Promise<ActionResponse<any[]>> {
    try {
        // Security: verify membership before data access
        await requireMember(guildId);

        const bonuses = await db.guildBonus.findMany({
            where: { guildId },
            orderBy: { createdAt: "desc" },
        });

        const enriched = bonuses.map((bonus) => ({
            ...bonus,
            config: BONUS_CONFIG[bonus.bonusType],
        }));

        return { success: true, data: enriched };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Get the currently active or pending bonus for a guild
 * Automatically activates/expires bonuses based on time
 */
export async function getActiveBonuses(
    guildId: string
): Promise<ActionResponse<any[]>> {
    try {
        // Security: verify membership before data access
        await requireMember(guildId);

        // Get internal guild ID (CUID)
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });

        if (!guildConfig) {
            return { success: false, error: "Guilde introuvable" };
        }

        const bonuses = await db.guildBonus.findMany({
            where: {
                guildId: guildConfig.id,
                status: {
                    in: [BonusStatus.PURCHASED, BonusStatus.ACTIVE],
                },
            },
            orderBy: { createdAt: "desc" },
        });

        if (bonuses.length === 0) {
            return { success: true, data: [] };
        }

        const now = new Date();
        const results: (GuildBonus & { config: typeof BONUS_CONFIG[BonusType]; purchaserName: string })[] = [];

        for (const bonus of bonuses) {
            let current = bonus;

            // Auto-activate if 24h has passed
            if (current.status === BonusStatus.PURCHASED && now >= current.activatesAt) {
                const config = BONUS_CONFIG[current.bonusType];
                const expiresAt = new Date(current.activatesAt.getTime() + config.duration);

                current = await db.guildBonus.update({
                    where: { id: current.id },
                    data: {
                        status: BonusStatus.ACTIVE,
                        expiresAt,
                    },
                });
            }

            // Auto-expire if duration has passed
            if (current.status === BonusStatus.ACTIVE && current.expiresAt && now >= current.expiresAt) {
                await db.guildBonus.update({
                    where: { id: current.id },
                    data: { status: BonusStatus.EXPIRED },
                });
                continue; // Skip expired bonus
            }

            // Fetch purchaser data separately
            let purchaserName = "Inconnu";
            if (current.purchasedBy) {
                const purchaser = await db.userProfile.findUnique({
                    where: { id: current.purchasedBy },
                    select: { dofusPseudo: true, discordNickname: true },
                });
                purchaserName = purchaser?.dofusPseudo || purchaser?.discordNickname || "Inconnu";
            }

            results.push({
                ...current,
                config: BONUS_CONFIG[current.bonusType],
                purchaserName,
            });
        }

        if (results.length !== bonuses.length) {
            revalidatePath(`/admin/bonus`);
            revalidatePath(`/[guildSlug]/missions`);
        }

        return { success: true, data: results };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

/** @deprecated Use getActiveBonuses instead */
export async function getActiveBonus(
    guildId: string
): Promise<ActionResponse<any>> {
    const result = await getActiveBonuses(guildId);
    if (!result.success) return result;
    return { success: true, data: result.data?.[0] || null };
}

/**
 * Purchase a new guild bonus
 */
export async function purchaseBonus(
    guildId: string,
    bonusType: BonusType,
    channelId?: string,
    mentionType: MentionType = MentionType.NONE,
    roleId?: string
): Promise<ActionResponse<any>> {
    try {
        // Validate input
        const validated = purchaseBonusSchema.parse({
            guildId,
            bonusType,
            channelId: channelId || undefined,
            mentionType,
            roleId: roleId || undefined,
        });

        // Security: require bonus manage permission
        const userId = await requireAuth();
        await requireBonusManage(validated.guildId);

        const config = BONUS_CONFIG[validated.bonusType];

        // Get guild config FIRST (needed for all subsequent queries)
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: validated.guildId },
            select: { id: true, bonusNotifyChannelId: true },
        });

        if (!guildConfig) {
            return { success: false, error: "Guilde introuvable" };
        }

        // Check if the SAME bonus type is already active or pending
        const existingBonus = await db.guildBonus.findFirst({
            where: {
                guildId: guildConfig.id, // ✅ Use internal CUID
                bonusType: validated.bonusType, // ✅ Only block same type
                status: {
                    in: [BonusStatus.PURCHASED, BonusStatus.ACTIVE],
                },
            },
        });

        if (existingBonus) {
            return {
                success: false,
                error: `Un bonus ${config.name} est déjà actif ou en attente`,
            };
        }

        // guildConfig already fetched above

        // Get user profile ID (UserProfile.id, not User.id)
        const userProfile = await db.userProfile.findFirst({
            where: {
                userId: userId,
                guildId: guildConfig.id,
            },
            select: { id: true },
        });

        if (!userProfile) {
            return { success: false, error: "Profil utilisateur introuvable" };
        }

        // Fall back to stored channel from settings if none provided
        const notificationChannelId = validated.channelId ?? guildConfig.bonusNotifyChannelId ?? undefined;

        // Calculate activation time (24h from now)
        const now = new Date();
        const activatesAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Create bonus record (use internal guildId CUID, not discordGuildId)
        const bonus = await db.guildBonus.create({
            data: {
                guildId: guildConfig.id, // ✅ Use GuildConfig.id (CUID), not discordGuildId
                bonusType: validated.bonusType,
                cost: config.cost,
                purchasedBy: userProfile.id, // ✅ Use UserProfile.id, not User.id
                activatesAt,
                notificationChannelId,
                mentionType: validated.mentionType,
                mentionRoleId: validated.roleId,
            },
        });

        revalidatePath(`/admin/bonus`);
        revalidatePath(`/[guildSlug]/missions`);

        return {
            success: true,
            data: {
                ...bonus,
                config,
            },
        };
    } catch (error) {
        // Return Zod validation errors cleanly
        if ((error as any).name === "ZodError") {
            const firstError = (error as any).errors?.[0]?.message || "Données invalides";
            return { success: false, error: firstError };
        }
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Cancel a pending bonus (before activation)
 */
export async function cancelBonus(
    bonusId: string,
    guildId: string
): Promise<ActionResponse> {
    try {
        // Validate input
        const validated = cancelBonusSchema.parse({ bonusId, guildId });

        // Security: require bonus manage permission
        await requireBonusManage(validated.guildId);

        // Resolve discordGuildId → internal CUID
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: validated.guildId },
            select: { id: true },
        });

        if (!guildConfig) {
            return { success: false, error: "Guilde introuvable" };
        }

        const bonus = await db.guildBonus.findUnique({
            where: { id: validated.bonusId },
        });

        if (!bonus) {
            return { success: false, error: "Bonus introuvable" };
        }

        // Security: guild isolation check (compare CUIDs)
        if (bonus.guildId !== guildConfig.id) {
            return { success: false, error: "Ce bonus n'appartient pas à votre guilde" };
        }

        if (bonus.status !== BonusStatus.PURCHASED) {
            return { success: false, error: "Seuls les bonus en attente peuvent être annulés" };
        }

        await db.guildBonus.delete({
            where: { id: validated.bonusId },
        });

        revalidatePath(`/admin/bonus`);
        revalidatePath(`/[guildSlug]/missions`);

        return { success: true };
    } catch (error) {
        if ((error as any).name === "ZodError") {
            const firstError = (error as any).errors?.[0]?.message || "Données invalides";
            return { success: false, error: firstError };
        }
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Activate a bonus (internal use / cron only)
 * NOT exposed to client — requires bonusId known only server-side
 */
export async function activateBonus(bonusId: string): Promise<ActionResponse> {
    try {
        if (!bonusId || typeof bonusId !== "string") {
            return { success: false, error: "bonusId invalide" };
        }

        const bonus = await db.guildBonus.findUnique({
            where: { id: bonusId },
        });

        if (!bonus) {
            return { success: false, error: "Bonus introuvable" };
        }

        if (bonus.status !== BonusStatus.PURCHASED) {
            return { success: false, error: "Le bonus n'est pas en attente" };
        }

        const now = new Date();
        if (now < bonus.activatesAt) {
            return { success: false, error: "Le bonus ne peut pas encore être activé" };
        }

        const config = BONUS_CONFIG[bonus.bonusType];
        const expiresAt = new Date(bonus.activatesAt.getTime() + config.duration);

        await db.guildBonus.update({
            where: { id: bonusId },
            data: {
                status: BonusStatus.ACTIVE,
                expiresAt,
            },
        });

        revalidatePath(`/admin/bonus`);
        revalidatePath(`/[guildSlug]/missions`);

        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Expire a bonus (internal use / cron only)
 * NOT exposed to client — requires bonusId known only server-side
 */
export async function expireBonus(bonusId: string): Promise<ActionResponse> {
    try {
        if (!bonusId || typeof bonusId !== "string") {
            return { success: false, error: "bonusId invalide" };
        }

        const bonus = await db.guildBonus.findUnique({
            where: { id: bonusId },
        });

        if (!bonus) {
            return { success: false, error: "Bonus introuvable" };
        }

        if (bonus.status !== BonusStatus.ACTIVE) {
            return { success: false, error: "Le bonus n'est pas actif" };
        }

        const now = new Date();
        if (!bonus.expiresAt || now < bonus.expiresAt) {
            return { success: false, error: "Le bonus n'est pas encore expiré" };
        }

        await db.guildBonus.update({
            where: { id: bonusId },
            data: { status: BonusStatus.EXPIRED },
        });

        revalidatePath(`/admin/bonus`);
        revalidatePath(`/[guildSlug]/missions`);

        return { success: true };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Check if a specific bonus type is currently active for a guild
 * Server-only utility — no need for user-facing auth since this is
 * called from other server actions that already have their own auth
 */
export async function isBonusActive(
    guildId: string,
    bonusType: BonusType
): Promise<boolean> {
    try {
        const bonus = await db.guildBonus.findFirst({
            where: {
                guildId,
                bonusType,
                status: BonusStatus.ACTIVE,
                expiresAt: {
                    gte: new Date(),
                },
            },
        });

        return !!bonus;
    } catch {
        return false;
    }
}

/**
 * Get the XP multiplier for a guild (for WISDOM bonus)
 * Server-only utility — called from mission-actions.ts
 */
export async function getXpMultiplier(guildId: string): Promise<number> {
    const isWisdomActive = await isBonusActive(guildId, BonusType.WISDOM);
    return isWisdomActive ? 1.5 : 1.0;
}

// --- Bonus Settings (Channel Config) ---

/**
 * Get the bonus notification config for a guild
 */
export async function getBonusConfig(
    guildId: string
): Promise<ActionResponse<{ bonusNotifyChannelId: string | null }>> {
    try {
        await requireAdmin(guildId);

        const config = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { bonusNotifyChannelId: true },
        });

        if (!config) {
            return { success: false, error: "Guilde introuvable" };
        }

        return { success: true, data: { bonusNotifyChannelId: config.bonusNotifyChannelId } };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

/**
 * Update the bonus notification channel for a guild
 */
export async function updateBonusChannel(
    guildId: string,
    channelId: string | null
): Promise<ActionResponse> {
    try {
        await requireAdmin(guildId);

        // Validate channel ID format if provided
        if (channelId) {
            const channelSchema = z.string().regex(/^\d{17,20}$/, "ID Discord invalide");
            channelSchema.parse(channelId);

            // Verify channel belongs to this guild
            const { validateChannelBelongsToGuild } = await import("@/server/discord");
            const isValid = await validateChannelBelongsToGuild(channelId, guildId);
            if (!isValid) {
                return { success: false, error: "Ce salon n'appartient pas à votre serveur Discord" };
            }
        }

        await db.guildConfig.update({
            where: { discordGuildId: guildId },
            data: { bonusNotifyChannelId: channelId },
        });

        revalidatePath(`/dashboard/${guildId}/admin/settings`);
        return { success: true };
    } catch (error) {
        if ((error as any).name === "ZodError") {
            return { success: false, error: "ID de salon Discord invalide" };
        }
        return { success: false, error: (error as Error).message };
    }
}

