"use client";

import { Zap, Trophy, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ActivityStatsProps {
    xp?: number;
    weeklyXp?: number;
    missionsValidated?: number;
    weeklyMissions?: number;
    joinedAt?: Date | string | null;
}

export function ActivityStats({
    xp = 0,
    weeklyXp = 0,
    missionsValidated = 0,
    weeklyMissions = 0,
    joinedAt,
}: ActivityStatsProps) {
    const joinedDate = joinedAt
        ? (typeof joinedAt === "string" ? new Date(joinedAt) : joinedAt)
        : null;

    return (
        <div className="p-6 bg-zinc-900/60 rounded-2xl border border-white/5 h-full flex flex-col">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">Activité</h3>

            <div className="flex-1 space-y-4">
                {/* XP Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-medium text-purple-300">XP Semaine</span>
                        </div>
                        <p className="text-2xl font-bold text-purple-400">+{weeklyXp.toLocaleString()}</p>
                    </div>

                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-white/5 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-zinc-500">XP Total</span>
                        </div>
                        <p className="text-xl font-bold text-zinc-300">{xp.toLocaleString()}</p>
                    </div>
                </div>

                {/* Mission Stats */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                            <Trophy className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-medium text-emerald-300">Missions Semaine</span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-400">{weeklyMissions}</p>
                    </div>

                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-white/5 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-zinc-500">Missions Totales</span>
                        </div>
                        <p className="text-xl font-bold text-zinc-300">{missionsValidated}</p>
                    </div>
                </div>
            </div>

            {/* Joined Date Footer */}
            {joinedDate && (
                <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-zinc-500 text-xs">
                        <Calendar className="w-3 h-3" />
                        <span>Membre depuis le <span className="text-zinc-400 font-medium">{format(joinedDate, "d MMMM yyyy", { locale: fr })}</span></span>
                    </div>
                </div>
            )}
        </div>
    );
}
