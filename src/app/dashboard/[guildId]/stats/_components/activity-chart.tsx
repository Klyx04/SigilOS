"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface ActivityChartProps {
    data: { week: string; submissions: number; validated: number }[];
}

export default function ActivityChart({ data }: ActivityChartProps) {
    if (data.length === 0 || data.every(d => d.submissions === 0)) {
        return (
            <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
                Pas encore de données d'activité
            </div>
        );
    }

    return (
        <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="gradientSubmissions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradientValidated" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                        dataKey="week"
                        tick={{ fill: "#71717a", fontSize: 12 }}
                        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fill: "#71717a", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "rgba(24,24,27,0.95)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            color: "#fff",
                            fontSize: "13px",
                        }}
                        labelStyle={{ color: "#a1a1aa" }}
                    />
                    <Area
                        type="monotone"
                        dataKey="submissions"
                        name="Soumissions"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fill="url(#gradientSubmissions)"
                    />
                    <Area
                        type="monotone"
                        dataKey="validated"
                        name="Validées"
                        stroke="#14b8a6"
                        strokeWidth={2}
                        fill="url(#gradientValidated)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
