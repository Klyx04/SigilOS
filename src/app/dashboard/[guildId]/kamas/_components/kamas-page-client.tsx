"use client";

import { useState, useCallback } from "react";
import { Coins, Trophy, Users, TrendingUp, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KamaDonationForm } from "@/components/kamas/kama-donation-form";
import { KamaDonationList } from "@/components/kamas/kama-donation-list";
import {
    getKamaDonations, getKamaLadder, getKamaStats,
    type KamaDonationEntry, type KamaLadderEntry, type KamaStats
} from "@/server/actions/kama-actions";

type KamaDonationStatus = "PENDING" | "VALIDATED" | "REJECTED";
type FilterKey = "ALL" | KamaDonationStatus;

const FILTER_TABS: { key: FilterKey; label: string }[] = [
    { key: "ALL", label: "Tout" },
    { key: "PENDING", label: "En attente" },
    { key: "VALIDATED", label: "Validées" },
    { key: "REJECTED", label: "Refusées" },
];

interface KamasPageClientProps {
    guildId: string;
    initialDonations: KamaDonationEntry[];
    initialStats: KamaStats;
    initialLadder: KamaLadderEntry[];
    canReview: boolean;
    currentProfileId?: string;
}

export function KamasPageClient({ guildId, initialDonations, initialStats, initialLadder, canReview, currentProfileId }: KamasPageClientProps) {
    const [donations, setDonations] = useState(initialDonations);
    const [stats, setStats] = useState(initialStats);
    const [ladder, setLadder] = useState(initialLadder);
    const [activeTab, setActiveTab] = useState<FilterKey>("ALL");
    const [activeView, setActiveView] = useState<"donations" | "ladder">("donations");
    const [ladderPeriod, setLadderPeriod] = useState<"week" | "month" | "alltime">("alltime");
    const [refreshing, setRefreshing] = useState(false);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        const [dRes, sRes, lRes] = await Promise.all([
            getKamaDonations(guildId, { limit: 50 }),
            getKamaStats(guildId),
            getKamaLadder(guildId, ladderPeriod),
        ]);
        if (dRes.data) setDonations(dRes.data);
        if (sRes.data) setStats(sRes.data);
        if (lRes.data) setLadder(lRes.data);
        setRefreshing(false);
    }, [guildId, ladderPeriod]);

    const handleLadderPeriod = async (period: "week" | "month" | "alltime") => {
        setLadderPeriod(period);
        const res = await getKamaLadder(guildId, period);
        if (res.data) setLadder(res.data);
    };

    const filteredDonations = activeTab === "ALL"
        ? donations
        : donations.filter((d: KamaDonationEntry) => d.status === activeTab);

    const pendingCount = donations.filter((d: KamaDonationEntry) => d.status === "PENDING").length;

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: "Total validé", value: stats.totalValidated.toLocaleString("fr-FR"), unit: "k", icon: Coins, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
                    { label: "Cette semaine", value: stats.weeklyTotal.toLocaleString("fr-FR"), unit: "k", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                    { label: "Donateurs", value: stats.donorCount.toString(), unit: "membres", icon: Users, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
                    { label: "En attente", value: stats.totalPending.toLocaleString("fr-FR"), unit: "k", icon: Clock, color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20" },
                ].map(({ label, value, unit, icon: Icon, color, bg }) => (
                    <div key={label} className={`rounded-2xl border p-4 space-y-2 ${bg}`}>
                        <div className={`flex items-center gap-2 ${color}`}>
                            <Icon className="w-4 h-4" />
                            <span className="text-caption font-bold uppercase tracking-widest">{label}</span>
                        </div>
                        <div>
                            <span className={`text-2xl font-black font-mono ${color}`}>{value}</span>
                            <span className="text-xs text-zinc-600 ml-1">{unit}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* LEFT: Form */}
                <div className="lg:col-span-2">
                    <KamaDonationForm guildId={guildId} onSuccess={refresh} />
                </div>

                {/* RIGHT: Donations / Ladder */}
                <div className="lg:col-span-3 space-y-4">
                    {/* View tabs */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1 bg-zinc-900/60 rounded-xl p-1 border border-white/8">
                            {(["donations", "ladder"] as const).map(v => (
                                <button
                                    key={v}
                                    onClick={() => setActiveView(v)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${activeView === v ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                                >
                                    {v === "donations" ? "Historique" : "Classement"}
                                    {v === "donations" && pendingCount > 0 && canReview && (
                                        <span className="ml-1.5 bg-amber-500 text-black text-caption font-black px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={refresh}
                            disabled={refreshing}
                            className="text-zinc-500 hover:text-zinc-300 gap-1.5"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                        </Button>
                    </div>

                    {activeView === "donations" && (
                        <>
                            {/* Filter tabs */}
                            <div className="flex items-center gap-1 flex-wrap">
                                {FILTER_TABS.map((t: { key: FilterKey; label: string }) => (
                                    <button
                                        key={t.key}
                                        onClick={() => setActiveTab(t.key)}
                                        className={`px-3 py-1 rounded-lg text-caption font-bold uppercase tracking-wider transition-all duration-200 ${activeTab === t.key ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                                    >
                                        {t.label}
                                        {t.key === "PENDING" && pendingCount > 0 && (
                                            <span className="ml-1 text-amber-400">({pendingCount})</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-zinc-900/60 p-4 max-h-[600px] overflow-y-auto space-y-1">
                                <KamaDonationList
                                    guildId={guildId}
                                    donations={filteredDonations}
                                    canReview={canReview}
                                    currentProfileId={currentProfileId}
                                    onRefresh={refresh}
                                />
                            </div>
                        </>
                    )}

                    {activeView === "ladder" && (
                        <>
                            {/* Period selector */}
                            <div className="flex items-center gap-1 bg-zinc-900/60 rounded-xl p-1 border border-white/8 w-fit">
                                {
                                    ([["week", "Semaine"], ["month", "Mois"], ["alltime", "Total"]] as const).map(([p, l]) => (
                                        <button
                                            key={p}
                                            onClick={() => handleLadderPeriod(p)}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${ladderPeriod === p ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                                        >
                                            {l}
                                        </button>
                                    ))
                                }
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-zinc-900/60 overflow-hidden">
                                <div className="p-4 space-y-2">
                                    {ladder.length === 0 && (
                                        <div className="text-center py-10 text-zinc-600">
                                            <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">Aucun don validé pour cette période.</p>
                                        </div>
                                    )}
                                    {ladder.map((entry: KamaLadderEntry) => (
                                        <div
                                            key={entry.profileId}
                                            className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${entry.isCurrentUser ? "bg-amber-500/5 border border-amber-500/20" : "hover:bg-white/[0.02] border border-transparent"}`}
                                        >
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${entry.rank === 1 ? "bg-amber-400 text-black" : entry.rank === 2 ? "bg-zinc-400 text-black" : entry.rank === 3 ? "bg-amber-700 text-white" : "bg-zinc-800 text-zinc-400"}`}>
                                                {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : entry.rank}
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                                                {entry.discordImage
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    ? <img src={entry.discordImage} alt="" className="w-full h-full object-cover" />
                                                    : <span className="text-xs font-bold text-zinc-400">{(entry.pseudoDofus || entry.discordNickname || "?")[0].toUpperCase()}</span>
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold truncate ${entry.isCurrentUser ? "text-amber-300" : "text-white"}`}>
                                                    {entry.pseudoDofus || entry.discordNickname || "Membre"}
                                                </p>
                                                <p className="text-caption text-zinc-600">{entry.donationCount} don{entry.donationCount > 1 ? "s" : ""}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-black text-amber-400 font-mono">{entry.totalAmount.toLocaleString("fr-FR")}</p>
                                                <p className="text-caption text-zinc-600 uppercase font-bold">kamas</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
