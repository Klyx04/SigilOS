"use server";
import { logger } from "@/lib/logger";

import { db } from "@/lib/prisma";
import { getUserContext } from "./user-actions";
import { resolveGuildActivityKind, shouldNotifyGuildActivity } from "@/lib/guild-activity";
import { isNotificationImageKind, sanitizeNotificationImageUrl } from "@/lib/notification-categories";

export type ActivityType = 
    | "SERVICE" 
    | "LOAN" 
    | "VAULT" 
    | "MISSION_VALIDATED" 
    | "OCRE_TRADE" 
    | "DONATION_VALIDATED"
    // ── Activité de guilde (chantier N, lot N-2) : modules écrits par `logServiceActivity` ──
    | "MISSIONS"
    | "DONJONS"
    | "SONGES"
    | "OCRE"
    | "EVENTS"
    | "SUCCES"
    | "DOFUS"
    | "PALIERS"
    | "LADDER"
    | "OBJECTIFS";

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
    /** Asset de l'objet annoncé (illustration de donjon, de Dofus…) — `null` pour la plupart des lignes. */
    imageUrl?: string | null;
    /** Ce que l'asset représente (`NotificationImageKind`). */
    imageKind?: string | null;
}

/**
 * Relit l'asset qu'`emitGuildActivity` range dans `metadata` — une ligne de flux porte déjà tout
 * ce dont la bulle a besoin, donc **aucune migration** n'est nécessaire pour l'afficher.
 *
 * Fail-closed : `metadata` absent, `null` ou illisible ⇒ aucun asset (la bulle retombe sur le
 * texte seul). Le chemin est revalidé ici — une valeur écrite en base il y a six mois n'est pas
 * une garantie d'aujourd'hui.
 */
function readActivityAsset(metadata: unknown): { imageUrl: string | null; imageKind: string | null } {
    if (typeof metadata !== "string" || metadata.length === 0) {
        return { imageUrl: null, imageKind: null };
    }
    try {
        const parsed = JSON.parse(metadata) as { imageUrl?: unknown; imageKind?: unknown };
        return {
            imageUrl: sanitizeNotificationImageUrl(parsed.imageUrl),
            imageKind: isNotificationImageKind(parsed.imageKind) ? parsed.imageKind : null,
        };
    } catch {
        return { imageUrl: null, imageKind: null };
    }
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
                // Asset de l'objet annoncé : rangé ici par `emitGuildActivity` (aucune migration).
                metadata: true,
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
                summary: log.summary,
                ...readActivityAsset(log.metadata)
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

/**
 * Chantier **N**, lot **N-3** — les lignes du flux **visibles pour ce membre**, filtrées par **ses**
 * préférences d'annonce (`UserProfile.notificationPrefs`, règle pure `shouldNotifyGuildActivity`).
 *
 * Pourquoi ici et pas côté navigateur : un filtre client laisserait passer la donnée. Ici, une
 * activité coupée **ne sort jamais de la base** vers ce membre (fail-closed, `AGENTS.md` §5).
 *
 * Les lignes hors activité de guilde (service, prêt, coffre, dons) ne sont **pas** concernées par
 * ces préférences et traversent toujours : ces modules ont leurs propres réglages.
 */
export async function getGuildActivityToasts(guildId: string, limit = 6): Promise<UnifiedLog[]> {
    const user = await getUserContext(guildId);
    if (!user.isAuthenticated) return [];

    const prefs = user.profileId
        ? (
              await db.userProfile
                  .findUnique({ where: { id: user.profileId }, select: { notificationPrefs: true } })
                  .catch(() => null)
          )?.notificationPrefs
        : null;

    const lines = await getUnifiedGuildActivity(guildId, limit);
    return lines.filter((line) => {
        const kind = resolveGuildActivityKind(line.type);
        if (!kind) return true;
        return shouldNotifyGuildActivity({ kind, prefs });
    });
}
