import { useState, useEffect } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { CalendarDays, Users, Medal } from "lucide-react";

interface EventsStatsProps {
    events: {
        total: number;
        byType: { type: string; count: number }[];
        avgParticipation: number;
        topOrganizers: { name: string; value: number }[];
        thisMonth: number;
    };
}

const EVENT_LABELS: Record<string, string> = {
    RAID_OFFICIAL: "Raid",
    EVENT_GUILD: "Événement guilde",
    SESSION_MISSIONS: "Missions",
    SORTIE_FARM: "Farm",
    ALMANAX_BONUS: "Almanax",
    GUILD_MISSION: "Mission guilde",
    SONGES_RUN: "Songes",
    DUNGEON_FARM: "Donjon",
    SOCIAL: "Social",
    OFFICIAL_RESET: "Reset",
    OTHERS: "Autre",
};

const COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#22c55e", "#ef4444", "#ec4899", "#71717a"];

export default function EventsStats({ events }: EventsStatsProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    
    const pieData = events.byType.map(e => ({
        name: EVENT_LABELS[e.type] || e.type,
        value: e.count,
    }));

    return (
        <div className="space-y-5">
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-surface p-3 text-center">
                    <CalendarDays className="w-5 h-5 text-info mx-auto mb-1" />
                    <p className="text-2xl font-bold text-foreground">{events.thisMonth}</p>
                    <p className="text-xs text-muted-foreground">Ce mois</p>
                </div>
                <div className="rounded-lg bg-surface p-3 text-center">
                    <Users className="w-5 h-5 text-violet-400 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-foreground">{events.avgParticipation}</p>
                    <p className="text-xs text-muted-foreground">Moy. participants</p>
                </div>
                <div className="rounded-lg bg-surface p-3 text-center">
                    <Medal className="w-5 h-5 text-warning mx-auto mb-1" />
                    <p className="text-2xl font-bold text-foreground">{events.total}</p>
                    <p className="text-xs text-muted-foreground">Total events</p>
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
                            <PieChart style={{ background: "transparent" }}>
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
                    )}
                    {mounted && (
                        <div className="flex flex-wrap gap-3 justify-center">
                            {pieData.map((d, i) => (
                                <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    {d.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Top Organizers */}
            {events.topOrganizers.length > 0 && (
                <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Top Organisateurs</h4>
                    <div className="space-y-1.5">
                        {events.topOrganizers.map((org, i) => (
                            <div key={org.name} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground w-4 font-mono">{i + 1}.</span>
                                <span className="text-foreground font-medium truncate flex-1">{org.name}</span>
                                <span className="text-info font-bold">{org.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
