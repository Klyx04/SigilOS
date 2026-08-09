"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";

export type ActivityType = 
    | "SERVICE" 
    | "LOAN" 
    | "VAULT" 
    | "MISSION_VALIDATED" 
    | "OCRE_TRADE" 
    | "DONATION_VALIDATED";

export interface UnifiedLog {
    id: string;
    type: ActivityType;
    createdAt: Date;
    actor: {
        pseudoDofus: string | null;
        discordNickname: string | null;
        image: string | null;
    };
    summary: string;
    metadata?: any;
}

import { redis } from "@/lib/redis";

export async function getUnifiedGuildActivity(guildId: string, limit = 15): Promise<UnifiedLog[]> {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return [];

    const cacheKey = `guild:activity:${guildId}:${limit}`;

    try {
        // 1. Try Redis Cache (30s)
        const cached = await redis.get(cacheKey).catch(() => null);
        if (cached) return JSON.parse(cached) as UnifiedLog[];

        const guildConfig = await db.guildConfig.findUnique({
            where: { discordGuildId: guildId },
            select: { id: true }
        });
        if (!guildConfig) return [];

        const internalGuildId = guildConfig.id;

        // Sequential queries or slim selects to avoid pool starvation
        const serviceLogs = await db.serviceActivityLog.findMany({
            where: { guildId: internalGuildId },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: {
                id: true,
                module: true,
                summary: true,
                createdAt: true,
                actor: {
                    select: {
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { image: true } }
                    }
                }
            }
        });

        const missionSubmissions = await db.submission.findMany({
            where: { 
                mission: { guildId: internalGuildId },
                status: "VALIDATED"
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: {
                id: true,
                updatedAt: true,
                profile: {
                    select: {
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { image: true } }
                    }
                },
                mission: { select: { title: true } }
            }
        });

        const ocreTrades = await db.ocreTradeRequest.findMany({
            where: { 
                guildId: internalGuildId,
                status: "ACCEPTED"
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: {
                id: true,
                updatedAt: true,
                monsterName: true,
                requester: {
                    select: {
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { image: true } }
                    }
                },
                target: {
                    select: {
                        pseudoDofus: true
                    }
                }
            }
        });

        const donations = await db.kamaDonation.findMany({
            where: {
                guildId: internalGuildId,
                status: "VALIDATED"
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: {
                id: true,
                updatedAt: true,
                amount: true,
                profile: {
                    select: {
                        pseudoDofus: true,
                        discordNickname: true,
                        user: { select: { image: true } }
                    }
                }
            }
        });

        const unified: UnifiedLog[] = [];

        // ... mapping logic remains same ...
        serviceLogs.forEach(log => {
            unified.push({
                id: log.id,
                type: log.module as ActivityType,
                createdAt: log.createdAt,
                actor: {
                    pseudoDofus: log.actor.pseudoDofus,
                    discordNickname: log.actor.discordNickname,
                    image: log.actor.user.image
                },
                summary: log.summary
            });
        });

        missionSubmissions.forEach(sub => {
            unified.push({
                id: sub.id,
                type: "MISSION_VALIDATED",
                createdAt: sub.updatedAt,
                actor: {
                    pseudoDofus: sub.profile.pseudoDofus,
                    discordNickname: sub.profile.discordNickname,
                    image: sub.profile.user.image
                },
                summary: `A validé la mission : ${sub.mission.title || "Mission de semaine"}`
            });
        });

        ocreTrades.forEach(trade => {
            unified.push({
                id: trade.id,
                type: "OCRE_TRADE",
                createdAt: trade.updatedAt,
                actor: {
                    pseudoDofus: trade.requester.pseudoDofus,
                    discordNickname: trade.requester.discordNickname,
                    image: trade.requester.user.image
                },
                summary: `A échangé ${trade.monsterName || "un archimonstre"} avec ${trade.target.pseudoDofus || "un membre"}`
            });
        });

        donations.forEach(donation => {
            unified.push({
                id: donation.id,
                type: "DONATION_VALIDATED",
                createdAt: donation.updatedAt,
                actor: {
                    pseudoDofus: donation.profile.pseudoDofus,
                    discordNickname: donation.profile.discordNickname,
                    image: donation.profile.user.image
                },
                summary: `A fait un don de ${donation.amount.toLocaleString()} kamas`
            });
        });

        const sorted = unified
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, limit);

        // 2. Store in Redis
        await redis.set(cacheKey, JSON.stringify(sorted), "EX", 30).catch(() => {});

        return sorted;

    } catch (error) {
        logger.error("[getUnifiedGuildActivity] Error:", error);
        return [];
    }
}
