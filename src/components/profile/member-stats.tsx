"use client";

import { BarChart3, Star, Coins, CheckCircle2, Target, Moon, CalendarDays, HandHeart, Trophy } from "lucide-react";
import StatCard from "@/app/dashboard/[guildId]/stats/_components/stat-card";
import ActivityChart from "@/app/dashboard/[guildId]/stats/_components/activity-chart";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

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
    const pieData = stats.missionsByCategory.map(c => ({
        name: CATEGORY_LABELS[c.category] || c.category,
        value: c.count,
    }));

    const validationRate = stats.missionsByCategory.reduce((acc, curr) => acc + curr.count, 0) > 0
        ? Math.round((stats.missionsValidated / stats.missionsByCategory.reduce((acc, curr) => acc + curr.count, 0)) * 100)
        : 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Star} label="XP Total" value={stats.xp} accent="violet" />
                <StatCard icon={Trophy} label="Rang XP" value={stats.rank ? `#${stats.rank}` : "---"} accent="teal" />
                <StatCard icon={Target} label="Missions (Total)" value={stats.missionsValidated} accent="emerald" />
                <StatCard icon={HandHeart} label="Taux réussite" value={`${validationRate}%`} accent="rose" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Star} label="XP Semaine" value={`+${stats.weeklyXp}`} accent="violet" />
                <StatCard icon={Target} label="Missions Semaine" value={stats.weeklyMissions} accent="emerald" />
                <StatCard icon={Coins} label="Guildatons" value={stats.guildatons} accent="amber" />
                <StatCard icon={CalendarDays} label="Participation" value="---" accent="sky" />
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
