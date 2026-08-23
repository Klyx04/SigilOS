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
    const ratingColor = !hasValidations ? "text-muted-foreground" : avgHours <= 4 ? "text-warning" : avgHours <= 24 ? "text-success" : "text-danger";

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Temps de validation */}
            <div className="p-5 rounded-xl border border-border bg-surface space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                    <Timer className="w-4 h-4 text-violet-400" />
                    Réactivité Staff
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-foreground italic tracking-tighter">
                        {avgHours}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground lowercase tracking-wider italic">heures</span>
                </div>
                <p className="text-caption uppercase text-muted-foreground tracking-wider font-bold">Moyenne de validation</p>
            </div>

            {/* Score de performance */}
            <div className="p-5 rounded-xl border border-border bg-surface space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                    <Zap className="w-4 h-4 text-warning" />
                    Indice Efficacité
                </div>
                <div className={`${ratingColor} text-xl font-bold uppercase tracking-tighter`}>
                    {performanceRating}
                </div>
                <p className="text-caption uppercase text-muted-foreground tracking-wider font-bold">Performance Globale</p>
            </div>

            {/* Top Validateurs (Mois) */}
            <div className="md:col-span-2 p-5 rounded-xl border border-border bg-surface space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                    <Target className="w-4 h-4 text-danger" />
                    Top Validateurs du Mois
                </div>
                <div className="flex flex-wrap gap-2">
                    {performance.topValidatorsMonth.map((user, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border">
                            <span className="text-danger font-bold text-xs">{i+1}</span>
                            <span className="text-foreground text-xs font-medium">{user.name}</span>
                            <span className="text-muted-foreground text-caption ml-1">{user.value}</span>
                        </div>
                    ))}
                    {performance.topValidatorsMonth.length === 0 && <p className="text-muted-foreground text-xs italic">Aucune validation ce mois-ci.</p>}
                </div>
            </div>
        </div>
    );
}
