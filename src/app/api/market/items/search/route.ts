import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserContext } from "@/server/actions/user-actions";
import { isModuleEnabled } from "@/server/actions/module-actions";
import { getGameItemCatalogFacets } from "@/server/actions/game-item-actions";
import { searchItems, type ItemCatalogCategory } from "@/lib/market/item-catalog";
import { rateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const ALLOWED_CATEGORIES: ItemCatalogCategory[] = ["all", "equipment", "resources", "consumables", "cosmetics"];

/** Nombre borné depuis un param d'URL (jamais NaN côté SQL). */
function num(value: string | null): number | null {
    if (value == null || value.trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/market/items/search?guildId=…&q=…&superTypeId=…&typeName=…&minLevel=…&maxLevel=…
 *
 * S2.7 — recherche **local-first** du catalogue d'objets (filtres famille/type/
 * niveau/nom) + facettes (`DISTINCT`) pour alimenter l'UI.
 * Sécurité (§16.2) : session → permission `market:trade` → module actif →
 * rate-limit. L'isolation de guilde vient du **contexte serveur**, jamais du client.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const guildId = searchParams.get("guildId")?.trim() ?? "";
    if (!guildId) {
        return NextResponse.json({ error: "Serveur manquant." }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Session expirée, reconnecte-toi." }, { status: 401 });
    }

    const user = await getUserContext(guildId);
    if (!user.isAuthenticated || !user.isMember || !user.canViewMarket) {
        return NextResponse.json({ error: "Tu n'as pas accès au Marché sur ce serveur." }, { status: 403 });
    }
    if (!user.isAdmin && !(await isModuleEnabled(guildId, "marche"))) {
        return NextResponse.json({ error: "Le Marché est désactivé sur ce serveur." }, { status: 403 });
    }

    const limited = await rateLimit(`market:items-search:${session.user.id}`, 60, 60_000);
    if (!limited.success) {
        return NextResponse.json({ error: "Trop de requêtes, réessaie dans un instant." }, { status: 429 });
    }

    const rawCategory = (searchParams.get("category") ?? "all") as ItemCatalogCategory;
    const category: ItemCatalogCategory = ALLOWED_CATEGORIES.includes(rawCategory) ? rawCategory : "all";

    try {
        const [search, facets] = await Promise.all([
            searchItems({
                query: searchParams.get("q") ?? "",
                category,
                superTypeId: num(searchParams.get("superTypeId")),
                typeName: searchParams.get("typeName") || null,
                minLevel: num(searchParams.get("minLevel")),
                maxLevel: num(searchParams.get("maxLevel")),
                page: num(searchParams.get("page")) ?? 0,
                pageSize: num(searchParams.get("pageSize")) ?? 24,
            }),
            getGameItemCatalogFacets(),
        ]);

        return NextResponse.json({
            items: search.items,
            total: search.total,
            source: search.source,
            families: facets.success ? facets.data?.families ?? [] : [],
            types: facets.success ? facets.data?.types ?? [] : [],
        });
    } catch (error) {
        logger.error("[api/market/items/search] failed", {
            err: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json({ items: [], total: 0, source: "local", families: [], types: [] });
    }
}
