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
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border">
                            <div className="flex items-center gap-3">
                                <span className="text-muted-foreground font-mono text-sm">#{i + 1}</span>
                                <span className="text-foreground font-medium">{user.name}</span>
                            </div>
                            <span className="text-violet-400 font-bold">{user.value.toLocaleString()} msgs</span>
                        </div>
                    ))}
                    {social.topTalkers.length === 0 && <p className="text-muted-foreground text-sm italic">Aucune donnée cette semaine.</p>}
                </div>
            </div>

            {/* Vocal */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-info font-medium">
                    <Mic className="w-4 h-4" />
                    Top Vocal (Heures / Semaine)
                </div>
                <div className="space-y-3">
                    {social.topVocal.map((user, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border">
                            <div className="flex items-center gap-3">
                                <span className="text-muted-foreground font-mono text-sm">#{i + 1}</span>
                                <span className="text-foreground font-medium">{user.name}</span>
                            </div>
                            <span className="text-info font-bold">
                                {user.value < 60 
                                    ? `${user.value} min` 
                                    : `${Math.floor(user.value / 60)}h ${user.value % 60 > 0 ? `${user.value % 60}m` : ""}`
                                }
                            </span>
                        </div>
                    ))}
                    {social.topVocal.length === 0 && <p className="text-muted-foreground text-sm italic">Aucun temps vocal enregistré.</p>}
                </div>
            </div>
        </div>
    );
}
