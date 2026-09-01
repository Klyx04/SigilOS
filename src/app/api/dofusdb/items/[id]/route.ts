import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * GET /api/dofusdb/items/[id]
 * Proxy serveur pour les détails d'un item DofusDB avec cache mémoire.
 */
const itemCache = new Map<number, { data: any; expiresAt: number }>();
const ITEM_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ITEM_CACHE = 1000;

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (!id || isNaN(id) || id <= 0) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const cached = itemCache.get(id);
    if (cached && Date.now() < cached.expiresAt) {
        return NextResponse.json(cached.data);
    }

    try {
        const res = await fetch(`https://api.dofusdb.fr/items/${id}`, {
            headers: { Accept: "application/json", "User-Agent": "SigilOS/1.0" },
            next: { revalidate: 600 }, // cache Next 10min
            signal: AbortSignal.timeout(6000),
        });

        if (!res.ok) {
            return NextResponse.json({ error: `DofusDB returned ${res.status}` }, { status: 200 });
        }

        const data = await res.json();
        if (data && !data.error) {
            if (itemCache.size >= MAX_ITEM_CACHE) {
                const keysToDelete = Array.from(itemCache.keys()).slice(0, 100);
                keysToDelete.forEach((k) => itemCache.delete(k));
            }
            itemCache.set(id, { data, expiresAt: Date.now() + ITEM_TTL_MS });
        }
        return NextResponse.json(data);
    } catch (err: any) {
        logger.warn("[DofusDB Item Proxy] Error:", { error: err?.message, id });
        return NextResponse.json({ error: "Proxy error" }, { status: 200 });
    }
}
