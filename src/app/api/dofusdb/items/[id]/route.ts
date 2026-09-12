import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * GET /api/dofusdb/items/[id]
 * Proxy serveur pour les détails d'un item DofusDB avec cache mémoire.
 */
const itemCache = new Map<number, { data: any; expiresAt: number }>();
const ITEM_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ITEM_CACHE = 1000;

function normalizeEffects(effects: any[]) {
    if (!Array.isArray(effects)) return [];
    return effects.map((fx) => {
        const rawFrom = fx.from ?? fx.diceNum ?? fx.min ?? fx.value;
        const rawTo = fx.to ?? (fx.diceSide !== undefined && fx.diceSide !== 0 ? fx.diceSide : rawFrom) ?? fx.max ?? rawFrom;
        const from = Number(rawFrom ?? 0);
        const to = Number(rawTo ?? from);
        return {
            ...fx,
            from,
            to,
        };
    });
}

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

    // 0. LOCAL-FIRST : Recherche dans notre base locale GameItem (0ms)
    try {
        const { getLocalGameItemDetails } = await import("@/server/actions/game-item-actions");
        const localRes = await getLocalGameItemDetails(id);
        if (localRes.success && localRes.data) {
            const item = localRes.data;
            const normalizedFx = normalizeEffects(item.effects);
            const formatted = {
                id: item.ankamaId,
                name: { fr: item.name },
                level: item.level,
                type: { name: { fr: item.typeName } },
                description: item.description ? { fr: item.description } : undefined,
                effects: normalizedFx,
                possibleEffects: normalizedFx,
                hasRecipe: item.hasRecipe,
                recipe: item.recipe,
                img: item.iconUrl || `/uploads/assets-dofus/items/${item.ankamaId}.webp`,
                itemSet: item.itemSetName ? { name: { fr: item.itemSetName }, id: item.itemSetId } : undefined,
            };
            itemCache.set(id, { data: formatted, expiresAt: Date.now() + ITEM_TTL_MS });
            return NextResponse.json(formatted);
        }
    } catch {
        // Poursuite vers le fallback externe
    }

    try {
        const res = await fetch(`https://api.dofusdb.fr/items/${id}`, {
            headers: { Accept: "application/json", "User-Agent": "SigilOS/1.0" },
            next: { revalidate: 600 }, // cache Next 10min
            signal: AbortSignal.timeout(4000),
        });

        if (!res.ok) {
            return NextResponse.json({ error: `DofusDB returned ${res.status}` }, { status: 200 });
        }

        const data = await res.json();
        if (data && !data.error) {
            const normalizedFx = normalizeEffects(data.effects || data.possibleEffects || []);
            const normalizedData = {
                ...data,
                effects: normalizedFx,
                possibleEffects: normalizedFx,
            };
            if (itemCache.size >= MAX_ITEM_CACHE) {
                const keysToDelete = Array.from(itemCache.keys()).slice(0, 100);
                keysToDelete.forEach((k) => itemCache.delete(k));
            }
            itemCache.set(id, { data: normalizedData, expiresAt: Date.now() + ITEM_TTL_MS });
            return NextResponse.json(normalizedData);
        }
        return NextResponse.json(data);
    } catch (err: any) {
        logger.warn("[DofusDB Item Proxy] Error:", { error: err?.message, id });
        return NextResponse.json({ error: "Proxy error" }, { status: 200 });
    }
}
