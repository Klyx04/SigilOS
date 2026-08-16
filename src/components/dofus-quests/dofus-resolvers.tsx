"use client";

/**
 * dofus-resolvers.tsx
 * Shared client-side API resolvers for Dofus entities (NPC, Item, Monster, Dungeon).
 * Used by QuestChecklist, DofusSuccessGrid, and DofusNeuralTree.
 */

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

// ─── V3 Objective Text Extractor ─────────────────────────────────────────────
// V3 objectives have the shape: { text: { fr: "...", en: "..." }, className: "...", parameters: {...} }
// V2/legacy objectives are plain strings.
// This function safely extracts the French text from either format.
export function extractObjectiveText(obj: any): string {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    // V3 format: obj.text is a translation object
    const text = obj?.text;
    if (text && typeof text === "object") {
        return String(text.fr || text.en || text.de || Object.values(text).find(v => typeof v === 'string') || "");
    }
    // Fallback: obj.text is already a string, or obj.description
    if (typeof text === "string") return text;
    if (typeof obj?.description === "string") return obj.description;
    return "";
}


// ─── DofusDB API helpers ──────────────────────────────────────────────────────
const DOFUSDB_BASE = "https://api.dofusdb.fr";

async function fetchDofusDB(endpoint: string) {
    try {
        const res = await fetch(`${DOFUSDB_BASE}${endpoint}?lang=fr`, {
            next: { revalidate: 3600 },
        });
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

// ─── NPC Name + Coords Resolver ───────────────────────────────────────────────
export function NpcName({ npcId, fallback }: { npcId?: string; fallback?: string }) {
    const [data, setData] = useState<{ name: string; x?: number; y?: number } | null>(null);

    useEffect(() => {
        if (!npcId) return;
        fetchDofusDB(`/npcs/${npcId}`).then((d) => {
            if (d?.name?.fr) setData({ name: d.name.fr, x: d.subarea?.x, y: d.subarea?.y });
            else if (d?.name) setData({ name: d.name });
        });
    }, [npcId]);

    if (!npcId) return <span>{fallback || "PNJ"}</span>;
    return <span className="text-indigo-400 font-bold italic">{data?.name || fallback || `PNJ #${npcId}`}</span>;
}

// ─── Item Resolver with Icon ──────────────────────────────────────────────────
export function ItemInline({ itemId }: { itemId: string }) {
    const [item, setItem] = useState<{ name: string; iconId?: number } | null>(null);

    useEffect(() => {
        fetchDofusDB(`/items/${itemId}`).then((d) => {
            if (d?.name?.fr) setItem({ name: d.name.fr, iconId: d.iconId });
        });
    }, [itemId]);

    const iconUrl = item?.iconId
        ? `https://static.dofusdb.fr/items/${item.iconId}.png`
        : `https://static.dofusdb.fr/items/${itemId}.png`;

    return (
        <a 
            href={`https://dofusdb.fr/fr/database/item/${itemId}`} 
            target="_blank" 
            className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-0.5 hover:bg-amber-500/20 transition-all cursor-pointer group/item"
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={iconUrl}
                alt=""
                width={16}
                height={16}
                className="object-contain group-hover/item:scale-125 transition-transform"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span className="text-amber-400 font-bold italic text-label">
                {item?.name || `Objet #${itemId}`}
            </span>
        </a>
    );
}

// ─── Monster Resolver with Image ─────────────────────────────────────────────
export function MonsterInline({ monsterId }: { monsterId: string }) {
    const [monster, setMonster] = useState<{ name: string; iconId?: number } | null>(null);

    useEffect(() => {
        if (!monsterId) return;
        fetchDofusDB(`/monsters/${monsterId}`).then((d) => {
            if (d?.name?.fr) {
                setMonster({ name: d.name.fr, iconId: d.iconId });
            }
        });
    }, [monsterId]);

    const imgUrl = monster?.iconId 
        ? `https://static.dofusdb.fr/monsters/${monster.iconId}.png`
        : `https://static.dofusdb.fr/monsters/${monsterId}.png`;

    return (
        <a 
            href={`https://dofusdb.fr/fr/database/monster/${monsterId}`} 
            target="_blank"
            className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2 py-0.5 hover:bg-rose-500/20 transition-all cursor-pointer group/monster"
        >
            <img
                src={imgUrl}
                alt=""
                width={20}
                height={20}
                className="object-contain group-hover/monster:scale-125 transition-transform"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span className="text-rose-400 font-bold italic text-label">
                {monster?.name || `Monstre #${monsterId}`}
            </span>
        </a>
    );
}

// ─── Dungeon resolver ─────────────────────────────────────────────────────────
// Known dungeon map IDs from DofusDB — this list avoids false positives
// Keyed by dungeon boss monster ID
export const KNOWN_DUNGEON_BOSSES: Record<string, { name: string; mapImg: string; x: number; y: number; worldId: number }> = {
    "281":  { name: "Labyrinthe d'Incarnam",   mapImg: "https://api.dofusdb.fr/img/dungeons/30.png",  x: 5,   y: -1,   worldId: 1 },
    "309":  { name: "Donjon d'Astrub",          mapImg: "https://api.dofusdb.fr/img/dungeons/31.png",  x: 1,   y: -19,  worldId: 0 },
    "195":  { name: "Donjon des Bouftous",      mapImg: "https://api.dofusdb.fr/img/dungeons/1.png",   x: -1,  y: -23,  worldId: 0 },
    "118":  { name: "Donjon du Tofu",           mapImg: "https://api.dofusdb.fr/img/dungeons/2.png",   x: 1,   y: -26,  worldId: 0 },
    "113":  { name: "Donjon des Larves",        mapImg: "https://api.dofusdb.fr/img/dungeons/3.png",   x: -2,  y: -27,  worldId: 0 },
    "119":  { name: "Donjon des Fungus",        mapImg: "https://api.dofusdb.fr/img/dungeons/4.png",   x: -5,  y: -24,  worldId: 0 },
    "107":  { name: "Donjon du Koalak",         mapImg: "https://api.dofusdb.fr/img/dungeons/5.png",   x: -15, y: 24,   worldId: 0 },
    "57":   { name: "Tanière du Meulou",        mapImg: "https://static.dofusdb.fr/monsters/57.png",  x: -2,  y: 1,    worldId: 0 },
    "3100": { name: "Donjon du Batofu",         mapImg: "https://static.dofusdb.fr/monsters/3100.png",x: -1,  y: -26,  worldId: 0 },
    "2975": { name: "Donjon du Tofu Royal",     mapImg: "https://static.dofusdb.fr/monsters/2975.png",x: 3,   y: -25,  worldId: 0 },
    "2960": { name: "Donjon des Larves",        mapImg: "https://static.dofusdb.fr/monsters/2960.png",x: -3,  y: -24,  worldId: 0 },
    "5823": { name: "Bibliothèque du Maître Corbac", mapImg: "https://static.dofusdb.fr/monsters/5823.png", x: -9, y: 2, worldId: 0 },
    "3460": { name: "Repaire du Draigoch",      mapImg: "https://static.dofusdb.fr/monsters/3460.png",x: -12, y: 15,   worldId: 0 },
    "8052": { name: "Poste de contrôle du Supervizœuf",          mapImg: "https://static.dofusdb.fr/monsters/2507.png", x: 24,  y: 23,   worldId: 34 },
    "8047": { name: "Breuil du Vénérable",       mapImg: "https://static.dofusdb.fr/monsters/2488.png", x: 6,   y: 9,    worldId: 34 },
    "8033": { name: "Autel de la Déchireuse",    mapImg: "https://static.dofusdb.fr/monsters/2514.png", x: 12,  y: 2,    worldId: 34 },
    "8069": { name: "Temple de Gargandyas",       mapImg: "https://static.dofusdb.fr/monsters/2517.png", x: 2,   y: 16,   worldId: 34 },
    
    // Frigost Bosses
    "2854": { name: "Royalmouth",               mapImg: "https://static.dofusdb.fr/monsters/775.png",  x: -84, y: -49, worldId: 1 },
    "2848": { name: "Mansot Royal",             mapImg: "https://static.dofusdb.fr/monsters/769.png",  x: -64, y: -55, worldId: 1 },
    "2877": { name: "Ben le Ripate",           mapImg: "https://static.dofusdb.fr/monsters/794.png",  x: -60, y: -84, worldId: 1 },
    "2924": { name: "Obsidiantre",              mapImg: "https://static.dofusdb.fr/monsters/825.png",  x: -71, y: -83, worldId: 1 },
    "2967": { name: "Tengu Givrefoux",          mapImg: "https://static.dofusdb.fr/monsters/840.png",  x: -80, y: -75, worldId: 1 },
    "2977": { name: "Korriandre",               mapImg: "https://static.dofusdb.fr/monsters/850.png",  x: -73, y: -69, worldId: 1 },
    "3065": { name: "Kolosso",                  mapImg: "https://static.dofusdb.fr/monsters/860.png",  x: -61, y: -69, worldId: 1 },
    "2864": { name: "Glourséleste",             mapImg: "https://static.dofusdb.fr/monsters/785.png",  x: -63, y: -75, worldId: 1 },
    "3121": { name: "Nileza",                   mapImg: "https://static.dofusdb.fr/monsters/875.png",  x: -61, y: -75, worldId: 1 },
    "3126": { name: "Sylargh",                  mapImg: "https://static.dofusdb.fr/monsters/880.png",  x: -54, y: -82, worldId: 1 },
    "3154": { name: "Klime",                    mapImg: "https://static.dofusdb.fr/monsters/890.png",  x: -65, y: -86, worldId: 1 },
    "3156": { name: "Missiz Frizz",             mapImg: "https://static.dofusdb.fr/monsters/895.png",  x: -72, y: -84, worldId: 1 },
    "3159": { name: "Comte Harebourg",          mapImg: "https://static.dofusdb.fr/monsters/905.png",  x: -68, y: -76, worldId: 1 },
    "2942": { name: "Grolloum",                 mapImg: "https://static.dofusdb.fr/monsters/834.png",  x: -62, y: -76, worldId: 1 },
};

// Known items that exclusively drop from dungeon bosses and imply a dungeon completion
// Maps Item ID to Boss Monster ID
export const KNOWN_DUNGEON_ITEMS: Record<string, string> = {
    "15001": "57", // Bague Enchantée du Meulou -> Meulou
    "32075": "8033", // Pelage de la Déchireuse -> Autel de la Déchireuse
};

// ─── Clipboard with toast ─────────────────────────────────────────────────────
export function copyWithToast(text: string, message = "Copié dans le presse-papier !") {
    navigator.clipboard.writeText(text).then(() => {
        toast.success(message, { duration: 2000 });
    });
}

// ─── Map Link Component ───────────────────────────────────────────────────────
export function MapLink({ x, y, guildId, zone, worldId }: { x: string; y: string; guildId: string; zone?: string; worldId?: number }) {
    const [resolvedWorldId, setResolvedWorldId] = useState<number>(
        typeof worldId === 'number' ? worldId : (zone?.toLowerCase().includes("incarnam") ? 2 : 1)
    );
    
    useEffect(() => {
        if (typeof worldId === 'number') return;
        const xNum = parseInt(x);
        const yNum = parseInt(y);
        if (isNaN(xNum) || isNaN(yNum)) return;
        
        // Dynamically resolve precise worldId using server action
        import("@/server/actions/optimized-guide-actions").then((mod) => {
            mod.resolveMapWorldAction(xNum, yNum, zone || "").then((res) => {
                if (res.success && res.worldId) {
                    setResolvedWorldId(res.worldId);
                }
            });
        });
    }, [x, y, zone, worldId]);
    
    return (
        <Link
            href={`/dashboard/${guildId}/worldmap?x=${x}&y=${y}&zoom=4&world=${resolvedWorldId}`}
            className="text-emerald-400 font-bold italic hover:text-emerald-300 underline decoration-emerald-400/30 transition-colors"
        >
            📍 [{x}, {y}]
        </Link>
    );
}

// ─── ParsedObjective: Full Entity Resolution ──────────────────────────────────
export function ParsedObjective({ text: rawText, guildId, zone }: { text: any; guildId: string; zone?: string }) {
    const parts = useMemo(() => {
        // 🛠️ Normalize input: handle string, V3 {text: {fr: "...", en: "..."}} or legacy {text: ""}
        const text = extractObjectiveText(rawText);

        // Regex handles: {npc,ID}, {item,ID}, {map,X,Y}, {monster,ID}
        const regex = /\{(npc|item|map|monster),([0-9-]+)(?:,([0-9-]+))?\}/g;
        const result: (string | React.ReactNode)[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                result.push(text.substring(lastIndex, match.index));
            }

            const type = match[1];
            const id = match[2];
            const extra = match[3];

            if (type === "npc") {
                result.push(<NpcName key={`npc-${id}-${match.index}`} npcId={id} />);
            } else if (type === "item") {
                result.push(<div key={`item-${id}-${match.index}`} className="inline-block mx-0.5"><ItemInline itemId={id} /></div>);
            } else if (type === "map") {
                result.push(<MapLink key={`map-${id}-${match.index}`} x={id} y={extra || "0"} guildId={guildId} zone={zone} />);
            } else if (type === "monster") {
                result.push(<div key={`monster-${id}-${match.index}`} className="inline-block mx-0.5"><MonsterInline monsterId={id} /></div>);
            }

            lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
            result.push(text.substring(lastIndex));
        }

        return result;
    }, [rawText, guildId, zone]);

    return <span>{parts.map((p, i) => <React.Fragment key={i}>{p}</React.Fragment>)}</span>;
}

// ─── Dungeon HUD ─────────────────────────────────────────────────────────────
/**
 * Detects if an objective list has a REAL dungeon (not just a mob shaped like a dungeon).
 * A dungeon is confirmed if:
 * 1. The text contains "donjon" AND references a known boss monster ID
 * 2. OR explicitly matches a known dungeon name
 */
export function detectRealDungeons(objectives: any[]): { 
    isDungeon: boolean; 
    dungeonName?: string; 
    bossId?: string; 
    bossName?: string;
    mapImg?: string;
    x?: number;
    y?: number;
    worldId?: number;
}[] {
    if (!Array.isArray(objectives)) return [];

    const foundDungeons: any[] = [];

    for (const obj of objectives) {
        // extractObjectiveText handles V3 {text: {fr, en}} objects and plain strings
        const text = extractObjectiveText(obj);
        const lower = text.toLowerCase();
        
        // 1. Check for known boss monster references via ID lookup (MOST ROBUST)
        const monsterMatch = text.match(/\{monster,(\d+)\}/g);
        if (monsterMatch) {
            for (const match of monsterMatch) {
                const bossId = match.match(/\d+/)?.[0];
                if (bossId) {
                    const knownDungeon = KNOWN_DUNGEON_BOSSES[bossId];
                    if (knownDungeon) {
                        foundDungeons.push({
                            isDungeon: true,
                            dungeonName: knownDungeon.name,
                            bossId,
                            mapImg: knownDungeon.mapImg,
                            x: knownDungeon.x,
                            y: knownDungeon.y,
                            worldId: knownDungeon.worldId,
                        });
                    }
                }
            }
        }
        
        // 1.5. Check for known items that explicitly drop from dungeon bosses
        const itemMatch = text.match(/\{item,(\d+)\}/g);
        if (itemMatch) {
            for (const match of itemMatch) {
                const itemId = match.match(/\d+/)?.[0];
                if (itemId) {
                    const bossId = KNOWN_DUNGEON_ITEMS[itemId];
                    if (bossId) {
                        const knownDungeon = KNOWN_DUNGEON_BOSSES[bossId];
                        if (knownDungeon) {
                            foundDungeons.push({
                                isDungeon: true,
                                dungeonName: knownDungeon.name,
                                bossId,
                                mapImg: knownDungeon.mapImg,
                                x: knownDungeon.x,
                                y: knownDungeon.y,
                                worldId: knownDungeon.worldId,
                            });
                        }
                    }
                }
            }
        }

        // 1.7 Special Case: Gargandyas (Titan)
        if (lower.includes("vaincre") && lower.includes("gargandyas")) {
            const known = KNOWN_DUNGEON_BOSSES["8069"];
            foundDungeons.push({
                isDungeon: true,
                dungeonName: known.name,
                bossId: "8069",
                mapImg: known.mapImg,
                x: known.x,
                y: known.y,
                worldId: known.worldId,
            });
        }
        
        // 2. Check for explicit dungeon keywords or injected 'Vaincre : ' patterns
        if (
            (lower.includes("donjon") && (
                lower.includes("pénétrer") || 
                lower.includes("entrer") || 
                lower.includes("accéder") ||
                lower.includes("vaincre") || 
                lower.includes("terminer") ||
                lower.includes("braver")
            )) || text.startsWith("Vaincre : ") || lower.includes("braver les dangers du") || lower.includes("braver les dangers de")
        ) {
            // Extract donjon name
            let dName = "Donjon inconnu";
            const nameMatch = text.match(/Donjon (?:de |des |du |de la )?([^,.{}]+)/i) || 
                             text.match(/braver les dangers (?:du |de |des |de la )?([^,.{}]+)/i);
            
            if (nameMatch) {
                dName = nameMatch[1].trim();
            } else if (text.startsWith("Vaincre : ")) {
                dName = text.replace("Vaincre : ", "").trim();
            }
            
            // Special correction for known Frigost names in text
            if (lower.includes("royalmouth")) dName = "Royalmouth";
            if (lower.includes("mansot royal")) dName = "Mansot Royal";
            if (lower.includes("ben le ripate")) dName = "Ben le Ripate";
            if (lower.includes("obsidiantre")) dName = "Obsidiantre";
            if (lower.includes("tengu")) dName = "Tengu Givrefoux";
            if (lower.includes("korriandre")) dName = "Korriandre";
            if (lower.includes("kolosso")) dName = "Kolosso";
            if (lower.includes("glourséleste")) dName = "Glourséleste";
            
            // Try to find by name in known bosses if ID was missing
            const knownByName = Object.values(KNOWN_DUNGEON_BOSSES).find(kb => 
                kb.name.toLowerCase().includes(dName.toLowerCase()) || 
                dName.toLowerCase().includes(kb.name.toLowerCase())
            );
            if (knownByName) {
                foundDungeons.push({
                    isDungeon: true,
                    dungeonName: knownByName.name,
                    mapImg: knownByName.mapImg,
                    x: knownByName.x,
                    y: knownByName.y,
                    worldId: knownByName.worldId,
                });
            } else {
                foundDungeons.push({ 
                    isDungeon: true,
                    dungeonName: dName
                });
            }
        }
    }
    
    // Deduplicate by name
    const unique = new Map<string, any>();
    for (const d of foundDungeons) {
        if (d.dungeonName && !unique.has(d.dungeonName)) unique.set(d.dungeonName, d);
    }
    return Array.from(unique.values());
}

// ─── Filter quest items from resources list ──────────────────────────────────
export async function filterQuestItemsFromResources<T extends { id: string | number }>(items: T[]): Promise<T[]> {
    if (!items.length) return items;
    try {
        const uniqueIds = Array.from(new Set(items.map(i => String(i.id))));
        const chunks = [];
        for (let i = 0; i < uniqueIds.length; i += 50) chunks.push(uniqueIds.slice(i, i + 50));
        
        const finalIdsToKeep = new Set<string>();
        
        for (const chunk of chunks) {
            // Build proper DofusDB array query params
            const params = new URLSearchParams({ "$select": "id,typeId", "$limit": "50" });
            chunk.forEach(id => params.append("id[$in][]", id));
            const res = await fetch(`https://api.dofusdb.fr/items?${params}`);
            const data = await res.json();
            
            // Normalize: DofusDB can return {data: [...]}, [...], or a single object
            const dataArr: any[] = Array.isArray(data?.data) ? data.data
                : Array.isArray(data) ? data
                : data?.data ? [data.data]
                : [];
            if (!dataArr.length) continue;
            
            const typeIdsArray = Array.from(new Set(dataArr.map((d: any) => d.typeId).filter(Boolean)));
            if (!typeIdsArray.length) {
                // No type info — keep all items from this chunk
                for (const item of dataArr) finalIdsToKeep.add(String(item.id));
                continue;
            }
            
            const typeParams = new URLSearchParams({ "$select": "id,superTypeId", "$limit": "50" });
            typeIdsArray.forEach(id => typeParams.append("id[$in][]", String(id)));
            const typeRes = await fetch(`https://api.dofusdb.fr/item-types?${typeParams}`);
            const typeData = await typeRes.json();
            
            // Normalize type response too
            const typeArr: any[] = Array.isArray(typeData?.data) ? typeData.data
                : Array.isArray(typeData) ? typeData
                : typeData?.data ? [typeData.data]
                : [];
            
            // superTypeId 14 is "Objet de Quête"
            const questItemTypeIds = new Set(
                typeArr.filter((t: any) => t.superTypeId === 14).map((t: any) => t.id)
            );
            
            for (const item of dataArr) {
                // Keep ONLY items that are NOT quest items
                if (!questItemTypeIds.has(item.typeId)) {
                    finalIdsToKeep.add(String(item.id));
                }
            }
        }
        
        return items.filter(i => finalIdsToKeep.has(String(i.id)));
    } catch (e) {
        console.error("Filter quest items failed", e);
        return items; // Fallback to returning all of them safely
    }
}
