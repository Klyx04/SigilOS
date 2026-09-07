import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";
import { detectOrphanGuilds } from "@/server/actions/guild-owner-actions";

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
        const result = await detectOrphanGuilds();
        logger.info("[Cron:OrphanWatch] scan terminé", result);
        return NextResponse.json({ success: true, ...result });
    } catch (e) {
        logger.error("[Cron:OrphanWatch] Échec du scan:", e);
        return NextResponse.json({ error: "Échec du scan" }, { status: 500 });
    }
}
