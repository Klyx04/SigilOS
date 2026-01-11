"use client";

import { Zap, Trophy, Calendar, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ActivityStatsProps {
    xp?: number;
    missionsValidated?: number;
    joinedAt?: Date | null;
    lastActivity?: { description: string; date: Date } | null;
}

export function ActivityStats({
    xp = 0,
    missionsValidated = 0,
    joinedAt,
    lastActivity,
}: ActivityStatsProps) {
    return (
        <div className="p-6 bg-zinc-900/60 rounded-2xl border border-white/5">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">Statistiques</h3>

            <div className="grid grid-cols-2 gap-4">
                {/* XP */}
                <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-purple-400" />
                        <span className="text-xs text-purple-300">XP Total</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-400">{xp.toLocaleString()}</p>
                </div>

                {/* Missions */}
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-1">
                        <Trophy className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-emerald-300">Missions</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">{missionsValidated}</p>
                </div>

                {/* Joined */}
                {joinedAt && (
                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-blue-300">Membre depuis</span>
                        </div>
                        <p className="text-sm font-medium text-blue-400">
                            {formatDistanceToNow(joinedAt, { addSuffix: false, locale: fr })}
                        </p>
                    </div>
                )}

                {/* Last Activity */}
                {lastActivity && (
                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-amber-400" />
                            <span className="text-xs text-amber-300">Dernière activité</span>
                        </div>
                        <p className="text-sm font-medium text-amber-400 truncate">
                            {lastActivity.description}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
