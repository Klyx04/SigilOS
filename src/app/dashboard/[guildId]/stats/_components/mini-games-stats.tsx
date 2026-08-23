"use client";

import { Crown, Gamepad2, Timer } from "lucide-react";
import type { GuildStats } from "@/server/actions/guild-stats-actions";

interface MiniGamesStatsProps {
    miniGames: GuildStats["miniGames"];
}

export default function MiniGamesStats({ miniGames }: MiniGamesStatsProps) {
    const records = [
        { label: "💣 Sigil-Bomb", ...miniGames.records.bomb, color: "text-danger" },
        { label: "🌍 Geoguesser", ...miniGames.records.geoguesser, color: "text-success" },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Panthéon des records */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-warning font-medium">
                    <Crown className="w-5 h-5" />
                    Panthéon — Records Absolus
                </div>
                <div className="grid gap-3">
                    {records.map((r, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-warning/10 to-transparent border border-warning/20">
                            <div>
                                <p className="text-sm font-medium text-warning/80 mb-1">{r.label}</p>
                                <p className="text-lg font-bold text-foreground">{r.name}</p>
                            </div>
                            <div className="text-right">
                                <span className={`text-2xl font-black ${r.color} drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]`}>
                                    {r.score.toLocaleString()}
                                </span>
                                <p className="text-caption uppercase text-muted-foreground tracking-wider font-bold">Points</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Activité Globale */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-info font-medium">
                    <Gamepad2 className="w-5 h-5" />
                    Statistiques Globales Guilde
                </div>
                <div className="p-6 rounded-2xl bg-info/5 border border-info/20 flex flex-col items-center justify-center text-center space-y-4 min-h-[160px]">
                    <div className="space-y-1">
                        <p className="text-4xl font-black text-foreground italic tracking-tighter">
                            {miniGames.totalGamesPlayed.toLocaleString()}
                        </p>
                        <p className="text-sm font-medium text-info uppercase tracking-widest">Parties Jouées</p>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-xs bg-surface px-3 py-1.5 rounded-full border border-border uppercase tracking-widest font-bold">
                        <Timer className="w-3 h-3" />
                        Module Actif non-H24
                    </div>
                </div>
            </div>
        </div>
    );
}
