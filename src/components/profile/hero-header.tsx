"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, Palmtree, Award, Medal, Star, ShieldCheck, Sparkles, UserCircle, Link2, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
    isAdmin?: boolean;
    canViewMissions?: boolean;
    canViewLadder?: boolean;
    guildName?: string;
    sigilRoles?: any[];
    discordRoleName?: string;
    discordRoleColor?: number;
    welcomeBadgeName?: string | null;
    /** Le slug de partage (pseudoDofus encodé ou profileId en fallback) */
    shareSlug?: string | null;
    /** L'ID de la guilde — nécessaire pour construire le lien de partage */
    guildId?: string | null;
    /** Si true, on est en lecture seule (profil d'un autre membre) : on masque le bouton Partager */
    readOnly?: boolean;
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
    isAdmin = false,
    canViewMissions = true,
    canViewLadder = true,
    guildName = "Guilde",
    sigilRoles = [],
    discordRoleName,
    discordRoleColor,
    welcomeBadgeName,
    shareSlug,
    guildId,
    readOnly = false,
}: HeroHeaderProps) {
    const [copied, setCopied] = useState(false);

    const handleShare = async () => {
        if (!shareSlug || !guildId) return;
        const url = `${window.location.origin}/dashboard/${guildId}/members/${shareSlug}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success("Lien copié !", {
                description: "Partage ce lien avec les membres de ta guilde.",
                duration: 3000,
            });
            setTimeout(() => setCopied(false), 2500);
        } catch {
            toast.error("Impossible de copier le lien.");
        }
    };

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
                {/* Share Button — only on own profile */}
                {!readOnly && shareSlug && guildId && (
                    <div className="absolute top-4 right-4 z-20">
                        <Button
                            id="profile-share-btn"
                            size="sm"
                            onClick={handleShare}
                            className={cn(
                                "gap-2 transition-all duration-500 group overflow-hidden relative border shadow-lg",
                                copied 
                                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:bg-emerald-500/30"
                                    : "bg-indigo-600/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/40 hover:border-indigo-400/50 hover:text-indigo-200 shadow-[0_0_20px_rgba(79,70,229,0.15)] hover:shadow-[0_0_30px_rgba(79,70,229,0.3)]"
                            )}
                        >
                            {/* Hover Glow Effect inside button */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:translate-x-full transition-all duration-1000 -skew-x-12" />

                            {copied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span className="text-sm font-bold tracking-widest uppercase relative z-10">Copié</span>
                                </>
                            ) : (
                                <>
                                    <Link2 className="w-4 h-4 group-hover:scale-110 transition-transform relative z-10" />
                                    <span className="text-sm font-black tracking-widest uppercase relative z-10">Partager</span>
                                </>
                            )}
                        </Button>
                    </div>
                )}

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
                        {welcomeBadgeName && sigilRoles.some(g => g.role?.slug === "probation") && (
                            <div className="absolute -bottom-2 -left-2 p-1.5 bg-zinc-900 rounded-full border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.3)] shadow-lg animate-pulse" title={welcomeBadgeName}>
                                <Sparkles className="w-5 h-5 text-indigo-400 fill-indigo-500/10" />
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

                            {sigilRoles.filter(g => g.role?.slug !== "probation").map((grant: any) => (
                                <Badge
                                    key={grant.id}
                                    className="bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 font-black uppercase tracking-[0.1em] text-[10px] py-1 gap-1.5"
                                >
                                    <Sparkles className="w-3 h-3" />
                                    {grant.label}
                                    {grant.expiresAt && (
                                        <span className="opacity-50 text-[9px] font-medium lowercase italic">
                                            expire {formatDistanceToNow(new Date(grant.expiresAt), { addSuffix: true, locale: fr })}
                                        </span>
                                    )}
                                </Badge>
                            ))}

                            {/* Specific NEW/PROBATION Badge - High Visibility */}
                            {welcomeBadgeName && sigilRoles.filter(g => g.role?.slug === "probation").map((grant: any) => (
                                <Badge
                                    key={grant.id}
                                    className="bg-indigo-500/30 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/40 font-black uppercase tracking-[0.1em] text-[11px] py-1 gap-2 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                                >
                                    <Sparkles className="w-3.5 h-3.5 fill-indigo-400/20" />
                                    {welcomeBadgeName}
                                    {grant.expiresAt && (
                                        <span className="opacity-60 text-[9px] font-medium lowercase italic border-l border-indigo-500/30 pl-2">
                                            expire {formatDistanceToNow(new Date(grant.expiresAt), { addSuffix: true, locale: fr })}
                                        </span>
                                    )}
                                </Badge>
                            ))}

                            {discordRoleName && (
                                <Badge
                                    variant="outline"
                                    className="font-bold uppercase tracking-[0.1em] text-[10px] py-1 border-white/10 bg-white/5"
                                    style={{
                                        color: discordRoleColor && discordRoleColor > 0
                                            ? `#${discordRoleColor.toString(16).padStart(6, "0")}`
                                            : "#94a3b8"
                                    }}
                                >
                                    <UserCircle className="w-3.5 h-3.5 mr-1.5" />
                                    {discordRoleName}
                                </Badge>
                            )}
                        </div>

                        {/* Stats Grid Removed - Redundant with Stats Tab */}
                    </div>
                </div>
            </div>
        </div>
    );
}
