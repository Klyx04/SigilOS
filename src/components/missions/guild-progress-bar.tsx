"use client";

import { useEffect, useState } from "react";
import { GUILD_TIERS } from "@/lib/game-data/guild-tiers";
import { cn } from "@/lib/utils";
import { Trophy, Target, Sparkles, Medal, Crown, BarChart3 } from "lucide-react";
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

export function GuildProgressBar({ currentXP, targetTier = 5, guildId, kamaStatus, raidRequireKamaDonation = true }: GuildProgressBarProps) {
    const [progress, setProgress] = useState(0);

    const targetInfo = GUILD_TIERS[targetTier as keyof typeof GUILD_TIERS] || GUILD_TIERS[5];
    const maxXP = targetInfo.xpMax;

    const percentage = Math.min(100, (currentXP / maxXP) * 100);

    useEffect(() => {
        const timer = setTimeout(() => setProgress(percentage), 300);
        return () => clearTimeout(timer);
    }, [percentage]);

    let currentAchievedTier = 0;
    for (let i = 5; i >= 1; i--) {
        if (currentXP >= GUILD_TIERS[i as keyof typeof GUILD_TIERS].xpMax) {
            currentAchievedTier = i;
            break;
        }
    }

    // Find the next milestone (step) not yet reached within the target tier
    const targetSteps = GUILD_TIERS[targetTier as keyof typeof GUILD_TIERS]?.steps || [];
    const nextStep = targetSteps.find(step => currentXP < step.xp);
    const xpToNextStep = nextStep ? nextStep.xp - currentXP : 0;

    // Helper for Milestone styling (Medal Progression)
    const getMilestoneStyle = (index: number) => {
        switch (index) {
            case 0: // Bronze
                return {
                    icon: Medal,
                    color: "text-warning",
                    borderColor: "border-warning/50",
                    bg: "bg-warning/80",
                    glow: "",
                    label: "Bronze"
                };
            case 1: // Silver
                return {
                    icon: Medal,
                    color: "text-foreground",
                    borderColor: "border-border/50",
                    bg: "bg-surface/80",
                    glow: "",
                    label: "Argent"
                };
            case 2: // Gold
                return {
                    icon: Medal,
                    color: "text-warning",
                    borderColor: "border-warning/50",
                    bg: "bg-warning/80",
                    glow: "",
                    label: "Or"
                };
            case 3: // Platinum/Diamond (Validé)
                return {
                    icon: Trophy,
                    color: "text-info",
                    borderColor: "border-info/50",
                    bg: "bg-info/80",
                    glow: "",
                    label: "Platine"
                };
            default:
                return {
                    icon: Target,
                    color: "text-muted-foreground",
                    borderColor: "border-border",
                    bg: "bg-surface",
                    glow: "",
                    label: "Jalon"
                };
        }
    };

    return (
        <div className="w-full relative overflow-hidden rounded-3xl bg-surface border border-border">

            {/* MAIN LAYOUT CONTAINER */}
            <div className="relative z-10 p-6 md:p-8 flex flex-col gap-8 md:gap-12">

                {/* 1. HEADER ROW (Split layout v3) */}
                <div className="relative w-full flex flex-col md:flex-row items-start justify-between gap-10 md:gap-4 min-h-[80px] md:min-h-0">

                    {/* LEFT: Guild Identity */}
                    <div className="flex items-center gap-4 relative z-30 shrink-0">
                        <div className="p-3 rounded-2xl bg-foreground/[0.03] border border-border relative">
                            <Crown className="w-7 h-7 text-warning dark:text-warning relative z-10" />
                        </div>
                        <div className="space-y-0.5">
                            <h3 className="font-black text-foreground text-2xl tracking-tighter leading-none">
                                Activité Guilde
                            </h3>
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                                <span>Objectif : Palier {targetTier}</span>
                            </div>
                        </div>
                    </div>

                    {/* CENTER: Timer (Absolute on desktop, completely isolated) */}
                    <div className="relative md:absolute md:left-1/2 md:-translate-x-1/2 md:top-0 w-full md:w-auto flex justify-center z-20 order-first md:order-none mb-6 md:mb-0">
                        <div className="cursor-default transform scale-110 md:scale-125 origin-top">
                            <div className="relative">
                                <ResetCountdown />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: XP Stats (with explicit min-width to prevent squeeze) */}
                    <div className="text-left md:text-right relative z-30 self-end md:self-start shrink-0 min-w-[120px]">
                        <div className="flex items-baseline justify-start md:justify-end gap-2">
                            <span className="text-4xl font-black text-foreground tracking-tighter">
                                {currentXP.toLocaleString()}
                            </span>
                            <span className="text-lg font-black text-muted-foreground tracking-tight italic">
                                / {maxXP.toLocaleString()}
                            </span>
                        </div>
                        <div className="text-caption text-muted-foreground font-black uppercase tracking-[0.2em] whitespace-nowrap">
                            XP de la semaine
                        </div>
                    </div>
                </div>

                {/* 2. PROGRESS TRACK (Separated) */}
                {/* 2. PROGRESS TRACK & MILESTONES WRAPPER */}
                {/* 2. PROGRESS TRACK & MILESTONES WRAPPER */}
                {/* 2. PROGRESS TRACK & MILESTONES WRAPPER */}
                <div className="relative w-full px-6 md:px-8 mt-2 mb-24">

                    {/* A. TRACK CONTAINER (Reference for absolute positioning) */}
                    <div className="relative h-6 w-full">

                        {/* THE TRACK (Background & Fill) */}
                        <div className="absolute inset-0 bg-foreground/10 rounded-full border border-border overflow-visible">
                            <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="h-full rounded-full bg-info transition-colors duration-300 ease-out relative cursor-help"
                                            style={{ width: `${progress}%` }}
                                        >
                                            <div className="absolute right-0 top-0 bottom-0 w-1 bg-elevated" />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="glass-premium border-border text-foreground font-mono font-bold">
                                        {currentXP.toLocaleString()} / {maxXP.toLocaleString()} XP ({Math.floor(percentage)}%)
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {/* B. MILESTONES OVERLAY (Absolute inset-0 of track container) */}
                        <div className="absolute inset-0 pointer-events-none">
                            {(GUILD_TIERS[targetTier as keyof typeof GUILD_TIERS]?.steps || []).map((step, index, array) => {
                                const pos = (step.xp / maxXP) * 100;
                                const isReached = currentXP >= step.xp;
                                const isLast = index === array.length - 1;
                                const isFirst = index === 0;
                                const style = getMilestoneStyle(index);
                                const Icon = style.icon;

                                const xpDisplay = step.xp >= 1000 ? `${step.xp / 1000}k` : step.xp;

                                return (
                                    <div
                                        key={index}
                                        className="absolute top-0 bottom-0 flex flex-col pointer-events-auto items-center -translate-x-1/2"
                                        style={{ left: `${pos}%` }}
                                    >
                                        {/* Tick Mark - ONLY MIDDLE ONES */}
                                        {!isLast && (
                                            <div className={cn(
                                                "w-1 h-full transition-colors duration-300 z-20", // w-1 = 4px
                                                isReached
                                                    ? "bg-background "
                                                    : "bg-elevated" // Thicker and white-ish even if not reached
                                            )} />
                                        )}

                                        {/* Badge Container */}
                                        <div className="absolute top-8 flex flex-col items-center transition-transform  duration-300 origin-top">
                                            {/* Icon Circle */}
                                            <div className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center border-2 mb-1.5 relative",
                                                style.bg,
                                                style.color,
                                                style.borderColor,
                                                // More vibrant "unreached" state: less opacity reduction, keep saturation
                                                isReached ? style.glow : "opacity-100 grayscale-[0.3] border-border bg-background"
                                            )}>
                                                <Icon className="w-5 h-5 relative z-10" />
                                            </div>

                                            {/* Labels */}
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className={cn(
                                                    "text-caption font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-background border border-border whitespace-nowrap",
                                                    style.color
                                                )}>
                                                    {style.label}
                                                </span>
                                                <span className="text-caption font-black italic text-muted-foreground/60">
                                                    {xpDisplay}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 3. FOOTER */}
                <div className="flex flex-col md:flex-row items-start justify-between gap-4 pt-4 border-t border-border/10 relative z-40 mt-4 w-full">
                    {/* LEFT: Kama widget + legend (if raidRequireKamaDonation is enabled) */}
                    {raidRequireKamaDonation ? (
                        <div className="flex flex-col gap-3 w-full md:w-1/2">
                            {/* Kama contribution widget */}
                            <KamaContributionWidget guildId={guildId} initialStatus={kamaStatus ?? null} />

                            {/* Legend */}
                            <div className="flex items-center gap-6 text-caption text-muted-foreground font-black uppercase tracking-widest italic">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-foreground/10 ring-2 ring-foreground/5" />
                                    <span> À faire</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-info " />
                                    <span className="text-foreground">Complété</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-6 text-caption text-muted-foreground font-black uppercase tracking-widest italic">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-foreground/10 ring-2 ring-foreground/5" />
                                <span> À faire</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-info " />
                                <span className="text-foreground">Complété</span>
                            </div>
                        </div>
                    )}

                    {/* RIGHT: Active Bonus and Raid Notice */}
                    <div className="flex flex-col items-start md:items-end gap-3 mt-4 md:mt-0 w-full md:w-1/2 md:ml-auto">
                        {/* Active Bonus Tracker */}
                        <ActiveBonusBar guildId={guildId} />

                        {/* Raid / Kama Notice (only if toggle ON) */}
                        {raidRequireKamaDonation && (
                            <div className="bg-warning/[0.03] border border-warning/20 rounded-2xl p-4 w-full md:max-w-md text-left md:text-right">
                                <h4 className="text-caption font-black text-warning uppercase tracking-widest flex items-center md:justify-end gap-2 mb-1">
                                    <Sparkles className="w-3.5 h-3.5 text-warning" />
                                    Financement des Raids
                                </h4>
                                <p className="text-caption text-muted-foreground leading-relaxed font-medium">
                                    Les contributions en Kamas sont indispensables pour le financement et la participation de la guilde aux **Raids de Guilde**. Donnez pour soutenir l'effort collectif !
                                </p>
                                <div className="mt-2.5">
                                    <Link
                                        href={`/dashboard/${guildId}/kamas/summary`}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-warning/15 bg-warning/[0.04] hover:bg-warning/[0.08] hover:border-warning/25 text-warning/70 hover:text-warning transition-all duration-200 text-caption font-black uppercase tracking-wider"
                                    >
                                        <BarChart3 className="w-3 h-3 shrink-0" />
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
