"use client";

/**
 * CalendarGrid V6 - BIGGER & CLEARER
 * Everything sized for comfortable reading
 * - Smart sorting (priority types first, then by time)
 * - Scrollable week day cells
 * - Clickable "+N" badge → opens day modal
 * - "Terminé" watermark stamp for completed events
 */

import { useMemo } from "react";
import {
    format,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isToday,
    addWeeks,
    subWeeks,
    getWeek,
    startOfMonth,
    endOfMonth,
    addMonths,
    subMonths,
    isBefore,
    startOfDay
} from "date-fns";
import {
    Users,
    Swords,
    PartyPopper,
    Target,
    Wheat,
    Eye,
    CheckCircle2
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ============================================
// 4 EVENT TYPES
// ============================================

interface TypeConfig {
    label: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    dot: string;
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
    RAID_OFFICIAL: {
        label: "Raid 3.6",
        icon: Swords,
        color: "text-danger",
        bg: "bg-danger/15",
        border: "border-danger/40",
        dot: "bg-danger"
    },
    EVENT_GUILD: {
        label: "Event Guilde",
        icon: PartyPopper,
        color: "text-info",
        bg: "bg-info/15",
        border: "border-info/40",
        dot: "bg-info"
    },
    SESSION_MISSIONS: {
        label: "Missions Guilde",
        icon: Target,
        color: "text-warning",
        bg: "bg-warning/15",
        border: "border-warning/40",
        dot: "bg-warning"
    },
    SORTIE_FARM: {
        label: "Sortie Farm",
        icon: Wheat,
        color: "text-success",
        bg: "bg-success/15",
        border: "border-success/40",
        dot: "bg-success"
    },
    KRALAMOURE: {
        label: "Kralamoure",
        icon: Eye,
        color: "text-pink-400",
        bg: "bg-pink-500/15",
        border: "border-pink-500/40",
        dot: "bg-pink-500"
    },
};

/**
 * Visual priority for sorting events within a day.
 * Lower number = displayed first (higher in the cell).
 */
const TYPE_PRIORITY: Record<string, number> = {
    RAID_OFFICIAL: 0,
    KRALAMOURE: 1,
    EVENT_GUILD: 2,
    SORTIE_FARM: 3,
    SESSION_MISSIONS: 4,
};

/**
 * Sort events for a given day: priority type first, then by start time.
 */
const sortEventsForDay = (events: CalendarEvent[]): CalendarEvent[] =>
    [...events].sort((a, b) => {
        const pa = TYPE_PRIORITY[a.type] ?? 99;
        const pb = TYPE_PRIORITY[b.type] ?? 99;
        if (pa !== pb) return pa - pb;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

// ============================================
// INTERFACES
// ============================================

interface CalendarEvent {
    id: string;
    title: string;
    type: string;
    status: string;
    startDate: Date | string;
    endDate: Date | string;
    maxParticipants?: number | null;
    _count?: { participants: number };
}

type ViewMode = "week" | "month";

interface CalendarGridProps {
    events: CalendarEvent[];
    currentDate: Date;
    onDateChange: (date: Date) => void;
    onEventClick: (eventId: string) => void;
    onDayClick?: (date: Date) => void;
    onDayEventsClick?: (date: Date, events: CalendarEvent[]) => void;
    canManage?: boolean;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
}

// ============================================
// COMPONENT
// ============================================

export function CalendarGrid({
    events,
    currentDate,
    onDateChange,
    onEventClick,
    onDayClick,
    onDayEventsClick,
    canManage = false,
    viewMode,
    onViewModeChange
}: CalendarGridProps) {
    // Calendar days
    const calendarDays = useMemo(() => {
        if (viewMode === "week") {
            const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
            return eachDayOfInterval({ start: weekStart, end: weekEnd });
        } else {
            const monthStart = startOfMonth(currentDate);
            const monthEnd = endOfMonth(currentDate);
            const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
            const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
            return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
        }
    }, [currentDate, viewMode]);

    // Events by day (sorted by priority then time)
    const eventsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        events.forEach(event => {
            const eventDate = new Date(event.startDate);
            if (isNaN(eventDate.getTime())) return;
            const key = format(eventDate, "yyyy-MM-dd");
            const existing = map.get(key) || [];
            map.set(key, [...existing, event]);
        });
        for (const [key, dayEvents] of map) {
            map.set(key, sortEventsForDay(dayEvents));
        }
        return map;
    }, [events]);

    const handlePrev = () => {
        if (viewMode === "week") onDateChange(subWeeks(currentDate, 1));
        else onDateChange(subMonths(currentDate, 1));
    };

    const handleNext = () => {
        if (viewMode === "week") onDateChange(addWeeks(currentDate, 1));
        else onDateChange(addMonths(currentDate, 1));
    };

    const weekDays = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];
    const currentWeek = getWeek(currentDate, { weekStartsOn: 1 });

    return (
        <div className="space-y-6">
            {/* ============ CALENDAR GRID ============ */}
            {/* #129 : grille 7 colonnes scrollable horizontalement sur mobile (min-w) au lieu de s'écraser */}
            <div className="rounded-2xl border border-border bg-surface overflow-x-auto overscroll-x-contain relative">
                {/* Days Header - CONTRASTE ÉPURÉ (plus de glow ambre) */}
                <div className="grid grid-cols-7 min-w-[840px] md:min-w-full bg-muted border-b border-border">
                    {weekDays.map((day, i) => (
                        <div key={day} className={cn(
                            "py-3.5 text-center text-xs font-semibold tracking-wide uppercase",
                            i >= 5 ? "text-muted-foreground" : "text-foreground"
                        )}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 min-w-[840px] md:min-w-full bg-surface">
                    {calendarDays.map((day, index) => {
                        const dayKey = format(day, "yyyy-MM-dd");
                        const dayEvents = eventsByDay.get(dayKey) || [];
                        const isCurrentDay = isToday(day);
                        const isPastDay = isBefore(startOfDay(day), startOfDay(new Date()));
                        const isWeekend = index % 7 >= 5;
                        const minHeight = viewMode === "week" ? "min-h-[210px]" : "min-h-[140px]";
                        // Week view: show ALL events (scrollable). Month view: cap + "+N" badge.
                        const maxEvents = viewMode === "week" ? dayEvents.length + 1 : 2;
                        const visibleEvents = dayEvents.slice(0, viewMode === "week" ? undefined : maxEvents);

                        return (
                            <div
                                key={dayKey}
                                className={cn(
                                    "group relative border-b border-r border-border p-0 transition-colors duration-150 flex flex-col",
                                    minHeight,
                                    canManage && !isPastDay ? "cursor-pointer" : "cursor-default",
                                    isWeekend
                                        ? "bg-muted hover:bg-elevated"
                                        : "bg-muted hover:bg-elevated",
                                    index % 7 === 6 && "border-r-0"
                                )}
                                onClick={(e) => {
                                    // Only trigger if we clicked the cell itself, not an event button, and the day is not in the past
                                    if (canManage && !isPastDay && onDayClick) {
                                        onDayClick(day);
                                    }
                                }}
                            >
                                {/* Jour du jour — surlignage plat (emerald, plus de glow ambre) */}
                                {isCurrentDay && (
                                    <div className="absolute inset-0 border border-success/60 bg-success/[0.05] pointer-events-none z-10" />
                                )}

                                <div className="p-3.5 flex-1 flex flex-col relative z-20 min-h-0">
                                    {/* Day Number */}
                                    <div className="flex items-center justify-between mb-3 shrink-0">
                                        <span className={cn(
                                            "h-9 w-9 flex items-center justify-center rounded-xl text-sm font-semibold transition-colors duration-150",
                                            isCurrentDay
                                                ? "bg-success text-success-foreground"
                                                : "text-foreground group-hover:text-success"
                                        )}>
                                            {format(day, "d")}
                                        </span>
                                        {dayEvents.length > maxEvents && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDayEventsClick?.(day, dayEvents);
                                                }}
                                                className={cn(
                                                    "text-xs font-semibold bg-surface border px-2 py-0.5 rounded-full transition-colors",
                                                    "border-border text-foreground hover:border-success/50 hover:text-success "
                                                )}
                                                title={`Voir les ${dayEvents.length} événements de ce jour`}
                                            >
                                                +{dayEvents.length - maxEvents}
                                            </button>
                                        )}
                                    </div>

                                    {/* Events - BIGGER PILLS (scrollable) */}
                                    <div className={cn(
                                        "space-y-2 mt-auto overflow-y-auto no-scrollbar",
                                        viewMode === "week" ? "max-h-[calc(210px-3.5rem-2.5rem)]" : "max-h-[calc(140px-3.5rem-2.5rem)]"
                                    )}>
                                        {visibleEvents.map((event) => {
                                            const start = event.startDate ? new Date(event.startDate) : null;
                                            if (!start || isNaN(start.getTime())) return null;

                                            const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.EVENT_GUILD;
                                            const Icon = config.icon;
                                            const time = format(start, "HH:mm");
                                            const isCompleted = event.status === "COMPLETED" || (Boolean(event.endDate) && new Date(event.endDate).getTime() < Date.now());

                                            return (
                                                <TooltipProvider key={event.id}>
                                                    <Tooltip delayDuration={100}>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onEventClick(event.id);
                                                                }}
                                                                className={cn(
                                                                    "w-full group/btn relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors text-left",
                                                                    "bg-background/70 border",
                                                                    "hover:bg-muted",
                                                                    isCompleted
                                                                        ? "border-border opacity-60 grayscale-[0.8] hover:border-border"
                                                                        : "border-border hover:border-border-strong"
                                                                )}
                                                            >
                                                                {/* Side Accent Line */}
                                                                <div className={cn(
                                                                    "absolute left-0 top-1.5 bottom-1.5 w-0.75 rounded-r-full transition-colors",
                                                                    isCompleted ? "bg-success/70" : config.dot
                                                                )} />

                                                                <div className={cn(
                                                                    "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border border-border",
                                                                    isCompleted ? "bg-success/10" : config.bg
                                                                )}>
                                                                    {isCompleted ? (
                                                                        <CheckCircle2 className="h-3.5 w-3.5 text-success/80" />
                                                                    ) : event.type === "KRALAMOURE" ? (
                                                                        // eslint-disable-next-line @next/next/no-img-element
                                                                        <img src="/assets/calendar/kralamoure-head.png" alt="Kralamoure" className="w-5 h-5 object-contain" />
                                                                    ) : (
                                                                        <Icon className={cn("h-3.5 w-3.5", config.color)} />
                                                                    )}
                                                                </div>

                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-caption font-semibold uppercase tracking-wide opacity-60 leading-none mb-0.5">
                                                                        {time}
                                                                    </span>
                                                                    <span className="truncate text-foreground group-hover/btn:text-foreground transition-colors">
                                                                        {event.title}
                                                                    </span>
                                                                </div>

                                                                {/* Completed watermark stamp */}
                                                                {isCompleted && (
                                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                        <span className="rotate-[-12deg] border border-success/50 bg-success/10 text-success/90 text-caption font-semibold uppercase tracking-wide px-2 py-0.5 rounded-sm">
                                                                            ✓ Terminé
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent
                                                            side="right"
                                                            className="bg-popover border-border p-3.5 max-w-[240px] rounded-xl"
                                                        >
                                                            <p className="font-bold text-foreground text-sm">{event.title}</p>
                                                            <p className="text-xs text-muted-foreground mt-1 font-medium">
                                                                {time} → {format(new Date(event.endDate), "HH:mm")}
                                                            </p>
                                                            {isCompleted && (
                                                                <span className="mt-2 inline-flex items-center gap-1.5 text-success font-bold text-xs">
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                    Terminé
                                                                </span>
                                                            )}
                                                            {event._count && (
                                                                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground font-bold">
                                                                    <Users className="h-3.5 w-3.5" />
                                                                    {event._count.participants}
                                                                    {event.maxParticipants && ` / ${event.maxParticipants}`}
                                                                </div>
                                                            )}
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ============ LÉGENDE ============ */}
            <div className="flex flex-wrap items-center justify-center gap-2 py-3 bg-surface/40 border border-border rounded-xl px-4">
                {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                    <div key={type} className="flex items-center gap-2 px-2.5 py-1 rounded-lg">
                        <div className={cn("h-2 w-2 rounded-full", config.dot)} />
                        <span className="text-xs font-medium text-muted-foreground">{config.label}</span>
                    </div>
                ))}
                {/* Les événements terminés sont grisés avec un tampon « Terminé » dans la grille */}
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="h-3 w-3 text-success/80" />
                    <span className="text-xs font-medium text-muted-foreground">Terminé</span>
                </div>
            </div>
        </div>
    );
}