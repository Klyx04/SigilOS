import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSuperAdmin, } from "@/server/actions/super-admin-actions";
import { getGlobalAuditLogs } from "@/server/actions/audit-actions";

export async function GET(request: Request) {
    // Fail-fast: auth + super-admin check before hitting the DB
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const superAdmin = await isSuperAdmin();
    if (!superAdmin) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

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
