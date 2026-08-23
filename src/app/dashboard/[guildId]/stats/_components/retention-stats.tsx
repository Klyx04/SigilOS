"use client";

import { Users, TrendingUp, HandHeart, Calendar } from "lucide-react";
import type { GuildStats } from "@/server/actions/guild-stats-actions";

interface RetentionStatsProps {
    retention: GuildStats["retention"];
    totalMembers: number;
}

export default function RetentionStats({ retention, totalMembers }: RetentionStatsProps) {
    const avgTenure = retention.avgTenureDays || 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Croissance Globale */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-success/10 to-transparent border border-success/20 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-success font-medium">
                        <TrendingUp className="w-5 h-5" />
                        Croissance
                    </div>
                    <span className="px-2 py-1 rounded-full bg-success/20 text-success text-caption uppercase font-black tracking-widest border border-success/20">
                        {totalMembers} Membres
                    </span>
                </div>
                <div className="space-y-1">
                    <p className="text-3xl font-black text-foreground italic tracking-tighter">
                        +{retention.totalJoins}
                    </p>
                    <p className="text-xs font-medium text-success/80 uppercase tracking-widest font-bold">Inscriptions Totales sur SigilOS</p>
                </div>
            </div>

            {/* Fidélité / Rétention */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-teal-500/10 to-transparent border border-teal-500/20 space-y-4">
                <div className="flex items-center gap-2 text-teal-400 font-medium">
                    <Calendar className="w-5 h-5" />
                    Fidélité Moyenne
                </div>
                <div className="space-y-1">
                    <p className="text-3xl font-black text-foreground italic tracking-tighter">
                        {avgTenure}
                    </p>
                    <p className="text-xs font-medium text-teal-400/80 uppercase tracking-widest font-bold">Jours de présence moyenne</p>
                </div>
                <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden border border-border">
                    <div className="h-full bg-teal-500/50 rounded-full" style={{ width: `${Math.min((avgTenure/365)*100, 100)}%` }}></div>
                </div>
            </div>

            {/* Participation */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-info/10 to-transparent border border-info/20 space-y-4">
                <div className="flex items-center gap-2 text-info font-medium">
                    <Users className="w-5 h-5" />
                    Engagement Social
                </div>
                <div className="space-y-1">
                    <p className="text-3xl font-black text-foreground italic tracking-tighter">
                        {totalMembers}
                    </p>
                    <p className="text-xs font-medium text-info/80 uppercase tracking-widest font-bold">Membres actifs</p>
                </div>
            </div>
        </div>
    );
}
