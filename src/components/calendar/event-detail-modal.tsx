"use client";

/**
 * EventDetailModal V3 - 4 Types + Native ClassIcon
 */

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Image from "next/image";
import Link from "next/link";
import {
    Calendar,
    Clock,
    Users,
    User,
    Crown,
    Trash2,
    Edit,
    Check,
    X,
    Loader2,
    Swords,
    PartyPopper,
    Target,
    Wheat,
    Bell,
    Share2,
    ChevronDown,
    AtSign,
    ExternalLink,
    Eye,
    Globe,
    Lock,
    Shield,
    Trophy,
    Star,
    Coins,
    AlertTriangle,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ClassIcon, getClassColor } from "@/components/shared/class-icon";
import { RegistrationModal } from "./registration-modal";
import { CalendarDiscordDialog } from "./calendar-discord-dialog";
import { getMissionsByIds } from "@/server/actions/mission-actions";
import { kickParticipant, transferRaidCaptaincy } from "@/server/actions/calendar-actions";
import { Skull, Zap, Clock as ClockIcon, Infinity as InfinityIcon, Sparkles as SparklesIcon } from "lucide-react";

// ============================================
// 4 EVENT TYPES
// ============================================

interface TypeConfig {
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    gradient: string;
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
    RAID_OFFICIAL: {
        label: "Raid 3.6",
        icon: Swords,
        color: "text-red-400",
        bgColor: "bg-red-500/10 border-red-500/30",
        gradient: "from-red-600 to-rose-600"
    },
    EVENT_GUILD: {
        label: "Event Guilde",
        icon: PartyPopper,
        color: "text-purple-400",
        bgColor: "bg-purple-500/10 border-purple-500/30",
        gradient: "from-purple-600 to-fuchsia-600"
    },
    SESSION_MISSIONS: {
        label: "Missions Guilde",
        icon: Target,
        color: "text-amber-400",
        bgColor: "bg-amber-500/10 border-amber-500/30",
        gradient: "from-amber-600 to-orange-600"
    },
    SORTIE_FARM: {
        label: "Sortie Farm",
        icon: Wheat,
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10 border-emerald-500/30",
        gradient: "from-emerald-600 to-green-600"
    },
    KRALAMOURE: {
        label: "Kralamoure",
        icon: Eye,
        color: "text-pink-400",
        bgColor: "bg-pink-500/10 border-pink-500/30",
        gradient: "from-pink-600 to-rose-600"
    },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: "Brouillon", color: "text-zinc-400", bg: "bg-zinc-600" },
    PUBLISHED: { label: "Ouvert", color: "text-green-400", bg: "bg-green-600" },
    COMPLETED: { label: "Terminé", color: "text-blue-400", bg: "bg-blue-600" },
    CANCELLED: { label: "Annulé", color: "text-red-400", bg: "bg-red-600" }
};

const MISSION_CATEGORY_CONFIG: Record<string, { icon: any; color: string; fallbackImage: string; label: string }> = {
    DONJON: {
        icon: Swords,
        color: "text-rose-400",
        fallbackImage: "/assets/missions/donjon.png",
        label: "Donjon"
    },
    REGULATION: {
        icon: Skull,
        color: "text-emerald-400",
        fallbackImage: "/assets/missions/regulation.png",
        label: "Régulation"
    },
    ANOMALIE: {
        icon: Zap,
        color: "text-fuchsia-400",
        fallbackImage: "/assets/missions/ano1.png",
        label: "Anomalie"
    },
    SONGES: {
        icon: InfinityIcon,
        color: "text-cyan-400",
        fallbackImage: "/assets/missions/songes.png",
        label: "Songes"
    },
    EXPEDITION: {
        icon: Clock,
        color: "text-amber-400",
        fallbackImage: "/assets/missions/expedition.png",
        label: "Expédition"
    },
    EVENT: {
        icon: SparklesIcon,
        color: "text-yellow-300",
        fallbackImage: "/assets/missions/event.png",
        label: "Événement"
    },
};

// ============================================
// INTERFACES
// ============================================

interface Participant {
    id: string;
    status: string;
    position: number;
    classe?: string | null;
    comment?: string | null;
    hasParticipatedThisWeek?: boolean;
    user: {
        id: string;
        name: string | null;
        image: string | null;
        profiles?: { discordNickname: string | null }[];
    };
}

interface EventDetail {
    id: string;
    title: string;
    description?: string | null;
    type: string;
    status: string;
    startDate: Date | string;
    endDate: Date | string;
    location?: string | null;
    maxParticipants?: number | null;
    creator: {
        id: string;
        name: string | null;
        image: string | null;
    };
    participants: Participant[];
    discordMessageId?: string | null;
}

interface DiscordRole {
    id: string;
    name: string;
    color?: number;
}

interface EventDetailModalProps {
    event: EventDetail | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentUserId: string;
    guildId: string;
    canManage?: boolean;
    isAdmin?: boolean;
    everyoneAllowed?: boolean;
    discordRoles?: DiscordRole[];
    onRegister?: (data: { classe?: string; comment?: string }) => Promise<void>;
    onUnregister?: () => Promise<void>;
    onEdit?: () => void;
    onDelete?: () => Promise<void>;
    onCancel?: () => Promise<void>;
    onPublish?: () => Promise<void>;
    onComplete?: () => Promise<void>;
    onUndoComplete?: () => Promise<void>;
    onSendReminder?: (roleId?: string) => Promise<{ success: boolean; sentCount?: number; discordSent?: boolean; error?: string }>;
    onShareDiscord?: (roleId?: string) => Promise<{ success: boolean; error?: string }>;
    hasMetamobKey?: boolean;
    isDiscordConfigured?: boolean;
    donationsEnabled?: boolean;
    /** Kamas eligibility for RAID_OFFICIAL events. Null = loading or not a raid. */
    raidEligibility?: { isEligible: boolean; totalDonated: number } | null;
}

// ============================================
// COMPONENT
// ============================================

export function EventDetailModal({
    event,
    open,
    onOpenChange,
    currentUserId,
    guildId,
    canManage = false,
    isAdmin = false,
    everyoneAllowed = false,
    discordRoles = [],
    onRegister,
    onUnregister,
    onEdit,
    onDelete,
    onCancel,
    onPublish,
    onComplete,
    onUndoComplete,
    onSendReminder,
    onShareDiscord,
    hasMetamobKey = false,
    isDiscordConfigured = false,
    donationsEnabled = true,
    raidEligibility = null,
}: EventDetailModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [showRegistration, setShowRegistration] = useState(false);
    // Discord dialog state
    const [discordDialogOpen, setDiscordDialogOpen] = useState(false);
    const [discordDialogMode, setDiscordDialogMode] = useState<"REMINDER" | "SHARE">("SHARE");

    // Delete confirmation state
    const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
    const [selectedMissions, setSelectedMissions] = useState<any[]>([]);
    const [loadingMissions, setLoadingMissions] = useState(false);
    // Raid completion state
    const [showRaidCompletion, setShowRaidCompletion] = useState(false);
    const [raidScore, setRaidScore] = useState("");
    const [presentParticipants, setPresentParticipants] = useState<Set<string>>(new Set());
    const [isCompletingRaid, setIsCompletingRaid] = useState(false);
    const [confirmRaidComplete, setConfirmRaidComplete] = useState(false);

    const eventMetadata = (event as any)?.metadata as any;
    const missionIds = eventMetadata?.missionIds as string[] | undefined;
    // Raid metadata
    const isRaid = event?.type === "RAID_OFFICIAL";
    const raidMeta = isRaid ? eventMetadata : null;

    // Fetch missions if needed
    useEffect(() => {
        if (event?.type === "SESSION_MISSIONS" && missionIds && missionIds.length > 0) {
            setLoadingMissions(true);
            getMissionsByIds(missionIds).then(missions => {
                setSelectedMissions(missions);
                setLoadingMissions(false);
            });
        }
    }, [event?.type, missionIds]);

    if (!event) return null;

    // Init present participants when entering completion mode
    const initRaidCompletion = () => {
        const registered = event.participants.filter(p => p.status === "REGISTERED").map(p => p.user.id);
        setPresentParticipants(new Set(registered));
        setRaidScore("");
        setConfirmRaidComplete(false);
        setShowRaidCompletion(true);
    };

    const typeConfig = TYPE_CONFIG[event.type] || TYPE_CONFIG.EVENT_GUILD;
    const statusConfig = STATUS_CONFIG[event.status] || STATUS_CONFIG.DRAFT;

    const registeredCount = event.participants.filter(p => p.status === "REGISTERED").length;
    const reserveCount = event.participants.filter(p => p.status === "RESERVE").length;
    const isUserRegistered = event.participants.some(p => p.user.id === currentUserId && p.status !== "DECLINED");
    const userParticipant = event.participants.find(p => p.user.id === currentUserId);

    // Distinguish between direct Metamob events (krala-{id}) and imported events
    const isDirectKralamoure = event.id.startsWith("krala-");
    const isImportedKralamoure = event.type === "KRALAMOURE" && !isDirectKralamoure;
    const isExternal = isDirectKralamoure; // Only direct Kralamoure events are truly external

    const isOpen = event.status === "PUBLISHED";
    const isFull = event.maxParticipants ? registeredCount >= event.maxParticipants : false;
    const isCreator = event.creator.id === currentUserId;
    const isRegistered = isUserRegistered;
    const canRegister = isOpen && !isRegistered && !isExternal;

    // Extract Metamob creator from metadata or description for Kralamoure events
    const metamobCreator = (isDirectKralamoure || isImportedKralamoure)
        ? (eventMetadata?.metamobCreator || event.creator.name)
        : null;

    // SaaS 2026: Live count calculation
    const isKrala = isDirectKralamoure || isImportedKralamoure;
    const cachedCount = isKrala ? (eventMetadata?.metamobParticipantsCount || 0) : 0;
    const displayCount = registeredCount > 0 ? registeredCount : cachedCount;

    const handleAction = async (action: () => Promise<void>) => {
        setIsLoading(true);
        try {
            await action();
        } catch (error) {
            toast.error("Une erreur est survenue");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegistration = async (data: { classe?: string; comment?: string }) => {
        if (onRegister) {
            await onRegister(data);
        }
    };

    const handleDelete = async () => {
        if (!onDelete) return;

        setIsLoading(true);
        try {
            await onDelete();
            onOpenChange(false);
            toast.success("Événement supprimé");
        } catch (error) {
            toast.error("Erreur lors de la suppression");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!onCancel) return;

        setIsLoading(true);
        try {
            await onCancel();
            onOpenChange(false);
            toast.success("Événement annulé");
        } catch (error) {
            toast.error("Erreur lors de l'annulation");
        } finally {
            setIsLoading(false);
        }
    };



    const TypeIcon = typeConfig.icon;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    draggable
                    className="w-[95vw] sm:max-w-2xl bg-zinc-900/98 backdrop-blur-xl border border-white/10 ring-1 ring-orange-500/25 p-0 overflow-hidden max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(249,115,22,0.2)] fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                    {/* Header */}
                    <div className={cn("relative px-8 pt-12 pb-10 border-b border-zinc-800/50 overflow-hidden", typeConfig.bgColor)}>
                        <div className={cn("absolute inset-0 opacity-40 bg-gradient-to-br z-0", typeConfig.gradient)} />
                        
                        {/* Decorative Kralamoure Insert (Top Right) */}
                        {event.type === "KRALAMOURE" && (
                            <div className="absolute right-0 top-0 w-32 h-full opacity-60 pointer-events-none overflow-hidden select-none">
                                <div className="absolute top-1/2 -translate-y-1/2 right-4 w-20 h-20 rounded-2xl border border-white/20 overflow-hidden rotate-12 shadow-2xl backdrop-blur-md bg-white/5 p-1">
                                    <Image 
                                        src="/game-data/dungeons/antre-du-kralamoure-g-ant.webp" 
                                        alt="Kralamoure" 
                                        fill
                                        className="object-cover rounded-xl"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="relative flex justify-between items-start z-10 w-full pr-8">
                            <div className="flex gap-5">
                                <div className={cn(
                                    "p-3 rounded-2xl shadow-inner shrink-0",
                                    "bg-black/20 text-white backdrop-blur-sm border border-white/10"
                                )}>
                                    <TypeIcon className="w-6 h-6" />
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-wider", typeConfig.color, "border-current/30 bg-current/5 px-2 py-0")}>
                                            {typeConfig.label}
                                        </Badge>
                                        <Badge className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-0", statusConfig.bg)}>
                                            {statusConfig.label}
                                        </Badge>
                                    </div>
                                    <DialogHeader>
                                        <DialogTitle className={cn(
                                            "font-black tracking-tight text-white uppercase italic leading-tight break-words",
                                            event.title.length > 40 ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
                                        )}>
                                            {event.title}
                                        </DialogTitle>
                                    </DialogHeader>
                                </div>
                            </div>

                            {/* Move Complete Button Here */}
                            {canManage && (
                                <div className="flex items-center gap-2 ml-4">
                                    {/* Edit button — only creator or admin, disabled for Kralamoure */}
                                    {onEdit && event.type !== "KRALAMOURE" && (isCreator || isAdmin) && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={onEdit}
                                            className="text-zinc-400 hover:text-white hover:bg-white/10"
                                        >
                                            <Edit className="h-4 w-4 mr-1.5" />
                                            Éditer
                                        </Button>
                                    )}

                                    {/* Cancel button — only creator or admin (soft delete → CANCELLED) */}
                                    {event.status === "PUBLISHED" && onCancel && (isCreator || isAdmin) && (
                                        <Button
                                            size="sm"
                                            variant={isDeleteConfirming ? "destructive" : "ghost"}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isDeleteConfirming) {
                                                    handleCancel();
                                                } else {
                                                    setIsDeleteConfirming(true);
                                                    setTimeout(() => setIsDeleteConfirming(false), 3000);
                                                }
                                            }}
                                            disabled={isLoading}
                                            className={cn(
                                                "transition-all",
                                                isDeleteConfirming
                                                    ? "bg-red-600 hover:bg-red-700 text-white"
                                                    : "text-zinc-400 hover:text-red-400 hover:bg-red-950/20"
                                            )}
                                        >
                                            <Trash2 className="h-4 w-4 mr-1.5" />
                                            {isDeleteConfirming ? "Confirmer" : "Annuler"}
                                        </Button>
                                    )}

                                    {/* Hard delete button — only for admin on CANCELLED events */}
                                    {event.status === "CANCELLED" && onDelete && (isCreator || isAdmin) && (
                                        <Button
                                            size="sm"
                                            variant={isDeleteConfirming ? "destructive" : "ghost"}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isDeleteConfirming) {
                                                    handleDelete();
                                                } else {
                                                    setIsDeleteConfirming(true);
                                                    setTimeout(() => setIsDeleteConfirming(false), 3000);
                                                }
                                            }}
                                            disabled={isLoading}
                                            className={cn(
                                                "transition-all",
                                                isDeleteConfirming
                                                    ? "bg-red-600 hover:bg-red-700 text-white"
                                                    : "text-zinc-400 hover:text-red-400 hover:bg-red-950/20"
                                            )}
                                        >
                                            <Trash2 className="h-4 w-4 mr-1.5" />
                                            {isDeleteConfirming ? "Confirmer" : "Supprimer définitivement"}
                                        </Button>
                                    )}

                                    {/* Complete button — raids get a special flow */}
                                    {event.status === "PUBLISHED" && onComplete && (
                                        isRaid ? (
                                            <Button
                                                size="sm"
                                                onClick={initRaidCompletion}
                                                disabled={isLoading}
                                                className="bg-red-600/80 hover:bg-red-500 text-white shadow-sm border border-red-500/50"
                                            >
                                                <Trophy className="h-4 w-4 mr-1.5" />
                                                Clôturer le Raid
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                onClick={() => handleAction(onComplete)}
                                                disabled={isLoading}
                                                className="bg-blue-600/80 hover:bg-blue-500 text-white shadow-sm border border-blue-500/50"
                                            >
                                                <Check className="h-4 w-4 mr-1.5" />
                                                Terminer l'event
                                            </Button>
                                        )
                                    )}
                                    {event.status === "COMPLETED" && (
                                        <div className="flex items-center gap-2">
                                            {isRaid && onUndoComplete && (isCreator || canManage) && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleAction(onUndoComplete)}
                                                    disabled={isLoading}
                                                    className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                                >
                                                    <span className="mr-1.5">↩</span>
                                                    Annuler la clôture
                                                </Button>
                                            )}
                                            <Badge variant="secondary" className="bg-zinc-950/50 text-zinc-400 border-zinc-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider">
                                                {isRaid ? "Raid terminé" : "Event terminé"}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <ScrollArea className="flex-1 overflow-y-auto">
                        <div className="p-6 space-y-5">
                            {canManage && !isDiscordConfigured && !isExternal && (
                                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                                    <Bell className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-amber-200 uppercase tracking-wide">Discord non configuré</p>
                                        <p className="text-[10px] text-amber-400/80 leading-relaxed">
                                            Le salon Discord pour les événements n'est pas défini. Les notifications et la publication automatique sont désactivées.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <InfoCard
                                    icon={<Calendar className="h-4 w-4 text-amber-500" />}
                                    label="Date"
                                    value={format(new Date(event.startDate), "EEEE d MMMM", { locale: fr })}
                                />
                                <InfoCard
                                    icon={<Clock className="h-4 w-4 text-blue-400" />}
                                    label="Horaires"
                                    value={`${format(new Date(event.startDate), "HH:mm")} - ${format(new Date(event.endDate), "HH:mm")}`}
                                />
                                <InfoCard
                                    icon={<Users className="h-4 w-4 text-pink-400" />}
                                    label="Participants"
                                    value={
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-lg">{displayCount}</span>
                                            {event.maxParticipants && <span className="text-zinc-500 text-xs font-bold">/ {event.maxParticipants}</span>}
                                            {reserveCount > 0 && (
                                                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] font-black">
                                                    +{reserveCount} WAITING
                                                </Badge>
                                            )}
                                        </div>
                                    }
                                />
                                <InfoCard
                                    icon={<Crown className="h-4 w-4 text-yellow-500" />}
                                    label="Organisateur"
                                    value={
                                        (isDirectKralamoure || isImportedKralamoure) && metamobCreator ? (
                                            <span className="truncate font-black italic uppercase text-zinc-300 tracking-tight" title={metamobCreator}>
                                                {metamobCreator}
                                            </span>
                                        ) : event.creator ? (
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-5 w-5 border border-zinc-700">
                                                    <AvatarImage src={event.creator.image || undefined} />
                                                    <AvatarFallback className="text-[10px] bg-zinc-800">
                                                        {event.creator.name?.charAt(0) || "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="truncate font-bold text-zinc-300" title={event.creator.name || "Inconnu"}>
                                                    {event.creator.name || "Inconnu"}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-zinc-500">Inconnu</span>
                                        )
                                    }
                                />
                            </div>



                            {/* Description */}
                            {event.description && (
                                <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30">
                                    <p className="text-sm text-zinc-300 whitespace-pre-wrap">{event.description}</p>
                                </div>
                            )}

                            {/* ========== RAID INFO PANEL ========== */}
                            {isRaid && raidMeta && (
                                <div className="space-y-3 p-4 rounded-xl border border-red-500/20 bg-red-500/[0.04] animate-in fade-in duration-300">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Swords className="h-4 w-4 text-red-400" />
                                        <span className="text-xs font-black text-red-400 uppercase tracking-widest">Détails du Raid</span>
                                    </div>

                                    {/* Raid type + badges */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        {raidMeta.raidLabel && (
                                            <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-black uppercase tracking-wider">
                                                {raidMeta.raidLabel}
                                            </span>
                                        )}
                                        {raidMeta.openToExternal ? (
                                            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider">
                                                <Globe className="h-3 w-3" /> Ouvert aux extérieurs
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-500 text-[10px] font-black uppercase tracking-wider">
                                                <Lock className="h-3 w-3" /> Guilde uniquement
                                            </span>
                                        )}
                                    </div>

                                    {/* Captain */}
                                    {raidMeta.raidCaptain && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Crown className="h-4 w-4 text-yellow-500 shrink-0" />
                                            <span className="text-zinc-400 text-xs uppercase tracking-wider">Capitaine :</span>
                                            <span className="font-black text-yellow-300 uppercase tracking-tight">{raidMeta.raidCaptain}</span>
                                        </div>
                                    )}

                                    {/* Progress bar min/max */}
                                    {raidMeta.raidMin && raidMeta.raidMax && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-zinc-500 font-bold uppercase tracking-wider">Inscrits</span>
                                                <span className={cn(
                                                    "font-black",
                                                    registeredCount >= raidMeta.raidMin ? "text-emerald-400" : "text-amber-400"
                                                )}>
                                                    {registeredCount >= raidMeta.raidMin ? "✅ RAID GO" : `⏳ ${raidMeta.raidMin - registeredCount} manquant(s)`}
                                                </span>
                                            </div>
                                            <div className="relative h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                                                {/* Min threshold marker */}
                                                <div
                                                    className="absolute top-0 bottom-0 w-px bg-amber-400/50 z-10"
                                                    style={{ left: `${(raidMeta.raidMin / raidMeta.raidMax) * 100}%` }}
                                                />
                                                {/* Fill */}
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-700",
                                                        registeredCount >= raidMeta.raidMin
                                                            ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                                                            : "bg-gradient-to-r from-red-700 to-amber-500"
                                                    )}
                                                    style={{ width: `${Math.min(100, (registeredCount / raidMeta.raidMax) * 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[10px] text-zinc-600 font-bold">
                                                <span>0</span>
                                                <span className="text-amber-500/70">{raidMeta.raidMin} min</span>
                                                <span>{raidMeta.raidMax} max</span>
                                            </div>
                                            <div className="text-center">
                                                <span className="text-lg font-black text-white">{registeredCount}</span>
                                                <span className="text-zinc-500 text-xs font-bold"> / {raidMeta.raidMax} joueurs</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Mission Objectives Grid */}
                            {event.type === "SESSION_MISSIONS" && (selectedMissions.length > 0 || loadingMissions) && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Target className="h-4 w-4 text-amber-500" />
                                        <h3 className="text-xs font-black text-zinc-400 uppercase italic tracking-widest">Objectifs de la session</h3>
                                    </div>

                                    {loadingMissions ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {[1, 2].map(i => (
                                                <div key={i} className="aspect-[16/9] rounded-xl bg-zinc-800/50 animate-pulse border border-zinc-800" />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {selectedMissions.map((mission) => {
                                                const config = MISSION_CATEGORY_CONFIG[mission.category] || MISSION_CATEGORY_CONFIG.EVENT;
                                                const payload = mission.payload || {};
                                                let imageUrl = payload.imageUrl || payload.image || config.fallbackImage;
                                                
                                                if (mission.category === 'SONGES') {
                                                    const diff: string = (payload.difficulty || 'Reve').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                                                    const levelMap: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };
                                                    const lvl = levelMap[payload.level as string] || 1;
                                                    imageUrl = `/assets/missions/${diff}${lvl}.png`;
                                                }

                                                const mTitle = mission.title || payload.dungeonName || payload.monsterName || config.label;

                                                return (
                                                    <TooltipProvider key={mission.id}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Link 
                                                                    href={`/dashboard/${guildId}/missions`}
                                                                    className="group relative aspect-[16/9] rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950 shadow-lg block hover:border-amber-500/50 transition-all hover:scale-[1.02]"
                                                                >
                                                                    <Image 
                                                                        src={imageUrl} 
                                                                        alt={mTitle} 
                                                                        fill 
                                                                        className="object-contain p-2 opacity-60 group-hover:opacity-100 transition-opacity duration-500" 
                                                                        unoptimized
                                                                    />
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                                                                    
                                                                    {/* Category Icon */}
                                                                    <div className={cn(
                                                                        "absolute top-2 left-2 p-1 rounded bg-black/60 border border-white/10 backdrop-blur-md z-10",
                                                                        config.color
                                                                    )}>
                                                                        <config.icon className="h-2.5 w-2.5" />
                                                                    </div>

                                                                    <div className="absolute inset-x-0 bottom-0 p-2">
                                                                        <p className="text-[10px] font-black text-white uppercase tracking-tighter line-clamp-1 leading-none mb-1">
                                                                            {mTitle}
                                                                        </p>
                                                                        {payload.objectives && (
                                                                            <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest line-clamp-1">
                                                                                {payload.objectives}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </Link>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="bottom" className="bg-amber-500 text-zinc-950 font-black uppercase text-[10px] tracking-widest border-none">
                                                                Aller voir les missions ?
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            <Separator className="bg-zinc-800/50" />

                            {/* Roster */}
                            {(() => {
                                return (
                                    <div>
                                        <h3 className="text-sm font-black text-zinc-400 mb-4 flex items-center justify-between uppercase italic tracking-widest">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-pink-400" />
                                                Participants{isKrala ? " Metamob" : ""}
                                            </div>
                                            <span className="px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-400 text-xs font-black shadow-lg shadow-pink-500/10">
                                                {displayCount}
                                            </span>
                                        </h3>

                                        <div className="space-y-2">
                                            {/* Standard DB Participants */}
                                            {event.participants
                                                .filter(p => p.status === "REGISTERED")
                                                .sort((a, b) => a.position - b.position)
                                                .map((participant) => (
                                                        <ParticipantRow
                                                        key={participant.id}
                                                        participant={participant}
                                                        isCreator={participant.user.id === event.creator.id}
                                                        isCurrentUser={participant.user.id === currentUserId}
                                                        isRaid={isRaid}
                                                        onUnregister={!isExternal && onUnregister ? () => handleAction(onUnregister) : undefined}
                                                        onKick={(isRaid ? event.creator.id === currentUserId : (canManage || event.creator.id === currentUserId)) && participant.user.id !== event.creator.id
                                                             ? () => handleAction(async () => {
                                                                 const res = await kickParticipant(guildId, event.id, participant.user.id);
                                                                 if (res.success) {
                                                                     toast.success("Joueur exclu de l'événement.");
                                                                 } else {
                                                                     toast.error(res.error || "Erreur lors de l'expulsion");
                                                                 }
                                                             })
                                                             : undefined
                                                         }
                                                         onTransferCaptaincy={isRaid && isCreator && participant.user.id !== event.creator.id && participant.status === "REGISTERED"
                                                             ? async () => {
                                                                 const res = await transferRaidCaptaincy(guildId, event.id, participant.user.id);
                                                                 if (res.success) {
                                                                     toast.success("Capitanat transféré !");
                                                                 } else {
                                                                     toast.error(res.error || "Erreur");
                                                                 }
                                                             }
                                                             : undefined
                                                         }
                                                     />
                                                 ))}

                                             {/* Metamob Metadata Participants Fallback */}
                                            {isKrala && event.participants.length === 0 && (eventMetadata?.metamobParticipants || []).length > 0 && (
                                                (eventMetadata.metamobParticipants as any[]).map((p, i) => (
                                                    <div key={`meta-${i}`} className="group relative flex items-center justify-between p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/50 hover:bg-zinc-800/60 transition-all">
                                                        <div className="flex items-center gap-4 min-w-0">
                                                            <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-black text-zinc-500 shrink-0 group-hover:border-pink-500/30 group-hover:text-pink-400 transition-colors">
                                                                #{i + 1}
                                                            </div>
                                                            <Avatar className="h-10 w-10 border border-zinc-800 shadow-xl group-hover:scale-110 transition-transform">
                                                                <AvatarFallback className="bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-400 text-xs font-bold">
                                                                    {p.username?.[0] || "?"}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-sm font-black text-zinc-100 truncate group-hover:text-white transition-colors uppercase italic tracking-tight">
                                                                    {(p.username || "Anonyme").replace(/\s\(\d+\)$/, "")}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                                                                    {p.character_count || 1} { (p.character_count || 1) > 1 ? 'Personnages' : 'Personnage'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Badge variant="outline" className="text-[10px] font-black border-pink-500/20 text-pink-400 bg-pink-500/5">
                                                                METAMOB
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ))
                                            )}

                                            {reserveCount > 0 && (
                                                <>
                                                    <div className="text-xs text-amber-400 font-medium mt-4 mb-2 flex items-center gap-2">
                                                        <div className="h-px bg-zinc-800/50 flex-1" />
                                                        <Clock className="h-3 w-3" />
                                                        File d&apos;attente ({reserveCount})
                                                        <div className="h-px bg-zinc-800/50 flex-1" />
                                                    </div>
                                                    {event.participants
                                                        .filter(p => p.status === "RESERVE")
                                                        .sort((a, b) => a.position - b.position)
                                                        .map((participant) => (
                                                            <ParticipantRow
                                                                key={participant.id}
                                                                participant={participant}
                                                                isReserve
                                                                isCurrentUser={participant.user.id === currentUserId}
                                                                isRaid={isRaid}
                                                                onUnregister={onUnregister ? () => handleAction(onUnregister) : undefined}
                                                            onKick={(isRaid ? event.creator.id === currentUserId : (canManage || event.creator.id === currentUserId)) && participant.user.id !== event.creator.id
                                                                 ? () => handleAction(async () => {
                                                                     const res = await kickParticipant(guildId, event.id, participant.user.id);
                                                                     if (res.success) {
                                                                         toast.success("Joueur exclu de l'événement.");
                                                                     } else {
                                                                         toast.error(res.error || "Erreur lors de l'expulsion");
                                                                     }
                                                                 })
                                                                 : undefined
                                                             }
                                                            />
                                                        ))}
                                                </>
                                            )}

                                            {event.participants.length === 0 && (!isKrala || (eventMetadata?.metamobParticipants || []).length === 0) && (
                                                <div className="text-center py-12 rounded-xl border-2 border-dashed border-zinc-800/50 bg-zinc-900/20">
                                                    <User className="h-10 w-10 mx-auto mb-3 text-zinc-600 opacity-50" />
                                                    <p className="text-zinc-400 font-medium">
                                                        {isKrala 
                                                            ? "Détails des participants indisponibles" 
                                                            : "Aucun participant inscrit"
                                                        }
                                                    </p>
                                                    {isKrala && (
                                                        <p className="text-xs text-zinc-500 mt-2 px-6">
                                                            Les inscrits sur Metamob ne sont pas encore synchronisés ou nécessitent une clé API valide.
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </ScrollArea>



                    {/* Footer */}
                    <div className="px-6 py-4 bg-zinc-950/50 border-t border-zinc-800/50 space-y-3">
                        {/* User Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {(isDirectKralamoure || isImportedKralamoure) ? (
                                <div className="flex flex-col gap-3 w-full">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            asChild
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-500/20"
                                        >
                                            <a
                                                href="https://metamob.fr/kralove"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center w-full h-full px-4 py-2"
                                            >
                                                <ExternalLink className="h-4 w-4 mr-2" />
                                                S'inscrire sur Metamob
                                            </a>
                                        </Button>

                                        {!hasMetamobKey && (
                                                <Button
                                                    asChild
                                                    variant="outline"
                                                    className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500/50"
                                                >
                                                <a href={`/dashboard/${guildId}/profile`}>
                                                    Lier mon compte Metamob
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                    {!hasMetamobKey && (
                                        <p className="text-[11px] text-zinc-500 italic">
                                            Liez votre compte pour que SigilOS puisse synchroniser votre état de jeu.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {canRegister && (
                                        (() => {
                                            // Kamas gate: only for RAID_OFFICIAL events
                                            const isRaidOfficial = event.type === "RAID_OFFICIAL";
                                            const isBlocked = isRaidOfficial && raidEligibility !== null && raidEligibility !== undefined && !raidEligibility.isEligible;

                                            if (isBlocked) {
                                                const donated = raidEligibility!.totalDonated.toLocaleString("fr-FR");
                                                return (
                                                    <div className="flex flex-col gap-2 w-full">
                                                        <Button
                                                            size="lg"
                                                            disabled
                                                            className="h-12 rounded-xl font-black text-sm uppercase tracking-wider transition-all duration-300 shadow-inner relative group overflow-hidden border border-zinc-700/50 bg-zinc-800/50 text-zinc-500 cursor-not-allowed px-8"
                                                        >
                                                            <Lock className="h-4 w-4 mr-2.5" />
                                                            Inscription verrouillée
                                                        </Button>
                                                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-400">
                                                            <Coins className="h-4 w-4 shrink-0 mt-0.5" />
                                                            <div className="text-xs leading-relaxed">
                                                                <span className="font-black uppercase tracking-wide">Don requis : 30 000 kamas</span>
                                                                <br />
                                                                <span className="text-amber-400/70">
                                                                    Tu as donné <strong>{donated}</strong> kamas cette semaine. Complète ton don pour débloquer l'accès aux raids.
                                                                </span>
                                                                <br />
                                                                <Link
                                                                    href={`/dashboard/${guildId}/missions#don-kamas`}
                                                                    className="inline-flex items-center gap-1 mt-1.5 font-black text-amber-400 hover:text-amber-300 underline underline-offset-2"
                                                                >
                                                                    <Coins className="h-3 w-3" />
                                                                    Faire mon don maintenant
                                                                    <ExternalLink className="h-3 w-3" />
                                                                </Link>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <Button
                                                    size="lg"
                                                    onClick={() => setShowRegistration(true)}
                                                    disabled={isLoading}
                                                    className={cn(
                                                        "h-12 rounded-xl font-black text-sm uppercase tracking-wider transition-all duration-300 shadow-lg relative group overflow-hidden border-t border-white/10 px-8",
                                                        isFull
                                                            ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30 text-white"
                                                            : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30 text-white"
                                                    )}
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    {isFull ? <Users className="h-4 w-4 mr-2.5" /> : <Check className="h-4 w-4 mr-2.5" />}
                                                    {isFull ? "Rejoindre la file d'attente" : "S'inscrire à l'événement"}
                                                </Button>
                                            );
                                        })()
                                    )}

                                    {isRegistered && onUnregister && (
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            onClick={() => handleAction(onUnregister)}
                                            disabled={isLoading}
                                            className="h-12 rounded-xl font-bold text-sm border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all duration-300 px-6"
                                        >
                                            <X className="h-4 w-4 mr-2" />
                                            Se désinscrire
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Admin Actions — only Rappel Discord (creator or admin) */}
                        {canManage && !isExternal && (isCreator || isAdmin) && (
                            <div className="flex items-center justify-between gap-2 flex-wrap pt-4 mt-2 border-t border-zinc-800/30">
                                <div className="flex items-center gap-2 ml-auto">
                                    {event.status === "PUBLISHED" && onSendReminder && event.participants.length > 0 && isDiscordConfigured === true && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                disabled={isLoading}
                                                onClick={() => {
                                                    setDiscordDialogMode("REMINDER");
                                                    setDiscordDialogOpen(true);
                                                }}
                                                className="text-amber-400 hover:bg-amber-500/10 font-bold px-4"
                                            >
                                                <Bell className="h-4 w-4 mr-2" />
                                                Rappel Discord
                                            </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ========== RAID COMPLETION MODAL ========== */}
            {isRaid && showRaidCompletion && (
                <Dialog open={showRaidCompletion} onOpenChange={setShowRaidCompletion}>
                    <DialogContent className="w-[95vw] sm:max-w-lg bg-zinc-900/98 backdrop-blur-xl border border-white/10 ring-1 ring-red-500/25 p-0 overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                        <div className="relative p-6 border-b border-red-500/10 bg-red-500/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                    <Trophy className="h-5 w-5 text-red-400" />
                                </div>
                                <div>
                                    <DialogTitle className="text-white font-black uppercase tracking-tight">Clôturer le Raid</DialogTitle>
                                    <p className="text-[11px] text-zinc-500 uppercase tracking-wider">Distribution des points & score</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Score */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Star className="h-3.5 w-3.5 text-yellow-500" />
                                    Score du Raid
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 84 500 pts"
                                    value={raidScore}
                                    onChange={e => setRaidScore(e.target.value)}
                                    className="w-full h-11 px-4 rounded-xl bg-zinc-950/80 border border-zinc-700 text-zinc-100 font-black text-base placeholder:text-zinc-600 focus:outline-none focus:border-red-500/50"
                                />
                                <p className="text-[10px] text-zinc-600 italic">Score visible dans le module de raid en jeu.</p>
                            </div>

                            {/* Participants présents */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5 text-pink-400" />
                                        Présents au Raid
                                    </label>
                                    <span className="text-xs font-black text-zinc-500">
                                        {presentParticipants.size} / {event.participants.filter(p => p.status === "REGISTERED").length}
                                    </span>
                                </div>
                                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                    {event.participants
                                        .filter(p => p.status === "REGISTERED")
                                        .map(p => {
                                            const isPresent = presentParticipants.has(p.user.id);
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setPresentParticipants(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(p.user.id)) next.delete(p.user.id);
                                                            else next.add(p.user.id);
                                                            return next;
                                                        });
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left",
                                                        isPresent
                                                            ? "bg-emerald-500/10 border-emerald-500/30"
                                                            : "bg-zinc-900/50 border-zinc-800 opacity-50"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                                                        isPresent ? "bg-emerald-500 border-emerald-400" : "border-zinc-600"
                                                    )}>
                                                        {isPresent && <Check className="h-3 w-3 text-white" />}
                                                    </div>
                                                    <Avatar className="h-7 w-7 border border-zinc-700 shrink-0">
                                                        <AvatarImage src={p.user.image || undefined} />
                                                        <AvatarFallback className="bg-zinc-800 text-[10px]">{p.user.name?.[0] || "?"}</AvatarFallback>
                                                    </Avatar>
                                                    <span className={cn(
                                                        "text-sm font-black uppercase tracking-tight",
                                                        isPresent ? "text-zinc-100" : "text-zinc-600"
                                                    )}>
                                                        {p.user.profiles?.[0]?.discordNickname || p.user.name || "Anonyme"}
                                                    </span>
                                                    {isPresent && (
                                                        <span className="ml-auto text-[10px] font-black text-emerald-400 uppercase">+50 pts</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>

                            {/* Confirmation checkbox */}
                            <div className="flex items-start gap-3 p-3 rounded-xl border border-red-500/15 bg-red-500/5">
                                <input
                                    type="checkbox"
                                    id="confirm-raid-complete"
                                    checked={confirmRaidComplete}
                                    onChange={(e) => setConfirmRaidComplete(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-800 text-red-500 focus:ring-red-500/50"
                                />
                                <label htmlFor="confirm-raid-complete" className="text-xs text-zinc-400 leading-relaxed cursor-pointer">
                                    <span className="font-bold text-red-400">J'atteste</span> avoir coordonné la clôture avec mon équipe. Les <strong>{presentParticipants.size} participant{ presentParticipants.size > 1 ? "s" : "" } présent{ presentParticipants.size > 1 ? "s" : "" }</strong> sélectionné{ presentParticipants.size > 1 ? "s" : "" } verront leurs Kamas Violets déduits.
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="ghost"
                                    className="flex-1 border border-zinc-800 text-zinc-400"
                                    onClick={() => setShowRaidCompletion(false)}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    className="flex-1 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-black shadow-lg shadow-red-500/20"
                                    disabled={isCompletingRaid || !confirmRaidComplete}
                                    onClick={async () => {
                                        if (!onComplete) return;
                                        setIsCompletingRaid(true);
                                        try {
                                            // Pass raid completion data via the existing onComplete handler
                                            // The caller (calendar-dashboard) will handle the extended data
                                            (window as any).__raidCompletionData = {
                                                score: raidScore,
                                                presentUserIds: Array.from(presentParticipants)
                                            };
                                            await onComplete();
                                            setShowRaidCompletion(false);
                                        } finally {
                                            setIsCompletingRaid(false);
                                        }
                                    }}
                                >
                                    {isCompletingRaid ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Clôture...</>
                                    ) : (
                                        <><Trophy className="h-4 w-4 mr-2" />Valider & Distribuer</>  
                                    )}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            <RegistrationModal
                open={showRegistration}
                onOpenChange={setShowRegistration}
                eventTitle={event.title}
                isFull={isFull}
                onSubmit={handleRegistration}
            />

            <CalendarDiscordDialog
                isOpen={discordDialogOpen}
                onOpenChange={setDiscordDialogOpen}
                guildId={guildId}
                eventId={event.id}
                roles={discordRoles}
                everyoneAllowed={everyoneAllowed}
                mode={discordDialogMode}
                onConfirm={async (roleId) => {
                    if (discordDialogMode === "REMINDER" && onSendReminder) {
                        return await onSendReminder(roleId);
                    } else if (discordDialogMode === "SHARE" && onShareDiscord) {
                        return await onShareDiscord(roleId);
                    }
                    return { success: false, error: "Action non définie" };
                }}
            />
        </>
    );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 text-sm">
            <div className="h-9 w-9 rounded-lg bg-zinc-800/50 flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-zinc-500 text-xs">{label}</p>
                <div className="text-zinc-100 font-medium truncate">{value}</div>
            </div>
        </div>
    );
}

function ParticipantRow({
    participant,
    isCreator = false,
    isReserve = false,
    isCurrentUser = false,
    isRaid = false,
    onUnregister,
    onKick,
    onTransferCaptaincy
}: {
    participant: Participant;
    isCreator?: boolean;
    isReserve?: boolean;
    isCurrentUser?: boolean;
    isRaid?: boolean;
    onUnregister?: () => void;
    onKick?: () => void;
    onTransferCaptaincy?: () => Promise<void>;
}) {
    const [isConfirming, setIsConfirming] = useState(false);
    const [isKickConfirming, setIsKickConfirming] = useState(false);
    const [isTransferPending, setIsTransferPending] = useState(false);
    const [isTransferConfirming, setIsTransferConfirming] = useState(false);

    return (
        <div className={cn(
            "flex items-center justify-between p-2.5 rounded-lg transition-colors group",
            isReserve ? "bg-amber-500/5 border border-amber-500/10" : "bg-zinc-800/30 hover:bg-zinc-800/50"
        )}>
            <div className="flex items-center gap-3 min-w-0">
                <span className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    isReserve ? "bg-amber-500/20 text-amber-400" : "bg-zinc-700 text-zinc-300"
                )}>
                    {participant.position}
                </span>
                <Avatar className="h-8 w-8 border-2 border-zinc-700/50">
                    <AvatarImage src={participant.user.image || undefined} />
                    <AvatarFallback className="bg-zinc-700 text-zinc-300 text-xs">
                        {participant.user.name?.charAt(0) || "?"}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-medium truncate", isCurrentUser ? "text-indigo-400" : "text-zinc-200")}>
                            {(participant.user.profiles?.[0]?.discordNickname || participant.user.name || "Anonyme").replace(/\s\(\d+\)$/, "")}
                            {isCurrentUser && " (Moi)"}
                        </span>
                        {isCreator && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Crown className="h-3.5 w-3.5 text-amber-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>Organisateur</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        {participant.hasParticipatedThisWeek && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[9px] font-black uppercase py-0 px-1.5 shrink-0">
                                ⚠️ Déjà participé cette semaine
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {participant.classe && (
                            <div
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
                                style={{
                                    backgroundColor: `${getClassColor(participant.classe)}15`,
                                    color: getClassColor(participant.classe)
                                }}
                            >
                                <ClassIcon classId={participant.classe} size={16} showName />
                            </div>
                        )}
                        {participant.comment && (
                            <span className="text-[10px] text-zinc-500 italic truncate max-w-[100px]">
                                "{participant.comment}"
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1">
                {/* Unregister Button (visible only for current user) */}
                {isCurrentUser && onUnregister && (
                    <Button
                        size={isConfirming ? "sm" : "icon"}
                        variant={isConfirming ? "destructive" : "ghost"}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isConfirming) {
                                onUnregister();
                            } else {
                                setIsConfirming(true);
                                setTimeout(() => setIsConfirming(false), 3000); // Reset after 3s
                            }
                        }}
                        className={cn(
                            "shrink-0 transition-all",
                            isConfirming
                                ? "h-8 px-3 text-xs font-medium"
                                : "h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        )}
                        title="Se désinscrire"
                    >
                        {isConfirming ? (
                            <span className="flex items-center gap-1">
                                <X className="h-3 w-3" />
                                Confirmer
                             </span>
                        ) : (
                            <X className="h-4 w-4" />
                        )}
                    </Button>
                )}

                                                {/* Transfer Captaincy (visible only for raid creator on registered participants) */}
                                                {isRaid && !isCurrentUser && onTransferCaptaincy && (
                    <>
                        {isTransferConfirming && (
                            <span className="text-[10px] font-bold text-yellow-500/90 italic max-w-[180px] leading-tight inline-block align-middle">
                                Le capitanat passera à ce joueur — tu perdras les contrôles d'organisateur de ce raid.
                            </span>
                        )}
                        <Button
                            size="sm"
                            variant={isTransferConfirming ? "destructive" : "ghost"}
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (isTransferConfirming) {
                                    setIsTransferPending(true);
                                    await onTransferCaptaincy();
                                    setIsTransferPending(false);
                                    setIsTransferConfirming(false);
                                } else {
                                    setIsTransferConfirming(true);
                                    setTimeout(() => setIsTransferConfirming(false), 3000); // Reset after 3s
                                }
                            }}
                            disabled={isTransferPending}
                            className={cn(
                                "shrink-0 transition-all",
                                isTransferConfirming
                                    ? "h-8 px-3 text-xs font-medium bg-yellow-600 hover:bg-yellow-500 text-zinc-950"
                                    : "h-8 px-2 text-[10px] font-black uppercase tracking-wider text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10"
                            )}
                            title={
                                isTransferConfirming
                                    ? "Confirmer le transfert du capitanat à ce joueur"
                                    : "Donner le capitanat à ce joueur"
                            }
                        >
                            {isTransferPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isTransferConfirming ? (
                                <span className="flex items-center gap-1">
                                    <Crown className="h-3.5 w-3.5" />
                                    Confirmer ?
                                </span>
                            ) : (
                                <>
                                    <Crown className="h-3.5 w-3.5" />
                                    <span className="ml-1 hidden sm:inline">Donner le capitanat</span>
                                </>
                            )}
                        </Button>
                    </>
                )}

                {/* Kick Button (visible only for admin/creator on non-creator rows) */}
                {!isCurrentUser && onKick && (
                    <Button
                        size={isKickConfirming ? "sm" : "icon"}
                        variant={isKickConfirming ? "destructive" : "ghost"}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isKickConfirming) {
                                onKick();
                            } else {
                                setIsKickConfirming(true);
                                setTimeout(() => setIsKickConfirming(false), 3000); // Reset after 3s
                            }
                        }}
                        className={cn(
                            "shrink-0 transition-all",
                            isKickConfirming
                                ? "h-8 px-3 text-xs font-medium"
                                : "h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        )}
                        title="Exclure ce joueur"
                    >
                        {isKickConfirming ? (
                            <span className="flex items-center gap-1">
                                <Check className="h-3 w-3" />
                                Exclure ?
                            </span>
                        ) : (
                            <Trash2 className="h-4 w-4" />
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}
