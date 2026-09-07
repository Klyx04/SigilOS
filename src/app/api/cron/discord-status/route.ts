import { NextResponse } from "next/server";
import { sendGlobalStatusPingCore } from "@/server/status-ping-core";
import { verifyCronSecret } from "@/lib/cron-auth";

// ---------------------------------------------------------------------------
// DISC-2 — Discord Status Channel (Consolidated)
// Triggers the living status update in the configured Discord channel.
// ✅ Protégé par x-cron-secret (fail-closed si secret absent)
// NOTE : appelle le core SANS gate session — la route est déjà authentifiée
// via verifyCronSecret (le gate isSuperAdmin de l'action serveur exigerait
// une session Auth.js inexistante en contexte cron).

// ---------------------------------------------------------------------------
// DISC-2 — Discord Status Channel (Consolidated)
// Triggers the living status update in the configured Discord channel.
// ✅ Protégé par x-cron-secret (fail-closed si secret absent)
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
    // CRIT-02 FIX
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();

    try {
        const result = await sendGlobalStatusPingCore();
        const durationMs = Date.now() - startedAt;

        if (!result.success) {
            const { recordCronExecution } = await import("@/lib/cron-telemetry");
            await recordCronExecution("discord_status", {
                success: false,
                durationMs,
                summary: `Échec statut Discord: ${result.error}`,
            });
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("discord_status", {
            success: true,
            durationMs,
            summary: `Statut Discord mis à jour (${result.action || "OK"})`,
            details: result.stats,
        });

        return NextResponse.json({ 
            success: true, 
            action: result.action,
            stats: result.stats,
            durationMs
        });
    } catch (error: any) {
        console.error("[DiscordStatusCron] Error:", error);
        const { recordCronExecution } = await import("@/lib/cron-telemetry");
        await recordCronExecution("discord_status", {
            success: false,
            durationMs: Date.now() - startedAt,
            summary: `Erreur statut Discord: ${error.message}`,
        });
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

