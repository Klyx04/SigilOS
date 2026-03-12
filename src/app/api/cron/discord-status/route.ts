import { NextResponse } from "next/server";
import { sendGlobalStatusPing } from "@/server/actions/status-actions";

// ---------------------------------------------------------------------------
// DISC-2 — Discord Status Channel (Consolidated)
// Triggers the living status update in the configured Discord channel.
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
    // Security: validate cron secret header
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    
    if (secret && authHeader !== `Bearer ${secret}`) {
        const url = new URL(req.url);
        if (url.searchParams.get('key') !== secret) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
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

