"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, MapPin, Clock, ChevronRight, Swords, Infinity, Flame, Target, Star, Coffee, RefreshCw } from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow, isToday, isTomorrow, isThisWeek, startOfWeek, addDays, eachDayOfInterval, isSameDay } from "date-fns";
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
    RAID_OFFICIAL:    { label: "Raid Officiel",     icon: Swords,    color: "text-danger",     bg: "bg-danger/10",     border: "border-danger/20" },
    EVENT_GUILD:      { label: "Événement",         icon: Star,      color: "text-warning",  bg: "bg-warning/10",  border: "border-warning/20" },
    SESSION_MISSIONS: { label: "Missions",          icon: Target,    color: "text-info",    bg: "bg-info/10",    border: "border-info/20" },
    SORTIE_FARM:      { label: "Sortie Farm",       icon: Flame,     color: "text-warning",  bg: "bg-warning/10",  border: "border-warning/20" },
    SONGES_RUN:       { label: "Songes",            icon: Infinity,  color: "text-info",  bg: "bg-info/10",  border: "border-info/20" },
    DUNGEON_FARM:     { label: "Donjons",           icon: Flame,     color: "text-warning",   bg: "bg-warning/10",   border: "border-warning/20" },
    SOCIAL:           { label: "Social",            icon: Coffee,    color: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/20" },
    GUILD_MISSION:    { label: "Mission Guilde",    icon: Target,    color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/20" },
    ALMANAX_BONUS:    { label: "Almanax",           icon: Star,      color: "text-success", bg: "bg-success/10", border: "border-success/20" },
    OFFICIAL_RESET:   { label: "Reset Officiel",    icon: RefreshCw, color: "text-muted-foreground",    bg: "bg-elevated/50",    border: "border-border/30" },
    OTHERS:           { label: "Autre",             icon: Calendar,  color: "text-muted-foreground",    bg: "bg-elevated/50",    border: "border-border/30" },
};

function getWhenLabel(date: Date): { label: string; urgent: boolean } {
    const d = new Date(date);
    if (isToday(d))     return { label: "Aujourd'hui", urgent: true };
    if (isTomorrow(d))  return { label: "Demain",      urgent: false };
    if (isThisWeek(d, { locale: fr }))
        return { label: format(d, "EEEE", { locale: fr }), urgent: false };
    return { label: format(d, "dd MMM", { locale: fr }), urgent: false };
}

export function UpcomingEventsWidget({
    guildId,
    events = []
}: {
    guildId: string;
    events: UpcomingEvent[];
}) {
    // #100 — Semaine en cours : les 7 jours (LUN→DIM) affichés en tête du widget,
    // avec un point sur les jours où la guilde a des événements à venir.
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

    // #bugfix — la LISTE affiche les événements EN COURS ou à venir (un événement
    // déjà terminé dans la semaine ne doit pas occuper une place). Le bandeau de
    // jours, lui, garde toutes les pastilles de la semaine (passées incluses).
    const nowTs = Date.now();
    const activeEvents = events.filter((e) => new Date(e.endDate).getTime() >= nowTs);

    return (
        <Card className="glass-premium border-border flex flex-col h-full overflow-hidden">
            <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-caption font-black uppercase tracking-widest text-guild flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        Agenda de Guilde
                        {activeEvents.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-guild/10 border border-guild/20 text-guild text-caption font-black tabular-nums">
                                {activeEvents.length}
                            </span>
                        )}
                    </CardTitle>
                    <div className="flex items-center gap-3">
                        {/* #2 — Lien vers le planning perso du profil */}
                        <Link
                            href={`/dashboard/${guildId}/profile?tab=planning`}
                            className="text-caption font-semibold text-muted-foreground hover:text-guild transition-colors"
                            title="Mon planning perso"
                        >
                            Mon planning
                        </Link>
                        <Link
                            href={`/dashboard/${guildId}/calendar`}
                            className="text-caption font-black text-muted-foreground hover:text-guild uppercase tracking-widest border border-border px-2 py-1 rounded-md transition-colors hover:border-guild/20"
                        >
                            Calendrier →
                        </Link>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-4 pb-4 flex-1 flex flex-col gap-2">
                {/* #100 — Semaine en cours (bandeau LUN→DIM, jour du jour surligné) */}
                <div className="grid grid-cols-7 gap-1.5">
                    {weekDays.map((day) => {
                        const isCurrentDay = isSameDay(day, new Date());
                        const dayKey = format(day, "yyyy-MM-dd");
                        const dayCount = eventsByDay.get(dayKey) || 0;
                        return (
                            <Link
                                key={dayKey}
                                href={`/dashboard/${guildId}/calendar`}
                                title={dayCount > 0 ? `${dayCount} événement${dayCount > 1 ? "s" : ""} ce jour` : "Voir le calendrier"}
                                className={cn(
                                    "flex flex-col items-center gap-0.5 rounded-lg py-2 border transition-colors",
                                    isCurrentDay
                                        ? "bg-guild/15 border-guild/40 text-guild"
                                        : "bg-background/40 border-border text-muted-foreground hover:bg-surface/60 hover:text-foreground hover:border-border"
                                )}
                            >
                                <span className="text-label font-semibold uppercase">
                                    {format(day, "EEE", { locale: fr }).slice(0, 3)}
                                </span>
                                <span className="text-sm font-bold tabular-nums leading-none">
                                    {format(day, "d")}
                                </span>
                                <span className={cn("h-1 w-1 rounded-full", dayCount > 0 ? "bg-success" : "bg-transparent")} />
                            </Link>
                        );
                    })}
                </div>

                {events.length > 0 ? (
                    <>
                        {events.map((event) => {
                            const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.OTHERS;
                            const Icon = cfg.icon;
                            const startTs = new Date(event.startDate).getTime();
                            const endTs = new Date(event.endDate).getTime();
                            const isOngoing = startTs <= nowTs && endTs >= nowTs;
                            const isPast = endTs < nowTs;
                            const when = getWhenLabel(new Date(event.startDate));
                            const participants = event._count?.participants ?? 0;
                            const maxParts = event.maxParticipants;
                            const fillPct = maxParts ? Math.min(100, (participants / maxParts) * 100) : null;
                            const isFull = maxParts ? participants >= maxParts : false;

                            return (
                                <Link
                                    key={event.id}
                                    href={`/dashboard/${guildId}/calendar?event=${event.id}`}
                                    className={cn(
                                        "group flex items-start gap-3 p-3 rounded-2xl bg-background/40 border border-border transition-colors duration-200",
                                        isPast
                                            ? "opacity-55 hover:opacity-80"
                                            : "hover:bg-surface/60 hover:border-success/20"
                                    )}
                                >
                                    {/* Type Icon */}
                                    <div className={cn("shrink-0 h-10 w-10 rounded-xl flex items-center justify-center border", cfg.bg, cfg.border)}>
                                        <Icon className={cn("w-4.5 h-4.5", cfg.color)} style={{ width: "1.125rem", height: "1.125rem" }} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span
                                                suppressHydrationWarning
                                                className={cn(
                                                "text-caption font-black uppercase px-1.5 py-0.5 rounded shrink-0",
                                                isPast
                                                    ? "bg-elevated/60 text-muted-foreground"
                                                    : when.urgent || isOngoing
                                                        ? "bg-success text-success-foreground"
                                                        : "bg-elevated text-muted-foreground"
                                            )}>
                                                {isPast ? "Terminé" : isOngoing ? "En cours" : when.label}
                                            </span>
                                            <span className={cn("text-caption font-black uppercase px-1.5 py-0.5 rounded border shrink-0", cfg.bg, cfg.border, cfg.color)}>
                                                {cfg.label}
                                            </span>
                                            {isFull && (
                                                <span className="text-caption font-black uppercase px-1.5 py-0.5 rounded bg-danger/40 border border-danger/20 text-danger shrink-0">
                                                    Complet
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-caption font-black text-foreground/90 group-hover:text-guild transition-colors uppercase italic truncate">
                                            {event.title}
                                        </p>

                                        <div className="flex items-center gap-3 text-caption text-muted-foreground font-bold uppercase tracking-tighter">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                <span suppressHydrationWarning>{format(new Date(event.startDate), "HH:mm")}</span>
                                            </span>
                                            {event.location && (
                                                <span className="flex items-center gap-1 truncate max-w-[100px]">
                                                    <MapPin className="w-3 h-3 shrink-0" />
                                                    {event.location}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                {participants}{maxParts ? `/${maxParts}` : ""}
                                            </span>
                                        </div>

                                        {/* Participation bar */}
                                        {fillPct !== null && (
                                            <div className="h-1 bg-surface rounded-full overflow-hidden w-full mt-1">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-300",
                                                        fillPct >= 100
                                                            ? "bg-danger"
                                                            : fillPct >= 75
                                                                ? "bg-warning"
                                                                : "bg-success"
                                                    )}
                                                    style={{ width: `${fillPct}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-guild transition-colors shrink-0 mt-2" />
                                </Link>
                            );
                        })}

                        <Link
                            href={`/dashboard/${guildId}/calendar`}
                            className="flex items-center justify-center gap-2 text-caption font-black text-muted-foreground hover:text-guild uppercase tracking-widest pt-2 transition-colors border-t border-border mt-auto"
                        >
                            Voir tout le calendrier
                        </Link>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-4 border border-dashed border-border rounded-2xl">
                        <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-caption text-muted-foreground font-black uppercase tracking-widest">
                                Aucun événement à venir
                            </p>
                            <p className="text-caption text-muted-foreground font-medium">
                                Planifiez le prochain raid ou événement de guilde
                            </p>
                        </div>
                        <Link
                            href={`/dashboard/${guildId}/calendar`}
                            className="text-caption font-black text-guild/70 hover:text-guild uppercase tracking-widest transition-colors"
                        >
                            Ouvrir le calendrier →
                        </Link>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
