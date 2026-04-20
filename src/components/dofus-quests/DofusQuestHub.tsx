"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Gem, Users, Search, Crown, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DofusGemCard } from "./DofusGemCard";
import { GuildDofusOverview } from "./GuildDofusOverview";
import { SylvestreDonut } from "./SylvestreDonut";
import { OptimizedGuideTab } from "./OptimizedGuideTab";
import type { DofusItemWithProgress, GuildDofusStats, MemberDofusSummary, WarRoomData } from "@/server/actions/dofus-quest-actions";

type Tab = "mes-dofus" | "routes" | "guilde";

interface DofusQuestHubProps {
    dofusList: DofusItemWithProgress[];
    guildStats: { stats: GuildDofusStats[]; topMembers: MemberDofusSummary[]; totalMembers: number } | null;
    guides?: any[];
    guildId: string;
    selectedCharacter?: string;
}

export function DofusQuestHub({ dofusList, guildStats, guides = [], guildId, selectedCharacter = "PRINCIPAL" }: DofusQuestHubProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    
    const [activeTab, setActiveTab] = useState<Tab>((searchParams.get("tab") as Tab) || "mes-dofus");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"Tous" | "Obtenus" | "En cours" | "À faire">("Tous");

    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    useEffect(() => {
        const tab = searchParams.get("tab") as Tab;
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const tabs: { id: Tab; label: string; icon: React.ElementType; desc: string }[] = [
        { id: "mes-dofus", label: "Mes Dofus", icon: Gem, desc: "État des reliques" },
        { id: "routes", label: "Guide Optimisé", icon: Sparkles, desc: "Routes stratégiques" },
        { id: "guilde", label: "Guilde", icon: Users, desc: "Progression commune" },
    ];

    const sylvestre = dofusList.find(d => d.isMeta);
    const totalObtained = dofusList.filter((d) => d.isObtained).length;
    const overallPercent = dofusList.length > 0
        ? Math.round(dofusList.reduce((sum, d) => sum + d.progressPercent, 0) / dofusList.length)
        : 0;

    const filtered = dofusList
        .filter((d) => {
            if (search) {
                return d.name.toLowerCase().includes(search.toLowerCase()) ||
                    d.nameShort.toLowerCase().includes(search.toLowerCase());
            }
            return true;
        })
        .filter((d) => {
            switch (statusFilter) {
                case "Obtenus": return d.isObtained;
                case "En cours": return !d.isObtained && d.progressPercent > 0;
                case "À faire": return !d.isObtained && d.progressPercent === 0;
                default: return true;
            }
        });

    return (
        <div className="flex flex-col gap-8">
            {/* ── PERSISTENT COMMAND HEADER ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Meta-Goal: Sylvestre */}
                <div className="lg:col-span-12 xl:col-span-5 h-full">
                    {sylvestre && (
                        <SylvestreDonut 
                            sylvestre={sylvestre} 
                            allDofus={dofusList} 
                            guildId={guildId} 
                        />
                    )}
                </div>

                {/* Personal Stats Hub */}
                <div className="lg:col-span-12 xl:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                    <div className="group relative bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col justify-between overflow-hidden shadow-2xl">
                         <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                         <div className="relative flex items-center justify-between mb-4">
                            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                <Crown className="w-6 h-6" />
                            </div>
                            <span className="text-4xl font-black text-white tabular-nums italic tracking-tighter">
                                {totalObtained}<span className="text-zinc-500 text-sm ml-2 font-black italic">/ {dofusList.length}</span>
                            </span>
                         </div>
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-1">Inventaire Personnel</p>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 mt-2">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(totalObtained / dofusList.length) * 100}%` }}
                                    className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                />
                            </div>
                         </div>
                    </div>

                    <div className="group relative bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col justify-between overflow-hidden shadow-2xl">
                         <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                         <div className="relative flex items-center justify-between mb-4">
                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <span className="text-4xl font-black text-white tabular-nums italic tracking-tighter">
                                {overallPercent}<span className="text-emerald-500 text-sm ml-1 font-black italic">%</span>
                            </span>
                         </div>
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-1">Efficacité Globale</p>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 mt-2">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${overallPercent}%` }}
                                    className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                                />
                            </div>
                         </div>
                    </div>
                </div>
            </div>

            {/* ── CORE MISSION LAYOUT ── */}
            <div className="flex flex-col lg:flex-row gap-8 items-start min-h-[700px]">
                {/* VERTICAL NAV SIDEBAR */}
                <div className="w-full lg:w-72 shrink-0 flex flex-col gap-2 p-3 bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] shadow-2xl">
                    <div className="px-5 py-4 mb-2 flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500">Navigation</span>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    </div>
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`
                                    w-full group relative flex items-center gap-4 px-5 py-5 rounded-[1.5rem] transition-all duration-300
                                    ${isActive 
                                        ? "bg-white/[0.04] border border-white/5 shadow-inner" 
                                        : "hover:bg-white/[0.02] border border-transparent"}
                                `}
                            >
                                {isActive && (
                                    <motion.div 
                                        layoutId="active-nav-glow"
                                        className="absolute left-0 w-1.5 h-10 bg-indigo-500 rounded-full blur-[3px]" 
                                    />
                                )}
                                <div className={`p-3 rounded-2xl transition-all duration-500 ${isActive ? 'bg-indigo-500 text-white scale-110 shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'bg-black/60 text-zinc-600 group-hover:text-zinc-400 group-hover:bg-zinc-900'}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col items-start text-left min-w-0">
                                    <span className={`text-[12px] font-black uppercase tracking-[0.1em] ${isActive ? 'text-white italic' : 'text-zinc-500'}`}>
                                        {tab.label}
                                    </span>
                                    <span className={`text-[10px] font-bold truncate w-full ${isActive ? 'text-indigo-400/70' : 'text-zinc-700'}`}>
                                        {tab.desc}
                                    </span>
                                </div>
                            </button>
                        );
                    })}

                    <div className="mt-auto px-5 py-6">
                        {/* Empty space for better balance or future character-specific stats */}
                    </div>
                </div>

                {/* MAIN DASHBOARD CONTENT */}
                <div className="flex-1 w-full flex flex-col gap-8">
                    {/* View Toolbar */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1 border-b border-white/5 pb-8">
                        <div className="flex flex-col">
                            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-2xl">
                                {tabs.find(t => t.id === activeTab)?.label}
                            </h2>
                        </div>

                        {activeTab === "mes-dofus" && (
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Localiser un artefact..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="bg-black/60 border border-white/5 rounded-2xl pl-12 pr-6 py-3.5 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 w-full md:w-80 transition-all shadow-2xl shadow-black/40"
                                    />
                                </div>

                                <div className="flex items-center gap-1.5 p-1.5 bg-black/60 border border-white/5 rounded-2xl shadow-2xl">
                                    {["Tous", "Obtenus", "En cours", "À faire"].map((f) => (
                                        <button
                                            key={f}
                                            onClick={() => setStatusFilter(f as any)}
                                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === f ? "bg-zinc-800 text-white shadow-xl shadow-black/60 ring-1 ring-white/10" : "text-zinc-600 hover:text-zinc-400"}`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                            >
                                {activeTab === "mes-dofus" && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {filtered.length === 0 ? (
                                            <div className="col-span-full py-32 flex flex-col items-center justify-center gap-4 bg-zinc-950/20 border border-dashed border-white/5 rounded-[3rem]">
                                                <div className="p-6 rounded-full bg-white/5">
                                                    <Search className="w-12 h-12 text-zinc-800" />
                                                </div>
                                                <p className="text-zinc-600 font-black uppercase text-xs tracking-widest italic">Aucune transmission ne correspond à ce filtre</p>
                                            </div>
                                        ) : (
                                            filtered.map((dofus) => (
                                                <DofusGemCard 
                                                    key={dofus.id} 
                                                    dofus={dofus} 
                                                    guildId={guildId} 
                                                    selectedCharacter={selectedCharacter} 
                                                />
                                            ))
                                        )}
                                    </div>
                                )}

                                {activeTab === "routes" && (
                                    <div className="bg-zinc-950/20 rounded-[3rem] p-4 border border-white/5 shadow-2xl min-h-[500px]">
                                        <OptimizedGuideTab initialGuides={guides} guildId={guildId} />
                                    </div>
                                )}

                                {activeTab === "guilde" && (
                                    <div className="bg-zinc-950/20 rounded-[3rem] p-1 border border-white/5 shadow-2xl">
                                        <GuildDofusOverview 
                                            stats={guildStats?.stats || []} 
                                            topMembers={guildStats?.topMembers || []}
                                            totalMembers={guildStats?.totalMembers || 0}
                                            guildId={guildId}
                                        />
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
