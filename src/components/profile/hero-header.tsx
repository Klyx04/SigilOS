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
        bgColor: "bg-muted/15",
        textColor: "text-foreground",
        borderColor: "border-border/30",
        hoverColor: "hover:bg-muted/20",
        iconFill: "fill-slate-400/20",
    },
    PILIER: {
        label: "Pilier",
        icon: Medal,
        bgColor: "bg-warning/15",
        textColor: "text-warning",
        borderColor: "border-warning/30",
        hoverColor: "hover:bg-warning/20",
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
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {/* Subtle background glow from role color */}
            <div
                className="absolute inset-0 opacity-15 pointer-events-none"
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
                            variant="outline"
                            onClick={handleShare}
                            className={cn(
                                "gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors border",
                                copied
                                    ? "bg-success/15 border-success/30 text-success hover:bg-success/25"
                                    : "bg-surface/80 hover:bg-elevated border-border text-foreground hover:text-foreground"
                            )}
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-success" />
                                    <span>Lien copié</span>
                                </>
                            ) : (
                                <>
                                    <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span>Partager</span>
                                </>
                            )}
                        </Button>
                    </div>
                )}

                <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                    {/* Avatar Section */}
                    <div className="relative shrink-0">
                        <Avatar
                            className="relative w-24 h-24 md:w-28 md:h-28 border-2 shadow-md"
                            style={{ borderColor: roleHexColor }}
                        >
                            <AvatarImage src={avatarUrl || ""} alt={displayName} className="object-cover" />
                            <AvatarFallback className="text-3xl font-bold bg-surface text-foreground">
                                {displayName?.[0]?.toUpperCase() ?? "?"}
                            </AvatarFallback>
                        </Avatar>

                        {/* Badges on Avatar */}
                        {tierConfig && (
                            <div className={cn("absolute -top-1.5 -right-1.5 p-1 bg-surface rounded-full shadow-md border", tierConfig.borderColor)} title={tierConfig.label}>
                                <TierIcon className={cn("w-4 h-4", tierConfig.textColor, tierConfig.iconFill)} />
                            </div>
                        )}
                        {isAdmin && (
                            <div className="absolute -top-1.5 -left-1.5 p-1 bg-surface rounded-full border border-warning/40 shadow-md" title="Administration">
                                <ShieldCheck className="w-4 h-4 text-warning" />
                            </div>
                        )}
                        {isOnVacation && (
                            <div className="absolute -bottom-1.5 -right-1.5 p-1 bg-surface rounded-full border border-warning/40 shadow-md" title="En Congés">
                                <Palmtree className="w-4 h-4 text-warning" />
                            </div>
                        )}
                        {welcomeBadgeName && sigilRoles.some(g => g.role?.slug === "probation") && (
                            <div className="absolute -bottom-1.5 -left-1.5 p-1 bg-surface rounded-full border border-border shadow-md" title={welcomeBadgeName}>
                                <Sparkles className="w-4 h-4 text-accent" />
                            </div>
                        )}
                    </div>

                    {/* Info Section */}
                    <div className="flex-1 min-w-0 text-center md:text-left">
                        {/* Name */}
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 mb-2">
                            <h1
                                className="text-2xl md:text-3xl font-bold tracking-tight truncate leading-tight"
                                style={{ color: roleHexColor }}
                            >
                                {displayName}
                            </h1>
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                            {isAdmin && (
                                <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/20 font-bold uppercase tracking-wider text-caption py-0.5">
                                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
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
                                <Badge className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/20">
                                    <Palmtree className="w-3 h-3 mr-1" />
                                    En Congés
                                </Badge>
                            )}
                            {isUpcomingVacation && vacationStart && (
                                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 hover:bg-warning/20">
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
                                    className="bg-warning/15 text-warning border-warning/30 hover:bg-warning/20 font-bold uppercase tracking-wider text-caption py-0.5 gap-1.5"
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

                            {/* Specific NEW/PROBATION Badge */}
                            {welcomeBadgeName && sigilRoles.filter(g => g.role?.slug === "probation").map((grant: any) => (
                                <Badge
                                    key={grant.id}
                                    className="bg-accent/15 text-accent border-accent/30 hover:bg-accent/20 font-bold uppercase tracking-wider text-caption py-0.5 gap-1.5"
                                >
                                    <Sparkles className="w-3 h-3" />
                                    {welcomeBadgeName}
                                    {grant.expiresAt && (
                                        <span className="opacity-60 text-caption font-medium lowercase italic border-l border-accent/30 pl-2">
                                            expire {formatDistanceToNow(new Date(grant.expiresAt), { addSuffix: true, locale: fr })}
                                        </span>
                                    )}
                                </Badge>
                            ))}

                            {discordRoleName && (
                                <Badge
                                    variant="outline"
                                    className="font-medium text-caption py-0.5 border-border bg-surface"
                                    style={{
                                        color: discordRoleColor && discordRoleColor > 0
                                            ? `#${discordRoleColor.toString(16).padStart(6, "0")}`
                                            : "#94a3b8"
                                    }}
                                >
                                    <UserCircle className="w-3.5 h-3.5 mr-1" />
                                    {discordRoleName}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
