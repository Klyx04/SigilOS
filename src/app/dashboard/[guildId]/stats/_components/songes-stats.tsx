"use client";

import { useState, useEffect } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Trophy, TrendingUp, Users2, UserCheck } from "lucide-react";

interface SongesStatsProps {
    songes: {
        total: number;
        completed: number;
        failed: number;
        abandoned: number;
        successRate: number;
        avgFloor: number;
        topLeaders: { name: string; value: number }[];
        totalCandidatures: number;
        acceptedCandidatures: number;
    };
}

const STATUS_COLORS: Record<string, string> = {
    Complétées: "#22c55e",
    Échouées: "#ef4444",
    Abandonnées: "#71717a",
};

export default function SongesStats({ songes }: SongesStatsProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const pieData = [
        { name: "Complétées", value: songes.completed },
        { name: "Échouées", value: songes.failed },
        { name: "Abandonnées", value: songes.abandoned },
    ].filter(d => d.value > 0);

    return (
        <div className="space-y-5">
            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-surface p-3 text-center">
                    <Trophy className="w-5 h-5 text-success mx-auto mb-1" />
                    <p className="text-2xl font-bold text-foreground">{songes.successRate}%</p>
                    <p className="text-xs text-muted-foreground">Taux succès</p>
                </div>
                <div className="rounded-lg bg-surface p-3 text-center">
                    <TrendingUp className="w-5 h-5 text-warning mx-auto mb-1" />
                    <p className="text-2xl font-bold text-foreground">{songes.avgFloor}</p>
                    <p className="text-xs text-muted-foreground">Étage moyen</p>
                </div>
                <div className="rounded-lg bg-surface p-3 text-center">
                    <Users2 className="w-5 h-5 text-violet-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-foreground">{songes.totalCandidatures}</p>
                    <p className="text-xs text-muted-foreground">Candidatures</p>
                </div>
                <div className="rounded-lg bg-surface p-3 text-center">
                    <UserCheck className="w-5 h-5 text-teal-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-foreground">{songes.acceptedCandidatures}</p>
                    <p className="text-xs text-muted-foreground">Acceptées</p>
                </div>
            </div>

            {/* Donut */}
            {pieData.length > 0 && (
                <div className="h-44">
                    {!mounted ? (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-caption italic bg-surface rounded-xl border border-dashed border-border">
                            Chargement du graphique...
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={65}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry) => (
                                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#8b5cf6"} />
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
                    )}
                    {mounted && (
                        <div className="flex gap-4 justify-center">
                            {pieData.map(d => (
                                <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.name] }} />
                                    {d.name} ({d.value})
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Top Leaders */}
            {songes.topLeaders.length > 0 && (
                <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top Leaders</h4>
                    <div className="space-y-1.5">
                        {songes.topLeaders.map((leader, i) => (
                            <div key={leader.name} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground w-4 font-mono">{i + 1}.</span>
                                <span className="text-foreground font-medium truncate flex-1">{leader.name}</span>
                                <span className="text-success font-bold">{leader.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
