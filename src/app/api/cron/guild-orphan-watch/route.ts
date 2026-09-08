import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { detectOrphanGuilds } from "@/server/actions/guild-owner-actions";
import { recordCronExecution } from "@/lib/cron-telemetry";

/**
 * 🏚️ CRON quotidien : détection des guildes orphelines (zéro admin natif +
 * zéro délégué). Drapeau SYSTEM + notif God si orpheline (dédupliqué).
 * Tentative de succession d'abord (cas owner-dérive). Fail-safe : guilde
 * injoignable = sautée (retry demain), jamais de faux orphelin.
 *
 * 🔒 Sécurité : Protégé par verifyCronSecret (x-cron-secret / Authorization Bearer).
 */
export async function GET(req: Request) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const startedAt = Date.now();
        const result = await detectOrphanGuilds();
        logger.info("[Cron:OrphanWatch] scan terminé", result);
        await recordCronExecution("guild_orphan_watch", {
            success: true,
            durationMs: Date.now() - startedAt,
            summary: "Scan des guildes orphelines terminé",
            details: result,
        });
        return NextResponse.json({ success: true, ...result });
    } catch (e) {
        logger.error("[Cron:OrphanWatch] Échec du scan:", e);
        await recordCronExecution("guild_orphan_watch", {
            success: false,
            summary: "Échec du scan des guildes orphelines",
            details: { error: String(e) },
        });
        return NextResponse.json({ error: "Échec du scan" }, { status: 500 });
    }
}
