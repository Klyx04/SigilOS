"use client";

import { Timer, Zap, LayoutDashboard, Target } from "lucide-react";
import type { GuildStats } from "@/server/actions/guild-stats-actions";

interface PerformanceStatsProps {
    performance: GuildStats["performance"];
}

export default function PerformanceStats({ performance }: PerformanceStatsProps) {
    const hasValidations = performance.totalValidations > 0;
    const avgHours = performance.avgValidationHours || 0;
    const performanceRating = !hasValidations ? "N/A" : avgHours <= 1 ? "Éclair ⚡" : avgHours <= 4 ? "Rapide 🚀" : avgHours <= 24 ? "Correct ✅" : "Peut mieux faire 🐢";
    const ratingColor = !hasValidations ? "text-zinc-500" : avgHours <= 4 ? "text-amber-400" : avgHours <= 24 ? "text-emerald-400" : "text-rose-400";

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Temps de validation */}
            <div className="p-5 rounded-xl border border-white/10 bg-white/5 space-y-2">
                <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
                    <Timer className="w-4 h-4 text-violet-400" />
                    Réactivité Staff
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white italic tracking-tighter">
                        {avgHours}
                    </span>
                    <span className="text-sm font-medium text-zinc-500 lowercase tracking-wider italic">heures</span>
                </div>
                <p className="text-[10px] uppercase text-zinc-500 tracking-wider font-bold">Moyenne de validation</p>
            </div>

            {/* Score de performance */}
            <div className="p-5 rounded-xl border border-white/10 bg-white/5 space-y-2">
                <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
                    <Zap className="w-4 h-4 text-amber-400" />
                    Indice Efficacité
                </div>
                <div className={`${ratingColor} text-xl font-bold uppercase tracking-tighter`}>
                    {performanceRating}
                </div>
                <p className="text-[10px] uppercase text-zinc-500 tracking-wider font-bold">Performance Globale</p>
            </div>

            {/* Top Validateurs (Mois) */}
            <div className="md:col-span-2 p-5 rounded-xl border border-white/10 bg-white/5 space-y-3">
                <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
                    <Target className="w-4 h-4 text-rose-400" />
                    Top Validateurs du Mois
                </div>
                <div className="flex flex-wrap gap-2">
                    {performance.topValidatorsMonth.map((user, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                            <span className="text-rose-400 font-bold text-xs">{i+1}</span>
                            <span className="text-white text-xs font-medium">{user.name}</span>
                            <span className="text-zinc-500 text-[10px] ml-1">{user.value}</span>
                        </div>
                    ))}
                    {performance.topValidatorsMonth.length === 0 && <p className="text-zinc-500 text-xs italic">Aucune validation ce mois-ci.</p>}
                </div>
            </div>
        </div>
    );
}
