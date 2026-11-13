"use client";

import { useMemo } from "react";
import { Users, MapPin, Clock, ChevronRight, Plus } from "lucide-react";
import Image from "next/image";
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

/** Libellé sobre par type d'événement (texte seul). */
const EVENT_LABELS: Record<string, string> = {
    RAID_OFFICIAL: "Raid",
    EVENT_GUILD: "Événement",
    SESSION_MISSIONS: "Missions",
    SORTIE_FARM: "Farm",
    SONGES_RUN: "Songes",
    DUNGEON_FARM: "Donjon",
    SOCIAL: "Social",
    GUILD_MISSION: "Mission guilde",
    ALMANAX_BONUS: "Almanax",
    OFFICIAL_RESET: "Reset",
    KRALAMOURE: "Kralamoure",
    OTHERS: "Autre",
};

/** Asset par type d'événement. */
const EVENT_ASSETS: Record<string, string> = {
    RAID_OFFICIAL: "/assets/dofus/game-icons/crossed-swords.png",
    EVENT_GUILD: "/assets/dofus/modules/party.png",
    SESSION_MISSIONS: "/assets/dofus/modules/guildatons.png",
    SORTIE_FARM: "/assets/dofus/game-icons/kamas.png",
    SONGES_RUN: "/assets/dofus/modules/songes_run.png",
    DUNGEON_FARM: "/assets/dofus/game-icons/crossed-swords.png",
    SOCIAL: "/assets/dofus/game-icons/party.png",
    GUILD_MISSION: "/assets/dofus/modules/guildatons.png",
    ALMANAX_BONUS: "/assets/dofus/game-icons/almanax.png",
    OFFICIAL_RESET: "/assets/dofus/modules/calendar.png",
    KRALAMOURE: "/assets/calendar/kralamoure-head.png",
    OTHERS: "/assets/dofus/modules/calendar.png",
};

function formatEventDate(date: Date): string {
    const d = new Date(date);
    if (isToday(d)) return "Aujourd'hui";
    if (isTomorrow(d)) return "Demain";
    if (isThisWeek(d, { locale: fr })) {
        return format(d, "EEEE", { locale: fr });
    }
    return format(d, "d MMM", { locale: fr });
}

function isRelativeLabel(date: Date): boolean {
    const d = new Date(date);
    return isToday(d) || isTomorrow(d);
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
        <div className="rounded-xl border border-border-strong bg-surface/60 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    {/* Pastille verte : l'agenda est une section de premier rang du dashboard,
                        il ne doit pas se lire comme un bloc gris de plus (retour user du 15/10). */}
                    <span className="flex h-6 w-6 items-center justify-center rounded-md border border-success/25 bg-success/10 shrink-0">
                        <Image
                            src="/assets/dofus/modules/calendar.png"
                            alt=""
                            aria-hidden="true"
                            width={14}
                            height={14}
                            className="object-contain"
                            unoptimized
                        />
                    </span>
                    Agenda
                    {activeEvents.length > 0 && (
                        <span className="ml-1 text-xs font-semibold text-success tabular-nums">{activeEvents.length}</span>
                    )}
                </h2>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/dashboard/${guildId}/profile?tab=planning`}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Mon planning
                    </Link>
                    <Link
                        href={`/dashboard/${guildId}/calendar`}
                        className="text-xs font-semibold text-foreground hover:text-muted-foreground transition-colors flex items-center gap-1"
                    >
                        Calendrier
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </Link>
                </div>
            </div>

            {/* Semaine (max 2xl pour rester dense) */}
            <div className="rounded-xl bg-background/50 border border-border p-1.5 max-w-2xl mb-3">
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
                                    "flex flex-col items-center py-1.5 px-1 rounded-lg transition-colors text-center border",
                                    isCurrentDay
                                        ? "bg-success/10 text-success font-bold border-success/30"
                                        : "text-muted-foreground hover:text-foreground hover:bg-surface/80 border-transparent"
                                )}
                            >
                                <span className="text-[10px] font-medium uppercase">
                                    {format(day, "EEE", { locale: fr }).slice(0, 3)}
                                </span>
                                <span className="text-xs font-bold tabular-nums">
                                    {format(day, "d")}
                                </span>
                                <span className={cn(
                                    "h-1 w-1 rounded-full mt-0.5",
                                    dayCount > 0 ? "bg-success" : "opacity-0"
                                )} />
                            </Link>
                        );
                    })}
                </div>
            </div>

            {activeEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {activeEvents.slice(0, 6).map((event) => {
                        const label = EVENT_LABELS[event.type] ?? EVENT_LABELS.OTHERS;
                        const assetSrc = EVENT_ASSETS[event.type] ?? EVENT_ASSETS.OTHERS;
                        const startTs = new Date(event.startDate).getTime();
                        const endTs = new Date(event.endDate).getTime();
                        const isOngoing = startTs <= nowTs && endTs >= nowTs;
                        const participants = event._count?.participants ?? 0;
                        const maxParts = event.maxParticipants;
                        const isFull = maxParts ? participants >= maxParts : false;
                        const dateLabel = isOngoing ? "En cours" : formatEventDate(new Date(event.startDate));
                        const isDateHighlighted = isOngoing || isRelativeLabel(new Date(event.startDate));

                        return (
                            <Link
                                key={event.id}
                                href={`/dashboard/${guildId}/calendar?event=${event.id}`}
                                className="rounded-xl border border-border bg-surface/40 hover:border-success/40 hover:bg-success/5 p-3 transition-colors"
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <Image
                                        src={assetSrc}
                                        alt={label}
                                        width={24}
                                        height={24}
                                        className="object-contain shrink-0"
                                        unoptimized
                                    />
                                    <span className="text-xs text-muted-foreground">{label}</span>
                                    <div className="flex items-center gap-1 ml-auto">
                                        {isOngoing && (
                                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success animate-pulse shrink-0" />
                                        )}
                                        <span className={cn(
                                            "text-xs tabular-nums",
                                            isOngoing
                                                ? "text-success font-bold"
                                                : isDateHighlighted
                                                    ? "text-success font-semibold"
                                                    : "text-muted-foreground"
                                        )}>
                                            {dateLabel}
                                        </span>
                                    </div>
                                </div>
                                <h4 className="text-xs font-semibold text-foreground line-clamp-1 mb-2">
                                    {event.title}
                                </h4>
                                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="flex items-center gap-1 tabular-nums">
                                            <Clock className="w-3 h-3 shrink-0" />
                                            {format(new Date(event.startDate), "HH:mm")}
                                        </span>
                                        {event.location && (
                                            <span className="flex items-center gap-1 truncate" title={event.location}>
                                                <MapPin className="w-3 h-3 shrink-0" />
                                                <span className="truncate max-w-[110px]">{event.location}</span>
                                            </span>
                                        )}
                                    </div>
                                    <span className="flex items-center gap-1 tabular-nums shrink-0">
                                        <Users className="w-3 h-3 shrink-0" />
                                        <span className={isFull ? "text-warning font-semibold" : ""}>
                                            {participants}{maxParts ? `/${maxParts}` : ""}
                                        </span>
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-success/5 border border-success/15">
                    <div className="flex items-center gap-3 min-w-0">
                        <Image
                            src="/assets/dofus/modules/calendar.png"
                            alt="Agenda"
                            width={24}
                            height={24}
                            className="object-contain shrink-0 opacity-70"
                            unoptimized
                        />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground">
                                Aucune sortie programmée cette semaine
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                                Planifiez un donjon, un raid ou une session d'XP.
                            </p>
                        </div>
                    </div>
                    <Link
                        href={`/dashboard/${guildId}/calendar`}
                        className="text-xs font-semibold text-success hover:text-success/80 flex items-center gap-1 shrink-0 transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Proposer
                    </Link>
                </div>
            )}
        </div>
    );
}
