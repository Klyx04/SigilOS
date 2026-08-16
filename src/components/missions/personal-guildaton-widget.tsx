"use client";

import { useEffect, useState } from "react";
import { Coins, Info, HelpCircle, TrendingUp } from "lucide-react";
import { GUILDATONS_MAX_PER_WEEK } from "@/lib/kama-constants";
import { cn } from "@/lib/utils";
import { 
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface PersonalGuildatonWidgetProps {
    guildatons: number; // Current weekly total
}

export function PersonalGuildatonWidget({ guildatons }: PersonalGuildatonWidgetProps) {
    const [progress, setProgress] = useState(0);
    const max = GUILDATONS_MAX_PER_WEEK;
    const percentage = Math.min(100, (guildatons / max) * 100);

    useEffect(() => {
        const timer = setTimeout(() => setProgress(percentage), 500);
        return () => clearTimeout(timer);
    }, [percentage]);

    const isMaxed = guildatons >= max;

    return (
        <div className="relative group overflow-hidden rounded-2xl bg-zinc-950/40 border border-white/5 p-5 transition-all duration-300 hover:border-amber-500/20">
            {/* Background Glow */}
            <div className={cn(
                "absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl transition-opacity duration-300 pointer-events-none opacity-20",
                isMaxed ? "bg-emerald-500" : "bg-amber-500"
            )} />

            <div className="relative z-10 flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2 rounded-xl border flex items-center justify-center transition-transform group-",
                            isMaxed 
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                        )}>
                            <Coins className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-caption font-black text-muted-foreground uppercase tracking-[0.2em] italic">Mes Guildatons</p>
                            <h4 className="text-sm font-black text-foreground uppercase tracking-tight">Objectif Hebdo</h4>
                        </div>
                    </div>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="text-muted-foreground hover:text-foreground transition-colors">
                                    <HelpCircle className="w-4 h-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent className="glass-premium border-white/10 text-caption font-bold max-w-[200px]">
                                Gagnez des Guildatons en validant des missions ou en donnant des kamas. Limite de {max} par semaine.
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                {/* Progress Stats */}
                <div className="flex items-end justify-between">
                    <div className="flex items-baseline gap-1.5">
                        <span className={cn(
                            "text-3xl font-black tracking-tighter tabular-nums",
                            isMaxed ? "text-emerald-400" : "text-amber-400"
                        )}>
                            {guildatons}
                        </span>
                        <span className="text-sm font-black text-muted-foreground italic">/ {max}</span>
                    </div>
                    
                    {isMaxed ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <TrendingUp className="w-3 h-3 text-emerald-400" />
                            <span className="text-caption font-black text-emerald-400 uppercase tracking-widest">Maximum Atteint</span>
                        </div>
                    ) : (
                        <span className="text-caption font-black text-muted-foreground uppercase tracking-widest italic">
                            {max - guildatons} restants
                        </span>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div 
                            className={cn(
                                "h-full transition-all duration-300 ease-out relative",
                                isMaxed 
                                    ? "bg-gradient-to-r from-emerald-600 to-emerald-400 " 
                                    : "bg-gradient-to-r from-amber-600 to-amber-400 "
                            )}
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                    </div>
                    <div className="flex justify-between items-center text-caption font-black uppercase tracking-widest text-muted-foreground/60 italic">
                        <span>Début</span>
                        <span>{percentage.toFixed(0)}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
