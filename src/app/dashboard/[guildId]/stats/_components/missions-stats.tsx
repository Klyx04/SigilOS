import { useState, useEffect } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface MissionsStatsProps {
    categories: { category: string; count: number; validated: number }[];
    topValidators: { name: string; value: number }[];
    topDonors: { name: string; value: number }[];
}

const CATEGORY_LABELS: Record<string, string> = {
    DONJON: "Donjon",
    REGULATION: "Régulation",
    ANOMALIE: "Anomalie",
    SONGES: "Songes",
    EXPEDITION: "Expedition",
    EVENT: "Événement",
};

const COLORS = ["#8b5cf6", "#14b8a6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

export default function MissionsStats({ categories, topValidators, topDonors }: MissionsStatsProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const pieData = categories.map(c => ({
        name: CATEGORY_LABELS[c.category] || c.category,
        value: c.count,
    }));

    const barDataValidators = topValidators.map(v => ({
        name: v.name.length > 15 ? v.name.slice(0, 15) + "…" : v.name,
        missions: v.value,
    }));

    const barDataDonors = topDonors.map(v => ({
        name: v.name.length > 15 ? v.name.slice(0, 15) + "…" : v.name,
        kamas: v.value,
    }));

    const CustomTooltip = ({ active, payload, label, unit }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-zinc-900/95 border border-white/10 p-3 rounded-lg shadow-2xl backdrop-blur-md">
                    <p className="text-caption font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
                    <p className="text-sm font-bold text-white">
                        {unit === "kamas" 
                            ? `${(payload[0].value / 1000000).toFixed(1)}M kamas` 
                            : `${payload[0].value} missions`}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Répartition */}
                <div className="flex flex-col">
                    <h4 className="text-caption font-bold text-zinc-500 mb-6 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        Répartition par catégorie
                    </h4>
                    {!mounted || pieData.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs italic bg-white/[0.01] rounded-2xl border border-dashed border-white/5 min-h-[200px]">
                            {!mounted ? "Chargement..." : "Aucune donnée"}
                        </div>
                    ) : (
                        <div className="h-[220px] relative">
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={85}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        animationDuration={1500}
                                    >
                                        {pieData.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} className="focus:outline-none" />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                                <span className="text-2xl font-black text-white leading-none">
                                    {pieData.reduce((acc, curr) => acc + curr.value, 0)}
                                </span>
                                <span className="text-caption text-zinc-500 uppercase font-bold tracking-tighter">Total</span>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-6">
                        {pieData.map((entry, i) => (
                            <div key={entry.name} className="flex items-center gap-1.5 no-wrap">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                <span className="text-caption font-medium text-zinc-400">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Validations */}
                <div className="flex flex-col">
                    <h4 className="text-caption font-bold text-zinc-500 mb-6 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-violet-500" />
                        Efficacité du Staff
                    </h4>
                    <div className="h-[220px]">
                        {!mounted ? (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs italic">Chargement...</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <BarChart data={barDataValidators} layout="vertical" margin={{ left: -10, right: 30, top: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                                <XAxis type="number" hide />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fill: "#71717a", fontSize: 11, fontVariant: "small-caps" }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={100}
                                />
                                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                                <Bar
                                    dataKey="missions"
                                    fill="url(#barGradient)"
                                    radius={[0, 4, 4, 0]}
                                    barSize={16}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>

            {/* Top Donors */}
            <div className="pt-8 border-t border-white/5">
                <h4 className="text-caption font-bold text-zinc-500 mb-8 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-amber-500" />
                    Grands Philanthropes (Kamas)
                </h4>
                <div className="h-[180px]">
                    {!mounted ? (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs italic">Chargement...</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                            <BarChart data={barDataDonors} layout="vertical" margin={{ left: -10, right: 40, top: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="kamaGradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.8} />
                                    <stop offset="100%" stopColor="#fbbf24" stopOpacity={1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.03)" />
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fill: "#71717a", fontSize: 11, fontVariant: "small-caps" }}
                                axisLine={false}
                                tickLine={false}
                                width={100}
                            />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip unit="kamas" />} />
                            <Bar
                                dataKey="kamas"
                                fill="url(#kamaGradient)"
                                radius={[0, 4, 4, 0]}
                                barSize={16}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
            </div>
        </div>
    );
}
