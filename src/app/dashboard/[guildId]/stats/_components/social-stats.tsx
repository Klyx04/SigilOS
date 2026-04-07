"use client";

import { MessageSquare, Mic, Trophy } from "lucide-react";
import type { GuildStats } from "@/server/actions/guild-stats-actions";

interface SocialStatsProps {
    social: GuildStats["social"];
}

export default function SocialStats({ social }: SocialStatsProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Messages */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-violet-400 font-medium">
                    <MessageSquare className="w-4 h-4" />
                    Top Bavards (Messages / Semaine)
                </div>
                <div className="space-y-3">
                    {social.topTalkers.map((user, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                            <div className="flex items-center gap-3">
                                <span className="text-zinc-500 font-mono text-sm">#{i + 1}</span>
                                <span className="text-white font-medium">{user.name}</span>
                            </div>
                            <span className="text-violet-400 font-bold">{user.value.toLocaleString()} msgs</span>
                        </div>
                    ))}
                    {social.topTalkers.length === 0 && <p className="text-zinc-500 text-sm italic">Aucune donnée cette semaine.</p>}
                </div>
            </div>

            {/* Vocal */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-400 font-medium">
                    <Mic className="w-4 h-4" />
                    Top Vocal (Heures / Semaine)
                </div>
                <div className="space-y-3">
                    {social.topVocal.map((user, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                            <div className="flex items-center gap-3">
                                <span className="text-zinc-500 font-mono text-sm">#{i + 1}</span>
                                <span className="text-white font-medium">{user.name}</span>
                            </div>
                            <span className="text-blue-400 font-bold">{user.value}h</span>
                        </div>
                    ))}
                    {social.topVocal.length === 0 && <p className="text-zinc-500 text-sm italic">Aucun temps vocal enregistré.</p>}
                </div>
            </div>
        </div>
    );
}
