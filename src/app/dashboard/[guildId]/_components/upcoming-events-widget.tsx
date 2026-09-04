"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Calendar, Users, MapPin, Clock, ChevronRight, Swords, 
    Infinity as InfinityIcon, Flame, Target, Star, Coffee, RefreshCw, Plus 
} from "lucide-react";
import Link from "next/link";
import { format, isToday, isTomorrow, isThisWeek, startOfWeek, addDays, eachDayOfInterval, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface UpcomingEvent {
    id: string;
    title: string;
    type: string;
    startDate: Date;
    endDate: Date;
    location?: string | null;
    maxParticipants?: number | null;
    _count?: { participants: number };
}

const EVENT_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
    RAID_OFFICIAL:    { label: "Raid",          icon: Swords,       color: "text-rose-400",     bg: "bg-rose-500/10",     border: "border-rose-500/20" },
    EVENT_GUILD:      { label: "Événement",     icon: Star,         color: "text-amber-400",    bg: "bg-amber-500/10",    border: "border-amber-500/20" },
    SESSION_MISSIONS: { label: "Missions",      icon: Target,       color: "text-sky-400",      bg: "bg-sky-500/10",      border: "border-sky-500/20" },
    SORTIE_FARM:      { label: "Farm",          icon: Flame,        color: "text-amber-400",    bg: "bg-amber-500/10",    border: "border-amber-500/20" },
    SONGES_RUN:       { label: "Songes",        icon: InfinityIcon, color: "text-emerald-400",  bg: "bg-emerald-500/10",  border: "border-emerald-500/20" },
    DUNGEON_FARM:     { label: "Donjon",        icon: Flame,        color: "text-amber-400",    bg: "bg-amber-500/10",    border: "border-amber-500/20" },
    SOCIAL:           { label: "Social",        icon: Coffee,       color: "text-pink-400",     bg: "bg-pink-500/10",     border: "border-pink-500/20" },
    GUILD_MISSION:    { label: "Mission Guilde",icon: Target,       color: "text-teal-400",     bg: "bg-teal-500/10",     border: "border-teal-500/20" },
    ALMANAX_BONUS:    { label: "Almanax",       icon: Star,         color: "text-emerald-400",  bg: "bg-emerald-500/10",  border: "border-emerald-500/20" },
    OFFICIAL_RESET:   { label: "Reset",         icon: RefreshCw,    color: "text-slate-400",    bg: "bg-slate-500/10",    border: "border-slate-500/20" },
    OTHERS:           { label: "Autre",         icon: Calendar,     color: "text-slate-400",    bg: "bg-slate-500/10",    border: "border-slate-500/20" },
};

function formatEventDateBadge(date: Date): { text: string; isHot: boolean } {
    const d = new Date(date);
    if (isToday(d)) return { text: "Aujourd'hui", isHot: true };
    if (isTomorrow(d)) return { text: "Demain", isHot: false };
    if (isThisWeek(d, { locale: fr })) {
        return { text: format(d, "EEEE", { locale: fr }), isHot: false };
    }
    return { text: format(d, "d MMM", { locale: fr }), isHot: false };
}

export function UpcomingEventsWidget({
    guildId,
    events = []
}: {
    guildId: string;
    events: UpcomingEvent[];
}) {
    const nowTs = Date.now();
    const activeEvents = useMemo(() => {
        return events
            .filter((e) => new Date(e.endDate).getTime() >= nowTs)
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    }, [events, nowTs]);

    const weekDays = useMemo(() => {
        const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
        return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
    }, []);

    const eventsByDay = useMemo(() => {
        const map = new Map<string, number>();
        events.forEach((e) => {
            const d = new Date(e.startDate);
            if (isNaN(d.getTime())) return;
            const key = format(d, "yyyy-MM-dd");
            map.set(key, (map.get(key) || 0) + 1);
        });
        return map;
    }, [events]);

    return (
        <Card className="border-border bg-card/60 backdrop-blur-md flex flex-col overflow-hidden shadow-sm">
            {/* Header compact & professionnel */}
            <CardHeader className="py-4 px-5 border-b border-border/40 bg-surface/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-guild/10 border border-guild/20 flex items-center justify-center text-guild shrink-0">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                                Agenda de Guilde
                                {activeEvents.length > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-guild/15 border border-guild/30 text-guild text-[11px] font-bold tabular-nums">
                                        {activeEvents.length}
                                    </span>
                                )}
                            </CardTitle>
                            <p className="text-[11px] text-muted-foreground">
                                Sorties, raids et événements programmés
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            href={`/dashboard/${guildId}/profile?tab=planning`}
                            className="hidden sm:inline-flex text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md transition-colors"
                        >
                            Mon planning
                        </Link>
                        <Link
                            href={`/dashboard/${guildId}/calendar`}
                            className="text-xs font-semibold text-foreground hover:text-guild bg-surface/80 hover:bg-surface border border-border px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                            <span>Calendrier</span>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </Link>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 flex flex-col gap-4">
                {/* Sélecteur de semaine épuré (taille contenue, pas étalé sur 1600px) */}
                <div className="flex items-center justify-between bg-surface/40 border border-border/40 rounded-xl p-1.5 max-w-2xl">
                    <div className="grid grid-cols-7 gap-1 w-full">
                        {weekDays.map((day) => {
                            const isCurrentDay = isSameDay(day, new Date());
                            const dayKey = format(day, "yyyy-MM-dd");
                            const dayCount = eventsByDay.get(dayKey) || 0;
                            return (
                                <Link
                                    key={dayKey}
                                    href={`/dashboard/${guildId}/calendar`}
                                    title={dayCount > 0 ? `${dayCount} sortie(s) ce jour` : format(day, "EEEE d MMMM", { locale: fr })}
                                    className={cn(
                                        "flex flex-col items-center py-1.5 px-1 rounded-lg transition-all text-center",
                                        isCurrentDay
                                            ? "bg-guild/15 text-guild font-bold border border-guild/30 shadow-xs"
                                            : "text-muted-foreground hover:text-foreground hover:bg-surface/80 border border-transparent"
                                    )}
                                >
                                    <span className="text-[10px] font-medium uppercase tracking-tight">
                                        {format(day, "EEE", { locale: fr }).slice(0, 3)}
                                    </span>
                                    <span className="text-xs font-bold tabular-nums">
                                        {format(day, "d")}
                                    </span>
                                    <span className={cn(
                                        "h-1 w-1 rounded-full mt-0.5 transition-opacity",
                                        dayCount > 0 ? "bg-emerald-400" : "opacity-0"
                                    )} />
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Liste des événements ou état vide propre */}
                {activeEvents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {activeEvents.slice(0, 6).map((event) => {
                            const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.OTHERS;
                            const Icon = cfg.icon;
                            const startTs = new Date(event.startDate).getTime();
                            const endTs = new Date(event.endDate).getTime();
                            const isOngoing = startTs <= nowTs && endTs >= nowTs;
                            const dateBadge = formatEventDateBadge(new Date(event.startDate));
                            const participants = event._count?.participants ?? 0;
                            const maxParts = event.maxParticipants;
                            const isFull = maxParts ? participants >= maxParts : false;

                            return (
                                <Link
                                    key={event.id}
                                    href={`/dashboard/${guildId}/calendar?event=${event.id}`}
                                    className="group relative flex flex-col justify-between p-3.5 rounded-xl bg-surface/50 border border-border/60 hover:bg-surface hover:border-guild/30 transition-all duration-150 shadow-xs"
                                >
                                    <div>
                                        {/* Badges de statut */}
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className={cn(
                                                "text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1",
                                                cfg.bg, cfg.border, cfg.color
                                            )}>
                                                <Icon className="w-3 h-3" />
                                                <span>{cfg.label}</span>
                                            </span>

                                            <span className={cn(
                                                "text-[10px] font-medium px-2 py-0.5 rounded-md",
                                                isOngoing
                                                    ? "bg-emerald-500/20 text-emerald-300 font-bold animate-pulse"
                                                    : dateBadge.isHot
                                                        ? "bg-amber-500/15 text-amber-300 font-semibold"
                                                        : "bg-muted/60 text-muted-foreground"
                                            )}>
                                                {isOngoing ? "En direct" : dateBadge.text}
                                            </span>
                                        </div>

                                        {/* Titre de l'événement */}
                                        <h4 className="text-xs font-semibold text-foreground group-hover:text-guild transition-colors line-clamp-1 mb-2.5">
                                            {event.title}
                                        </h4>
                                    </div>

                                    {/* Méta : Heure, Lieu, Inscrits */}
                                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                                        <div className="flex items-center gap-3">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-muted-foreground/70" />
                                                <span className="font-medium">{format(new Date(event.startDate), "HH:mm")}</span>
                                            </span>
                                            {event.location && (
                                                <span className="flex items-center gap-1 truncate max-w-[90px]" title={event.location}>
                                                    <MapPin className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                                                    <span className="truncate">{event.location}</span>
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1 font-semibold">
                                            <Users className="w-3 h-3 text-muted-foreground/70" />
                                            <span className={isFull ? "text-rose-400" : "text-foreground"}>
                                                {participants}{maxParts ? `/${maxParts}` : ""}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    /* État vide sobre, feutré, sans bordures en pointillés criardes */
                    <div className="flex items-center justify-between p-4 rounded-xl bg-surface/30 border border-border/40 text-muted-foreground">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-muted-foreground/60 shrink-0">
                                <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-foreground/80">
                                    Aucune sortie programmée cette semaine
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    Planifiez un donjon, un raid ou une session d'XP avec votre guilde.
                                </p>
                            </div>
                        </div>

                        <Link
                            href={`/dashboard/${guildId}/calendar`}
                            className="text-xs font-medium text-guild hover:underline flex items-center gap-1 shrink-0 ml-4"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Proposer</span>
                        </Link>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

