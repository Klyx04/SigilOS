"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Clock, Star } from "lucide-react";
import { LeaderboardCard } from "./leaderboard-card";
import { AchievementsPanel } from "./achievements-panel";
import {
    getActivityLadder,
    getSeniorityLadder,
    getAchievementsLadder,
    type LadderEntry,
    type ActivityView
} from "@/server/actions/ladder-actions";
import { formatSeniority } from "@/lib/ladder-utils";

type Props = {
    guildId: string;
};

export function LadderTabs({ guildId }: Props) {
    const [activeTab, setActiveTab] = useState<"activity" | "seniority" | "achievements">("activity");
    const [activityView, setActivityView] = useState<ActivityView>("monthly");
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
                case "achievements":
                    result = await getAchievementsLadder(guildId);
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
            case "achievements":
                return `${entry.value.toLocaleString()} pts`;
            default:
                return entry.value.toString();
        }
    };

    const getMaxValue = (): number => {
        if (ladder.length === 0) return 1;
        return Math.max(...ladder.map(e => e.value), 1);
    };

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <TabsList className="bg-muted/20 border border-white/10">
                        <TabsTrigger value="activity" className="gap-2 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
                            <TrendingUp className="h-4 w-4" />
                            Activité
                        </TabsTrigger>
                        <TabsTrigger value="seniority" className="gap-2 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300">
                            <Clock className="h-4 w-4" />
                            Ancienneté
                        </TabsTrigger>
                        <TabsTrigger value="achievements" className="gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
                            <Star className="h-4 w-4" />
                            Succès
                        </TabsTrigger>
                    </TabsList>

                    {/* View Toggle for Activity */}
                    {activeTab === "activity" && (
                        <Select value={activityView} onValueChange={(v) => setActivityView(v as ActivityView)}>
                            <SelectTrigger className="w-[180px] bg-muted/20 border-white/10">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="monthly">📅 Ce mois-ci</SelectItem>
                                <SelectItem value="alltime">🏆 Légende (All-Time)</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                </div>

                <TabsContent value="activity" className="mt-6">
                    <LeaderboardList
                        ladder={ladder}
                        loading={loading}
                        getValueLabel={getValueLabel}
                        maxValue={getMaxValue()}
                        emptyMessage="Aucune activité enregistrée pour cette période."
                        accentColor="purple"
                    />
                </TabsContent>

                <TabsContent value="seniority" className="mt-6">
                    <LeaderboardList
                        ladder={ladder}
                        loading={loading}
                        getValueLabel={getValueLabel}
                        maxValue={getMaxValue()}
                        emptyMessage="Aucun membre avec date d'arrivée."
                        accentColor="cyan"
                    />
                </TabsContent>

                <TabsContent value="achievements" className="mt-6">
                    <AchievementsPanel guildId={guildId} />
                    <div className="mt-6">
                        <LeaderboardList
                            ladder={ladder}
                            loading={loading}
                            getValueLabel={getValueLabel}
                            maxValue={getMaxValue()}
                            emptyMessage="Aucun participant. Renseigne tes points de succès pour apparaître !"
                            accentColor="amber"
                        />
                    </div>
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
    maxValue,
    emptyMessage,
    accentColor
}: {
    ladder: LadderEntry[];
    loading: boolean;
    getValueLabel: (entry: LadderEntry) => string;
    maxValue: number;
    emptyMessage: string;
    accentColor: "purple" | "cyan" | "amber";
}) {
    if (loading) {
        return (
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted/10 rounded-lg animate-pulse" />
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
        <div className="space-y-2">
            {ladder.map((entry) => (
                <LeaderboardCard
                    key={entry.profileId}
                    entry={entry}
                    valueLabel={getValueLabel(entry)}
                    progress={(entry.value / maxValue) * 100}
                    accentColor={accentColor}
                />
            ))}
        </div>
    );
}
