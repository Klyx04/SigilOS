"use client";

import {
    BarChart3,
    Star,
    Shield,
    Clock,
    CheckCircle2,
    TrendingUp,
    Smile,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TicketAnalyticsTabProps {
    stats: {
        openCount: number;
        claimedCount: number;
        closedCount: number;
        totalCount: number;
        avgCsat: number | null;
        feedbackCount: number;
    };
    tickets: any[];
}

export function TicketAnalyticsTab({ stats, tickets }: TicketAnalyticsTabProps) {
    // Calculate staff stats
    const staffMap = new Map<string, { name: string; count: number }>();
    for (const t of tickets) {
        if (t.claimedByName) {
            const entry = staffMap.get(t.claimedByName) || { name: t.claimedByName, count: 0 };
            entry.count++;
            staffMap.set(t.claimedByName, entry);
        }
    }
    const staffList = Array.from(staffMap.values()).sort((a, b) => b.count - a.count);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-amber-400" /> Métriques de Support & Satisfaction
                </h2>
                <p className="text-xs text-muted-foreground">
                    Performance de l'équipe, temps de réponse et retours des membres.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-card border border-border space-y-1 shadow-sm">
                    <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-info" /> Total Tickets
                    </div>
                    <div className="text-3xl font-bold text-foreground">{stats.totalCount}</div>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border space-y-1 shadow-sm">
                    <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-400" /> En Cours / Ouverts
                    </div>
                    <div className="text-3xl font-bold text-amber-400">
                        {stats.openCount + stats.claimedCount}
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border space-y-1 shadow-sm">
                    <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Résolus & Fermés
                    </div>
                    <div className="text-3xl font-bold text-emerald-400">{stats.closedCount}</div>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border space-y-1 shadow-sm">
                    <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5 text-yellow-400" /> Note Moyenne CSAT
                    </div>
                    <div className="text-3xl font-bold text-foreground">
                        {stats.avgCsat ? `${stats.avgCsat} / 5` : "N/A"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">({stats.feedbackCount} avis reçus)</div>
                </div>
            </div>

            {/* Staff Leaderboard */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-400" /> Classement des Prises en Charge Staff
                </h3>

                {staffList.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Aucun membre du staff n'a encore pris en charge de ticket.</p>
                ) : (
                    <div className="space-y-2">
                        {staffList.map((staff, idx) => (
                            <div
                                key={staff.name}
                                className="flex items-center justify-between p-3 rounded-xl bg-surface/50 border border-border/40 text-xs"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-muted-foreground w-4">#{idx + 1}</span>
                                    <span className="font-semibold text-foreground">{staff.name}</span>
                                </div>

                                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                                    {staff.count} tickets gérés
                                </Badge>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
