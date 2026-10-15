'use client'

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Swords,
    Skull,
    Zap,
    Clock,
    MapPin,
    Sparkles,
    Infinity as InfinityIcon,
    Upload,
    Users,
    Search,
    ExternalLink,
    CheckCircle2,
    Hourglass,
    XCircle,
    Loader2,
    ShieldCheck,
    Trophy,
    Calendar as CalendarIcon
} from "lucide-react";
import { Mission, MissionCategory, MissionInterest, UserProfile, User, Submission } from "@prisma/client";
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
        submissions?: Submission[];
    };
    currentUserId: string;
    guildId: string;
    onInterestClick?: (missionId: string) => void;
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
    fallbackImage?: string;
    label: string;
}> = {
    DONJON: {
        icon: Swords,
        color: "text-danger",
        bgColor: "bg-danger/10",
        borderColor: "border-danger/20",
        fallbackImage: "/banners/donjon.png",
        label: "Donjon"
    },
    REGULATION: {
        icon: Skull,
        color: "text-success",
        bgColor: "bg-success/10",
        borderColor: "border-success/20",
        fallbackImage: "/banners/regulation.png",
        label: "Régulation"
    },
    ANOMALIE: {
        icon: Zap,
        color: "text-fuchsia-400",
        bgColor: "bg-fuchsia-500/10",
        borderColor: "border-fuchsia-500/20",
        fallbackImage: "/assets/missions/ano1.png",
        label: "Anomalie"
    },
    SONGES: {
        icon: InfinityIcon,
        color: "text-info",
        bgColor: "bg-info/10",
        borderColor: "border-info/20",
        fallbackImage: "/assets/missions/songes.png",
        label: "Songes"
    },
    EXPEDITION: {
        icon: Clock,
        color: "text-warning",
        bgColor: "bg-warning/10",
        borderColor: "border-warning/20",
        fallbackImage: "/banners/expedition.png",
        label: "Expédition"
    },
    EVENT: {
        icon: Sparkles,
        color: "text-warning",
        bgColor: "bg-warning/10",
        borderColor: "border-warning/20",
        fallbackImage: "/assets/missions/event.png",
        label: "Événement"
    },
};

// --- Component ---

export function MissionCard({
    mission,
    currentUserId,
    guildId,
    onInterestClick,
    isRestricted,
    linkedEvent,
    vitrineMode = false,
    hideUpload = false
}: MissionCardProps) {
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

    // Extract image URL from payload — Real colorful images, no grayscale or luminosity filters
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
            case 'FRAGMENTS': return "/assets/missions/fragment.png";
            case 'STABILISATION': return "/assets/missions/3-gardiens.png";
            case 'BOSS':
            case 'ZONE':
            default:
                return "/assets/missions/ano1.png";
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

    // OBJECTIF MANUEL (#152)
    const isManualObjective = mission.category === 'EVENT' && payload.eventType === 'OBJECTIF';

    // Submission status
    const userSubmission = mission.submissions?.[0];
    const isValidated = userSubmission?.status === "VALIDATED";
    const isPendingValidation = userSubmission?.status === "PENDING";
    const isRejected = userSubmission?.status === "REJECTED";

    // Display level
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
            <Card className="flex flex-col h-[180px] bg-surface/50 border border-border border-dashed items-center justify-center p-6 text-center space-y-3 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-elevated border border-border flex items-center justify-center">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="space-y-0.5">
                    <h3 className="font-bold text-muted-foreground text-sm tracking-wide">Mission Mystère</h3>
                    <p className="text-xs text-muted-foreground/80">Dévoilée prochainement</p>
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
        <Card className={cn(
            "flex flex-col relative overflow-hidden transition-all duration-200 rounded-xl border border-border bg-surface",
            "hover:border-border-strong",
            !vitrineMode && isValidated && "border-success/40 bg-success/[0.02]",
            !vitrineMode && isPendingValidation && "border-warning/40 bg-warning/[0.02]",
            !vitrineMode && isRejected && "border-danger/40 bg-danger/[0.02]"
        )}>
            {/* ----------------- HEADER BAR ----------------- */}
            <div className="relative z-20 flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2.5 border-b border-border bg-elevated/40">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface border border-border shrink-0">
                    <Icon className={cn("w-3.5 h-3.5", config.color)} />
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-foreground truncate uppercase tracking-tight">
                        {mission.title || getAutoTitle(mission.category, payload)}
                    </h3>
                </div>

                {/* Status Badges */}
                <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    {!vitrineMode && isValidated && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/15 text-success font-bold text-caption border border-success/30">
                            <CheckCircle2 className="w-3 h-3" /> <span className="hidden sm:inline">VALIDÉ</span>
                        </div>
                    )}
                    {!vitrineMode && isPendingValidation && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-warning/15 text-warning font-bold text-caption border border-warning/30">
                            <Hourglass className="w-3 h-3" /> <span className="hidden sm:inline">ATTENTE</span>
                        </div>
                    )}
                    {!vitrineMode && isRejected && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-danger/15 text-danger font-bold text-caption border border-danger/30">
                            <XCircle className="w-3 h-3" /> <span className="hidden sm:inline">REFUSÉ</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ----------------- CONTENT BODY ----------------- */}
            <div className="relative z-10 flex min-h-[120px] sm:min-h-[130px] overflow-hidden bg-surface">

                {/* Left Column: Real Colorful Illustration */}
                <div className="w-24 sm:w-28 md:w-32 shrink-0 relative flex items-center justify-center p-2.5 sm:p-3">
                    {imageUrl ? (
                        <div className="relative w-full aspect-square max-h-[100px] flex items-center justify-center">
                            <Image
                                src={imageUrl}
                                alt={mission.title || "Illustration mission"}
                                fill
                                className="object-contain"
                                unoptimized={true}
                            />

                            {/* OBJECTIF MANUEL (#152) */}
                            {isManualObjective && (
                                <div className="absolute inset-0 z-20 flex items-center justify-center">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-warning/95 border-2 border-border-strong flex items-center justify-center overflow-hidden">
                                        <Image
                                            src="/assets/icons/exclamation.png"
                                            alt="Objectif manuel"
                                            width={60}
                                            height={60}
                                            className="object-contain w-full h-full p-1"
                                            unoptimized={true}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : isManualObjective ? (
                        <div className="w-full h-full flex items-center justify-center p-2">
                            <Image
                                src="/assets/icons/exclamation.png"
                                alt="Objectif manuel"
                                width={60}
                                height={60}
                                className="object-contain w-12 h-12 sm:w-14 sm:h-14"
                                unoptimized={true}
                            />
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-muted-foreground">
                            <Search className="w-4 h-4" />
                        </div>
                    )}

                    {/* Location Pin */}
                    {payload.zoneName && (
                        <div className="absolute bottom-1 right-1 p-1 bg-black/70 rounded border border-border" title={payload.zoneName}>
                            <MapPin className="w-2.5 h-2.5 text-success" />
                        </div>
                    )}
                </div>

                {/* Right Column: Key Info */}
                <div className="flex-1 flex flex-col p-3 sm:p-4 justify-between relative overflow-hidden min-w-0">
                    <div className="space-y-2">
                        {/* Meta: Rank & Level */}
                        <div className="flex items-center gap-2">
                            <div className="flex items-center bg-elevated/80 rounded px-2 h-5.5 border border-border">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1.5">RANG</span>
                                <span className="text-xs font-black text-foreground">{(mission as any).rank || 1}</span>
                            </div>
                            <span className="text-muted-foreground font-mono text-xs font-medium">
                                Niv. {displayLevel}
                            </span>
                        </div>

                        {/* Description */}
                        <div className="text-xs sm:text-sm font-medium text-foreground leading-snug line-clamp-3">
                            {generateDescription(mission.category, payload)}
                        </div>

                        {/* Notes */}
                        {payload?.notes && (
                            <div className="text-[11px] italic text-info/80 leading-snug border-l-2 border-info/40 pl-2 line-clamp-2">
                                📝 {payload.notes}
                            </div>
                        )}
                    </div>

                    {/* Rewards Row */}
                    <div className="flex items-center justify-between gap-2 mt-3 pt-2 shrink-0 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                            {mission.xpReward && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-elevated/80 rounded-md border border-border min-w-[60px] justify-center">
                                    <span className="text-foreground font-mono text-xs font-bold">{mission.xpReward}</span>
                                    <Image src="/assets/icons/pa.png" alt="PA" width={14} height={14} className="object-contain" loading="lazy" />
                                </div>
                            )}
                            {mission.guildatonsReward && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-elevated/80 rounded-md border border-border min-w-[60px] justify-center">
                                    <span className="text-foreground font-mono text-xs font-bold">{mission.guildatonsReward}</span>
                                    <Image src="/assets/icons/guildatons.png" alt="Guildatons" width={14} height={14} className="object-contain" loading="lazy" />
                                </div>
                            )}
                            {config.label && (
                                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider self-center">
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
                                            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-warning/10 border border-warning/30 hover:bg-warning/20 transition-all"
                                        >
                                            <CalendarIcon className="w-3 h-3 text-warning" />
                                            <span className="text-[11px] font-bold text-warning uppercase tracking-wider">
                                                Session
                                            </span>
                                            <ExternalLink className="w-2.5 h-2.5 text-warning/70" />
                                        </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-surface border-border text-warning font-bold text-caption uppercase tracking-wider px-2.5 py-1">
                                        Voir l'événement sur le calendrier
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                </div>
            </div>

            {/* ----------------- ACTION BAR ----------------- */}
            <div className="relative z-20 flex flex-wrap items-center justify-between gap-2 px-3.5 sm:px-4 py-2.5 bg-elevated/40 border-t border-border">
                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        size="sm"
                        className={cn(
                            "h-8 sm:h-8.5 px-3 sm:px-4 text-xs font-bold uppercase tracking-wider rounded-lg transition-all",
                            isInterested
                                ? "bg-success/15 text-success border border-success/30 hover:bg-success/25"
                                : "bg-surface hover:bg-elevated text-foreground border border-border"
                        )}
                        onClick={handleToggleInterest}
                        disabled={isPending || isRestricted}
                    >
                        {isInterested ? (
                            <>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
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
                            variant="ghost"
                            className="h-8 sm:h-8.5 px-2.5 sm:px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface border border-border rounded-lg"
                            onClick={handleShowValidators}
                            title="Voir les membres ayant validé"
                        >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-success" />
                            Validés
                        </Button>
                    )}
                </div>

                <div className="flex items-center gap-2 sm:gap-3 ml-auto">
                    {/* Participant Avatars */}
                    {interestCount > 0 && (
                        <div
                            className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={handleInterestBadgeClick}
                            title="Voir les inscrits"
                        >
                            <div className="flex -space-x-1.5">
                                {mission.interests.slice(0, 3).map((interest) => (
                                    <div key={interest.id} className="w-6 h-6 rounded-full border border-border bg-surface flex items-center justify-center overflow-hidden">
                                        {interest.profile.user?.image ? (
                                            <Image src={interest.profile.user.image} alt="User" width={24} height={24} className="object-cover" loading="lazy" />
                                        ) : (
                                            <Users className="w-3 h-3 text-muted-foreground" />
                                        )}
                                    </div>
                                ))}
                                {interestCount > 3 && (
                                    <div className="w-6 h-6 rounded-full border border-border bg-surface flex items-center justify-center text-[10px] font-mono font-bold text-muted-foreground">
                                        +{interestCount - 3}
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
                                className="h-8 sm:h-8.5 px-3 text-xs font-bold text-danger border-danger/30 hover:bg-danger/10 rounded-lg"
                                onClick={handleCancel}
                            >
                                Annuler
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                className={cn(
                                    "h-8 sm:h-8.5 px-3 sm:px-4 text-xs font-bold uppercase tracking-wider rounded-lg border",
                                    isRejected
                                        ? "bg-danger/20 text-danger border-danger/40 hover:bg-danger/30"
                                        : "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent shadow-sm"
                                )}
                                onClick={() => setShowUploadDialog(true)}
                                disabled={isRestricted}
                            >
                                <Upload className="w-3.5 h-3.5 mr-1.5" />
                                {isRejected ? "Réessayer" : "Preuve"}
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
                <DialogContent className="sm:max-w-md bg-surface border-border shadow-xl p-0 overflow-hidden rounded-xl">
                    <div className="p-4 sm:p-5 pb-3 border-b border-border bg-elevated/40">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2.5 text-base font-bold text-foreground">
                                <div className="w-7 h-7 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center">
                                    <ShieldCheck className="w-4 h-4 text-success" />
                                </div>
                                <span className="uppercase tracking-wider text-xs">Validations Réussies</span>
                            </DialogTitle>
                        </DialogHeader>
                    </div>

                    <ScrollArea className="max-h-[300px] w-full p-2">
                        {isLoadingValidators ? (
                            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                                <Loader2 className="w-5 h-5 animate-spin mb-2 text-primary" />
                                <span className="text-xs font-semibold">Chargement des validations...</span>
                            </div>
                        ) : validatorsList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                                <Trophy className="w-6 h-6 mb-2 opacity-30" />
                                <p className="text-xs font-medium">Aucune validation pour l'instant</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {validatorsList.map((val) => (
                                    <div key={val.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-elevated/50 transition-colors border border-transparent hover:border-border">
                                        <Avatar className="w-7 h-7 border border-border">
                                            <AvatarImage src={val.image} />
                                            <AvatarFallback className="bg-elevated text-caption font-bold">{val.pseudo.substring(0, 2).toUpperCase()}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="text-xs font-bold text-foreground truncate">{val.pseudo}</span>
                                            <span className="text-[10px] text-muted-foreground">
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
                const bossElixir = payload.elixir || 'uchronique';
                const bossLabelMap: Record<string, string> = {
                    uchronique: "Élixir uchronique",
                    mineur: "Élixir uchronique mineur",
                    ameliore: "Élixir uchronique amélioré",
                    majeur: "Élixir uchronique majeur"
                };
                if (bossElixir === 'aucun') {
                    return (
                        <>Vaincre un <span className="text-fuchsia-400 font-bold">gardien d'anomalie</span> de niveau <span className="text-fuchsia-400 font-bold">{range}</span></>
                    );
                }
                const bossElixirLabel = bossLabelMap[bossElixir as keyof typeof bossLabelMap] || bossLabelMap.uchronique;
                return (
                    <>Vaincre un <span className="text-fuchsia-400 font-bold">gardien d'anomalie</span> de niveau <span className="text-fuchsia-400 font-bold">{range}</span> sous l'effet d'un <span className="text-fuchsia-400 font-bold">{bossElixirLabel}</span></>
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
                const zonePart = payload.zoneName ? ` en ${payload.zoneName}` : "";
                return (
                    <>Vaincre <span className="text-warning font-medium">{payload.monsterName}</span>{zonePart}</>
                );
            }
            return <>Participer à l'événement spécial.</>;
        default:
            return <>Objectif de mission hebdomadaire.</>;
    }
}