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
    Flame
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DofusUiIcon } from "@/components/shared/dofus-ui-icon";
import { calendarEventTheme } from "@/lib/calendar-event-theme";
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
// Libellés, couleurs et pictos Dofus : `@/lib/calendar-event-theme` (source unique).

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
            "rounded-xl border border-border/50 overflow-hidden",
            compact ? "bg-surface/40" : "bg-gradient-to-br from-surface/80 to-background/80"
        )}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-surface/60">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-warning" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground">À venir</h3>
                        <p className="text-xs text-muted-foreground">{upcomingEvents.length} événement{upcomingEvents.length > 1 ? "s" : ""}</p>
                    </div>
                </div>
                {onViewAll && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onViewAll}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-warning"
                    >
                        Voir tout
                        <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                )}
            </div>

            {/* Events List */}
            <div className="divide-y divide-border/30">
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
    const config = calendarEventTheme(event.type);
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
                "w-full flex items-center gap-3 p-3 text-left transition-all hover:bg-elevated/30 group",
                compact && "p-2.5"
            )}
        >
            {/* Picto du type (Dofus) */}
            <div className={cn(
                "shrink-0 h-10 w-10 rounded-[4px] flex items-center justify-center border",
                config.bg,
                config.border,
                compact && "h-8 w-8"
            )}>
                <DofusUiIcon name={config.picto} size={compact ? 16 : 20} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "font-semibold text-foreground truncate text-sm",
                        compact && "text-xs"
                    )}>
                        {event.title}
                    </span>
                    {isUrgent && (
                        <Flame className="h-3.5 w-3.5 text-warning animate-pulse shrink-0" />
                    )}
                </div>
                <div className={cn(
                    "flex items-center gap-2 text-xs text-muted-foreground mt-0.5",
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
                            <span className="text-muted-foreground">•</span>
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
                        ? "bg-warning/10 border-warning/30 text-warning"
                        : isTodays
                            ? "bg-warning/10 border-warning/30 text-warning"
                            : "bg-elevated border-border text-muted-foreground"
                )}
            >
                {countdown}
            </Badge>

            {/* Arrow */}
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-muted-foreground transition-colors shrink-0" />
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
    const config = calendarEventTheme(nextEvent.type);

    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all",
                isUrgent
                    ? "bg-warning/10 border-warning/30 text-warning animate-pulse"
                    : "bg-surface/60 border-border/50 text-muted-foreground hover:border-border"
            )}
        >
            <DofusUiIcon name={config.picto} size={16} />
            <span className="text-xs font-medium truncate max-w-[120px]">
                {nextEvent.title}
            </span>
            <Badge
                variant="outline"
                className={cn(
                    "h-5 text-caption font-bold",
                    isUrgent ? "border-warning/50 text-warning" : "border-border text-muted-foreground"
                )}
            >
                {hoursUntil < 1 ? `${Math.max(1, differenceInMinutes(startDate, now))}min` : `${hoursUntil}h`}
            </Badge>
        </button>
    );
}
