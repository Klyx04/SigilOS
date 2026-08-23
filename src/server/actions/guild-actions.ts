"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";

export type GuildHeaderData = {
    name: string;
    iconUrl: string | null;
    memberCount: number;
    activeCount: number; // Users active in last 15 minutes
    exists: boolean;
    welcomeBadgeName?: string | null;
};

import { cache } from "react";

// In-memory cache for guild header (1min TTL since counts are expensive-ish)
const headerCache = new Map<string, { data: GuildHeaderData, expiresAt: number }>();
const HEADER_CACHE_TTL = 60_000;

export const getGuildHeaderData = cache(async (discordGuildId: string): Promise<GuildHeaderData> => {
    const now = Date.now();
    const cached = headerCache.get(discordGuildId);
    if (cached && cached.expiresAt > now) return cached.data;

    try {
        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId },
            select: {
                id: true,
                name: true,
                iconUrl: true,
                welcomeBadgeName: true,
            }
        });

        if (!guildConfig) {
            const emptyData: GuildHeaderData = {
                name: "Guilde Inconnue",
                iconUrl: null,
                memberCount: 0,
                activeCount: 0,
                exists: false
            };
            return emptyData;
        }

        // Count profiles in parallel
        const [memberCount, activeCount] = await Promise.all([
            db.userProfile.count({
                where: { guildId: guildConfig.id, status: "ACTIVE" }
            }),
            db.userProfile.count({
                where: {
                    guildId: guildConfig.id,
                    status: "ACTIVE",
                    lastActivityAt: { gte: new Date(now - 2 * 60 * 1000) }
                }
            })
        ]);

        const data: GuildHeaderData = {
            name: guildConfig.name,
            iconUrl: guildConfig.iconUrl,
            memberCount,
            activeCount,
            exists: true,
            welcomeBadgeName: guildConfig.welcomeBadgeName
        };

        headerCache.set(discordGuildId, { data, expiresAt: now + HEADER_CACHE_TTL });
        return data;
    } catch {
        return { name: "Erreur", iconUrl: null, memberCount: 0, activeCount: 0, exists: false };
    }
});

// Cache for user guild lists (30s TTL)
const userGuildsCache = new Map<string, { data: any[], expiresAt: number }>();

export const getUserGuilds = cache(async (userId: string): Promise<{ id: string; name: string; iconUrl: string | null }[]> => {
    const now = Date.now();
    const cached = userGuildsCache.get(userId);
    if (cached && cached.expiresAt > now) return cached.data;

    try {
        const profiles = await db.userProfile.findMany({
            where: { userId, status: "ACTIVE" },
            select: {
                guild: {
                    select: { id: true, name: true, iconUrl: true, discordGuildId: true }
                }
            }
        });

        const data = profiles.map(p => ({
            id: (p.guild as any).discordGuildId || p.guild.id,
            name: p.guild.name,
            iconUrl: p.guild.iconUrl
        }));

        userGuildsCache.set(userId, { data, expiresAt: now + 30_000 });
        return data;
    } catch {
        return [];
    }
});
