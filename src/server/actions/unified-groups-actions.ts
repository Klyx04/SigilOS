"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { DjPostWithDetails } from "./dungeon-finder-actions";

export type UnifiedGroup = {
    id: string;
    type: "DUNGEON" | "QUEST" | "DREAM";
    title: string;
    level: string | number;
    authorName: string;
    authorImage: string | null;
    participantsCount: number;
    maxMembers: number;
    createdAt: Date;
    imageUrl: string | null;
    status: string;
};

import { redis } from "@/lib/redis";

export async function getUnifiedActiveGroups(guildId: string): Promise<{ success: boolean; groups: UnifiedGroup[] }> {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.isMember) return { success: false, groups: [] };

    const cacheKey = `guild:groups:${guildId}`;

    try {
        // 1. Try Redis Cache (30s)
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) return { success: true, groups: JSON.parse(cached) as UnifiedGroup[] };

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true },
        });
        if (!guildConfig) return { success: false, groups: [] };

        // 2. Fetch DJ Posts
        const djPosts = await (db as any).djSearchPost.findMany({
            where: {
                guildId: guildConfig.id,
                status: { in: ["OPEN", "FULL"] },
            },
            include: {
                dungeon: { select: { name: true, level: true, imageUrl: true } },
                profile: { select: { discordNickname: true, pseudoDofus: true, user: { select: { image: true } } } },
                participants: { where: { status: "ACCEPTED" }, select: { id: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        // 3. Fetch Active Dream Runs
        const dreamRuns = await db.dreamRun.findMany({
            where: {
                guildId: guildId, // DreamRun uses discordGuildId as guildId in the model (check schema)
                status: { in: ["RECRUITING", "IN_PROGRESS"] },
            },
            include: {
                leader: { select: { name: true, image: true, profiles: { where: { guildId: guildConfig.id }, select: { discordNickname: true, pseudoDofus: true } } } },
                members: { select: { id: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
        });

        // 4. Map to unified format
        const unifiedDjGroups: UnifiedGroup[] = djPosts.map((p: any) => {
            const isDungeon = p.mode === "DONJON";
            const name = isDungeon ? p.dungeon?.name : p.questName;
            const author = p.profile?.pseudoDofus || p.profile?.discordNickname || "Membre";
            
            return {
                id: p.id,
                type: isDungeon ? "DUNGEON" : "QUEST",
                title: name || "Groupe sans nom",
                level: p.dungeon?.level || "?",
                authorName: author,
                authorImage: p.profile?.user?.image || null,
                participantsCount: (p.participants?.length || 0) + 1,
                maxMembers: p.maxMembers,
                createdAt: p.createdAt,
                imageUrl: p.dungeon?.imageUrl || null,
                status: p.status,
            };
        });

        const unifiedDreamGroups: UnifiedGroup[] = dreamRuns.map((r) => {
            const profile = r.leader.profiles[0];
            const author = profile?.pseudoDofus || profile?.discordNickname || r.leader.name || "Membre";
            
            return {
                id: r.id,
                type: "DREAM",
                title: `Songes: ${r.difficulty.replace(/_/g, " ")}`,
                level: r.currentFloor > 0 ? `Étage ${r.currentFloor}` : "Recrutement",
                authorName: author,
                authorImage: r.leader.image,
                participantsCount: r.members.length,
                maxMembers: 4,
                createdAt: r.createdAt,
                imageUrl: "/module-songes/dream-icon.png", // Or a generic icon
                status: r.status,
            };
        });

        const allGroups = [...unifiedDjGroups, ...unifiedDreamGroups].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // 5. Store in Redis (30s)
        await redis.set(cacheKey, JSON.stringify(allGroups), "EX", 30).catch(() => {});

        return { success: true, groups: allGroups };
    } catch (error) {
        logger.error("[getUnifiedActiveGroups]", error);
        return { success: false, groups: [] };
    }
}
