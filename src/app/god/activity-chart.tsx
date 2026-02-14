"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface ActivityChartProps {
    data: Array<{ date: string; users: number }>;
}

export function ActivityChart({ data }: ActivityChartProps) {
    return (
        <div className="h-[400px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                            <stop offset="60%" stopColor="#8b5cf6" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#444"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(str) => {
                            const date = new Date(str);
                            return `${date.getDate()}/${date.getMonth() + 1}`;
                        }}
                        style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}
                        dy={15}
                    />
                    <YAxis
                        stroke="#444"
                        tickLine={false}
                        axisLine={false}
                        style={{ fontSize: 11, fontWeight: 700 }}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: "rgba(9, 9, 11, 0.95)",
                            borderColor: "rgba(255, 255, 255, 0.1)",
                            borderRadius: "16px",
                            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                            backdropFilter: "blur(12px)",
                            padding: "16px",
                            borderWidth: "1px"
                        }}
                        itemStyle={{ color: "#a78bfa", fontWeight: 900, fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.05em" }}
                        labelStyle={{ color: "#71717a", marginBottom: "0.75rem", fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em" }}
                        labelFormatter={(str) => new Date(str).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                        cursor={{ stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5 5' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="users"
                        stroke="#a78bfa"
                        strokeWidth={4}
                        fillOpacity={1}
                        fill="url(#colorUsers)"
                        animationDuration={2000}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
