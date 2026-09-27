"use client";

import { useState, useEffect, useMemo } from "react";
import { RunCard } from "./RunCard";
import type { DreamRun, DreamRunMember, DreamWaitlist } from "@prisma/client";
import { Moon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SongesPicto } from "./SongesPicto";

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

/**
 * Filtres par palier — pictos Dofus officiels (`/assets/missions/*`, les mêmes que
 * les embeds et les cartes) et style NEUTRE : le module est dark-locked, donc plus
 * de couples `light/dark` (text-purple-700 dark:text-purple-300) ni de pastilles
 * arc-en-ciel — l'état actif est neutre, l'accent reste unique (comme les filtres DJ).
 */
const TIER_CONFIG: Record<TierFilter, { label: string; asset: string; color: string; activeColor: string }> = {
    ALL: {
        label: "Tous",
        asset: "/assets/missions/songes.png",
        color: "text-muted-foreground border-border bg-surface/40 hover:text-foreground hover:bg-elevated",
        activeColor: "bg-elevated border-border-strong text-foreground shadow-sm",
    },
    REVE: {
        label: "Rêve",
        asset: "/assets/missions/reve1.png",
        color: "text-muted-foreground border-border bg-surface/40 hover:text-foreground hover:bg-elevated",
        activeColor: "bg-elevated border-border-strong text-foreground shadow-sm",
    },
    PARADOXE: {
        label: "Paradoxe",
        asset: "/assets/missions/paradoxe1.png",
        color: "text-muted-foreground border-border bg-surface/40 hover:text-foreground hover:bg-elevated",
        activeColor: "bg-elevated border-border-strong text-foreground shadow-sm",
    },
    CAUCHEMAR: {
        label: "Cauchemar",
        asset: "/assets/missions/cauchemar1.png",
        color: "text-muted-foreground border-border bg-surface/40 hover:text-foreground hover:bg-elevated",
        activeColor: "bg-elevated border-border-strong text-foreground shadow-sm",
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
                            aria-pressed={isActive}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all duration-200
                                ${isActive ? config.activeColor : config.color}
                            `}
                        >
                            <SongesPicto asset={config.asset} size={16} title={config.label} />
                            <span>{config.label}</span>
                            <span className={`
                                text-xs px-1.5 py-0.5 rounded-full font-black
                                ${isActive ? "bg-background/60 text-foreground" : "bg-surface text-muted-foreground"}
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

