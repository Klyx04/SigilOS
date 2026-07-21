"use server";

import { db } from "@/lib/prisma";
import { auth } from "@/auth";

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

export async function searchQuestsLocalThenDofusDB(query: string) {
    if (!query || query.length < 2) return { success: true, data: [] };
    
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    try {
        // 1. Chercher en priorité dans la table locale GameQuest
        const localQuests = await db.gameQuest.findMany({
            where: {
                name: { contains: query, mode: "insensitive" }
            },
            take: 10,
            orderBy: { name: 'asc' }
        });

        if (localQuests.length > 0) {
            return {
                success: true,
                source: "local",
                data: localQuests.map(q => ({
                    id: q.id,
                    name: q.name,
                    dofusDbId: q.dofusDbId,
                    levelMin: q.levelMin,
                    category: q.category,
                    imageUrl: q.imageUrl,
                    source: "local"
                }))
            };
        }

        // 2. Si aucun résultat local, fallback vers l'API DofusDB
        const escaped = query.normalize("NFC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const cleanQuery = escaped.replace(/['\u2019]/g, "['\\u2019]");

        const dofusUrl = new URL("https://api.dofusdb.fr/quests");
        dofusUrl.searchParams.set("name.fr[$regex]", cleanQuery);
        dofusUrl.searchParams.set("name.fr[$options]", "i");
        dofusUrl.searchParams.set("$limit", "10");

        const res = await fetch(dofusUrl.toString(), { cache: 'no-store' });
        if (!res.ok) throw new Error("DofusDB API failed");
        
        const data = await res.json();
        
        return {
            success: true,
            source: "dofusdb",
            data: (data.data || []).map((it: any) => ({
                id: it.id.toString(),
                name: it.name.fr,
                dofusDbId: it.id,
                levelMin: it.levelMin || null,
                category: it.category?.name?.fr || "DofusDB",
                imageUrl: it.img || null,
                source: "dofusdb"
            }))
        };
    } catch (error) {
        console.error("[searchQuestsLocalThenDofusDB] Error:", error);
        return { success: false, error: "Erreur lors de la recherche des quêtes" };
    }
}

export async function getQuestPrerequisites(dofusDbId: number) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Non autorisé" };

    try {
        const res = await fetch(`https://api.dofusdb.fr/quests/${dofusDbId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error("Impossible de joindre DofusDB");
        const quest = await res.json();
        
        const criterion = quest.startCriterion || "";
        const levelMin = quest.levelMin || null;
        
        const parsedConditions: string[] = [];
        const requiredQuestIds: number[] = [];
        const requiredAchievementIds: number[] = [];
        
        if (criterion) {
            const parts = criterion.split("&");
            for (const part of parts) {
                if (part.startsWith("PL>")) {
                    const lvl = parseInt(part.substring(3), 10);
                    parsedConditions.push(`Niveau minimum : ${lvl + 1}`);
                } else if (part.startsWith("PL<")) {
                    const lvl = parseInt(part.substring(3), 10);
                    parsedConditions.push(`Niveau maximum : ${lvl - 1}`);
                } else if (part.startsWith("Qf=")) {
                    const qId = parseInt(part.substring(3), 10);
                    requiredQuestIds.push(qId);
                } else if (part.startsWith("Sc=")) {
                    const scId = parseInt(part.substring(3), 10);
                    requiredAchievementIds.push(scId);
                } else if (part.startsWith("Ps=")) {
                    const align = parseInt(part.substring(3), 10);
                    if (align === 1) parsedConditions.push("Alignement : Bontarien");
                    else if (align === 2) parsedConditions.push("Alignement : Brâkmarien");
                    else if (align === 0) parsedConditions.push("Alignement : Neutre");
                } else if (part.startsWith("Pa=")) {
                    const rank = parseInt(part.substring(3), 10);
                    parsedConditions.push(`Quête d'alignement d'ordre : ${rank}`);
                } else if (part.startsWith("Pr=")) {
                    const order = parseInt(part.substring(3), 10);
                    parsedConditions.push(`Ordre d'alignement requis : ${order}`);
                }
            }
        } else if (levelMin) {
            parsedConditions.push(`Niveau minimum : ${levelMin}`);
        }
        
        const resolvedQuests: { id: number; name: string }[] = [];
        if (requiredQuestIds.length > 0) {
            // First check local DB
            const localQuests = await db.gameQuest.findMany({
                where: {
                    dofusDbId: { in: requiredQuestIds }
                },
                select: {
                    dofusDbId: true,
                    name: true
                }
            });
            
            const foundIds = new Set(localQuests.map(q => q.dofusDbId));
            localQuests.forEach(q => {
                if (q.dofusDbId) resolvedQuests.push({ id: q.dofusDbId, name: q.name });
            });
            
            const missingIds = requiredQuestIds.filter(id => !foundIds.has(id));
            if (missingIds.length > 0) {
                await Promise.all(missingIds.map(async (id) => {
                    try {
                        const qRes = await fetch(`https://api.dofusdb.fr/quests/${id}`);
                        if (qRes.ok) {
                            const qData = await qRes.json();
                            if (qData.name?.fr) {
                                resolvedQuests.push({ id, name: qData.name.fr });
                            }
                        }
                    } catch (e) {
                        console.error(`Error resolving quest ${id}:`, e);
                    }
                }));
            }
        }
        
        const resolvedAchievements: { id: number; name: string }[] = [];
        if (requiredAchievementIds.length > 0) {
            await Promise.all(requiredAchievementIds.map(async (id) => {
                try {
                    const aRes = await fetch(`https://api.dofusdb.fr/achievements/${id}`);
                    if (aRes.ok) {
                        const aData = await aRes.json();
                        if (aData.name?.fr) {
                            resolvedAchievements.push({ id, name: aData.name.fr });
                        }
                    }
                } catch (e) {
                    console.error(`Error resolving achievement ${id}:`, e);
                }
            }));
        }
        
        return {
            success: true,
            data: {
                levelMin: levelMin,
                conditions: parsedConditions,
                prerequisiteQuests: resolvedQuests,
                prerequisiteAchievements: resolvedAchievements
            }
        };
    } catch (error: any) {
        console.error("[getQuestPrerequisites] Error:", error);
        return { success: false, error: "Impossible de récupérer les prérequis" };
    }
}

export async function searchGuideQuests(query: string) {
    if (!query || query.length < 2) return { success: true, data: [] };
    try {
        // 1. Search existing guide sequence names in DB
        const sequences = await db.guideSequence.findMany({
            where: {
                OR: [
                    { subGuideName: { contains: query, mode: "insensitive" } },
                    { subGuideRef: { contains: query, mode: "insensitive" } }
                ]
            },
            select: { subGuideName: true, subGuideRef: true },
            take: 10
        });

        const names = new Set<string>();
        sequences.forEach(s => {
            if (s.subGuideName) names.add(s.subGuideName);
            if (s.subGuideRef) names.add(s.subGuideRef);
        });

        // 2. Also search GameQuest table
        const localQuests = await db.gameQuest.findMany({
            where: { name: { contains: query, mode: "insensitive" } },
            select: { name: true },
            take: 10
        });
        localQuests.forEach(q => names.add(q.name));

        return {
            success: true,
            data: Array.from(names).slice(0, 10).map(name => ({ id: name, name }))
        };
    } catch (error) {
        console.error("[searchGuideQuests] Error:", error);
        return { success: false, error: "Erreur recherche quêtes" };
    }
}

