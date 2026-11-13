import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { createBoundedIpRateLimit } from "@/lib/bounded-ip-rate-limit";

/**
 * Endpoint léger appelé par le proxy pour connaître le mode maintenance.
 *
 * 🔐 AUD-11 (audit 13/11/2026) :
 *  - cache mémoire court (5 s) : un appel direct répété ne martèle plus la base ;
 *  - rate-limit IP borné et fail-closed (120 req/min) ;
 *  - le header `x-middleware-check` n'est **pas** une frontière de sécurité
 *    (il est falsifiable) : il n'est donc pas utilisé comme autorisation ;
 *  - la panne BDD reste fail-open (`maintenanceMode: false`) : ne pas bloquer
 *    tout le site parce que la base est indisponible.
 */
const CACHE_TTL_MS = 5_000;
let cached: { value: boolean; expiresAt: number } | null = null;
const ipLimiter = createBoundedIpRateLimit(10_000);

function clientIp(req: NextRequest): string {
    const ip = req.headers.get("x-real-ip") || "unknown";
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ? ip : "untrusted";
}

export async function GET(req: NextRequest) {
    if (!ipLimiter.allow(`maintenance:${clientIp(req)}`, 120, 60_000)) {
        return NextResponse.json(
            { error: "Too many requests" },
            { status: 429, headers: { "Retry-After": "60" } },
        );
    }

    const now = Date.now();
    if (cached && now < cached.expiresAt) {
        return NextResponse.json({ maintenanceMode: cached.value });
    }

    try {
        const config = await db.platformConfig.findUnique({
            where: { id: "singleton" },
            select: { maintenanceMode: true },
        });

        const value = config?.maintenanceMode ?? false;
        cached = { value, expiresAt: now + CACHE_TTL_MS };
        return NextResponse.json({ maintenanceMode: value });
    } catch {
        // Fail open: if DB is unreachable, don't block all users
        logger.warn("[Health] maintenanceMode indisponible — réponse false (fail-open)");
        return NextResponse.json({ maintenanceMode: false });
    }
}
