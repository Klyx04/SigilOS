"use client";

import { cn } from "@/lib/utils";
import type { LadderEntry } from "@/server/actions/ladder-actions";
import { Crown, Medal, Trophy, ShieldCheck, User } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
    entry: LadderEntry;
    valueLabel: string;
    accentColor: "purple" | "cyan" | "amber";
};

export function LeaderboardCard({ entry, valueLabel, accentColor }: Props) {
    const colorClasses = {
        purple: {
            border: "group-hover:border-purple-500/30 border-white/5",
            bg: "hover:bg-purple-500/[0.03]",
            rankText: "text-purple-400",
            valueText: "text-purple-300",
            glow: "bg-purple-400/10",
            highlight: "bg-purple-500/10 border-purple-500/20 ring-1 ring-purple-500/20"
        },
        cyan: {
            border: "group-hover:border-cyan-500/30 border-white/5",
            bg: "hover:bg-cyan-500/[0.03]",
            rankText: "text-cyan-400",
            valueText: "text-cyan-300",
            glow: "bg-cyan-400/10",
            highlight: "bg-cyan-500/10 border-cyan-500/20 ring-1 ring-cyan-500/20"
        },
        amber: {
            border: "group-hover:border-amber-500/30 border-white/5",
            bg: "hover:bg-amber-500/[0.03]",
            rankText: "text-amber-400",
            valueText: "text-amber-300",
            glow: "bg-amber-400/10",
            highlight: "bg-amber-500/10 border-amber-500/20 ring-1 ring-amber-500/20"
        }
    };

    const colors = colorClasses[accentColor];

    const isTop3 = entry.rank <= 3;

    return (
        <div
            className={cn(
                "group relative flex items-center gap-4 px-4 py-2.5 rounded-lg border transition-all duration-200",
                "bg-zinc-900/20 backdrop-blur-sm",
                colors.border,
                colors.bg,
                entry.isCurrentUser && colors.highlight,
                !entry.isCurrentUser && "hover:translate-x-1"
            )}
        >
            {/* Rank Position */}
            <div className="w-8 flex justify-center shrink-0">
                {entry.rank === 1 ? (
                    <Crown className="h-5 w-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" />
                ) : entry.rank === 2 ? (
                    <Medal className="h-5 w-5 text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.4)]" />
                ) : entry.rank === 3 ? (
                    <Medal className="h-5 w-5 text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.4)]" />
                ) : (
                    <span className="text-xs font-mono font-bold text-zinc-500">
                        {entry.rank.toString().padStart(2, '0')}
                    </span>
                )}
            </div>

            {/* Identity Group */}
            <div className="flex-1 flex items-center min-w-0 gap-4">
                {/* Discord Avatar */}
                <div className={cn(
                    "w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0 shadow-lg bg-black/40",
                    isTop3 && "ring-2 ring-white/10"
                )}>
                    {entry.discordImage ? (
                        <img
                            src={entry.discordImage}
                            alt={entry.discordNickname || "Avatar"}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                            <User className="w-5 h-5 text-zinc-500" />
                        </div>
                    )}
                </div>

                {/* Info Wrapper */}
                <div className="min-w-0 flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span
                            className={cn(
                                "text-[15px] font-black tracking-tight truncate",
                                isTop3 ? "text-white" : "text-zinc-200"
                            )}
                            style={entry.discordRoleColor ? { color: `#${entry.discordRoleColor.toString(16).padStart(6, '0')}` } : undefined}
                        >
                            {entry.discordNickname || "Membre"}
                        </span>

                        {entry.isCurrentUser && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-indigo-500/20 text-indigo-400 font-bold uppercase tracking-tighter">
                                VOUS
                            </span>
                        )}

                        {entry.isAdmin && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-zinc-950 border-white/10 text-[10px] uppercase font-bold text-zinc-400">
                                        Staff
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>

                    {/* Meta info (Dofus Pseudo/Class) */}
                    <div className="flex items-center gap-2 mt-0.5">
                        {entry.pseudoDofus && (
                            <span className="text-[10px] text-zinc-500 italic truncate max-w-[120px]">
                                {entry.pseudoDofus}
                            </span>
                        )}
                        {entry.pseudoDofus && entry.classe && <span className="text-[10px] text-zinc-700 font-bold">•</span>}
                        {entry.classe && (
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                {entry.classe}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Value (XP/Points) */}
            <div className="shrink-0 text-right pr-2">
                <div className={cn(
                    "text-xs font-black tracking-tight uppercase",
                    isTop3 ? "text-white" : colors.valueText
                )}>
                    {valueLabel}
                </div>
                {accentColor === "purple" && (
                    <div className="text-[9px] text-zinc-600 font-mono mt-0.5">
                        Sync auto
                    </div>
                )}
            </div>

            {/* Hover Accent Glow */}
            <div className={cn(
                "absolute inset-y-0 right-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity",
                colors.glow
            )} />
        </div>
    );
}
