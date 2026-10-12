/**
 * Member Sync API Endpoint
 * 
 * Trigger membership sync via HTTP request.
 * Designed for:
 * - Vercel Cron Jobs
 * - External cron services (cron-job.org, etc.)
 * - Manual admin triggers
 * 
 * Security:
 * - Requires CRON_SECRET header for automated calls
 * - Or authenticated admin session for manual calls
 */

import { NextRequest, NextResponse } from "next/server";
import { syncAllGuilds, syncMembershipStatus } from "@/server/actions/sync-actions";
import { auth } from "@/auth";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function POST(request: NextRequest) {
    // Option 1: Cron job with secret (fail-closed + temps constant)
    if (verifyCronSecret(request)) {
        const results = await syncAllGuilds();
        return NextResponse.json(results);
    }

    // Option 2: Authenticated admin
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get guild ID from body (for single guild sync)
    try {
        const body = await request.json();
        const guildId = body.guildId;

        if (!guildId) {
            return NextResponse.json({ error: "guildId required" }, { status: 400 });
        }

        const result = await syncMembershipStatus(guildId);
        return NextResponse.json(result);

    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
}

// For Vercel Cron - GET request support
export async function GET(request: NextRequest) {
    // Only allow cron jobs with secret (fail-closed + temps constant)
    if (!verifyCronSecret(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await syncAllGuilds();
    return NextResponse.json(results);
}
