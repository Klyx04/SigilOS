"use client";

import { Crown, Gamepad2, Timer } from "lucide-react";
import type { GuildStats } from "@/server/actions/guild-stats-actions";

interface MiniGamesStatsProps {
    miniGames: GuildStats["miniGames"];
}

export default function MiniGamesStats({ miniGames }: MiniGamesStatsProps) {
    const records = [
        { label: "💣 Sigil-Bomb", ...miniGames.records.bomb, color: "text-red-500" },
        { label: "🌍 Geoguesser", ...miniGames.records.geoguesser, color: "text-emerald-400" },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Panthéon des records */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-400 font-medium">
                    <Crown className="w-5 h-5" />
                    Panthéon — Records Absolus
                </div>
                <div className="grid gap-3">
                    {records.map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20">
                            <div>
                                <p className="text-sm font-medium text-amber-400/80 mb-1">{r.label}</p>
                                <p className="text-lg font-bold text-white">{r.name}</p>
                            </div>
                            <div className="text-right">
                                <span className={`text-2xl font-black ${r.color} drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]`}>
                                    {r.score.toLocaleString()}
                                </span>
                                <p className="text-[10px] uppercase text-zinc-500 tracking-wider font-bold">Points</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Activité Globale */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-400 font-medium">
                    <Gamepad2 className="w-5 h-5" />
                    Statistiques Globales Guilde
                </div>
                <div className="p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex flex-col items-center justify-center text-center space-y-4 min-h-[160px]">
                    <div className="space-y-1">
                        <p className="text-4xl font-black text-white italic tracking-tighter">
                            {miniGames.totalGamesPlayed.toLocaleString()}
                        </p>
                        <p className="text-sm font-medium text-indigo-400 uppercase tracking-widest">Parties Jouées</p>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-500 text-xs bg-white/5 px-3 py-1.5 rounded-full border border-white/10 uppercase tracking-widest font-bold">
                        <Timer className="w-3 h-3" />
                        Module Actif non-H24
                    </div>
                </div>
            </div>
        </div>
    );
}
