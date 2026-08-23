"use client";

import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Activity } from "lucide-react";
import { GodEmptyState } from "./ui";

interface ActivityChartProps {
    data: Array<{ date: string; users: number; pulse: number }>;
}

export function ActivityChart({ data }: ActivityChartProps) {
    if (!data || data.length === 0) {
        return (
            <GodEmptyState
                icon={Activity}
                title="Extraction des données impossible"
                description="Aucune donnée d'activité disponible pour l'instant."
                className="h-[400px]"
            />
        );
    }

    return (
        <div className="h-[430px] w-full mt-4" style={{ minWidth: 1, minHeight: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 20 }}>
                    <defs>
                        <linearGradient id="colorPulse" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                            <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <filter id="shadow" height="200%">
                            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                            <feOffset dx="0" dy="4" result="offsetblur" />
                            <feComponentTransfer>
                                <feFuncA type="linear" slope="0.5" />
                            </feComponentTransfer>
                            <feMerge>
                                <feMergeNode />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis
                        dataKey="date"
                        stroke="#3f3f46"
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(str) => {
                            const date = new Date(str);
                            return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
                        }}
                        style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}
                        dy={15}
                    />

                    {/* Primary Y Axis for Activity (Pulse) - Scaled for visibility */}
                    <YAxis
                        yAxisId="left"
                        stroke="#8b5cf6"
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 'auto']}
                        style={{ fontSize: 9, fontWeight: 900, opacity: 0.5 }}
                        orientation="left"
                        tickFormatter={(val) => Math.floor(val).toString()}
                    />

                    {/* Secondary Y Axis for Growth (Users) */}
                    <YAxis
                        yAxisId="right"
                        stroke="#10b981"
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 'auto']}
                        style={{ fontSize: 9, fontWeight: 900, opacity: 0.5 }}
                        orientation="right"
                    />

                    <Tooltip
                        contentStyle={{
                            backgroundColor: "rgba(9, 9, 11, 0.9)",
                            borderColor: "rgba(255, 255, 255, 0.05)",
                            borderRadius: "24px",
                            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
                            backdropFilter: "blur(20px)",
                            padding: "20px",
                            borderWidth: "1px"
                        }}
                        itemStyle={{ fontWeight: 900, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.1em" }}
                        labelStyle={{ color: "#a1a1aa", marginBottom: "1rem", fontSize: "9px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.3em" }}
                        labelFormatter={(str: any) => new Date(str as string).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                    />

                    {/* Pulse as Smooth Area (Engagement) */}
                    <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="pulse"
                        name="Activité Dashboard"
                        stroke="#8b5cf6"
                        strokeWidth={4}
                        fillOpacity={1}
                        fill="url(#colorPulse)"
                        animationDuration={2000}
                        filter="url(#shadow)"
                    />

                    {/* Registrations as Monotone Line (Growth) */}
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="users"
                        name="Nouveaux Inscrits"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: '#fff', stroke: '#10b981', strokeWidth: 3 }}
                        animationDuration={3000}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
