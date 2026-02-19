"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
    BarChart3,
    Filter,
    X,
    ArrowUpDown,
    TrendingUp,
    Clock,
    CheckCircle,
    Lock,
    Mic2,
    Timer,
    LayoutGrid,
    ListFilter,
    Plus,
    Search,
    Zap,
    ChevronRight,
    History
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { PollCard } from "./poll-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { getMicroStatus, acquirePollCreatorRole, releasePollCreatorRole } from "@/server/actions/poll-actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface PollListProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    polls: any[];
    guildId: string;
    initialStatus?: StatusFilter;
}

type SortKey = "newest" | "oldest" | "most_votes" | "most_active";
type CategoryFilter = "ALL" | "SUGGESTION" | "AMELIORATION" | "EVENT" | "MISSION" | "AUTRE";
type StatusFilter = "ALL" | "ACTIVE" | "CLOSED" | "CANCELLED";

const SORT_OPTIONS: { value: SortKey; label: string; icon: React.ElementType }[] = [
    { value: "most_active", label: "En cours d'abord", icon: CheckCircle },
    { value: "newest", label: "Plus récents", icon: Clock },
    { value: "oldest", label: "Plus anciens", icon: Clock },
    { value: "most_votes", label: "Plus votés", icon: TrendingUp },
];

const CATEGORY_FILTERS: { value: CategoryFilter; label: string; emoji: string }[] = [
    { value: "ALL", label: "Tout", emoji: "🗳️" },
    { value: "SUGGESTION", label: "Suggestions", emoji: "💡" },
    { value: "AMELIORATION", label: "Améliorations", emoji: "🔧" },
    { value: "EVENT", label: "Événements", emoji: "🎉" },
    { value: "MISSION", label: "Missions", emoji: "🎯" },
    { value: "AUTRE", label: "Autres", emoji: "📋" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "ALL", label: "Tous" },
    { value: "ACTIVE", label: "En cours" },
    { value: "CLOSED", label: "Terminés" },
    { value: "CANCELLED", label: "Annulés" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sortPolls(polls: any[], sort: SortKey) {
    return [...polls].sort((a, b) => {
        switch (sort) {
            case "newest":
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            case "oldest":
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            case "most_votes":
                return (b.totalVotes ?? 0) - (a.totalVotes ?? 0);
            case "most_active":
                if (a.status === "ACTIVE" && b.status !== "ACTIVE") return -1;
                if (b.status === "ACTIVE" && a.status !== "ACTIVE") return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
    });
}

const CountdownTimer = ({ expiresAt }: { expiresAt: string }) => {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const updateTimer = () => {
            const now = new Date();
            const end = new Date(expiresAt);
            const diff = end.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft("Expiré");
                return;
            }

            const mins = Math.floor(diff / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    return <span>{timeLeft}</span>;
};

export function PollList({ polls, guildId, initialStatus = "ACTIVE" }: PollListProps) {
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
    const [showFilters, setShowFilters] = useState(false);
    const [sortKey, setSortKey] = useState<SortKey>("most_active");
    const [showSort, setShowSort] = useState(false);
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const [microStatus, setMicroStatus] = useState<{
        holder: { id: string; name: string; image?: string } | null;
        expiresAt?: string;
        isMicroHolder: boolean;
        isSuperAdmin?: boolean;
    } | null>(null);

    const refreshMicroStatus = async () => {
        const res = await getMicroStatus(guildId);
        if (res.success && res.data) {
            setMicroStatus(res.data);
        }
    };

    useEffect(() => {
        refreshMicroStatus();
        const interval = setInterval(refreshMicroStatus, 10000); // Refresh every 10s
        return () => clearInterval(interval);
    }, [guildId]);

    const handleAcquireMicroStatus = async () => {
        startTransition(async () => {
            const res = await acquirePollCreatorRole(guildId);
            if (res.success) {
                toast.success("Micro récupéré !");
                refreshMicroStatus();
                router.refresh();
            } else {
                toast.error(res.error || "Erreur lors de l'acquisition");
            }
        });
    };

    const handleReleaseMicro = async () => {
        startTransition(async () => {
            const res = await releasePollCreatorRole(guildId);
            if (res.success) {
                toast.success("Micro relâché !");
                refreshMicroStatus();
                router.refresh();
            } else {
                toast.error(res.error || "Erreur lors de la libération");
            }
        });
    };

    const filtered = polls.filter((p: any) => {
        if (categoryFilter !== "ALL" && p.category !== categoryFilter) return false;
        if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
        return true;
    });

    const sorted = sortPolls(filtered, sortKey);

    const activeCount = polls.filter((p: any) => p.status === "ACTIVE").length;
    const closedCount = polls.filter((p: any) => p.status === "CLOSED").length;
    const totalVotes = polls.reduce((sum: number, p: any) => sum + (p.totalVotes ?? 0), 0);

    if (polls.length === 0) {
        return (
            <EmptyState
                title="Aucun sondage"
                description="Aucun sondage n'a encore été créé. Soyez le premier à donner la voix !"
                icon={BarChart3}
                variant="glow"
            />
        );
    }

    const currentSort = SORT_OPTIONS.find(s => s.value === sortKey)!;

    return (
        <div className="space-y-8">
            {/* Micro Status Bar */}
            <div className="relative overflow-hidden rounded-3xl bg-zinc-900/40 border border-white/5 p-4 sm:p-6 backdrop-blur-xl">
                <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="relative flex-shrink-0">
                            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-inner">
                                <Mic2 className="w-7 h-7 text-cyan-400" />
                            </div>
                            {microStatus?.holder && (
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-cyan-500 border-2 border-zinc-900 animate-pulse" />
                            )}
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-xl font-black uppercase tracking-tighter italic text-white flex items-center gap-2">
                                Droit de Parole
                                {!microStatus?.holder && <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Libre</Badge>}
                            </h4>
                            <p className="text-sm text-zinc-400 font-medium">
                                {microStatus?.holder
                                    ? <span>Actuellement tenu par <span className="text-cyan-400 font-bold underline underline-offset-4 decoration-cyan-500/30">{microStatus.holder.name}</span></span>
                                    : "Personne n'a le micro. Prenez-le pour lancer un sondage."
                                }
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {microStatus?.expiresAt && (
                            <div className="flex items-center gap-3 bg-white/[0.03] px-5 py-3 rounded-2xl border border-white/5 shrink-0">
                                <Clock className="w-4 h-4 text-cyan-500" />
                                <div className="text-right flex items-center gap-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 leading-none mb-1">Temps restant</p>
                                        <p className="text-sm font-bold tabular-nums text-white leading-none">
                                            <CountdownTimer expiresAt={microStatus.expiresAt} />
                                        </p>
                                    </div>
                                    {microStatus.isMicroHolder && (
                                        <Button
                                            onClick={handleReleaseMicro}
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-tighter border border-red-500/20 transition-all"
                                        >
                                            Relâcher
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {(!microStatus?.holder || microStatus?.isSuperAdmin) && !microStatus?.isMicroHolder && (
                            <Button
                                onClick={handleAcquireMicroStatus}
                                disabled={isPending}
                                className={cn(
                                    "h-12 px-8 rounded-xl font-black uppercase tracking-widest text-xs transition-all shrink-0",
                                    microStatus?.holder
                                        ? "bg-amber-500 hover:bg-amber-400 text-white shadow-xl shadow-amber-500/20"
                                        : "bg-cyan-500 hover:bg-cyan-400 text-white shadow-xl shadow-cyan-500/20",
                                    "active:translate-y-0.5"
                                )}
                            >
                                {isPending ? "..." : microStatus?.holder ? "Reprendre le Micro" : "Prendre le Micro"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats + controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3" >
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => setStatusFilter("ACTIVE")}
                        className={cn(
                            "group flex items-center gap-2.5 px-4 py-2 rounded-2xl transition-all duration-300 border",
                            statusFilter === "ACTIVE"
                                ? "bg-emerald-500/20 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                                : "bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30"
                        )}
                    >
                        <div className={cn("w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]", statusFilter === "ACTIVE" && "animate-pulse")} />
                        <span className="text-emerald-400 text-xs font-black uppercase tracking-widest">{activeCount} en cours</span>
                    </button>
                    <button
                        onClick={() => setStatusFilter("CLOSED")}
                        className={cn(
                            "flex items-center gap-2.5 px-4 py-2 rounded-2xl transition-all duration-300 border",
                            statusFilter === "CLOSED"
                                ? "bg-amber-500/20 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)] text-amber-400"
                                : "bg-white/[0.02] border-white/5 text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                        )}
                    >
                        <span className="text-xs font-bold uppercase tracking-widest">{closedCount} terminé{closedCount !== 1 ? "s" : ""}</span>
                    </button>
                    <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white/[0.02] border border-white/5 group transition-all">
                        <TrendingUp className="w-3.5 h-3.5 text-zinc-600 transition-transform group-hover:scale-110" />
                        <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Sort dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => { setShowSort(!showSort); setShowFilters(false); }}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all",
                                showSort
                                    ? "bg-violet-500/10 border-violet-500/20 text-violet-400"
                                    : "bg-white/5 border-white/5 text-zinc-400 hover:text-white hover:border-white/10"
                            )}
                        >
                            <ArrowUpDown className="w-3 h-3" />
                            {currentSort.label}
                        </button>
                        <AnimatePresence>
                            {showSort && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                                    className="absolute right-0 top-full mt-1 z-20 bg-zinc-950 border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[175px]"
                                >
                                    {SORT_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => { setSortKey(opt.value); setShowSort(false); }}
                                            className={cn(
                                                "flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-left transition-all",
                                                sortKey === opt.value
                                                    ? "bg-violet-500/10 text-violet-400"
                                                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                            )}
                                        >
                                            <opt.icon className="w-3 h-3" />
                                            {opt.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Filter toggle */}
                    <button
                        onClick={() => { setShowFilters(!showFilters); setShowSort(false); }}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all",
                            showFilters
                                ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                                : "bg-white/5 border-white/5 text-zinc-400 hover:text-white hover:border-white/10"
                        )}
                    >
                        {showFilters ? <X className="w-3 h-3" /> : <Filter className="w-3 h-3" />}
                        Filtres
                    </button>
                </div>
            </div >

            {/* Filter panel */}
            <AnimatePresence>
                {
                    showFilters && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="p-6 rounded-3xl bg-[#080808] border border-white/5 shadow-2xl space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <ListFilter className="w-3.5 h-3.5 text-cyan-500" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 leading-none">Filtrer par Catégorie</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {CATEGORY_FILTERS.map(f => (
                                                <button
                                                    key={f.value}
                                                    onClick={() => setCategoryFilter(f.value)}
                                                    className={cn(
                                                        "group flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wider border transition-all duration-300",
                                                        categoryFilter === f.value
                                                            ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                                                            : "bg-white/[0.02] border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] hover:border-white/10"
                                                    )}
                                                >
                                                    <span className={cn("text-base grayscale group-hover:grayscale-0 transition-all", categoryFilter === f.value && "grayscale-0")}>{f.emoji}</span>
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <LayoutGrid className="w-3.5 h-3.5 text-violet-500" />
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 leading-none">Filtrer par Statut</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {STATUS_FILTERS.map(f => (
                                                <button
                                                    key={f.value}
                                                    onClick={() => setStatusFilter(f.value)}
                                                    className={cn(
                                                        "px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wider border transition-all duration-300",
                                                        statusFilter === f.value
                                                            ? "bg-violet-500/10 border-violet-500/40 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                                                            : "bg-white/[0.02] border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] hover:border-white/10"
                                                    )}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {(categoryFilter !== "ALL" || statusFilter !== "ALL") && (
                                    <div className="pt-4 border-t border-white/[0.02] flex justify-center">
                                        <button
                                            onClick={() => { setCategoryFilter("ALL"); setStatusFilter("ALL"); }}
                                            className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors"
                                        >
                                            <X className="w-3 h-3 transition-transform group-hover:rotate-90" />
                                            Réinitialiser les filtres
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )
                }
            </AnimatePresence >

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {sorted.map((poll, i) => (
                    <PollCard key={poll.id} poll={poll} guildId={guildId} index={i} />
                ))}
            </div>

            {sorted.length === 0 && polls.length > 0 && (
                <div className="text-center py-12 text-zinc-600 text-sm">
                    Aucun sondage ne correspond aux filtres sélectionnés.
                </div>
            )}

            {/* View Switching Footer */}
            {polls.length > 0 && (
                <div className="flex justify-center pt-8 border-t border-white/[0.03]">
                    {statusFilter === "ACTIVE" ? (
                        <Link
                            href={`/dashboard/${guildId}/sondages/archives`}
                            className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all text-zinc-500 hover:text-zinc-300"
                        >
                            <History className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-widest">Voir les archives du Sigil</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                    ) : (
                        <Link
                            href={`/dashboard/${guildId}/sondages`}
                            className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all text-cyan-400"
                        >
                            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-widest">Retour aux sondages en cours</span>
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}

function RemainingTime({ expiresAt }: { expiresAt: Date | string }) {
    const [timeLeft, setTimeLeft] = useState<string>("");

    useEffect(() => {
        const calculate = () => {
            const now = new Date();
            const end = new Date(expiresAt);
            const diff = end.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft("00:00");
                return;
            }

            const mins = Math.floor(diff / 1000 / 60);
            const secs = Math.floor((diff / 1000) % 60);
            setTimeLeft(`${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
        };

        calculate();
        const timer = setInterval(calculate, 1000);
        return () => clearInterval(timer);
    }, [expiresAt]);

    return (
        <div className="flex flex-col items-center gap-1.5 px-6 py-3 rounded-2xl bg-zinc-950/50 border border-white/5 text-cyan-400/90 shadow-inner group">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 leading-none">Temps restant</span>
            <div className="flex items-center gap-2">
                <Timer className="w-4 h-4 text-cyan-500 group-hover:animate-pulse" />
                <span className="text-xl font-black tabular-nums tracking-wider leading-none">{timeLeft}</span>
            </div>
        </div>
    );
}
