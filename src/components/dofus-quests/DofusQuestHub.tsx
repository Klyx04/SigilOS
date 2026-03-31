"use client";

import { useState } from "react";
import { Gem, Users, Filter, Search, Crown, Sparkles } from "lucide-react";
import { DofusGemCard } from "./DofusGemCard";
import { GuildDofusOverview } from "./GuildDofusOverview";
import type { DofusItemWithProgress, GuildDofusStats, MemberDofusSummary, WarRoomData } from "@/server/actions/dofus-quest-actions";

type Tab = "mes-dofus" | "guilde";
type FilterCategory = "Tous" | "Primordiaux" | "Prérequis Sylvestre" | "Autres";
type FilterSubCategory = "Tous" | "4/6" | "6/6";
interface DofusQuestHubProps {
    dofusList: DofusItemWithProgress[];
    guildStats: { stats: GuildDofusStats[]; topMembers: MemberDofusSummary[]; totalMembers: number } | null;
    warRoomData: WarRoomData | null;
    guildId: string;
}

export function DofusQuestHub({ dofusList, guildStats, warRoomData, guildId }: DofusQuestHubProps) {
    const [activeTab, setActiveTab] = useState<Tab>("mes-dofus");
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState<FilterCategory>("Tous");
    const [subCategory, setSubCategory] = useState<FilterSubCategory>("Tous");
    const [statusFilter, setStatusFilter] = useState<"Tous" | "Obtenus" | "En cours" | "À faire">("Tous");

    const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: "mes-dofus", label: "Mes Dofus", icon: Gem },
        { id: "guilde", label: "Guilde", icon: Users },
    ];

    const categories: FilterCategory[] = ["Tous", "Primordiaux", "Prérequis Sylvestre", "Autres"];
    const subCategories: FilterSubCategory[] = ["Tous", "4/6", "6/6"];
    const statusFilters = ["Tous", "Obtenus", "En cours", "À faire"] as const;

    // Compute summary stats
    const totalObtained = dofusList.filter((d) => d.isObtained).length;
    const totalInProgress = dofusList.filter((d) => !d.isObtained && d.progressPercent > 0).length;
    const overallPercent = dofusList.length > 0
        ? Math.round((totalObtained / dofusList.length) * 100)
        : 0;

    // Filter + search
    const filtered = dofusList
        .filter((d) => {
            if (search) {
                return d.name.toLowerCase().includes(search.toLowerCase()) ||
                    d.nameShort.toLowerCase().includes(search.toLowerCase());
            }
            return true;
        })
        .filter((d) => {
            if (category !== "Tous" && d.filterCategory !== category) return false;
            if (category === "Primordiaux" && subCategory !== "Tous" && d.filterSubCategory !== subCategory) return false;
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
        <div className="flex flex-col gap-6">
            {/* ── Header summary cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <SummaryCard
                    icon={<Crown className="w-4 h-4 text-amber-400" />}
                    label="Dofus obtenus"
                    value={`${totalObtained}/${dofusList.length}`}
                    color="#fbbf24"
                />
                <SummaryCard
                    icon={<Sparkles className="w-4 h-4 text-indigo-400" />}
                    label="En progression"
                    value={String(totalInProgress)}
                    color="#6366f1"
                />
                <SummaryCard
                    className="hidden sm:flex"
                    icon={<Gem className="w-4 h-4 text-emerald-400" />}
                    label="Complétion globale"
                    value={`${overallPercent}%`}
                    color="#10b981"
                />
            </div>

            {/* ── Tabs ── */}
            <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                            style={{
                                background: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                                color: isActive ? "white" : "rgba(255,255,255,0.4)",
                                boxShadow: isActive ? "0 1px 8px rgba(0,0,0,0.3)" : "none",
                            }}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Mes Dofus tab ── */}
            {activeTab === "mes-dofus" && (
                <div className="flex flex-col gap-5">
                    {/* Filters row */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search */}
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                            <input
                                type="text"
                                placeholder="Rechercher un Dofus..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
                                aria-label="Rechercher un Dofus"
                            />
                        </div>

                        {/* Category Filter */}
                        <div className="flex gap-1.5 flex-wrap">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => {
                                        setCategory(cat);
                                        if (cat !== "Primordiaux") setSubCategory("Tous");
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                                    style={{
                                        background: category === cat ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)",
                                        color: category === cat ? "#818cf8" : "rgba(255,255,255,0.4)",
                                        border: `1px solid ${category === cat ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`,
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Status Filter */}
                        <div className="flex gap-1.5 flex-wrap ml-auto">
                            {statusFilters.map((opt) => (
                                <button
                                    key={opt}
                                    onClick={() => setStatusFilter(opt)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                                    style={{
                                        background: statusFilter === opt ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.05)",
                                        color: statusFilter === opt ? "#fbbf24" : "rgba(255,255,255,0.4)",
                                        border: `1px solid ${statusFilter === opt ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.08)"}`,
                                    }}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subcategories if needed */}
                    {category === "Primordiaux" && (
                        <div className="flex gap-1.5 flex-wrap">
                            {subCategories.map((sub) => (
                                <button
                                    key={sub}
                                    onClick={() => setSubCategory(sub)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-black transition-all duration-200 italic"
                                    style={{
                                        background: subCategory === sub ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.05)",
                                        color: subCategory === sub ? "#34d399" : "rgba(255,255,255,0.4)",
                                        border: `1px solid ${subCategory === sub ? "rgba(16,185,129,0.5)" : "rgba(255,255,255,0.08)"}`,
                                    }}
                                >
                                    {sub}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Grid */}
                    {filtered.length === 0 ? (
                        <div className="text-center py-12 text-white/25 text-sm">
                            Aucun Dofus trouvé pour ce filtre
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {filtered.map((dofus) => (
                                <DofusGemCard key={dofus.id} dofus={dofus} guildId={guildId} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Guilde tab ── */}
            {activeTab === "guilde" && (
                <div>
                    {guildStats ? (
                        <GuildDofusOverview
                            stats={guildStats.stats}
                            topMembers={guildStats.topMembers}
                            totalMembers={guildStats.totalMembers}
                            warRoom={warRoomData}
                        />
                    ) : (
                        <div className="text-center py-12 text-white/25 text-sm">
                            Données de guilde indisponibles
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({
    icon,
    label,
    value,
    color,
    className,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    color: string;
    className?: string;
}) {
    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl ${className || ""}`}
            style={{
                background: `${color}0a`,
                border: `1px solid ${color}22`,
            }}
        >
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}18` }}
            >
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-xs text-white/40 leading-tight truncate">{label}</p>
                <p className="text-lg font-bold tabular-nums leading-tight" style={{ color }}>
                    {value}
                </p>
            </div>
        </div>
    );
}
