'use client';

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Check, X, ExternalLink,
    ShieldCheck, Users, Trophy, Target,
    Swords, Skull, Zap, Clock, Sparkles,
    Infinity as InfinityIcon,
    User as UserIcon
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { MissionCategory } from "@prisma/client";
import { getDisplayName, getGameDisplayName } from "@/lib/display-name";
import { SubmissionCountdown } from "./submission-countdown";

// Shared category config (same as mission-card.tsx)
const CATEGORY_CONFIG: Record<MissionCategory, {
    icon: any;
    color: string;
    bgColor: string;
    borderColor: string;
    headerGradient: string;
    bannerImage: string;
}> = {
    DONJON: {
        icon: Swords,
        color: "text-danger",
        bgColor: "bg-danger/40",
        borderColor: "border-danger/40",
        headerGradient: "from-[#a11a21]/90 via-[#d32f2f]/80 to-[#6b0f14]/90",
        bannerImage: "/banners/donjon.png",
    },
    REGULATION: {
        icon: Skull,
        color: "text-success",
        bgColor: "bg-success/40",
        borderColor: "border-success/40",
        headerGradient: "from-[#4b6b1a]/90 via-[#7cb342]/80 to-[#2d4010]/90",
        bannerImage: "/banners/regulation.png",
    },
    ANOMALIE: {
        icon: Zap,
        color: "text-fuchsia-400",
        bgColor: "bg-fuchsia-950/40",
        borderColor: "border-fuchsia-500/40",
        headerGradient: "from-[#7d1a6b]/90 via-[#ab47bc]/80 to-[#4d1040]/90",
        bannerImage: "/banners/anomalie.png",
    },
    SONGES: {
        icon: InfinityIcon,
        color: "text-info",
        bgColor: "bg-info/40",
        borderColor: "border-info/40",
        headerGradient: "from-[#1a6b7d]/90 via-[#26c6da]/80 to-[#10404d]/90",
        bannerImage: "/banners/songes.png",
    },
    EXPEDITION: {
        icon: Clock,
        color: "text-warning",
        bgColor: "bg-warning/40",
        borderColor: "border-warning/40",
        headerGradient: "from-[#7d5b1a]/90 via-[#ffa000]/80 to-[#4d3810]/90",
        bannerImage: "/banners/expedition.png",
    },
    EVENT: {
        icon: Sparkles,
        color: "text-warning",
        bgColor: "bg-warning/40",
        borderColor: "border-warning/40",
        headerGradient: "from-[#7d6b1a]/90 via-[#fbc02d]/80 to-[#4d4010]/90",
        bannerImage: "/banners/event.png",
    },
};

type ValidationCardProps = {
    submission: {
        id: string;
        createdAt: Date;
        proofUrl: string;
        mission: {
            category: MissionCategory;
            title: string | null;
            rank: number;
            xpReward: number | null;
            payload: any;
        };
        profile: {
            discordNickname: string | null;
            pseudoDofus: string | null;
            classe: string | null;
            isAdmin: boolean;
            user: {
                name: string | null;
                image: string | null;
            };
        };
        helpers: {
            id: string;
            pseudoDofus: string | null;
            user: {
                name: string | null;
                image: string | null;
            };
        }[];
    };
    onValidate: () => void;
    onReject: () => void;
    onZoom: () => void;
    isProcessing: boolean;
};

// Helper function for default level based on rank
function getDefaultLevel(rank: number): number {
    const levelMap: Record<number, number> = { 1: 50, 2: 100, 3: 150, 4: 180, 5: 200 };
    return levelMap[rank] || 50;
}

export function ValidationCard({ submission, onValidate, onReject, onZoom, isProcessing }: ValidationCardProps) {
    const config = CATEGORY_CONFIG[submission.mission.category];
    const Icon = config.icon;
    const payload = submission.mission.payload as any;
    const displayLevel = payload.level || getDefaultLevel(submission.mission.rank || 1);

    return (
        <Card className={cn(
            "flex flex-col relative overflow-hidden transition-all duration-300 group border-border bg-surface",
            "hover:border-border "
        )}>
            {/* ----------------- HEADER BAR (Full Width) ----------------- */}
            <div className={cn(
                "relative z-20 flex flex-wrap items-center gap-3 sm:gap-4 px-4 py-2.5 border-b border-border",
                "overflow-hidden transition-all duration-300"
            )}>
                {/* AI BACKGROUND BANNER */}
                <div className="absolute inset-0 z-0">
                    <Image
                        src={config.bannerImage}
                        alt="Banner"
                        fill
                        className="object-cover opacity-60 mix-blend-luminosity grayscale-[0.2]"
                        unoptimized={true}
                    />
                    <div className={cn(
                        "absolute inset-0 bg-gradient-to-r mix-blend-multiply opacity-90",
                        config.headerGradient
                    )} />
                </div>

                {/* Noise texture overlay */}
                <div className="absolute inset-0 opacity-[0.12] mix-blend-overlay pointer-events-none bg-[url(/noise.svg)] bg-repeat z-10" />

                <div className="relative shrink-0 z-10">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface border border-border relative">
                        <Icon className={cn("w-4 h-4 text-foreground")} />
                    </div>
                </div>

                <div className="min-w-0 flex-1 relative z-10 break-words pr-2">
                    <h3 className="font-black text-xs sm:text-base text-foreground tracking-tight uppercase leading-tight">
                        {submission.mission.title || "Mission Sans Titre"}
                    </h3>
                </div>

                {/* Rank, Level + Countdown */}
                <div className="ml-auto flex items-center gap-2 relative z-10 shrink-0">
                    <SubmissionCountdown createdAt={submission.createdAt} />
                    <div className="flex items-center bg-black/60 rounded px-2 h-6 border border-border shrink-0">
                        <span className="text-caption font-black text-muted-foreground uppercase tracking-wider mr-1.5">RANG</span>
                        <span className="text-xs font-black text-foreground">{submission.mission.rank || 1}</span>
                    </div>
                    <div className="h-4 w-[1px] bg-surface shrink-0" />
                    <span className="text-foreground font-bold italic text-xs tracking-tight shrink-0">
                        Niv. {displayLevel}
                    </span>
                </div>
            </div>

            {/* ----------------- USER INFO BAR ----------------- */}
            <div className="relative z-10 px-4 py-2 bg-background/50 border-b border-border/50 flex flex-wrap items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-elevated overflow-hidden relative shrink-0 border border-border">
                    {submission.profile.user.image ? (
                        <Image
                            src={submission.profile.user.image}
                            alt={getDisplayName(submission.profile)}
                            fill
                            className="object-cover"
                            unoptimized={true}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full w-full text-muted-foreground">
                            <UserIcon className="w-4 h-4" />
                        </div>
                    )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">
                            {getDisplayName(submission.profile) || "Membre Inconnu"}
                        </span>
                        {submission.profile.isAdmin && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <ShieldCheck className="w-3 h-3 text-info shrink-0" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-surface border-info/30 text-info text-caption font-bold uppercase tracking-wider">
                                        Administration
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                    {submission.profile.pseudoDofus && (
                        <Badge variant="secondary" className="text-caption h-5 px-2 bg-elevated text-muted-foreground font-normal shrink-0">
                            {submission.profile.pseudoDofus}
                        </Badge>
                    )}
                    {submission.profile.classe && (
                        <Badge variant="outline" className="text-caption h-5 px-2 border-border text-muted-foreground font-normal shrink-0">
                            {submission.profile.classe}
                        </Badge>
                    )}
                </div>
            </div>

            {/* ----------------- CONTENT BODY ----------------- */}
            <CardContent className="p-4 space-y-3 flex-1 relative bg-surface">

                {/* Mission Rewards */}
                <div className="flex items-center gap-3 text-xs">
                    {submission.mission.xpReward && (
                        <div className="flex items-center gap-1 text-warning">
                            <Trophy className="w-3 h-3" />
                            <span className="font-mono">{submission.mission.xpReward} XP</span>
                        </div>
                    )}
                    {submission.mission.payload?.kamas && (
                        <div className="flex items-center gap-1 text-warning">
                            <Target className="w-3 h-3" />
                            <span className="font-mono">{submission.mission.payload.kamas}k</span>
                        </div>
                    )}
                </div>

                {/* Contributors */}
                {submission.helpers && submission.helpers.length > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                        <Users className="w-3.5 h-3.5 text-info" />
                        <span className="text-caption text-muted-foreground font-medium">Contributeurs:</span>
                        <div className="flex items-center -space-x-2">
                            {submission.helpers.slice(0, 5).map((helper) => (
                                <TooltipProvider key={helper.id}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Avatar className="w-6 h-6 border-2 border-border ring-1 ring-ring/30">
                                                <AvatarImage src={helper.user.image || undefined} />
                                                <AvatarFallback className="text-caption bg-elevated">
                                                    {(getGameDisplayName(helper) || "?").slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs">
                                            {getGameDisplayName(helper) || "Membre"}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))}
                            {submission.helpers.length > 5 && (
                                <div className="w-6 h-6 rounded-full bg-elevated border-2 border-border flex items-center justify-center text-caption text-muted-foreground font-bold">
                                    +{submission.helpers.length - 5}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Proof Image Preview */}
                <div
                    className="relative aspect-video rounded-lg bg-background overflow-hidden border border-border group mt-2 cursor-zoom-in"
                    onClick={onZoom}
                >
                    <Image
                        src={submission.proofUrl}
                        alt="Preuve"
                        fill
                        className="object-contain"
                        unoptimized={true}
                    />

                    <div className="absolute inset-0 bg-muted/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-foreground text-xs font-medium gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Agrandir
                    </div>
                </div>
            </CardContent>

            {/* ----------------- FOOTER: ACTIONS ----------------- */}
            <CardFooter className="p-3 bg-background/30 border-t border-border/50 grid grid-cols-2 gap-3">
                <Button
                    variant="sigil-destructive"
                    onClick={onReject}
                    disabled={isProcessing}
                    className="h-10"
                >
                    <X className="w-4 h-4 mr-2" />
                    Refuser
                </Button>
                <Button
                    variant="sigil-emerald"
                    onClick={onValidate}
                    disabled={isProcessing}
                    className="h-10"
                >
                    <Check className="w-4 h-4 mr-2" />
                    Valider
                </Button>
            </CardFooter>
        </Card>
    );
}
