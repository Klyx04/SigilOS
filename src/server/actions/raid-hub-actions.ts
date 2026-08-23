"use server";
import { logger } from "@/lib/logger";

/**
 * Raid Hub Module — Server Actions
 * Manages per-guild editable tips and links for both raid types.
 */

import { z } from "zod";
import { db } from "@/lib/prisma";
import { getUserContext } from "@/server/actions/user-actions";
import { revalidatePath } from "next/cache";
import { assertSafeUrl } from "@/lib/image-downloader";

// ============================================
// TYPES
// ============================================

export interface RaidTipLink {
    url: string;
    title?: string;
    description?: string;
    thumbnail?: string;
}

export interface RaidTipSection {
    id: string;
    content: string; // Markdown-like text
    links: RaidTipLink[];
}

export interface RaidHubConfig {
    jardinTips: RaidTipSection[];   // RAID_OFFICIAL (Jardin de Cania)
    gigalodonTips: RaidTipSection[]; // KRALAMOURE / Gigalodon
    jardinDescription?: string;
    gigalodonDescription?: string;
}

// ============================================
// SCHEMAS
// ============================================

const RaidTipLinkSchema = z.object({
    url: z.string().url("URL invalide").max(500),
    title: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    thumbnail: z.string().max(500).optional(),
});

const RaidTipSectionSchema = z.object({
    id: z.string(),
    content: z.string().max(2000),
    links: z.array(RaidTipLinkSchema).max(10),
});

const RaidHubConfigSchema = z.object({
    jardinTips: z.array(RaidTipSectionSchema).max(20),
    gigalodonTips: z.array(RaidTipSectionSchema).max(20),
    jardinDescription: z.string().max(500).optional(),
    gigalodonDescription: z.string().max(500).optional(),
});

// ============================================
// READ
// ============================================

export async function getRaidHubConfig(guildId: string): Promise<{
    success: boolean;
    config?: RaidHubConfig;
    error?: string;
}> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès restreint aux membres" };

    try {
        const guildConfig = await (db.guildConfig as any).findUnique({
            where: { discordGuildId: guildId },
            select: { raidHubConfig: true },
        });

        if (!guildConfig) return { success: false, error: "Guilde introuvable" };

        const rawConfig = guildConfig.raidHubConfig as any;

        const config: RaidHubConfig = {
            jardinTips: rawConfig?.jardinTips ?? [],
            gigalodonTips: rawConfig?.gigalodonTips ?? [],
            jardinDescription: rawConfig?.jardinDescription ?? "",
            gigalodonDescription: rawConfig?.gigalodonDescription ?? "",
        };

        return { success: true, config };
    } catch (error) {
        logger.error("[getRaidHubConfig]", error);
        return { success: false, error: "Erreur serveur" };
    }
}

// ============================================
// WRITE (admin only)
// ============================================

export async function updateRaidHubConfig(
    guildId: string,
    config: RaidHubConfig
): Promise<{ success: boolean; error?: string }> {
    const ctx = await getUserContext(guildId);
    if (!ctx.isAuthenticated) return { success: false, error: "Non authentifié" };
    if (!ctx.isMember) return { success: false, error: "Accès restreint" };
    if (!ctx.isAdmin) return { success: false, error: "Droits administrateur requis" };

    const parsed = RaidHubConfigSchema.safeParse(config);
    if (!parsed.success) {
        return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
    }

    try {
        const guildConfigRecord = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfigRecord) return { success: false, error: "Guilde introuvable" };

        await (db.guildConfig as any).update({
            where: { id: guildConfigRecord.id },
            data: { raidHubConfig: parsed.data },
        });

        revalidatePath(`/dashboard/${guildId}/calendar`);
        return { success: true };
    } catch (error) {
        logger.error("[updateRaidHubConfig]", error);
        return { success: false, error: "Erreur serveur lors de la sauvegarde" };
    }
}

// ============================================
// OPENGRAPH PREVIEW (link scraping)
// ============================================

export async function fetchLinkPreview(url: string): Promise<{
    success: boolean;
    title?: string;
    description?: string;
    thumbnail?: string;
    error?: string;
}> {
    try {
        const parsed = z.string().url().safeParse(url);
        if (!parsed.success) return { success: false, error: "URL invalide" };

        // Security: only http/https
        const urlObj = new URL(url);
        if (!["http:", "https:"].includes(urlObj.protocol)) {
            return { success: false, error: "Protocole non autorisé" };
        }

        // 🔒 SSRF fix (CodeQL): the protocol check alone does not stop an attacker
        // pointing at internal services (169.254.169.254, localhost, private IPs).
        // `assertSafeUrl` blocks private/reserved IPs + DNS rebinding (fail-closed).
        await assertSafeUrl(url);

        const response = await fetch(url, {
            headers: { "User-Agent": "SigilOS-Bot/1.0 (link preview)" },
            signal: AbortSignal.timeout(5000),
            next: { revalidate: 3600 }, // Cache 1h
        });

        if (!response.ok) return { success: false, error: `HTTP ${response.status}` };

        const html = await response.text();

        // Extract OG tags
        const getMetaContent = (property: string): string | undefined => {
            const match = html.match(
                new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i")
            ) || html.match(
                new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i")
            );
            return match?.[1];
        };

        const title =
            getMetaContent("og:title") ||
            getMetaContent("twitter:title") ||
            html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
            urlObj.hostname;

        const description =
            getMetaContent("og:description") ||
            getMetaContent("twitter:description") ||
            getMetaContent("description");

        const thumbnail =
            getMetaContent("og:image") ||
            getMetaContent("twitter:image");

        return {
            success: true,
            title: title?.trim().slice(0, 200),
            description: description?.trim().slice(0, 500),
            thumbnail: thumbnail?.trim(),
        };
    } catch (error) {
        return { success: false, error: "Impossible de charger la prévisualisation" };
    }
}
