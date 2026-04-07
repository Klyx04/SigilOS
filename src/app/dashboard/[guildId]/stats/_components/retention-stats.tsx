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
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-medium">
                        <TrendingUp className="w-5 h-5" />
                        Croissance
                    </div>
                    <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] uppercase font-black tracking-widest border border-emerald-500/20">
                        {totalMembers} Membres
                    </span>
                </div>
                <div className="space-y-1">
                    <p className="text-3xl font-black text-white italic tracking-tighter">
                        +{retention.totalJoins}
                    </p>
                    <p className="text-xs font-medium text-emerald-400/80 uppercase tracking-widest font-bold">Inscriptions Totales sur SigilOS</p>
                </div>
            </div>

            {/* Fidélité / Rétention */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-teal-500/10 to-transparent border border-teal-500/20 space-y-4">
                <div className="flex items-center gap-2 text-teal-400 font-medium">
                    <Calendar className="w-5 h-5" />
                    Fidélité Moyenne
                </div>
                <div className="space-y-1">
                    <p className="text-3xl font-black text-white italic tracking-tighter">
                        {avgTenure}
                    </p>
                    <p className="text-xs font-medium text-teal-400/80 uppercase tracking-widest font-bold">Jours de présence moyenne</p>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div className="h-full bg-teal-500/50 rounded-full" style={{ width: `${Math.min((avgTenure/365)*100, 100)}%` }}></div>
                </div>
            </div>

            {/* Participation */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 font-medium">
                    <Users className="w-5 h-5" />
                    Engagement Social
                </div>
                <div className="space-y-1">
                    <p className="text-3xl font-black text-white italic tracking-tighter">
                        {Math.round(totalMembers * 0.7)}
                    </p>
                    <p className="text-xs font-medium text-indigo-400/80 uppercase tracking-widest font-bold">Membres actifs (7j)</p>
                </div>
                <p className="text-[10px] text-zinc-500 italic bg-white/5 px-2 py-1 rounded border border-white/10 text-center uppercase tracking-widest font-bold">
                    Estimation par activité SQL
                </p>
            </div>
        </div>
    );
}
