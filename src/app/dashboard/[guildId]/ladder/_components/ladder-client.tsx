"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Clock, Loader2, CheckSquare, Zap, AlertTriangle, ChevronLeft, ChevronRight, MessageSquare, BookOpen, Heart, Tv, Search, X } from "lucide-react";
import { LeaderboardCard } from "./leaderboard-card";
import {
    getActivityLadder,
    getSeniorityLadder,
    getSuccessLadder,
    getContributionLadder,
    getGuildatonsLadder,
    getGeneralLadder,
    getPresenceLadder,
    getRaidLadder,
    type LadderEntry,
    type ActivityView
} from "@/server/actions/ladder-actions";
import { formatSeniority } from "@/lib/ladder-utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = {
    guildId: string;
    canValidate?: boolean;
    hasPseudoIssue?: boolean;
    pseudoDofus?: string | null;
    vitrineMode?: boolean;
};

export function LadderClient({ guildId, canValidate, hasPseudoIssue, pseudoDofus, vitrineMode = false }: Props) {
    const [activeTab, setActiveTab] = useState<"activity" | "contribution" | "seniority" | "success" | "general" | "guildatons" | "discord" | "raids">(
        vitrineMode ? "discord" : "activity"
    );
    const [discordMetric, setDiscordMetric] = useState<"messages" | "voice" | "characters" | "reactions" | "stream" | "replies">("messages");
    const [activityView, setActivityView] = useState<ActivityView>("weekly");
    const [raidFilter, setRaidFilter] = useState<"all" | "jardin" | "gigalodon">("all");
    const [ladder, setLadder] = useState<LadderEntry[]>([]);
    const [pagination, setPagination] = useState<{ totalPages: number; totalCount: number } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    // #132 — recherche de pseudo dans le classement (filtre client-side sur la page courante).
    const [search, setSearch] = useState("");

    // Filtre client-side : pseudo Discord ou pseudo Dofus.
    const filteredLadder = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return ladder;
        return ladder.filter((e) =>
            e.discordNickname?.toLowerCase().includes(q) ||
            e.pseudoDofus?.toLowerCase().includes(q)
        );
    }, [ladder, search]);

    // Reset page when switching tabs or timeframes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, activityView, discordMetric, raidFilter]);

    useEffect(() => {
        async function loadLadder() {
            setLoading(true);
            let result;

            switch (activeTab) {
                case "activity":
                    result = await getActivityLadder(guildId, activityView, currentPage);
                    break;
                case "contribution":
                    result = await getContributionLadder(guildId, currentPage);
                    break;
                case "seniority":
                    result = await getSeniorityLadder(guildId, currentPage);
                    break;
                case "success":
                    result = await getSuccessLadder(guildId, currentPage);
                    break;
                case "general":
                    result = await getGeneralLadder(guildId, currentPage);
                    break;
                case "guildatons":
                    result = await getGuildatonsLadder(guildId, activityView, currentPage);
                    break;
                case "discord":
                    result = await getPresenceLadder(guildId, discordMetric, activityView, currentPage);
                    break;
                case "raids":
                    result = await getRaidLadder(guildId, raidFilter, currentPage);
                    break;
            }

            if (result && result.success && result.data) {
                setLadder(result.data.entries);
                setPagination({
                    totalPages: result.data.totalPages,
                    totalCount: result.data.totalCount
                });
            } else {
                setLadder([]);
                setPagination(null);
            }
            setLoading(false);
        }

        loadLadder();
    }, [guildId, activeTab, activityView, currentPage, discordMetric, raidFilter]);

    const getValueLabel = (entry: LadderEntry): React.ReactNode => {
        switch (activeTab) {
            case "activity":
                return (
                    <div className="flex items-center gap-1.5 font-black">
                        <span>{entry.value.toLocaleString()}</span>
                        <Image src="/assets/icons/pa.png" alt="PA" width={16} height={16} className="object-contain" />
                    </div>
                );
            case "contribution":
                return `${entry.value.toLocaleString()} pts`;
            case "seniority":
                return formatSeniority(entry.value);
            case "success":
                return `${entry.value.toLocaleString()} pts`;
            case "general":
                return (
                    <div className="flex items-center gap-1.5 font-black">
                        <span>{Number(entry.totalXpBigInt || 0).toLocaleString()}</span>
                        <Image src="/assets/icons/pa.png" alt="PA" width={16} height={16} className="object-contain" />
                    </div>
                );
            case "guildatons":
                return (
                    <div className="flex items-center gap-1.5 font-black text-warning">
                        <span>{entry.value.toLocaleString()}</span>
                        <Image src="/assets/icons/guildatons.png" alt="G" width={16} height={16} className="object-contain" />
                    </div>
                );
            case "discord":
                if (discordMetric === "messages") {
                    return (
                        <div className="flex items-center gap-2 font-black text-info">
                            <Zap className="w-3.5 h-3.5 fill-indigo-400" />
                            <span>{entry.value.toLocaleString()} messages</span>
                        </div>
                    );
                } else if (discordMetric === "voice") {
                    const totalMinutes = entry.value;
                    const months = Math.floor(totalMinutes / (30 * 24 * 60));
                    const days = Math.floor((totalMinutes % (30 * 24 * 60)) / (24 * 60));
                    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
                    const mins = totalMinutes % 60;

                    return (
                        <div className="flex items-center gap-2 font-black text-info">
                            <Clock className="w-3.5 h-3.5" />
                            <div className="flex gap-1 items-baseline">
                                {months > 0 && <span>{months}<span className="text-caption text-muted-foreground font-medium ml-0.5">M</span></span>}
                                {days > 0 && <span>{days}<span className="text-caption text-muted-foreground font-medium ml-0.5">J</span></span>}
                                {hours > 0 && <span>{hours}<span className="text-caption text-muted-foreground font-medium ml-0.5">H</span></span>}
                                <span>{mins}<span className="text-caption text-muted-foreground font-medium ml-0.5">m</span></span>
                            </div>
                        </div>
                    );
                } else if (discordMetric === "characters") {
                    return (
                        <div className="flex items-center gap-2 font-black text-success">
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{entry.value.toLocaleString()} caractères</span>
                        </div>
                    );
                } else if (discordMetric === "reactions") {
                    return (
                        <div className="flex items-center gap-2 font-black text-warning">
                            <Heart className="w-3.5 h-3.5 fill-amber-400" />
                            <span>{entry.value.toLocaleString()} reçues</span>
                        </div>
                    );
                } else if (discordMetric === "stream") {
                    const totalMinutes = entry.value;
                    const hours = Math.floor(totalMinutes / 60);
                    const mins = totalMinutes % 60;
                    return (
                        <div className="flex items-center gap-2 font-black text-pink-400">
                            <Tv className="w-3.5 h-3.5" />
                            <span>{hours > 0 ? `${hours}h ${mins}m` : `${mins}m`} stream</span>
                        </div>
                    );
                } else {
                    return (
                        <div className="flex items-center gap-2 font-black text-info">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{entry.value.toLocaleString()} réponses</span>
                        </div>
                    );
                }
            case "raids":
                return (
                    <div className="flex flex-col items-end text-right">
                        <div className="flex items-center gap-1.5 font-black text-danger">
                            <span>{entry.value} {entry.value > 1 ? "raids" : "raid"}</span>
                        </div>
                        {entry.averageScore !== undefined && entry.averageScore > 0 && (
                            <span className="text-caption text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
                                Score Moyen: {Math.round(entry.averageScore).toLocaleString()} pts
                            </span>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                            {entry.jardinCount !== undefined && entry.jardinCount > 0 && (
                                <Badge variant="outline" className="text-caption font-black border-success/20 text-success bg-success/5 px-1.5 py-0 uppercase tracking-tighter">
                                    🌿 {entry.jardinCount} Jardin
                                </Badge>
                            )}
                            {entry.gigalodonCount !== undefined && entry.gigalodonCount > 0 && (
                                <Badge variant="outline" className="text-caption font-black border-info/20 text-info bg-info/5 px-1.5 py-0 uppercase tracking-tighter">
                                    🦈 {entry.gigalodonCount} Gigalodon
                                </Badge>
                            )}
                        </div>
                    </div>
                );
            default:
                return entry.value.toString();
        }
    };

    const categories = ([
        { id: "activity", label: "Activité", icon: "/assets/dofus/icons/activity.png" },
        // « Général » (XP des membres) en 2e position pour être immédiatement visible.
        { id: "general", label: "Général", icon: "/assets/dofus/icons/crown.png" },
        { id: "guildatons", label: "Guildatons", icon: "/assets/icons/guildatons.png" },
        { id: "raids", label: "Raids", icon: "/assets/dofus/icons/crossedSwords.png" },
        { id: "discord", label: "Discord", icon: "/assets/dofus/icons/chat.png" },
        { id: "contribution", label: "Contribution", icon: "/assets/dofus/icons/heart.png" },
        { id: "seniority", label: "Ancienneté", icon: "/assets/dofus/icons/hourglass.png" },
        { id: "success", label: "Succès", icon: "/assets/dofus/icons/trophy-icon.png" },
    ] as const).filter(cat => !vitrineMode || (cat.id !== "activity" && cat.id !== "guildatons"));

    return (
        <div className="space-y-12">
            {/* Navigation par onglets */}
            <div className="sticky top-0 z-40 py-2 bg-background/90 backdrop-blur border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center justify-between">
                        {/* Tab Container with Scroll Mask */}
                        <div className="relative flex-1 min-w-0">
                            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mb-[1px]" data-tour="ladder-tabs">
                                {categories.map((cat) => {
                                    const isActive = activeTab === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setActiveTab(cat.id)}
                                            aria-current={isActive ? "page" : undefined}
                                            className={cn(
                                                "flex items-center gap-2 px-4 sm:px-5 py-3 border-b-2 transition-colors whitespace-nowrap",
                                                isActive
                                                  ? "border-foreground text-foreground"
                                                  : "border-transparent text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <div className={cn("w-4 h-4 relative", !isActive && "opacity-50 grayscale")}>
                                                <Image src={cat.icon} fill alt="" className="object-contain" />
                                            </div>
                                            <span className="text-xs font-semibold">
                                                {cat.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Fading Edge for Scroll */}
                            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none md:hidden" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 space-y-8">
                {/* Contexte du classement : titre, description, période */}
                <div className="rounded-xl border border-border bg-card px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[220px]">
                            <h2 className="text-sm font-semibold text-foreground">
                                {categories.find(c => c.id === activeTab)?.label}
                            </h2>
                            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 max-w-2xl">
                                {activeTab === 'activity' && "Engagement de la guilde : missions validées et dons de kamas. Seul l'XP de la période compte."}
                                {activeTab === 'contribution' && "Implication dans la vie de la guilde (entraide, événements, parrainage). Points attribués par les officiers."}
                                {activeTab === 'seniority' && "Ordre d'arrivée sur le serveur de guilde. Les plus fidèles en tête."}
                                {activeTab === 'success' && "Points de succès synchronisés depuis les serveurs Ankama."}
                                {activeTab === 'general' && "Expérience totale accumulée par personnage sur Dofus."}
                                {activeTab === 'guildatons' && "Monnaie interne de la guilde (échanges, récompenses, boutique)."}
                                {activeTab === 'discord' && (
                                    discordMetric === "messages"
                                        ? "Volume de discussion sur Discord."
                                        : "Temps passé en vocal."
                                )}
                                {activeTab === 'raids' && "Participations aux raids et sorties organisées."}
                            </p>
                        </div>

                        {/* Contextual Period Selector */}
                        {(activeTab === "activity" || activeTab === "guildatons" || activeTab === "discord") && (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto" data-tour="ladder-period">
                                {activeTab === "discord" && (
                                    <Select value={discordMetric} onValueChange={(v) => setDiscordMetric(v as any)}>
                                        <SelectTrigger className="w-full sm:w-[180px] h-9 bg-surface border-border text-xs font-medium rounded-xl">
                                            <SelectValue placeholder="Métrique" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="voice">Vocal</SelectItem>
                                            <SelectItem value="messages">Messages</SelectItem>
                                            <SelectItem value="stream">Streams</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                                <Select value={activityView} onValueChange={(v) => setActivityView(v as ActivityView)}>
                                    <SelectTrigger className="w-full sm:w-[180px] h-9 bg-surface border-border text-xs font-medium rounded-xl">
                                        <SelectValue placeholder="Période" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="weekly">Cette semaine</SelectItem>
                                        <SelectItem value="monthly">Ce mois-ci</SelectItem>
                                        <SelectItem value="alltime">Global</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {(activeTab === 'success' || activeTab === 'general') && hasPseudoIssue && (
                        <div className="mt-3 p-3 rounded-xl bg-warning/10 border border-warning/20 text-warning text-xs flex items-center gap-2.5">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>
                                Vous n'apparaissez peut-être pas : votre
                                <strong> pseudo Dofus</strong> {!pseudoDofus ? "n'est pas renseigné" : `("${pseudoDofus}") est invalide`}.
                                Voir <Link href={`/dashboard/${guildId}/profile`} className="underline font-semibold hover:text-warning">votre profil</Link>.
                            </span>
                        </div>
                    )}
                </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <h2 className="text-sm font-semibold text-foreground">
                    Classement
                    {pagination && pagination.totalCount > 0 && (
                        <span className="ml-2 text-xs font-medium text-muted-foreground tabular-nums">
                            {pagination.totalCount} membre{pagination.totalCount > 1 ? "s" : ""}
                        </span>
                    )}
                </h2>

                <div className="flex items-center gap-3">
                    {canValidate && (
                        <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 border-border bg-surface hover:bg-surface text-xs font-semibold gap-2 px-3"
                        >
                            <Link href={`/dashboard/${guildId}/admin/validation?tab=achievements`}>
                                <CheckSquare className="w-3.5 h-3.5 text-success" />
                                Validation
                            </Link>
                        </Button>
                    )}

                    {/* #132 — Recherche de pseudo dans le classement */}
                    <div className="relative w-full sm:w-64 shrink-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher un pseudo…"
                            className="h-9 pl-9 pr-8 rounded-xl bg-surface border-border text-sm placeholder:text-muted-foreground"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Effacer la recherche"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Ladder Results */}
            <div className="relative min-h-[400px]">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <span className="text-caption font-black uppercase tracking-widest">Calcul du classement...</span>
                    </div>
                ) : filteredLadder.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        <p className="text-xs font-medium italic">
                            {search.trim() ? "Aucun membre ne correspond à cette recherche." : "Aucune donnée disponible pour ce classement."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div className="max-w-4xl mx-auto grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300" data-tour="ladder-list">
                            {filteredLadder.map((entry) => (
                                <LeaderboardCard
                                    key={entry.profileId}
                                    entry={entry}
                                    valueLabel={getValueLabel(entry)}
                                    accentColor={
                                        activeTab === 'activity' ? 'emerald' : 
                                        activeTab === 'contribution' ? 'purple' : 
                                        activeTab === 'seniority' ? 'cyan' : 
                                        activeTab === 'guildatons' ? 'yellow' : 
                                        activeTab === 'discord' ? (discordMetric === 'messages' ? 'indigo' : 'cyan') :
                                        (activeTab === 'general' ? 'blue' : 'amber')
                                    }
                                />
                            ))}
                        </div>

                        {/* Pagination UI */}
                        {pagination && pagination.totalPages > 1 && (
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-8 border-t border-border animate-in fade-in slide-in-from-bottom-4 duration-300" data-tour="ladder-pagination">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="w-10 h-10 rounded-xl bg-surface border-border hover:bg-surface disabled:opacity-30 transition-all"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                                    </Button>

                                    <div className="flex items-center gap-1.5 px-4 h-10 rounded-xl bg-surface border border-border">
                                        <span className="text-caption font-black text-foreground">{currentPage}</span>
                                        <span className="text-caption font-black text-muted-foreground">/</span>
                                        <span className="text-caption font-black text-muted-foreground">{pagination.totalPages}</span>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                                        disabled={currentPage === pagination.totalPages}
                                        className="w-10 h-10 rounded-xl bg-surface border-border hover:bg-surface disabled:opacity-30 transition-all"
                                    >
                                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                    </Button>
                                </div>
                                <div className="text-caption font-black uppercase tracking-[0.2em] text-muted-foreground">
                                    Total: {pagination.totalCount.toLocaleString()} membres
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
    );
}
