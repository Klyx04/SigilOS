'use client'

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Swords,
    Skull,
    Zap,
    Clock,
    MapPin,
    Sparkles,
    Infinity as InfinityIcon,
    Star,
    Upload,
    Users,
    Search,
    ExternalLink,
    AlertTriangle,
    CheckCircle2,
    Hourglass,
    XCircle,
    Loader2,
    ShieldCheck,
    Trophy,
    Calendar as CalendarIcon
} from "lucide-react";
import { Mission, MissionCategory, MissionInterest, UserProfile, User, Submission, SubmissionStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleMissionInterest, cancelMissionSubmission, getMissionValidators } from "@/server/actions/mission-actions";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
import { ProofUploadDialog } from "./proof-upload-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// --- Props ---

interface MissionCardProps {
    mission: Mission & {
        interests: (MissionInterest & {
            profile: UserProfile & {
                user: User | null
            }
        })[];
        submissions?: Submission[]; // User's submissions for this mission
    };
    currentUserId: string;
    guildId: string; // Discord Guild ID for upload
    onInterestClick?: (missionId: string) => void; // For modal trigger
    isRestricted?: boolean;
    linkedEvent?: { id: string, title: string, startDate: Date } | null;
    vitrineMode?: boolean;
    /** Masque le bouton PREUVE / upload pour les super-admins (God) — #204. */
    hideUpload?: boolean;
}

// --- Category Config ---

const CATEGORY_CONFIG: Record<MissionCategory, {
    icon: any;
    color: string;
    bgColor: string;
    borderColor: string;
    headerGradient: string;
    bannerImage: string;
    fallbackImage?: string;
    glowColor: string;
    label: string;
    ringColor: string; // CSS color for animated ring
}> = {
    DONJON: {
        icon: Swords,
        color: "text-danger",
        bgColor: "bg-danger/40",
        borderColor: "border-danger/40",
        headerGradient: "from-[#a11a21]/90 via-[#d32f2f]/80 to-[#6b0f14]/90",
        bannerImage: "/banners/donjon.png",
        fallbackImage: "/assets/missions/donjon.png",
        glowColor: "rgba(244, 63, 94, 0.4)",
        ringColor: "#f43f5e",
        label: "Donjon"
    },
    REGULATION: {
        icon: Skull,
        color: "text-success",
        bgColor: "bg-success/40",
        borderColor: "border-success/40",
        headerGradient: "from-[#4b6b1a]/90 via-[#7cb342]/80 to-[#2d4010]/90",
        bannerImage: "/banners/regulation.png",
        fallbackImage: "/assets/missions/regulation.png",
        glowColor: "rgba(52, 211, 153, 0.4)",
        ringColor: "#10b981",
        label: "Régulation"
    },
    ANOMALIE: {
        icon: Zap,
        color: "text-fuchsia-400",
        bgColor: "bg-fuchsia-950/40",
        borderColor: "border-fuchsia-500/40",
        headerGradient: "from-[#7d1a6b]/90 via-[#ab47bc]/80 to-[#4d1040]/90",
        bannerImage: "/banners/anomalie.png",
        fallbackImage: "/assets/missions/ano1.png",
        glowColor: "rgba(217, 70, 239, 0.4)",
        ringColor: "#d946ef",
        label: "Anomalie"
    },
    SONGES: {
        icon: InfinityIcon,
        color: "text-info",
        bgColor: "bg-info/40",
        borderColor: "border-info/40",
        headerGradient: "from-[#1a6b7d]/90 via-[#26c6da]/80 to-[#10404d]/90",
        bannerImage: "/banners/songes.png",
        fallbackImage: "/assets/missions/songes.png",
        glowColor: "rgba(34, 211, 238, 0.4)",
        ringColor: "#22d3ee",
        label: "Songes"
    },
    EXPEDITION: {
        icon: Clock,
        color: "text-warning",
        bgColor: "bg-warning/40",
        borderColor: "border-warning/40",
        headerGradient: "from-[#7d5b1a]/90 via-[#ffa000]/80 to-[#4d3810]/90",
        bannerImage: "/banners/expedition.png",
        fallbackImage: "/assets/missions/expedition.png",
        glowColor: "rgba(251, 191, 36, 0.4)",
        ringColor: "#fbbf24",
        label: "Expédition"
    },
    EVENT: {
        icon: Sparkles,
        color: "text-yellow-300",
        bgColor: "bg-yellow-950/40",
        borderColor: "border-yellow-500/40",
        headerGradient: "from-[#7d6b1a]/90 via-[#fbc02d]/80 to-[#4d4010]/90",
        bannerImage: "/banners/event.png",
        fallbackImage: "/assets/missions/event.png",
        glowColor: "rgba(253, 224, 71, 0.4)",
        ringColor: "#fde047",
        label: "Événement"
    },
};

// --- Component ---

export function MissionCard({ mission, currentUserId, guildId, onInterestClick, isRestricted, linkedEvent, vitrineMode = false, hideUpload = false }: MissionCardProps) {
    const [isPending, startTransition] = useTransition();
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const [showValidators, setShowValidators] = useState(false);
    const [isLoadingValidators, setIsLoadingValidators] = useState(false);
    const [validatorsList, setValidatorsList] = useState<any[]>([]);
    const router = useRouter();

    const isInterested = mission.interests.some(i => i.profile.userId === currentUserId);
    const interestCount = mission.interests.length;

    const config = CATEGORY_CONFIG[mission.category];
    const Icon = config.icon;
    const payload = mission.payload as any;

    // Extract image URL from payload — SONGES gets per-difficulty/level image, épreuves get custom image
    const getSongesImage = () => {
        if (mission.category !== 'SONGES') return null;
        if (payload.epreuve) {
            return `/assets/missions/epreuves-songes/${payload.epreuve}.png`;
        }
        const diff: string = (payload.difficulty || 'Reve').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const levelMap: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };
        const lvl = levelMap[payload.level as string] || 1;
        return `/assets/missions/${diff}${lvl}.png`;
    };

    const getAnomalieImage = () => {
        if (mission.category !== 'ANOMALIE') return null;
        switch (payload.type) {
            case 'BOSS': return "/assets/missions/ano1.png";
            case 'FRAGMENTS': return "/assets/missions/fragment.png";
            case 'STABILISATION': return "/assets/missions/3-gardiens.png";
            default: return "/assets/missions/anomalie.png";
        }
    };

    const getEventImage = () => {
        if (mission.category !== 'EVENT') return null;
        if (payload.eventType === 'FRAGMENTS_ANOMALIE') {
            return "/assets/missions/fragment.png";
        }
        return payload.imageUrl || null;
    };

    const imageUrl = mission.category === 'SONGES'
        ? getSongesImage()
        : mission.category === 'ANOMALIE'
        ? getAnomalieImage()
        : mission.category === 'EVENT'
        ? getEventImage()
        : (payload.imageUrl || payload.image || (config as any).fallbackImage || null);

    // OBJECTIF MANUEL (#152) : icône exclamation mise en avant dans le rendu de l'image (comme les icônes de boss DJ/Songes).
    const isManualObjective = mission.category === 'EVENT' && payload.eventType === 'OBJECTIF';

    // Check user's submission status for this mission
    const userSubmission = mission.submissions?.[0];
    const isValidated = userSubmission?.status === "VALIDATED";
    const isPendingValidation = userSubmission?.status === "PENDING";
    const isRejected = userSubmission?.status === "REJECTED";

    // Get level from payload
    const displayLevel = payload.level || getDefaultLevel((mission as any).rank || 1);

    // ------------------------------------------------------------------
    // EMPTY STATE
    // ------------------------------------------------------------------
    const isEventMonsterFilled = mission.category === 'EVENT' && payload.eventType === 'MONSTRE_SPECIAL' && payload.monsterName;
    const isEmpty = !mission.title && !isEventMonsterFilled && (
        (mission.category === 'DONJON' && !payload.dungeonName) ||
        (mission.category === 'REGULATION' && !payload.monsterName && !payload.familyName) ||
        (mission.category === 'ANOMALIE' && !payload.levelRange && !payload.type) ||
        (mission.category === 'SONGES' && !payload.difficulty && !payload.epreuve) ||
        (mission.category === 'EXPEDITION' && !payload.dungeonName) ||
        (mission.category === 'EVENT' && !payload.description && payload.eventType !== 'FRAGMENTS_ANOMALIE')
    );

    if (isEmpty) {
        return (
            <Card className="flex flex-col h-[180px] bg-background/50 border border-border/60 border-dashed items-center justify-center p-6 text-center space-y-4 hover:bg-surface/50 transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-surface/50 border border-border flex items-center justify-center group- transition-transform duration-300 shadow-inner">
                    <Icon className="w-6 h-6 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
                </div>
                <div className="space-y-1 cursor-default">
                    <h3 className="font-semibold text-muted-foreground text-sm tracking-wide">Mission Mystère</h3>
                    <p className="text-caption text-muted-foreground font-medium">Dévoilée prochainement</p>
                </div>
            </Card>
        );
    }

    const handleCancel = async () => {
        if (!confirm("Voulez-vous vraiment annuler cette soumission ?")) return;

        startTransition(async () => {
            const result = await cancelMissionSubmission(mission.id);
            if (result.success) {
                toast.success("Soumission annulée.");
                router.refresh();
            } else {
                toast.error(result.error || "Erreur lors de l'annulation");
            }
        });
    };

    const handleToggleInterest = () => {
        startTransition(async () => {
            const result = await toggleMissionInterest(mission.id);
            if (result.success) {
                toast.success(isInterested ? "Intérêt retiré" : "Intérêt ajouté !");
                router.refresh();
            } else {
                toast.error(result.error || "Erreur");
            }
        });
    };

    const handleInterestBadgeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onInterestClick) {
            onInterestClick(mission.id);
        }
    };

    const handleShowValidators = async () => {
        setShowValidators(true);
        setIsLoadingValidators(true);
        try {
            const res = await getMissionValidators(guildId, mission.id);
            if (res.success && res.data) {
                setValidatorsList(res.data);
            }
        } catch {
            toast.error("Erreur chargement validateurs");
        } finally {
            setIsLoadingValidators(false);
        }
    };

    return (
        <div
            className="mission-card-ring"
            style={{ '--ring-color': config.ringColor } as React.CSSProperties}
        >
            <Card className={cn(
                "flex flex-col relative overflow-hidden transition-all duration-300 group border-border bg-surface shadow-2xl",
                "hover:border-border ",
                !vitrineMode && isValidated && "ring-1 ring-success/40",
                !vitrineMode && isRejected && "ring-1 ring-danger/40",
                !vitrineMode && isPendingValidation && "ring-1 ring-yellow-500/40"
            )}>
                {/* ----------------- HEADER BAR (Full Width) ----------------- */}
                <div className={cn(
                    "relative z-20 flex items-center gap-4 px-4 py-2.5 shadow-inner border-b border-border",
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

                    {/* Visual indicator (Lueur) */}
                    <div className="absolute inset-x-0 bottom-0 h-[1px] bg-elevated blur-[1px] z-10" />

                    <div className="relative shrink-0 z-10">
                        <div className="absolute inset-0 bg-elevated blur-[8px] rounded-full scale-75 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/40 backdrop-blur-md border border-border shadow-lg relative transition-transform group-">
                            <Icon className={cn("w-4 h-4", config.color.replace('text-', 'text-foreground'))} />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0 relative z-10">
                        <h3 className="font-black text-sm sm:text-base text-foreground truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-tight uppercase">
                            {mission.title || getAutoTitle(mission.category, payload)}
                        </h3>
                    </div>

                    {/* Status Badges Pin to Right */}
                    <div className="ml-auto flex gap-2 relative z-10">
                        {!vitrineMode && isValidated && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/90 text-success-foreground font-black text-caption shadow-lg border border-border">
                                <CheckCircle2 className="w-3 h-3" /> <span className="hidden sm:inline">VALIDÉ</span>
                            </div>
                        )}
                        {!vitrineMode && isPendingValidation && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/90 text-foreground font-black text-caption shadow-lg border border-border animate-pulse">
                                <Hourglass className="w-3 h-3" /> <span className="hidden sm:inline">ATTENTE</span>
                            </div>
                        )}
                        {!vitrineMode && isRejected && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-danger/90 text-danger-foreground font-black text-caption shadow-lg border border-border">
                                <XCircle className="w-3 h-3" /> <span className="hidden sm:inline">REFUSÉ</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ----------------- CONTENT BODY (Two Columns) ----------------- */}
                <div className="relative z-10 flex min-h-[135px] overflow-hidden bg-gradient-to-b from-elevated to-surface">

                    {/* Sub-Atmosphere Glow */}
                    <div className={cn(
                        "absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10 blur-3xl pointer-events-none transition-all duration-300 group-hover:scale-150",
                        config.bgColor
                    )} />

                    {/* Left Column: Image Cutout */}
                    <div className="w-[80px] sm:w-[128px] shrink-0 relative overflow-hidden flex items-center justify-center border-r border-border p-4 bg-black/20">
                        {/* Background Light behind Creature */}
                        <div className={cn(
                            "absolute inset-0 opacity-20 blur-2xl rounded-full scale-110",
                            config.bgColor
                        )} />

                        {imageUrl ? (
                            <div className="relative w-full h-full transform transition-transform duration-300 group-">
                                <Image
                                    src={imageUrl}
                                    alt="Subject"
                                    fill
                                    className={cn(
                                        "object-contain",
                                        // Full-bleed blend for ANOMALIE & SONGES
                                        (mission.category === 'ANOMALIE' || mission.category === 'SONGES') &&
                                        "object-cover opacity-70 mix-blend-luminosity scale-110"
                                    )}
                                    unoptimized={true}
                                />
                                {/* Cinematic Overlay: Gradient Fade to Right */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-elevated/40 z-10" />

                                {/* OBJECTIF MANUEL (#152) — icône exclamation GRANDE et centrée sur l'image */}
                                {isManualObjective && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center">
                                        <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-warning/95 border-2 border-border-strong flex items-center justify-center overflow-hidden">
                                            <Image
                                                src="/exclamation.png"
                                                alt="Objectif manuel"
                                                width={80}
                                                height={80}
                                                className="object-contain w-full h-full p-1.5"
                                                unoptimized={true}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : isManualObjective ? (
                            /* OBJECTIF MANUEL sans image — l'icône exclamation EST le visuel principal */
                            <div className="w-full h-full flex items-center justify-center">
                                <Image
                                    src="/exclamation.png"
                                    alt="Objectif manuel"
                                    width={96}
                                    height={96}
                                    className="object-contain w-16 h-16 sm:w-24 sm:h-24 opacity-90"
                                    unoptimized={true}
                                />
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-2xl bg-elevated/50 border border-border flex items-center justify-center">
                                <Search className="w-5 h-5 text-muted-foreground" />
                            </div>
                        )}
                    </div>
                    {/* Decorative Location Pin */}
                    {payload.zoneName && (
                        <div className="absolute bottom-1.5 right-1.5 p-1 bg-black/60 rounded border border-border backdrop-blur-md transition-opacity hover:opacity-100" title={payload.zoneName}>
                            <MapPin className="w-2.5 h-2.5 text-success" />
                        </div>
                    )}

                    {/* Right Column: Key Info */}
                    <div className="flex-1 flex flex-col p-4 justify-between relative overflow-hidden">
                        <div className="space-y-4">
                            {/* Meta Data: Rank & Level UI */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-black/60 rounded px-2.5 h-6 border border-border shadow-inner">
                                    <span className="text-caption font-black text-muted-foreground uppercase tracking-widest mr-2">RANG</span>
                                    <span className="text-sm font-black text-foreground">{(mission as any).rank || 1}</span>
                                </div>
                                <div className="h-4 w-[1px] bg-surface" />
                                <span className="text-foreground font-bold italic text-sm tracking-tight truncate">
                                    Niv. {displayLevel}
                                </span>
                            </div>

                            {/* Description Text */}
                            <div className="text-[15px] font-medium text-foreground leading-snug pr-4 text-shadow-sm line-clamp-3">
                                {generateDescription(mission.category, payload)}
                            </div>
                            {/* Notes / Instructions libres (missions spéciales) */}
                            {payload?.notes && (
                                <div className="mt-1.5 text-caption italic text-info/70 leading-snug pr-4 border-l-2 border-info/40 pl-2 line-clamp-2">
                                    📝 {payload.notes}
                                </div>
                            )}
                        </div>

                        {/* Rewards Row */}
                        <div className="flex items-center justify-between mt-auto pt-4 shrink-0">
                            <div className="flex flex-wrap gap-2.5">
                                {mission.xpReward && (
                                    <div className="flex items-center justify-center gap-2 px-2.5 py-1 bg-black/40 rounded-lg border border-border shadow-md min-w-[70px] sm:min-w-[85px]">
                                        <span className="text-foreground font-mono text-xs sm:text-sm font-black">{mission.xpReward}</span>
                                        <Image src="/PA.png" alt="PA" width={18} height={18} className="object-contain" loading="lazy" />
                                    </div>
                                )}
                                {mission.guildatonsReward && (
                                    <div className="flex items-center justify-center gap-2 px-2.5 py-1 bg-black/40 rounded-lg border border-border shadow-md min-w-[70px] sm:min-w-[85px]">
                                        <span className="text-foreground font-mono text-xs sm:text-sm font-black">{mission.guildatonsReward}</span>
                                        <Image src="/guildatons.png" alt="Guildatons" width={18} height={18} className="object-contain" loading="lazy" />
                                    </div>
                                )}
                                {config.label && (
                                    <span className="text-xs font-black text-muted-foreground uppercase tracking-widest ml-2 self-center">
                                        {config.label}
                                    </span>
                                )}
                            </div>

                            {/* Linked Event Badge */}
                            {linkedEvent && (
                                <TooltipProvider delayDuration={0}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Link
                                                href={`/dashboard/${guildId}/calendar?event=${linkedEvent.id}`}
                                                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-warning/10 border border-warning/30 hover:bg-warning/20 transition-all group/calendar"
                                            >
                                                <CalendarIcon className="w-3 h-3 text-warning group-hover/calendar:scale-110 transition-transform" />
                                                <span className="text-caption font-black text-warning uppercase tracking-widest leading-none">
                                                    Session Prévue
                                                </span>
                                                <ExternalLink className="w-2.5 h-2.5 text-warning/50 group-hover/calendar:text-warning transition-colors" />
                                            </Link>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="bg-surface border-border text-warning font-bold text-caption uppercase tracking-widest px-3 py-1.5">
                                            Voir l'événement sur le calendrier ?
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    </div>
                </div>

                {/* ----------------- ACTION BAR (Bottom) ----------------- */}
                <div className="relative z-20 flex flex-wrap gap-3 px-4 sm:px-5 py-3 bg-popover border-t border-border items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            className={cn(
                                "h-9 px-4 sm:px-6 text-caption sm:text-xs font-black uppercase tracking-widest rounded transition-all flex items-center gap-2 shadow-lg shrink-0",
                                isInterested
                                    ? "bg-success/20 text-success border border-success/50 hover:bg-success/30"
                                    : "bg-background text-foreground hover:bg-success hover:text-success-foreground  active:scale-95 border-none"
                            )}
                            onClick={handleToggleInterest}
                            disabled={isPending || isRestricted}
                        >
                            {isInterested ? (
                                <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Inscrit</span>
                                </>
                            ) : isRestricted ? (
                                <span>Verrouillé</span>
                            ) : (
                                <span>S'inscrire</span>
                            )}
                        </Button>

                        {!vitrineMode && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="hidden sm:flex h-9 px-4 text-caption font-black uppercase tracking-widest bg-surface/50 text-muted-foreground hover:bg-success/10 hover:text-success hover:border-success/30 transition-all border-border shrink-0"
                                onClick={handleShowValidators}
                                title="Voir les membres ayant validé"
                            >
                                <ShieldCheck className="w-3.5 h-3.5 mr-1.5 opacity-80" />
                                Validés
                            </Button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 ml-auto">
                        {/* Participant List */}
                        {interestCount > 0 && (
                            <div
                                className="flex items-center gap-2 cursor-pointer group/list"
                                onClick={handleInterestBadgeClick}
                            >
                                <div className="flex -space-x-2 transition-all duration-300 group-hover/list:space-x-1">
                                    {mission.interests.slice(0, 4).map((interest, i) => (
                                        <div key={interest.id} className="w-8 h-8 rounded-full border-2 border-black bg-elevated flex items-center justify-center overflow-hidden shadow-sm relative group/avatar">
                                            {interest.profile.user?.image ? (
                                                <Image src={interest.profile.user.image} alt="User" width={32} height={32} className="object-cover" loading="lazy" />
                                            ) : (
                                                <Users className="w-4 h-4 text-muted-foreground" />
                                            )}
                                        </div>
                                    ))}
                                    {interestCount > 4 && (
                                        <div className="w-8 h-8 rounded-full border-2 border-black bg-surface flex items-center justify-center text-caption font-black text-foreground shadow-sm z-10">
                                            +{interestCount - 4}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {!vitrineMode && !hideUpload && !isValidated && (
                            isPendingValidation ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 px-4 text-caption font-black bg-danger/5 text-danger border-danger/20 hover:bg-danger/10"
                                    onClick={handleCancel}
                                >
                                    ANNULER
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    className={cn(
                                        "h-9 px-5 text-caption font-black uppercase tracking-[2px] transition-all border",
                                        isRejected
                                            ? "bg-danger/40 text-danger hover:bg-background hover:text-foreground border-danger/30"
                                            : "bg-elevated text-foreground hover:bg-background hover:text-foreground border-border"
                                    )}
                                    onClick={() => setShowUploadDialog(true)}
                                    disabled={isRestricted}
                                >
                                    <Upload className="w-3.5 h-3.5 mr-2" />
                                    {isRejected ? "RÉESSAYER" : "PREUVE"}
                                </Button>
                            )
                        )}
                    </div>
                </div>

                {/* Dialogs */}
                <ProofUploadDialog
                    open={showUploadDialog}
                    onOpenChange={setShowUploadDialog}
                    missionId={mission.id}
                    missionTitle={mission.title || getAutoTitle(mission.category, payload)}
                    guildId={guildId}
                    category={mission.category}
                    payload={payload}
                />

                {/* Validators Dialog */}
                <Dialog open={showValidators} onOpenChange={setShowValidators}>
                    <DialogContent className="sm:max-w-md bg-background border-border shadow-2xl overflow-hidden p-0">
                        <div className="p-6 pb-4 bg-surface/40 border-b border-border relative z-10">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-3 text-lg font-black text-foreground">
                                    <div className="w-8 h-8 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center">
                                        <ShieldCheck className="w-4 h-4 text-success" />
                                    </div>
                                    <span className="uppercase tracking-widest italic text-sm">Validations Réussies</span>
                                </DialogTitle>
                            </DialogHeader>
                        </div>

                        <ScrollArea className="max-h-[300px] w-full bg-surface">
                            {isLoadingValidators ? (
                                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                                    <Loader2 className="w-6 h-6 animate-spin mb-3 text-success/50" />
                                    <span className="text-caption uppercase font-bold tracking-widest">Recherche des archives...</span>
                                </div>
                            ) : validatorsList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                                    <Trophy className="w-8 h-8 mb-3 opacity-20 text-muted-foreground" />
                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Aucune validation pour l'instant</p>
                                </div>
                            ) : (
                                <div className="p-2 space-y-1">
                                    {validatorsList.map((val) => (
                                        <div key={val.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface transition-colors border border-transparent hover:border-border">
                                            <Avatar className="w-8 h-8 border border-border shadow-sm">
                                                <AvatarImage src={val.image} />
                                                <AvatarFallback className="bg-elevated text-caption font-black">{val.pseudo.substring(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="text-sm font-black text-foreground truncate">{val.pseudo}</span>
                                                <span className="text-caption font-bold uppercase tracking-widest text-muted-foreground">
                                                    Validé le {new Date(val.date).toLocaleDateString('fr-FR')}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            </Card>
        </div>
    );
}

// --- Helpers ---

function getDefaultLevel(tier: number): number {
    switch (tier) {
        case 1: return 50;
        case 2: return 100;
        case 3: return 150;
        case 4: return 190;
        case 5: return 200;
        default: return 200;
    }
}

function getAutoTitle(category: MissionCategory, payload: any): string {
    switch (category) {
        case "DONJON": return payload.dungeonName || "Donjon Mystérieux";
        case "REGULATION": return (payload.monsterName || payload.familyName) ? `Régulation des ${payload.monsterName || payload.familyName}` : "Régulation";
        case "ANOMALIE": return payload.type === 'BOSS' ? `Gardien d'anomalie ${payload.levelRange || '200'}` : payload.type === 'FRAGMENTS' ? `Collecte Fragments` : payload.type === 'STABILISATION' ? `Stabilisation Gardiens` : "Au cœur de l'anomalie";
        case "SONGES": return payload.epreuve ? `Réaliser l'épreuve de Songe ${payload.epreuve}` : (payload.difficulty && payload.level ? `Plongée en ${payload.difficulty} ${payload.level}` : "Songes Infinis");
        case "EXPEDITION": return payload.dungeonName ? `Expédition de ${payload.dungeonName}` : "Expédition";
        case "EVENT":
            if (payload.eventType === 'FRAGMENTS_ANOMALIE') return payload.title || "Fragments d'anomalie";
            return payload.title || "Événement Spécial";
        default: return "Mission";
    }
}

function generateDescription(category: MissionCategory, payload: any): React.ReactNode {
    switch (category) {
        case "DONJON":
            return (
                <>Vaincre <span className="text-danger font-medium">{payload.bossName || "le Boss"}</span> dans son donjon</>
            );
        case "REGULATION":
            const targetName = payload.monsterName || payload.familyName || "monstres";
            const zoneContext = payload.zoneName ? ` en ${payload.zoneName}` : " sur leur territoire";
            return (
                <>Vaincre <span className="text-success font-medium">50 {targetName}</span>{zoneContext}</>
            );
        case "ANOMALIE":
            const range = payload.levelRange || "200";
            if (payload.type === 'BOSS') {
                return (
                    <>Vaincre un <span className="text-fuchsia-400 font-bold">gardien d'anomalie</span> de niveau <span className="text-fuchsia-400 font-bold">{range}</span> sous l'effet d'un <span className="text-fuchsia-400 font-bold">Elixir uchronique</span></>
                );
            }
            if (payload.type === 'GARDIENS') {
                return (
                    <>Vaincre <span className="text-fuchsia-400 font-bold">3 gardiens d'anomalie</span> de niveau <span className="text-fuchsia-400 font-bold">{range}</span> sous l'effet d'un <span className="text-fuchsia-400 font-bold">Elixir uchronique</span></>
                );
            }
            if (payload.type === 'COLLECTE') {
                const frag = payload.fragmentLevel || 1;
                return (
                    <>Collecter des <span className="text-fuchsia-400 font-bold">Fragments d'anomalie {frag}</span></>
                );
            }
            if (payload.type === 'FRAGMENTS') {
                return (
                    <>Obtenir <span className="text-fuchsia-400 font-bold">20 Fragments d'anomalie</span> dans une anomalie</>
                );
            }
            if (payload.type === 'STABILISATION') {
                const elixir = payload.elixir || 'majeur';
                const labelMap: Record<string, string> = {
                    uchronique: "Élixir uchronique",
                    mineur: "Élixir uchronique mineur",
                    ameliore: "Élixir uchronique amélioré",
                    majeur: "Élixir uchronique majeur"
                };
                const elixirLabel = labelMap[elixir as keyof typeof labelMap] || labelMap.majeur;
                if (elixir === 'aucun') {
                    return (
                        <>Vaincre <span className="text-fuchsia-400 font-bold">3 Gardiens des anomalies</span></>
                    );
                }
                return (
                    <>Vaincre <span className="text-fuchsia-400 font-bold">3 Gardiens des anomalies</span> sous l'effet d'un <span className="text-fuchsia-400 font-bold">[{elixirLabel}]</span></>
                );
            }
            return (
                <>Vaincre <span className="text-fuchsia-400 font-bold">50 monstres</span> dans une zone de niveau <span className="text-fuchsia-400 font-bold">{range}</span> sous l'effet d'un <span className="text-fuchsia-400 font-bold">Elixir uchronique</span></>
            );
        case "SONGES":
            if (payload.epreuve) {
                return (
                    <>Terminer l'épreuve de Songe <span className="text-info font-bold">{payload.epreuve}</span></>
                );
            }
            const palierNames: Record<number, string> = {
                1: "Pensées oniriques",
                2: "Balades fantastiques",
                3: "Espaces imaginaires",
                4: "Concepts brumeux",
                5: "Abstractions chimériques"
            };
            const palierName = palierNames[payload.tier] || palierNames[2];
            return (
                <>Démarrer un songe en <span className="text-info font-medium">{payload.difficulty || "Paradoxe"} {payload.level || "I"}</span> et terminer le Palier {payload.tier || 2} : les <span className="text-info">{palierName}</span></>
            );
        case "EXPEDITION":
            const modeText = payload.mode && payload.mode !== 'aucun' ? ` de ${payload.mode}` : '';
            return (
                <>Vaincre <span className="text-warning font-medium">{payload.bossName || "le Boss"}</span> dans son expédition{modeText}</>
            );
        case "EVENT":
            if (payload.eventType === 'FRAGMENTS_ANOMALIE') {
                return (
                    <>Obtenir <span className="text-fuchsia-400 font-bold">20 Fragments d'anomalie</span> dans une anomalie</>
                );
            }
            if (payload.eventType === 'OBJECTIF' || payload.description) {
                return <>{payload.description || "Participer à l'événement."}</>;
            }
            if (payload.eventType === 'MONSTRE_SPECIAL' && payload.monsterName) {
                const zonePart = payload.zoneName ? (
                    <>
                        {' '}en <span className="text-success font-bold">{payload.zoneName}</span>
                    </>
                ) : null;
                const levelPart = payload.level ? (
                    <>
                        {' '}(niv. <span className="text-info font-bold">{payload.level}</span>)
                    </>
                ) : null;
                return (
                    <>
                        Vaincre <span className="text-info font-bold">{payload.targetCount || 50} {payload.monsterName}</span>{levelPart}{zonePart}
                    </>
                );
            }
            if (payload.eventType === 'DONJON' && payload.bossName) {
                return (
                    <>Vaincre <span className="text-danger font-medium">{payload.bossName}</span> dans son donjon</>
                );
            }
            if (payload.eventType === 'REGULATION' && (payload.familyName || payload.zoneName)) {
                const target = payload.familyName || "monstres";
                return (
                    <>Vaincre <span className="text-warning font-medium">50 {target}</span> sur leur territoire</>
                );
            }
            return <>{payload.description || "Participer à l'événement."}</>;
        default:
            return "Compléter l'objectif demandé.";
    }
}