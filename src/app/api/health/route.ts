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
    /** Environnement d'exécution (beta/production) — distingue les deux apps dans les dashboards. */
    environment?: string;
    /** Observabilité active ou non (booléens, aucun secret exposé). */
    observability?: {
        sentry: boolean;
    };
    checks?: {
        discordBot: ExternalCheck;
        metamob: ExternalCheck;
        dofusdb: ExternalCheck;
        dofensive: ExternalCheck;
    };
}

interface ExternalCheck {
    status: "up" | "degraded" | "down";
    latencyMs?: number;
}

// La page /status + le healthcheck Docker appellent cette route en boucle :
// les contrôles externes sont coûteux (rate-limits) → cache serveur court.
const CACHE_TTL_MS = 90_000;
const FETCH_TIMEOUT_MS = 4000;
const SLOW_MS = 2000;
let cache: { at: number; body: HealthStatus } | null = null;

async function checkHttp(
    url: string,
    options?: { headers?: Record<string, string>; requireOk?: boolean }
): Promise<ExternalCheck> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const start = Date.now();
    try {
        const res = await fetch(url, {
            headers: options?.headers,
            signal: ctrl.signal,
            cache: "no-store",
        });
        const latencyMs = Date.now() - start;
        const ok = options?.requireOk ? res.ok : res.status < 500;
        if (!ok) return { status: "down", latencyMs };
        return { status: latencyMs > SLOW_MS ? "degraded" : "up", latencyMs };
    } catch {
        return { status: "down" };
    } finally {
        clearTimeout(timer);
    }
}

async function checkDiscordBot(): Promise<ExternalCheck> {
    // 1. Joignabilité de Discord (sans auth).
    const gateway = await checkHttp("https://discord.com/api/v10/gateway");
    if (gateway.status === "down") return gateway;
    // 2. Validité du token (le token ne sort jamais du serveur).
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return { status: "down", latencyMs: gateway.latencyMs };
    const me = await checkHttp("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bot ${token}` },
        requireOk: true,
    });
    if (me.status === "down") return me;
    return {
        status: gateway.status === "degraded" || me.status === "degraded" ? "degraded" : "up",
        latencyMs: (gateway.latencyMs ?? 0) + (me.latencyMs ?? 0),
    };
}

export async function GET() {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
        return NextResponse.json(cache.body);
    }

    const health: HealthStatus = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
            database: { status: "down" },
            redis: { status: "down" },
        },
        version: process.env.npm_package_version || "unknown",
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "unknown",
        observability: {
            sentry: !!process.env.SENTRY_DSN,
        },
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

    // Contrôles externes (parallèle, best-effort, jamais bloquant).
    // NOTE (OWASP, page publique) : volontairement AUCUNE donnée interne ici
    // (pas de tâches auto, pas de versions, pas de messages d'erreur) —
    // uniquement des états + latences, déjà visibles par ailleurs.
    const [discordBot, metamob, dofusdb, dofensive] = await Promise.all([
        checkDiscordBot(),
        checkHttp("https://www.metamob.fr/api/v1/quest-types"),
        checkHttp("https://api.dofusdb.fr"),
        checkHttp("https://dofensive.com/api/dofus2/bestiary"),
    ]);
    health.checks = { discordBot, metamob, dofusdb, dofensive };

    // Un service externe HS ne rend pas la plateforme "en panne" (elle reste
    // utilisable en mode dégradé), mais il doit se voir.
    if (health.status === "healthy") {
        const anyDown =
            discordBot.status === "down" ||
            metamob.status === "down" ||
            dofusdb.status === "down" ||
            dofensive.status === "down";
        if (anyDown) health.status = "degraded";
    }

    cache = { at: Date.now(), body: health };

    const statusCode = health.status === "unhealthy" ? 503 : 200;
    return NextResponse.json(health, { status: statusCode });
}
