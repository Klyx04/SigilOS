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
    RAID_OFFICIAL:    { label: "Raid Officiel",     icon: Swords,    color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20" },
    EVENT_GUILD:      { label: "Événement",         icon: Star,      color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/20" },
    SESSION_MISSIONS: { label: "Missions",          icon: Target,    color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
    SORTIE_FARM:      { label: "Sortie Farm",       icon: Flame,     color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/20" },
    SONGES_RUN:       { label: "Songes",            icon: Infinity,  color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/20" },
    DUNGEON_FARM:     { label: "Donjons",           icon: Flame,     color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
    SOCIAL:           { label: "Social",            icon: Coffee,    color: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/20" },
    GUILD_MISSION:    { label: "Mission Guilde",    icon: Target,    color: "text-teal-400",    bg: "bg-teal-500/10",    border: "border-teal-500/20" },
    ALMANAX_BONUS:    { label: "Almanax",           icon: Star,      color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    OFFICIAL_RESET:   { label: "Reset Officiel",    icon: RefreshCw, color: "text-zinc-400",    bg: "bg-zinc-800/50",    border: "border-zinc-700/30" },
    OTHERS:           { label: "Autre",             icon: Calendar,  color: "text-zinc-400",    bg: "bg-zinc-800/50",    border: "border-zinc-700/30" },
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

    return (
        <Card className="glass-premium border-white/5 flex flex-col h-full overflow-hidden">
            <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-caption font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        Agenda de Guilde
                        {events.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-caption font-black tabular-nums">
                                {events.length}
                            </span>
                        )}
                    </CardTitle>
                    <div className="flex items-center gap-3">
                        {/* #2 — Lien vers le planning perso du profil */}
                        <Link
                            href={`/dashboard/${guildId}/profile?tab=planning`}
                            className="text-caption font-semibold text-zinc-500 hover:text-emerald-400 transition-colors"
                            title="Mon planning perso"
                        >
                            Mon planning
                        </Link>
                        <Link
                            href={`/dashboard/${guildId}/calendar`}
                            className="text-caption font-black text-zinc-600 hover:text-emerald-400 uppercase tracking-widest border border-white/5 px-2 py-1 rounded-md transition-colors hover:border-emerald-500/20"
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
                                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                        : "bg-zinc-950/40 border-white/5 text-zinc-500 hover:bg-zinc-900/60 hover:text-white hover:border-white/10"
                                )}
                            >
                                <span className="text-label font-semibold uppercase">
                                    {format(day, "EEE", { locale: fr }).slice(0, 3)}
                                </span>
                                <span className="text-sm font-bold tabular-nums leading-none">
                                    {format(day, "d")}
                                </span>
                                <span className={cn("h-1 w-1 rounded-full", dayCount > 0 ? "bg-emerald-400" : "bg-transparent")} />
                            </Link>
                        );
                    })}
                </div>

                {events.length > 0 ? (
                    <>
                        {events.map((event) => {
                            const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.OTHERS;
                            const Icon = cfg.icon;
                            const when = getWhenLabel(new Date(event.startDate));
                            const participants = event._count?.participants ?? 0;
                            const maxParts = event.maxParticipants;
                            const fillPct = maxParts ? Math.min(100, (participants / maxParts) * 100) : null;
                            const isFull = maxParts ? participants >= maxParts : false;

                            return (
                                <Link
                                    key={event.id}
                                    href={`/dashboard/${guildId}/calendar?event=${event.id}`}
                                    className="group flex items-start gap-3 p-3 rounded-2xl bg-zinc-950/40 hover:bg-zinc-900/60 border border-white/5 hover:border-emerald-500/20 transition-colors duration-200"
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
                                                when.urgent
                                                    ? "bg-emerald-500 text-black"
                                                    : "bg-zinc-800 text-zinc-400"
                                            )}>
                                                {when.label}
                                            </span>
                                            <span className={cn("text-caption font-black uppercase px-1.5 py-0.5 rounded border shrink-0", cfg.bg, cfg.border, cfg.color)}>
                                                {cfg.label}
                                            </span>
                                            {isFull && (
                                                <span className="text-caption font-black uppercase px-1.5 py-0.5 rounded bg-red-950/40 border border-red-500/20 text-red-400 shrink-0">
                                                    Complet
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-caption font-black text-white/90 group-hover:text-emerald-400 transition-colors uppercase italic truncate">
                                            {event.title}
                                        </p>

                                        <div className="flex items-center gap-3 text-caption text-zinc-500 font-bold uppercase tracking-tighter">
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
                                            <div className="h-1 bg-zinc-900 rounded-full overflow-hidden w-full mt-1">
                                                <div
                                                    className={cn(
                                                        "h-full rounded-full transition-all duration-300",
                                                        fillPct >= 100
                                                            ? "bg-red-500"
                                                            : fillPct >= 75
                                                                ? "bg-orange-500"
                                                                : "bg-emerald-500"
                                                    )}
                                                    style={{ width: `${fillPct}%` }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-emerald-400 transition-colors shrink-0 mt-2" />
                                </Link>
                            );
                        })}

                        <Link
                            href={`/dashboard/${guildId}/calendar`}
                            className="flex items-center justify-center gap-2 text-caption font-black text-zinc-700 hover:text-emerald-400 uppercase tracking-widest pt-2 transition-colors border-t border-white/5 mt-auto"
                        >
                            Voir tout le calendrier
                        </Link>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-4 border border-dashed border-white/5 rounded-2xl">
                        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-zinc-700" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-caption text-zinc-500 font-black uppercase tracking-widest">
                                Aucun événement cette semaine
                            </p>
                            <p className="text-caption text-zinc-700 font-medium">
                                Planifiez le prochain raid ou événement de guilde
                            </p>
                        </div>
                        <Link
                            href={`/dashboard/${guildId}/calendar`}
                            className="text-caption font-black text-emerald-500/70 hover:text-emerald-400 uppercase tracking-widest transition-colors"
                        >
                            Ouvrir le calendrier →
                        </Link>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
