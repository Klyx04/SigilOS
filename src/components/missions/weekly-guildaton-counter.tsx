"use client";

import { Coins, Info } from "lucide-react";
import { GUILDATONS_MAX_PER_WEEK } from "@/lib/kama-constants";
import { cn } from "@/lib/utils";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface WeeklyGuildatonCounterProps {
    current: number;
    className?: string;
}

export function WeeklyGuildatonCounter({ current, className }: WeeklyGuildatonCounterProps) {
    const percentage = Math.min(100, (current / GUILDATONS_MAX_PER_WEEK) * 100);
    const isMax = current >= GUILDATONS_MAX_PER_WEEK;

    return (
        <div className={cn("bg-zinc-900/60 border border-white/5 rounded-2xl p-4 backdrop-blur-sm", className)}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "p-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20",
                        isMax && "bg-emerald-500/10 border-emerald-500/20"
                    )}>
                        <Coins className={cn("w-4 h-4 text-yellow-500", isMax && "text-emerald-400")} />
                    </div>
                    <div>
                        <p className="text-xs font-black text-white uppercase tracking-tighter">Guildatons Hebdo</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Récompenses perso</p>
                    </div>
                </div>

                <div className="text-right">
                    <div className="flex items-baseline gap-1 justify-end">
                        <span className={cn(
                            "text-xl font-black font-mono tracking-tighter",
                            isMax ? "text-emerald-400" : "text-white"
                        )}>
                            {current}
                        </span>
                        <span className="text-xs font-bold text-zinc-600">/ {GUILDATONS_MAX_PER_WEEK}</span>
                    </div>
                </div>
            </div>

            <div className="relative h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div
                    className={cn(
                        "h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(234,179,8,0.2)]",
                        isMax 
                            ? "bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)]" 
                            : "bg-gradient-to-r from-yellow-600 to-amber-400"
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {isMax ? (
                <p className="mt-2 text-[10px] font-bold text-emerald-400/80 uppercase tracking-widest text-center flex items-center justify-center gap-1">
                    ✓ Maximum atteint cette semaine
                </p>
            ) : (
                <div className="mt-2 flex items-center justify-between">
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                        {GUILDATONS_MAX_PER_WEEK - current} restants
                    </p>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="w-3 h-3 text-zinc-700 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="bg-zinc-800 border-white/10 text-[10px] max-w-[200px]">
                                <p>Le gain de guildatons (missions & kamas) est limité à 250 par semaine.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}
        </div>
    );
}
