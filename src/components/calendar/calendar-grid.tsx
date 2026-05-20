"use client";

/**
 * CalendarGrid V5 - BIGGER & CLEARER
 * Everything sized for comfortable reading
 */

import { useState, useMemo } from "react";
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
    subMonths
} from "date-fns";
import { fr } from "date-fns/locale";
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Calendar as CalendarIcon,
    Users,
    Swords,
    PartyPopper,
    Target,
    Wheat,
    CalendarDays,
    LayoutGrid,
    Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
    canManage = false,
    viewMode,
    onViewModeChange
}: CalendarGridProps) {
    // Calendar days



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

    // Events by day
    const eventsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        events.forEach(event => {
            const eventDate = new Date(event.startDate);
            const key = format(eventDate, "yyyy-MM-dd");
            const existing = map.get(key) || [];
            map.set(key, [...existing, event]);
        });
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
        <div className="space-y-5">


            {/* ============ CALENDAR GRID ============ */}
            <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/40 overflow-hidden">
                {/* Days Header - BIGGER */}
                <div className="grid grid-cols-7 bg-zinc-900 border-b border-zinc-800">
                    {weekDays.map((day, i) => (
                        <div key={day} className={cn(
                            "py-4 text-center text-sm font-bold tracking-wider",
                            i >= 5 ? "text-zinc-600" : "text-zinc-400"
                        )}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7">
                    {calendarDays.map((day, index) => {
                        const dayKey = format(day, "yyyy-MM-dd");
                        const dayEvents = eventsByDay.get(dayKey) || [];
                        const isCurrentDay = isToday(day);
                        const isWeekend = index % 7 >= 5;
                        const minHeight = viewMode === "week" ? "min-h-[180px]" : "min-h-[120px]";
                        const maxEvents = viewMode === "week" ? 4 : 2;

                        return (
                            <div
                                key={dayKey}
                                className={cn(
                                    "relative border-b border-r border-zinc-800/40 p-0 transition-all flex flex-col",
                                    minHeight,
                                    canManage ? "cursor-pointer" : "cursor-default",
                                    isWeekend ? "bg-zinc-950/50" : "bg-zinc-900/40 hover:bg-zinc-800/40",
                                    index % 7 === 6 && "border-r-0"
                                )}
                                onClick={(e) => {
                                    // Only trigger if we clicked the cell itself, not an event button
                                    if (canManage && onDayClick) {
                                        onDayClick(day);
                                    }
                                }}
                            >
                                <div className="p-3 flex-1 flex flex-col">
                                {/* Day Number - BIG */}
                                <div className="flex items-center justify-between mb-2">
                                    <span className={cn(
                                        "h-8 w-8 flex items-center justify-center rounded-full text-base font-bold",
                                        isCurrentDay
                                            ? "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/30"
                                            : "text-zinc-300"
                                    )}>
                                        {format(day, "d")}
                                    </span>
                                    {dayEvents.length > maxEvents && (
                                        <span className="text-sm text-zinc-400 font-semibold">
                                            +{dayEvents.length - maxEvents}
                                        </span>
                                    )}
                                </div>

                                {/* Events - BIGGER PILLS */}
                                <div className="space-y-1.5">
                                    {dayEvents.slice(0, maxEvents).map((event) => {
                                        const start = event.startDate ? new Date(event.startDate) : null;
                                        if (!start || isNaN(start.getTime())) return null;

                                        const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.EVENT_GUILD;
                                        const Icon = config.icon;
                                        const time = format(start, "HH:mm");

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
                                                                "w-full group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left",
                                                                "bg-zinc-900/40 backdrop-blur-md border border-zinc-800/50",
                                                                "hover:bg-zinc-800/60 hover:border-zinc-700/50 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-0.5",
                                                                "active:scale-[0.98] active:translate-y-0"
                                                            )}
                                                        >
                                                            {/* Side Accent Line */}
                                                            <div className={cn("absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all group-hover:top-1 group-hover:bottom-1", config.dot)} />
                                                            
                                                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border border-white/5", config.bg)}>
                                                                <Icon className={cn("h-4 w-4", config.color)} />
                                                            </div>
                                                            
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[11px] font-black uppercase tracking-tighter opacity-50 leading-none mb-1">
                                                                    {time}
                                                                </span>
                                                                <span className="truncate text-zinc-100 group-hover:text-white transition-colors">
                                                                    {event.title}
                                                                </span>
                                                            </div>
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        side="right"
                                                        className="bg-zinc-900 border-zinc-700 p-3 max-w-[220px]"
                                                    >
                                                        <p className="font-bold text-zinc-100">{event.title}</p>
                                                        <p className="text-sm text-zinc-400 mt-1">
                                                            {time} → {format(new Date(event.endDate), "HH:mm")}
                                                        </p>
                                                        {event._count && (
                                                            <div className="flex items-center gap-1.5 mt-2 text-sm text-zinc-500">
                                                                <Users className="h-4 w-4" />
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

            {/* ============ LEGEND (BIG) ============ */}
            <div className="flex items-center justify-center gap-8 py-4">
                {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                    <div key={type} className="flex items-center gap-3">
                        <div className={cn("h-4 w-4 rounded-full", config.dot)} />
                        <span className="text-base font-medium text-zinc-400">{config.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
