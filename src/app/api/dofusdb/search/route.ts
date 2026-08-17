import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

/**
 * GET /api/dofusdb/search?q=...&limit=8
 * Proxy serveur pour l'API DofusDB (evite le CORS cote client).
 * Recherche via Dofusdude en amont car DofusDB ne prend plus en charge les recherches textuelles.
 *
 * #78 - recherche etendue aux 4 categories exposees par Dofusdude v1 :
 * equipment (armes & equipements), resources, consumables, cosmetics (montiliers/apparats).
 */
const DOFUSDUDE_SEARCH_TYPES = ["equipment", "resources", "consumables", "cosmetics"] as const;

const MAX_LIMIT = 24;

/** Bornage defensif des donnees issues de l'API externe (RULES.md par.4). */
function extractAnkamaIds(payload: unknown): number[] {
    if (!Array.isArray(payload)) return [];
    const ids: number[] = [];
    for (const item of payload) {
        const id = item?.ankama_id;
        if (typeof id === "number" && Number.isInteger(id) && id > 0) ids.push(id);
    }
    return ids;
}

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q")?.trim() ?? "";
    const rawLimit = parseInt(searchParams.get("limit") ?? "8", 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT) : 8;

    if (!q || q.length < 2) {
        return NextResponse.json({ data: [] });
    }

    try {
        // 1. Chercher les identifiants uniques via Dofusdude (toutes les categories d'items).
        //    Promise.allSettled : une categorie en echec ne casse pas les autres.
        const results = await Promise.allSettled(
            DOFUSDUDE_SEARCH_TYPES.map((type) =>
                fetch(
                    "https://api.dofusdu.de/dofus3/v1/fr/items/" + type + "/search?query=" + encodeURIComponent(q) + "&limit=" + limit,
                    { signal: AbortSignal.timeout(4000) }
                ).then((res) => (res.ok ? res.json() : []))
            )
        );

        const ids: number[] = [];
        for (const result of results) {
            if (result.status === "fulfilled") {
                ids.push(...extractAnkamaIds(result.value));
            } else {
                logger.warn("[DofusDB Search Proxy] Categorie Dofusdude en echec", {
                    reason: String(result.reason),
                });
            }
        }
        const uniqueIds = [...new Set(ids)].slice(0, limit);

        // 2. Si des IDs ont ete trouves, recuperer les items complets sur DofusDB via l'operateur $in
        if (uniqueIds.length > 0) {
            const queryParams = uniqueIds.map((id) => "id[$in][]=" + id).join("&");
            const url = "https://api.dofusdb.fr/items?" + queryParams + "&$limit=" + limit;
            const res = await fetch(url, {
                headers: {
                    Accept: "application/json",
                    "User-Agent": "SigilOS/1.0",
                },
                next: { revalidate: 300 }, // cache 5min
            });

            if (res.ok) {
                const data = await res.json();
                // Conserver l'ordre retourne par Dofusdude pour la pertinence
                const itemsMap = new Map(
                    (Array.isArray(data?.data) ? data.data : []).map((it: any) => [Number(it?.id), it])
                );
                const orderedData = uniqueIds
                    .map((id) => itemsMap.get(id))
                    .filter((it) => it !== undefined);

                return NextResponse.json({ data: orderedData });
            }
        }

        // 3. Fallback en cas d'erreur ou d'absence d'ID : recherche par nom exact sur DofusDB
        const fallbackUrl = "https://api.dofusdb.fr/items?name.fr=" + encodeURIComponent(q) + "&$limit=" + limit;
        const res = await fetch(fallbackUrl, {
            headers: {
                Accept: "application/json",
                "User-Agent": "SigilOS/1.0",
            },
            next: { revalidate: 60 },
        });

        if (!res.ok) {
            return NextResponse.json({ data: [], error: "DofusDB returned " + res.status }, { status: 200 });
        }

        const data = await res.json();
        return NextResponse.json({ data: Array.isArray(data?.data) ? data.data : [] });

    } catch (err) {
        logger.error("[DofusDB Search Proxy] Error", {
            err: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json({ data: [], error: "Proxy error" }, { status: 200 });
    }
}
