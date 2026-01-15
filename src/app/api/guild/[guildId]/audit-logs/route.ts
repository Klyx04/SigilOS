import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getAuditLogs } from "@/server/actions/audit-actions";
import { getUserContext } from "@/server/actions/user-actions";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ guildId: string }> }
) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;

    // Verify admin access
    const user = await getUserContext(guildId);
    if (!user.isAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const action = searchParams.get("action") || undefined;
    const search = searchParams.get("search") || undefined;

    // Get logs
    const result = await getAuditLogs(guildId, {
        page,
        limit: Math.min(limit, 100), // Cap at 100
        actionFilter: action,
        // Note: search is for future use - can filter by actorName
    });

    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
        logs: result.data?.logs || [],
        total: result.data?.total || 0,
        hasMore: result.data?.hasMore || false,
    });
}
