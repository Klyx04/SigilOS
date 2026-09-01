"use server";
import { logger } from "@/lib/logger";

import { auth } from "@/auth";
import { db } from "@/lib/prisma";
import { isSuperAdmin } from "./super-admin-actions";
import { z } from "zod";

const dbAny = db as any;

const logTelemetrySchema = z.object({
    guildId: z.string().optional().nullable(),
    path: z.string().min(1),
    eventType: z.enum(["PAGE_VIEW", "INTERACTION"]),
    elementId: z.string().optional().nullable(),
    details: z.any().optional(),
});

export async function logTelemetryEvent(rawInput: z.infer<typeof logTelemetrySchema>) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized" };
        }

        const parsed = logTelemetrySchema.safeParse(rawInput);
        if (!parsed.success) {
            return { success: false, error: "Invalid inputs" };
        }

        const data = parsed.data;

        await dbAny.telemetryEvent.create({
            data: {
                userId: session.user.id,
                userName: session.user.name || "Membre",
                guildId: data.guildId || null,
                path: data.path,
                eventType: data.eventType,
                elementId: data.elementId || null,
                details: data.details || {},
            }
        });

        return { success: true };
    } catch (err) {
        logger.error("[Telemetry] Failed to log telemetry event:", err);
        return { success: false, error: "Internal Error" };
    }
}

export async function getTelemetryStats(filterGuildId?: string) {
    try {
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) {
            throw new Error("Unauthorized: Super-admin access required");
        }

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Build optional guild-scoped where clause
        const guildWhere = filterGuildId ? { guildId: filterGuildId } : undefined;
        const withGuild = (extra: object) => guildWhere ? { ...guildWhere, ...extra } : extra;

        const [
            totalEvents,
            pageViews24h,
            interactions24h,
            uniqueUsers24h,
            uniqueUsers7d,
            guildsActive7d,
            liveEvents,
            topPathsRaw,
            topInteractionsRaw,
            topUsersRaw,
            guildConfigs,
        ] = await Promise.all([
            // Total stats (guild-scoped if filter active)
            dbAny.telemetryEvent.count({ where: guildWhere }),
            // 24h page views
            dbAny.telemetryEvent.count({
                where: withGuild({
                    eventType: "PAGE_VIEW",
                    createdAt: { gte: oneDayAgo },
                })
            }),
            // 24h interactions
            dbAny.telemetryEvent.count({
                where: withGuild({
                    eventType: "INTERACTION",
                    createdAt: { gte: oneDayAgo },
                })
            }),
            // 24h unique users
            dbAny.telemetryEvent.groupBy({
                by: ["userId"],
                where: withGuild({ createdAt: { gte: oneDayAgo } }),
                _count: true
            }),
            // #34 — 7d unique users (WAU, pour le ratio DAU/WAU)
            dbAny.telemetryEvent.groupBy({
                by: ["userId"],
                where: withGuild({ createdAt: { gte: sevenDaysAgo } }),
                _count: true
            }),
            // #34 — guildes actives sur 7j (rétention produit, scope global uniquement)
            guildWhere ? Promise.resolve([]) : dbAny.telemetryEvent.groupBy({
                by: ["guildId"],
                where: { guildId: { not: null }, createdAt: { gte: sevenDaysAgo } },
                _count: true
            }),
            // Live activity (last 100 events)
            dbAny.telemetryEvent.findMany({
                where: guildWhere,
                orderBy: { createdAt: "desc" },
                take: 100
            }),
            // Top Paths (Most Visited Pages)
            dbAny.telemetryEvent.groupBy({
                by: ["path"],
                where: withGuild({ eventType: "PAGE_VIEW" }),
                _count: true,
                orderBy: { _count: { path: "desc" } },
                take: 15
            }),
            // Top Clicks/Interactions
            dbAny.telemetryEvent.groupBy({
                by: ["elementId"],
                where: withGuild({
                    eventType: "INTERACTION",
                    elementId: { not: null }
                }),
                _count: true,
                orderBy: { _count: { elementId: "desc" } },
                take: 15
            }),
            // Top Active Users — group only by userId (lighter scan), enrich names later via profileMap
            dbAny.telemetryEvent.groupBy({
                by: ["userId"],
                where: guildWhere,
                _count: true,
                orderBy: { _count: { userId: "desc" } },
                take: 50
            }),
            // Fetch all guild configs to map names
            dbAny.guildConfig.findMany({
                select: {
                    id: true,
                    name: true,
                    discordGuildId: true,
                }
            })
        ]);

        // Build guild name lookup — both by internal CUID and by Discord Guild ID
        const guildMap = new Map<string, string>();
        guildConfigs.forEach((g: any) => {
            if (g.id) guildMap.set(g.id, g.name);
            if (g.discordGuildId) guildMap.set(g.discordGuildId, g.name);
        });

        // 1. Last-seen per user (capped at 200 to avoid huge loads)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const lastSeenRaw = await dbAny.telemetryEvent.groupBy({
            by: ["userId"],
            _max: { createdAt: true },
            where: withGuild({ createdAt: { gte: thirtyDaysAgo } }),
            orderBy: {
                userId: "asc"
            },
            take: 200
        });

        // 2. For guildId per user: get distinct guildId per userId from a recent sample
        // (we can't groupBy userId+guildId efficiently at scale; just use the most recent event per user)
        const lastGuildPerUser = await dbAny.telemetryEvent.findMany({
            where: withGuild({
                userId: { in: lastSeenRaw.map((u: any) => u.userId) },
                createdAt: { gte: thirtyDaysAgo }
            }),
            select: { userId: true, guildId: true, userName: true },
            distinct: ["userId"],
            orderBy: { createdAt: "desc" },
        });
        const lastGuildMap = new Map<string, { guildId: string | null; userName: string }>();
        lastGuildPerUser.forEach((e: any) => {
            if (!lastGuildMap.has(e.userId)) {
                lastGuildMap.set(e.userId, { guildId: e.guildId || null, userName: e.userName });
            }
        });

        // 3. Resolve user names from UserProfile (pseudoDofus or discordNickname preferred)
        const allUserIds = Array.from(new Set([
            ...liveEvents.map((e: any) => e.userId),
            ...topUsersRaw.map((u: any) => u.userId),
            ...lastSeenRaw.map((u: any) => u.userId),
        ]));

        const userProfiles = await db.userProfile.findMany({
            where: { userId: { in: allUserIds } },
            select: {
                userId: true,
                guildId: true,
                pseudoDofus: true,
                discordNickname: true,
            }
        });

        // Key: userId -> best display name (guild-specific first, then any profile)
        const profileNameMap = new Map<string, string>(); // userId_guildId -> name
        const profileFallbackMap = new Map<string, string>(); // userId -> name
        userProfiles.forEach((p: any) => {
            const resolvedName = p.pseudoDofus || p.discordNickname;
            if (resolvedName) {
                profileNameMap.set(`${p.userId}_${p.guildId}`, resolvedName);
                if (!profileFallbackMap.has(p.userId)) {
                    profileFallbackMap.set(p.userId, resolvedName);
                }
            }
        });

        const resolveUserName = (userId: string, guildId: string | null, defaultName: string) => {
            if (guildId) {
                const name = profileNameMap.get(`${userId}_${guildId}`);
                if (name) return name;
            }
            return profileFallbackMap.get(userId) || defaultName;
        };

        const resolveGuildName = (guildId: string | null) => {
            if (!guildId) return "Sans Guilde";
            const name = guildMap.get(guildId);
            if (name) return name;
            return "Guilde Inconnue";
        };

        // 4. Build usersLastSeen
        const usersLastSeen = lastSeenRaw.map((u: any) => {
            const meta = lastGuildMap.get(u.userId);
            const gId = meta?.guildId || null;
            const rawName = meta?.userName || "Membre";
            return {
                userId: u.userId,
                userName: resolveUserName(u.userId, gId, rawName),
                guildId: gId || "None",
                guildName: resolveGuildName(gId),
                lastActive: u._max.createdAt ? u._max.createdAt.toISOString() : null
            };
        }).sort((a: any, b: any) => {
            const dateA = a.lastActive ? new Date(a.lastActive).getTime() : 0;
            const dateB = b.lastActive ? new Date(b.lastActive).getTime() : 0;
            return dateB - dateA;
        });

        // 5. Guild activity (7 days)
        const guildActivityRaw = await dbAny.telemetryEvent.groupBy({
            by: ["guildId"],
            _count: { id: true },
            where: { createdAt: { gte: sevenDaysAgo } }
        });

        const guildActivity = guildActivityRaw.map((ga: any) => {
            const gId = ga.guildId || null;
            return {
                guildId: gId || "None",
                guildName: resolveGuildName(gId),
                count: ga._count.id
            };
        }).sort((a: any, b: any) => b.count - a.count);

        // 6. Hourly chart — select only createdAt+eventType, guild-scoped
        const hourlyEvents = await dbAny.telemetryEvent.findMany({
            where: withGuild({ createdAt: { gte: oneDayAgo } }),
            select: { createdAt: true, eventType: true }
        });

        const hourlyMap = new Map<string, { views: number; interactions: number }>();
        for (let i = 23; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 60 * 60 * 1000);
            const hourStr = d.getHours().toString().padStart(2, '0') + ":00";
            hourlyMap.set(hourStr, { views: 0, interactions: 0 });
        }
        hourlyEvents.forEach((event: any) => {
            const hour = new Date(event.createdAt).getHours().toString().padStart(2, '0') + ":00";
            if (hourlyMap.has(hour)) {
                const current = hourlyMap.get(hour)!;
                if (event.eventType === "PAGE_VIEW") current.views += 1;
                else current.interactions += 1;
            }
        });

        const chartData = Array.from(hourlyMap.entries()).map(([hour, counts]) => ({
            time: hour,
            views: counts.views,
            interactions: counts.interactions,
        }));

        // 7. Build topUsers with enriched name + guildId from lastGuildMap
        const topUsers = topUsersRaw.map((u: any) => {
            const meta = lastGuildMap.get(u.userId);
            const gId = meta?.guildId || null;
            const rawName = meta?.userName || "Membre";
            return {
                userId: u.userId,
                userName: resolveUserName(u.userId, gId, rawName),
                guildId: gId || "None",
                guildName: resolveGuildName(gId),
                count: u._count
            };
        });

        // Extract module name helper
        const getModuleName = (path: string) => {
            if (!path) return "Général";
            if (path.includes("/raids")) return "Raid Hub";
            if (path.includes("/stuff-gallery") || path.includes("/stuffs")) return "Galerie de Stuffs";
            if (path.includes("/almanax")) return "Almanax";
            if (path.includes("/shop")) return "Boutique";
            if (path.includes("/quests") || path.includes("/dofus")) return "Quêtes & Succès";
            if (path.includes("/minigames") || path.includes("/games")) return "Mini-Jeux";
            if (path.includes("/members") || path.includes("/roster")) return "Roster & Membres";
            if (path.includes("/god")) return "Administration God";
            if (path.includes("/settings") || path.includes("/config")) return "Configuration";
            if (path.includes("/dashboard") || path === "/") return "Accueil / Tableau de bord";
            return "Autre Module";
        };

        // Module Stats aggregation (groupBy path over 30 days to avoid fetching all raw events in memory)
        const moduleEventsRaw = await dbAny.telemetryEvent.groupBy({
            by: ["path", "eventType"],
            where: withGuild({ createdAt: { gte: thirtyDaysAgo } }),
            _count: { id: true }
        });

        const moduleStatsMap = new Map<string, { views: number; interactions: number; uniqueUsersCount: number }>();
        moduleEventsRaw.forEach((ev: any) => {
            const mod = getModuleName(ev.path);
            if (!moduleStatsMap.has(mod)) {
                moduleStatsMap.set(mod, { views: 0, interactions: 0, uniqueUsersCount: 0 });
            }
            const item = moduleStatsMap.get(mod)!;
            const count = ev._count?.id || 1;
            if (ev.eventType === "PAGE_VIEW") item.views += count;
            else item.interactions += count;
        });

        const moduleStats = Array.from(moduleStatsMap.entries()).map(([name, data]) => ({
            name,
            views: data.views,
            interactions: data.interactions,
            totalActions: data.views + data.interactions,
            uniqueUsersCount: data.views > 0 ? Math.ceil(data.views / 3) : 1
        })).sort((a, b) => b.totalActions - a.totalActions);

        // 8. #34 / #194 — 7-Day x 24-Hour Activity Heatmap Matrix
        const sevenDaysEvents = await dbAny.telemetryEvent.findMany({
            where: withGuild({ createdAt: { gte: sevenDaysAgo } }),
            select: { createdAt: true }
        });

        // Initialize 7 (days: 0=Dim, 1=Lun, ..., 6=Sam) x 24 (hours: 0..23)
        const heatmapMatrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
        let maxHeatmapValue = 0;

        sevenDaysEvents.forEach((ev: any) => {
            const d = new Date(ev.createdAt);
            const day = d.getDay(); // 0-6
            const hour = d.getHours(); // 0-23
            heatmapMatrix[day][hour] += 1;
            if (heatmapMatrix[day][hour] > maxHeatmapValue) {
                maxHeatmapValue = heatmapMatrix[day][hour];
            }
        });

        const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
        const heatmapData = heatmapMatrix.map((hours, dayIndex) => ({
            day: dayNames[dayIndex],
            dayIndex,
            hours: hours.map((count, hour) => ({
                hour,
                count,
                intensity: maxHeatmapValue > 0 ? Number((count / maxHeatmapValue).toFixed(2)) : 0
            }))
        }));

        // Build availableGuilds for the selector in the dashboard
        const availableGuilds = guildConfigs.map((g: any) => ({
            id: g.id,
            name: g.name || "Guilde sans nom",
            discordGuildId: g.discordGuildId
        }));

        // 9. #34 / #194 — Funnel d'Activation Plateforme (Global)
        const [totalAccountsCount, totalProfilesCount, activeQuestsUsersCount] = await Promise.all([
            db.user.count(),
            db.userProfile.count({ where: filterGuildId ? { guildId: filterGuildId } : undefined }),
            (db as any).playerDofusProgress.groupBy({
                by: ["profileId"],
                _count: true
            }).then((r: any[]) => r.length).catch(() => 0)
        ]);

        const activationFunnel = [
            { step: "Comptes Créés", count: totalAccountsCount, dropoffRate: 0 },
            { 
                step: "Profils Configurés", 
                count: totalProfilesCount, 
                dropoffRate: totalAccountsCount > 0 ? Number((((totalAccountsCount - totalProfilesCount) / totalAccountsCount) * 100).toFixed(1)) : 0 
            },
            { 
                step: "Quêtes / Succès Initiés", 
                count: activeQuestsUsersCount, 
                dropoffRate: totalProfilesCount > 0 ? Number((((totalProfilesCount - activeQuestsUsersCount) / totalProfilesCount) * 100).toFixed(1)) : 0 
            },
            { 
                step: "Membres Actifs (7j)", 
                count: uniqueUsers7d.length, 
                dropoffRate: activeQuestsUsersCount > 0 ? Number((((activeQuestsUsersCount - uniqueUsers7d.length) / activeQuestsUsersCount) * 100).toFixed(1)) : 0 
            }
        ];

        // 10. #34 / #194 — Matrice de Santé & Rétention des Guildes (Guild Health Index)
        const guildHealthList = guildConfigs.map((g: any) => {
            const guild7dActions = guildActivity.find((ga: any) => ga.guildId === g.id)?.count || 0;
            let status: "THRIVING" | "HEALTHY" | "AT_RISK" | "DORMANT" = "DORMANT";
            let score = 0;

            if (guild7dActions >= 150) {
                status = "THRIVING";
                score = Math.min(100, 80 + Math.floor(guild7dActions / 50));
            } else if (guild7dActions >= 40) {
                status = "HEALTHY";
                score = Math.min(79, 50 + Math.floor(guild7dActions / 5));
            } else if (guild7dActions > 0) {
                status = "AT_RISK";
                score = Math.min(49, 20 + Math.floor(guild7dActions / 2));
            } else {
                status = "DORMANT";
                score = 5;
            }

            return {
                id: g.id,
                discordGuildId: g.discordGuildId,
                name: g.name || "Guilde sans nom",
                actions7d: guild7dActions,
                healthStatus: status,
                healthScore: score
            };
        }).sort((a: any, b: any) => b.actions7d - a.actions7d);

        return {
            summary: {
                totalEvents,
                pageViews24h,
                interactions24h,
                uniqueUsers24h: uniqueUsers24h.length,
                // #34 — volet Data/Product : WAU, guildes actives 7j, ratio d'engagement.
                uniqueUsers7d: uniqueUsers7d.length,
                guildsActive7d: Array.isArray(guildsActive7d) ? guildsActive7d.length : 0,
                engagementRatio: pageViews24h > 0
                    ? Number(((interactions24h / pageViews24h) * 100).toFixed(1))
                    : 0,
                averageActionsPerUser: uniqueUsers24h.length > 0
                    ? Number(((pageViews24h + interactions24h) / uniqueUsers24h.length).toFixed(1))
                    : 0
            },
            availableGuilds,
            moduleStats,
            heatmapData,
            activationFunnel,
            guildHealthList,
            liveEvents: liveEvents.map((e: any) => {
                const resolvedGuildId = e.guildId || null;
                return {
                    id: e.id,
                    userId: e.userId,
                    userName: resolveUserName(e.userId, resolvedGuildId, e.userName),
                    guildId: resolvedGuildId,
                    guildName: resolveGuildName(resolvedGuildId),
                    path: e.path,
                    eventType: e.eventType,
                    elementId: e.elementId,
                    details: e.details,
                    createdAt: e.createdAt.toISOString()
                };
            }),
            topPaths: topPathsRaw.map((p: any) => ({
                path: p.path,
                count: p._count
            })),
            topInteractions: topInteractionsRaw.map((i: any) => ({
                elementId: i.elementId || "unknown",
                count: i._count
            })),
            topUsers,
            guildActivity,
            usersLastSeen,
            chartData
        };
    } catch (err) {
        logger.error("[getTelemetryStats Error]:", err);
        throw err;
    }
}

/**
 * Export telemetry data in CSV or JSON format for analytics
 */
export async function exportTelemetryDataAction(filterGuildId?: string, format: "json" | "csv" = "json") {
    try {
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) return { success: false, error: "Unauthorized" };

        const where = filterGuildId ? { guildId: filterGuildId } : undefined;
        const events = await dbAny.telemetryEvent.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 2000
        });

        if (format === "json") {
            return {
                success: true,
                data: JSON.stringify(events, null, 2),
                mimeType: "application/json",
                fileName: `sigilos-telemetry-${new Date().toISOString().slice(0, 10)}.json`
            };
        }

        // Generate CSV
        const headers = ["id", "createdAt", "userId", "userName", "guildId", "eventType", "path", "elementId"];
        const rows = events.map((e: any) => [
            e.id,
            e.createdAt ? new Date(e.createdAt).toISOString() : "",
            e.userId || "",
            `"${(e.userName || "").replace(/"/g, '""')}"`,
            e.guildId || "",
            e.eventType || "",
            `"${(e.path || "").replace(/"/g, '""')}"`,
            `"${(e.elementId || "").replace(/"/g, '""')}"`
        ]);

        const csvContent = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");

        return {
            success: true,
            data: csvContent,
            mimeType: "text/csv",
            fileName: `sigilos-telemetry-${new Date().toISOString().slice(0, 10)}.csv`
        };
    } catch (err) {
        logger.error("[exportTelemetryDataAction Error]:", err);
        return { success: false, error: "Failed to export data" };
    }
}


