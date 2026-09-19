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
    Clock,
    Users,
    User,
    Crown,
    Trash2,
    Edit,
    Check,
    X,
    Loader2,
    Target,
    Bell,
    ExternalLink,
    Lock,
    Trophy,
    Coins,
    Undo2,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
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
import { DofusUiIcon, type DofusUiIconName } from "@/components/shared/dofus-ui-icon";
import { resolveEventImagePath } from "@/lib/calendar-event-images";
import { calendarEventTheme } from "@/lib/calendar-event-theme";
import { PseudoChip } from "@/components/shared/pseudo-chip";
import { RegistrationModal } from "./registration-modal";
import { CalendarDiscordDialog } from "./calendar-discord-dialog";
import { getMissionsByIds } from "@/server/actions/mission-actions";
import { kickParticipant, transferRaidCaptaincy } from "@/server/actions/calendar-actions";


// ============================================
// 4 EVENT TYPES
// ============================================

/**
 * Type d'événement → libellé, couleur, picto : **source unique**
 * `@/lib/calendar-event-theme` (plus de table locale — les six composants du
 * calendrier partageaient la même recopie, avec chacune son icône lucide).
 */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: "Brouillon", color: "text-muted-foreground", bg: "bg-muted" },
    PUBLISHED: { label: "Ouvert", color: "text-success", bg: "bg-success" },
    COMPLETED: { label: "Terminé", color: "text-info", bg: "bg-info" },
    CANCELLED: { label: "Annulé", color: "text-danger", bg: "bg-danger" }
};

const MISSION_CATEGORY_CONFIG: Record<string, { picto: DofusUiIconName; color: string; fallbackImage: string; label: string }> = {
    DONJON: {
        picto: "dungeon",
        color: "text-danger",
        fallbackImage: "/banners/donjon.png",
        label: "Donjon"
    },
    REGULATION: {
        picto: "skull",
        color: "text-success",
        fallbackImage: "/banners/regulation.png",
        label: "Régulation"
    },
    ANOMALIE: {
        picto: "monster",
        color: "text-warning",
        fallbackImage: "/assets/missions/ano1.png",
        label: "Anomalie"
    },
    SONGES: {
        picto: "hourglass",
        color: "text-info",
        fallbackImage: "/assets/missions/songes.png",
        label: "Songes"
    },
    EXPEDITION: {
        picto: "treasure",
        color: "text-success",
        fallbackImage: "/banners/expedition.png",
        label: "Expédition"
    },
    EVENT: {
        picto: "trophy",
        color: "text-warning",
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
    createdAt?: Date | string | null;
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

interface DiscordChannels {
    calendarNotifyChannelId?: string | null;
    raidNotifyChannelId?: string | null;
    raidGigalodonNotifyChannelId?: string | null;
    raidSanctuaireNotifyChannelId?: string | null;
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
    discordChannels?: DiscordChannels;
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
    discordChannels,
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

    // Raids are fully independent from the calendar channel — never fall back to it.
    const hasDiscordForType = isRaid
        ? (raidMeta?.raidType === "gigalodon"
            ? !!(discordChannels?.raidGigalodonNotifyChannelId || discordChannels?.raidNotifyChannelId)
            : !!(discordChannels?.raidSanctuaireNotifyChannelId || discordChannels?.raidNotifyChannelId))
        : !!discordChannels?.calendarNotifyChannelId;

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

    const isCompleted = event.status === "COMPLETED" || (Boolean(event.endDate) && new Date(event.endDate).getTime() < Date.now());
    const effectiveStatus = isCompleted ? "COMPLETED" : event.status;
    const typeConfig = calendarEventTheme(event.type);
    const statusConfig = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.DRAFT;

    const registeredCount = event.participants.filter(p => p.status === "REGISTERED").length;
    const reserveCount = event.participants.filter(p => p.status === "RESERVE").length;
    const isUserRegistered = event.participants.some(p => p.user.id === currentUserId && p.status !== "DECLINED");
    const userParticipant = event.participants.find(p => p.user.id === currentUserId);

    // Distinguish between direct Metamob events (krala-{id}) and imported events
    const isDirectKralamoure = event.id.startsWith("krala-");
    const isImportedKralamoure = event.type === "KRALAMOURE" && !isDirectKralamoure;
    const isExternal = isDirectKralamoure; // Only direct Kralamoure events are truly external

    const isOpen = effectiveStatus === "PUBLISHED";
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

    // #179 — la copie des pseudos est UNITAIRE (voir `PseudoChip` dans `ParticipantRow`) :
    // plus de bouton global qui collait toute la liste `\n/w Pseudo`.

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



    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    draggable
                    className="w-[95vw] sm:max-w-2xl bg-surface border border-border p-0 overflow-hidden max-h-[90vh] flex flex-col fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                    {/* Header — aplat de la couleur du type (aucun dégradé, aucun blur).
                        ⚠️ Responsive : la rangée d'actions PASSE À LA LIGNE sous le titre sur
                        mobile (elle ne peut ni rétrécir ni déborder à droite). */}
                    <div className={cn("relative px-4 pt-10 pb-6 border-b border-border/50 sm:px-8 sm:pt-12 sm:pb-8", typeConfig.bg, typeConfig.border)}>

                        {/* Decorative Kralamoure Insert (Top Right) */}
                        {event.type === "KRALAMOURE" && (
                            <div className="absolute right-0 top-0 w-32 h-full opacity-60 pointer-events-none overflow-hidden select-none">
                                <div className="absolute top-1/2 -translate-y-1/2 right-4 h-20 w-16 overflow-hidden rounded-[4px] border border-border bg-elevated p-1">
                                    <Image
                                        src="/game-data/dungeons/antre-du-kralamoure-g-ant.webp"
                                        alt="Kralamoure"
                                        fill
                                        className="object-cover rounded-[3px]"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="relative z-10 flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                            <div className="flex min-w-0 gap-4">
                                {/* Vrai visuel de l'événement : même source que l'embed Discord et
                                    les cartes du dashboard (`resolveEventImagePath`). Pour un raid,
                                    l'illustration 3:4 est affichée ENTIÈRE (jamais rognée). */}
                                <div
                                    className={cn(
                                        "h-16 shrink-0 overflow-hidden rounded-[4px] border border-border bg-elevated",
                                        isRaid ? "w-12" : "w-16"
                                    )}
                                >
                                    {event.type === "KRALAMOURE" ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src="/assets/calendar/kralamoure-head.png" alt="Kralamoure" className="h-full w-full object-contain p-1.5" />
                                    ) : isRaid ? (
                                        <Image
                                            src={resolveEventImagePath(event.type, eventMetadata)}
                                            alt=""
                                            width={48}
                                            height={64}
                                            className="h-16 w-12 object-contain"
                                        />
                                    ) : (
                                        <Image
                                            src={resolveEventImagePath(event.type, eventMetadata)}
                                            alt=""
                                            width={64}
                                            height={64}
                                            className="h-16 w-16 object-cover"
                                        />
                                    )}
                                </div>

                                <div className="min-w-0 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={cn("text-caption font-black uppercase tracking-wider", typeConfig.color, "border-current/30 bg-current/5 px-2 py-0")}>
                                            {typeConfig.label}
                                        </Badge>
                                        <Badge className={cn("text-caption font-black uppercase tracking-wider px-2 py-0", statusConfig.bg)}>
                                            {statusConfig.label}
                                        </Badge>
                                    </div>
                                    <DialogHeader>
                                        <DialogTitle className={cn(
                                            "font-black tracking-tight text-foreground uppercase leading-tight break-words",
                                            event.title.length > 40 ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
                                        )}>
                                            {event.title}
                                        </DialogTitle>
                                    </DialogHeader>
                                </div>
                            </div>

                            {/* Actions — repliées sous le titre sur mobile, alignées à droite
                                sur desktop (jamais de débordement horizontal). */}
                            {canManage && (
                                <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                                    {/* Edit button — only creator or admin, disabled for Kralamoure */}
                                    {onEdit && event.type !== "KRALAMOURE" && (isCreator || isAdmin) && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={onEdit}
                                            className="text-muted-foreground hover:text-foreground hover:bg-surface"
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
                                                    ? "bg-danger hover:bg-danger text-danger-foreground"
                                                    : "text-muted-foreground hover:text-danger hover:bg-danger/20"
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
                                                    ? "bg-danger hover:bg-danger text-danger-foreground"
                                                    : "text-muted-foreground hover:text-danger hover:bg-danger/20"
                                            )}
                                        >
                                            <Trash2 className="h-4 w-4 mr-1.5" />
                                            {isDeleteConfirming ? "Confirmer" : "Supprimer définitivement"}
                                        </Button>
                                    )}

                                    {/* Complete button — raids get a special flow.
                                        ⚠️ Events **Kralamoure** : la clôture vit sur
                                        Metamob (l'event n'est pas « à nous ») ⇒ aucun
                                        bouton « Terminer l'event » ici (décision user
                                        18/09/2026). Les events Discord classiques et
                                        les Raids gardent leur flux habituel. */}
                                    {effectiveStatus === "PUBLISHED" && onComplete && !isKrala && (
                                        isRaid ? (
                                            <Button
                                                size="sm"
                                                onClick={initRaidCompletion}
                                                disabled={isLoading}
                                                className="bg-danger text-danger-foreground hover:bg-danger/90"
                                            >
                                                <Trophy className="h-4 w-4 mr-1.5" />
                                                Clôturer le Raid
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                onClick={() => handleAction(onComplete)}
                                                disabled={isLoading}
                                                className="bg-info text-info-foreground hover:bg-info/90"
                                            >
                                                <Check className="h-4 w-4 mr-1.5" />
                                                Terminer l'event
                                            </Button>
                                        )
                                    )}
                                    {effectiveStatus === "COMPLETED" && (
                                        <div className="flex items-center gap-2">
                                            {isRaid && onUndoComplete && (isCreator || canManage) && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleAction(onUndoComplete)}
                                                    disabled={isLoading}
                                                    className="text-success hover:text-success hover:bg-success/10"
                                                >
                                                    <Undo2 className="h-4 w-4 mr-1.5" />
                                                    Annuler la clôture
                                                </Button>
                                            )}
                                            <Badge variant="secondary" className="bg-background/50 text-muted-foreground border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider">
                                                {isRaid ? "Raid terminé" : "Event terminé"}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <ScrollArea className="flex-1 overflow-y-auto">
                        <div className="p-4 space-y-4 sm:p-6 sm:space-y-5">
                            {canManage && !hasDiscordForType && !isExternal && (
                                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-3">
                                    <Bell className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-warning uppercase tracking-wide">Discord non configuré</p>
                                        <p className="text-caption text-warning/80 leading-relaxed">
                                            Le salon Discord pour les événements n'est pas défini. Les notifications et la publication automatique sont désactivées.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                                <InfoCard
                                    icon={<DofusUiIcon name="calendar" size={18} />}
                                    label="Date"
                                    value={format(new Date(event.startDate), "EEEE d MMMM", { locale: fr })}
                                />
                                <InfoCard
                                    icon={<DofusUiIcon name="date" size={18} />}
                                    label="Horaires"
                                    value={`${format(new Date(event.startDate), "HH:mm")} - ${format(new Date(event.endDate), "HH:mm")}`}
                                />
                                <InfoCard
                                    icon={<DofusUiIcon name="player" size={18} />}
                                    label="Participants"
                                    value={
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-lg">{displayCount}</span>
                                            {event.maxParticipants && <span className="text-muted-foreground text-xs font-bold">/ {event.maxParticipants}</span>}
                                            {reserveCount > 0 && (
                                                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-caption font-black normal-case gap-1">
                                                    <DofusUiIcon name="hourglass" size={12} />
                                                    {reserveCount} en attente
                                                </Badge>
                                            )}
                                        </div>
                                    }
                                />
                                <InfoCard
                                    icon={<DofusUiIcon name="leader" size={18} />}
                                    label="Organisateur"
                                    value={
                                        (isDirectKralamoure || isImportedKralamoure) && metamobCreator ? (
                                            <span className="truncate font-black text-foreground tracking-tight" title={metamobCreator}>
                                                {metamobCreator}
                                            </span>
                                        ) : event.creator ? (
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-5 w-5 border border-border">
                                                    <AvatarImage src={event.creator.image || undefined} />
                                                    <AvatarFallback className="text-caption bg-elevated">
                                                        {event.creator.name?.charAt(0) || "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="truncate font-bold text-foreground" title={event.creator.name || "Inconnu"}>
                                                    {event.creator.name || "Inconnu"}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground">Inconnu</span>
                                        )
                                    }
                                />
                            </div>



                            {/* Description */}
                            {event.description && (
                                <div className="p-3 rounded-lg bg-elevated/30 border border-border/30">
                                    <p className="text-sm text-foreground whitespace-pre-wrap">{event.description}</p>
                                </div>
                            )}

                            {/* ========== RAID INFO PANEL ========== */}
                            {isRaid && raidMeta && (
                                <div className="space-y-3 rounded-lg border border-danger/25 bg-danger/[0.05] p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <DofusUiIcon name="dungeon" size={16} />
                                        <span className="text-xs font-black text-danger uppercase tracking-wider">Détails du Raid</span>
                                    </div>

                                    {/* Raid type + badges */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        {raidMeta.raidLabel && (
                                            <span className="px-2.5 py-1 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs font-black uppercase tracking-wider">
                                                {raidMeta.raidLabel}
                                            </span>
                                        )}
                                        {raidMeta.openToExternal ? (
                                            <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-success/10 border border-success/20 text-success text-caption font-bold uppercase tracking-wider">
                                                <DofusUiIcon name="world" size={12} /> Ouvert aux extérieurs
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-elevated border border-border text-muted-foreground text-caption font-bold uppercase tracking-wider">
                                                <DofusUiIcon name="guild" size={12} /> Guilde uniquement
                                            </span>
                                        )}
                                    </div>

                                    {/* Captain */}
                                    {raidMeta.raidCaptain && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <DofusUiIcon name="leader" size={16} />
                                            <span className="text-muted-foreground text-xs uppercase tracking-wider">Capitaine :</span>
                                            <span className="font-black text-warning tracking-tight">{raidMeta.raidCaptain}</span>
                                        </div>
                                    )}

                                    {/* Progress bar min/max */}
                                    {raidMeta.raidMin && raidMeta.raidMax && (
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground font-bold uppercase tracking-wider">Inscrits</span>
                                                <span className={cn(
                                                    "flex items-center gap-1.5 font-bold",
                                                    registeredCount >= raidMeta.raidMin ? "text-success" : "text-warning"
                                                )}>
                                                    <DofusUiIcon name={registeredCount >= raidMeta.raidMin ? "success" : "hourglass"} size={14} />
                                                    {registeredCount >= raidMeta.raidMin
                                                        ? "Raid go"
                                                        : `${raidMeta.raidMin - registeredCount} manquant(s)`}
                                                </span>
                                            </div>
                                            <div className="relative h-2.5 rounded-full bg-elevated overflow-hidden">
                                                {/* Min threshold marker */}
                                                <div
                                                    className="absolute top-0 bottom-0 w-px bg-warning/60 z-10"
                                                    style={{ left: `${(raidMeta.raidMin / raidMeta.raidMax) * 100}%` }}
                                                />
                                                {/* Fill */}
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-300",
                                                        registeredCount >= raidMeta.raidMin ? "bg-success" : "bg-danger"
                                                    )}
                                                    style={{ width: `${Math.min(100, (registeredCount / raidMeta.raidMax) * 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-caption text-muted-foreground font-bold">
                                                <span>0</span>
                                                <span className="text-warning/70">{raidMeta.raidMin} min</span>
                                                <span>{raidMeta.raidMax} max</span>
                                            </div>
                                            <div className="text-center">
                                                <span className="text-lg font-black text-foreground">{registeredCount}</span>
                                                <span className="text-muted-foreground text-xs font-bold"> / {raidMeta.raidMax} joueurs</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Mission Objectives Grid */}
                            {event.type === "SESSION_MISSIONS" && (selectedMissions.length > 0 || loadingMissions) && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Target className="h-4 w-4 text-warning" />
                                        <h3 className="text-xs font-black text-muted-foreground uppercase italic tracking-widest">Objectifs de la session</h3>
                                    </div>

                                    {loadingMissions ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {[1, 2].map(i => (
                                                <div key={i} className="aspect-[16/9] rounded-xl bg-elevated/50 animate-pulse border border-border" />
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
                                                                    className="group relative aspect-[16/9] rounded-xl border border-border overflow-hidden bg-background shadow-lg block hover:border-warning/50 transition-all hover:scale-[1.02]"
                                                                >
                                                                    <Image
                                                                        src={imageUrl}
                                                                        alt={mTitle}
                                                                        fill
                                                                        className="object-contain p-2 opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                                                                        unoptimized
                                                                    />
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                                                                    {/* Picto de catégorie (Dofus) */}
                                                                    <div className="absolute top-2 left-2 z-10 flex h-6 w-6 items-center justify-center rounded-[3px] border border-border bg-black/60">
                                                                        <DofusUiIcon name={config.picto} size={14} />
                                                                    </div>

                                                                    <div className="absolute inset-x-0 bottom-0 p-2">
                                                                        <p className="text-caption font-black text-foreground uppercase tracking-tighter line-clamp-1 leading-none mb-1">
                                                                            {mTitle}
                                                                        </p>
                                                                        {payload.objectives && (
                                                                            <p className="text-caption font-bold text-muted-foreground uppercase tracking-widest line-clamp-1">
                                                                                {payload.objectives}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </Link>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="bottom" className="bg-warning text-warning-foreground font-black uppercase text-caption tracking-widest border-none">
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

                            <Separator className="bg-elevated/50" />

                            {/* Roster */}
                            {(() => {
                                return (
                                    <div>
                                        <h3 className="text-sm font-black text-muted-foreground mb-4 flex items-center justify-between uppercase tracking-wider">
                                            <div className="flex items-center gap-2">
                                                <DofusUiIcon name="player" size={15} />
                                                Participants{isKrala ? " Metamob" : ""}
                                            </div>
                                            <span className="px-2 py-0.5 rounded-md border border-border bg-surface/50 text-xs font-black text-foreground">
                                                {displayCount}
                                            </span>
                                        </h3>

                                        <div className="space-y-2">
                                            {/* Standard DB Participants */}
                                            {event.participants
                                                .filter(p => p.status === "REGISTERED")
                                                .sort((a, b) => a.position - b.position)
                                                .map((participant) => (
                                                        /* 🚫 Events Kralamoure : les inscrits viennent de Metamob (aucun
                                                           `UserProfile` en base) ⇒ `kickParticipant` ne peut qu'échouer
                                                           (« PARTICIPANT INTROUVABLE »). On ne propose donc plus l'action
                                                           (décision user du 18/09/2026) : le désistement se fait sur Metamob. */
                                                        <ParticipantRow
                                                        key={participant.id}
                                                        participant={participant}
                                                        isCreator={participant.user.id === event.creator.id}
                                                        isCurrentUser={participant.user.id === currentUserId}
                                                        isRaid={isRaid}
                                                        onUnregister={!isExternal && onUnregister ? () => handleAction(onUnregister) : undefined}
                                                        onKick={!isKrala && (isRaid ? event.creator.id === currentUserId : (canManage || event.creator.id === currentUserId)) && participant.user.id !== event.creator.id
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
                                                    <div key={`meta-${i}`} className="group relative flex items-center justify-between p-3 rounded-xl bg-surface/40 border border-border/50 hover:bg-elevated/60 transition-all">
                                                        <div className="flex items-center gap-4 min-w-0">
                                                            <div className="h-8 w-8 rounded-full bg-elevated border border-border flex items-center justify-center text-caption font-black text-muted-foreground shrink-0 group-hover:border-pink-500/30 group-hover:text-pink-400 transition-colors">
                                                                #{i + 1}
                                                            </div>
                                                            <Avatar className="h-10 w-10 border border-border shadow-xl group- transition-transform">
                                                                <AvatarFallback className="bg-gradient-to-br from-elevated to-surface text-muted-foreground text-xs font-bold">
                                                                    {p.username?.[0] || "?"}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-sm font-black text-foreground truncate group-hover:text-foreground transition-colors uppercase italic tracking-tight">
                                                                    {(p.username || "Anonyme").replace(/\s\(\d+\)$/, "")}
                                                                </span>
                                                                <span className="text-caption font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                                                    {p.character_count || 1} { (p.character_count || 1) > 1 ? 'Personnages' : 'Personnage'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Badge variant="outline" className="text-caption font-black border-pink-500/20 text-pink-400 bg-pink-500/5">
                                                                METAMOB
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                ))
                                            )}

                                            {reserveCount > 0 && (
                                                <>
                                                    <div className="text-xs text-warning font-medium mt-4 mb-2 flex items-center gap-2">
                                                        <div className="h-px bg-elevated/50 flex-1" />
                                                        <Clock className="h-3 w-3" />
                                                        File d&apos;attente ({reserveCount})
                                                        <div className="h-px bg-elevated/50 flex-1" />
                                                    </div>
                                                    {event.participants
                                                        .filter(p => p.status === "RESERVE")
                                                        .sort((a, b) => a.position - b.position)
                                                        .map((participant) => (
                                                            /* 🚫 Même règle MetaMob que la liste principale : pas
                                                               d'expulsion possible sur un event Kralamoure. */
                                                            <ParticipantRow
                                                                key={participant.id}
                                                                participant={participant}
                                                                isReserve
                                                                isCurrentUser={participant.user.id === currentUserId}
                                                                isRaid={isRaid}
                                                                onUnregister={onUnregister ? () => handleAction(onUnregister) : undefined}
                                                            onKick={!isKrala && (isRaid ? event.creator.id === currentUserId : (canManage || event.creator.id === currentUserId)) && participant.user.id !== event.creator.id
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
                                                <div className="text-center py-12 rounded-xl border-2 border-dashed border-border/50 bg-surface/20">
                                                    <User className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                                                    <p className="text-muted-foreground font-medium">
                                                        {isKrala
                                                            ? "Détails des participants indisponibles"
                                                            : "Aucun participant inscrit"
                                                        }
                                                    </p>
                                                    {isKrala && (
                                                        <p className="text-xs text-muted-foreground mt-2 px-6">
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
                    <div className="px-6 py-4 bg-background/50 border-t border-border/50 space-y-3">
                        {/* User Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {(isDirectKralamoure || isImportedKralamoure) ? (
                                <div className="flex flex-col gap-3 w-full">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            asChild
                                            className="bg-info hover:bg-info text-info-foreground font-bold shadow-lg shadow-indigo-500/20"
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
                                                    className="border-info/30 text-info hover:bg-info/10 hover:border-info/50"
                                                >
                                                <a href={`/dashboard/${guildId}/profile`}>
                                                    Lier mon compte Metamob
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                    {!hasMetamobKey && (
                                        <p className="text-caption text-muted-foreground italic">
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
                                                            className="h-12 rounded-xl font-black text-sm uppercase tracking-wider transition-all duration-300 shadow-inner relative group overflow-hidden border border-border/50 bg-elevated/50 text-muted-foreground cursor-not-allowed px-8"
                                                        >
                                                            <Lock className="h-4 w-4 mr-2.5" />
                                                            Inscription verrouillée
                                                        </Button>
                                                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-warning/5 border border-warning/20 text-warning">
                                                            <Coins className="h-4 w-4 shrink-0 mt-0.5" />
                                                            <div className="text-xs leading-relaxed">
                                                                <span className="font-black uppercase tracking-wide">Don requis : 30 000 kamas</span>
                                                                <br />
                                                                <span className="text-warning/70">
                                                                    Tu as donné <strong>{donated}</strong> kamas cette semaine. Complète ton don pour débloquer l'accès aux raids.
                                                                </span>
                                                                <br />
                                                                <Link
                                                                    href={`/dashboard/${guildId}/missions#don-kamas`}
                                                                    className="inline-flex items-center gap-1 mt-1.5 font-black text-warning hover:text-warning underline underline-offset-2"
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
                                                        "h-12 rounded-xl font-black text-sm uppercase tracking-wider transition-all duration-300 shadow-lg relative group overflow-hidden border-t border-border px-8",
                                                        isFull
                                                            ? "bg-warning hover:bg-warning shadow-amber-600/30 text-warning-foreground"
                                                            : "bg-info hover:bg-info shadow-indigo-600/30 text-info-foreground"
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
                                            className="h-12 rounded-xl font-bold text-sm border-border bg-elevated/50 text-muted-foreground hover:bg-danger/10 hover:text-danger hover:border-danger/30 transition-all duration-300 px-6"
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
                            <div className="flex items-center justify-between gap-2 flex-wrap pt-4 mt-2 border-t border-border/30">
                                <div className="flex items-center gap-2 ml-auto">
                                    {event.status === "PUBLISHED" && onSendReminder && event.participants.length > 0 && hasDiscordForType && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                disabled={isLoading}
                                                onClick={() => {
                                                    setDiscordDialogMode("REMINDER");
                                                    setDiscordDialogOpen(true);
                                                }}
                                                className="text-warning hover:bg-warning/10 font-bold px-4"
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
                    <DialogContent className="w-[95vw] sm:max-w-lg bg-surface border border-danger/25 p-0 overflow-hidden">
                        <div className="relative p-6 border-b border-danger/10 bg-danger/5">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-[4px] border border-danger/20 bg-danger/10">
                                    <DofusUiIcon name="trophy" size={20} />
                                </div>
                                <div>
                                    <DialogTitle className="text-foreground font-black uppercase tracking-tight">Clôturer le Raid</DialogTitle>
                                    <p className="text-caption text-muted-foreground uppercase tracking-wider">Distribution des points & score</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Score */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <DofusUiIcon name="success" size={14} />
                                    Score du Raid
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: 84 500 pts"
                                    value={raidScore}
                                    onChange={e => setRaidScore(e.target.value)}
                                    className="w-full h-11 px-4 rounded-xl bg-background/80 border border-border text-foreground font-black text-base placeholder:text-muted-foreground focus:outline-none focus:border-danger/50"
                                />
                                <p className="text-caption text-muted-foreground">Score visible dans le module de raid en jeu.</p>
                            </div>

                            {/* Participants présents */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                        <Users className="h-3.5 w-3.5 text-pink-400" />
                                        Présents au Raid
                                    </label>
                                    <span className="text-xs font-black text-muted-foreground">
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
                                                            ? "bg-success/10 border-success/30"
                                                            : "bg-surface/50 border-border opacity-50"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                                                        isPresent ? "bg-success border-success" : "border-border"
                                                    )}>
                                                        {isPresent && <Check className="h-3 w-3 text-foreground" />}
                                                    </div>
                                                    <Avatar className="h-7 w-7 border border-border shrink-0">
                                                        <AvatarImage src={p.user.image || undefined} />
                                                        <AvatarFallback className="bg-elevated text-caption">{p.user.name?.[0] || "?"}</AvatarFallback>
                                                    </Avatar>
                                                    <span className={cn(
                                                        "text-sm font-black uppercase tracking-tight",
                                                        isPresent ? "text-foreground" : "text-muted-foreground"
                                                    )}>
                                                        {p.user.profiles?.[0]?.discordNickname || p.user.name || "Anonyme"}
                                                    </span>
                                                    {isPresent && (
                                                        <span className="ml-auto text-caption font-black text-success uppercase">+50 pts</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>

                            {/* Confirmation checkbox */}
                            <div className="flex items-start gap-3 p-3 rounded-xl border border-danger/15 bg-danger/5">
                                <input
                                    type="checkbox"
                                    id="confirm-raid-complete"
                                    checked={confirmRaidComplete}
                                    onChange={(e) => setConfirmRaidComplete(e.target.checked)}
                                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-border bg-elevated text-danger focus:ring-danger/50"
                                />
                                <label htmlFor="confirm-raid-complete" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                                    <span className="font-bold text-danger">J'atteste</span> avoir coordonné la clôture avec mon équipe. Les <strong>{presentParticipants.size} participant{ presentParticipants.size > 1 ? "s" : "" } présent{ presentParticipants.size > 1 ? "s" : "" }</strong> sélectionné{ presentParticipants.size > 1 ? "s" : "" } verront leurs Kamas Violets déduits.
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="ghost"
                                    className="flex-1 border border-border text-muted-foreground"
                                    onClick={() => setShowRaidCompletion(false)}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    className="flex-1 bg-danger text-danger-foreground hover:bg-danger/90 font-bold"
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
            <div className="h-9 w-9 rounded-lg bg-elevated/50 flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-muted-foreground text-xs">{label}</p>
                <div className="text-foreground font-medium truncate">{value}</div>
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
            isReserve ? "bg-warning/5 border border-warning/10" : "bg-elevated/30 hover:bg-elevated/50"
        )}>
            <div className="flex items-center gap-3 min-w-0">
                <span className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                    isReserve ? "bg-warning/20 text-warning" : "bg-muted text-foreground"
                )}>
                    {participant.position}
                </span>
                <Avatar className="h-8 w-8 border-2 border-border/50">
                    <AvatarImage src={participant.user.image || undefined} />
                    <AvatarFallback className="bg-muted text-foreground text-xs">
                        {participant.user.name?.charAt(0) || "?"}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <PseudoChip
                            pseudo={(participant.user.profiles?.[0]?.discordNickname || participant.user.name || "Anonyme").replace(/\s\(\d+\)$/, "")}
                            classe={participant.classe}
                            className="text-sm font-medium text-foreground"
                        />
                        {isCurrentUser && <span className="text-caption font-bold text-muted-foreground shrink-0">(Moi)</span>}
                        {isCreator && (
                            <span title="Organisateur" className="shrink-0">
                                <DofusUiIcon name="leader" size={14} />
                            </span>
                        )}
                        {participant.hasParticipatedThisWeek && (
                            <Badge variant="outline" className="border-border bg-surface/50 text-muted-foreground text-caption font-black uppercase py-0 px-1.5 shrink-0">
                                Déjà participé cette semaine
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {participant.createdAt && (
                            <span className="text-caption text-muted-foreground/60" title={new Date(participant.createdAt).toLocaleString("fr-FR")}>
                                {format(new Date(participant.createdAt), "d MMM à HH:mm", { locale: fr })}
                            </span>
                        )}
                        {participant.comment && (
                            <span className="text-caption text-muted-foreground truncate max-w-[100px]">
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
                                : "h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger/10"
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
                            <span className="text-caption font-bold text-warning/90 max-w-[180px] leading-tight inline-block align-middle">
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
                                    ? "h-8 px-3 text-xs font-medium bg-warning hover:bg-warning text-warning-foreground"
                                    : "h-8 px-2 text-caption font-black uppercase tracking-wider text-warning hover:text-warning hover:bg-warning/10"
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
                                : "h-8 w-8 text-muted-foreground hover:text-danger hover:bg-danger/10"
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
