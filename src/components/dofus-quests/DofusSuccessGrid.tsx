"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Check, 
    Lock, 
    ChevronRight, 
    X, 
    BookOpen, 
    Zap, 
    Map as MapIcon, 
    MapPin,
    Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MemberOnQuest } from "@/server/actions/dofus-quest-actions";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { NpcName, ParsedObjective, copyWithToast, detectRealDungeons, extractObjectiveText, ItemInline } from "./dofus-resolvers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Target, Navigation, Users, Sword } from "lucide-react";



interface DofusSuccessGridProps {
    guildId: string;
    dofus: any;
    chains: any[];
    synergy: Record<string, MemberOnQuest[]>;
    dofusColor: string;
    onToggleStatus: (questId: string, status: any) => void;
    completedIds: Set<string>;
}

const SECTION_TYPES: Record<string, { label: string; color: string; order: number }> = {
    PREREQUISITE:   { label: "Prérequis", color: "#f59e0b", order: 1 },
    MAIN_CHAIN:     { label: "Arc Principal", color: "#6366f1", order: 2 },
    RESOURCE_CHAIN: { label: "Donjons & Ressources", color: "#ec4899", order: 3 },
    OPTIONAL:       { label: "Optionnel", color: "#6b7280", order: 4 },
};

export function DofusSuccessGrid({
    guildId,
    dofus,
    chains,
    synergy,
    dofusColor,
    onToggleStatus,
    completedIds,
}: DofusSuccessGridProps) {
    const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
    const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);

    const groups = useMemo(() => {
        const map = new Map<string, any[]>();
        for (const c of chains) {
            const type = c.sectionType || "OTHER";
            if (!map.has(type)) map.set(type, []);
            map.get(type)!.push(c);
        }
        return Array.from(map.entries()).sort((a, b) => {
            const orderA = SECTION_TYPES[a[0]]?.order || 99;
            const orderB = SECTION_TYPES[b[0]]?.order || 99;
            return orderA - orderB;
        });
    }, [chains]);

    const getChainStats = (chain: any) => {
        const entries = chain.entries ?? [];
        const done = entries.filter((e: any) => e.status === "COMPLETED").length;
        return { done, total: entries.length, pct: entries.length ? Math.round((done / entries.length) * 100) : 0 };
    };

    const isLocked = (entry: any) => {
        if (!entry.requirements || !Array.isArray(entry.requirements) || entry.requirements.length === 0) return false;
        return entry.requirements.some((req: any) => {
            if (!req || typeof req !== 'object' || req.type !== "QUEST") return false;
            const rid = req.id || req.dofusdbId;
            return !completedIds.has(String(rid));
        });
    };

    const selectedChain = chains.find(c => c.id === selectedChainId);

    return (
        <div className="space-y-12">
            {/* Phase-based Roadmap */}
            {groups.map(([sectionType, zoneChains]) => {
                const config = SECTION_TYPES[sectionType] || { label: "Divers", color: dofusColor };
                const zoneName = config.label;
                const zoneColor = config.color;
                
                if (zoneChains.length === 0) return null;

                const totalInZone = zoneChains.reduce((acc, c) => acc + getChainStats(c).total, 0);
                const doneInZone = zoneChains.reduce((acc, c) => acc + getChainStats(c).done, 0);
                const zonePct = totalInZone > 0 ? Math.round((doneInZone / totalInZone) * 100) : 0;

                return (
                    <div key={sectionType} className="space-y-8">
                        {/* Section Header */}
                        <div className="flex items-end justify-between border-b border-white/5 pb-6">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative overflow-hidden group">
                                    <span className="text-2xl font-black italic opacity-20" style={{ color: zoneColor }}>{zoneName[0]}</span>
                                    <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: zoneColor }} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 mb-1">Phase d'aventure</div>
                                    <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">{zoneName}</h2>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className="text-[11px] font-black text-white/40 tabular-nums uppercase tracking-widest">{doneInZone}/{totalInZone} quêtes complétées</span>
                                <div className="w-64 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                    <motion.div 
                                        className="h-full rounded-full shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                        style={{ background: zoneColor }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${zonePct}%` }}
                                        transition={{ duration: 1.2, ease: "easeOut" }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Chain Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {zoneChains.map((chain) => {
                                const stats = getChainStats(chain);
                                const isComplete = stats.done === stats.total && stats.total > 0;
                                const nextInChain = chain.entries?.find((e: any) => e.status !== "COMPLETED" && !isLocked(e));

                                return (
                                    <motion.button
                                        key={chain.id}
                                        onClick={() => setSelectedChainId(chain.id)}
                                        whileHover={{ scale: 1.02, y: -4 }}
                                        whileTap={{ scale: 0.98 }}
                                        className={`p-5 rounded-[2rem] border transition-all duration-500 flex flex-col gap-4 text-left group overflow-hidden ${
                                            isComplete 
                                                ? "bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]" 
                                                : "bg-[#0c0d10] border-white/5 hover:border-white/20 active:bg-white/[0.02]"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <Badge 
                                                variant="outline" 
                                                className={`text-[9px] font-black py-0.5 px-2 rounded-lg border transition-all ${
                                                    isComplete 
                                                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                                                        : "bg-white/5 text-zinc-500 border-white/5"
                                                }`}
                                                style={isComplete ? {} : {}}
                                            >
                                                {isComplete ? "✓ Succès" : "Succès"}
                                            </Badge>
                                            {isComplete ? (
                                                <Check className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <span className="text-[10px] font-black tabular-nums text-zinc-600">{stats.done}/{stats.total}</span>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className={`text-lg font-black italic leading-tight uppercase tracking-tighter transition-colors ${
                                                isComplete ? "text-emerald-400" : "text-white group-hover:text-indigo-400"
                                            }`}>{chain.sectionName}</h3>
                                            {nextInChain && !isComplete && (
                                                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-2 truncate">→ {nextInChain.name}</p>
                                            )}
                                        </div>
                                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-700" style={{ background: isComplete ? "#10b981" : zoneColor, width: `${stats.pct}%` }} />
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {/* Centered Detail Modal */}
            <Dialog open={!!selectedChain} onOpenChange={(open) => !open && setSelectedChainId(null)}>
                <DialogContent className="max-w-4xl h-[90vh] bg-[#050608] border-white/10 p-0 overflow-hidden rounded-[2.5rem] flex flex-col">
                    {/* Header Section */}
                    <div className="p-8 border-b border-white/5 flex items-start justify-between bg-zinc-950/50 flex-shrink-0">
                        <div>
                            <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2">
                                {selectedChain ? (SECTION_TYPES[selectedChain.sectionType]?.label || "Exploration") : ""}
                            </div>
                            <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                                {selectedChain?.sectionName}
                            </h3>
                        </div>
                    </div>

                    <ScrollArea className="flex-1 w-full overflow-y-auto">
                        <div className="p-8 space-y-6">
                            {selectedChain?.entries?.map((entry: any, i: number) => {
                                    const done = entry.status === "COMPLETED";
                                    const lock = isLocked(entry);
                                    const expanded = selectedQuestId === entry.id;

                                    // V3 structured dungeons & Fallback text-parsed dungeons
                                    const structuredDungeons: any[] = entry.dungeonsRequired ?? [];
                                    const dungeonInfos = detectRealDungeons(Array.isArray(entry.objectives) ? entry.objectives : []);
                                    const hasDungeons = structuredDungeons.length > 0 || dungeonInfos.length > 0;
                                    const itemsReq = Array.isArray(entry.itemsRequired) ? entry.itemsRequired : [];

                                    return (
                                        <div key={entry.id} className="space-y-4">
                                            <div
                                                onClick={() => setSelectedQuestId(expanded ? null : entry.id)}
                                                className={`w-full p-6 rounded-[2rem] border text-left transition-all duration-300 relative overflow-hidden cursor-pointer ${
                                                    done ? "bg-emerald-500/5 border-emerald-500/20 opacity-60" 
                                                    : lock ? "bg-zinc-900/30 border-white/5 opacity-40 grayscale"
                                                    : expanded ? "bg-white/5 border-white/30 shadow-2xl"
                                                    : "bg-zinc-900/50 border-white/5 hover:border-white/20"
                                                }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-[14px] ${
                                                        done ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "bg-white/5 text-zinc-500"
                                                    }`}>
                                                        {done ? <Check className="w-6 h-6" /> : lock ? <Lock className="w-5 h-5" /> : i + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-[17px] font-black italic uppercase tracking-tighter truncate ${done ? "line-through text-zinc-600" : "text-white"}`}>
                                                            {entry.name}
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                            {entry.level && <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-xl">Lvl {entry.level}</span>}
                                                            {hasDungeons && <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1"><Sword className="w-3 h-3" /> Donjon</span>}
                                                            {itemsReq.length > 0 && <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1"><Package className="w-3 h-3" /> x{itemsReq.length}</span>}
                                                            {lock && !done && <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">Quête verrouillée</span>}
                                                        </div>
                                                    </div>
                                                    <ChevronRight className={`w-6 h-6 text-zinc-700 transition-transform ${expanded ? "rotate-90 text-white" : ""}`} />
                                                </div>

                                                <AnimatePresence>
                                                    {expanded && (
                                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                            <div className="pt-8 mt-6 border-t border-white/5 space-y-8">
                                                                {/* NPC Meta Card */}
                                                                <div className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl flex items-center gap-5">
                                                                    <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
                                                                        <MapPin className="w-7 h-7" />
                                                                    </div>
                                                                    <div 
                                                                        className="flex-1 min-w-0 cursor-pointer group/travel"
                                                                        onClick={(e) => { 
                                                                            e.stopPropagation();
                                                                            if (entry.coords) copyWithToast(`/travel ${entry.coords.x} ${entry.coords.y}`);
                                                                        }}
                                                                    >
                                                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1 group-hover/travel:text-emerald-400 transition-colors">
                                                                            PNJ NARRATIF
                                                                            <span className="opacity-0 group-hover/travel:opacity-60 text-[9px] bg-white/5 px-2.5 py-1 rounded-lg ml-4">COPIER /TRAVEL</span>
                                                                        </div>
                                                                        <div className="text-[15px] font-black text-white italic group-hover/travel:text-emerald-400 transition-colors">
                                                                            {(() => {
                                                                                const objectives = Array.isArray(entry.objectives) ? entry.objectives : [];
                                                                                const objWithNpc = objectives.find((o: any) => extractObjectiveText(o).includes("{npc,"));
                                                                                const match = extractObjectiveText(objWithNpc).match(/\{npc,(\d+)\}/);
                                                                                return match ? <NpcName npcId={match[1]} /> : (entry.npcName || entry.npcSubArea || "PNJ Curation");
                                                                            })()} {entry.coords && <span className="text-zinc-600 font-normal">en [{entry.coords.x}, {entry.coords.y}]</span>}
                                                                        </div>
                                                                    </div>
                                                                    {entry.coords && (
                                                                         <Link 
                                                                            href={`/dashboard/${guildId}/worldmap?x=${entry.coords.x}&y=${entry.coords.y}&zoom=4&world=${
                                                                                (entry as any).coords.worldId ?? 
                                                                                (((entry as any).zone || "").toLowerCase().includes("incarnam") || ((entry as any).npcSubArea || "").toLowerCase().includes("incarnam") ? 1 : 0)
                                                                            }`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-black hover:scale-110 transition-transform shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                                                                         >
                                                                             <MapPin className="w-6 h-6" />
                                                                         </Link>
                                                                    )}
                                                                </div>

                                                                {/* Step Logistics */}
                                                                {Array.isArray(entry.objectives) && entry.objectives.length > 0 && (
                                                                    <div className="space-y-4">
                                                                        <div className="text-[11px] font-black text-zinc-600 uppercase tracking-[0.4em] px-1 italic">Logique de l'étape</div>
                                                                        <div className="space-y-3">
                                                                            {entry.objectives.map((obj: any, idx: number) => {
                                                                                const stepText = extractObjectiveText(obj);
                                                                                const isReturn = stepText.toLowerCase().includes("retour") || stepText.toLowerCase().includes("aller voir");
                                                                                return (
                                                                                    <div key={idx} className="flex gap-5 p-5 bg-white/[0.02] border border-white/5 rounded-[1.5rem] text-[14px] text-zinc-400 leading-relaxed font-bold">
                                                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-black ${isReturn ? "bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] animate-pulse" : "bg-white/10 text-white/40"}`}>
                                                                                            {idx + 1}
                                                                                        </div>
                                                                                        <div className={isReturn ? "text-white" : ""}>
                                                                                            <ParsedObjective text={obj} guildId={guildId} zone={selectedChain ? SECTION_TYPES[selectedChain.sectionType]?.label : undefined} />
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* V3 Structured Dungeons & Detected Dungeons */}
                                                                {hasDungeons && (
                                                                    <div className="space-y-3">
                                                                        {structuredDungeons.map((d, dx) => (
                                                                            <div key={`sd-${dx}`} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-[1.5rem] flex items-center gap-4">
                                                                                <div className="w-14 h-14 rounded-xl bg-black/60 border border-rose-500/20 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                                                                                    {d.img ? (
                                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                                        <img src={d.img} alt={d.name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                                                    ) : d.id ? (
                                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                                        <img src={`https://static.dofusdb.fr/monsters/${d.id}.png`} alt={d.name} className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                                                    ) : <span className="text-rose-400">🏰</span>}
                                                                                </div>
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-0.5">🏰 Donjon requis</div>
                                                                                    <div className="text-[15px] font-black text-white italic truncate">{d.name}</div>
                                                                                    <div className="flex items-center gap-2 mt-1 block">
                                                                                        {d.level && d.level > 0 && <span className="text-[9px] text-zinc-500 font-bold uppercase">Lvl {d.level}</span>}
                                                                                        {d.bossName && <span className="text-[9px] text-zinc-600 italic">— {d.bossName}</span>}
                                                                                        {d.idoleName && <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">{d.idoleName}</span>}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                        {structuredDungeons.length === 0 && dungeonInfos.map((di, dx) => (
                                                                            <div key={`di-${dx}`} className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-[1.5rem] flex items-center gap-4">
                                                                                {di.mapImg && (
                                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                                    <img src={di.mapImg} alt={di.dungeonName} className="w-14 h-14 object-cover rounded-xl border border-rose-500/30" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                                                )}
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-0.5">🏰 Donjon</div>
                                                                                    <div className="text-[15px] font-black text-white italic">{di.dungeonName}</div>
                                                                                </div>
                                                                                {di.x !== undefined && (
                                                                                    <Link href={`/dashboard/${guildId}/worldmap?x=${di.x}&y=${di.y}&zoom=4&world=${di.worldId ?? 0}`} className="h-10 w-10 rounded-xl bg-rose-500 text-black flex items-center justify-center hover:scale-110 transition-transform flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                                                        <MapPin className="w-5 h-5" />
                                                                                    </Link>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {/* Required Items Resource Block */}
                                                                {itemsReq.length > 0 && (
                                                                    <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-3xl">
                                                                        <div className="flex items-center gap-3 mb-4">
                                                                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                                                                                <Package className="w-4 h-4" />
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-[10px] font-black text-amber-400/70 uppercase tracking-widest">A prévoir pour cette quête</div>
                                                                                <div className="text-sm font-bold text-amber-400 italic">Ressources requises</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {itemsReq.map((req: any, index: number) => (
                                                                                <div key={index} className="flex items-center gap-2 bg-amber-500/10 px-3 py-1.5 rounded-[1rem] border border-amber-500/20">
                                                                                    <span className="text-[12px] font-black text-amber-500">x{req.amount || 1}</span>
                                                                                    <ItemInline itemId={req.id || String(req.id)} />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Guild Synergy */}
                                                                {synergy && synergy[entry.id] && synergy[entry.id].length > 0 && (
                                                                    <div className="p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl">
                                                                        <div className="flex items-center gap-3 mb-4">
                                                                            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                                                                <Users className="w-4 h-4" />
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-[10px] font-black text-emerald-400/70 uppercase tracking-widest">
                                                                                    Synergie de Guilde
                                                                                </div>
                                                                                <div className="text-sm font-bold text-emerald-400 italic">
                                                                                    Membres à cette étape
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {synergy[entry.id].map(m => (
                                                                                <div key={m.profileId} className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-[1rem] border border-emerald-500/20" title={m.status === "COMPLETED" ? "Déjà terminé (peut aider)" : "En cours"}>
                                                                                    {m.image ? (
                                                                                        <img src={m.image} alt={m.pseudo} className="w-5 h-5 rounded-full" />
                                                                                    ) : (
                                                                                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] text-emerald-400 font-black">
                                                                                            {m.pseudo[0]}
                                                                                        </div>
                                                                                    )}
                                                                                    <span className={`text-[12px] font-bold ${m.status === "COMPLETED" ? "text-emerald-400/60" : "text-emerald-400"}`}>
                                                                                        {m.pseudo} {m.status === "COMPLETED" && <Check className="w-3 h-3 inline-block ml-1 opacity-50" />}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Action Terminal */}
                                                                <div className="flex flex-col gap-4">
                                                                    <Button 
                                                                        disabled={lock && !done}
                                                                        onClick={(e) => { 
                                                                            e.stopPropagation(); 
                                                                            if (lock && !done) return;
                                                                            if (!done) setSelectedQuestId(null); // Auto-collapse on validation
                                                                            onToggleStatus(entry.id, done ? "NOT_STARTED" : "COMPLETED"); 
                                                                        }}
                                                                        className={`w-full h-14 rounded-2xl font-black italic uppercase text-[14px] transition-all tracking-widest ${
                                                                            done ? "bg-zinc-900 border border-white/10 text-zinc-400" 
                                                                            : lock ? "bg-zinc-950 text-white/10 border border-white/5 cursor-not-allowed"
                                                                            : "bg-white text-black hover:bg-zinc-200 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
                                                                        }`}
                                                                    >
                                                                        {done ? "Réinitialiser la progression" : lock ? "Quête Verrouillée" : "Valider l'étape de quête"}
                                                                    </Button>
                                                                    <div className="grid grid-cols-3 gap-4">
                                                                        <a href={`https://dofusdb.fr/fr/database/quest/${entry.dofusdbId || entry.id}`} target="_blank" className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl bg-white/5 border border-white/5 hover:bg-indigo-500/10 hover:border-indigo-500/30 text-[10px] font-black text-zinc-500 hover:text-indigo-400 uppercase tracking-widest transition-all"><Target className="w-5 h-5" /> DofusDB</a>
                                                                        <a href={entry.externalRef || `https://www.google.com/search?q=site:dofuspourlesnoobs.com+${encodeURIComponent(entry.name)}`} target="_blank" className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl bg-white/5 border border-white/5 hover:bg-amber-500/10 hover:border-amber-500/30 text-[10px] font-black text-zinc-500 hover:text-amber-400 uppercase tracking-widest transition-all"><BookOpen className="w-5 h-5" /> Noobs</a>
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (entry.coords) copyWithToast(`/travel ${entry.coords.x} ${entry.coords.y}`);
                                                                            }} 
                                                                            className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl bg-white/5 border border-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 p-0 text-[10px] font-black text-zinc-500 hover:text-emerald-400 uppercase tracking-widest transition-all"
                                                                        >
                                                                            <Copy className="w-5 h-5" /> Travel
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            </div>
    );
}
