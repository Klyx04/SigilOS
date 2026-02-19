"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Crown, Palmtree, TrendingUp, Target, Award, Medal, Star, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContributorTier } from "@/server/actions/profile-actions";

// Tier configuration
const TIER_CONFIG = {
    LEGENDE: {
        label: "Légende",
        icon: Crown,
        bgColor: "bg-amber-500/15",
        textColor: "text-amber-400",
        borderColor: "border-amber-500/30",
        hoverColor: "hover:bg-amber-500/20",
        iconFill: "fill-amber-500/20",
    },
    CHAMPION: {
        label: "Champion",
        icon: Award,
        bgColor: "bg-slate-400/15",
        textColor: "text-slate-300",
        borderColor: "border-slate-400/30",
        hoverColor: "hover:bg-slate-400/20",
        iconFill: "fill-slate-400/20",
    },
    PILIER: {
        label: "Pilier",
        icon: Medal,
        bgColor: "bg-orange-600/15",
        textColor: "text-orange-400",
        borderColor: "border-orange-600/30",
        hoverColor: "hover:bg-orange-600/20",
        iconFill: "fill-orange-600/20",
    },
} as const;

interface HeroHeaderProps {
    avatarUrl?: string | null;
    displayName: string;
    roleColor?: number;
    contributorTier?: ContributorTier | null;
    rank?: number;
    isOnVacation?: boolean;
    isUpcomingVacation?: boolean;
    vacationStart?: Date | null;
    vacationEnd?: Date | null;
    joinedAt?: string | Date | null;
    xp: number;
    weeklyXp: number;
    missionsValidated: number;
    weeklyMissions: number;
    isAdmin?: boolean;
    canViewMissions?: boolean;
    canViewLadder?: boolean;
    guildName?: string;
}

export function HeroHeader({
    avatarUrl,
    displayName,
    roleColor = 0,
    contributorTier = null,
    rank,
    isOnVacation = false,
    isUpcomingVacation = false,
    vacationStart,
    vacationEnd,
    joinedAt,
    xp,
    weeklyXp,
    missionsValidated,
    weeklyMissions,
    isAdmin = false,
    canViewMissions = true,
    canViewLadder = true,
    guildName = "Guilde"
}: HeroHeaderProps) {
    const roleHexColor = roleColor > 0
        ? `#${roleColor.toString(16).padStart(6, "0")}`
        : "#8b5cf6"; // Default purple

    const tierConfig = contributorTier ? TIER_CONFIG[contributorTier] : null;
    const TierIcon = tierConfig?.icon || Star;

    return (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 backdrop-blur-xl">
            {/* Background Gradient */}
            <div
                className="absolute inset-0 opacity-30"
                style={{
                    background: `linear-gradient(135deg, ${roleHexColor}15 0%, transparent 50%, ${roleHexColor}10 100%)`
                }}
            />

            {/* Content */}
            <div className="relative z-10 p-6 md:p-8">
                <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                    {/* Avatar Section */}
                    <div className="relative shrink-0">
                        {/* Glow Effect */}
                        <div
                            className="absolute inset-0 rounded-full blur-2xl opacity-40"
                            style={{ backgroundColor: roleHexColor }}
                        />

                        <Avatar
                            className="relative w-24 h-24 md:w-28 md:h-28 border-[3px] shadow-2xl"
                            style={{ borderColor: roleHexColor }}
                        >
                            <AvatarImage src={avatarUrl || ""} alt={displayName} className="object-cover" />
                            <AvatarFallback className="text-3xl font-bold bg-zinc-900 text-zinc-300">
                                {displayName?.[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                        </Avatar>

                        {/* Badges on Avatar */}
                        {tierConfig && (
                            <div className={cn("absolute -top-2 -right-2 p-1.5 bg-zinc-900 rounded-full shadow-lg", tierConfig.borderColor, "border")} title={tierConfig.label}>
                                <TierIcon className={cn("w-5 h-5", tierConfig.textColor, tierConfig.iconFill)} />
                            </div>
                        )}
                        {isAdmin && (
                            <div className="absolute -top-2 -left-2 p-1.5 bg-zinc-900 rounded-full border border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.3)] shadow-lg" title="Administration">
                                <ShieldCheck className="w-5 h-5 text-purple-400 fill-purple-500/10" />
                            </div>
                        )}
                        {isOnVacation && (
                            <div className="absolute -bottom-2 -right-2 p-1.5 bg-zinc-900 rounded-full border border-cyan-500/40 shadow-lg" title="En Vacances">
                                <Palmtree className="w-5 h-5 text-cyan-400 fill-cyan-400/20" />
                            </div>
                        )}
                    </div>

                    {/* Info Section */}
                    <div className="flex-1 min-w-0 text-center md:text-left">
                        {/* Name */}
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-2">
                            <h1
                                className="text-3xl md:text-4xl font-bold tracking-tight truncate leading-tight"
                                style={{ color: roleHexColor }}
                            >
                                {displayName}
                            </h1>
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                            {isAdmin && (
                                <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/20 font-black uppercase tracking-[0.1em] text-[10px] py-1">
                                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                                    Administration
                                </Badge>
                            )}
                            {tierConfig && (
                                <Badge className={cn(tierConfig.bgColor, tierConfig.textColor, tierConfig.borderColor, tierConfig.hoverColor)}>
                                    <TierIcon className="w-3 h-3 mr-1" />
                                    {tierConfig.label}
                                    {rank && <span className="ml-1 opacity-70">#{rank}</span>}
                                </Badge>
                            )}
                            {isOnVacation && (
                                <Badge className="bg-cyan-500/15 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20">
                                    <Palmtree className="w-3 h-3 mr-1" />
                                    En Congés
                                </Badge>
                            )}
                            {isUpcomingVacation && vacationStart && (
                                <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20">
                                    <Palmtree className="w-3 h-3 mr-1" />
                                    Absence : {vacationStart.toLocaleDateString("fr-FR", { day: 'numeric', month: 'short' })}
                                </Badge>
                            )}
                            {joinedAt && (
                                <Badge variant="outline" className="bg-white/5 text-zinc-400 border-white/10">
                                    Membre depuis {new Date(joinedAt).toLocaleDateString("fr-FR", { month: 'long', year: 'numeric' })}
                                </Badge>
                            )}
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                            {/* Total XP */}
                            {canViewLadder && (
                                <div className="px-4 py-3 rounded-lg bg-purple-500/10 border border-purple-500/20 backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingUp className="w-4 h-4 text-purple-400" />
                                        <span className="text-xs text-purple-300 font-medium">XP Total</span>
                                    </div>
                                    <p className="text-xl font-bold text-white">{xp.toLocaleString()}</p>
                                </div>
                            )}

                            {/* Weekly XP */}
                            {canViewLadder && (
                                <div className="px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingUp className="w-4 h-4 text-green-400" />
                                        <span className="text-xs text-green-300 font-medium">XP Semaine</span>
                                    </div>
                                    <p className="text-xl font-bold text-white">+{weeklyXp.toLocaleString()}</p>
                                </div>
                            )}

                            {/* Total Missions */}
                            {canViewMissions && (
                                <div className="px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Target className="w-4 h-4 text-blue-400" />
                                        <span className="text-xs text-blue-300 font-medium">Missions Totales</span>
                                    </div>
                                    <p className="text-xl font-bold text-white">{missionsValidated}</p>
                                </div>
                            )}

                            {/* Weekly Missions */}
                            {canViewMissions && (
                                <div className="px-4 py-3 rounded-lg bg-orange-500/10 border border-orange-500/20 backdrop-blur-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Target className="w-4 h-4 text-orange-400" />
                                        <span className="text-xs text-orange-300 font-medium">Missions Semaine</span>
                                    </div>
                                    <p className="text-xl font-bold text-white">{weeklyMissions}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
