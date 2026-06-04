import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/dofusdb/search?q=...&limit=8
 * Proxy server-side pour l'API DofusDB (évite le CORS client-side).
 * Recherche via Dofusdude en amont car DofusDB n'accepte plus les regex/search textuels.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "8"), 20);

    if (!q || q.length < 2) {
        return NextResponse.json({ data: [] });
    }

    try {
        // 1. Essayer de chercher les identifiants uniques via Dofusdude (équipements + ressources)
        let ids: number[] = [];
        try {
            const [equipRes, resRes] = await Promise.all([
                fetch(`https://api.dofusdu.de/dofus3/v1/fr/items/equipment/search?query=${encodeURIComponent(q)}&limit=${limit}`, { signal: AbortSignal.timeout(4000) }),
                fetch(`https://api.dofusdu.de/dofus3/v1/fr/items/resources/search?query=${encodeURIComponent(q)}&limit=${limit}`, { signal: AbortSignal.timeout(4000) }),
            ]);

            const equipData = equipRes.ok ? await equipRes.json() : [];
            const resData = resRes.ok ? await resRes.json() : [];

            const merged = [...(Array.isArray(equipData) ? equipData : []), ...(Array.isArray(resData) ? resData : [])];
            ids = merged.map((it: any) => it.ankama_id).filter((id): id is number => typeof id === "number" && id > 0);
        } catch (dofusdudeErr) {
            console.warn("[DofusDB Search Proxy] Dofusdude lookup failed, falling back to exact query:", dofusdudeErr);
        }

        // 2. Si des IDs ont été trouvés, récupérer les items complets sur DofusDB via l'opérateur $in
        if (ids.length > 0) {
            const queryParams = ids.map(id => `id[$in][]=${id}`).join("&");
            const url = `https://api.dofusdb.fr/items?${queryParams}&$limit=${limit}`;
            const res = await fetch(url, {
                headers: {
                    Accept: "application/json",
                    "User-Agent": "SigilOS/1.0",
                },
                next: { revalidate: 300 }, // cache 5min
            });

            if (res.ok) {
                const data = await res.json();
                // Conserver l'ordre retourné par Dofusdude pour la pertinence
                const itemsMap = new Map(
                    (data.data ?? []).map((it: any) => [Number(it.id), it])
                );
                const orderedData = ids
                    .map(id => itemsMap.get(id))
                    .filter((it): it is any => it !== undefined);

                return NextResponse.json({ data: orderedData });
            }
        }

        // 3. Fallback en cas d'erreur ou d'absence d'ID: Recherche par nom exact sur DofusDB
        const fallbackUrl = `https://api.dofusdb.fr/items?name.fr=${encodeURIComponent(q)}&$limit=${limit}`;
        const res = await fetch(fallbackUrl, {
            headers: {
                Accept: "application/json",
                "User-Agent": "SigilOS/1.0",
            },
            next: { revalidate: 60 },
        });

        if (!res.ok) {
            return NextResponse.json({ data: [], error: `DofusDB returned ${res.status}` }, { status: 200 });
        }

        const data = await res.json();
        return NextResponse.json({ data: data.data ?? [] });

    } catch (err: any) {
        console.error("[DofusDB Search Proxy] Error:", err?.message);
        return NextResponse.json({ data: [], error: "Proxy error" }, { status: 200 });
    }
}
