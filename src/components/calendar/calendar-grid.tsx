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
    LayoutGrid
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
    onCreateClick?: () => void;
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
    onCreateClick
}: CalendarGridProps) {
    const [viewMode, setViewMode] = useState<ViewMode>("week");
    const [activeFilter, setActiveFilter] = useState<string | null>(null);

    // Filter events
    const filteredEvents = useMemo(() => {
        if (!activeFilter) return events;
        return events.filter(e => e.type === activeFilter);
    }, [events, activeFilter]);

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
        filteredEvents.forEach(event => {
            const eventDate = new Date(event.startDate);
            const key = format(eventDate, "yyyy-MM-dd");
            const existing = map.get(key) || [];
            map.set(key, [...existing, event]);
        });
        return map;
    }, [filteredEvents]);

    // Type counts
    const typeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        events.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });
        return counts;
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
            {/* ============ BIG HEADER ============ */}
            <div className="flex items-center justify-between p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/50">
                {/* Left - Big Title */}
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center border border-amber-500/30">
                        <CalendarIcon className="h-7 w-7 text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-100">
                            {viewMode === "week"
                                ? `Semaine ${currentWeek}`
                                : format(currentDate, "MMMM yyyy", { locale: fr })
                            }
                        </h2>
                        <p className="text-base text-zinc-400">
                            {format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d", { locale: fr })}
                            {" - "}
                            {format(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMMM yyyy", { locale: fr })}
                        </p>
                    </div>
                </div>

                {/* Right - Big Controls */}
                <div className="flex items-center gap-3">
                    {/* View Toggle */}
                    <div className="flex items-center bg-zinc-950 border border-zinc-700 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode("week")}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
                                viewMode === "week"
                                    ? "bg-amber-500 text-zinc-950"
                                    : "text-zinc-400 hover:text-zinc-200"
                            )}
                        >
                            <CalendarDays className="h-5 w-5" />
                            Semaine
                        </button>
                        <button
                            onClick={() => setViewMode("month")}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
                                viewMode === "month"
                                    ? "bg-amber-500 text-zinc-950"
                                    : "text-zinc-400 hover:text-zinc-200"
                            )}
                        >
                            <LayoutGrid className="h-5 w-5" />
                            Mois
                        </button>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center bg-zinc-950 border border-zinc-700 rounded-xl">
                        <button
                            onClick={handlePrev}
                            className="p-3 hover:bg-zinc-800 rounded-l-xl transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5 text-zinc-300" />
                        </button>
                        <button
                            onClick={() => onDateChange(new Date())}
                            className="px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                        >
                            Aujourd'hui
                        </button>
                        <button
                            onClick={handleNext}
                            className="p-3 hover:bg-zinc-800 rounded-r-xl transition-colors"
                        >
                            <ChevronRight className="h-5 w-5 text-zinc-300" />
                        </button>
                    </div>

                    {/* Create Button */}
                    {canManage && onCreateClick && (
                        <Button
                            onClick={onCreateClick}
                            size="lg"
                            className="h-12 px-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold text-base shadow-lg shadow-amber-500/25"
                        >
                            <Plus className="h-5 w-5 mr-2" />
                            Créer
                        </Button>
                    )}
                </div>
            </div>

            {/* ============ FILTER BAR (BIG PILLS) ============ */}
            <div className="flex items-center gap-3 flex-wrap">
                <button
                    onClick={() => setActiveFilter(null)}
                    className={cn(
                        "flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all border-2",
                        !activeFilter
                            ? "bg-zinc-100 text-zinc-900 border-zinc-100"
                            : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-600 hover:text-zinc-200"
                    )}
                >
                    Tous
                    <span className={cn(
                        "px-2 py-0.5 rounded-md text-xs font-bold",
                        !activeFilter ? "bg-zinc-800 text-zinc-100" : "bg-zinc-800 text-zinc-400"
                    )}>
                        {events.length}
                    </span>
                </button>

                {Object.entries(TYPE_CONFIG).map(([type, config]) => {
                    const count = typeCounts[type] || 0;
                    const Icon = config.icon;
                    const isActive = activeFilter === type;

                    return (
                        <button
                            key={type}
                            onClick={() => setActiveFilter(isActive ? null : type)}
                            className={cn(
                                "flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all border-2",
                                isActive
                                    ? cn(config.bg, config.color, config.border)
                                    : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-600"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            {config.label}
                            <span className={cn(
                                "px-2 py-0.5 rounded-md text-xs font-bold",
                                isActive ? "bg-white/10" : "bg-zinc-800"
                            )}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

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
                                    "relative border-b border-r border-zinc-800/40 p-3 transition-all cursor-pointer",
                                    minHeight,
                                    isWeekend ? "bg-zinc-950/50" : "bg-zinc-900/40 hover:bg-zinc-800/40",
                                    index % 7 === 6 && "border-r-0"
                                )}
                                onClick={() => onDayClick?.(day)}
                            >
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
                                        const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.EVENT_GUILD;
                                        const Icon = config.icon;
                                        const time = format(new Date(event.startDate), "HH:mm");

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
                                                                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all text-left border",
                                                                config.bg, config.color, config.border,
                                                                "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                                                            )}
                                                        >
                                                            <Icon className="h-4 w-4 shrink-0" />
                                                            <span className="font-bold">{time}</span>
                                                            <span className="truncate">{event.title}</span>
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
