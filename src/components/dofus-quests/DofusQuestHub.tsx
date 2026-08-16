"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Gem, Users, Search, Sparkles, RefreshCw, CheckCircle2, BookOpen, ChevronLeft, ArrowRight, X, Navigation, Trophy, Construction, Zap, TreePine, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { DofusGemCard } from "./DofusGemCard";
import { GuildDofusOverview } from "./GuildDofusOverview";
import { OptimizedGuideTab } from "./OptimizedGuideTab";
import { QuestFeedbackButton } from "./QuestFeedbackButton";
import { getMemberAllGuidesProgress } from "@/server/actions/optimized-guide-actions";
import { toast } from "sonner";
import type { DofusItemWithProgress, GuildDofusStats, MemberDofusSummary, GuildMemberSummary } from "@/server/actions/dofus-quest-actions";

type Tab = "menu" | "dofus" | "guide" | "guilde";

interface DofusQuestHubProps {
    dofusList: DofusItemWithProgress[];
    guildStats: { stats: GuildDofusStats[]; topMembers: MemberDofusSummary[]; members: GuildMemberSummary[]; totalMembers: number } | null;
    guides?: any[];
    timelineGuides?: any[];
    rushSylvestreGuide?: { isUnderConstruction?: boolean } | null;
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
    timelineGuides = [],
    rushSylvestreGuide = null,
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

    useEffect(() => {
        if (!selectedMember) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelectedMember(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selectedMember]);

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

    const ficheDofusList = useMemo(() => {
        return dofusList
            .filter(d => !d.isMeta)
            .map((dofus) => {
                const dofusStat = guildStats?.stats.find(s => s.slug === dofus.slug);
                const mp = dofusStat?.membersProgress.find(m => m.profileId === selectedMember?.profileId);
                return {
                    dofus,
                    isObtained: mp?.isObtained ?? false,
                    percent: mp?.percent ?? 0,
                };
            })
            .sort((a, b) => {
                const aOb = a.isObtained ? 1 : 0;
                const bOb = b.isObtained ? 1 : 0;
                if (aOb !== bOb) return bOb - aOb;
                if (a.percent !== b.percent) return b.percent - a.percent;
                return a.dofus.nameShort.localeCompare(b.dofus.nameShort);
            });
    }, [dofusList, guildStats, selectedMember]);

    const guideColor = useMemo(() => {
        if (!selectedGuideDetail?.slug) return "#6366f1";
        return dofusList.find(d => d.slug === selectedGuideDetail.slug)?.color || "#6366f1";
    }, [selectedGuideDetail, dofusList]);

    return (
        <div className="flex flex-col gap-8">

            {/* ── BOUTON RETOUR (hors menu) + Feedback ── */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                {activeTab !== "menu" ? (
                    <button
                        onClick={() => handleTabChange("menu")}
                        className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-zinc-900/90 hover:border-emerald-500/60 hover:from-emerald-500/20 text-xs font-black uppercase tracking-[0.18em] text-emerald-200 hover:text-white transition-all shadow-lg shadow-black/30 group backdrop-blur-md cursor-pointer"
                    >
                        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group- transition-transform">
                            <ChevronLeft className="w-4 h-4 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
                        </div>
                        <span>Retour au menu Quêtes</span>
                    </button>
                ) : <div />}
                <QuestFeedbackButton guildId={guildId} sourcePage="hub-dofus" compact />
            </div>

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

                        {/* ══ VUE MENU — grille 2×2 ══ */}
                        {activeTab === "menu" && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" data-tour="quetes-menu">

                                {/* CARD 1 : Rush Sylvestre — toujours visible, hard-codé */}
                                <Link
                                    href={`/dashboard/${guildId}/quetes-dofus/guide/rush-sylvestre`}
                                    className="group relative flex flex-col justify-between p-6 min-h-[320px] rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-emerald-500/40 transition-colors duration-200 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                                    style={{ textDecoration: 'none' }}
                                >
                                    {/* Dofus Sylvestre watermark */}
                                    <div className="absolute bottom-0 right-0 w-32 h-32 pointer-events-none opacity-[0.06] group-hover:opacity-[0.1] transition-opacity">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src="/module-dofus/Dofus_Sylvestre.png" alt="" className="w-full h-full object-contain" />
                                    </div>
                                    {rushSylvestreGuide?.isUnderConstruction && (
                                        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-caption font-semibold text-amber-400 z-10">
                                            <Construction className="w-2.5 h-2.5" /> En construction
                                        </div>
                                    )}
                                    <div className="space-y-4">
                                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 w-fit">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src="/module-dofus/Dofus_Sylvestre.png" alt="Dofus Sylvestre" className="w-10 h-10 object-contain" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-title font-bold text-white">
                                                    Rush Sylvestre
                                                </h3>
                                                <span className="text-caption font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">NEW</span>
                                            </div>
                                            <p className="text-body-sm text-zinc-400 leading-relaxed">
                                                Rush Sylvestre communautaire — suis ta progression étape par étape et coordonne-toi avec ta guilde.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-6 border-t border-white/10">
                                        <div className="flex items-center justify-between text-body-sm font-semibold">
                                            <span className="text-zinc-500">Mode :</span>
                                            <span className="text-emerald-400 font-semibold">Collaboratif</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-caption font-semibold text-emerald-400 pt-2">
                                            Démarrer le Rush <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                </Link>

                                {/* CARD 2 : Guides Optimisés */}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleTabChange("guide")}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleTabChange("guide"); } }}
                                    className="group relative flex flex-col justify-between p-6 min-h-[320px] rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-emerald-500/40 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                                >
                                    {/* Ganymède watermark */}
                                    <div className="absolute bottom-4 right-4 w-24 h-24 pointer-events-none opacity-[0.06] group-hover:opacity-[0.1] transition-opacity">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src="/assets/icons/ganymede.webp" alt="" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 w-fit">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src="/assets/icons/ganymede.webp" alt="Ganymède" className="w-10 h-10 object-contain" />
                                        </div>
                                        <div>
                                            <h3 className="text-title font-bold text-white mb-1">
                                                Guides Optimisés
                                            </h3>
                                            <p className="text-body-sm text-zinc-400 leading-relaxed">
                                                Suis le chemin le plus rapide rédigé par ganymède pour obtenir tes Dofus.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-6 border-t border-white/10">
                                        <div className="flex items-center justify-between text-body-sm font-semibold">
                                            <span className="text-zinc-500">Guides disponibles :</span>
                                            <span className="text-emerald-400 font-semibold">{guides.length}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-caption font-semibold text-emerald-400 pt-2">
                                            Consulter les Guides <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                                {/* CARD 3 : Suivi des Dofus */}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleTabChange("dofus")}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleTabChange("dofus"); } }}
                                    className="group relative flex flex-col justify-between p-6 min-h-[320px] rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-emerald-500/40 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                                >
                                    <div className="space-y-4">
                                        {/* Dofus icon cluster */}
                                        <div className="flex items-center gap-1.5">
                                            {["/assets/icons/ocre.png", "/module-dofus/Dofus_Turquoise.png", "/module-dofus/Dofus_Emeraude.png", "/module-dofus/Dofus_Pourpre.png", "/module-dofus/Dofus_Ebene.png"].map((url, i) => (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img key={i} src={url} alt="" className="w-8 h-8 object-contain" />
                                            ))}
                                            <span className="text-zinc-500 text-caption font-semibold ml-1">+{Math.max(0, totalNormalDofus - 5)}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-title font-bold text-white mb-1">
                                                Suivi des Dofus
                                            </h3>
                                            <p className="text-body-sm text-zinc-400 leading-relaxed">
                                                Suis ta progression sur chaque Dofus primordial et majeur, quête par quête.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-6 border-t border-white/10">
                                        <div className="flex items-center justify-between text-body-sm font-semibold">
                                            <span className="text-zinc-500">Obtenus :</span>
                                            <span className="text-emerald-400 font-semibold">{obtainedNormalDofus} / {totalNormalDofus} Dofus</span>
                                        </div>
                                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/5">
                                            <div className="bg-emerald-500 h-full rounded-full transition-colors duration-200" style={{ width: `${Math.min(100, (obtainedNormalDofus / Math.max(1, totalNormalDofus)) * 100)}%` }} />
                                        </div>
                                        <div className="flex items-center gap-1 text-caption font-semibold text-emerald-400 pt-2">
                                            Accéder au Suivi <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                </div>

                                {/* CARD 4 : Progression Guildienne */}
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleTabChange("guilde")}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleTabChange("guilde"); } }}
                                    className="group relative flex flex-col justify-between p-6 min-h-[320px] rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-emerald-500/40 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                                >
                                    <div className="space-y-4">
                                        {/* Member avatars cluster */}
                                        {guildStats && guildStats.topMembers.length > 0 ? (
                                            <div className="flex flex-col gap-2">
                                                <div className="flex -space-x-2">
                                                    {guildStats.topMembers.slice(0, 6).map((m: any, i: number) => (
                                                        <div
                                                            key={m.profileId || i}
                                                            className="w-9 h-9 rounded-full border-2 border-zinc-950 bg-zinc-800 flex items-center justify-center overflow-hidden ring-1 ring-emerald-500/20"
                                                            style={{ zIndex: 10 - i }}
                                                            title={m.pseudo || m.userName}
                                                        >
                                                            {m.avatarUrl ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={m.avatarUrl} alt={m.pseudo} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="text-caption font-semibold text-emerald-300">{(m.pseudo || m.userName || "?")[0]?.toUpperCase()}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                    {guildStats.totalMembers > 6 && (
                                                        <div className="w-9 h-9 rounded-full border-2 border-zinc-950 bg-zinc-800 flex items-center justify-center ring-1 ring-white/10">
                                                            <span className="text-caption font-semibold text-zinc-400">+{guildStats.totalMembers - 6}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Mini progress bar for top member */}
                                                {guildStats.topMembers[0] && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, ((guildStats.topMembers[0] as any).dofusObtained || 0) / Math.max(1, totalNormalDofus) * 100)}%` }} />
                                                        </div>
                                                        <span className="text-caption font-semibold text-emerald-400/80">{(guildStats.topMembers[0] as any).pseudo || "Leader"}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 w-fit">
                                                <Users className="w-6 h-6" />
                                            </div>
                                        )}
                                        <div>
                                            <h3 className="text-title font-bold text-white mb-1">
                                                Progression Guilde
                                            </h3>
                                            <p className="text-body-sm text-zinc-400 leading-relaxed">
                                                Visualise la progression globale de ta guilde et compare avec tes alliés.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-6 border-t border-white/10">
                                        <div className="flex items-center justify-between text-body-sm font-semibold">
                                            <span className="text-zinc-500">Membres actifs :</span>
                                            <span className="text-emerald-400 font-semibold">{guildStats?.totalMembers || 0}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-caption font-semibold text-emerald-400 pt-2">
                                            Voir la Guilde <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}

                        {/* ══ VUE DOFUS — grille + filtres ══ */}
                        {activeTab === "dofus" && (
                            <div className="flex flex-col gap-6">
                                {/* Banner explicatif */}
                                <div className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200 backdrop-blur-md shadow-sm">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                        <Sparkles className="w-4 h-4 text-indigo-400" />
                                    </div>
                                    <div className="text-xs leading-relaxed">
                                        <strong className="text-white font-bold">💡 Suivi individuel des Dofus :</strong> Suivez l&apos;avancement quête par quête de chaque Dofus. Votre progression est enregistrée automatiquement et alimente la vue synthétique sur votre profil.
                                    </div>
                                </div>

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
                                                className={`px-3 py-1.5 rounded-xl text-caption font-black uppercase tracking-widest transition-all ${statusFilter === f ? "bg-zinc-800 text-white shadow-xl shadow-black/60 ring-1 ring-white/10" : "text-zinc-600 hover:text-zinc-400"}`}
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
                                        members={guildStats?.members || []}
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
                        role="dialog"
                        aria-modal="true"
                        aria-label={selectedMember ? `Fiche du membre — ${selectedMember.pseudo}` : "Fiche du membre"}
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

                            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                        {selectedMember.avatarUrl ? (
                                            <img src={selectedMember.avatarUrl} alt={selectedMember.pseudo} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-base font-black text-indigo-400 italic">{selectedMember.pseudo.charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-caption font-black uppercase tracking-widest text-zinc-500">Fiche du Membre</span>
                                        <h3 className="text-lg font-black text-white italic uppercase tracking-tight leading-tight">{selectedMember.pseudo}</h3>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedMember(null)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-4 sm:p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Gem className="w-4 h-4 text-emerald-400" />
                                        <span className="text-caption font-black uppercase tracking-[0.2em] text-zinc-400">Progression personnelle des Dofus</span>
                                    </div>
                                    <p className="text-caption text-zinc-600 mb-3">Progression de <span className="text-zinc-300 font-bold">{selectedMember?.pseudo}</span> — obtenus en premier, puis par avancement.</p>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                        {ficheDofusList.map(({ dofus, isObtained, percent }) => {
                                            const color = dofus.color || "#6366f1";
                                            return (
                                                <div
                                                    key={dofus.slug}
                                                    title={`${dofus.nameShort} — ${isObtained ? "Obtenu ✓" : `${percent}%`}`}
                                                    className={`relative flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${isObtained ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20" : percent > 0 ? "bg-white/[0.02] border-white/[0.08]" : "bg-black/20 border-white/5 opacity-40"}`}
                                                >
                                                    <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center" style={{ background: `${color}15` }}>
                                                        {dofus.imageUrl ? (
                                                            <img src={dofus.slug === "dofoozbz" ? "/module-dofus/Dofus_dofoozbz.png" : dofus.imageUrl.replace(/^\/public/, "")} alt={dofus.nameShort} className="w-7 h-7 object-contain" />
                                                        ) : (
                                                            <div className="w-6 h-6 rounded-full" style={{ background: color }} />
                                                        )}
                                                    </div>
                                                    <span className="text-caption font-black text-zinc-500 uppercase tracking-wider text-center leading-tight line-clamp-1">{dofus.nameShort}</span>
                                                    {isObtained ? (
                                                        <span className="text-caption font-black text-emerald-400 uppercase tracking-wider">Obtenu</span>
                                                    ) : percent > 0 ? (
                                                        <span className="text-caption font-black text-indigo-300 uppercase tracking-wider">{percent}%</span>
                                                    ) : (
                                                        <span className="text-caption font-black text-zinc-700 uppercase tracking-wider">À faire</span>
                                                    )}
                                                    {isObtained && (
                                                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center ">
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
                                        <span className="text-caption font-black uppercase tracking-[0.2em] text-zinc-400">Progression personnelle des guides</span>
                                    </div>
                                    {isMemberLoading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                                        </div>
                                    ) : memberGuideProgress.length === 0 ? (
                                        <div className="py-8 text-center">
                                            <p className="text-zinc-600 font-black uppercase text-caption tracking-widest">Aucune progression de guide enregistrée</p>
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
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <span className="text-caption font-black text-white uppercase tracking-wider truncate">{gp.guideName}</span>
                                                                    {gp.guideSlug && (
                                                                        <Link href={`/dashboard/${guildId}/quetes-dofus/guide/${gp.guideSlug}`} target="_blank" className="text-indigo-400 hover:text-indigo-200 transition-colors flex-shrink-0" title="Ouvrir le guide">
                                                                            <ExternalLink className="w-3 h-3" />
                                                                        </Link>
                                                                    )}
                                                                </div>
                                                                <span className="text-caption font-black italic ml-2 flex-shrink-0" style={{ color }}>{gp.percent}%</span>
                                                            </div>
                                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                                <div className="h-full rounded-full" style={{ width: `${gp.percent}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
                                                            </div>
                                                            {gp.activeMilestone && (
                                                                <div className="flex items-center gap-1 mt-1.5">
                                                                    <div className="w-1 h-1 rounded-full bg-indigo-400 flex-shrink-0" />
                                                                    <span className="text-caption font-bold text-zinc-500 truncate">En cours : {gp.activeMilestone.title}</span>
                                                                </div>
                                                            )}
                                                            {!gp.activeMilestone && gp.total > 0 && (
                                                                <div className="flex items-center gap-1 mt-1.5">
                                                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 flex-shrink-0" />
                                                                    <span className="text-caption font-black text-emerald-400 uppercase tracking-wider">Guide Terminé</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <span className="text-caption font-black text-white/40">{gp.completed}<span className="text-white/20">/{gp.total}</span></span>
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
