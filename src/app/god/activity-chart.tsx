"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface ActivityChartProps {
    data: Array<{ date: string; users: number }>;
}

export function ActivityChart({ data }: ActivityChartProps) {
    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#666"
                        tickFormatter={(str) => {
                            const date = new Date(str);
                            return `${date.getDate()}/${date.getMonth() + 1}`;
                        }}
                        style={{ fontSize: 12 }}
                    />
                    <YAxis stroke="#666" style={{ fontSize: 12 }} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "rgba(23, 23, 23, 0.9)",
                            borderColor: "#333",
                            borderRadius: "8px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
                        }}
                        itemStyle={{ color: "#fff" }}
                        labelStyle={{ color: "#aaa", marginBottom: "0.5rem" }}
                        labelFormatter={(str) => new Date(str).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                    />
                    <Area
                        type="monotone"
                        dataKey="users"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorUsers)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
