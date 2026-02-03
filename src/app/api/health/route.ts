import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { redis } from "@/lib/redis";

interface HealthStatus {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    services: {
        database: { status: "up" | "down"; latency?: number };
        redis: { status: "up" | "down" | "not_configured"; latency?: number };
    };
    version?: string;
}

export async function GET() {
    const health: HealthStatus = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
            database: { status: "down" },
            redis: { status: "down" },
        },
        version: process.env.npm_package_version || "unknown",
    };

    // Check Database
    const dbStart = Date.now();
    try {
        await db.$queryRaw`SELECT 1`;
        health.services.database = {
            status: "up",
            latency: Date.now() - dbStart
        };
    } catch (error) {
        console.error("[HealthCheck] Database unreachable:", error);
        health.services.database = { status: "down" };
        health.status = "unhealthy";
    }

    // Check Redis
    const redisStart = Date.now();
    try {
        if (redis && redis.status === "ready") {
            await redis.ping();
            health.services.redis = {
                status: "up",
                latency: Date.now() - redisStart
            };
        } else if (redis && redis.status === "connecting") {
            health.services.redis = { status: "down" };
            health.status = health.status === "healthy" ? "degraded" : health.status;
        } else {
            health.services.redis = { status: "not_configured" };
        }
    } catch (error) {
        console.error("[HealthCheck] Redis unreachable:", error);
        health.services.redis = { status: "down" };
        // Redis down = degraded, not unhealthy (fail-open design)
        health.status = health.status === "healthy" ? "degraded" : health.status;
    }

    const statusCode = health.status === "unhealthy" ? 503 : 200;
    return NextResponse.json(health, { status: statusCode });
}
