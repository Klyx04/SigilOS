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
import { QuestGuildStatus } from "./QuestGuildStatus";
import { QuestActionsBlock } from "./QuestActionsBlock";
import { toast } from "sonner";




interface DofusSuccessGridProps {
    guildId: string;
    dofus: any;
    chains: any[];
    synergy: Record<string, MemberOnQuest[]>;
    dofusColor: string;
    onToggleStatus: (questId: string, status: any) => void;
    completedIds: Set<string>;
    onDungeonClick?: (name: string, dofusdbIdVal: number | null) => void;
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
    onDungeonClick,
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
        const done = entries.filter((e: any) => completedIds.has(e.id) || (e.dofusdbId && completedIds.has(String(e.dofusdbId)))).length;
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

                        {/* Chain Cards (Parcours Pathway Timeline) */}
                        <div className="relative pl-8 sm:pl-12 border-l border-white/10 space-y-8 py-2">
                            {zoneChains.map((chain, chainIdx) => {
                                const stats = getChainStats(chain);
                                const isComplete = stats.done === stats.total && stats.total > 0;
                                const nextInChain = chain.entries?.find((e: any) => !completedIds.has(e.id) && !isLocked(e));

                                return (
                                    <div key={chain.id} className="relative group">
                                        {/* Timeline Connection Node */}
                                        <div 
                                            className={`absolute -left-[41px] sm:-left-[57px] top-6 w-5 h-5 rounded-full border-4 flex items-center justify-center transition-all duration-500 z-10 ${
                                                isComplete 
                                                    ? "bg-indigo-950 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]" 
                                                    : "bg-[#050608] border-zinc-700 group-hover:border-indigo-500"
                                            }`}
                                        >
                                            {isComplete ? (
                                                <Check className="w-2 h-2 text-indigo-400 stroke-[4px]" />
                                            ) : (
                                                <span className="text-[7px] font-black text-zinc-500 tabular-nums">{chainIdx + 1}</span>
                                            )}
                                        </div>

                                        <motion.button
                                            onClick={() => setSelectedChainId(chain.id)}
                                            whileHover={{ scale: 1.01, x: 6 }}
                                            whileTap={{ scale: 0.99 }}
                                            className={`w-full p-6 rounded-[2.5rem] border transition-all duration-500 flex flex-col sm:flex-row sm:items-center justify-between gap-6 text-left overflow-hidden ${
                                                isComplete 
                                                    ? "bg-indigo-950/10 border-indigo-500/20 hover:border-indigo-500/40 shadow-[0_0_40px_rgba(99,102,241,0.05)]" 
                                                    : "bg-white/[0.01] border-white/5 hover:border-white/20 active:bg-white/[0.02]"
                                            }`}
                                        >
                                            <div className="flex flex-col gap-3 max-w-xl">
                                                <div className="flex items-center gap-3">
                                                    <img 
                                                        src="/assets/icons/succes.png" 
                                                        alt="Succès" 
                                                        className={`w-6 h-6 object-contain transition-all duration-300 ${
                                                            isComplete ? "drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" : "opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-85"
                                                        }`} 
                                                    />
                                                    <Badge 
                                                        variant="outline" 
                                                        className={`text-[9px] font-black py-0.5 px-2 rounded-lg border transition-all ${
                                                            isComplete 
                                                                ? "bg-indigo-500/10 text-indigo-450 border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.15)]" 
                                                                : "bg-white/5 text-zinc-500 border-white/5"
                                                        }`}
                                                    >
                                                        {isComplete ? "✓ Succès Complété" : `Étape ${chainIdx + 1}`}
                                                    </Badge>
                                                </div>
                                                <div>
                                                    <h3 className={`text-xl font-black italic leading-none uppercase tracking-tighter transition-colors ${
                                                        isComplete ? "text-indigo-400" : "text-white group-hover:text-indigo-400"
                                                    }`}>{chain.sectionName}</h3>
                                                    {nextInChain && !isComplete && (
                                                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-2 truncate flex items-center gap-1.5">
                                                            <span className="text-indigo-400 font-black">→ Suivant:</span> {nextInChain.name}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-start sm:items-end gap-3 shrink-0 min-w-[200px] w-full sm:w-auto">
                                                <div className="flex items-center justify-between w-full text-[11px] font-black uppercase tracking-widest text-zinc-500">
                                                    <span>Progression</span>
                                                    <span className={`tabular-nums font-black ${isComplete ? "text-indigo-400" : "text-white"}`}>{stats.done}/{stats.total} quêtes</span>
                                                </div>
                                                <div className="w-full sm:w-48 h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-inner relative">
                                                    <div 
                                                        className="h-full rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(255,255,255,0.05)]" 
                                                        style={{ 
                                                            background: isComplete ? "#6366f1" : zoneColor, 
                                                            width: `${stats.pct}%` 
                                                        }} 
                                                    />
                                                </div>
                                            </div>
                                        </motion.button>
                                    </div>
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
                        <div className="flex items-center gap-4">
                            <img src="/assets/icons/succes.png" alt="Succès" className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                            <div>
                                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-1">
                                    {selectedChain ? (SECTION_TYPES[selectedChain.sectionType]?.label || "Exploration") : ""}
                                </div>
                                <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                                    {selectedChain?.sectionName}
                                </h3>
                            </div>
                        </div>

                        {selectedChain && (
                            <Button
                                onClick={async () => {
                                    const entries = selectedChain.entries || [];
                                    const allCompleted = entries.every((e: any) => completedIds.has(e.id));
                                    const targetStatus = allCompleted ? "NOT_STARTED" : "COMPLETED";
                                    
                                    toast.loading(targetStatus === "COMPLETED" ? "Validation du succès..." : "Annulation du succès...", { id: "toggle-all-success" });
                                    try {
                                        for (const entry of entries) {
                                            if (completedIds.has(entry.id) !== (targetStatus === "COMPLETED")) {
                                                await onToggleStatus(entry.id, targetStatus);
                                            }
                                        }
                                        toast.success(targetStatus === "COMPLETED" ? "Succès validé !" : "Succès réinitialisé !", { id: "toggle-all-success" });
                                    } catch (e) {
                                        toast.error("Erreur lors de la mise à jour globale", { id: "toggle-all-success" });
                                    }
                                }}
                                variant="outline"
                                className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 font-black uppercase text-[10px] tracking-wider rounded-xl px-4 py-2"
                            >
                                {selectedChain.entries?.every((e: any) => completedIds.has(e.id)) ? "Tout Décocher" : "Tout Cocher"}
                            </Button>
                        )}
                    </div>

                    <ScrollArea className="flex-1 w-full overflow-y-auto">
                        <div className="p-8 space-y-6">
                            {selectedChain?.entries?.map((entry: any, i: number) => {
                                    const done = completedIds.has(entry.id) || (entry.dofusdbId && completedIds.has(String(entry.dofusdbId)));
                                    const lock = isLocked(entry);
                                    const expanded = selectedQuestId === entry.id;

                                    return (
                                        <div key={entry.id} className="space-y-4">
                                            <div
                                                onClick={() => setSelectedQuestId(expanded ? null : entry.id)}
                                                className={`w-full p-6 rounded-[2rem] border text-left transition-all duration-300 relative overflow-hidden cursor-pointer ${
                                                    done ? "bg-indigo-950/15 border-indigo-500/20 hover:border-indigo-500/40 shadow-[0_0_30px_rgba(99,102,241,0.03)]" 
                                                    : lock ? "bg-zinc-900/20 border-white/5 opacity-40 grayscale"
                                                    : expanded ? "bg-white/5 border-white/25 shadow-2xl"
                                                    : "bg-zinc-900/40 border-white/5 hover:border-white/15"
                                                }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-[14px] transition-all ${
                                                        done ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.2)]" : "bg-white/5 text-zinc-500"
                                                    }`}>
                                                        {done ? <Check className="w-5 h-5 stroke-[3px]" /> : lock ? <Lock className="w-5 h-5" /> : i + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`text-[17px] font-black italic uppercase tracking-tighter truncate transition-all ${done ? "line-through text-zinc-650" : "text-white"}`}>
                                                            {entry.name}
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                            {entry.level && <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-xl">Lvl {entry.level}</span>}
                                                            {lock && !done && <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">Quête verrouillée</span>}
                                                        </div>
                                                    </div>
                                                    <ChevronRight className={`w-6 h-6 text-zinc-700 transition-transform ${expanded ? "rotate-90 text-white" : ""}`} />
                                                </div>

                                                <AnimatePresence>
                                                    {expanded && (
                                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                                            <div className="pt-6 mt-6 border-t border-white/5">
                                                                {/* Action Terminal */}
                                                                <QuestActionsBlock
                                                                    entry={entry}
                                                                    guildId={guildId}
                                                                    dofusColor={dofusColor}
                                                                    initialMembers={synergy[entry.id] ?? []}
                                                                    lock={lock}
                                                                    done={done}
                                                                    onToggle={() => {
                                                                        if (!done) setSelectedQuestId(null);
                                                                        onToggleStatus(entry.id, done ? "NOT_STARTED" : "COMPLETED");
                                                                    }}
                                                                />
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
