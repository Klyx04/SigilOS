"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RunCard } from "./RunCard";
import type { DreamRun, DreamRunMember, DreamWaitlist } from "@prisma/client";
import { Moon, Sparkles, Flame, Star } from "lucide-react";

type RunWithRelations = DreamRun & {
    members: DreamRunMember[];
    waitlist: DreamWaitlist[];
    joinRequests?: { id: string; userId: string }[];
    _count: { floors: number; bonuses: number };
};

interface RunCardGridProps {
    runs: RunWithRelations[];
    currentUserId?: string;
}

type TierFilter = "ALL" | "REVE" | "PARADOXE" | "CAUCHEMAR";

const TIER_CONFIG: Record<TierFilter, { label: string; icon: React.ReactNode; color: string; activeColor: string }> = {
    ALL: {
        label: "Tous",
        icon: <Star className="w-4 h-4" />,
        color: "text-purple-300 border-purple-500/30 hover:bg-purple-500/20",
        activeColor: "bg-purple-600 text-white border-purple-600"
    },
    REVE: {
        label: "Rêve",
        icon: <Moon className="w-4 h-4" />,
        color: "text-green-300 border-green-500/30 hover:bg-green-500/20",
        activeColor: "bg-green-600 text-white border-green-600"
    },
    PARADOXE: {
        label: "Paradoxe",
        icon: <Sparkles className="w-4 h-4" />,
        color: "text-amber-300 border-amber-500/30 hover:bg-amber-500/20",
        activeColor: "bg-amber-600 text-white border-amber-600"
    },
    CAUCHEMAR: {
        label: "Cauchemar",
        icon: <Flame className="w-4 h-4" />,
        color: "text-red-300 border-red-500/30 hover:bg-red-500/20",
        activeColor: "bg-red-600 text-white border-red-600"
    },
};

export function RunCardGrid({ runs: initialRuns, currentUserId }: RunCardGridProps) {
    const router = useRouter();
    const [runs, setRuns] = useState(initialRuns);
    const [tierFilter, setTierFilter] = useState<TierFilter>("ALL");

    // Polling for real-time updates (every 30 seconds to avoid rate limits)
    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
        }, 30000);

        return () => clearInterval(interval);
    }, [router]);

    // Update runs when initialRuns changes
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
                                ${isActive ? "bg-white/20" : "bg-current/10"}
                            `}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Grid or Empty State */}
            {filteredRuns.length === 0 ? (
                <div className="text-center py-16">
                    <div className="text-6xl mb-4">🌙</div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                        {tierFilter === "ALL" ? "Aucune run en cours" : `Aucune run ${TIER_CONFIG[tierFilter].label}`}
                    </h3>
                    <p className="text-purple-300/70">
                        {tierFilter === "ALL"
                            ? "Créez une nouvelle run pour commencer l'aventure dans les Songes Infinis"
                            : "Changez de filtre ou créez une nouvelle run"
                        }
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRuns.map((run) => (
                        <RunCard key={run.id} run={run} currentUserId={currentUserId} />
                    ))}
                </div>
            )}
        </div>
    );
}

