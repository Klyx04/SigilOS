"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { HandHeart, ArrowLeftRight, Vote, Gift } from "lucide-react";

interface CommunityStatsProps {
    community: {
        topHelpers: { name: string; value: number }[];
        totalContributionPoints: number;
        ocreTradesAccepted: number;
        pollsCreated: number;
        pollParticipationRate: number;
        bonusesPurchased: number;
        bonusByType: { type: string; count: number }[];
    };
}

const BONUS_LABELS: Record<string, string> = {
    FORTUNE: "Fortune",
    GLADIATOR: "Gladiateur",
    HARVESTER: "Rékloots",
    WISDOM: "Sagesse",
    DIVINE: "Divine",
};

const BONUS_COLORS = ["#f59e0b", "#ef4444", "#22c55e", "#8b5cf6", "#06b6d4"];

export default function CommunityStats({ community }: CommunityStatsProps) {
    const bonusPie = community.bonusByType.map(b => ({
        name: BONUS_LABELS[b.type] || b.type,
        value: b.count,
    }));

    return (
        <div className="space-y-5">
            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/5 p-3 text-center">
                    <HandHeart className="w-5 h-5 text-pink-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{community.totalContributionPoints.toLocaleString("fr-FR")}</p>
                    <p className="text-xs text-zinc-500">Pts contribution</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3 text-center">
                    <ArrowLeftRight className="w-5 h-5 text-teal-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{community.ocreTradesAccepted}</p>
                    <p className="text-xs text-zinc-500">Échanges Ocre</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3 text-center">
                    <Vote className="w-5 h-5 text-violet-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{community.pollsCreated}</p>
                    <p className="text-xs text-zinc-500">Sondages ({community.pollParticipationRate}% particip.)</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3 text-center">
                    <Gift className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-white">{community.bonusesPurchased}</p>
                    <p className="text-xs text-zinc-500">Bonus achetés</p>
                </div>
            </div>

            {/* Bonus donut */}
            {bonusPie.length > 0 && (
                <div>
                    <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Bonus par type</h4>
                    <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={bonusPie}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={30}
                                    outerRadius={55}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {bonusPie.map((_, i) => (
                                        <Cell key={i} fill={BONUS_COLORS[i % BONUS_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "rgba(24,24,27,0.95)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "8px",
                                        color: "#fff",
                                        fontSize: "13px",
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap gap-3 justify-center">
                            {bonusPie.map((d, i) => (
                                <div key={d.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: BONUS_COLORS[i % BONUS_COLORS.length] }} />
                                    {d.name}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Top Helpers */}
            {community.topHelpers.length > 0 && (
                <div>
                    <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Top Aidants</h4>
                    <div className="space-y-1.5">
                        {community.topHelpers.map((helper, i) => (
                            <div key={helper.name} className="flex items-center gap-2 text-sm">
                                <span className="text-zinc-600 w-4 font-mono">{i + 1}.</span>
                                <span className="text-white font-medium truncate flex-1">{helper.name}</span>
                                <span className="text-pink-400 font-bold">{helper.value} pts</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
