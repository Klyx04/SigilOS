"use client";

import React, { useMemo } from "react";
import { 
    Package, 
    Target, 
    ChevronDown, 
    Info,
    Sword,
    ScrollText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ItemInline, detectRealDungeons, filterQuestItemsFromResources, extractObjectiveText } from "./dofus-resolvers";
import { cn } from "@/lib/utils";

interface DofusGlobalLogisticsProps {
    chains: any[];
    dofusColor: string;
}

export function DofusGlobalLogistics({ chains, dofusColor }: DofusGlobalLogisticsProps) {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [filteredItems, setFilteredItems] = React.useState<{id: string, amount: number, name: string}[]>([]);
    const [isLoadingItems, setIsLoadingItems] = React.useState(true);

    const logistics = useMemo(() => {
        const items = new Map<string, { id: string; amount: number; name: string }>();
        const dungeons = new Set<string>();
        let totalSteps = 0;
        let totalQuests = 0;

        (chains || []).forEach(chain => {
            (chain.entries || []).forEach((quest: any) => {
                totalQuests++;
                
                // Collect Items
                (quest.itemsRequired || []).forEach((req: any) => {
                    const id = String(req.id);
                    if (items.has(id)) {
                        items.get(id)!.amount += (req.amount || 1);
                    } else {
                        items.set(id, { id, amount: req.amount || 1, name: req.name || "Objet" });
                    }
                });

                // Detect Dungeons AND extract Items from objectives (V3 support)
                const objectives = Array.isArray(quest.objectives) ? quest.objectives : [];
                totalSteps += objectives.length;
                
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
                
                const dungeonInfos = detectRealDungeons(objectives);
                for (const dungeonInfo of dungeonInfos) {
                    if (dungeonInfo.isDungeon && dungeonInfo.dungeonName) {
                        dungeons.add(dungeonInfo.dungeonName);
                    }
                }
                if (quest.isDungeon && quest.bossName) {
                    dungeons.add(quest.bossName);
                }
            });
        });

        return {
            items: Array.from(items.values()).sort((a,b) => b.amount - a.amount),
            dungeons: Array.from(dungeons).sort(),
            totalQuests,
            totalSteps
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
                    setFilteredItems(filtered);
                    setIsLoadingItems(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [logistics.items]);

    if (!chains || chains.length === 0) return null;

    return (
        <div className="w-full mb-12">
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                className={cn(
                    "w-full p-6 bg-white/[0.03] border border-white/10 rounded-[2.5rem] flex items-center justify-between cursor-pointer hover:bg-white/[0.05] transition-all group",
                    isExpanded && "rounded-b-none border-b-0 bg-white/[0.05]"
                )}
            >
                <div className="flex items-center gap-8">
                    <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border shadow-2xl transition-transform group-hover:scale-110",
                        isExpanded ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-zinc-500"
                    )}>
                        <Info className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-12">
                        <div>
                            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-1">RÉCAPITULATIF GLOBAL</div>
                            <div className="text-[18px] font-black text-white italic uppercase tracking-tighter">Logistique du Dofus</div>
                        </div>
                        <div className="hidden lg:flex items-center gap-8 text-[11px] font-black uppercase tracking-widest text-zinc-500">
                            <div className="flex items-center gap-3"><ScrollText className="w-4 h-4" /> {logistics.totalQuests} Quêtes</div>
                            <div className="flex items-center gap-3"><Package className="w-4 h-4" /> {isLoadingItems ? "..." : filteredItems.length} Ressources</div>
                            <div className="flex items-center gap-3"><Target className="w-4 h-4" /> {logistics.dungeons.length} Donjons</div>
                        </div>
                    </div>
                </div>
                <ChevronDown className={cn("w-6 h-6 text-zinc-700 transition-transform duration-500", isExpanded && "rotate-180 text-white")} />
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-white/[0.03] border border-t-0 border-white/10 rounded-b-[2.5rem] overflow-hidden"
                    >
                        <div className="p-10 pt-4 grid grid-cols-1 lg:grid-cols-2 gap-12 border-t border-white/5 mx-6 mb-6">
                            {/* Resources Column */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                        <Package className="w-4 h-4" /> Ressources à prévoir
                                    </h4>
                                    <span className="text-[10px] font-black px-3 py-1 bg-white/5 rounded-full text-zinc-500">
                                        {isLoadingItems ? "..." : `${filteredItems.length} TYPES`}
                                    </span>
                                </div>
                                
                                {isLoadingItems ? (
                                    <div className="p-8 border border-dashed border-white/10 rounded-3xl text-center text-zinc-600 italic text-[13px] flex flex-col items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-zinc-600 border-t-white rounded-full animate-spin"></div>
                                        Analyse logistique en cours...
                                    </div>
                                ) : filteredItems.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {filteredItems.map((item) => (
                                            <div key={item.id} className="flex items-center gap-4 p-3 bg-black/40 border border-white/5 rounded-2xl hover:border-white/20 transition-all">
                                                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center p-1.5 relative">
                                                    <img 
                                                        src={`https://api.dofusdb.fr/img/items/${item.id}.png`} 
                                                        alt="" 
                                                        className="w-full h-full object-contain"
                                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                                    />
                                                    <div className="absolute -bottom-1.5 -right-1.5 bg-indigo-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-lg">
                                                        x{item.amount}
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <ItemInline itemId={item.id} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 border border-dashed border-white/10 rounded-3xl text-center text-zinc-600 italic text-[13px]">
                                        Aucune ressource spécifique listée dans les étapes.
                                    </div>
                                )}
                            </div>

                            {/* Dungeons Column */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                        <Sword className="w-4 h-4" /> Donjons Requis
                                    </h4>
                                    <span className="text-[10px] font-black px-3 py-1 bg-white/5 rounded-full text-zinc-500">{logistics.dungeons.length} BOSS</span>
                                </div>

                                {logistics.dungeons.length > 0 ? (
                                    <div className="space-y-2">
                                        {logistics.dungeons.map((dName, i) => (
                                            <div key={i} className="flex items-center gap-4 p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl group hover:border-rose-500/30 transition-all">
                                                <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-500 text-xs">🏰</div>
                                                <div className="text-[13px] font-black text-white italic uppercase tracking-tighter group-hover:text-rose-400 transition-colors">{dName}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 border border-dashed border-white/10 rounded-3xl text-center text-zinc-600 italic text-[13px]">
                                        Aucun donjon détecté dans le parcours.
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
