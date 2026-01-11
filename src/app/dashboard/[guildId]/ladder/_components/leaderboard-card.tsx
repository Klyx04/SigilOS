"use client";

import { cn } from "@/lib/utils";
import type { LadderEntry } from "@/server/actions/ladder-actions";
import { Crown, Medal, Trophy } from "lucide-react";

type Props = {
    entry: LadderEntry;
    valueLabel: string;
    accentColor: "purple" | "cyan";
};

export function LeaderboardCard({ entry, valueLabel, accentColor }: Props) {
    const colorClasses = {
        purple: {
            bg: "from-purple-500/5 via-purple-500/10 to-transparent",
            border: "border-purple-500/30",
            rankBg: "bg-purple-500/20",
            rankText: "text-purple-300",
            valueBg: "bg-purple-500/10",
            valueText: "text-purple-200",
            highlight: "ring-2 ring-purple-400/60 bg-purple-500/15 shadow-purple-500/20"
        },
        cyan: {
            bg: "from-cyan-500/5 via-cyan-500/10 to-transparent",
            border: "border-cyan-500/30",
            rankBg: "bg-cyan-500/20",
            rankText: "text-cyan-300",
            valueBg: "bg-cyan-500/10",
            valueText: "text-cyan-200",
            highlight: "ring-2 ring-cyan-400/60 bg-cyan-500/15 shadow-cyan-500/20"
        }
    };

    const colors = colorClasses[accentColor];

    const getRankDisplay = () => {
        if (entry.rank === 1) {
            return {
                icon: <Crown className="h-5 w-5 text-yellow-400" />,
                emoji: "🥇",
                bgClass: "bg-gradient-to-br from-yellow-500/30 to-yellow-600/10 border-yellow-400/40"
            };
        }
        if (entry.rank === 2) {
            return {
                icon: <Medal className="h-5 w-5 text-gray-300" />,
                emoji: "🥈",
                bgClass: "bg-gradient-to-br from-gray-400/30 to-gray-500/10 border-gray-300/40"
            };
        }
        if (entry.rank === 3) {
            return {
                icon: <Medal className="h-5 w-5 text-amber-500" />,
                emoji: "🥉",
                bgClass: "bg-gradient-to-br from-amber-600/30 to-amber-700/10 border-amber-500/40"
            };
        }
        return {
            icon: <Trophy className="h-4 w-4 opacity-50" />,
            emoji: null,
            bgClass: colors.rankBg
        };
    };

    const rankDisplay = getRankDisplay();

    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-xl border backdrop-blur-sm transition-all duration-300",
                "bg-gradient-to-br",
                colors.bg,
                colors.border,
                entry.isCurrentUser && colors.highlight,
                entry.isCurrentUser && "shadow-lg",
                "hover:scale-[1.02] hover:shadow-md"
            )}
        >
            <div className="p-4 flex items-center gap-4">
                {/* Rank Badge */}
                <div className={cn(
                    "relative flex items-center justify-center w-14 h-14 rounded-xl border-2 shrink-0 transition-transform group-hover:scale-110",
                    rankDisplay.bgClass
                )}>
                    {rankDisplay.emoji ? (
                        <span className="text-2xl">{rankDisplay.emoji}</span>
                    ) : (
                        <>
                            {rankDisplay.icon}
                            <span className={cn("absolute bottom-1 right-1 text-xs font-bold", colors.rankText)}>
                                #{entry.rank}
                            </span>
                        </>
                    )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span
                            className={cn(
                                "font-semibold text-base truncate",
                                entry.isCurrentUser && "text-white"
                            )}
                            style={entry.discordRoleColor ? { color: `#${entry.discordRoleColor.toString(16).padStart(6, '0')}` } : undefined}
                        >
                            {entry.discordNickname || "Membre"}
                        </span>
                        {entry.isCurrentUser && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/30 text-primary font-medium shrink-0">
                                VOUS
                            </span>
                        )}
                    </div>
                    {(entry.pseudoDofus || entry.classe) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {entry.pseudoDofus && <span>{entry.pseudoDofus}</span>}
                            {entry.pseudoDofus && entry.classe && <span>•</span>}
                            {entry.classe && <span>{entry.classe}</span>}
                        </div>
                    )}
                </div>

                {/* Value Badge */}
                <div className={cn(
                    "px-4 py-2 rounded-lg border shrink-0",
                    colors.valueBg,
                    colors.border
                )}>
                    <div className={cn("text-sm font-mono font-bold whitespace-nowrap", colors.valueText)}>
                        {valueLabel}
                    </div>
                </div>
            </div>
        </div>
    );
}
