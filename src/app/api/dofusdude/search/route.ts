import { NextRequest, NextResponse } from "next/server";
import { searchDofusItems, type DofusItemCategory } from "@/lib/dofusdude-client";

const VALID_CATEGORIES = new Set<DofusItemCategory>(["equipment", "resources", "consumables", "all"]);

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q")?.trim() ?? "";
    const cat = (searchParams.get("cat") ?? "all") as DofusItemCategory;

    if (q.length < 2) {
        return NextResponse.json(
            { error: "La recherche doit faire au moins 2 caractères." },
            { status: 400 }
        );
    }

    if (!VALID_CATEGORIES.has(cat)) {
        return NextResponse.json(
            { error: "Catégorie invalide. Utiliser: equipment, resources, consumables, all." },
            { status: 400 }
        );
    }

    try {
        const items = await searchDofusItems(q, cat, 10);
        return NextResponse.json({ items });
    } catch {
        return NextResponse.json(
            { error: "Erreur lors de la recherche Dofusdude." },
            { status: 500 }
        );
    }
}
