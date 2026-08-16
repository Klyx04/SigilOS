"use client";

import React, { useMemo } from "react";
import { 
    Package, 
    ChevronDown, 
    Info,
    Sword,
    ScrollText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ItemInline, detectRealDungeons, filterQuestItemsFromResources, extractObjectiveText } from "./dofus-resolvers";
import { cn } from "@/lib/utils";

function ResourceNameLink({ itemId, fallbackName }: { itemId: string; fallbackName?: string }) {
    const [name, setName] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (fallbackName && fallbackName !== "Ressource" && fallbackName !== "Objet") {
            setName(fallbackName);
            return;
        }
        fetch(`https://api.dofusdb.fr/items/${itemId}?lang=fr`)
            .then(res => res.ok ? res.json() : null)
            .then(d => {
                if (d?.name?.fr) setName(d.name.fr);
            })
            .catch(() => {});
    }, [itemId, fallbackName]);

    return (
        <a 
            href={`https://dofusdb.fr/fr/database/item/${itemId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-label font-black text-amber-400 italic hover:text-amber-300 transition-colors uppercase tracking-tight block truncate"
        >
            {name || fallbackName || `Ressource #${itemId}`}
        </a>
    );
}

interface DofusGlobalLogisticsProps {
    chains: any[];
    dofusColor: string;
    completedIds?: Set<string>;
}

export function DofusGlobalLogistics({ chains, dofusColor, completedIds }: DofusGlobalLogisticsProps) {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [filteredItems, setFilteredItems] = React.useState<{id: string, amount: number, name: string, img?: string}[]>([]);
    const [isLoadingItems, setIsLoadingItems] = React.useState(true);

    const logistics = useMemo(() => {
        const items = new Map<string, { id: string; amount: number; name: string; img?: string }>();
        const dungeons = new Map<string, { id?: string; name: string; bossName?: string; level?: number; img?: string; idoleName?: string }>();
        let totalQuests = 0;

        // Collect data from ALL chains (including prerequisites) for a true global summary
        (chains || []).forEach(chain => {
            (chain.entries || []).forEach((quest: any) => {
                if (completedIds && completedIds.has(String(quest.id))) return;
                totalQuests++;
                
                // Collect Items from structured data
                (quest.itemsRequired || []).forEach((req: any) => {
                    const id = String(req.id);
                    if (items.has(id)) {
                        items.get(id)!.amount += (req.amount || 1);
                        if (req.img && !items.get(id)!.img) items.get(id)!.img = req.img;
                    } else {
                        items.set(id, { id, amount: req.amount || 1, name: req.name || "Objet", img: req.img });
                    }
                });

                // Detect Items from objective text patterns (V3 support)
                const objectives = Array.isArray(quest.objectives) ? quest.objectives : [];
                objectives.forEach((obj: any) => {
                    const text = extractObjectiveText(obj);
                    const regex = /(?:(\d+)\s*(?:[xX]\s*|de\s*)?)?\{item,\s*(\d+)(?:,(\d+))?\}/g;
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const amountStr = match[1];
                        const amount = amountStr ? parseInt(amountStr, 10) : 1;
                        const id = match[2];
                        if (items.has(id)) {
                            items.get(id)!.amount += amount;
                        } else {
                            items.set(id, { id, amount, name: "Ressource" });
                        }
                    }
                });
                
                // Read dungeonsRequired directly from compiled data (V3)
                (quest.dungeonsRequired || []).forEach((d: any) => {
                    const key = d.name || `Dungeon-${d.id}`;
                    if (!dungeons.has(key)) {
                        dungeons.set(key, {
                            id: d.bossId ? String(d.bossId) : d.id ? String(d.id) : undefined,
                            name: d.name === "Risquer un œil" ? "Risquer un œil" : d.name,
                            level: d.level,
                            bossName: d.bossName,
                            img: d.img,
                            idoleName: d.idoleName
                        });
                    }
                });
                
                // Fallback: detect dungeons from objective text patterns
                const dungeonInfos = detectRealDungeons(objectives);
                for (const dungeonInfo of dungeonInfos) {
                    if (dungeonInfo.isDungeon && dungeonInfo.dungeonName) {
                        if (!dungeons.has(dungeonInfo.dungeonName)) {
                            dungeons.set(dungeonInfo.dungeonName, { 
                                name: dungeonInfo.dungeonName,
                                id: dungeonInfo.bossId ? String(dungeonInfo.bossId) : undefined,
                                img: dungeonInfo.mapImg
                            });
                        } else if (dungeonInfo.mapImg) {
                            // Merge the image if it wasn't provided by the compiler generated block!
                            const existing = dungeons.get(dungeonInfo.dungeonName)!;
                            if (!existing.img && dungeonInfo.mapImg) {
                                existing.img = dungeonInfo.mapImg;
                            }
                            if (!existing.id && dungeonInfo.bossId) {
                                existing.id = String(dungeonInfo.bossId);
                            }
                        }
                    }
                }
            });
        });

        return {
            items: Array.from(items.values()).sort((a,b) => b.amount - a.amount),
            dungeons: Array.from(dungeons.values()).sort((a,b) => (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name)),
            totalQuests
        };
    }, [chains]);

    React.useEffect(() => {
        if (!logistics.items.length) {
            setFilteredItems([]);
            setIsLoadingItems(false);
            return;
        }

        let isMounted = true;
        setIsLoadingItems(true);

        filterQuestItemsFromResources(logistics.items)
            .then(filtered => {
                if (isMounted) {
                    setFilteredItems(filtered.length > 0 ? filtered : logistics.items);
                    setIsLoadingItems(false);
                }
            })
            .catch(() => {
                if (isMounted) {
                    setFilteredItems(logistics.items);
                    setIsLoadingItems(false);
                }
            });

        return () => { isMounted = false; };
    }, [logistics.items]);

    if (!chains || chains.length === 0) return null;

    return (
        <div className="w-full relative z-10 isolate mb-12">
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                    "w-full p-6 bg-white/[0.03] border border-white/10 rounded-[2.5rem] flex flex-col sm:flex-row items-center justify-between cursor-pointer hover:bg-white/[0.05] transition-all group gap-6",
                    isExpanded && "rounded-b-none border-b-0 bg-white/[0.05]"
                )}
            >
                <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 w-full sm:w-auto">
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border shadow-2xl transition-transform group- shrink-0",
                        isExpanded ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-zinc-500"
                    )}>
                        <Info className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-12 w-full text-center sm:text-left">
                        <div>
                            <div className="text-caption font-black text-zinc-500 uppercase tracking-widest mb-1">RÉCAPITULATIF GLOBAL</div>
                            <div className="text-[18px] font-black text-white italic uppercase tracking-tighter">Logistique du Dofus</div>
                        </div>
                        <div className="flex flex-wrap justify-center sm:justify-start items-center gap-4 sm:gap-8 text-caption font-black uppercase tracking-widest text-zinc-500">
                            <div className="flex items-center gap-2"><ScrollText className="w-4 h-4" /> {logistics.totalQuests} Quêtes</div>
                            <div className="flex items-center gap-2"><Package className="w-4 h-4" /> {isLoadingItems ? "..." : filteredItems.length} Ressources</div>
                        </div>
                    </div>
                </div>
                
                <div className={cn(
                    "w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center transition-transform shrink-0",
                    isExpanded && "rotate-180 bg-white/10"
                )}>
                    <ChevronDown className="w-5 h-5 text-white/50" />
                </div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="overflow-hidden bg-white/[0.02] border border-t-0 border-white/10 rounded-b-[2.5rem]"
                    >
                        <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
                            {/* Resources Column */}
                            <div className="lg:col-span-5 space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <h4 className="text-caption font-black text-zinc-400 uppercase tracking-widest flex items-center gap-3">
                                        <Package className="w-4 h-4" /> Ressources à prévoir
                                    </h4>
                                    <span className="text-caption font-black px-3 py-1 bg-white/5 rounded-full text-zinc-500">{filteredItems.length} TYPES</span>
                                </div>

                                {isLoadingItems ? (
                                    <div className="p-8 border border-dashed border-white/10 rounded-3xl text-center text-zinc-600 italic text-body-sm flex flex-col items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
                                        Analyse logistique en cours...
                                    </div>
                                ) : filteredItems.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                        {filteredItems.map((item) => (
                                            <div key={item.id} className="flex items-center gap-3 p-3 bg-white/[0.01] border border-white/5 rounded-2xl hover:border-white/10 hover:bg-white/[0.03] transition-all group">
                                                <div className="w-10 h-10 bg-zinc-950 rounded-xl flex items-center justify-center p-1.5 relative shrink-0 border border-white/5">
                                                    <img 
                                                        src={item.img || `https://static.dofusdb.fr/items/${item.id}.png`} 
                                                        alt="" 
                                                        className="w-full h-full object-contain group- transition-transform drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]"
                                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                                    />
                                                    <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-caption font-black px-1.5 py-0.5 rounded-md shadow-lg border border-white/10">
                                                        x{item.amount}
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <ResourceNameLink itemId={item.id} fallbackName={item.name} />
                                                    <span className="text-caption font-bold text-zinc-600 uppercase tracking-widest block mt-0.5">ID: {item.id}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 border border-dashed border-white/10 rounded-3xl text-center text-zinc-600 italic text-body-sm">
                                        Aucune ressource spécifique listée.
                                    </div>
                                )}
                            </div>

                            {/* Dungeons Column - REFACTORED TO GRID */}
                            <div className="lg:col-span-7 space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <h4 className="text-caption font-black text-zinc-400 uppercase tracking-widest flex items-center gap-3">
                                        <Sword className="w-4 h-4" /> Donjons Requis
                                    </h4>
                                    <span className="text-caption font-black px-3 py-1 bg-white/5 rounded-full text-zinc-500">{logistics.dungeons.length} BOSS</span>
                                </div>

                                {logistics.dungeons.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar content-start">
                                        {logistics.dungeons.map((d, i) => {
                                            const searchUrl = `https://www.google.com/search?q=site:dofuspourlesnoobs.com+${encodeURIComponent(d.name)}`;
                                            return (
                                                <a 
                                                    key={i} 
                                                    href={searchUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex flex-col gap-2 p-3 bg-rose-500/[0.02] border border-rose-500/10 rounded-2xl group hover:border-rose-500/30 hover:bg-rose-500/[0.05] transition-all relative overflow-hidden h-fit cursor-pointer"
                                                >
                                                    {/* Idol Badge */}
                                                    {d.idoleName && (
                                                        <div className="absolute top-0 right-0 px-2 py-0.5 bg-amber-500/20 border-b border-l border-amber-500/30 rounded-bl-lg text-caption font-black text-amber-500 uppercase tracking-widest z-10">
                                                            {d.idoleName}
                                                        </div>
                                                    )}
                                                    
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-black/60 border border-white/5 flex items-center justify-center p-1 shrink-0 relative overflow-hidden group- transition-transform shadow-inner">
                                                            {(d.id || d.img) ? (
                                                                <img 
                                                                    src={d.img || `https://static.dofusdb.fr/monsters/${d.id}.png`} 
                                                                    className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_8px_rgba(239,68,68,0.2)]" 
                                                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                                                    alt={d.name}
                                                                />
                                                            ) : (
                                                                <span className="text-rose-500 text-base">🏰</span>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-caption font-black text-white italic truncate group-hover:text-rose-400 transition-colors uppercase leading-tight">
                                                                {d.name}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 opacity-50">
                                                                {d.level && d.level > 0 && (
                                                                    <span className="text-caption text-zinc-500 font-bold uppercase tracking-wider whitespace-nowrap">Lvl {d.level}</span>
                                                                )}
                                                                {d.bossName && (
                                                                    <span className="text-caption text-zinc-600 font-bold italic truncate">— {d.bossName}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </a>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-8 border border-dashed border-white/10 rounded-3xl text-center text-zinc-600 italic text-body-sm">
                                        Aucun donjon requis.
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
