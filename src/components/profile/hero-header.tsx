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
        bgColor: "bg-warning/15",
        textColor: "text-warning",
        borderColor: "border-warning/30",
        hoverColor: "hover:bg-warning/20",
        iconFill: "fill-amber-500/20",
    },
    CHAMPION: {
        label: "Champion",
        icon: Award,
        bgColor: "bg-slate-400/15",
        textColor: "text-foreground",
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
        <div className="relative overflow-hidden rounded-3xl border border-border bg-background/90 backdrop-blur-2xl shadow-2xl">
            {/* Background Gradient */}
            <div
                className="absolute inset-0 opacity-25 pointer-events-none"
                style={{
                    background: `radial-gradient(circle at 10% 20%, ${roleHexColor}30 0%, transparent 60%)`
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
                                "gap-2 transition-all duration-300 group overflow-hidden relative border shadow-lg",
                                copied 
                                    ? "bg-success/20 border-success/50 text-success  hover:bg-success/30"
                                    : "bg-info/20 border-info/30 text-info hover:bg-info/40 hover:border-info/50 hover:text-info  "
                            )}
                        >
                            {/* Hover Glow Effect inside button */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:translate-x-full transition-all duration-300 -skew-x-12" />

                            {copied ? (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span className="text-sm font-bold tracking-widest uppercase relative z-10">Copié</span>
                                </>
                            ) : (
                                <>
                                    <Link2 className="w-4 h-4 group- transition-transform relative z-10" />
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
                            <AvatarFallback className="text-3xl font-bold bg-surface text-foreground">
                                {displayName?.[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                        </Avatar>

                        {/* Badges on Avatar */}
                        {tierConfig && (
                            <div className={cn("absolute -top-2 -right-2 p-1.5 bg-surface rounded-full shadow-lg", tierConfig.borderColor, "border")} title={tierConfig.label}>
                                <TierIcon className={cn("w-5 h-5", tierConfig.textColor, tierConfig.iconFill)} />
                            </div>
                        )}
                        {isAdmin && (
                            <div className="absolute -top-2 -left-2 p-1.5 bg-surface rounded-full border border-info/40  shadow-lg" title="Administration">
                                <ShieldCheck className="w-5 h-5 text-info fill-purple-500/10" />
                            </div>
                        )}
                        {isOnVacation && (
                            <div className="absolute -bottom-2 -right-2 p-1.5 bg-surface rounded-full border border-info/40 shadow-lg" title="En Vacances">
                                <Palmtree className="w-5 h-5 text-info fill-cyan-400/20" />
                            </div>
                        )}
                        {welcomeBadgeName && sigilRoles.some(g => g.role?.slug === "probation") && (
                            <div className="absolute -bottom-2 -left-2 p-1.5 bg-surface rounded-full border border-info/40  shadow-lg animate-pulse" title={welcomeBadgeName}>
                                <Sparkles className="w-5 h-5 text-info fill-indigo-500/10" />
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
                                <Badge className="bg-info/15 text-info border-info/30 hover:bg-info/20 font-black uppercase tracking-[0.1em] text-caption py-1">
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
                                <Badge className="bg-info/15 text-info border-info/30 hover:bg-info/20">
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
                                <Badge variant="outline" className="bg-surface text-muted-foreground border-border">
                                    Membre depuis {new Date(joinedAt).toLocaleDateString("fr-FR", { month: 'long', year: 'numeric' })}
                                </Badge>
                            )}

                            {sigilRoles.filter(g => g.role?.slug !== "probation").map((grant: any) => (
                                <Badge
                                    key={grant.id}
                                    className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/20 font-black uppercase tracking-[0.1em] text-caption py-1 gap-1.5"
                                >
                                    <Sparkles className="w-3 h-3" />
                                    {grant.label}
                                    {grant.expiresAt && (
                                        <span className="opacity-50 text-caption font-medium lowercase italic">
                                            expire {formatDistanceToNow(new Date(grant.expiresAt), { addSuffix: true, locale: fr })}
                                        </span>
                                    )}
                                </Badge>
                            ))}

                            {/* Specific NEW/PROBATION Badge - High Visibility */}
                            {welcomeBadgeName && sigilRoles.filter(g => g.role?.slug === "probation").map((grant: any) => (
                                <Badge
                                    key={grant.id}
                                    className="bg-info/30 text-info border-info/40 hover:bg-info/40 font-black uppercase tracking-[0.1em] text-caption py-1 gap-2 "
                                >
                                    <Sparkles className="w-3.5 h-3.5 fill-indigo-400/20" />
                                    {welcomeBadgeName}
                                    {grant.expiresAt && (
                                        <span className="opacity-60 text-caption font-medium lowercase italic border-l border-info/30 pl-2">
                                            expire {formatDistanceToNow(new Date(grant.expiresAt), { addSuffix: true, locale: fr })}
                                        </span>
                                    )}
                                </Badge>
                            ))}

                            {discordRoleName && (
                                <Badge
                                    variant="outline"
                                    className="font-bold uppercase tracking-[0.1em] text-caption py-1 border-border bg-surface"
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
