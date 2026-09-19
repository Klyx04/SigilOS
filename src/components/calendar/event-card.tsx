"use client";

import { getDisplayName } from "@/lib/display-name";
import { resolveEventImagePath } from "@/lib/calendar-event-images";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
    Users,
    MapPin,
    Calendar,
    Clock,
    CheckCircle2,
    HelpCircle,
    XCircle,
    Trash2,
    Edit
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { DofusUiIcon } from "@/components/shared/dofus-ui-icon";
import { calendarEventTheme } from "@/lib/calendar-event-theme";
import { cn } from "@/lib/utils";

// Local type definitions
type AttendeeStatus = "GOING" | "MAYBE" | "DECLINED";

interface EventCardProps {
    event: any; // Using any for now to handle Prisma includes
    currentUserId: string;
    onRespond: (status: AttendeeStatus) => void;
    onEdit?: () => void;
    onDelete?: () => void;
    canManage: boolean;
}

// Identité des types d'événement (libellé, couleur, picto Dofus) :
// `@/lib/calendar-event-theme` — source unique, plus de table locale.

// Les visuels d'événement (dont les deux raids) viennent de
// `src/lib/calendar-event-images.ts` — même source que les embeds Discord.

export function EventCard({
    event,
    currentUserId,
    onRespond,
    onEdit,
    onDelete,
    canManage,
    variant = "card"
}: EventCardProps & { variant?: "card" | "list" }) {
    const startDate = event.startDate ? new Date(event.startDate) : null;
    const endDate = event.endDate ? new Date(event.endDate) : (startDate || new Date());
    
    if (!startDate || isNaN(startDate.getTime())) return null;
    const validEndDate = (endDate && !isNaN(new Date(endDate).getTime())) ? new Date(endDate) : startDate;

    const theme = calendarEventTheme(event.type);

    const myAttendance = event.participants?.find((a: any) => a.userId === currentUserId);
    const attendeeCount = event.participants?.length || 0;

    // Extract Metamob creator for Kralamoure events
    const isKralamoure = event.type === "KRALAMOURE";
    const eventMetadata = (event as any).metadata as any;
    const displayCreatorName = isKralamoure && eventMetadata?.metamobCreator
        ? eventMetadata.metamobCreator
        : event.creator?.name || "Inconnu";

    // For Kralamoure events, use Metamob participants from metadata
    // For other events, filter by REGISTERED status
    const metamobParticipants = isKralamoure && eventMetadata?.metamobParticipants
        ? eventMetadata.metamobParticipants
        : [];

    const attendeesGoing = isKralamoure
        ? metamobParticipants
        : (event.participants?.filter((a: any) => a.status === "REGISTERED") || []);

    // Override attendee count for Kralamoure events using metadata count if available
    const displayAttendeeCount = isKralamoure 
        ? (eventMetadata?.metamobParticipantsCount || attendeesGoing.length) 
        : (event.participants?.length || 0);

    // View: List (Horizontal Row)
    if (variant === "list") {
        return (
            <div className="group relative flex items-center gap-4 rounded-xl border border-border bg-surface/40 p-3 transition-all hover:bg-surface/60 hover:border-border hover:shadow-lg hover:shadow-black/20">
                {/* Left Accent Bar */}
                <div className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-r-full opacity-60 group-hover:opacity-100 transition-opacity", theme.bg.replace("/10", "/80"))} />

                {/* Date Box */}
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-background/50 ml-2">
                    <span className="text-caption font-medium uppercase text-muted-foreground">{format(startDate, "MMM", { locale: fr })}</span>
                    <span className="text-xl font-bold text-foreground">{format(startDate, "dd")}</span>
                </div>

                {/* Info Main */}
                <div className="mr-auto min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("h-5 px-1.5 text-caption font-medium border-0", theme.bg, theme.color)}>
                            {isKralamoure ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src="/assets/calendar/kralamoure-head.png" alt="Kralamoure" className="mr-1 h-3.5 w-3.5 object-contain inline-block" />
                            ) : (
                                <DofusUiIcon name={theme.picto} size={14} className="mr-1" />
                            )}
                            {theme.label}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{format(startDate, "HH:mm")} - {format(validEndDate, "HH:mm")}</span>
                        </div>
                    </div>
                    <h3 className="text-base font-bold text-foreground group-hover:text-warning transition-colors line-clamp-2 leading-tight">
                        {event.title}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{attendeeCount}{event.maxParticipants ? ` / ${event.maxParticipants}` : ""} participants</span>
                        </div>
                        {event.location && (
                            <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="truncate">{event.location}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Attendees Avatars (Hidden on very small screens) */}
                <div className="hidden md:flex items-center -space-x-2 mr-4">
                    {event.attendees?.slice(0, 4).map((a: any) => {
                        const attendeeName = getDisplayName(a.user.profiles?.[0]) || a.user.name || "?";
                        return (
                            <div key={a.id} className="h-8 w-8 rounded-full border-2 border-border bg-elevated overflow-hidden" title={attendeeName}>
                                {a.user.image ? (
                                    <img src={a.user.image} alt={attendeeName} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-caption text-muted-foreground">{attendeeName?.[0]}</div>
                                )}
                            </div>
                        );
                    })}
                    {attendeeCount > 4 && (
                        <div className="h-8 w-8 rounded-full border-2 border-border bg-elevated flex items-center justify-center text-caption font-bold text-muted-foreground">
                            +{attendeeCount - 4}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    {/* Can manage actions would go here (hidden in list usually, handled by parent) */}
                    <div className={cn(
                        "h-2 w-2 rounded-full",
                        myAttendance?.status === "GOING" ? "bg-green-500" :
                            myAttendance?.status === "MAYBE" ? "bg-warning" : "bg-elevated"
                    )} title={myAttendance?.status ? "Inscrit" : "Non inscrit"} />
                </div>
            </div>
        );
    }

    // View: Card (Vertical) - Modernized

    const isCompleted = event.status === "COMPLETED" || (Boolean(event.endDate) && new Date(event.endDate).getTime() < Date.now());

    return (
        <Card className={cn(
            "h-full flex flex-col group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border-border/50 bg-surface/40 hover:bg-surface/60 hover:border-border/50",
            isCompleted && "opacity-80"
        )}>
            {/* Top Image Background */}
            <div className="absolute top-0 left-0 right-0 h-32 overflow-hidden opacity-40 mask-image-gradient">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface/90 z-10" />
                <img
                    src={resolveEventImagePath(event.type, event.metadata)}
                    alt="Event type"
                    className={cn(
                        "w-full h-full object-cover transition-all duration-300 transform group-",
                        isCompleted ? "grayscale" : "grayscale group-hover:grayscale-0"
                    )}
                />
            </div>

            {/* Top Accent Line — aplat de la couleur du type (jamais un dégradé) */}
            <div className={cn("h-1.5 w-full opacity-90 relative z-20", theme.dot)} />

            {/* Completed watermark stamp overlay */}
            {isCompleted && (
                <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                    <div className="rotate-[-15deg] flex flex-col items-center px-6 py-3 border-2 border-success/40 rounded-xl bg-success/10 backdrop-blur-[2px] ">
                        <CheckCircle2 className="h-8 w-8 text-success/80" />
                        <span className="mt-1 text-sm font-black uppercase tracking-widest text-success/90">
                            Terminé
                        </span>
                    </div>
                </div>
            )}

            <CardHeader className="p-5 flex-none space-y-4 pb-2">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("rounded-md px-2.5 py-1 text-sm font-semibold border-opacity-50 transition-colors", theme.bg, theme.color, theme.border)}>
                            {isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                            ) : isKralamoure ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src="/assets/calendar/kralamoure-head.png" alt="Kralamoure" className="w-4 h-4 mr-2 object-contain inline-block" />
                            ) : (
                                <DofusUiIcon name={theme.picto} size={16} className="mr-2" />
                            )}
                            {theme.label}
                        </Badge>

                        {/* Completed Event Badge */}
                        {isCompleted && (
                            <Badge className="bg-success/15 text-success border-success/30 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">
                                ✓ Terminé
                            </Badge>
                        )}
                    </div>

                    {/* Attendance Status Indicator */}
                    {myAttendance && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className={cn(
                                        "h-3 w-3 rounded-full ring-2 ring-border shadow-lg",
                                        myAttendance.status === "REGISTERED" && "bg-green-500 shadow-green-500/50",
                                        myAttendance.status === "MAYBE" && "bg-warning shadow-amber-500/50",
                                        myAttendance.status === "DECLINED" && "bg-danger shadow-red-500/50"
                                    )} />
                                </TooltipTrigger>
                                <TooltipContent className="bg-background border-border text-sm">
                                    <p>{myAttendance.status === "REGISTERED" ? "Vous participez" : myAttendance.status === "MAYBE" ? "Peut-être" : "Vous ne venez pas"}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>

                <div className="space-y-1">
                    <CardTitle className="text-xl font-bold text-foreground leading-tight group-hover:text-foreground transition-colors line-clamp-2 min-h-[1.75rem] break-words">
                        {event.title}
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="p-5 pt-2 flex-1 space-y-5">
                {/* Info Grid */}
                <div className="space-y-3">
                    <div className="flex items-center text-base text-muted-foreground group-hover:text-foreground transition-colors">
                        <Calendar className="w-5 h-5 mr-3 text-muted-foreground shrink-0" />
                        <span className="capitalize font-medium">
                            {format(startDate, "EEEE d MMMM", { locale: fr })}
                        </span>
                    </div>
                    <div className="flex items-center text-base text-muted-foreground group-hover:text-foreground transition-colors">
                        <Clock className="w-5 h-5 mr-3 text-muted-foreground shrink-0" />
                        <span>
                            {format(startDate, "HH:mm")} - {format(validEndDate, "HH:mm")}
                        </span>
                    </div>
                    {event.location && (
                        <div className="flex items-center text-base text-muted-foreground group-hover:text-foreground transition-colors">
                            <MapPin className="w-5 h-5 mr-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{event.location}</span>
                        </div>
                    )}
                </div>

                <Separator className="bg-elevated/50" />

                {/* Creator */}
                {event.creator && (
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 ring-1 ring-border">
                            <AvatarImage src={event.creator.image} />
                            <AvatarFallback className="text-xs bg-elevated text-muted-foreground">
                                {event.creator.name?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="text-caption text-muted-foreground uppercase tracking-wider font-semibold">Organisé par</span>
                            <span className={cn("text-sm font-medium transition-colors", theme.color)}>{displayCreatorName}</span>
                        </div>
                    </div>
                )}
            </CardContent>

            <CardFooter className="p-5 pt-0 mt-auto">
                <div className="w-full flex flex-col gap-2 p-3 rounded-lg bg-background/30 border border-border/30 transition-colors hover:bg-background/50">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-caption font-semibold text-muted-foreground uppercase tracking-wider">Participants</span>
                        <div className="flex items-center text-xs font-medium text-muted-foreground">
                            <Users className="w-3 h-3 mr-1.5" />
                            {displayAttendeeCount}
                            {event.maxParticipants && <span className="mx-0.5 opacity-50">/</span>}
                            {event.maxParticipants && <span>{event.maxParticipants}</span>}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        {attendeesGoing.length > 0 ? (
                            attendeesGoing.slice(0, 3).map((a: any, idx: number) => {
                                // For Kralamoure events, participants are objects { username, character_count } or strings
                                // For other events, participants have user objects
                                const participantName = isKralamoure
                                    ? (typeof a === 'string' ? a : a.username || a.name || 'Inconnu')
                                    : (a.user?.profiles?.[0]?.discordNickname || a.user?.name || 'Inconnu');
                                const participantInitial = participantName?.[0]?.toUpperCase() || '?';

                                return (
                                    <div key={isKralamoure ? `${idx}-${participantName}` : a.id} className="flex items-center gap-2.5">
                                        <Avatar className="h-6 w-6 border border-border/50 shadow-sm relative z-0">
                                            {!isKralamoure && a.user?.image && <AvatarImage src={a.user.image} />}
                                            <AvatarFallback className="text-caption bg-elevated text-muted-foreground">
                                                {participantInitial}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm text-foreground font-medium truncate">
                                            {participantName}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <span className="text-sm text-muted-foreground italic">Aucun participant</span>
                        )}

                        {attendeesGoing.length > 3 && (
                            <div className="pl-9 text-xs text-muted-foreground font-medium">
                                +{attendeesGoing.length - 3} autres...
                            </div>
                        )}
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}
