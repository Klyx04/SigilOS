import { NextResponse } from "next/server";
import { sendGlobalStatusPing } from "@/server/actions/status-actions";
import { verifyCronSecret } from "@/lib/cron-auth";

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

    try {
        const result = await sendGlobalStatusPing(false);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            action: result.action,
            stats: result.stats 
        });
    } catch (error: any) {
        console.error("[DiscordStatusCron] Error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

