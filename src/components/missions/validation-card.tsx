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
        color: "text-rose-400",
        bgColor: "bg-rose-950/40",
        borderColor: "border-rose-500/40",
        headerGradient: "from-[#a11a21]/90 via-[#d32f2f]/80 to-[#6b0f14]/90",
        bannerImage: "/banners/donjon.png",
    },
    REGULATION: {
        icon: Skull,
        color: "text-emerald-400",
        bgColor: "bg-emerald-950/40",
        borderColor: "border-emerald-500/40",
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
        color: "text-cyan-400",
        bgColor: "bg-cyan-950/40",
        borderColor: "border-cyan-500/40",
        headerGradient: "from-[#1a6b7d]/90 via-[#26c6da]/80 to-[#10404d]/90",
        bannerImage: "/banners/songes.png",
    },
    EXPEDITION: {
        icon: Clock,
        color: "text-amber-400",
        bgColor: "bg-amber-950/40",
        borderColor: "border-amber-500/40",
        headerGradient: "from-[#7d5b1a]/90 via-[#ffa000]/80 to-[#4d3810]/90",
        bannerImage: "/banners/expedition.png",
    },
    EVENT: {
        icon: Sparkles,
        color: "text-yellow-300",
        bgColor: "bg-yellow-950/40",
        borderColor: "border-yellow-500/40",
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
            "flex flex-col relative overflow-hidden transition-all duration-500 group border-white/5 bg-[#121417] shadow-2xl",
            "hover:border-white/10 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]"
        )}>
            {/* ----------------- HEADER BAR (Full Width) ----------------- */}
            <div className={cn(
                "relative z-20 flex items-center gap-4 px-4 py-2.5 shadow-inner border-b border-white/5",
                "overflow-hidden transition-all duration-500"
            )}>
                {/* AI BACKGROUND BANNER */}
                <div className="absolute inset-0 z-0">
                    <Image
                        src={config.bannerImage}
                        alt="Banner"
                        fill
                        className="object-cover opacity-60 mix-blend-luminosity grayscale-[0.2]"
                    />
                    <div className={cn(
                        "absolute inset-0 bg-gradient-to-r mix-blend-multiply opacity-90",
                        config.headerGradient
                    )} />
                </div>

                {/* Noise texture overlay */}
                <div className="absolute inset-0 opacity-[0.12] mix-blend-overlay pointer-events-none bg-[url('/noise.svg')] bg-repeat z-10" />

                {/* Visual indicator (Lueur) */}
                <div className="absolute inset-x-0 bottom-0 h-[1px] bg-white/20 blur-[1px] z-10" />

                <div className="relative shrink-0 z-10">
                    <div className="absolute inset-0 bg-white/20 blur-[8px] rounded-full scale-75 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 shadow-lg relative transition-transform group-hover:scale-105">
                        <Icon className={cn("w-4 h-4 text-white")} />
                    </div>
                </div>

                <div className="flex-1 min-w-0 relative z-10">
                    <h3 className="font-black text-sm sm:text-base text-white truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-tight uppercase">
                        {submission.mission.title || "Mission Sans Titre"}
                    </h3>
                </div>

                {/* Rank, Level + Countdown */}
                <div className="ml-auto flex items-center gap-2 relative z-10">
                    <SubmissionCountdown createdAt={submission.createdAt} />
                    <div className="flex items-center bg-black/60 rounded px-2 h-6 border border-white/10">
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wider mr-1.5">RANG</span>
                        <span className="text-xs font-black text-white">{submission.mission.rank || 1}</span>
                    </div>
                    <div className="h-4 w-[1px] bg-white/10" />
                    <span className="text-zinc-300 font-bold italic text-xs tracking-tight">
                        Niv. {displayLevel}
                    </span>
                </div>
            </div>

            {/* ----------------- USER INFO BAR ----------------- */}
            <div className="relative z-10 px-4 py-2 bg-zinc-950/50 border-b border-zinc-800/50 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden relative shrink-0 border border-white/10">
                    {submission.profile.user.image ? (
                        <Image
                            src={submission.profile.user.image}
                            alt={submission.profile.user.name || "User"}
                            fill
                            className="object-cover"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full w-full text-zinc-600">
                            <UserIcon className="w-4 h-4" />
                        </div>
                    )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white truncate">
                            {submission.profile.discordNickname || submission.profile.user.name || "Membre Inconnu"}
                        </span>
                        {submission.profile.isAdmin && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <ShieldCheck className="w-3 h-3 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)] shrink-0" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-zinc-900 border-purple-500/30 text-purple-200 text-[10px] font-bold uppercase tracking-wider">
                                        Administration
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                    <span className="text-[10px] text-zinc-500">
                        Soumis le {new Date(submission.createdAt).toLocaleDateString()} à {new Date(submission.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                {submission.profile.pseudoDofus && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-2 bg-zinc-800 text-zinc-400 font-normal">
                        {submission.profile.pseudoDofus}
                    </Badge>
                )}
                {submission.profile.classe && (
                    <Badge variant="outline" className="text-[10px] h-5 px-2 border-zinc-700 text-zinc-500 font-normal">
                        {submission.profile.classe}
                    </Badge>
                )}
            </div>

            {/* ----------------- CONTENT BODY ----------------- */}
            <CardContent className="p-4 space-y-3 flex-1 relative bg-gradient-to-b from-[#1a1c20] to-[#121417]">
                {/* Sub-Atmosphere Glow */}
                <div className={cn(
                    "absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10 blur-3xl pointer-events-none transition-all duration-1000 group-hover:scale-150",
                    config.bgColor
                )} />

                {/* Mission Rewards */}
                <div className="flex items-center gap-3 text-xs">
                    {submission.mission.xpReward && (
                        <div className="flex items-center gap-1 text-amber-400">
                            <Trophy className="w-3 h-3" />
                            <span className="font-mono">{submission.mission.xpReward} XP</span>
                        </div>
                    )}
                    {submission.mission.payload?.kamas && (
                        <div className="flex items-center gap-1 text-yellow-400">
                            <Target className="w-3 h-3" />
                            <span className="font-mono">{submission.mission.payload.kamas}k</span>
                        </div>
                    )}
                </div>

                {/* Contributors */}
                {submission.helpers && submission.helpers.length > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/50">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-[10px] text-zinc-500 font-medium">Contributeurs:</span>
                        <div className="flex items-center -space-x-2">
                            {submission.helpers.slice(0, 5).map((helper) => (
                                <TooltipProvider key={helper.id}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Avatar className="w-6 h-6 border-2 border-zinc-900 ring-1 ring-indigo-500/30">
                                                <AvatarImage src={helper.user.image || undefined} />
                                                <AvatarFallback className="text-[8px] bg-zinc-800">
                                                    {(helper.pseudoDofus || helper.user.name || "?").slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs">
                                            {helper.pseudoDofus || helper.user.name || "Membre"}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))}
                            {submission.helpers.length > 5 && (
                                <div className="w-6 h-6 rounded-full bg-zinc-800 border-2 border-zinc-900 flex items-center justify-center text-[8px] text-zinc-400 font-bold">
                                    +{submission.helpers.length - 5}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Proof Image Preview */}
                <div
                    className="relative aspect-video rounded-lg bg-black overflow-hidden border border-zinc-800 group mt-2 cursor-zoom-in"
                    onClick={onZoom}
                >
                    <Image
                        src={submission.proofUrl}
                        alt="Preuve"
                        fill
                        className="object-contain"
                    />

                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-2">
                        <ExternalLink className="w-4 h-4" />
                        Agrandir
                    </div>
                </div>
            </CardContent>

            {/* ----------------- FOOTER: ACTIONS ----------------- */}
            <CardFooter className="p-3 bg-zinc-950/30 border-t border-zinc-800/50 grid grid-cols-2 gap-3">
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-red-900/30 hover:bg-red-950/50 hover:text-red-400 text-red-500"
                    onClick={onReject}
                    disabled={isProcessing}
                >
                    <X className="w-4 h-4 mr-2" />
                    Refuser
                </Button>
                <Button
                    variant="default"
                    size="sm"
                    className="w-full bg-green-600 hover:bg-green-500 text-white"
                    onClick={onValidate}
                    disabled={isProcessing}
                >
                    <Check className="w-4 h-4 mr-2" />
                    Valider
                </Button>
            </CardFooter>
        </Card>
    );
}
