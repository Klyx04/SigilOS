"use client";

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
    Edit,
    Target,
    Swords,
    PartyPopper,
    Wheat,
    Eye,
    Diamond
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

const TYPE_THEMES: Record<string, { label: string; color: string; bg: string; border: string; icon: any; gradient: string }> = {
    RAID_OFFICIAL: { label: "Raid 3.6", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: Swords, gradient: "from-red-600 to-rose-600" },
    EVENT_GUILD: { label: "Event Guilde", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: PartyPopper, gradient: "from-purple-600 to-fuchsia-600" },
    SESSION_MISSIONS: { label: "Missions Guilde", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Target, gradient: "from-amber-600 to-orange-600" },
    SORTIE_FARM: { label: "Sortie Farm", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: Wheat, gradient: "from-emerald-600 to-green-600" },
    KRALAMOURE: { label: "Kralamoure", color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20", icon: Eye, gradient: "from-pink-600 to-rose-600" },
    OTHERS: { label: "Autres", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", icon: Diamond, gradient: "from-slate-600 to-zinc-600" },
};

const EVENT_IMAGES: Record<string, string> = {
    "RAID_OFFICIAL": "/assets/calendar/calendar_raid_official.png",
    EVENT_GUILD: "/assets/calendar/calendar_event_guild.png",
    SESSION_MISSIONS: "/assets/calendar/calendar_session_missions.png",
    SORTIE_FARM: "/assets/calendar/calendar_boss_farm.png",
    KRALAMOURE: "/assets/calendar/calendar_kralamour.png",
    "GUILD_MISSION": "/assets/calendar/calendar_session_missions.png", // Fallback
    "SONGES_RUN": "/assets/calendar/calendar_songes_run.png",
    "DUNGEON_FARM": "/assets/calendar/calendar_dungeon_farm.png",
    "SOCIAL": "/assets/calendar/calendar_social.png",
    "ALMANAX_BONUS": "/assets/calendar/calendar_almanax_bonus.png",
    "OTHERS": "/assets/calendar/calendar_autres.png",
};

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

    const theme = TYPE_THEMES[event.type] || TYPE_THEMES.SESSION_MISSIONS;
    const Icon = theme.icon;

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
            <div className="group relative flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 transition-all hover:bg-zinc-900/60 hover:border-zinc-700 hover:shadow-lg hover:shadow-black/20">
                {/* Left Accent Bar */}
                <div className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-r-full opacity-60 group-hover:opacity-100 transition-opacity", theme.bg.replace("/10", "/80"))} />

                {/* Date Box */}
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/50 ml-2">
                    <span className="text-[10px] font-medium uppercase text-zinc-500">{format(startDate, "MMM", { locale: fr })}</span>
                    <span className="text-xl font-bold text-zinc-200">{format(startDate, "dd")}</span>
                </div>

                {/* Info Main */}
                <div className="mr-auto min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] font-medium border-0", theme.bg, theme.color)}>
                            <Icon className="mr-1 h-3 w-3" />
                            {theme.label}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <Clock className="h-3 w-3" />
                            <span>{format(startDate, "HH:mm")} - {format(validEndDate, "HH:mm")}</span>
                        </div>
                    </div>
                    <h3 className="truncate text-base font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">
                        {event.title}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                        <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-zinc-500" />
                            <span>{attendeeCount}{event.maxParticipants ? ` / ${event.maxParticipants}` : ""} participants</span>
                        </div>
                        {event.location && (
                            <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                                <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                                <span className="truncate">{event.location}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Attendees Avatars (Hidden on very small screens) */}
                <div className="hidden md:flex items-center -space-x-2 mr-4">
                    {event.attendees?.slice(0, 4).map((a: any) => (
                        <div key={a.id} className="h-8 w-8 rounded-full border-2 border-zinc-900 bg-zinc-800 overflow-hidden" title={a.user.name}>
                            {a.user.image ? (
                                <img src={a.user.image} alt={a.user.name} className="h-full w-full object-cover" />
                            ) : (
                                <div className="h-full w-full flex items-center justify-center text-[10px] text-zinc-400">{a.user.name?.[0]}</div>
                            )}
                        </div>
                    ))}
                    {attendeeCount > 4 && (
                        <div className="h-8 w-8 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
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
                            myAttendance?.status === "MAYBE" ? "bg-amber-500" : "bg-zinc-800"
                    )} title={myAttendance?.status ? "Inscrit" : "Non inscrit"} />
                </div>
            </div>
        );
    }

    // View: Card (Vertical) - Modernized

    return (
        <Card className="h-full flex flex-col group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border-zinc-800/50 bg-zinc-900/40 hover:bg-zinc-900/60 hover:border-zinc-700/50">
            {/* Top Image Background */}
            <div className="absolute top-0 left-0 right-0 h-32 overflow-hidden opacity-40 mask-image-gradient">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900/90 z-10" />
                <img
                    src={EVENT_IMAGES[event.type] || EVENT_IMAGES["EVENT_GUILD"]}
                    alt="Event type"
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 transform group-hover:scale-105"
                />
            </div>

            {/* Top Accent Line */}
            <div className={cn("h-1.5 w-full bg-gradient-to-r opacity-90 relative z-20", theme.gradient)} />

            <CardHeader className="p-5 flex-none space-y-4 pb-2">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("rounded-md px-2.5 py-1 text-sm font-semibold border-opacity-50 transition-colors", theme.bg, theme.color, theme.border)}>
                            <Icon className="w-4 h-4 mr-2" />
                            {theme.label}
                        </Badge>

                        {/* Completed Event Badge */}
                        {event.status === "COMPLETED" && (
                            <Badge className="bg-zinc-700/50 text-zinc-300 border-zinc-600 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">
                                Terminé
                            </Badge>
                        )}
                    </div>

                    {/* Attendance Status Indicator */}
                    {myAttendance && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className={cn(
                                        "h-3 w-3 rounded-full ring-2 ring-zinc-950 shadow-lg",
                                        myAttendance.status === "REGISTERED" && "bg-green-500 shadow-green-500/50",
                                        myAttendance.status === "MAYBE" && "bg-amber-500 shadow-amber-500/50",
                                        myAttendance.status === "DECLINED" && "bg-red-500 shadow-red-500/50"
                                    )} />
                                </TooltipTrigger>
                                <TooltipContent className="bg-zinc-950 border-zinc-800 text-sm">
                                    <p>{myAttendance.status === "REGISTERED" ? "Vous participez" : myAttendance.status === "MAYBE" ? "Peut-être" : "Vous ne venez pas"}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>

                <div className="space-y-1">
                    <CardTitle className="text-xl font-bold text-zinc-100 leading-tight group-hover:text-white transition-colors line-clamp-2 min-h-[1.75rem] break-all">
                        {event.title}
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="p-5 pt-2 flex-1 space-y-5">
                {/* Info Grid */}
                <div className="space-y-3">
                    <div className="flex items-center text-base text-zinc-400 group-hover:text-zinc-300 transition-colors">
                        <Calendar className="w-5 h-5 mr-3 text-zinc-500 shrink-0" />
                        <span className="capitalize font-medium">
                            {format(startDate, "EEEE d MMMM", { locale: fr })}
                        </span>
                    </div>
                    <div className="flex items-center text-base text-zinc-400 group-hover:text-zinc-300 transition-colors">
                        <Clock className="w-5 h-5 mr-3 text-zinc-500 shrink-0" />
                        <span>
                            {format(startDate, "HH:mm")} - {format(validEndDate, "HH:mm")}
                        </span>
                    </div>
                    {event.location && (
                        <div className="flex items-center text-base text-zinc-400 group-hover:text-zinc-300 transition-colors">
                            <MapPin className="w-5 h-5 mr-3 text-zinc-500 shrink-0" />
                            <span className="truncate">{event.location}</span>
                        </div>
                    )}
                </div>

                <Separator className="bg-zinc-800/50" />

                {/* Creator */}
                {event.creator && (
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 ring-1 ring-zinc-800">
                            <AvatarImage src={event.creator.image} />
                            <AvatarFallback className="text-xs bg-zinc-800 text-zinc-400">
                                {event.creator.name?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Organisé par</span>
                            <span className={cn("text-sm font-medium transition-colors", theme.color)}>{displayCreatorName}</span>
                        </div>
                    </div>
                )}
            </CardContent>

            <CardFooter className="p-5 pt-0 mt-auto">
                <div className="w-full flex flex-col gap-2 p-3 rounded-lg bg-zinc-950/30 border border-zinc-800/30 transition-colors hover:bg-zinc-950/50">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Participants</span>
                        <div className="flex items-center text-xs font-medium text-zinc-500">
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
                                        <Avatar className="h-6 w-6 border border-zinc-700/50 shadow-sm relative z-0">
                                            {!isKralamoure && a.user?.image && <AvatarImage src={a.user.image} />}
                                            <AvatarFallback className="text-[9px] bg-zinc-800 text-zinc-400">
                                                {participantInitial}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm text-zinc-300 font-medium truncate">
                                            {participantName}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <span className="text-sm text-zinc-600 italic">Aucun participant</span>
                        )}

                        {attendeesGoing.length > 3 && (
                            <div className="pl-9 text-xs text-zinc-500 font-medium">
                                +{attendeesGoing.length - 3} autres...
                            </div>
                        )}
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}
