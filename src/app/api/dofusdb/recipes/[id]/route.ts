import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * GET /api/dofusdb/recipes/[id]
 * Proxy serveur pour les recettes de craft DofusDB avec cache mémoire.
 */
const recipeCache = new Map<number, { data: any; expiresAt: number }>();
const RECIPE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_RECIPE_CACHE = 1000;

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!id || isNaN(id) || id <= 0) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const cached = recipeCache.get(id);
    if (cached && Date.now() < cached.expiresAt) {
        return NextResponse.json(cached.data);
    }

    try {
        const res = await fetch(`https://api.dofusdb.fr/recipes/${id}`, {
            headers: { Accept: "application/json", "User-Agent": "SigilOS/1.0" },
            next: { revalidate: 600 }, // cache Next 10min
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) {
            return NextResponse.json({ error: `DofusDB returned ${res.status}` }, { status: 200 });
        }

        const data = await res.json();
        if (data && !data.error) {
            if (recipeCache.size >= MAX_RECIPE_CACHE) {
                const keysToDelete = Array.from(recipeCache.keys()).slice(0, 100);
                keysToDelete.forEach((k) => recipeCache.delete(k));
            }
            recipeCache.set(id, { data, expiresAt: Date.now() + RECIPE_TTL_MS });
        }
        return NextResponse.json(data);
    } catch (err: any) {
        logger.warn("[DofusDB Recipe Proxy] Error:", { error: err?.message, id });
        return NextResponse.json({ error: "Proxy error" }, { status: 200 });
    }
}
