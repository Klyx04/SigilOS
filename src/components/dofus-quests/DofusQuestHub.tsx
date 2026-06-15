"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Gem, Users, Search, Crown, Sparkles, RefreshCw, AlertTriangle, CheckCircle2, Compass, BookOpen, ChevronDown, Trophy, ChevronLeft, ArrowRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DofusGemCard } from "./DofusGemCard";
import { GuildDofusOverview } from "./GuildDofusOverview";
import { SylvestreDonut } from "./SylvestreDonut";
import { forceRefreshOcre } from "@/server/actions/ocre-actions";
import { getMemberAllGuidesProgress } from "@/server/actions/optimized-guide-actions";
import { toast } from "sonner";
import type { DofusItemWithProgress, GuildDofusStats, MemberDofusSummary } from "@/server/actions/dofus-quest-actions";

type Tab = "menu" | "dofus" | "guide" | "guilde";

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
    
    const [activeTab, setActiveTab] = useState<Tab>((searchParams.get("tab") as Tab) || "menu");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"Tous" | "Obtenus" | "En cours" | "À faire">("Tous");
    const [isSyncing, setIsSyncing] = useState(false);
    const [guildSubTab, setGuildSubTab] = useState<"dofus" | "guide">("dofus");
    // Member detail modal state
    const [selectedMember, setSelectedMember] = useState<{ profileId: string; pseudo: string; avatarUrl?: string } | null>(null);
    const [memberGuideProgress, setMemberGuideProgress] = useState<any[]>([]);
    const [isMemberLoading, setIsMemberLoading] = useState(false);
    // Guide leaderboard search
    const [guideMemberSearch, setGuideMemberSearch] = useState("");

    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        if (tab === "menu") {
            params.delete("tab");
        } else {
            params.set("tab", tab);
        }
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleGuideChange = (slug: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("guide", slug);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleMemberClick = async (profileId: string, pseudo: string, avatarUrl?: string) => {
        setSelectedMember({ profileId, pseudo, avatarUrl });
        setMemberGuideProgress([]);
        setIsMemberLoading(true);
        try {
            const res = await getMemberAllGuidesProgress(profileId, guildId);
            if (res.success) setMemberGuideProgress(res.guideProgress ?? []);
        } catch (e) {
            console.error("[handleMemberClick] error:", e);
        } finally {
            setIsMemberLoading(false);
        }
    };

    useEffect(() => {
        const tab = searchParams.get("tab") as Tab;
        if (tab) {
            if (tab !== activeTab) {
                setActiveTab(tab);
            }
        } else {
            setActiveTab("menu");
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

    const membersGuideProgress = useMemo(() => {
        if (!selectedGuideDetail || !selectedGuideDetail.milestones || !selectedGuideGuildProgress) return [];
        
        const totalMilestones = selectedGuideDetail.milestones.length;
        if (totalMilestones === 0) return [];
        
        const progressByProfile: Record<string, {
            profileId: string;
            userName: string;
            userAvatar?: string;
            profileSlug: string;
            completedCount: number;
            completedMilestoneIds: Set<string>;
        }> = {};
        
        selectedGuideGuildProgress.forEach((p: any) => {
            if (!progressByProfile[p.profileId]) {
                progressByProfile[p.profileId] = {
                    profileId: p.profileId,
                    userName: p.userName,
                    userAvatar: p.userAvatar,
                    profileSlug: p.profileSlug,
                    completedCount: 0,
                    completedMilestoneIds: new Set<string>()
                };
            }
            if (p.isCompleted) {
                progressByProfile[p.profileId].completedCount++;
                progressByProfile[p.profileId].completedMilestoneIds.add(p.milestoneId);
            }
        });
        
        return Object.values(progressByProfile)
            .map(member => {
                const percent = Math.round((member.completedCount / totalMilestones) * 100);
                
                // Le tableau des milestones est ordonné, on cherche le premier non complété
                const activeMilestone = selectedGuideDetail.milestones.find((m: any) => 
                    !member.completedMilestoneIds.has(m.id)
                );
                
                return {
                    profileId: member.profileId,
                    userName: member.userName,
                    userAvatar: member.userAvatar,
                    profileSlug: member.profileSlug,
                    completedCount: member.completedCount,
                    percent,
                    activeMilestone: activeMilestone ? {
                        id: activeMilestone.id,
                        title: activeMilestone.title,
                        order: activeMilestone.order
                    } : null
                };
            })
            .sort((a, b) => b.completedCount - a.completedCount);
    }, [selectedGuideDetail, selectedGuideGuildProgress]);

    return (
        <div className="flex flex-col gap-8">
            {/* ── PERSISTENT COMMAND HEADER ── */}
            <div className="flex justify-center items-stretch">
                {/* Meta-Goal: Sylvestre (Centered, premium size) */}
                <div className="w-full max-w-2xl">
                    {sylvestre && (
                        <SylvestreDonut 
                            sylvestre={sylvestre} 
                            allDofus={dofusList} 
                            guildId={guildId} 
                        />
                    )}
                </div>
            </div>

            {activeTab !== "menu" && (
                <button
                    onClick={() => handleTabChange("menu")}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors self-start mb-2 group pl-1"
                >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Retour aux fonctionnalités
                </button>
            )}

            {/* ── CENTRAL NAVIGATION BAR ── */}
            {activeTab !== "menu" && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-1 border-b border-white/5 pb-6">
                    {/* Segmented View Selector */}
                    <div className="flex items-center gap-1.5 p-1.5 bg-black/60 border border-white/5 rounded-2xl shadow-2xl">
                        <button
                            onClick={() => handleTabChange("dofus")}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "dofus" ? "bg-zinc-800 text-white shadow-xl shadow-black/60 ring-1 ring-white/10" : "text-zinc-500 hover:text-zinc-300"}`}
                        >
                            💎 Suivi des Dofus
                        </button>
                        <button
                            onClick={() => {
                                const slug = selectedGuideSlug || guides[0]?.slug;
                                if (slug) {
                                    router.push(`/dashboard/${guildId}/quetes-dofus/guide/${slug}`);
                                }
                            }}
                            className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-zinc-500 hover:text-zinc-300"
                        >
                            🗺️ Guide Complet
                        </button>
                        <button
                            onClick={() => handleTabChange("guilde")}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "guilde" ? "bg-zinc-800 text-white shadow-xl shadow-black/60 ring-1 ring-white/10" : "text-zinc-500 hover:text-zinc-300"}`}
                        >
                            👥 Progression Commune
                        </button>
                    </div>

                    {activeTab === "dofus" && (
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
            )}

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
                        {activeTab === "menu" && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* CARD 1: Suivi des Dofus */}
                                <motion.div
                                    whileHover={{ scale: 1.02, translateY: -4 }}
                                    onClick={() => handleTabChange("dofus")}
                                    className="group relative flex flex-col justify-between p-6 min-h-[320px] bg-gradient-to-br from-zinc-950 via-emerald-950/20 to-zinc-950 border border-emerald-500/20 hover:border-emerald-500/40 rounded-3xl cursor-pointer shadow-2xl transition-all duration-300"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] pointer-events-none rounded-full" />
                                    
                                    <div className="space-y-4">
                                        <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit group-hover:scale-110 transition-transform duration-500">
                                            <Gem className="w-6 h-6 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-white italic uppercase tracking-wider mb-1">
                                                Suivi des Dofus
                                            </h3>
                                            <p className="text-xs font-semibold text-zinc-400 leading-relaxed">
                                                Suis la progression de tes quêtes de Dofus primordiaux et majeurs étape par étape.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-6 border-t border-white/5">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            <span className="text-zinc-500">Obtenus :</span>
                                            <span className="text-emerald-400 font-black italic">{totalObtained} / 12 Dofus</span>
                                        </div>
                                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                                            <div 
                                                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                                style={{ width: `${Math.min(100, (totalObtained / 12) * 100)}%` }} 
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-400 pt-2">
                                            Accéder au Suivi 
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
                                        </div>
                                    </div>
                                </motion.div>

                                {/* CARD 2: Guide Complet */}
                                <motion.div
                                    whileHover={{ scale: 1.02, translateY: -4 }}
                                    onClick={() => {
                                        const slug = selectedGuideSlug || guides[0]?.slug;
                                        if (slug) {
                                            router.push(`/dashboard/${guildId}/quetes-dofus/guide/${slug}`);
                                        }
                                    }}
                                    className="group relative flex flex-col justify-between p-6 min-h-[320px] bg-gradient-to-br from-zinc-950 via-indigo-950/20 to-zinc-950 border border-indigo-500/20 hover:border-indigo-500/40 rounded-3xl cursor-pointer shadow-2xl transition-all duration-300"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] pointer-events-none rounded-full" />
                                    
                                    <div className="space-y-4">
                                        <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 w-fit group-hover:scale-110 transition-transform duration-500">
                                            <Compass className="w-6 h-6 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-white italic uppercase tracking-wider mb-1">
                                                Guide Complet
                                            </h3>
                                            <p className="text-xs font-semibold text-zinc-400 leading-relaxed">
                                                Suis le chemin le plus rapide rédigé et optimisé par le staff pour obtenir tes Dofus.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-6 border-t border-white/5">
                                        {selectedGuideDetail ? (
                                            <>
                                                <div className="flex items-center justify-between text-xs font-bold">
                                                    <span className="text-zinc-500 truncate max-w-[150px]">Actif : {selectedGuideDetail.name}</span>
                                                    <span className="text-indigo-400 font-black italic">{guideStats?.percent}%</span>
                                                </div>
                                                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                                                    <div 
                                                        className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                                                        style={{ width: `${guideStats?.percent || 0}%` }} 
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                                                Aucun guide actif en ce moment
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-400 pt-2">
                                            Consulter les Guides
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
                                        </div>
                                    </div>
                                </motion.div>

                                {/* CARD 3: Progression Commune */}
                                <motion.div
                                    whileHover={{ scale: 1.02, translateY: -4 }}
                                    onClick={() => handleTabChange("guilde")}
                                    className="group relative flex flex-col justify-between p-6 min-h-[320px] bg-gradient-to-br from-zinc-950 via-amber-950/20 to-zinc-950 border border-amber-500/20 hover:border-amber-500/40 rounded-3xl cursor-pointer shadow-2xl transition-all duration-300"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] pointer-events-none rounded-full" />
                                    
                                    <div className="space-y-4">
                                        <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 w-fit group-hover:scale-110 transition-transform duration-500">
                                            <Users className="w-6 h-6 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-white italic uppercase tracking-wider mb-1">
                                                Progression Commune
                                            </h3>
                                            <p className="text-xs font-semibold text-zinc-400 leading-relaxed">
                                                Compare ta progression et observe l'avancement global de tous les membres de la guilde.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-6 border-t border-white/5">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            <span className="text-zinc-500">Membres engagés :</span>
                                            <span className="text-amber-400 font-black italic">{membersGuideProgress.length}</span>
                                        </div>
                                        <div className="flex items-center -space-x-2 overflow-hidden py-1">
                                            {membersGuideProgress.slice(0, 5).map((member, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className="inline-block h-6 w-6 rounded-full ring-2 ring-zinc-950 bg-zinc-800 overflow-hidden"
                                                    title={member.userName}
                                                >
                                                    {member.userAvatar ? (
                                                        <img src={member.userAvatar} alt={member.userName} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="text-[9px] font-black text-zinc-500 flex items-center justify-center h-full">{member.userName.charAt(0).toUpperCase()}</span>
                                                    )}
                                                </div>
                                            ))}
                                            {membersGuideProgress.length > 5 && (
                                                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-zinc-900 ring-2 ring-zinc-950 text-[9px] font-black text-zinc-500">
                                                    +{membersGuideProgress.length - 5}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-400 pt-2">
                                            Voir la Progression
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                        {activeTab === "dofus" && (
                            <div className="flex flex-col gap-6">
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

                                {/* Dofus Cards Grid (Full Width) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
                        )}

                        {activeTab === "guide" && (
                            <div className="flex flex-col gap-6 max-w-4xl mx-auto">
                                {/* Guide selector header */}
                                <div className="flex items-center justify-between gap-4">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Guide Complet</span>
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

                                {/* Guide HUD Card (Pleine Largeur) */}
                                <div className="quest-hub-guide-wrapper min-h-[500px] border border-white/5 bg-zinc-950/40 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl flex flex-col p-8">
                                    {selectedGuideDetail ? (
                                        <div className="flex flex-col h-full justify-between gap-6">
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
                                                        <h3 className="text-xl font-black text-white leading-tight tracking-tight mt-0.5">
                                                            {selectedGuideDetail.name}
                                                        </h3>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-zinc-400 leading-relaxed font-semibold">
                                                    {selectedGuideDetail.description || `Progression détaillée et optimisation des quêtes pour l'obtention du Dofus ${selectedGuideDetail.name}.`}
                                                </p>
                                            </div>

                                            {/* Middle: Progress stats */}
                                            {guideStats && (
                                                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Progression</span>
                                                        <span className="text-sm font-black text-white italic">
                                                            {guideStats.completed} / {guideStats.total} <span className="text-xs text-zinc-500 font-bold">étapes</span>
                                                        </span>
                                                    </div>
                                                    <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 relative">
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
                                            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 max-h-[400px] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                                                {selectedGuideDetail.milestones?.map((m: any, idx: number) => {
                                                    const isCompleted = selectedGuideUserProgress?.find(p => p.milestoneId === m.id)?.isCompleted;
                                                    return (
                                                        <div 
                                                            key={m.id}
                                                            className={`p-4 rounded-xl border transition-all duration-300 flex items-center justify-between ${
                                                                isCompleted 
                                                                    ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-400" 
                                                                    : "bg-white/[0.01] border-white/5 text-zinc-400 hover:border-white/10"
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCompleted ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-zinc-800"}`} />
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 truncate">
                                                                        {m.chapterLabel || `Étape ${idx + 1}`}
                                                                    </span>
                                                                    <span className="text-sm font-bold text-zinc-300 truncate">
                                                                        {m.title}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {isCompleted && (
                                                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 shrink-0 ml-2">
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
                                        <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-16">
                                            <BookOpen className="w-12 h-12 text-zinc-700 opacity-40" />
                                            <div>
                                                <h4 className="text-white/60 font-black uppercase text-sm tracking-widest mb-1">Aucune feuille de route active</h4>
                                                <p className="text-zinc-600 text-xs leading-relaxed max-w-xs">
                                                    Sélectionnez ou activez un guide complet ci-dessus pour charger votre progression.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === "guilde" && (
                            <div className="flex flex-col gap-6">
                                {/* Sub-navigation for Progression Commune */}
                                <div className="flex flex-col gap-4 border-b border-white/5 pb-5">
                                    <div className="flex items-center gap-1.5 p-1 bg-black/60 border border-white/5 rounded-2xl shadow-xl self-start">
                                        <button
                                            onClick={() => setGuildSubTab("dofus")}
                                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${guildSubTab === "dofus" ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"}`}
                                        >
                                            👑 Quêtes par Dofus
                                        </button>
                                        <button
                                            onClick={() => setGuildSubTab("guide")}
                                            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${guildSubTab === "guide" ? "bg-zinc-800 text-white shadow" : "text-zinc-500 hover:text-zinc-300"}`}
                                        >
                                            🗺️ Progression des Guides
                                        </button>
                                    </div>

                                    {/* ── SÉLECTEUR DE GUIDE PREMIUM (remplace le native select) ── */}
                                    {guildSubTab === "guide" && guides.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {guides.map((g) => {
                                                const isActive = selectedGuideSlug === g.slug;
                                                const correspondingDofus = dofusList.find(d => d.slug === g.slug);
                                                const color = correspondingDofus?.color || "#6366f1";
                                                return (
                                                    <button
                                                        key={g.slug}
                                                        onClick={() => handleGuideChange(g.slug)}
                                                        className={`group relative flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-left transition-all duration-300 ${
                                                            isActive
                                                                ? "border-white/20 bg-white/[0.06] shadow-lg"
                                                                : "border-white/5 bg-black/40 hover:border-white/10 hover:bg-white/[0.03]"
                                                        }`}
                                                        style={isActive ? { boxShadow: `0 0 20px ${color}25, inset 0 0 20px ${color}08` } : {}}
                                                    >
                                                        {/* Dofus icon */}
                                                        <div
                                                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
                                                            style={{ background: `${color}20`, border: `1px solid ${color}40` }}
                                                        >
                                                            {correspondingDofus?.imageUrl ? (
                                                                <img
                                                                    src={correspondingDofus.slug === "dofoozbz"
                                                                        ? "/module-dofus/Dofus_dofoozbz.png"
                                                                        : correspondingDofus.imageUrl.replace(/^\/public/, "")}
                                                                    alt={g.name}
                                                                    className="w-5 h-5 object-contain"
                                                                />
                                                            ) : (
                                                                <span className="text-[10px] font-black" style={{ color }}>◆</span>
                                                            )}
                                                        </div>
                                                        <span
                                                            className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${
                                                                isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                                                            }`}
                                                        >
                                                            {g.name}
                                                        </span>
                                                        {isActive && (
                                                            <div
                                                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                                                            />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {guildSubTab === "dofus" ? (
                                    <div className="bg-zinc-950/20 rounded-[3rem] p-1 border border-white/5 shadow-2xl">
                                        <GuildDofusOverview 
                                            stats={guildStats?.stats || []} 
                                            topMembers={guildStats?.topMembers || []}
                                            totalMembers={guildStats?.totalMembers || 0}
                                            guildId={guildId}
                                            onMemberClick={(profileId, pseudo, avatarUrl) => handleMemberClick(profileId, pseudo, avatarUrl)}
                                        />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                        {/* Left Column: Leaderboard of Guide Progress */}
                                        <div className="lg:col-span-8 flex flex-col gap-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                                                <div className="flex items-center gap-3">
                                                    <Trophy className="w-5 h-5 text-indigo-400" />
                                                    <h3 className="text-base font-black text-white italic uppercase tracking-tighter">
                                                        Progression — {selectedGuideDetail?.name || "Guide"}
                                                    </h3>
                                                    <div className="h-px flex-1 bg-white/5 min-w-[20px]" />
                                                </div>
                                                {/* Recherche de membre */}
                                                <div className="relative group shrink-0">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 group-hover:text-indigo-400 transition-colors" />
                                                    <input
                                                        type="text"
                                                        placeholder="Chercher un membre..."
                                                        value={guideMemberSearch}
                                                        onChange={(e) => setGuideMemberSearch(e.target.value)}
                                                        className="bg-black/60 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-[10px] text-white placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 w-full sm:w-48 transition-all"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {membersGuideProgress.filter(m =>
                                                    !guideMemberSearch || m.userName.toLowerCase().includes(guideMemberSearch.toLowerCase())
                                                ).length === 0 ? (
                                                    <div className="col-span-full py-16 text-center bg-zinc-950/20 border border-white/5 rounded-3xl">
                                                        <p className="text-white/20 font-black uppercase tracking-[0.2em] text-[10px]">
                                                            {guideMemberSearch ? "Aucun membre ne correspond à la recherche" : "Aucun membre n'a commencé ce guide"}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    membersGuideProgress.filter(m =>
                                                        !guideMemberSearch || m.userName.toLowerCase().includes(guideMemberSearch.toLowerCase())
                                                    ).map((member, index) => (
                                                        <div
                                                            key={member.profileId}
                                                            onClick={() => handleMemberClick(member.profileId, member.userName, member.userAvatar)}
                                                            className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-950/40 border border-white/5 hover:border-white/10 hover:bg-white/[0.02] transition-all duration-300 cursor-pointer"
                                                        >
                                                            <div className="w-6 flex-shrink-0 flex items-center justify-center">
                                                                <span className="text-xs font-black italic text-zinc-600">
                                                                    #{index + 1}
                                                                </span>
                                                            </div>

                                                            <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                                {member.userAvatar ? (
                                                                    <img src={member.userAvatar} alt={member.userName} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <span className="text-xs font-black text-indigo-400 italic">{member.userName.charAt(0).toUpperCase()}</span>
                                                                )}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-[11px] font-black text-white italic uppercase truncate tracking-tight">{member.userName}</span>
                                                                    <span className="text-[10px] font-black italic" style={{ color: guideColor }}>
                                                                        {member.percent}%
                                                                    </span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                                                    <div
                                                                        className="h-full rounded-full transition-all duration-300"
                                                                        style={{
                                                                            width: `${member.percent}%`,
                                                                            backgroundColor: guideColor
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div className="flex items-center justify-between mt-2 gap-2">
                                                                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest shrink-0">
                                                                        {member.completedCount} / {selectedGuideDetail?.milestones?.length || 0} étapes
                                                                    </p>
                                                                    {member.activeMilestone ? (
                                                                        <div className="flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold text-indigo-300 max-w-[150px] truncate" title={`En cours : ${member.activeMilestone.title}`}>
                                                                            <span className="shrink-0 text-[7px]">📍</span>
                                                                            <span className="truncate">{member.activeMilestone.title}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[8px] font-black text-emerald-400 uppercase tracking-wider shrink-0">
                                                                            <span>🏆 TERMINÉ</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Column: Guide Info card */}
                                        <div className="lg:col-span-4 flex flex-col gap-4">
                                            <div className="flex items-center gap-3 px-4">
                                                <Sparkles className="w-5 h-5 text-amber-400" />
                                                <h3 className="text-base font-black text-white italic uppercase tracking-tighter">
                                                    Infos Guide
                                                </h3>
                                                <div className="h-px flex-1 bg-white/5" />
                                            </div>

                                            <div className="p-6 rounded-3xl bg-zinc-950/40 border border-white/5 shadow-xl flex flex-col gap-4">
                                                <h4 className="text-sm font-black text-white uppercase tracking-wider">{selectedGuideDetail?.name}</h4>
                                                <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                                                    {selectedGuideDetail?.description || "Suivi de la progression collective de la guilde sur ce guide optimisé."}
                                                </p>

                                                <div className="h-px bg-white/5 my-2" />

                                                <div className="flex items-center justify-between text-xs font-bold">
                                                    <span className="text-zinc-500">Membres engagés :</span>
                                                    <span className="text-white font-black">{membersGuideProgress.length}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs font-bold">
                                                    <span className="text-zinc-500">Total d'étapes :</span>
                                                    <span className="text-white font-black">{selectedGuideDetail?.milestones?.length || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* MODAL DÉTAIL MEMBRE — Overlay glassmorphism premium           */}
            {/* ══════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {selectedMember && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ backdropFilter: "blur(16px)", background: "rgba(0,0,0,0.7)" }}
                        onClick={() => setSelectedMember(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 20 }}
                            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                            className="relative w-full max-w-2xl bg-zinc-950/95 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden"
                            style={{ boxShadow: "0 0 60px rgba(99,102,241,0.12), 0 0 120px rgba(0,0,0,0.6)" }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Glow accent */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] pointer-events-none" />

                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                        {selectedMember.avatarUrl ? (
                                            <img src={selectedMember.avatarUrl} alt={selectedMember.pseudo} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-base font-black text-indigo-400 italic">{selectedMember.pseudo.charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-500">Fiche du Membre</span>
                                        <h3 className="text-lg font-black text-white italic uppercase tracking-tight leading-tight">{selectedMember.pseudo}</h3>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedMember(null)}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
                                {/* ── Section 1 : Dofus obtenus ── */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Gem className="w-4 h-4 text-emerald-400" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Progression des Dofus</span>
                                    </div>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                        {dofusList.filter(d => !d.isMeta).map((dofus) => {
                                            // Look for this member in guildStats
                                            const dofusStat = guildStats?.stats.find(s => s.slug === dofus.slug);
                                            const memberProgress = dofusStat?.membersProgress.find(m => m.profileId === selectedMember.profileId);
                                            const isObtained = memberProgress?.isObtained ?? false;
                                            const percent = memberProgress?.percent ?? 0;
                                            const color = dofus.color || "#6366f1";
                                            return (
                                                <div
                                                    key={dofus.slug}
                                                    title={`${dofus.nameShort} — ${isObtained ? "Obtenu ✓" : `${percent}%`}`}
                                                    className={`relative flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                                                        isObtained
                                                            ? "bg-emerald-500/5 border-emerald-500/20"
                                                            : percent > 0
                                                            ? "bg-white/[0.02] border-white/8"
                                                            : "bg-black/20 border-white/5 opacity-40"
                                                    }`}
                                                >
                                                    <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: `${color}15` }}>
                                                        {dofus.imageUrl ? (
                                                            <img
                                                                src={dofus.slug === "dofoozbz" ? "/module-dofus/Dofus_dofoozbz.png" : dofus.imageUrl.replace(/^\/public/, "")}
                                                                alt={dofus.nameShort}
                                                                className="w-7 h-7 object-contain"
                                                            />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full" style={{ background: color }} />
                                                        )}
                                                    </div>
                                                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider text-center leading-tight line-clamp-1">{dofus.nameShort}</span>
                                                    {isObtained && (
                                                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                                                            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                                        </div>
                                                    )}
                                                    {!isObtained && percent > 0 && (
                                                        <div className="w-full h-0.5 rounded-full bg-white/5 overflow-hidden">
                                                            <div className="h-full rounded-full" style={{ width: `${percent}%`, background: color }} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* ── Section 2 : Progression des Guides ── */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Compass className="w-4 h-4 text-indigo-400" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Progression des Guides</span>
                                    </div>
                                    {isMemberLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                                        </div>
                                    ) : memberGuideProgress.length === 0 ? (
                                        <div className="py-8 text-center">
                                            <p className="text-zinc-600 font-black uppercase text-[9px] tracking-widest">Aucune progression de guide enregistrée</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {memberGuideProgress.map((gp) => {
                                                const correspondingDofus = dofusList.find(d => d.slug === gp.guideSlug);
                                                const color = correspondingDofus?.color || "#6366f1";
                                                return (
                                                    <div key={gp.guideId} className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
                                                        {/* Icon */}
                                                        <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                                                            {correspondingDofus?.imageUrl ? (
                                                                <img src={correspondingDofus.slug === "dofoozbz" ? "/module-dofus/Dofus_dofoozbz.png" : correspondingDofus.imageUrl.replace(/^\/public/, "")} alt={gp.guideName} className="w-7 h-7 object-contain" />
                                                            ) : (
                                                                <BookOpen className="w-4 h-4" style={{ color }} />
                                                            )}
                                                        </div>
                                                        {/* Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <span className="text-[10px] font-black text-white uppercase tracking-wider truncate">{gp.guideName}</span>
                                                                <span className="text-[10px] font-black italic ml-2 flex-shrink-0" style={{ color }}>{gp.percent}%</span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${gp.percent}%`, background: `linear-gradient(90deg, ${color}, ${color}99)`, boxShadow: `0 0 8px ${color}55` }} />
                                                            </div>
                                                            {gp.activeMilestone && (
                                                                <div className="flex items-center gap-1 mt-1.5">
                                                                    <div className="w-1 h-1 rounded-full bg-indigo-400 flex-shrink-0" />
                                                                    <span className="text-[9px] font-bold text-zinc-500 truncate">En cours : {gp.activeMilestone.title}</span>
                                                                </div>
                                                            )}
                                                            {!gp.activeMilestone && gp.total > 0 && (
                                                                <div className="flex items-center gap-1 mt-1.5">
                                                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
                                                                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Guide Terminé</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Steps */}
                                                        <div className="text-right flex-shrink-0">
                                                            <span className="text-[9px] font-black text-white/40">{gp.completed}<span className="text-white/20">/{gp.total}</span></span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
