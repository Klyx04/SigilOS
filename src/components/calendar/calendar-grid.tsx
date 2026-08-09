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
        color: "text-red-400",
        bg: "bg-red-500/15",
        border: "border-red-500/40",
        dot: "bg-red-500"
    },
    EVENT_GUILD: {
        label: "Event Guilde",
        icon: PartyPopper,
        color: "text-purple-400",
        bg: "bg-purple-500/15",
        border: "border-purple-500/40",
        dot: "bg-purple-500"
    },
    SESSION_MISSIONS: {
        label: "Missions Guilde",
        icon: Target,
        color: "text-amber-400",
        bg: "bg-amber-500/15",
        border: "border-amber-500/40",
        dot: "bg-amber-500"
    },
    SORTIE_FARM: {
        label: "Sortie Farm",
        icon: Wheat,
        color: "text-emerald-400",
        bg: "bg-emerald-500/15",
        border: "border-emerald-500/40",
        dot: "bg-emerald-500"
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
            <div className="rounded-2xl border border-white/[0.08] bg-[#0d1214] overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.7)] relative">
                {/* Subtle top ambient glow inside the grid */}
                <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent pointer-events-none" />

                {/* Days Header - BOLDER, HIGHER CONTRAST & SLATE BACKED */}
                <div className="grid grid-cols-7 bg-[#1c262a] border-b-2 border-white/[0.08]">
                    {weekDays.map((day, i) => (
                        <div key={day} className={cn(
                            "py-4 text-center text-xs font-black tracking-widest uppercase",
                            i >= 5 ? "text-amber-400" : "text-zinc-100"
                        )}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 bg-[#0b0e10]">
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
                                    "group relative border-b border-r border-white/[0.07] p-0 transition-all duration-300 flex flex-col",
                                    minHeight,
                                    canManage && !isPastDay ? "cursor-pointer" : "cursor-default",
                                    isWeekend
                                        ? "bg-[#111618] hover:bg-[#161c1f]"
                                        : "bg-[#151c1f] hover:bg-[#1a2327]",
                                    index % 7 === 6 && "border-r-0"
                                )}
                                onClick={(e) => {
                                    // Only trigger if we clicked the cell itself, not an event button, and the day is not in the past
                                    if (canManage && !isPastDay && onDayClick) {
                                        onDayClick(day);
                                    }
                                }}
                            >
                                {/* Premium Today Highlight Box with High Contrast Amber Border */}
                                {isCurrentDay && (
                                    <div className="absolute inset-0 border-2 border-amber-500 bg-amber-500/[0.06] pointer-events-none shadow-[inset_0_0_24px_rgba(245,158,11,0.1)] z-10" />
                                )}

                                <div className="p-3.5 flex-1 flex flex-col relative z-20 min-h-0">
                                    {/* Day Number - BIGGER & BRIGHTER */}
                                    <div className="flex items-center justify-between mb-3 shrink-0">
                                        <span className={cn(
                                            "h-9 w-9 flex items-center justify-center rounded-xl text-sm font-black transition-all duration-300",
                                            isCurrentDay
                                                ? "bg-gradient-to-r from-amber-400 to-amber-600 text-zinc-950 shadow-[0_4px_16px_rgba(245,158,11,0.5)] scale-105"
                                                : "text-zinc-100 group-hover:text-amber-400 group-hover:scale-110"
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
                                                    "text-xs font-extrabold bg-[#0d1214] border px-2 py-0.5 rounded-full transition-all",
                                                    "border-white/10 text-zinc-300 hover:border-amber-500/50 hover:text-amber-400 hover:scale-105"
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
                                            const isCompleted = event.status === "COMPLETED";

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
                                                                    "w-full group/btn relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left",
                                                                    "bg-zinc-950/70 backdrop-blur-md border",
                                                                    "hover:bg-[#1c262a] hover:shadow-xl hover:shadow-black/50 hover:-translate-y-0.5",
                                                                    "active:scale-[0.98] active:translate-y-0",
                                                                    isCompleted
                                                                        ? "border-white/[0.03] opacity-60 grayscale-[0.8] hover:border-white/10"
                                                                        : "border-white/[0.06] hover:border-white/15"
                                                                )}
                                                            >
                                                                {/* Side Accent Line */}
                                                                <div className={cn(
                                                                    "absolute left-0 top-1.5 bottom-1.5 w-0.75 rounded-r-full transition-all group-hover/btn:top-1 group-hover/btn:bottom-1",
                                                                    isCompleted ? "bg-emerald-500/70" : config.dot
                                                                )} />

                                                                <div className={cn(
                                                                    "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border border-white/5",
                                                                    isCompleted ? "bg-emerald-500/10" : config.bg
                                                                )}>
                                                                    {isCompleted ? (
                                                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80" />
                                                                    ) : (
                                                                        <Icon className={cn("h-3.5 w-3.5", config.color)} />
                                                                    )}
                                                                </div>

                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[9px] font-black uppercase tracking-wider opacity-60 leading-none mb-0.5">
                                                                        {time}
                                                                    </span>
                                                                    <span className="truncate text-zinc-200 group-hover/btn:text-white transition-colors">
                                                                        {event.title}
                                                                    </span>
                                                                </div>

                                                                {/* Completed watermark stamp */}
                                                                {isCompleted && (
                                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                        <span className="rotate-[-12deg] border border-emerald-500/50 bg-emerald-500/10 text-emerald-400/90 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm backdrop-blur-[1px] shadow-[0_0_8px_rgba(16,185,129,0.15)]">
                                                                            ✓ Terminé
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent
                                                            side="right"
                                                            className="bg-[#0e1417] border-white/10 p-3.5 max-w-[240px] shadow-2xl rounded-xl backdrop-blur-xl"
                                                        >
                                                            <p className="font-extrabold text-zinc-100 text-sm tracking-tight">{event.title}</p>
                                                            <p className="text-xs text-zinc-400 mt-1 font-medium">
                                                                {time} → {format(new Date(event.endDate), "HH:mm")}
                                                            </p>
                                                            {isCompleted && (
                                                                <span className="mt-2 inline-flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                    Terminé
                                                                </span>
                                                            )}
                                                            {event._count && (
                                                                <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-500 font-bold">
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

            {/* ============ LEGEND (BIG & FRESH) ============ */}
            <div className="flex flex-wrap items-center justify-center gap-4 py-4 bg-[#0a0f12]/40 border border-white/[0.03] rounded-2xl backdrop-blur-md px-6 shadow-inner">
                {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                    <div key={type} className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.03] hover:border-white/[0.06] hover:bg-white/[0.03] transition-all">
                        <div className={cn("h-2.5 w-2.5 rounded-full shadow-[0_0_8px_currentColor]", config.dot)} />
                        <span className="text-xs font-bold text-zinc-400 tracking-wide">{config.label}</span>
                    </div>
                ))}
                {/* Completed events are shown deselected with a watermark stamp in the grid */}
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.03] hover:border-white/[0.06] hover:bg-white/[0.03] transition-all">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500/80" />
                    <span className="text-xs font-bold text-zinc-400 tracking-wide">Terminé ✓</span>
                </div>
            </div>
        </div>
    );
}