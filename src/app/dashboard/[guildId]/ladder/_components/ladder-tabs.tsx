"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Clock, Trophy, HandHeart } from "lucide-react";
import { LeaderboardCard } from "./leaderboard-card";
import {
    getActivityLadder,
    getSeniorityLadder,
    getSuccessLadder,
    getContributionLadder,
    getGeneralLadder,
    type LadderEntry,
    type ActivityView
} from "@/server/actions/ladder-actions";
import { formatSeniority } from "@/lib/ladder-utils";

type Props = {
    guildId: string;
};

export function LadderTabs({ guildId }: Props) {
    const [activeTab, setActiveTab] = useState<"activity" | "contribution" | "seniority" | "success" | "general">("activity");
    const [activityView, setActivityView] = useState<ActivityView>("weekly");
    const [ladder, setLadder] = useState<LadderEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadLadder() {
            setLoading(true);
            let result;

            switch (activeTab) {
                case "activity":
                    result = await getActivityLadder(guildId, activityView);
                    break;
                case "contribution":
                    result = await getContributionLadder(guildId);
                    break;
                case "seniority":
                    result = await getSeniorityLadder(guildId);
                    break;
                case "success":
                    result = await getSuccessLadder(guildId);
                    break;
                case "general":
                    result = await getGeneralLadder(guildId);
                    break;
            }

            if (result.success && result.data) {
                setLadder(result.data.entries);
            } else {
                setLadder([]);
            }
            setLoading(false);
        }

        loadLadder();
    }, [guildId, activeTab, activityView]);

    const getValueLabel = (entry: LadderEntry): string => {
        switch (activeTab) {
            case "activity":
                return `${entry.value.toLocaleString()} XP`;
            case "contribution":
                return `${entry.value.toLocaleString()} pts`;
            case "seniority":
                return formatSeniority(entry.value);
            case "success":
                return `${entry.value.toLocaleString()} pts`;
            case "general":
                return `${Number(entry.totalXpBigInt || 0).toLocaleString()} XP`;
            default:
                return entry.value.toString();
        }
    };

    const categories = [
        { id: "activity", label: "Activité", icon: TrendingUp, color: "purple" },
        { id: "contribution", label: "Contribution", icon: HandHeart, color: "emerald" },
        { id: "seniority", label: "Ancienneté", icon: Clock, color: "cyan" },
        { id: "success", label: "Succès", icon: Trophy, color: "amber" },
        { id: "general", label: "Général", icon: TrendingUp, color: "blue" },
    ] as const;

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <div className="flex flex-col gap-6">
                    {/* Responsive Tabs Header */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Scrollable container for tabs */}
                        <div className="relative w-full overflow-hidden border-b border-border">
                            <TabsList className="flex w-full h-auto bg-transparent p-0 justify-start overflow-x-auto overflow-y-hidden no-scrollbar scroll-smooth rounded-none">
                                {categories.map((cat) => (
                                    <TabsTrigger
                                        key={cat.id}
                                        value={cat.id}
                                        className={`flex-shrink-0 gap-2 px-6 py-4 text-sm font-bold uppercase tracking-wider transition-all duration-300 rounded-none border-b-2 border-transparent shadow-none
                                            data-[state=active]:border-${cat.color}-500 data-[state=active]:text-${cat.color}-400 data-[state=active]:bg-transparent
                                            text-muted-foreground hover:text-foreground hover:bg-surface bg-transparent`}
                                    >
                                        <cat.icon className="h-4 w-4" />
                                        {cat.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                            {/* Mobile visual hint for scrolling */}
                            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none lg:hidden" />
                        </div>

                        {/* View Toggle for Activity */}
                        {activeTab === "activity" && (
                            <div className="flex justify-end">
                                <Select value={activityView} onValueChange={(v) => setActivityView(v as ActivityView)}>
                                    <SelectTrigger className="w-full sm:w-[220px] bg-muted/40 border-border text-foreground rounded-xl backdrop-blur-md">
                                        <SelectValue placeholder="Période" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-surface border-border text-foreground">
                                        <SelectItem value="weekly">📅 Hebdomadaire (RESET MARDI)</SelectItem>
                                        <SelectItem value="monthly">📅 Mensuel</SelectItem>
                                        <SelectItem value="alltime">🏆 Historique Global</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </div>

                <TabsContent value="activity" className="mt-6">
                    <LeaderboardList
                        ladder={ladder}
                        loading={loading}
                        getValueLabel={getValueLabel}
                        emptyMessage="Aucune activité enregistrée pour cette période."
                        accentColor="purple"
                    />
                </TabsContent>

                <TabsContent value="contribution" className="mt-6">
                    <LeaderboardList
                        ladder={ladder}
                        loading={loading}
                        getValueLabel={getValueLabel}
                        emptyMessage="Aucun point de contribution enregistré."
                        accentColor="emerald"
                    />
                </TabsContent>

                <TabsContent value="seniority" className="mt-6">
                    <LeaderboardList
                        ladder={ladder}
                        loading={loading}
                        getValueLabel={getValueLabel}
                        emptyMessage="Aucun membre avec date d'arrivée."
                        accentColor="cyan"
                    />
                </TabsContent>

                <TabsContent value="success" className="mt-6">
                    <LeaderboardList
                        ladder={ladder}
                        loading={loading}
                        getValueLabel={getValueLabel}
                        emptyMessage="Aucun score de succès enregistré."
                        accentColor="amber"
                    />
                </TabsContent>

                <TabsContent value="general" className="mt-6">
                    <LeaderboardList
                        ladder={ladder}
                        loading={loading}
                        getValueLabel={getValueLabel}
                        emptyMessage="Aucune donnée d'EXP Ankama synchronisée."
                        accentColor="blue"
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// Leaderboard List Component
function LeaderboardList({
    ladder,
    loading,
    getValueLabel,
    emptyMessage,
    accentColor
}: {
    ladder: LadderEntry[];
    loading: boolean;
    getValueLabel: (entry: LadderEntry) => string;
    emptyMessage: string;
    accentColor: "purple" | "cyan" | "amber" | "emerald" | "blue";
}) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 gap-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-20 bg-muted/10 rounded-xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (ladder.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <p>{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-3">
            {ladder.map((entry) => (
                <LeaderboardCard
                    key={entry.profileId}
                    entry={entry}
                    valueLabel={getValueLabel(entry)}
                    accentColor={accentColor}
                />
            ))}
        </div>
    );
}
