"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Gem, Users, Search, Sparkles, RefreshCw, CheckCircle2, BookOpen, ChevronLeft, ArrowRight, X, Navigation, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DofusGemCard } from "./DofusGemCard";
import { GuildDofusOverview } from "./GuildDofusOverview";
import { OptimizedGuideTab } from "./OptimizedGuideTab";
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
    const [selectedMember, setSelectedMember] = useState<{ profileId: string; pseudo: string; avatarUrl?: string } | null>(null);
    const [memberGuideProgress, setMemberGuideProgress] = useState<any[]>([]);
    const [isMemberLoading, setIsMemberLoading] = useState(false);

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

    const handleMemberClick = useCallback(async (profileId: string, pseudo: string, avatarUrl?: string) => {
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
    }, [guildId]);

    useEffect(() => {
        const tab = searchParams.get("tab") as Tab;
        if (tab && tab !== activeTab) {
            setActiveTab(tab);
        } else if (!tab) {
            setActiveTab("menu");
        }
    }, [searchParams]);

    const normalDofusList = dofusList.filter(d => !d.isMeta);
    const totalObtained = dofusList.filter((d) => d.isObtained).length;
    const totalNormalDofus = normalDofusList.length;
    const obtainedNormalDofus = normalDofusList.filter(d => d.isObtained).length;
    const overallPercent = dofusList.length > 0
        ? Math.round(dofusList.reduce((sum, d) => sum + d.progressPercent, 0) / dofusList.length)
        : 0;

    const filtered = dofusList
        .filter((d) => {
            if (search) return d.name.toLowerCase().includes(search.toLowerCase()) || d.nameShort.toLowerCase().includes(search.toLowerCase());
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

    const membersGuideProgress = useMemo(() => {
        if (!selectedGuideDetail?.milestones || !selectedGuideGuildProgress) return [];
        const totalMilestones = selectedGuideDetail.milestones.length;
        if (totalMilestones === 0) return [];

        const progressByProfile: Record<string, { profileId: string; userName: string; userAvatar?: string; completedCount: number; completedMilestoneIds: Set<string> }> = {};
        selectedGuideGuildProgress.forEach((p: any) => {
            if (!progressByProfile[p.profileId]) {
                progressByProfile[p.profileId] = { profileId: p.profileId, userName: p.userName, userAvatar: p.userAvatar, completedCount: 0, completedMilestoneIds: new Set() };
            }
            if (p.isCompleted) {
                progressByProfile[p.profileId].completedCount++;
                progressByProfile[p.profileId].completedMilestoneIds.add(p.milestoneId);
            }
        });

        return Object.values(progressByProfile).map(member => {
            const percent = Math.round((member.completedCount / totalMilestones) * 100);
            const activeMilestone = selectedGuideDetail.milestones.find((m: any) => !member.completedMilestoneIds.has(m.id));
            return { ...member, percent, activeMilestone: activeMilestone ? { id: activeMilestone.id, title: activeMilestone.title } : null };
        }).sort((a, b) => b.completedCount - a.completedCount);
    }, [selectedGuideDetail, selectedGuideGuildProgress]);

    const guideColor = useMemo(() => {
        if (!selectedGuideDetail?.slug) return "#6366f1";
        return dofusList.find(d => d.slug === selectedGuideDetail.slug)?.color || "#6366f1";
    }, [selectedGuideDetail, dofusList]);

    return (
        <div className="flex flex-col gap-8">

            {/* ── BOUTON RETOUR (hors menu) ── */}
            {activeTab !== "menu" && (
                <button
                    onClick={() => handleTabChange("menu")}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-white transition-colors self-start group"
                >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Retour au menu
                </button>
            )}

            {/* ── CONTENU PAR TAB ── */}
            <div className="relative min-h-[500px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                    >

                        {/* ══ VUE MENU — 3 grands blocs ══ */}
                        {activeTab === "menu" && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                                {/* CARD 1 : Suivi des Dofus */}
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
                                                Suis ta progression sur chaque Dofus primordial et majeur, quête par quête.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-6 border-t border-white/5">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            <span className="text-zinc-500">Obtenus :</span>
                                            <span className="text-emerald-400 font-black italic">{obtainedNormalDofus} / {totalNormalDofus} Dofus</span>
                                        </div>
                                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (obtainedNormalDofus / Math.max(1, totalNormalDofus)) * 100)}%` }} />
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-400 pt-2">
                                            Accéder au Suivi <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
                                        </div>
                                    </div>
                                </motion.div>

                                {/* CARD 2 : Guides Optimisés */}
                                <motion.div
                                    whileHover={{ scale: 1.02, translateY: -4 }}
                                    onClick={() => handleTabChange("guide")}
                                    className="group relative flex flex-col justify-between p-6 min-h-[320px] bg-gradient-to-br from-zinc-950 via-indigo-950/20 to-zinc-950 border border-indigo-500/20 hover:border-indigo-500/40 rounded-3xl cursor-pointer shadow-2xl transition-all duration-300"
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] pointer-events-none rounded-full" />
                                    <div className="space-y-4">
                                        <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 w-fit group-hover:scale-110 transition-transform duration-500">
                                            <Navigation className="w-6 h-6 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-white italic uppercase tracking-wider mb-1">
                                                Guides Optimisés
                                            </h3>
                                            <p className="text-xs font-semibold text-zinc-400 leading-relaxed">
                                                Suis le chemin le plus rapide rédigé par le staff pour obtenir tes Dofus.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-6 border-t border-white/5">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            <span className="text-zinc-500">Guides disponibles :</span>
                                            <span className="text-indigo-400 font-black italic">{guides.length}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-indigo-400 pt-2">
                                            Consulter les Guides <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
                                        </div>
                                    </div>
                                </motion.div>

                                {/* CARD 3 : Progression Commune */}
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
                                                Compare ta progression et observe l'avancement global de tous les membres.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-6 border-t border-white/5">
                                        <div className="flex items-center justify-between text-xs font-bold">
                                            <span className="text-zinc-500">Membres suivis :</span>
                                            <span className="text-amber-400 font-black italic">{guildStats?.totalMembers ?? 0}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-400 pt-2">
                                            Voir la Progression <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform" />
                                        </div>
                                    </div>
                                </motion.div>

                            </div>
                        )}

                        {/* ══ VUE DOFUS — grille + filtres ══ */}
                        {activeTab === "dofus" && (
                            <div className="flex flex-col gap-6">
                                {/* Filtres */}
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="relative group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-indigo-400 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Filtrer les Dofus..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            className="bg-black/60 border border-white/5 rounded-2xl pl-12 pr-6 py-3 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 w-full md:w-64 transition-all shadow-2xl shadow-black/40"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1.5 p-1.5 bg-black/60 border border-white/5 rounded-2xl shadow-2xl">
                                        {(["Tous", "Obtenus", "En cours", "À faire"] as const).map((f) => (
                                            <button
                                                key={f}
                                                onClick={() => setStatusFilter(f)}
                                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${statusFilter === f ? "bg-zinc-800 text-white shadow-xl shadow-black/60 ring-1 ring-white/10" : "text-zinc-600 hover:text-zinc-400"}`}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Grille */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                    {filtered.length === 0 ? (
                                        <div className="col-span-full py-24 flex flex-col items-center justify-center gap-4 bg-zinc-950/20 border border-dashed border-white/5 rounded-[3rem]">
                                            <div className="p-6 rounded-full bg-white/5">
                                                <Search className="w-12 h-12 text-zinc-800" />
                                            </div>
                                            <p className="text-zinc-600 font-black uppercase text-xs tracking-widest italic">Aucun Dofus ne correspond</p>
                                        </div>
                                    ) : (
                                        filtered.map((dofus) => (
                                            <DofusGemCard key={dofus.id} dofus={dofus} guildId={guildId} selectedCharacter={selectedCharacter} />
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ══ VUE GUIDE — OptimizedGuideTab complet ══ */}
                        {activeTab === "guide" && (
                            <OptimizedGuideTab initialGuides={guides} guildId={guildId} />
                        )}

                        {/* ══ VUE GUILDE — Progression Commune ══ */}
                        {activeTab === "guilde" && (
                            <div className="flex flex-col gap-8">
                                <div className="bg-zinc-950/20 rounded-[3rem] p-1 border border-white/5 shadow-2xl">
                                    <GuildDofusOverview
                                        stats={guildStats?.stats || []}
                                        topMembers={guildStats?.topMembers || []}
                                        totalMembers={guildStats?.totalMembers || 0}
                                        guildId={guildId}
                                        onMemberClick={(profileId, pseudo, avatarUrl) => handleMemberClick(profileId, pseudo, avatarUrl)}
                                    />
                                </div>
                            </div>
                        )}

                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ══ MODAL DÉTAIL MEMBRE ══ */}
            <AnimatePresence>
                {selectedMember && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
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
                            style={{ boxShadow: "0 0 60px rgba(99,102,241,0.12)" }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] pointer-events-none" />

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
                                <button onClick={() => setSelectedMember(null)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Gem className="w-4 h-4 text-emerald-400" />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Progression des Dofus</span>
                                    </div>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                        {dofusList.filter(d => !d.isMeta).map((dofus) => {
                                            const dofusStat = guildStats?.stats.find(s => s.slug === dofus.slug);
                                            const memberProgress = dofusStat?.membersProgress.find(m => m.profileId === selectedMember.profileId);
                                            const isObtained = memberProgress?.isObtained ?? false;
                                            const percent = memberProgress?.percent ?? 0;
                                            const color = dofus.color || "#6366f1";
                                            return (
                                                <div
                                                    key={dofus.slug}
                                                    title={`${dofus.nameShort} — ${isObtained ? "Obtenu ✓" : `${percent}%`}`}
                                                    className={`relative flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${isObtained ? "bg-emerald-500/5 border-emerald-500/20" : percent > 0 ? "bg-white/[0.02] border-white/[0.08]" : "bg-black/20 border-white/5 opacity-40"}`}
                                                >
                                                    <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: `${color}15` }}>
                                                        {dofus.imageUrl ? (
                                                            <img src={dofus.slug === "dofoozbz" ? "/module-dofus/Dofus_dofoozbz.png" : dofus.imageUrl.replace(/^\/public/, "")} alt={dofus.nameShort} className="w-7 h-7 object-contain" />
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

                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <BookOpen className="w-4 h-4 text-indigo-400" />
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
                                                        <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                                                            {correspondingDofus?.imageUrl ? (
                                                                <img src={correspondingDofus.slug === "dofoozbz" ? "/module-dofus/Dofus_dofoozbz.png" : correspondingDofus.imageUrl.replace(/^\/public/, "")} alt={gp.guideName} className="w-7 h-7 object-contain" />
                                                            ) : (
                                                                <BookOpen className="w-4 h-4" style={{ color }} />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <span className="text-[10px] font-black text-white uppercase tracking-wider truncate">{gp.guideName}</span>
                                                                <span className="text-[10px] font-black italic ml-2 flex-shrink-0" style={{ color }}>{gp.percent}%</span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full" style={{ width: `${gp.percent}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
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
