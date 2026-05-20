"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Gem, Users, Search, Crown, Sparkles, RefreshCw, AlertTriangle, CheckCircle2, Compass, BookOpen, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DofusGemCard } from "./DofusGemCard";
import { GuildDofusOverview } from "./GuildDofusOverview";
import { SylvestreDonut } from "./SylvestreDonut";
import { forceRefreshOcre } from "@/server/actions/ocre-actions";
import { toast } from "sonner";
import type { DofusItemWithProgress, GuildDofusStats, MemberDofusSummary } from "@/server/actions/dofus-quest-actions";

type Tab = "terminal" | "guilde";

interface DofusQuestHubProps {
    dofusList: DofusItemWithProgress[];
    guildStats: { stats: GuildDofusStats[]; topMembers: MemberDofusSummary[]; totalMembers: number } | null;
    guides?: any[];
    guildId: string;
    selectedCharacter?: string;
    userProfile?: {
        metamobPseudo: string | null;
        metamobVerified: boolean;
        metamobLastSync: string | null;
        metamobQuestSlug: string | null;
    } | null;
    selectedGuideSlug?: string | null;
    selectedGuideDetail?: any | null;
    selectedGuideUserProgress?: any[] | null;
    selectedGuideGuildProgress?: any[] | null;
}

export function DofusQuestHub({ 
    dofusList, 
    guildStats, 
    guides = [], 
    guildId, 
    selectedCharacter = "PRINCIPAL",
    userProfile,
    selectedGuideSlug,
    selectedGuideDetail,
    selectedGuideUserProgress,
    selectedGuideGuildProgress
}: DofusQuestHubProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    
    const [activeTab, setActiveTab] = useState<Tab>((searchParams.get("tab") as Tab) || "terminal");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"Tous" | "Obtenus" | "En cours" | "À faire">("Tous");
    const [isSyncing, setIsSyncing] = useState(false);

    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", tab);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleGuideChange = (slug: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("guide", slug);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    useEffect(() => {
        const tab = searchParams.get("tab") as Tab;
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const sylvestre = dofusList.find(d => d.isMeta);
    const totalObtained = dofusList.filter((d) => d.isObtained).length;
    const overallPercent = dofusList.length > 0
        ? Math.round(dofusList.reduce((sum, d) => sum + d.progressPercent, 0) / dofusList.length)
        : 0;

    const normalDofusList = dofusList.filter(d => !d.isMeta);
    const totalNormalDofus = normalDofusList.length;
    const obtainedNormalDofus = normalDofusList.filter(d => d.isObtained).length;
    const gapToGoal = totalNormalDofus - obtainedNormalDofus;

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

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const result = await forceRefreshOcre(guildId);
            if (result.success) {
                if (result.data?.questUpdated) {
                    toast.success("🎉 Nouvelle quête détectée et mise à jour !");
                } else {
                    toast.success("Synchronisation Metamob réussie !");
                }
                setTimeout(() => window.location.reload(), 1000);
            } else {
                toast.error(result.error || "Erreur de synchronisation");
                setIsSyncing(false);
            }
        } catch (e) {
            toast.error("Erreur serveur lors de la synchronisation");
            setIsSyncing(false);
        }
    };

    // 💡 Insight Engine: Next Step validation based on active guide completion
    const nextStep = useMemo(() => {
        if (!selectedGuideDetail || !selectedGuideDetail.milestones) return null;
        
        // Find first uncompleted milestone
        const activeMilestone = selectedGuideDetail.milestones.find((m: any) => {
            const progress = selectedGuideUserProgress?.find(p => p.milestoneId === m.id);
            return !progress?.isCompleted;
        });

        if (!activeMilestone) {
            return {
                title: "Feuille de route complétée !",
                subtitle: "Félicitations, vous avez validé toutes les étapes !",
                type: "COMPLETED",
                guideName: selectedGuideDetail.name
            };
        }

        return {
            title: activeMilestone.title,
            subtitle: activeMilestone.subtitle || activeMilestone.description || "Étape active",
            type: activeMilestone.type,
            chapterLabel: activeMilestone.chapterLabel,
            chapter: activeMilestone.chapter,
            order: activeMilestone.order,
            guideName: selectedGuideDetail.name,
            id: activeMilestone.id,
            sequencesCount: activeMilestone.sequences?.length || 0,
        };
    }, [selectedGuideDetail, selectedGuideUserProgress]);

    const guideColor = useMemo(() => {
        if (!selectedGuideDetail?.slug) return "#6366f1";
        const correspondingDofus = dofusList.find(d => d.slug === selectedGuideDetail.slug);
        return correspondingDofus?.color || "#6366f1";
    }, [selectedGuideDetail, dofusList]);

    const guideStats = useMemo(() => {
        if (!selectedGuideDetail || !selectedGuideDetail.milestones) return null;
        const total = selectedGuideDetail.milestones.length;
        const completed = selectedGuideDetail.milestones.filter((m: any) => {
            const progress = selectedGuideUserProgress?.find(p => p.milestoneId === m.id);
            return progress?.isCompleted;
        }).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, percent };
    }, [selectedGuideDetail, selectedGuideUserProgress]);

    return (
        <div className="flex flex-col gap-8">
            {/* ── PERSISTENT COMMAND HEADER ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Meta-Goal: Sylvestre */}
                <div className="lg:col-span-12 xl:col-span-4 h-full">
                    {sylvestre && (
                        <SylvestreDonut 
                            sylvestre={sylvestre} 
                            allDofus={dofusList} 
                            guildId={guildId} 
                        />
                    )}
                </div>

                {/* Personal Stats & Progression */}
                <div className="lg:col-span-12 xl:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                    {/* Obtained inventory progress */}
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
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-1">Inventaire Reliques</p>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 mt-2">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(totalObtained / dofusList.length) * 100}%` }}
                                    className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                />
                            </div>
                         </div>
                    </div>

                    {/* Overall Efficiency */}
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

                {/* Metamob Synchronization Status Block */}
                <div className="lg:col-span-12 xl:col-span-4 h-full">
                    <div className="group relative bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6 flex flex-col justify-between overflow-hidden shadow-2xl h-full">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Synchronisation Metamob</span>
                                {userProfile?.metamobPseudo ? (
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-lg font-black text-white tracking-tight">{userProfile.metamobPseudo}</span>
                                        {userProfile.metamobVerified ? (
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                                                Vérifié
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[9px] font-black text-amber-400 uppercase tracking-widest">
                                                Non vérifié
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 mt-2 text-zinc-500">
                                        <AlertTriangle className="w-4 h-4 text-amber-500/80" />
                                        <span className="text-xs font-bold">Profil Metamob non configuré</span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleSync}
                                disabled={isSyncing || !userProfile?.metamobPseudo}
                                className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/30 text-zinc-400 hover:text-white transition-all disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-white/5 shrink-0"
                                title="Forcer la synchronisation avec Metamob"
                            >
                                <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin text-amber-500" : ""}`} />
                            </button>
                        </div>

                        <div className="flex items-end justify-between mt-auto">
                            <div className="text-left">
                                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-zinc-600 block">Dernière MAJ</span>
                                <span className="text-xs font-bold text-zinc-400 tabular-nums">
                                    {userProfile?.metamobLastSync 
                                        ? new Date(userProfile.metamobLastSync).toLocaleString("fr-FR", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            hour: "2-digit",
                                            minute: "2-digit"
                                          })
                                        : "Jamais"
                                    }
                                </span>
                            </div>

                            {gapToGoal > 0 ? (
                                <div className="text-right">
                                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-amber-500 block">Alerte Écart</span>
                                    <span className="text-xs font-black text-white italic">{gapToGoal} relique{gapToGoal > 1 ? "s" : ""} manquante{gapToGoal > 1 ? "s" : ""}</span>
                                </div>
                            ) : (
                                <div className="text-right">
                                    <span className="text-[9px] font-black uppercase tracking-[0.1em] text-emerald-400 block">Objectif Atteint</span>
                                    <span className="text-xs font-black text-emerald-400 italic">Prêt pour le Sylvestre</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── CENTRAL NAVIGATION BAR ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 border-b border-white/5 pb-6">
                {/* Segmented View Selector */}
                <div className="flex items-center gap-1.5 p-1.5 bg-black/60 border border-white/5 rounded-2xl shadow-2xl">
                    <button
                        onClick={() => handleTabChange("terminal")}
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "terminal" ? "bg-zinc-800 text-white shadow-xl shadow-black/60 ring-1 ring-white/10" : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                        📟 Terminal Tactique
                    </button>
                    <button
                        onClick={() => handleTabChange("guilde")}
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "guilde" ? "bg-zinc-800 text-white shadow-xl shadow-black/60 ring-1 ring-white/10" : "text-zinc-500 hover:text-zinc-300"}`}
                    >
                        👥 Progression Commune
                    </button>
                </div>

                {activeTab === "terminal" && (
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Filtrer les Dofus..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-black/60 border border-white/5 rounded-2xl pl-12 pr-6 py-3 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 w-full md:w-64 transition-all shadow-2xl shadow-black/40"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 p-1.5 bg-black/60 border border-white/5 rounded-2xl shadow-2xl">
                            {["Tous", "Obtenus", "En cours", "À faire"].map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setStatusFilter(f as any)}
                                    className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${statusFilter === f ? "bg-zinc-800 text-white shadow-xl shadow-black/60 ring-1 ring-white/10" : "text-zinc-600 hover:text-zinc-400"}`}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── CORE MISSION LAYOUT ── */}
            <div className="relative min-h-[500px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                    >
                        {activeTab === "terminal" && (
                            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch">
                                {/* Left Pane: Dofus Cards & Insight Banner (60% to 70% width) */}
                                <div className="xl:col-span-7 flex flex-col gap-6">
                                    {/* Insight Engine next-step banner */}
                                    {nextStep && (
                                        <div className="relative overflow-hidden bg-gradient-to-r from-zinc-950/70 via-indigo-950/20 to-zinc-950/70 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl">
                                            {/* Glow Accent */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[40px] pointer-events-none" />
                                            
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shrink-0">
                                                        <Compass className="w-6 h-6 animate-pulse" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Insight Engine</span>
                                                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-500">• Étape Suivante</span>
                                                            {nextStep.chapterLabel && (
                                                                <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-white/5 text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                                                                    {nextStep.chapterLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h4 className="text-lg font-black text-white tracking-tight mb-1">
                                                            {nextStep.title}
                                                        </h4>
                                                        <p className="text-xs font-bold text-zinc-400 leading-relaxed max-w-xl line-clamp-2">
                                                            {typeof nextStep.subtitle === "string" ? nextStep.subtitle.replace(/<[^>]*>?/gm, '') : nextStep.subtitle}
                                                        </p>
                                                    </div>
                                                </div>

                                                {nextStep.type !== "COMPLETED" && (
                                                    <button
                                                        onClick={() => {
                                                            router.push(`/dashboard/${guildId}/quetes-dofus/guide/${selectedGuideDetail?.slug}?milestone=${nextStep.id}`);
                                                        }}
                                                        className="px-5 py-3 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-black uppercase text-[10px] tracking-widest transition-all hover:scale-[1.02] shrink-0"
                                                    >
                                                        Consulter l'étape
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Dofus Cards Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                                        {filtered.length === 0 ? (
                                            <div className="col-span-full py-24 flex flex-col items-center justify-center gap-4 bg-zinc-950/20 border border-dashed border-white/5 rounded-[3rem]">
                                                <div className="p-6 rounded-full bg-white/5">
                                                    <Search className="w-12 h-12 text-zinc-800" />
                                                </div>
                                                <p className="text-zinc-600 font-black uppercase text-xs tracking-widest italic">Aucun Dofus ne correspond à ce filtre</p>
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
                                </div>

                                {/* Right Pane: Optimized Guide tracker HUD Card */}
                                <div className="xl:col-span-5 flex flex-col">
                                    {/* Guide selector header */}
                                    <div className="flex items-center justify-between gap-4 mb-4">
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Feuille de Route</span>
                                        {guides.length > 0 && (
                                            <div className="relative shrink-0">
                                                <select
                                                    value={selectedGuideSlug || ""}
                                                    onChange={(e) => handleGuideChange(e.target.value)}
                                                    className="appearance-none bg-black/60 border border-white/5 rounded-2xl pl-4 pr-10 py-2.5 text-xs text-white font-black uppercase tracking-wider focus:outline-none focus:border-indigo-500/50 cursor-pointer shadow-xl shadow-black/40 min-w-[200px]"
                                                >
                                                    {guides.map((g) => (
                                                        <option key={g.slug} value={g.slug}>
                                                            {g.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Guide HUD Card */}
                                    <div className="quest-hub-guide-wrapper h-[700px] border border-white/5 bg-zinc-950/40 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl flex flex-col p-6">
                                        {selectedGuideDetail ? (
                                            <div className="flex flex-col h-full justify-between">
                                                {/* Header & Lore */}
                                                <div>
                                                    <div className="flex items-center gap-3.5 mb-4">
                                                        <div 
                                                            className="p-3 rounded-2xl border"
                                                            style={{
                                                                background: `${guideColor}10`,
                                                                borderColor: `${guideColor}30`,
                                                                color: guideColor
                                                            }}
                                                        >
                                                            <BookOpen className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Aventure Active</span>
                                                            <h3 className="text-lg font-black text-white leading-tight tracking-tight mt-0.5">
                                                                {selectedGuideDetail.name}
                                                            </h3>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                                                        {selectedGuideDetail.description || `Progression détaillée et optimisation des quêtes pour l'obtention du Dofus ${selectedGuideDetail.name}.`}
                                                    </p>
                                                </div>

                                                {/* Middle: Progress stats */}
                                                {guideStats && (
                                                    <div className="my-6 p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Progression</span>
                                                            <span className="text-sm font-black text-white italic">
                                                                {guideStats.completed} / {guideStats.total} <span className="text-xs text-zinc-500 font-bold">étapes</span>
                                                            </span>
                                                        </div>
                                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
                                                            <motion.div 
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${guideStats.percent}%` }}
                                                                className="h-full rounded-full transition-all duration-500"
                                                                style={{
                                                                    background: `linear-gradient(90deg, ${guideColor}, #fbbf24)`,
                                                                    boxShadow: `0 0 10px ${guideColor}55`
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex items-center justify-between mt-2.5">
                                                            <span className="text-[9px] font-bold text-zinc-600">Completion</span>
                                                            <span className="text-xs font-black italic" style={{ color: guideColor }}>
                                                                {guideStats.percent}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Milestone list (scrollable) */}
                                                <div className="flex-1 overflow-y-auto pr-1 mb-6 flex flex-col gap-2 max-h-[300px] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                                                    {selectedGuideDetail.milestones?.map((m: any, idx: number) => {
                                                        const isCompleted = selectedGuideUserProgress?.find(p => p.milestoneId === m.id)?.isCompleted;
                                                        return (
                                                            <div 
                                                                key={m.id}
                                                                className={`p-3 rounded-xl border transition-all duration-300 flex items-center justify-between ${
                                                                    isCompleted 
                                                                        ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-400" 
                                                                        : "bg-white/[0.01] border-white/5 text-zinc-400"
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${isCompleted ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-zinc-800"}`} />
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 truncate">
                                                                            {m.chapterLabel || `Étape ${idx + 1}`}
                                                                        </span>
                                                                        <span className="text-xs font-bold text-zinc-300 truncate">
                                                                            {m.title}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                {isCompleted && (
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 shrink-0 ml-2">
                                                                        Validé
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Action CTA */}
                                                <button
                                                    onClick={() => {
                                                        router.push(`/dashboard/${guildId}/quetes-dofus/guide/${selectedGuideDetail.slug}`);
                                                    }}
                                                    className="w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all duration-300 flex items-center justify-center gap-2 text-white hover:scale-[1.01]"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${guideColor}dd, ${guideColor}99)`,
                                                        boxShadow: `0 4px 20px ${guideColor}33, inset 0 1px 0 rgba(255,255,255,0.2)`
                                                    }}
                                                >
                                                    📟 Démarrer l'Interface Immersive
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
                                                <BookOpen className="w-12 h-12 text-zinc-700 opacity-40" />
                                                <div>
                                                    <h4 className="text-white/60 font-black uppercase text-sm tracking-widest mb-1">Aucune feuille de route active</h4>
                                                    <p className="text-zinc-600 text-xs leading-relaxed max-w-xs">
                                                        Sélectionnez ou activez un guide optimisé ci-dessus pour charger votre progression.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
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
    );
}
