import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/dofusdb/quests?q=Mille&limit=8
 * Proxy server-side vers DofusDB pour éviter les problèmes CORS en browser.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const limit = searchParams.get("limit") ?? "8";

    if (!q || q.length < 2) {
        return NextResponse.json({ total: 0, data: [] });
    }

    // Sanitize: escape regex special chars, preserve apostrophes as character class
    const escaped = q.normalize("NFC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cleanQuery = escaped.replace(/['\u2019]/g, "['\\u2019]");

    const dofusUrl = new URL("https://api.dofusdb.fr/quests");
    dofusUrl.searchParams.set("name.fr[$regex]", cleanQuery);
    dofusUrl.searchParams.set("name.fr[$options]", "i");
    dofusUrl.searchParams.set("$limit", limit);

    try {
        const res = await fetch(dofusUrl.toString(), {
            next: { revalidate: 60 }, // cache 60s côté serveur
        });

        if (!res.ok) {
            console.error("[DofusDB proxy] API error:", res.status);
            return NextResponse.json({ total: 0, data: [] }, { status: 200 });
        }

        const data = await res.json();
        return NextResponse.json({ total: data.total ?? 0, data: data.data ?? [] });
    } catch (err) {
        console.error("[DofusDB proxy] Fetch error:", err);
        return NextResponse.json({ total: 0, data: [] }, { status: 200 });
    }
}
