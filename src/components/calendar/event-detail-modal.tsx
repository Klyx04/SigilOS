"use client";

/**
 * EventDetailModal V3 - 4 Types + Native ClassIcon
 */

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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
    ExternalLink
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
        icon: Crown,
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

// ============================================
// INTERFACES
// ============================================

interface Participant {
    id: string;
    status: string;
    position: number;
    classe?: string | null;
    comment?: string | null;
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
    discordRoles?: DiscordRole[];
    onRegister?: (data: { classe?: string; comment?: string }) => Promise<void>;
    onUnregister?: () => Promise<void>;
    onEdit?: () => void;
    onDelete?: () => Promise<void>;
    onPublish?: () => Promise<void>;
    onComplete?: () => Promise<void>;
    onSendReminder?: (roleId?: string) => Promise<{ success: boolean; sentCount?: number; discordSent?: boolean; error?: string }>;
    onShareDiscord?: (roleId?: string) => Promise<{ success: boolean; error?: string }>;
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
    discordRoles = [],
    onRegister,
    onUnregister,
    onEdit,
    onDelete,
    onPublish,
    onComplete,
    onSendReminder,
    onShareDiscord
}: EventDetailModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [showRegistration, setShowRegistration] = useState(false);
    // Discord dialog state
    const [discordDialogOpen, setDiscordDialogOpen] = useState(false);
    const [discordDialogMode, setDiscordDialogMode] = useState<"REMINDER" | "SHARE">("SHARE");

    // Delete confirmation state
    const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);

    if (!event) return null;

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
    const eventMetadata = (event as any).metadata as any;
    const metamobCreator = (isDirectKralamoure || isImportedKralamoure)
        ? (eventMetadata?.metamobCreator || event.creator.name)
        : null;

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



    const TypeIcon = typeConfig.icon;

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    draggable
                    className="w-[95vw] sm:max-w-2xl bg-zinc-900/95 backdrop-blur-xl border-zinc-800 p-0 overflow-hidden max-h-[90vh] flex flex-col"
                >
                    {/* Header */}
                    <div className={cn("relative px-8 py-8 border-b border-zinc-800/50 overflow-hidden", typeConfig.bgColor)}>
                        <div className={cn("absolute inset-0 opacity-40 bg-gradient-to-br", typeConfig.gradient)} />

                        <div className="relative flex justify-between items-start z-10 w-full pr-8">
                            <div className="flex gap-5">
                                <div className={cn(
                                    "p-3.5 rounded-2xl shadow-inner shrink-0",
                                    "bg-black/20 text-white backdrop-blur-sm border border-white/10"
                                )}>
                                    <TypeIcon className="w-7 h-7" />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className={cn("text-xs font-black uppercase tracking-wider", typeConfig.color, "border-current/30 bg-current/5 px-2.5 py-0.5")}>
                                            {typeConfig.label}
                                        </Badge>
                                        <Badge className={cn("text-xs font-black uppercase tracking-wider px-2.5 py-0.5", statusConfig.bg)}>
                                            {statusConfig.label}
                                        </Badge>
                                    </div>
                                    <DialogHeader>
                                        <DialogTitle className="text-3xl font-black tracking-tight text-white uppercase italic">
                                            {event.title}
                                        </DialogTitle>
                                    </DialogHeader>
                                </div>
                            </div>

                            {/* Move Complete Button Here */}
                            {canManage && (
                                <div className="flex items-center gap-2 ml-4">
                                    {/* Delete button for imported Kralamoure events */}
                                    {isImportedKralamoure && onDelete && (
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
                                            {isDeleteConfirming ? "Confirmer" : "Supprimer"}
                                        </Button>
                                    )}

                                    {event.status === "PUBLISHED" && onComplete && (
                                        <Button
                                            size="sm"
                                            onClick={() => handleAction(onComplete)}
                                            disabled={isLoading}
                                            className="bg-blue-600/80 hover:bg-blue-500 text-white shadow-sm border border-blue-500/50"
                                        >
                                            <Check className="h-4 w-4 mr-1.5" />
                                            Terminer l'event
                                        </Button>
                                    )}
                                    {event.status === "COMPLETED" && (
                                        <Badge variant="secondary" className="bg-zinc-950/50 text-zinc-400 border-zinc-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider">
                                            Event terminé
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
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
                                icon={<Users className="h-4 w-4 text-purple-400" />}
                                label="Participants"
                                value={
                                    <span>
                                        {(isDirectKralamoure || isImportedKralamoure)
                                            ? (eventMetadata?.metamobParticipants?.length || 0)
                                            : registeredCount}
                                        {event.maxParticipants && <span className="text-zinc-500"> / {event.maxParticipants}</span>}
                                        {reserveCount > 0 && <span className="text-amber-400 ml-2">+{reserveCount}</span>}
                                    </span>
                                }
                            />
                            <InfoCard
                                icon={<Crown className="h-4 w-4 text-yellow-500" />}
                                label="Organisé par"
                                value={
                                    (isDirectKralamoure || isImportedKralamoure) && metamobCreator ? (
                                        <div className="flex items-center gap-2">
                                            <span className="truncate max-w-[120px]" title={metamobCreator}>
                                                {metamobCreator}
                                            </span>
                                        </div>
                                    ) : event.creator ? (
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-5 w-5 border border-zinc-700">
                                                <AvatarImage src={event.creator.image || undefined} />
                                                <AvatarFallback className="text-[10px] bg-zinc-800">
                                                    {event.creator.name?.charAt(0) || "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="truncate max-w-[120px]" title={event.creator.name || "Inconnu"}>
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

                        <Separator className="bg-zinc-800/50" />

                        {/* Roster */}
                        <div>
                            {(isDirectKralamoure || isImportedKralamoure) ? (() => {
                                const metamobParticipants = eventMetadata?.metamobParticipants || [];
                                return (
                                    <>
                                        <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            Participants Metamob ({metamobParticipants.length})
                                        </h3>
                                        <ScrollArea className="h-48">
                                            <div className="space-y-2">
                                                {metamobParticipants.length > 0 ? metamobParticipants.map((p: any, idx: number) => {
                                                    const name = typeof p === "string" ? p : (p.username || p.name || "Inconnu");
                                                    return (
                                                        <div key={`${idx}-${name}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors">
                                                            <Avatar className="h-8 w-8 border-2 border-zinc-700/50">
                                                                <AvatarFallback className="bg-pink-500/10 text-pink-400 text-xs font-bold">
                                                                    {name.charAt(0).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-sm font-medium text-zinc-200">{name}</span>
                                                        </div>
                                                    );
                                                }) : (
                                                    <div className="text-center py-8 text-zinc-500 text-sm">
                                                        <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                        Aucun participant sur Metamob
                                                    </div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </>
                                );
                            })() : (
                                <>
                                    <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Participants ({registeredCount})
                                    </h3>

                                    <ScrollArea className="h-48">
                                        <div className="space-y-2">
                                            {event.participants
                                                .filter(p => p.status === "REGISTERED")
                                                .sort((a, b) => a.position - b.position)
                                                .map((participant) => (
                                                    <ParticipantRow
                                                        key={participant.id}
                                                        participant={participant}
                                                        isCreator={participant.user.id === event.creator.id}
                                                        isCurrentUser={participant.user.id === currentUserId}
                                                        onUnregister={onUnregister ? () => handleAction(onUnregister) : undefined}
                                                    />
                                                ))}

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
                                                                onUnregister={onUnregister ? () => handleAction(onUnregister) : undefined}
                                                            />
                                                        ))}
                                                </>
                                            )}

                                            {event.participants.length === 0 && (
                                                <div className="text-center py-8 text-zinc-500 text-sm">
                                                    <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                    Aucun participant
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </>
                            )}
                        </div>
                    </div>



                    {/* Footer */}
                    <div className="px-6 py-4 bg-zinc-950/50 border-t border-zinc-800/50 space-y-3">
                        {/* User Actions */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {(isDirectKralamoure || isImportedKralamoure) ? (
                                <Button
                                    asChild
                                    className="bg-pink-600 hover:bg-pink-500 text-white font-bold shadow-lg shadow-pink-500/20"
                                >
                                    <a
                                        href="https://metamob.fr/kralove"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center w-full h-full px-4 py-2" // Added w-full h-full and padding here
                                    >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        S'inscrire sur Metamob
                                    </a>
                                </Button>
                            ) : (
                                <>
                                    {canRegister && (
                                        <Button
                                            size="lg"
                                            onClick={() => setShowRegistration(true)}
                                            disabled={isLoading}
                                            className={cn(
                                                "h-14 rounded-2xl font-black text-base uppercase tracking-[0.1em] transition-all duration-500 shadow-xl relative group overflow-hidden border-t border-white/10 px-8",
                                                isFull
                                                    ? "bg-amber-600 hover:bg-amber-500 shadow-amber-600/30 text-white"
                                                    : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30 text-white"
                                            )}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            {isFull ? <Users className="h-5 w-5 mr-3" /> : <Check className="h-5 w-5 mr-3" />}
                                            {isFull ? "Rejoindre la file d'attente" : "S'inscrire à l'événement"}
                                        </Button>
                                    )}

                                    {isRegistered && onUnregister && (
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            onClick={() => handleAction(onUnregister)}
                                            disabled={isLoading}
                                            className="h-14 rounded-2xl font-black text-base uppercase tracking-[0.1em] border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all duration-300 px-8"
                                        >
                                            <X className="h-5 w-5 mr-3" />
                                            Se désinscrire
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Admin Actions */}
                        {canManage && !isExternal && (
                            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-zinc-800/30">
                                {onDelete && (
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
                                            "mr-auto transition-all",
                                            isDeleteConfirming
                                                ? "bg-red-600 hover:bg-red-700 text-white px-4"
                                                : "text-zinc-500 hover:text-red-400 hover:bg-red-950/20"
                                        )}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        {isDeleteConfirming ? "Confirmer la suppression" : "Supprimer l'event"}
                                    </Button>
                                )}

                                {event.status === "DRAFT" && onPublish && (
                                    <Button
                                        size="sm"
                                        onClick={() => handleAction(onPublish)}
                                        disabled={isLoading}
                                        className="bg-green-600 hover:bg-green-500"
                                    >
                                        Publier
                                    </Button>
                                )}

                                {event.status === "PUBLISHED" && onSendReminder && event.participants.length > 0 && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={isLoading}
                                        onClick={() => {
                                            setDiscordDialogMode("REMINDER");
                                            setDiscordDialogOpen(true);
                                        }}
                                        className="text-amber-400 hover:bg-amber-500/10 rounded-full font-bold px-4"
                                    >
                                        <Bell className="h-4 w-4 mr-2" />
                                        Rappel
                                    </Button>
                                )}

                                {event.status === "PUBLISHED" && onShareDiscord && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={isLoading}
                                        onClick={() => {
                                            setDiscordDialogMode("SHARE");
                                            setDiscordDialogOpen(true);
                                        }}
                                        className="text-indigo-400 hover:bg-indigo-500/10 rounded-full font-bold px-4"
                                    >
                                        <Share2 className="h-4 w-4 mr-2" />
                                        Annonce Discord
                                    </Button>
                                )}

                                {onEdit && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={onEdit}
                                        className="text-zinc-400 hover:text-zinc-100"
                                    >
                                        <Edit className="h-4 w-4 mr-1" />
                                        Éditer
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

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
    onUnregister
}: {
    participant: Participant;
    isCreator?: boolean;
    isReserve?: boolean;
    isCurrentUser?: boolean;
    onUnregister?: () => void;
}) {
    const [isConfirming, setIsConfirming] = useState(false);

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
                            {participant.user.profiles?.[0]?.discordNickname || participant.user.name || "Anonyme"}
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
        </div>
    );
}
