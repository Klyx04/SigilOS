import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { db } from "@/lib/prisma";
import { sendDailySummaryReport } from "@/server/actions/daily-report-actions";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

/**
 * 🛰️ API CRON pour le rapport quotidien global.
 * Parcoure toutes les guildes actives et envoie le résumé.
 *
 * ✅ Protégé par x-cron-secret (fail-closed si secret absent)
 */
export async function GET(req: Request) {
    // CRIT-02 FIX : verifyCronSecret() refuse si CRON_SECRET absent (fail-closed)
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const activeGuilds = await db.guildConfig.findMany({
            where: { isActive: true, systemNotifyChannelId: { not: null } },
            select: { discordGuildId: true, name: true }
        });

        const results = {
            total: activeGuilds.length,
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const guild of activeGuilds) {
            try {
                const res = await sendDailySummaryReport(guild.discordGuildId, false);
                if (res.success) results.success++;
                else throw new Error(res.error);
            } catch (e: any) {
                results.failed++;
                results.errors.push(`${guild.name}: ${e.message}`);
            }
        }

        return NextResponse.json({ 
            success: true, 
            summary: results 
        });

    } catch (error: any) {
        logger.error("[DailySummaryCron] Global Error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
