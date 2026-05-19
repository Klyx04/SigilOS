"use client";

import { useState } from "react";
import { BarChart3, Star, Coins, CheckCircle2, Target, Moon, CalendarDays, HandHeart, Trophy, Activity } from "lucide-react";
import StatCard from "@/app/dashboard/[guildId]/stats/_components/stat-card";
import ActivityChart from "@/app/dashboard/[guildId]/stats/_components/activity-chart";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

interface MemberStatsProps {
    stats: {
        xp: number;
        weeklyXp: number;
        guildatons: number;
        missionsValidated: number;
        weeklyMissions: number;
        rank?: number;
        weeklyActivity: { week: string; submissions: number; validated: number }[];
        missionsByCategory: { category: string; count: number; validated: number }[];
        totalGuildMissions: number;
        discordStats?: {
            weekly: { messages: number; voice: number };
            monthly: { messages: number; voice: number };
            total: { messages: number; voice: number };
        };
    };
}

const CATEGORY_LABELS: Record<string, string> = {
    DONJON: "Donjon",
    REGULATION: "Régulation",
    ANOMALIE: "Anomalie",
    SONGES: "Songes",
    EXPEDITION: "Expédition",
    EVENT: "Événement",
};

const COLORS = ["#8b5cf6", "#14b8a6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

export function MemberStats({ stats }: MemberStatsProps) {
    const [discordPeriod, setDiscordPeriod] = useState<"weekly" | "monthly" | "total">("weekly");

    const pieData = stats.missionsByCategory.map(c => ({
        name: CATEGORY_LABELS[c.category] || c.category,
        value: c.count,
    }));

    const validationRate = stats.missionsByCategory.reduce((acc, curr) => acc + curr.count, 0) > 0
        ? Math.round((stats.missionsValidated / stats.missionsByCategory.reduce((acc, curr) => acc + curr.count, 0)) * 100)
        : 0;

    const currentDiscordStats = stats.discordStats?.[discordPeriod] || { messages: 0, voice: 0 };
    const voiceHours = Math.floor(currentDiscordStats.voice / 60);
    const voiceMinutes = currentDiscordStats.voice % 60;

    const participationRate = stats.totalGuildMissions > 0 
        ? Math.round((stats.missionsValidated / stats.totalGuildMissions) * 100) 
        : 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Star} label="XP Total" value={stats.xp.toLocaleString()} accent="violet" />
                <StatCard icon={Trophy} label="Rang XP" value={stats.rank ? `#${stats.rank}` : "---"} accent="teal" />
                <StatCard icon={Target} label="Missions (Total)" value={stats.missionsValidated} accent="emerald" />
                <StatCard icon={HandHeart} label="Taux réussite" value={`${validationRate}%`} accent="rose" />
            </div>

            {/* Discord Activity Card */}
            <div className="rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent backdrop-blur-xl p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-3 italic">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                            Engagement Discord
                        </h3>
                        <p className="text-zinc-400 text-xs mt-2 font-medium">Votre activité sur le serveur Discord de la guilde.</p>
                    </div>

                    <div className="flex p-1 bg-zinc-900/50 rounded-2xl border border-white/5 self-start">
                        {(["weekly", "monthly", "total"] as const).map((period) => (
                            <button
                                key={period}
                                onClick={() => setDiscordPeriod(period)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                    discordPeriod === period 
                                        ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                                        : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                {period === "weekly" ? "Semaine" : period === "monthly" ? "Mois" : "Global"}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white/[0.03] rounded-3xl p-6 border border-white/5 flex items-center gap-6 group/stat">
                        <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-400 group-hover/stat:scale-110 transition-transform">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-white tabular-nums tracking-tighter italic">
                                {currentDiscordStats.messages.toLocaleString()}
                            </div>
                            <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mt-1">Messages Envoyés</div>
                        </div>
                    </div>

                    <div className="bg-white/[0.03] rounded-3xl p-6 border border-white/5 flex items-center gap-6 group/stat">
                        <div className="p-4 rounded-2xl bg-cyan-500/10 text-cyan-400 group-hover/stat:scale-110 transition-transform">
                            <Moon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-black text-white tabular-nums tracking-tighter italic">
                                {voiceHours}h {voiceMinutes}m
                            </div>
                            <div className="text-[9px] font-black uppercase text-zinc-500 tracking-widest mt-1">Temps en Vocal</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Star} label="XP Semaine" value={`+${stats.weeklyXp.toLocaleString()}`} accent="violet" />
                <StatCard icon={Target} label="Missions Semaine" value={stats.weeklyMissions} accent="emerald" />
                <StatCard icon={Coins} label="Guildatons" value={stats.guildatons} accent="amber" />
                <StatCard icon={CalendarDays} label="Participation" value={`${participationRate}%`} accent="sky" />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activity Trend */}
                <div className="lg:col-span-2 rounded-[2rem] border border-white/5 bg-black/40 backdrop-blur-xl p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-[100px] pointer-events-none transition-all group-hover:bg-violet-500/10" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-8 flex items-center gap-3 italic">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
                        Courbe d'Activité Personnelle
                    </h3>
                    <div className="mt-4">
                        <ActivityChart data={stats.weeklyActivity} />
                    </div>
                </div>

                {/* Categories Breakdown */}
                <div className="rounded-[2rem] border border-white/5 bg-black/40 backdrop-blur-xl p-8 relative overflow-hidden group flex flex-col">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none transition-all group-hover:bg-emerald-500/10" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-8 flex items-center gap-3 italic">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                        Répartition des Missions
                    </h3>
                    
                    {pieData.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-zinc-600 text-[10px] uppercase font-bold italic tracking-widest bg-white/[0.02] rounded-3xl border border-dashed border-white/5 mt-4 min-h-[200px]">
                            Aucune mission validée
                        </div>
                    ) : (
                        <>
                            <div className="h-[220px] relative mt-4">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={65}
                                            outerRadius={90}
                                            paddingAngle={8}
                                            dataKey="value"
                                            stroke="none"
                                            animationDuration={1500}
                                        >
                                            {pieData.map((_, i) => (
                                                <Cell key={i} fill={COLORS[i % COLORS.length]} className="focus:outline-none" />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'rgba(9,9,11,0.95)', 
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '12px',
                                                fontSize: '11px',
                                                fontWeight: 'bold',
                                                textTransform: 'uppercase'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                                    <span className="text-3xl font-black text-white italic leading-none tracking-tighter">
                                        {pieData.reduce((acc, curr) => acc + curr.value, 0)}
                                    </span>
                                    <span className="text-[9px] text-zinc-600 uppercase font-black tracking-widest mt-1">Total</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-8">
                                {pieData.map((entry, i) => (
                                    <div key={entry.name} className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                        <span className="text-[10px] font-black text-zinc-400 uppercase italic truncate">{entry.name}</span>
                                        <span className="text-[10px] font-black text-white ml-auto">{entry.value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Bottom Note */}
            <div className="flex items-center justify-center gap-3 py-6 border-t border-white/5 opacity-50">
                <BarChart3 className="w-4 h-4 text-zinc-600" />
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 italic">
                    Données certifiées • Synchronisation temps-réel via Robot SigilOS
                </p>
            </div>
        </div>
    );
}
