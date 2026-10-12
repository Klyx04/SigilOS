"use client";

import { useEffect, useState } from "react";
import { GUILD_TIERS } from "@/lib/game-data/guild-tiers";
import { cn } from "@/lib/utils";
import { Crown, Sparkles, BarChart3 } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ResetCountdown } from "./reset-countdown";
import { ActiveBonusBar } from "@/components/admin/ActiveBonusBar";
import { KamaContributionWidget } from "@/components/kamas/kama-contribution-widget";
import type { KamaWeeklyStatus } from "@/server/actions/kama-actions";
import Link from "next/link";

interface GuildProgressBarProps {
    currentXP: number;
    targetTier?: number;
    guildId: string;
    kamaStatus?: KamaWeeklyStatus | null;
    raidRequireKamaDonation?: boolean;
}

export function GuildProgressBar({
    currentXP,
    targetTier = 5,
    guildId,
    kamaStatus,
    raidRequireKamaDonation = true
}: GuildProgressBarProps) {
    const [progress, setProgress] = useState(0);

    const targetInfo = GUILD_TIERS[targetTier as keyof typeof GUILD_TIERS] || GUILD_TIERS[5];
    const maxXP = targetInfo.xpMax;

    const percentage = Math.min(100, (currentXP / maxXP) * 100);

    useEffect(() => {
        const timer = setTimeout(() => setProgress(percentage), 200);
        return () => clearTimeout(timer);
    }, [percentage]);

    const steps = targetInfo.steps || [];

    return (
        <div className="w-full relative overflow-hidden rounded-2xl bg-surface border border-border">
            <div className="p-4 sm:p-6 lg:p-7 flex flex-col gap-6 sm:gap-8">

                {/* 1. HEADER ROW */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* LEFT: Guild Identity */}
                    <div className="flex items-center gap-3.5 shrink-0">
                        <div className="p-2.5 rounded-xl bg-elevated border border-border">
                            <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
                        </div>
                        <div className="space-y-0.5">
                            <h3 className="font-black text-foreground text-xl sm:text-2xl tracking-tight leading-none">
                                Activité Guilde
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <span>Objectif : Palier {targetTier}</span>
                            </div>
                        </div>
                    </div>

                    {/* CENTER: Reset Countdown */}
                    <div className="self-start sm:self-center">
                        <ResetCountdown />
                    </div>

                    {/* RIGHT: XP Stats */}
                    <div className="text-left sm:text-right shrink-0">
                        <div className="flex items-baseline justify-start sm:justify-end gap-1.5 font-mono">
                            <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight">
                                {currentXP.toLocaleString()}
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-muted-foreground">
                                / {maxXP.toLocaleString()} XP
                            </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                            XP de la semaine
                        </div>
                    </div>
                </div>

                {/* 2. PROGRESS TRACK & JALONS (XP PAR JALON) */}
                <div className="w-full mt-1 mb-2">
                    {/* The Track */}
                    <div className="relative h-4 sm:h-5 w-full bg-elevated rounded-full border border-border overflow-hidden">
                        <TooltipProvider delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div
                                        className="h-full rounded-full bg-info transition-all duration-500 ease-out relative cursor-help"
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-foreground/30" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="bg-surface border-border text-foreground font-mono font-bold text-xs">
                                    {currentXP.toLocaleString()} / {maxXP.toLocaleString()} XP ({Math.floor(percentage)}%)
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Notch dividers on track for each step */}
                        {steps.map((step, index, array) => {
                            const pos = (step.xp / maxXP) * 100;
                            const isReached = currentXP >= step.xp;
                            const isLast = index === array.length - 1;
                            if (isLast) return null;

                            return (
                                <div
                                    key={index}
                                    className={cn(
                                        "absolute top-0 bottom-0 w-0.5 -translate-x-1/2 z-10 transition-colors pointer-events-none",
                                        isReached ? "bg-background/80" : "bg-border-strong/50"
                                    )}
                                    style={{ left: `${pos}%` }}
                                />
                            );
                        })}
                    </div>

                    {/* Milestone XP values directly below the track */}
                    <div className="relative w-full h-5 mt-2">
                        {steps.map((step, index) => {
                            const pos = (step.xp / maxXP) * 100;
                            const isReached = currentXP >= step.xp;
                            const xpDisplay = step.xp >= 1000 ? `${step.xp / 1000}k` : `${step.xp}`;

                            // Responsive positioning to avoid edge cutoff
                            const clampedPos = Math.min(97, Math.max(3, pos));
                            const alignClass = pos >= 95 ? "-translate-x-full" : pos <= 5 ? "translate-x-0" : "-translate-x-1/2";

                            return (
                                <div
                                    key={index}
                                    className={cn("absolute flex flex-col items-center pointer-events-none transition-all", alignClass)}
                                    style={{ left: `${clampedPos}%` }}
                                >
                                    <span className={cn(
                                        "font-mono text-[11px] sm:text-xs font-bold tracking-tight transition-colors whitespace-nowrap",
                                        isReached ? "text-foreground font-black" : "text-muted-foreground/60 font-semibold"
                                    )}>
                                        {xpDisplay}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. FOOTER ROW */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 pt-5 border-t border-border/50">
                    {/* LEFT: Kama contribution widget (if raidRequireKamaDonation) */}
                    <div className="flex flex-col gap-3 w-full lg:w-1/2">
                        {raidRequireKamaDonation ? (
                            <KamaContributionWidget guildId={guildId} initialStatus={kamaStatus ?? null} />
                        ) : null}

                        {/* Legend */}
                        <div className="flex items-center gap-5 text-[11px] text-muted-foreground font-bold uppercase tracking-wider">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-elevated border border-border" />
                                <span>À faire</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-info" />
                                <span className="text-foreground">Complété</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Active Bonus and Raid Notice */}
                    <div className="flex flex-col items-start lg:items-end gap-3 w-full lg:w-1/2">
                        <ActiveBonusBar guildId={guildId} />

                        {raidRequireKamaDonation && (
                            <div className="bg-warning/[0.04] border border-warning/20 rounded-xl p-3.5 sm:p-4 w-full text-left lg:text-right">
                                <h4 className="text-xs font-bold text-warning uppercase tracking-wider flex items-center lg:justify-end gap-1.5 mb-1">
                                    <Sparkles className="w-3.5 h-3.5 text-warning shrink-0" />
                                    Financement des Raids
                                </h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Les contributions en Kamas soutiennent l'effort collectif et financent la participation de la guilde aux <strong className="text-foreground">Raids de Guilde</strong>.
                                </p>
                                <div className="mt-2.5">
                                    <Link
                                        href={`/dashboard/${guildId}/kamas/summary`}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-warning/20 bg-warning/10 hover:bg-warning/20 text-warning transition-colors text-xs font-bold uppercase tracking-wider"
                                    >
                                        <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                                        Récap kamas de la semaine
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
