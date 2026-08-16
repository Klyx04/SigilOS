"use client";

/**
 * UpcomingEventsWidget - Smart Events Preview
 * Shows next events with countdown and quick actions
 */

import { useState, useEffect, useMemo } from "react";
import { format, formatDistanceToNow, isPast, isFuture, isToday, differenceInHours, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import {
    Calendar,
    Clock,
    Users,
    ChevronRight,
    Bell,
    Flame,
    Swords,
    PartyPopper,
    Target,
    Wheat
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface UpcomingEvent {
    id: string;
    title: string;
    type: string;
    status: string;
    startDate: Date | string;
    endDate: Date | string;
    maxParticipants?: number | null;
    _count?: { participants: number };
}

interface UpcomingEventsWidgetProps {
    events: UpcomingEvent[];
    onEventClick: (eventId: string) => void;
    onViewAll?: () => void;
    maxEvents?: number;
    compact?: boolean;
}

// ============================================
// TYPE CONFIG
// ============================================

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    RAID_OFFICIAL: {
        label: "Raid 3.6",
        icon: Swords,
        color: "text-red-400",
        bg: "bg-red-500/15 border-red-500/30"
    },
    EVENT_GUILD: {
        label: "Event Guilde",
        icon: PartyPopper,
        color: "text-purple-400",
        bg: "bg-purple-500/15 border-purple-500/30"
    },
    SESSION_MISSIONS: {
        label: "Missions Guilde",
        icon: Target,
        color: "text-amber-400",
        bg: "bg-amber-500/15 border-amber-500/30"
    },
    SORTIE_FARM: {
        label: "Sortie Farm",
        icon: Wheat,
        color: "text-emerald-400",
        bg: "bg-emerald-500/15 border-emerald-500/30"
    },
};

// ============================================
// COMPONENT
// ============================================

export function UpcomingEventsWidget({
    events,
    onEventClick,
    onViewAll,
    maxEvents = 3,
    compact = false
}: UpcomingEventsWidgetProps) {
    const [now, setNow] = useState(new Date());

    // Update time every minute for countdown
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    // Filter and sort upcoming events
    const upcomingEvents = useMemo(() => {
        return events
            .filter(e => {
                const startDate = new Date(e.startDate);
                return isFuture(startDate) || isToday(startDate);
            })
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
            .slice(0, maxEvents);
    }, [events, maxEvents]);

    if (upcomingEvents.length === 0) {
        return null; // Don't show widget if no events
    }

    return (
        <div className={cn(
            "rounded-xl border border-zinc-800/50 overflow-hidden",
            compact ? "bg-zinc-900/40" : "bg-gradient-to-br from-zinc-900/80 to-zinc-950/80"
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/30 bg-zinc-900/60">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-zinc-100">À venir</h3>
                        <p className="text-xs text-zinc-500">{upcomingEvents.length} événement{upcomingEvents.length > 1 ? "s" : ""}</p>
                    </div>
                </div>
                {onViewAll && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onViewAll}
                        className="h-8 px-2 text-xs text-zinc-400 hover:text-amber-400"
                    >
                        Voir tout
                        <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                )}
            </div>

            {/* Events List */}
            <div className="divide-y divide-zinc-800/30">
                {upcomingEvents.map((event) => (
                    <EventRow
                        key={event.id}
                        event={event}
                        now={now}
                        onClick={() => onEventClick(event.id)}
                        compact={compact}
                    />
                ))}
            </div>
        </div>
    );
}

// ============================================
// EVENT ROW
// ============================================

function EventRow({
    event,
    now,
    onClick,
    compact
}: {
    event: UpcomingEvent;
    now: Date;
    onClick: () => void;
    compact?: boolean;
}) {
    const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.EVENT_GUILD;
    const Icon = config.icon;
    const startDate = new Date(event.startDate);
    const hoursUntil = differenceInHours(startDate, now);
    const minutesUntil = differenceInMinutes(startDate, now) % 60;

    // Determine urgency
    const isUrgent = hoursUntil < 2;
    const isTodays = isToday(startDate);

    // Format countdown
    const countdown = useMemo(() => {
        if (hoursUntil < 1) {
            return `${minutesUntil}min`;
        } else if (hoursUntil < 24) {
            return `${hoursUntil}h${minutesUntil > 0 ? minutesUntil : ""}`;
        } else {
            return formatDistanceToNow(startDate, { addSuffix: false, locale: fr });
        }
    }, [hoursUntil, minutesUntil, startDate]);

    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 p-3 text-left transition-all hover:bg-zinc-800/30 group",
                compact && "p-2.5"
            )}
        >
            {/* Icon */}
            <div className={cn(
                "shrink-0 h-10 w-10 rounded-lg flex items-center justify-center border",
                config.bg,
                compact && "h-8 w-8"
            )}>
                <Icon className={cn("h-5 w-5", config.color, compact && "h-4 w-4")} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "font-semibold text-zinc-100 truncate text-sm",
                        compact && "text-xs"
                    )}>
                        {event.title}
                    </span>
                    {isUrgent && (
                        <Flame className="h-3.5 w-3.5 text-orange-500 animate-pulse shrink-0" />
                    )}
                </div>
                <div className={cn(
                    "flex items-center gap-2 text-xs text-zinc-500 mt-0.5",
                    compact && "text-caption"
                )}>
                    <Clock className="h-3 w-3" />
                    {isTodays ? (
                        <span>Aujourd'hui {format(startDate, "HH:mm")}</span>
                    ) : (
                        <span>{format(startDate, "EEE d MMM, HH:mm", { locale: fr })}</span>
                    )}
                    {event._count && (
                        <>
                            <span className="text-zinc-600">•</span>
                            <Users className="h-3 w-3" />
                            <span>
                                {event._count.participants}
                                {event.maxParticipants && `/${event.maxParticipants}`}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Countdown Badge */}
            <Badge
                variant="outline"
                className={cn(
                    "shrink-0 font-bold text-xs",
                    isUrgent
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                        : isTodays
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : "bg-zinc-800 border-zinc-700 text-zinc-400"
                )}
            >
                {countdown}
            </Badge>

            {/* Arrow */}
            <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
        </button>
    );
}

// ============================================
// COMPACT HEADER VERSION (for global header)
// ============================================

export function UpcomingEventsBadge({
    events,
    onClick
}: {
    events: UpcomingEvent[];
    onClick: () => void;
}) {
    const now = new Date();

    // Find next event
    const nextEvent = useMemo(() => {
        return events
            .filter(e => isFuture(new Date(e.startDate)) || isToday(new Date(e.startDate)))
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
    }, [events]);

    if (!nextEvent) return null;

    const startDate = new Date(nextEvent.startDate);
    const hoursUntil = differenceInHours(startDate, now);
    const isUrgent = hoursUntil < 2;
    const config = TYPE_CONFIG[nextEvent.type] || TYPE_CONFIG.EVENT_GUILD;
    const Icon = config.icon;

    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all",
                isUrgent
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-400 animate-pulse"
                    : "bg-zinc-900/60 border-zinc-700/50 text-zinc-400 hover:border-zinc-600"
            )}
        >
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium truncate max-w-[120px]">
                {nextEvent.title}
            </span>
            <Badge
                variant="outline"
                className={cn(
                    "h-5 text-caption font-bold",
                    isUrgent ? "border-orange-500/50 text-orange-300" : "border-zinc-600 text-zinc-400"
                )}
            >
                {hoursUntil < 1 ? `${Math.max(1, differenceInMinutes(startDate, now))}min` : `${hoursUntil}h`}
            </Badge>
        </button>
    );
}
