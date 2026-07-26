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

    // Verify access: canViewAuditLogs (RBAC staff:audit OR Discord Admin)
    const user = await getUserContext(guildId);
    if (!user.canViewAuditLogs) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const action = searchParams.get("action") || undefined;
    const search = searchParams.get("search") || undefined;
    const actor = searchParams.get("actor") || undefined;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    // Get logs with all filters
    const result = await getAuditLogs(guildId, {
        page,
        limit: Math.min(limit, 100), // Cap at 100
        actionFilter: action,
        search: search || undefined,
        actorFilter: actor || undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
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
