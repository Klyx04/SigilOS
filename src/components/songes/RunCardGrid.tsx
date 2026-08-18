"use client";

import { useState, useEffect, useMemo } from "react";
import { RunCard } from "./RunCard";
import type { DreamRun, DreamRunMember, DreamWaitlist } from "@prisma/client";
import { Moon, Sparkles, Flame, Star } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

type RunWithRelations = DreamRun & {
    members: DreamRunMember[];
    waitlist: DreamWaitlist[];
    joinRequests?: { id: string; userId: string; message: string | null; classe: string; }[];
    _count: { floors: number; bonuses: number };
};

interface RunCardGridProps {
    runs: RunWithRelations[];
    currentUserId?: string;
    canJoinSonges?: boolean;
    isAdmin?: boolean;
    isDiscordConfigured?: boolean;
}

type TierFilter = "ALL" | "REVE" | "PARADOXE" | "CAUCHEMAR";

const TIER_CONFIG: Record<TierFilter, { label: string; icon: React.ReactNode; color: string; activeColor: string }> = {
    ALL: {
        label: "Tous",
        icon: <Star className="w-4 h-4" />,
        color: "text-purple-700 dark:text-purple-300 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20",
        activeColor: "bg-purple-600 text-white border-purple-600 shadow-sm"
    },
    REVE: {
        label: "Rêve",
        icon: <Moon className="w-4 h-4" />,
        color: "text-emerald-700 dark:text-emerald-300 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20",
        activeColor: "bg-emerald-600 text-white border-emerald-600 shadow-sm"
    },
    PARADOXE: {
        label: "Paradoxe",
        icon: <Sparkles className="w-4 h-4" />,
        color: "text-amber-700 dark:text-amber-300 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20",
        activeColor: "bg-amber-500 text-white border-amber-500 shadow-sm"
    },
    CAUCHEMAR: {
        label: "Cauchemar",
        icon: <Flame className="w-4 h-4" />,
        color: "text-red-700 dark:text-red-300 border-red-500/30 bg-red-500/10 hover:bg-red-900/20",
        activeColor: "bg-red-600 text-white border-red-600 shadow-sm"
    },
};

export function RunCardGrid({ runs: initialRuns, currentUserId, canJoinSonges, isAdmin = false, isDiscordConfigured = false }: RunCardGridProps) {
    const [runs, setRuns] = useState(initialRuns);
    const [tierFilter, setTierFilter] = useState<TierFilter>("ALL");

    // Update runs when initialRuns changes (after server actions)
    useEffect(() => {
        setRuns(initialRuns);
    }, [initialRuns]);

    // Filter runs by tier
    const filteredRuns = useMemo(() => {
        if (tierFilter === "ALL") return runs;
        return runs.filter(run => run.difficulty.startsWith(tierFilter));
    }, [runs, tierFilter]);

    // Count runs per tier for badges
    const tierCounts = useMemo(() => ({
        ALL: runs.length,
        REVE: runs.filter(r => r.difficulty.startsWith("REVE")).length,
        PARADOXE: runs.filter(r => r.difficulty.startsWith("PARADOXE")).length,
        CAUCHEMAR: runs.filter(r => r.difficulty.startsWith("CAUCHEMAR")).length,
    }), [runs]);

    return (
        <div className="space-y-4">
            {/* Tier Filter */}
            <div className="flex flex-wrap gap-2">
                {(Object.keys(TIER_CONFIG) as TierFilter[]).map((tier) => {
                    const config = TIER_CONFIG[tier];
                    const isActive = tierFilter === tier;
                    const count = tierCounts[tier];

                    return (
                        <button
                            key={tier}
                            onClick={() => setTierFilter(tier)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200
                                ${isActive ? config.activeColor : config.color}
                            `}
                        >
                            {config.icon}
                            <span className="font-medium">{config.label}</span>
                            <span className={`
                                text-xs px-1.5 py-0.5 rounded-full
                                ${isActive ? "bg-elevated" : "bg-current/10"}
                            `}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Grid or Empty State */}
            {filteredRuns.length === 0 ? (
                <EmptyState
                    icon={Moon}
                    title={tierFilter === "ALL" ? "Aucune run en cours" : `Aucune run ${TIER_CONFIG[tierFilter].label}`}
                    description={tierFilter === "ALL"
                        ? "Créez une nouvelle run pour commencer l'aventure dans les Songes Infinis."
                        : "Changez de filtre ou créez une nouvelle run."
                    }
                    variant="premium"
                    className="py-20"
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredRuns.map((run) => (
                        <RunCard
                            key={run.id}
                            run={run}
                            currentUserId={currentUserId}
                            canJoinSonges={canJoinSonges}
                            isAdmin={isAdmin}
                            isDiscordConfigured={isDiscordConfigured}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

