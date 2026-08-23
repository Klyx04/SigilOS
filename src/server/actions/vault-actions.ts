"use server";
import { logger } from "@/lib/logger";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { getUserContext, type ActionResponse } from "./user-actions";
import { logServiceActivity } from "./activity-log-actions";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { VaultAction } from "@prisma/client";
import { sendChannelMessage, validateChannelBelongsToGuild } from "@/server/discord";
import { hashImage } from "@/lib/llm-ocr";
import { getDiscordPublicUrl } from "@/lib/storage-utils";

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export type VaultEntryWithProfile = {
    id: string;
    guildId: string;
    profileId: string;
    action: VaultAction;
    itemName: string;
    quantity: number | null;
    description: string | null;
    proofUrl: string | null;
    linkedItemIconUrl: string | null;
    createdAt: Date;
    profile: {
        id: string;
        pseudoDofus: string | null;
        discordNickname: string | null;
        userId: string;
        user: { name: string | null; image: string | null };
    };
};

export type VaultSummaryItem = {
    itemName: string;
    totalDeposited: number;
    totalWithdrawn: number;
    balance: number;
    iconUrl: string | null; // icône du premier dépôt/retrait pour cet item
};

// ---------------------------------------------------------------------------
// SCHEMAS
// ---------------------------------------------------------------------------

const createVaultEntrySchema = z.object({
    action: z.nativeEnum(VaultAction),
    itemName: z.string().min(1, "Nom de l'objet requis").max(100),
    quantity: z.number().int().min(1).max(999999).default(1),
    description: z.string().max(500).optional().nullable(),
    linkedItemIconUrl: z.string().url().optional().nullable(),
    notifyDiscord: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

import { VAULT_ACTION_LABELS } from "./services-constants";

const profileSelect = {
    id: true,
    pseudoDofus: true,
    discordNickname: true,
    userId: true,
    user: { select: { name: true, image: true } },
};

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getVaultEntries(
    guildId: string,
    filters?: { action?: VaultAction; profileId?: string; limit?: number }
): Promise<ActionResponse<VaultEntryWithProfile[]>> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember || !user.canViewServices) {
            return { success: false, error: "Accès refusé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const where: any = { guildId: guildConfig.id };
        if (filters?.action) where.action = filters.action;
        if (filters?.profileId) where.profileId = filters.profileId;

        const entries = await db.vaultEntry.findMany({
            where,
            include: { profile: { select: profileSelect } },
            orderBy: { createdAt: "desc" },
            take: filters?.limit || 100,
        });

        return { success: true, data: entries as VaultEntryWithProfile[] };
    } catch (error) {
        logger.error("[getVaultEntries]", error);
        return { success: false, error: "Erreur interne" };
    }
}

export async function createVaultEntry(
    guildId: string,
    input: z.infer<typeof createVaultEntrySchema>,
    proofFormData?: FormData
): Promise<ActionResponse<{ id: string }>> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember || !user.canViewServices) {
            return { success: false, error: "Accès refusé" };
        }
        if (!user.profileId) return { success: false, error: "Profil introuvable" };

        const parsed = createVaultEntrySchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: parsed.error.errors[0]?.message || "Données invalides" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true, serviceVaultEnabled: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        if (!guildConfig.serviceVaultEnabled && !user.isAdmin) {
            return { success: false, error: "Le coffre de guilde est actuellement en maintenance." };
        }

        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Unauthorized" };

        // Handle proof upload
        let proofUrl: string | null = null;
        let finalImageHash: string | null = null;
        if (proofFormData) {
            const file = proofFormData.get("file") as File | null;
            if (file) {
                const buffer = Buffer.from(await file.arrayBuffer());
                finalImageHash = await hashImage(buffer);

                const existingHash = await db.imageHash.findFirst({
                    where: { hash: finalImageHash }
                });

                if (existingHash) {
                    return { success: false, error: "Cette image a déjà été utilisée pour une preuve dans l'application." };
                }

                const { uploadProofImage } = await import("./upload-actions");
                const uploadResult = await uploadProofImage(guildConfig.id, proofFormData);
                if (uploadResult.success && uploadResult.url) {
                    proofUrl = uploadResult.url;

                    // Store hash
                    await (db as any).imageHash.create({
                        data: {
                            guildId: guildConfig.id,
                            hash: finalImageHash,
                            sourceType: "VAULT",
                            sourceId: "PENDING", // Temporary
                            uploaderId: session.user.id
                        }
                    });
                }
            }
        }

        const entry = await db.vaultEntry.create({
            data: {
                guildId: guildConfig.id,
                profileId: user.profileId,
                action: parsed.data.action,
                itemName: parsed.data.itemName,
                quantity: parsed.data.quantity,
                description: parsed.data.description || null,
                proofUrl,
                linkedItemIconUrl: parsed.data.linkedItemIconUrl || null,
            },
        });

        // Update image hash with the real sourceId
        if (proofUrl && finalImageHash) {
            await (db as any).imageHash.update({
                where: { hash: finalImageHash },
                data: { sourceId: entry.id }
            });
        }

        // Immutable activity log
        await logServiceActivity({
            guildId: guildConfig.id,
            actorId: user.profileId,
            module: "VAULT",
            action: "CREATED",
            entityId: entry.id,
            summary: `Coffre : ${parsed.data.action === "DEPOSIT" ? "Dépôt" : "Retrait"} de ${parsed.data.quantity || 1}x ${parsed.data.itemName}`,
            metadata: proofUrl ? JSON.stringify({ proofUrl }) : undefined,
        });

        // ── Discord Embed ─────────────────────────────────────────────────────
        if (parsed.data.notifyDiscord) {
            try {
                const guildFull = await db.guildConfig.findUnique({
                    where: { id: guildConfig.id },
                    select: { discordGuildId: true, vaultNotifyChannelId: true },
                });
                const channelId = guildFull?.vaultNotifyChannelId;

                if (channelId) {
                    // SECURITY: Validate channel belongs to this guild
                    const valid = await validateChannelBelongsToGuild(channelId, guildId);
                    if (valid) {
                        const isDeposit = parsed.data.action === VaultAction.DEPOSIT;
                        const color = isDeposit ? 0x22c55e : 0xf97316;
                        const emoji = isDeposit ? "📥" : "📤";
                        const actionLabel = isDeposit ? "Dépôt" : "Retrait";
                        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sigilos.fr";
                        const dashboardUrl = `${appUrl}/dashboard/${guildId}/services`;
                        // Discord needs an absolute URL with access token
                        const publicProofUrl = getDiscordPublicUrl(proofUrl);

                        // Get actor profile + Discord mention
                        const actorProfile = await db.userProfile.findUnique({
                            where: { id: user.profileId },
                            select: { pseudoDofus: true, discordNickname: true, userId: true, user: { select: { name: true } } },
                        });
                        const actorName = actorProfile?.pseudoDofus || actorProfile?.discordNickname || actorProfile?.user?.name || "Membre";
                        const actorDiscordId = actorProfile?.userId ? await db.account.findFirst({
                            where: { userId: actorProfile.userId, provider: "discord" },
                            select: { providerAccountId: true },
                        }).then(a => a?.providerAccountId ?? null) : null;
                        const actorMention = actorDiscordId ? `<@${actorDiscordId}>` : actorName;

                        const fields = [
                            { name: `${emoji} Action`, value: actionLabel, inline: true },
                            { name: "📦 Item", value: `**${parsed.data.quantity || 1}x** ${parsed.data.itemName}`, inline: true },
                            { name: "👤 Membre", value: actorMention, inline: true },
                        ];
                        if (parsed.data.description) {
                            fields.push({ name: "💬 Note", value: parsed.data.description, inline: false });
                        }
                        fields.push({ name: "🔗 Voir sur le dashboard", value: `[Ouvrir SigilOS](${dashboardUrl})`, inline: false });

                        // #201 — on stocke l'ID du message Discord pour pouvoir supprimer
                        // l'embed à la suppression (évite l'image noire quand le fichier est purgé).
                        const discordMessageId = await sendChannelMessage(
                            channelId,
                            "",
                            {
                                embedTitle: `${emoji} Coffre : ${actionLabel} — ${parsed.data.itemName}`,
                                embedColor: color,
                                embedFooter: "SigilOS • Coffre de Guilde",
                                embedThumbnail: parsed.data.linkedItemIconUrl || undefined,
                                embedImage: publicProofUrl,
                                fields,
                            }
                        );
                        if (discordMessageId) {
                            await db.vaultEntry.update({
                                where: { id: entry.id },
                                data: { discordChannelId: channelId, discordMessageId },
                            });
                        }
                    } else {
                        logger.warn(`[createVaultEntry] Channel ${channelId} invalid for guild ${guildId}`);
                    }
                }
            } catch (discordErr) {
                // Non-blocking
                logger.error("[createVaultEntry] Discord notify failed:", discordErr);
            }
        }

        revalidatePath(`/dashboard/${guildId}/services`);
        return { success: true, data: { id: entry.id } };
    } catch (error) {
        logger.error("[createVaultEntry]", error);
        return { success: false, error: "Erreur interne" };
    }
}

export async function deleteVaultEntry(
    guildId: string,
    entryId: string
): Promise<ActionResponse> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember) {
            return { success: false, error: "Accès refusé" };
        }

        const entryFull = await db.vaultEntry.findUnique({
            where: { id: entryId },
            select: { profileId: true, proofUrl: true, guildId: true, discordChannelId: true, discordMessageId: true },
        });
        if (!entryFull) return { success: false, error: "Entrée introuvable" };

        // Only author or admin can delete
        if (entryFull.profileId !== user.profileId && !user.isAdmin) {
            return { success: false, error: "Seul l'auteur ou un admin peut supprimer cette entrée." };
        }

        // #201 — supprimer l'embed Discord AVANT le fichier (sinon image noire)
        if (entryFull.discordChannelId && entryFull.discordMessageId) {
            try {
                const { deleteChannelMessage } = await import("@/server/discord");
                await deleteChannelMessage(entryFull.discordChannelId, entryFull.discordMessageId);
            } catch (discordErr) {
                logger.error("[deleteVaultEntry] Discord embed delete failed:", discordErr);
            }
        }

        // Auto-cleanup screenshot avant le delete DB
        if (entryFull.proofUrl) {
            const { deleteProofFile } = await import("@/lib/storage-utils");
            await deleteProofFile(entryFull.proofUrl);
        }

        await db.vaultEntry.delete({ where: { id: entryId } });

        // Immutable activity log — entry is already gone, log the deletion
        const guildConfig = await db.guildConfig.findUnique({ where: { discordGuildId: guildId }, select: { id: true } });
        if (guildConfig && user.profileId) {
            await logServiceActivity({
                guildId: guildConfig.id,
                actorId: user.profileId,
                module: "VAULT",
                action: "DELETED",
                entityId: entryId,
                summary: `Entrée coffre supprimée (par ${user.isAdmin && entryFull.profileId !== user.profileId ? "admin" : "l'auteur"})`,
            });
        }

        revalidatePath(`/dashboard/${guildId}/services`);
        return { success: true };
    } catch (error) {
        logger.error("[deleteVaultEntry]", error);
        return { success: false, error: "Erreur interne" };
    }
}

export async function getVaultBalance(
    guildId: string
): Promise<ActionResponse<VaultSummaryItem[]>> {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isMember || !user.canViewServices) {
            return { success: false, error: "Accès refusé" };
        }

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const entries = await db.vaultEntry.findMany({
            where: { guildId: guildConfig.id },
            select: { itemName: true, action: true, quantity: true, linkedItemIconUrl: true },
            orderBy: { createdAt: "asc" }, // asc pour prendre la première icone enregistrée
        });

        // Aggregate by item name (case-insensitive)
        const map = new Map<string, { deposited: number; withdrawn: number; iconUrl: string | null }>();
        for (const e of entries) {
            const key = e.itemName.toLowerCase().trim();
            const existing = map.get(key) || { deposited: 0, withdrawn: 0, iconUrl: null };
            if (e.action === "DEPOSIT") {
                existing.deposited += e.quantity || 1;
            } else {
                existing.withdrawn += e.quantity || 1;
            }
            // Garde la première icône non-nulle trouvée pour cet item
            if (!existing.iconUrl && e.linkedItemIconUrl) {
                existing.iconUrl = e.linkedItemIconUrl;
            }
            map.set(key, existing);
        }

        const summary: VaultSummaryItem[] = Array.from(map.entries())
            .map(([name, { deposited, withdrawn, iconUrl }]) => ({
                itemName: name,
                totalDeposited: deposited,
                totalWithdrawn: withdrawn,
                balance: deposited - withdrawn,
                iconUrl,
            }))
            .filter(s => s.balance !== 0)
            .sort((a, b) => b.balance - a.balance);

        return { success: true, data: summary };
    } catch (error) {
        logger.error("[getVaultBalance]", error);
        return { success: false, error: "Erreur interne" };
    }
}
