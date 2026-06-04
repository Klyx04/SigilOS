"use server";

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
        console.error("[Telemetry] Failed to log telemetry event:", err);
        return { success: false, error: "Internal Error" };
    }
}

export async function getTelemetryStats() {
    try {
        const isAdmin = await isSuperAdmin();
        if (!isAdmin) {
            throw new Error("Unauthorized: Super-admin access required");
        }

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [
            totalEvents,
            pageViews24h,
            interactions24h,
            uniqueUsers24h,
            liveEvents,
            topPathsRaw,
            topInteractionsRaw,
            topUsersRaw,
        ] = await Promise.all([
            // Total stats
            dbAny.telemetryEvent.count(),
            // 24h page views
            dbAny.telemetryEvent.count({
                where: {
                    eventType: "PAGE_VIEW",
                    createdAt: { gte: oneDayAgo },
                }
            }),
            // 24h interactions
            dbAny.telemetryEvent.count({
                where: {
                    eventType: "INTERACTION",
                    createdAt: { gte: oneDayAgo },
                }
            }),
            // 24h unique users
            dbAny.telemetryEvent.groupBy({
                by: ["userId"],
                where: {
                    createdAt: { gte: oneDayAgo }
                },
                _count: true
            }),
            // Live activity (last 50 events)
            dbAny.telemetryEvent.findMany({
                orderBy: { createdAt: "desc" },
                take: 50
            }),
            // Top Paths (Most Visited Pages)
            dbAny.telemetryEvent.groupBy({
                by: ["path"],
                where: { eventType: "PAGE_VIEW" },
                _count: { path: true },
                orderBy: {
                    _count: { path: "desc" }
                },
                take: 10
            }),
            // Top Clicks/Interactions
            dbAny.telemetryEvent.groupBy({
                by: ["elementId"],
                where: {
                    eventType: "INTERACTION",
                    elementId: { not: null }
                },
                _count: { elementId: true },
                orderBy: {
                    _count: { elementId: "desc" }
                },
                take: 10
            }),
            // Top Active Users
            dbAny.telemetryEvent.groupBy({
                by: ["userId", "userName"],
                _count: { id: true },
                orderBy: {
                    _count: { id: "desc" }
                },
                take: 10
            })
        ]);

        // Hourly activity for the last 24h (views and interactions combined)
        const hourlyEvents = await dbAny.telemetryEvent.findMany({
            where: {
                createdAt: { gte: oneDayAgo }
            },
            select: {
                createdAt: true,
                eventType: true
            }
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
                if (event.eventType === "PAGE_VIEW") {
                    current.views += 1;
                } else {
                    current.interactions += 1;
                }
            }
        });

        const chartData = Array.from(hourlyMap.entries()).map(([hour, counts]) => ({
            time: hour,
            views: counts.views,
            interactions: counts.interactions,
        }));

        return {
            summary: {
                totalEvents,
                pageViews24h,
                interactions24h,
                uniqueUsers24h: uniqueUsers24h.length,
                averageActionsPerUser: uniqueUsers24h.length > 0 
                    ? Number(((pageViews24h + interactions24h) / uniqueUsers24h.length).toFixed(1)) 
                    : 0
            },
            liveEvents: liveEvents.map((e: any) => ({
                id: e.id,
                userId: e.userId,
                userName: e.userName,
                guildId: e.guildId,
                path: e.path,
                eventType: e.eventType,
                elementId: e.elementId,
                details: e.details,
                createdAt: e.createdAt.toISOString()
            })),
            topPaths: topPathsRaw.map((p: any) => ({
                path: p.path,
                count: p._count.path
            })),
            topInteractions: topInteractionsRaw.map((i: any) => ({
                elementId: i.elementId || "unknown",
                count: i._count.elementId
            })),
            topUsers: topUsersRaw.map((u: any) => ({
                userId: u.userId,
                userName: u.userName,
                count: u._count.id
            })),
            chartData
        };
    } catch (err) {
        console.error("[getTelemetryStats Error]:", err);
        throw err;
    }
}
