import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/dofusdb/recipes/[id]
 * Proxy serveur pour les recettes de craft DofusDB.
 */
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    if (!id || isNaN(Number(id))) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    try {
        const res = await fetch(`https://api.dofusdb.fr/recipes/${id}`, {
            headers: { Accept: "application/json", "User-Agent": "SigilOS/1.0" },
            next: { revalidate: 300 }, // cache 5min
        });

        if (!res.ok) {
            return NextResponse.json({ error: `DofusDB returned ${res.status}` }, { status: 200 });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (err: any) {
        console.error("[DofusDB Recipe Proxy] Error:", err?.message);
        return NextResponse.json({ error: "Proxy error" }, { status: 200 });
    }
}
