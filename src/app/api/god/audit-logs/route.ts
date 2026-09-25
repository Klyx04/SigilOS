import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canGodAccess } from "@/server/actions/super-admin-actions";
import { getGlobalAuditLogs } from "@/server/actions/audit-actions";

export async function GET(request: Request) {
    // Fail-fast: auth + super-admin check before hitting the DB
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // R3 : lecture des logs god = scope "logs" (cohérent R1).
    const hasLogsScope = await canGodAccess("logs");
    if (!hasLogsScope) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const action = searchParams.get("action") || undefined;
    const search = searchParams.get("search") || undefined;
    // 🔎 Paramètres bornés par liste blanche (une valeur inconnue est ignorée par la
    // route, jamais transmise au schéma Zod : sinon l'action retombait sur ses défauts).
    const rawCategory = searchParams.get("category");
    const rawScope = searchParams.get("scope");
    const category = rawCategory === "security" || rawCategory === "functional" ? rawCategory : undefined;
    const scope = rawScope === "platform" || rawScope === "guild" ? rawScope : undefined;

    const result = await getGlobalAuditLogs({
        page,
        limit,
        actionFilter: action,
        search,
        category,
        scope,
    });

    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json(result.data);
}
