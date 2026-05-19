"use server";

import { db } from "@/lib/prisma";

export async function searchDungeonsLocal(query: string) {
    if (!query || query.length < 2) return { success: true, data: [] };
    try {
        const dungeons = await db.dungeon.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { bossName: { contains: query, mode: "insensitive" } }
                ]
            },
            take: 10,
            orderBy: { level: 'asc' }
        });
        return { 
            success: true, 
            data: dungeons.map(d => ({
                id: d.id.toString(),
                name: d.name,
                imageUrl: `https://static.ankama.com/dofus/www/game/monsters/${d.id}.png`, // Boss icon usually matches dungeon ID or needs specific mapping
                level: d.level
            }))
        };
    } catch (error) {
        return { success: false, error: "Erreur recherche donjons" };
    }
}

export async function searchItemsDofusDB(query: string) {
    if (!query || query.length < 2) return { success: true, data: [] };
    try {
        const res = await fetch(`https://api.dofusdb.fr/items?name.fr=${encodeURIComponent(query)}&$limit=10&lang=fr`, {
            cache: 'no-store'
        });
        if (!res.ok) throw new Error("DofusDB failed");
        const data = await res.json();
        
        return {
            success: true,
            data: (data.data || []).map((it: any) => ({
                id: it.id.toString(),
                name: it.name.fr,
                imageUrl: it.img || `https://static.dofusdb.fr/items/illustr/${it.iconId}.png`,
                level: it.level
            }))
        };
    } catch (error) {
        return { success: false, error: "Erreur DofusDB" };
    }
}
