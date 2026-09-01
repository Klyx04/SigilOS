"use server";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { isSuperAdmin } from "./super-admin-actions";
import { logAction } from "./audit-actions";
import { z } from "zod";
import crypto from "crypto";
import { logger } from "@/lib/logger";

const createApiKeySchema = z.object({
    guildId: z.string().min(1),
    name: z.string().min(2).max(50),
    scopes: z.array(z.string()).min(1),
    rateLimitPerMin: z.number().int().min(10).max(300).default(60),
    expiresInDays: z.number().int().min(1).max(365).optional().nullable()
});

/**
 * Crée une nouvelle clé d'API pour une guilde (sécurisée par hachage SHA-256)
 */
export async function createGuildApiKeyAction(input: z.infer<typeof createApiKeySchema>) {
    try {
        const parsed = createApiKeySchema.safeParse(input);
        if (!parsed.success) {
            return { success: false, error: "Validation failed" };
        }

        const { guildId, name, scopes, rateLimitPerMin, expiresInDays } = parsed.data;
        const user = await getUserContext(guildId);

        if (!user.isAuthenticated || !user.isAdmin) {
            return { success: false, error: "Forbidden: Guild Owner or Admin required" };
        }

        // Limit to 5 active keys per guild
        const activeKeysCount = await db.guildApiKey.count({
            where: {
                guildId,
                revokedAt: null
            }
        });

        if (activeKeysCount >= 5) {
            return { success: false, error: "Limite de 5 clés d'API actives par guilde atteinte" };
        }

        // Generate high-entropy raw secret: sigil_live_<hex32>
        const rawEntropy = crypto.randomBytes(24).toString("hex");
        const rawApiKey = `sigil_live_${rawEntropy}`;
        const prefix = rawApiKey.slice(0, 16); // e.g. "sigil_live_ab1234"
        // CodeQL — hash « insuffisant » : on passe à un KDF memory-hard (scrypt) avec sel aléatoire.
        const keySalt = crypto.randomBytes(16).toString("hex");
        const keyHash = `scrypt$${keySalt}$${crypto.scryptSync(rawApiKey, keySalt, 64).toString("hex")}`;

        const expiresAt = expiresInDays 
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) 
            : null;

        const apiKeyRecord = await db.guildApiKey.create({
            data: {
                guildId,
                name,
                keyHash,
                prefix,
                scopes,
                rateLimitPerMin,
                expiresAt,
                createdById: (user as any).id || "system"
            }
        });

        await logAction({
            guildId,
            action: "API_KEY_UPDATED",
            targetType: "CONFIG",
            newValue: { name, prefix, scopes, rateLimitPerMin }
        }).catch(() => {});

        return {
            success: true,
            data: {
                id: apiKeyRecord.id,
                name: apiKeyRecord.name,
                prefix: apiKeyRecord.prefix,
                scopes: apiKeyRecord.scopes,
                rawApiKey, // Returned ONLY ONCE
                expiresAt: apiKeyRecord.expiresAt
            }
        };
    } catch (err) {
        logger.error("[createGuildApiKeyAction Error]", err);
        return { success: false, error: "Failed to create API key" };
    }
}

/**
 * Récupère les clés d'API configurées pour une guilde
 */
export async function getGuildApiKeysAction(guildId: string) {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isAdmin) {
            return { success: false, error: "Unauthorized" };
        }

        const keys = await db.guildApiKey.findMany({
            where: { guildId },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                prefix: true,
                scopes: true,
                rateLimitPerMin: true,
                lastUsedAt: true,
                expiresAt: true,
                revokedAt: true,
                createdAt: true
            }
        });

        return { success: true, data: keys };
    } catch (err) {
        logger.error("[getGuildApiKeysAction Error]", err);
        return { success: false, error: "Failed to fetch API keys" };
    }
}

/**
 * Révoque une clé d'API de guilde
 */
export async function revokeGuildApiKeyAction(guildId: string, apiKeyId: string) {
    try {
        const user = await getUserContext(guildId);
        if (!user.isAuthenticated || !user.isAdmin) {
            return { success: false, error: "Forbidden" };
        }

        const existing = await db.guildApiKey.findUnique({
            where: { id: apiKeyId }
        });

        if (!existing || existing.guildId !== guildId) {
            return { success: false, error: "Clé d'API introuvable" };
        }

        const revoked = await db.guildApiKey.update({
            where: { id: apiKeyId },
            data: { revokedAt: new Date() }
        });

        await logAction({
            guildId,
            action: "API_KEY_UPDATED",
            targetType: "CONFIG",
            newValue: { revoked: true, name: existing.name, prefix: existing.prefix }
        }).catch(() => {});

        return { success: true, data: revoked };
    } catch (err) {
        logger.error("[revokeGuildApiKeyAction Error]", err);
        return { success: false, error: "Failed to revoke API key" };
    }
}

/**
 * GOD SuperAdmin : Récupère la liste de toutes les clés d'API actives sur la plateforme
 */
export async function getPlatformApiKeysOverviewAction() {
    try {
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) return { success: false, error: "Unauthorized" };

        const keys = await db.guildApiKey.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                guild: {
                    select: {
                        id: true,
                        name: true,
                        discordGuildId: true
                    }
                }
            }
        });

        return { success: true, data: keys };
    } catch (err) {
        logger.error("[getPlatformApiKeysOverviewAction Error]", err);
        return { success: false, error: "Failed to fetch platform API keys" };
    }
}
