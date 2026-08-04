import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

/**
 * GET /api/dofusdb/quests?q=Mille&limit=8
 *
 * Recherche de quêtes avec PRIORITÉ À LA BDD LOCALE (table GameQuest) :
 *   1. Si des quêtes locales correspondent (siphonnées depuis DofusDB),
 *      on les renvoie en premier — rapide et fiable, sans appel réseau.
 *   2. Sinon, on fait un fallback proxy serveur vers DofusDB (évite CORS/rate-limit).
 *
 * Les résultats locaux sont au même format DofusDB { id, name: {fr}, levelMin, levelMax, slug }.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const limit = Number(searchParams.get("limit") ?? "8");

    if (!q || q.length < 2) {
        return NextResponse.json({ total: 0, data: [] });
    }

    try {
        // 1. RECHERCHE LOCALE D'ABORD (GameQuest siphonné depuis DofusDB)
        const localQuests = await db.gameQuest.findMany({
            where: {
                OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { name: { startsWith: q, mode: "insensitive" } },
                ],
            },
            take: limit,
            orderBy: { name: "asc" },
            select: {
                dofusDbId: true,
                name: true,
                levelMin: true,
                levelMax: true,
                category: true,
            },
        }).catch(() => []);

        if (localQuests.length > 0) {
            const data = localQuests.map((lq) => ({
                id: lq.dofusDbId ?? undefined,
                name: { fr: lq.name },
                levelMin: lq.levelMin ?? undefined,
                levelMax: lq.levelMax ?? undefined,
                slug: { fr: lq.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
                isLocal: true,
            })).filter((x) => x.id !== undefined);

            return NextResponse.json({ total: data.length, data });
        }

        // 2. FALLBACK PROXY vers DofusDB (moins utilisé si le siphon local est complet)
        const escaped = q.normalize("NFC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const cleanQuery = escaped.replace(/['\u2019]/g, "['\\u2019]");

        const dofusUrl = new URL("https://api.dofusdb.fr/quests");
        dofusUrl.searchParams.set("name.fr[$regex]", cleanQuery);
        dofusUrl.searchParams.set("name.fr[$options]", "i");
        dofusUrl.searchParams.set("$limit", String(limit));

        const res = await fetch(dofusUrl.toString(), {
            next: { revalidate: 60 }, // cache 60s côté serveur
        });

        if (!res.ok) {
            return NextResponse.json({ total: 0, data: [] }, { status: 200 });
        }

        const data = await res.json();
        return NextResponse.json({ total: data.total ?? 0, data: data.data ?? [] });
    } catch (err) {
        console.error("[Quests search] Error:", err);
        return NextResponse.json({ total: 0, data: [] }, { status: 200 });
    }
}
