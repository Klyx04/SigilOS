"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Clock, Trophy } from "lucide-react";
import { LeaderboardCard } from "./leaderboard-card";
import {
    getActivityLadder,
    getSeniorityLadder,
    getSuccessLadder,
    type LadderEntry,
    type ActivityView
} from "@/server/actions/ladder-actions";
import { formatSeniority } from "@/lib/ladder-utils";

type Props = {
    guildId: string;
};

export function LadderTabs({ guildId }: Props) {
    const [activeTab, setActiveTab] = useState<"activity" | "seniority" | "success">("activity");
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
                case "seniority":
                    result = await getSeniorityLadder(guildId);
                    break;
                case "success":
                    result = await getSuccessLadder(guildId);
                    break;
            }

            if (result.success && result.data) {
                setLadder(result.data);
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
            case "seniority":
                return formatSeniority(entry.value);
            case "success":
                return `${entry.value.toLocaleString()} pts`;
            default:
                return entry.value.toString();
        }
    };

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <TabsList className="bg-muted/30 border border-white/20 p-1">
                        <TabsTrigger
                            value="activity"
                            className="gap-2 text-foreground data-[state=active]:bg-purple-500/30 data-[state=active]:text-purple-200 data-[state=active]:shadow-sm"
                        >
                            <TrendingUp className="h-4 w-4" />
                            Activité
                        </TabsTrigger>
                        <TabsTrigger
                            value="seniority"
                            className="gap-2 text-foreground data-[state=active]:bg-cyan-500/30 data-[state=active]:text-cyan-200 data-[state=active]:shadow-sm"
                        >
                            <Clock className="h-4 w-4" />
                            Ancienneté
                        </TabsTrigger>
                        <TabsTrigger
                            value="success"
                            className="gap-2 text-foreground data-[state=active]:bg-amber-500/30 data-[state=active]:text-amber-200 data-[state=active]:shadow-sm"
                        >
                            <Trophy className="h-4 w-4" />
                            Succès
                        </TabsTrigger>
                    </TabsList>

                    {/* View Toggle for Activity */}
                    {activeTab === "activity" && (
                        <Select value={activityView} onValueChange={(v) => setActivityView(v as ActivityView)}>
                            <SelectTrigger className="w-[200px] bg-muted/30 border-white/20 text-foreground">
                                <SelectValue placeholder="Période" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="weekly">📅 Cette semaine</SelectItem>
                                <SelectItem value="monthly">📅 Ce mois-ci</SelectItem>
                                <SelectItem value="alltime">🏆 Global (All-Time)</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
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
    accentColor: "purple" | "cyan" | "amber";
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
