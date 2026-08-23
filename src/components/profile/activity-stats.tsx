"use client";

import { Zap, Trophy, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ActivityStatsProps {
    xp?: number;
    weeklyXp?: number;
    missionsValidated?: number;
    weeklyMissions?: number;
}

export function ActivityStats({
    xp = 0,
    weeklyXp = 0,
    missionsValidated = 0,
    weeklyMissions = 0,
}: ActivityStatsProps) {


    return (
        <div className="p-6 bg-surface/60 rounded-2xl border border-border h-full flex flex-col">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">Activité</h3>

            <div className="flex-1 space-y-4">
                {/* XP Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-info/10 rounded-xl border border-info/20 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-info" />
                            <span className="text-xs font-medium text-info">XP Semaine</span>
                        </div>
                        <p className="text-2xl font-bold text-info">+{weeklyXp.toLocaleString()}</p>
                    </div>

                    <div className="p-4 bg-surface/50 rounded-xl border border-border flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-muted-foreground">XP Total</span>
                        </div>
                        <p className="text-xl font-bold text-foreground">{xp.toLocaleString()}</p>
                    </div>
                </div>

                {/* Mission Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-success/10 rounded-xl border border-success/20 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                            <Trophy className="w-4 h-4 text-success" />
                            <span className="text-xs font-medium text-success">Missions Semaine</span>
                        </div>
                        <p className="text-2xl font-bold text-success">{weeklyMissions}</p>
                    </div>

                    <div className="p-4 bg-surface/50 rounded-xl border border-border flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Missions Totales</span>
                        </div>
                        <p className="text-xl font-bold text-foreground">{missionsValidated}</p>
                    </div>
                </div>
            </div>

        </div>
    );
}
