"use client";

import { cn } from "@/lib/utils";
import type { LadderEntry } from "@/server/actions/ladder-actions";
import { Crown, Medal, Trophy, ShieldCheck, User, Zap, Ghost, Utensils, Coffee, Plane, Clock, Umbrella } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getClass } from "@/lib/dofus-assets";

type Props = {
    entry: LadderEntry;
    valueLabel: React.ReactNode;
    accentColor: "purple" | "cyan" | "amber" | "emerald" | "yellow" | "blue";
};

export function LeaderboardCard({ entry, valueLabel, accentColor }: Props) {
    const colorClasses = {
        blue: {
            border: "group-hover:border-blue-500/30 border-white/5",
            bg: "hover:bg-blue-500/[0.03]",
            rankText: "text-blue-400",
            valueText: "text-blue-300",
            glow: "bg-blue-400/10",
            highlight: "bg-blue-500/10 border-blue-500/20 ring-1 ring-blue-500/20"
        },
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
        },
        emerald: {
            border: "group-hover:border-emerald-500/30 border-white/5",
            bg: "hover:bg-emerald-500/[0.03]",
            rankText: "text-emerald-400",
            valueText: "text-emerald-300",
            glow: "bg-emerald-400/10",
            highlight: "bg-emerald-500/10 border-emerald-500/20 ring-1 ring-emerald-500/20"
        },
        yellow: {
            border: "group-hover:border-yellow-500/30 border-white/5",
            bg: "hover:bg-yellow-500/[0.03]",
            rankText: "text-yellow-400",
            valueText: "text-yellow-300",
            glow: "bg-yellow-400/10",
            highlight: "bg-yellow-500/10 border-yellow-500/20 ring-1 ring-yellow-500/20"
        }
    };

    const colors = colorClasses[accentColor];
    const isTop3 = entry.rank <= 3;
    const isGeneral = !!(entry.dofusLevel || entry.totalXpBigInt);
    
    // 0-value "Tourist" / "Bad Student" logic
    // We don't apply it to the General ladder (total XP) because 0 is normal for new characters
    const isTourist = !isGeneral && entry.value === 0;
    const dofusClass = entry.classe ? getClass(entry.classe) : null;

    return (
        <div
            className={cn(
               "group relative flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 rounded-2xl border transition-all duration-500 overflow-hidden",
               "backdrop-blur-md shadow-lg",
               colors.border,
               isTop3 ? "bg-white/[0.04] border-white/20 shadow-white/5" : "bg-zinc-900/40 border-white/5",
               isTourist && "border-red-500/10 grayscale-[0.8] opacity-60 hover:opacity-100 hover:grayscale-0",
               entry.isCurrentUser && "ring-1 ring-white/20 bg-white/[0.06]"
            )}
        >
            {/* 1. Rank & Portrait */}
            <div className="flex items-center gap-3 shrink-0">
                <div className="w-8 flex justify-center shrink-0">
                    {entry.rank === 1 ? (
                        <Trophy className="h-5 w-5 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
                    ) : entry.rank === 2 ? (
                        <Medal className="h-5 w-5 text-slate-300 drop-shadow-[0_0_10px_rgba(203,213,225,0.4)]" />
                    ) : entry.rank === 3 ? (
                        <Medal className="h-5 w-5 text-amber-700 drop-shadow-[0_0_10px_rgba(180,83,9,0.4)]" />
                    ) : (
                        <span className="text-[10px] font-black italic text-zinc-600 group-hover:text-zinc-400 transition-colors">
                            #{entry.rank.toString().padStart(2, '0')}
                        </span>
                    )}
                </div>

                <div className={cn(
                    "w-11 h-11 rounded-xl overflow-hidden border border-white/10 shrink-0 shadow-2xl bg-black/40 relative group/avatar",
                    isTop3 && "ring-2 ring-white/10"
                )}>
                    {entry.discordImage ? (
                        <img src={entry.discordImage} alt="Avatar" className="w-full h-full object-cover transition-transform duration-700 group-hover/avatar:scale-125" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-800"><User className="w-5 h-5 text-zinc-500" /></div>
                    )}
                    {dofusClass && (
                        <div className="absolute -bottom-1 -right-1 w-5.5 h-5.5 rounded-md border border-white/20 bg-zinc-900 p-0.5 shadow-2xl z-20">
                            <img src={dofusClass.icon} alt={dofusClass.name} className="w-full h-full object-contain" />
                        </div>
                    )}
                </div>
            </div>

            {/* 2. User Info (Identity) */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-2 flex-wrap">
                    <span 
                        className={cn("text-[15px] font-black tracking-tight truncate", isTop3 ? "text-white" : "text-zinc-100")}
                        style={entry.discordRoleColor ? { color: `#${entry.discordRoleColor.toString(16).padStart(6, '0')}` } : undefined}
                    >
                        {entry.discordNickname || "Membre"}
                    </span>
                    {entry.isCurrentUser && <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-black uppercase tracking-widest">VOUS</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    {entry.pseudoDofus && <span className="text-[10px] text-zinc-400 font-medium italic truncate">{entry.pseudoDofus}</span>}
                    {!isGeneral && entry.classe && <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">• {entry.classe}</span>}
                </div>
            </div>

            {/* 3. Center Section: Perfectly Centered Level (Hidden on extreme mobile) */}
            <div className="hidden sm:flex justify-center items-center px-4 shrink-0">
                {isGeneral && entry.dofusLevel ? (
                    <div className="flex flex-col items-center">
                        <span className="text-[7px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-1.5 opacity-40">Niveau</span>
                        <div className="relative group/lv">
                            <div className="absolute inset-0 bg-blue-500/20 blur-md rounded-full opacity-0 group-hover/lv:opacity-100 transition-opacity" />
                            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.05] border border-white/10 shadow-2xl backdrop-blur-xl group-hover/lv:border-blue-400/50 transition-all duration-500">
                                <span className={cn("text-sm font-black tracking-tighter tabular-nums", entry.dofusLevel >= 200 ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" : "text-white")}>
                                    {entry.dofusLevel}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/5 to-transparent invisible" />
                )}
            </div>

            {/* 4. Value Section */}
            <div className="flex justify-end pr-1 sm:pr-2 shrink-0">
                {isGeneral ? (
                    <div className="flex flex-col items-end">
                        <div className={cn("text-lg font-black tracking-tighter flex items-center gap-2", isTop3 ? "text-white" : "text-blue-400")}>
                            <span className="opacity-30 text-[10px] font-black mt-1 tracking-widest">XP</span>
                            {Number(entry.totalXpBigInt || 0).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 opacity-30 group-hover:opacity-60 transition-opacity">
                            <Zap className="w-3 h-3 text-blue-300" />
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] italic">Ladder Général</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-end">
                        <div className={cn("text-[14px] font-black tracking-tight uppercase", isTop3 ? "text-white" : colors.valueText)}>
                            {valueLabel}
                        </div>
                        {isTourist ? (
                            <div className={cn(
                                "flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full border animate-pulse",
                                entry.isInVacation 
                                    ? "bg-blue-500/10 border-blue-500/20 text-blue-400" 
                                    : "bg-red-500/10 border-red-500/20 text-red-400"
                            )}>
                                {entry.isInVacation ? (
                                    <Umbrella className="w-3 h-3" />
                                ) : (
                                    <Ghost className="w-3 h-3" />
                                )}
                                <span className="text-[7px] font-black uppercase tracking-widest leading-none">
                                    {entry.isInVacation ? "En Vacances" : "Mauvais Élève"}
                                </span>
                            </div>
                        ) : accentColor === "purple" && (
                            <div className="text-[8px] text-zinc-500 font-black uppercase tracking-widest mt-1.5 opacity-40">Sync auto</div>
                        )}
                    </div>
                )}
            </div>

            {/* Top Shine Effect */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
    );
}
