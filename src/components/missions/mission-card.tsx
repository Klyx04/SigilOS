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
    Loader2
} from "lucide-react";
import { Mission, MissionCategory, MissionInterest, UserProfile, User, Submission, SubmissionStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleMissionInterest, cancelMissionSubmission } from "@/server/actions/mission-actions";
import { toast } from "sonner";
import Image from "next/image";
import { ProofUploadDialog } from "./proof-upload-dialog";

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
}

// --- Category Config ---

const CATEGORY_CONFIG: Record<MissionCategory, {
    icon: any;
    color: string;
    bgColor: string;
    borderColor: string;
    headerGradient: string;
    bannerImage: string;
    glowColor: string;
    label: string;
}> = {
    DONJON: {
        icon: Swords,
        color: "text-rose-400",
        bgColor: "bg-rose-950/40",
        borderColor: "border-rose-500/40",
        headerGradient: "from-[#a11a21]/90 via-[#d32f2f]/80 to-[#6b0f14]/90",
        bannerImage: "/banners/donjon.png",
        glowColor: "rgba(244, 63, 94, 0.4)",
        label: "Donjon"
    },
    REGULATION: {
        icon: Skull,
        color: "text-emerald-400",
        bgColor: "bg-emerald-950/40",
        borderColor: "border-emerald-500/40",
        headerGradient: "from-[#4b6b1a]/90 via-[#7cb342]/80 to-[#2d4010]/90",
        bannerImage: "/banners/regulation.png",
        glowColor: "rgba(52, 211, 153, 0.4)",
        label: "Régulation"
    },
    ANOMALIE: {
        icon: Zap,
        color: "text-fuchsia-400",
        bgColor: "bg-fuchsia-950/40",
        borderColor: "border-fuchsia-500/40",
        headerGradient: "from-[#7d1a6b]/90 via-[#ab47bc]/80 to-[#4d1040]/90",
        bannerImage: "/banners/anomalie.png",
        glowColor: "rgba(217, 70, 239, 0.4)",
        label: "Anomalie"
    },
    SONGES: {
        icon: InfinityIcon,
        color: "text-cyan-400",
        bgColor: "bg-cyan-950/40",
        borderColor: "border-cyan-500/40",
        headerGradient: "from-[#1a6b7d]/90 via-[#26c6da]/80 to-[#10404d]/90",
        bannerImage: "/banners/songes.png",
        glowColor: "rgba(34, 211, 238, 0.4)",
        label: "Songes"
    },
    EXPEDITION: {
        icon: Clock,
        color: "text-amber-400",
        bgColor: "bg-amber-950/40",
        borderColor: "border-amber-500/40",
        headerGradient: "from-[#7d5b1a]/90 via-[#ffa000]/80 to-[#4d3810]/90",
        bannerImage: "/banners/expedition.png",
        glowColor: "rgba(251, 191, 36, 0.4)",
        label: "Expédition"
    },
    EVENT: {
        icon: Sparkles,
        color: "text-yellow-300",
        bgColor: "bg-yellow-950/40",
        borderColor: "border-yellow-500/40",
        headerGradient: "from-[#7d6b1a]/90 via-[#fbc02d]/80 to-[#4d4010]/90",
        bannerImage: "/banners/event.png",
        glowColor: "rgba(253, 224, 71, 0.4)",
        label: "Événement"
    },
};

// --- Component ---

export function MissionCard({ mission, currentUserId, guildId, onInterestClick }: MissionCardProps) {
    const [isPending, startTransition] = useTransition();
    const [showUploadDialog, setShowUploadDialog] = useState(false);
    const router = useRouter();

    const isInterested = mission.interests.some(i => i.profile.userId === currentUserId);
    const interestCount = mission.interests.length;

    const config = CATEGORY_CONFIG[mission.category];
    const Icon = config.icon;
    const payload = mission.payload as any;

    // Extract image URL from payload
    const imageUrl = payload.imageUrl || payload.image || null;

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
    const isEmpty = !mission.title && (
        (mission.category === 'DONJON' && !payload.dungeonName) ||
        (mission.category === 'REGULATION' && !payload.monsterName && !payload.familyName) ||
        (mission.category === 'ANOMALIE' && !payload.levelRange && !payload.type) ||
        (mission.category === 'SONGES' && !payload.difficulty) ||
        (mission.category === 'EXPEDITION' && !payload.dungeonName) ||
        (mission.category === 'EVENT' && !payload.description)
    );

    if (isEmpty) {
        return (
            <Card className="flex flex-col h-[180px] bg-zinc-950/50 border border-zinc-800/60 border-dashed items-center justify-center p-6 text-center space-y-4 hover:bg-zinc-900/50 transition-colors group">
                <div className="w-12 h-12 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner">
                    <Icon className="w-6 h-6 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </div>
                <div className="space-y-1 cursor-default">
                    <h3 className="font-semibold text-zinc-400 text-sm tracking-wide">Mission Mystère</h3>
                    <p className="text-[10px] text-zinc-600 font-medium">Dévoilée prochainement</p>
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

    return (
        <Card className={cn(
            "flex flex-col relative overflow-hidden transition-all duration-500 group border-white/5 bg-[#121417] shadow-2xl",
            "hover:border-white/10 hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]",
            isValidated && "ring-1 ring-emerald-500/40",
            isRejected && "ring-1 ring-red-500/40",
            isPendingValidation && "ring-1 ring-yellow-500/40"
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
                        <Icon className={cn("w-4 h-4", config.color.replace('text-', 'text-white'))} />
                    </div>
                </div>

                <div className="flex-1 min-w-0 relative z-10">
                    <h3 className="font-black text-sm sm:text-base text-white truncate drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-tight uppercase">
                        {mission.title || getAutoTitle(mission.category, payload)}
                    </h3>
                </div>

                {/* Status Badges Pin to Right */}
                <div className="ml-auto flex gap-2 relative z-10">
                    {isValidated && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white font-black text-[9px] shadow-lg border border-white/10">
                            <CheckCircle2 className="w-3 h-3" /> <span className="hidden sm:inline">VALIDÉ</span>
                        </div>
                    )}
                    {isPendingValidation && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/90 text-black font-black text-[9px] shadow-lg border border-white/10 animate-pulse">
                            <Hourglass className="w-3 h-3" /> <span className="hidden sm:inline">ATTENTE</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ----------------- CONTENT BODY (Two Columns) ----------------- */}
            <div className="relative z-10 flex h-[135px] overflow-hidden bg-gradient-to-b from-[#1a1c20] to-[#121417]">

                {/* Sub-Atmosphere Glow */}
                <div className={cn(
                    "absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10 blur-3xl pointer-events-none transition-all duration-1000 group-hover:scale-150",
                    config.bgColor.replace('bg-', 'bg-')
                )} />

                {/* Left Column: Image Cutout */}
                <div className="w-[32%] shrink-0 flex items-center justify-center p-3 relative border-r border-white/5">
                    {/* Background Light behind Creature */}
                    <div className={cn(
                        "absolute inset-0 opacity-20 blur-2xl rounded-full scale-110",
                        config.bgColor
                    )} />

                    {imageUrl ? (
                        <div className="relative w-full h-full transform transition-all duration-700 group-hover:scale-110 group-hover:-rotate-2 drop-shadow-[0_10px_15px_rgba(0,0,0,0.6)]">
                            <Image
                                src={imageUrl}
                                alt="Subject"
                                fill
                                className="object-contain"
                            />
                        </div>
                    ) : (
                        <div className="w-12 h-12 rounded-2xl bg-zinc-800/50 border border-white/5 flex items-center justify-center">
                            <Search className="w-5 h-5 text-zinc-600" />
                        </div>
                    )}

                    {/* Decorative Location Pin */}
                    {payload.zoneName && (
                        <div className="absolute bottom-1.5 right-1.5 p-1 bg-black/60 rounded border border-white/10 backdrop-blur-md transition-opacity hover:opacity-100" title={payload.zoneName}>
                            <MapPin className="w-2.5 h-2.5 text-emerald-400" />
                        </div>
                    )}
                </div>

                {/* Right Column: Key Info */}
                <div className="flex-1 flex flex-col p-4 justify-between relative overflow-hidden">
                    <div className="space-y-4">
                        {/* Meta Data: Rank & Level UI */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center bg-black/60 rounded px-2.5 h-6 border border-white/10 shadow-inner">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mr-2">RANG</span>
                                <span className="text-sm font-black text-white">{(mission as any).rank || 1}</span>
                            </div>
                            <div className="h-4 w-[1px] bg-white/10" />
                            <span className="text-zinc-300 font-bold italic text-sm tracking-tight">
                                Niv. {displayLevel}
                            </span>
                        </div>

                        {/* Description Text */}
                        <div className="text-[15px] font-medium text-zinc-100 leading-snug pr-4 text-shadow-sm line-clamp-3">
                            {generateDescription(mission.category, payload)}
                        </div>
                    </div>

                    {/* Rewards Row */}
                    <div className="flex items-center justify-between mt-auto pt-4">
                        <div className="flex gap-2.5">
                            {mission.xpReward && (
                                <div className="flex items-center gap-2 px-2.5 py-1 bg-black/40 rounded-lg border border-white/10 shadow-md">
                                    <span className="text-white font-mono text-sm font-black">{mission.xpReward}</span>
                                    <Image src="/PA.png" alt="PA" width={18} height={18} className="object-contain" />
                                </div>
                            )}
                            {mission.guildatonsReward && (
                                <div className="flex items-center gap-2 px-2.5 py-1 bg-black/40 rounded-lg border border-white/10 shadow-md">
                                    <span className="text-white font-mono text-sm font-black">{mission.guildatonsReward}</span>
                                    <Image src="/guildaton.png" alt="Guildatons" width={18} height={18} className="object-contain" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ----------------- ACTION BAR (Bottom) ----------------- */}
            <div className="relative z-20 flex px-5 py-3 bg-[#0d0f11] border-t border-white/5 items-center justify-between">
                <Button
                    size="sm"
                    className={cn(
                        "h-9 px-6 text-xs font-black uppercase tracking-widest rounded transition-all flex items-center gap-2 shadow-lg",
                        isInterested
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30"
                            : "bg-white text-black hover:bg-emerald-400 hover:text-black hover:scale-105 active:scale-95 border-none"
                    )}
                    onClick={handleToggleInterest}
                    disabled={isPending}
                >
                    {isInterested ? (
                        <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Inscrit</span>
                        </>
                    ) : (
                        <span>S'inscrire</span>
                    )}
                </Button>

                <div className="flex items-center gap-4">
                    {/* Participant List */}
                    {interestCount > 0 && (
                        <div
                            className="flex items-center gap-2 cursor-pointer group/list"
                            onClick={handleInterestBadgeClick}
                        >
                            <div className="flex -space-x-2 transition-all duration-300 group-hover/list:space-x-1">
                                {mission.interests.slice(0, 4).map((interest, i) => (
                                    <div key={interest.id} className="w-8 h-8 rounded-full border-2 border-black bg-zinc-800 flex items-center justify-center overflow-hidden shadow-sm relative group/avatar">
                                        {interest.profile.user?.image ? (
                                            <Image src={interest.profile.user.image} alt="User" width={32} height={32} className="object-cover" />
                                        ) : (
                                            <Users className="w-4 h-4 text-zinc-500" />
                                        )}
                                    </div>
                                ))}
                                {interestCount > 4 && (
                                    <div className="w-8 h-8 rounded-full border-2 border-black bg-zinc-900 flex items-center justify-center text-[10px] font-black text-white shadow-sm z-10">
                                        +{interestCount - 4}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {!isValidated && !isRejected && (
                        isPendingValidation ? (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-9 px-4 text-[10px] font-black bg-red-500/5 text-red-400 border-red-500/20 hover:bg-red-500/10"
                                onClick={handleCancel}
                            >
                                ANNULER
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                className="h-9 px-5 text-[10px] font-black uppercase tracking-[2px] bg-zinc-800 text-zinc-300 hover:bg-white hover:text-black transition-all border border-white/10"
                                onClick={() => setShowUploadDialog(true)}
                            >
                                <Upload className="w-3.5 h-3.5 mr-2" />
                                PREUVE
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
        case "ANOMALIE": return payload.type === 'BOSS' ? `Gardien d'anomalie ${payload.levelRange || '200'}` : "Au cœur de l'anomalie";
        case "SONGES": return payload.difficulty && payload.level ? `Plongée en ${payload.difficulty} ${payload.level}` : "Songes Infinis";
        case "EXPEDITION": return payload.dungeonName ? `Expédition de ${payload.dungeonName}` : "Expédition";
        case "EVENT": return payload.title || "Événement Spécial";
        default: return "Mission";
    }
}

function generateDescription(category: MissionCategory, payload: any): React.ReactNode {
    switch (category) {
        case "DONJON":
            return (
                <>Vaincre <span className="text-rose-400 font-medium">{payload.bossName || "le Boss"}</span> dans son donjon</>
            );
        case "REGULATION":
            const targetName = payload.monsterName || payload.familyName || "monstres";
            return (
                <>Vaincre <span className="text-emerald-400 font-medium">50 {targetName}</span> sur leur territoire</>
            );
        case "ANOMALIE":
            if (payload.type === 'BOSS') {
                return <>Vaincre un gardien d'anomalie temporelle sous l'effet d'un</>;
            }
            return <>Vaincre 50 monstres dans un territoire de niveau <span className="text-fuchsia-400 font-medium">{payload.levelRange || "200"}</span> sous anomalie</>;
        case "SONGES":
            const palierNames: Record<number, string> = {
                1: "Pensées oniriques",
                2: "Balades fantastiques",
                3: "Espaces imaginaires",
                4: "Concepts brumeux",
                5: "Abstractions chimériques"
            };
            const palierName = palierNames[payload.tier] || palierNames[2];
            return (
                <>Démarrer un songe en <span className="text-cyan-400 font-medium">{payload.difficulty || "Paradoxe"} {payload.level || "I"}</span> et terminer le Palier {payload.tier || 2} : les <span className="text-cyan-400">{palierName}</span></>
            );
        case "EXPEDITION":
            const modeText = payload.mode && payload.mode !== 'aucun' ? ` de ${payload.mode}` : '';
            return (
                <>Vaincre <span className="text-amber-400 font-medium">{payload.bossName || "le Boss"}</span> dans son expédition{modeText}</>
            );
        case "EVENT":
            return <>{payload.description || "Participer à l'événement."}</>;
        default:
            return "Compléter l'objectif demandé.";
    }
}
