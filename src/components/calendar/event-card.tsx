"use client";

import { GuildEvent, User, AttendeeStatus, CalendarEventType } from "@prisma/client";
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface EventCardProps {
    event: any; // Using any for now to handle Prisma includes
    currentUserId: string;
    onRespond: (status: AttendeeStatus) => void;
    onEdit?: () => void;
    onDelete?: () => void;
    canManage: boolean;
}

const TYPE_COLORS: Record<string, string> = {
    GUILD_MISSION: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    SONGES_RUN: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    DUNGEON_FARM: "bg-red-500/10 text-red-400 border-red-500/20",
    SOCIAL: "bg-green-500/10 text-green-400 border-green-500/20",
    OFFICIAL_RESET: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const TYPE_LABELS: Record<string, string> = {
    GUILD_MISSION: "Mission de Guilde",
    SONGES_RUN: "Run Songes",
    DUNGEON_FARM: "Farm Donjon",
    SOCIAL: "Social / Évent",
    OFFICIAL_RESET: "Reset Hebdo",
};

export function EventCard({
    event,
    currentUserId,
    onRespond,
    onEdit,
    onDelete,
    canManage
}: EventCardProps) {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);

    // Find current user's attendance
    const myAttendance = event.attendees?.find((a: any) => a.userId === currentUserId);
    const attendeeCount = event._count?.attendees || 0;

    return (
        <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all group overflow-hidden">
            <div className={cn(
                "h-1 w-full",
                event.type === "GUILD_MISSION" ? "bg-purple-500" :
                    event.type === "SONGES_RUN" ? "bg-blue-500" :
                        event.type === "DUNGEON_FARM" ? "bg-red-500" :
                            event.type === "SOCIAL" ? "bg-green-500" : "bg-amber-500"
            )} />

            <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                        <Badge variant="outline" className={cn("mb-2", TYPE_COLORS[event.type])}>
                            {TYPE_LABELS[event.type]}
                        </Badge>
                        <CardTitle className="text-xl font-bold text-zinc-100 group-hover:text-amber-400/90 transition-colors">
                            {event.title}
                        </CardTitle>
                    </div>

                    {canManage && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8 text-zinc-400 hover:text-blue-400">
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={onDelete} className="h-8 w-8 text-zinc-400 hover:text-red-400">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-4 pb-4">
                {event.description && (
                    <p className="text-zinc-400 text-sm line-clamp-2 italic">
                        "{event.description}"
                    </p>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-zinc-300">
                        <Calendar className="h-4 w-4 text-amber-500/70" />
                        <span>{format(startDate, "d MMMM", { locale: fr })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-300">
                        <Clock className="h-4 w-4 text-amber-500/70" />
                        <span>{format(startDate, "HH:mm")} - {format(endDate, "HH:mm")}</span>
                    </div>
                    {event.location && (
                        <div className="flex items-center gap-2 text-zinc-300 col-span-2">
                            <MapPin className="h-4 w-4 text-amber-500/70" />
                            <span>{event.location}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-zinc-500" />
                        <span className="text-sm text-zinc-400">
                            {attendeeCount} {event.maxAttendees ? `/ ${event.maxAttendees}` : ""} participants
                        </span>
                    </div>

                    <div className="flex -space-x-2">
                        {event.attendees?.slice(0, 3).map((a: any) => (
                            <TooltipProvider key={a.id}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="h-7 w-7 rounded-full border-2 border-zinc-900 overflow-hidden bg-zinc-800">
                                            {a.user.image ? (
                                                <img src={a.user.image} alt={a.user.name} />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center text-[10px] text-zinc-400">
                                                    {a.user.name?.[0]}
                                                </div>
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{a.user.name}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ))}
                        {attendeeCount > 3 && (
                            <div className="h-7 w-7 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400">
                                +{attendeeCount - 3}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>

            <CardFooter className="bg-zinc-800/30 gap-2 pt-3 pb-3">
                <Button
                    variant={myAttendance?.status === "GOING" ? "default" : "secondary"}
                    size="sm"
                    className={cn(
                        "flex-1 h-8",
                        myAttendance?.status === "GOING" && "bg-amber-600 hover:bg-amber-700 text-white"
                    )}
                    onClick={() => onRespond("GOING")}
                >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    J'y vais
                </Button>
                <Button
                    variant={myAttendance?.status === "MAYBE" ? "outline" : "ghost"}
                    size="sm"
                    className="flex-1 h-8 border-zinc-700 hover:border-zinc-600"
                    onClick={() => onRespond("MAYBE")}
                >
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Peut-être
                </Button>
            </CardFooter>
        </Card>
    );
}
