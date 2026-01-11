"use client";

import { cn } from "@/lib/utils";
import type { LadderEntry } from "@/server/actions/ladder-actions";
import { Crown, Medal } from "lucide-react";

type Props = {
    entry: LadderEntry;
    valueLabel: string;
    progress: number;
    accentColor: "purple" | "cyan" | "amber";
};

export function LeaderboardCard({ entry, valueLabel, progress, accentColor }: Props) {
    const colorClasses = {
        purple: {
            bg: "from-purple-500/10 to-purple-500/5",
            border: "border-purple-500/20",
            progress: "bg-gradient-to-r from-purple-600 to-purple-400",
            text: "text-purple-300",
            highlight: "ring-2 ring-purple-500/50 bg-purple-500/10"
        },
        cyan: {
            bg: "from-cyan-500/10 to-cyan-500/5",
            border: "border-cyan-500/20",
            progress: "bg-gradient-to-r from-cyan-600 to-cyan-400",
            text: "text-cyan-300",
            highlight: "ring-2 ring-cyan-500/50 bg-cyan-500/10"
        },
        amber: {
            bg: "from-amber-500/10 to-amber-500/5",
            border: "border-amber-500/20",
            progress: "bg-gradient-to-r from-amber-600 to-amber-400",
            text: "text-amber-300",
            highlight: "ring-2 ring-amber-500/50 bg-amber-500/10"
        }
    };

    const colors = colorClasses[accentColor];

    const getRankIcon = () => {
        if (entry.rank === 1) return <Crown className="h-5 w-5 text-yellow-400 animate-pulse" />;
        if (entry.rank === 2) return <Medal className="h-5 w-5 text-gray-300" />;
        if (entry.rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
        return <span className="text-sm font-mono text-muted-foreground w-5 text-center">{entry.rank}</span>;
    };

    const getRankBadge = () => {
        if (entry.rank === 1) return "🥇";
        if (entry.rank === 2) return "🥈";
        if (entry.rank === 3) return "🥉";
        return null;
    };

    return (
        <div
            className={cn(
                "relative p-4 rounded-xl border backdrop-blur-sm transition-all duration-300",
                "bg-gradient-to-r",
                colors.bg,
                colors.border,
                entry.isCurrentUser && colors.highlight,
                "hover:scale-[1.01] hover:shadow-lg"
            )}
        >
            {/* Rank Badge for Top 3 */}
            {getRankBadge() && (
                <div className="absolute -top-2 -left-2 text-2xl animate-bounce">
                    {getRankBadge()}
                </div>
            )}

            <div className="flex items-center gap-4">
                {/* Rank */}
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/20">
                    {getRankIcon()}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span
                            className={cn(
                                "font-semibold truncate",
                                entry.isCurrentUser && "text-primary"
                            )}
                            style={entry.discordRoleColor ? { color: `#${entry.discordRoleColor.toString(16).padStart(6, '0')}` } : undefined}
                        >
                            {entry.discordNickname || "Membre"}
                        </span>
                        {entry.isCurrentUser && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                                VOUS
                            </span>
                        )}
                        {entry.classe && (
                            <span className="text-xs text-muted-foreground">
                                • {entry.classe}
                            </span>
                        )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 h-2 bg-black/20 rounded-full overflow-hidden">
                        <div
                            className={cn("h-full rounded-full transition-all duration-500", colors.progress)}
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Value */}
                <div className={cn("text-right font-mono font-bold", colors.text)}>
                    {valueLabel}
                </div>
            </div>
        </div>
    );
}
