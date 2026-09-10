import { NextResponse } from "next/server";

/**
 * Liveness ultra-légère pour les monitors externes (UptimeRobot).
 *
 * - 200 immédiat, ZÉRO appel DB/Redis/tiers : un monitor à 5 min ne doit ni
 *   spammer les APIs tierces ni dépendre d'elles (un DofusDB HS ≠ SigilOS HS).
 * - Le diagnostic complet (DB, Redis, Discord, Metamob, DofusDB, Dofensive)
 *   reste sur `/api/health` (usage Docker + page /status).
 */
export async function GET() {
    return NextResponse.json(
        {
            status: "ok",
            timestamp: new Date().toISOString(),
            environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "unknown",
        },
        {
            status: 200,
            headers: { "Cache-Control": "no-store" },
        }
    );
}
