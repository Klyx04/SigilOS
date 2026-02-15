import { NextResponse } from "next/server";
import { getGlobalAuditLogs } from "@/server/actions/audit-actions";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const action = searchParams.get("action") || undefined;
    const search = searchParams.get("search") || undefined;

    const result = await getGlobalAuditLogs({
        page,
        limit,
        actionFilter: action,
        search
    });

    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json(result.data);
}
