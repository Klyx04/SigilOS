"use client";

import React from "react";
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    Cell,
    PieChart,
    Pie
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquare, Mic, Activity, Ghost } from "lucide-react";
import { MemberReconciliationData } from "@/server/actions/member-actions";

interface MemberDiscordChartsProps {
    members: MemberReconciliationData[];
}

export function MemberDiscordCharts({ members }: MemberDiscordChartsProps) {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    // 1. Calculate general activity status
    const activeCount = members.filter(m => (m.discordMessageCountWeekly || 0) > 0 || (m.discordVoiceTimeWeekly || 0) > 0).length;
    const silentCount = Math.max(0, members.length - activeCount);

    const activityData = [
        { name: "Actifs", value: activeCount, color: "#8b5cf6" }, // Violet
        { name: "Silencieux", value: silentCount, color: "#3f3f46" } // Zinc-700
    ];

    if (!mounted) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[300px]">
                {[1, 2, 3].map(i => (
                    <Card key={i} className="bg-zinc-900/30 border-white/5 animate-pulse rounded-[32px] overflow-hidden shadow-2xl" />
                ))}
            </div>
        );
    }

    // 2. Top Talkers
    const topTalkers = [...members]
        .sort((a, b) => (b.discordMessageCountWeekly || 0) - (a.discordMessageCountWeekly || 0))
        .slice(0, 5)
        .map(m => ({
            name: m.displayName.split(" ")[0],
            value: m.discordMessageCountWeekly || 0
        }));

    // 3. Top Vocal
    const topVocal = [...members]
        .sort((a, b) => (b.discordVoiceTimeWeekly || 0) - (a.discordVoiceTimeWeekly || 0))
        .slice(0, 5)
        .map(m => ({
            name: m.displayName.split(" ")[0],
            value: Math.round((m.discordVoiceTimeWeekly || 0) / 60) // Convert to hours for chart
        }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Activity Overview */}
            <Card className="bg-zinc-900/30 border-white/5 backdrop-blur-xl rounded-[32px] overflow-hidden shadow-2xl relative">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-white italic flex items-center gap-2">
                        <Activity className="w-4 h-4 text-violet-400" />
                        État d&apos;activité
                    </CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold text-zinc-500">Membres ayant participé cette semaine</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] relative min-h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
                        <PieChart>
                            <Pie
                                data={activityData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {activityData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ backgroundColor: "#09090b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "10px", fontWeight: "bold" }}
                                itemStyle={{ color: "#fff" }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
                        <span className="text-3xl font-black text-white">{Math.round((activeCount / members.length) * 100)}%</span>
                        <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">Actif</span>
                    </div>
                </CardContent>
            </Card>

            {/* Top Messages */}
            <Card className="bg-zinc-900/30 border-white/5 backdrop-blur-xl rounded-[32px] overflow-hidden shadow-2xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-white italic flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-400" />
                        Top Bavards
                    </CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold text-zinc-500">Volume de messages par membre</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] pt-4 min-h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
                        <BarChart data={topTalkers} margin={{ top: 0, right: 30, left: -20, bottom: 0 }}>
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: "#71717a", fontSize: 10, fontWeight: "bold" }} 
                            />
                            <YAxis hide />
                            <Tooltip 
                                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                                contentStyle={{ backgroundColor: "#09090b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "10px", fontWeight: "bold" }}
                            />
                            <Bar 
                                dataKey="value" 
                                fill="#3b82f6" 
                                radius={[8, 8, 8, 8]} 
                                barSize={25}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Top Vocal */}
            <Card className="bg-zinc-900/30 border-white/5 backdrop-blur-xl rounded-[32px] overflow-hidden shadow-2xl">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-black uppercase tracking-[0.2em] text-white italic flex items-center gap-2">
                        <Mic className="w-4 h-4 text-emerald-400" />
                        Top Vidéo/Vocal
                    </CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold text-zinc-500">Temps de parole (heures cumulées)</CardDescription>
                </CardHeader>
                <CardContent className="h-[250px] pt-4 min-h-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
                        <BarChart data={topVocal} margin={{ top: 0, right: 30, left: -20, bottom: 0 }}>
                            <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fill: "#71717a", fontSize: 10, fontWeight: "bold" }} 
                            />
                            <YAxis hide />
                            <Tooltip 
                                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                                contentStyle={{ backgroundColor: "#09090b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "10px", fontWeight: "bold" }}
                            />
                            <Bar 
                                dataKey="value" 
                                fill="#10b981" 
                                radius={[8, 8, 8, 8]} 
                                barSize={25}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
