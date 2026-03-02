"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";

interface MissionsStatsProps {
    categories: { category: string; count: number; validated: number }[];
    topValidators: { name: string; value: number }[];
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

export default function MissionsStats({ categories, topValidators }: MissionsStatsProps) {
    const pieData = categories.map(c => ({
        name: CATEGORY_LABELS[c.category] || c.category,
        value: c.count,
    }));

    const barData = topValidators.map(v => ({
        name: v.name.length > 12 ? v.name.slice(0, 12) + "…" : v.name,
        missions: v.value,
    }));

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut */}
            <div>
                <h4 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Par catégorie</h4>
                {pieData.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">Aucune mission</div>
                ) : (
                    <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart style={{ background: "transparent" }}>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={3}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
                        {/* Legend */}
                        <div className="flex flex-wrap gap-3 justify-center mt-2">
                            {pieData.map((entry, i) => (
                                <div key={entry.name} className="flex items-center gap-1.5 text-xs text-zinc-400">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    {entry.name}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Top Validators */}
            <div>
                <h4 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Top validateurs</h4>
                {barData.length === 0 ? (
                    <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">Aucune validation</div>
                ) : (
                    <div className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fill: "#a1a1aa", fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={100}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "rgba(24,24,27,0.95)",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        borderRadius: "8px",
                                        color: "#fff",
                                        fontSize: "13px",
                                    }}
                                />
                                <Bar
                                    dataKey="missions"
                                    name="Validées"
                                    fill="#8b5cf6"
                                    radius={[0, 6, 6, 0]}
                                    barSize={20}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
