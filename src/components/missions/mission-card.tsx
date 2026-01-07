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
    ExternalLink,
    AlertTriangle,
    CheckCircle2,
    Hourglass
} from "lucide-react";
import { Mission, MissionCategory, MissionInterest, UserProfile, User, Submission, SubmissionStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleMissionInterest } from "@/server/actions/mission-actions";
import { toast } from "sonner";
import Image from "next/image";
import { Loader2 } from "lucide-react";
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
    glowColor: string;
    label: string;
}> = {
    DONJON: {
        icon: Swords,
        color: "text-rose-400",
        bgColor: "bg-rose-950/40",
        borderColor: "border-rose-500/40",
        headerGradient: "from-rose-600/90 to-rose-800/90",
        glowColor: "rgba(244, 63, 94, 0.4)",
        label: "Donjon"
    },
    REGULATION: {
        icon: Skull,
        color: "text-emerald-400",
        bgColor: "bg-emerald-950/40",
        borderColor: "border-emerald-500/40",
        headerGradient: "from-emerald-600/90 to-emerald-800/90",
        glowColor: "rgba(52, 211, 153, 0.4)",
        label: "Régulation"
    },
    ANOMALIE: {
        icon: Zap,
        color: "text-fuchsia-400",
        bgColor: "bg-fuchsia-950/40",
        borderColor: "border-fuchsia-500/40",
        headerGradient: "from-fuchsia-600/90 to-fuchsia-800/90",
        glowColor: "rgba(217, 70, 239, 0.4)",
        label: "Anomalie"
    },
    SONGES: {
        icon: InfinityIcon,
        color: "text-cyan-400",
        bgColor: "bg-cyan-950/40",
        borderColor: "border-cyan-500/40",
        headerGradient: "from-cyan-600/90 to-cyan-800/90",
        glowColor: "rgba(34, 211, 238, 0.4)",
        label: "Songes"
    },
    EXPEDITION: {
        icon: Clock,
        color: "text-amber-400",
        bgColor: "bg-amber-950/40",
        borderColor: "border-amber-500/40",
        headerGradient: "from-amber-600/90 to-amber-800/90",
        glowColor: "rgba(251, 191, 36, 0.4)",
        label: "Expédition"
    },
    EVENT: {
        icon: Sparkles,
        color: "text-yellow-300",
        bgColor: "bg-yellow-950/40",
        borderColor: "border-yellow-500/40",
        headerGradient: "from-yellow-600/90 to-yellow-800/90",
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

    // Check user's submission status for this mission
    const userSubmission = mission.submissions?.[0];
    const isValidated = userSubmission?.status === "VALIDATED";
    const isPendingValidation = userSubmission?.status === "PENDING";

    // Check if mission is "empty" (not fully configured)
    const isEmpty = !mission.title && (
        (mission.category === 'DONJON' && !payload.dungeonName) ||
        (mission.category === 'REGULATION' && !payload.monsterName) ||
        (mission.category === 'ANOMALIE' && !payload.levelRange && !payload.type) ||
        (mission.category === 'SONGES' && !payload.difficulty) ||
        (mission.category === 'EXPEDITION' && !payload.dungeonName) ||
        (mission.category === 'EVENT' && !payload.description)
    );

    if (isEmpty) {
        return (
            <Card className="flex flex-col h-full bg-gradient-to-br from-slate-900/80 to-slate-950/80 border border-slate-800/60 border-dashed items-center justify-center p-6 text-center space-y-4 hover:bg-slate-900/80 transition-colors group">
                <div className="w-14 h-14 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                    <Icon className="w-6 h-6 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </div>
                <div className="space-y-1.5">
                    <h3 className="font-semibold text-slate-200 text-sm tracking-wide">Mission en attente</h3>
                    <p className="text-xs text-slate-500 font-medium">Dévoilée prochainement</p>
                </div>
            </Card>
        );
    }

    // Get level from payload
    const displayLevel = payload.level || getDefaultLevel(mission.tier);

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

    const handleInterestBadgeClick = () => {
        if (onInterestClick) {
            onInterestClick(mission.id);
        }
    };

    return (
        <Card className={cn(
            "flex flex-col h-full transition-all duration-300 group relative overflow-hidden",
            "bg-slate-900/95",
            // Validated state: green border and glow
            isValidated
                ? "border-2 border-emerald-500/70 shadow-[0_0_25px_-5px_rgb(16,185,129,0.4)]"
                : isPendingValidation
                    ? "border-2 border-yellow-500/50"
                    : config.borderColor,
            !isValidated && "hover:shadow-[0_0_20px_-5px_var(--glow-color)] hover:translate-y-[-2px]"
        )}
            style={{ "--glow-color": isValidated ? "rgb(16,185,129)" : config.glowColor } as React.CSSProperties}
        >
            {/* Validated Badge Overlay */}
            {isValidated && (
                <div className="absolute top-2 right-2 z-20">
                    <div className="flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                        <CheckCircle2 className="w-3 h-3" />
                        VALIDÉ
                    </div>
                </div>
            )}

            {/* Pending Badge Overlay */}
            {isPendingValidation && (
                <div className="absolute top-2 right-2 z-20">
                    <div className="flex items-center gap-1 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                        <Hourglass className="w-3 h-3" />
                        EN ATTENTE
                    </div>
                </div>
            )}

            {/* Header with gradient */}
            <CardHeader className={cn(
                "p-3 pb-2 relative z-10 bg-gradient-to-r min-h-[48px] flex items-center",
                isValidated
                    ? "from-emerald-600/90 to-emerald-700/80"
                    : config.headerGradient
            )}>
                <div className="flex items-center gap-2 w-full">
                    {isValidated ? (
                        <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                    ) : (
                        <Icon className="w-4 h-4 text-white/90 shrink-0" />
                    )}
                    <h3 className="font-bold text-sm text-white flex-1 min-w-0 leading-tight line-clamp-2">
                        {mission.title || getAutoTitle(mission.category, payload)}
                    </h3>
                </div>
            </CardHeader>

            {/* Body */}
            <CardContent className="p-3 pt-1 flex-grow relative z-10 flex flex-col">
                <div className="flex gap-3 flex-1">
                    {/* Left: Text Content */}
                    <div className="flex-1 min-w-0 flex flex-col h-full">
                        {/* Rank & Level */}
                        <div className="flex items-center gap-2.5 mb-3">
                            <Badge variant="outline" className="h-5 px-2 text-xs bg-slate-800/80 border-slate-600 text-slate-200 font-semibold shadow-sm">
                                RANG {mission.tier}
                            </Badge>
                            <span className="text-sm font-medium text-slate-300">Niv. {displayLevel}</span>
                        </div>

                        {/* Description */}
                        <div className="text-sm text-slate-200 leading-snug font-medium opacity-90 mb-4">
                            {generateDescription(mission.category, payload)}
                        </div>



                        {/* Anomalie Elixir Tag */}
                        {mission.category === 'ANOMALIE' && (
                            <div className="flex items-center gap-2 text-xs text-fuchsia-200 font-bold bg-fuchsia-900/40 border border-fuchsia-500/40 px-2.5 py-1.5 rounded-md mb-3 shadow-sm animate-pulse-slow">
                                <AlertTriangle className="w-3.5 h-3.5 text-fuchsia-400 flex-shrink-0" />
                                <span className="tracking-wide uppercase text-[10px]">Elixir Uchronique OBLIGATOIRE</span>
                            </div>
                        )}

                        {/* DPLN Link */}
                        {payload.dpnlUrl && (
                            <div className="mt-auto pt-2">
                                <a
                                    href={payload.dpnlUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 hover:border-indigo-500/40 w-fit"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Guide DPLN
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Right: Image placeholder */}
                    <div className={cn(
                        "w-16 h-16 rounded-lg flex-shrink-0 flex items-center justify-center border overflow-hidden",
                        config.bgColor,
                        config.borderColor
                    )}>
                        {payload.imageUrl ? (
                            <Image
                                src={payload.imageUrl}
                                alt={mission.title || "Mission"}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <Icon className={cn("w-6 h-6", config.color)} />
                        )}
                    </div>
                </div>
            </CardContent>

            {/* Footer: Rewards & Actions */}
            <CardFooter className="p-3 pt-0 flex items-end justify-between gap-2 relative z-10">
                {/* Rewards */}
                <div className="flex items-center gap-2">
                    {mission.xpReward && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/60 rounded-md border border-slate-800/60 shadow-sm" title="Points d'activité">
                            <span className="text-slate-300 font-mono text-xs font-semibold">{mission.xpReward}</span>
                            <div className="w-[16px] h-[16px] relative translate-y-[0.5px]">
                                <Image
                                    src="/PA.png"
                                    alt="Activity"
                                    width={16}
                                    height={16}
                                    className="object-contain"
                                />
                            </div>
                        </div>
                    )}
                    {mission.guildatonsReward && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/60 rounded-md border border-slate-800/60 shadow-sm" title="Guildatons">
                            <span className="text-slate-300 font-mono text-xs font-semibold">{mission.guildatonsReward}</span>
                            <div className="w-[16px] h-[16px] relative translate-y-[0.5px]">
                                <Image
                                    src="/guildaton.png"
                                    alt="Guildatons"
                                    width={16}
                                    height={16}
                                    className="object-contain"
                                />
                            </div>
                        </div>
                    )}
                    {/* Stars removed as requested */}
                </div>

                {/* Interest Count (clickable for modal) */}
                <button
                    onClick={handleInterestBadgeClick}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors bg-slate-800/50 px-2 py-1 rounded-md border border-slate-700/50 hover:border-slate-600"
                >
                    <Users className="w-3.5 h-3.5" />
                    <span className="font-semibold">{interestCount}</span>
                </button>
            </CardFooter>

            {/* Bottom Action Bar */}
            <div className={cn(
                "px-3 pb-3 pt-2 border-t flex items-center gap-2",
                isValidated ? "border-emerald-500/30 bg-emerald-500/5" : "border-slate-800/50"
            )}>
                {isValidated ? (
                    // Validated state: show completion message
                    <div className="flex-1 flex items-center justify-center gap-2 h-8 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        Mission validée !
                    </div>
                ) : isPendingValidation ? (
                    // Pending state: show waiting message
                    <div className="flex-1 flex items-center justify-center gap-2 h-8 text-yellow-400 text-xs font-medium">
                        <Hourglass className="w-4 h-4" />
                        En attente de validation...
                    </div>
                ) : (
                    <>
                        {/* Interest Toggle */}
                        <Button
                            size="sm"
                            variant="ghost"
                            className={cn(
                                "flex-1 h-8 gap-1.5 transition-all text-xs font-medium border",
                                isInterested
                                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50 hover:bg-indigo-500/30"
                                    : "bg-slate-800/40 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700 hover:border-slate-600"
                            )}
                            onClick={handleToggleInterest}
                            disabled={isPending}
                        >
                            <Star className={cn(
                                "w-3.5 h-3.5",
                                isInterested ? "fill-indigo-400 text-indigo-400" : ""
                            )} />
                            {isInterested ? "Intéressé" : "Intéressé ?"}
                        </Button>

                        {/* Submit Button */}
                        <Button
                            size="sm"
                            className="flex-1 h-8 gap-1.5 bg-slate-100 text-black hover:bg-white text-xs font-semibold"
                            onClick={() => setShowUploadDialog(true)}
                        >
                            <Upload className="w-3 h-3" />
                            Validation
                        </Button>
                    </>
                )}
            </div>

            {/* Proof Upload Dialog */}
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
        case "DONJON":
            return payload.dungeonName || "Donjon Mystérieux";
        case "REGULATION":
            return payload.monsterName ? `Régulation des ${payload.monsterName}` : "Régulation";
        case "ANOMALIE":
            return payload.type === 'BOSS' ? `Gardien d'anomalie ${payload.levelRange || '200'}` : "Au cœur de l'anomalie";
        case "SONGES":
            return payload.difficulty && payload.level
                ? `Plongée en ${payload.difficulty} ${payload.level}`
                : "Songes Infinis";
        case "EXPEDITION":
            return payload.dungeonName ? `Expédition de ${payload.dungeonName}` : "Expédition";
        case "EVENT":
            return payload.title || "Événement Spécial";
        default:
            return "Mission";
    }
}

function generateDescription(category: MissionCategory, payload: any): React.ReactNode {
    switch (category) {
        case "DONJON":
            return (
                <>Vaincre <span className="text-rose-400 font-medium">{payload.bossName || "le Boss"}</span> dans son donjon</>
            );
        case "REGULATION":
            return (
                <>Vaincre <span className="text-emerald-400 font-medium">50 {payload.monsterName || "monstres"}</span> sur leur territoire</>
            );
        case "ANOMALIE":
            if (payload.type === 'BOSS') {
                return <>Vaincre un gardien d'anomalie temporelle sous l'effet d'un</>;
            }
            return <>Vaincre 50 monstres dans un territoire de niveau <span className="text-fuchsia-400 font-medium">{payload.levelRange || "200"}</span> sous anomalie</>;
        case "SONGES":
            return (
                <>Démarrer un songe en <span className="text-cyan-400 font-medium">{payload.difficulty || "Paradoxe"} {payload.level || "I"}</span> et terminer le Palier {payload.tier || 2} : les <span className="text-cyan-400">Balades fantastiques</span></>
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
