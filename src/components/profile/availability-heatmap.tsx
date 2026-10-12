"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { DAYS_OF_WEEK, TIME_SLOTS, type AvailabilityMap, type DayOfWeek, type TimeSlot, type GlobalAvailability } from "@/lib/dofus-assets";
import { useDebouncedCallback } from "use-debounce";
import { Clock, Sunrise, Sun, Moon, Sunset, ChevronLeft, ChevronRight, CalendarDays, Plane } from "lucide-react";
import { format, addWeeks, startOfWeek, endOfWeek, isWithinInterval, getISOWeek, getYear } from "date-fns";
import { fr } from "date-fns/locale";

interface AvailabilityHeatmapProps {
    availability?: GlobalAvailability | AvailabilityMap; // Accept both for compatibility
    onSave?: (availability: GlobalAvailability) => void;
    readOnly?: boolean;
    vacationStart?: Date | null;
    vacationEnd?: Date | null;
}

const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
    matin: "Matin",
    midi: "Après-midi",
    soir: "Soirée",
    nuit: "Nuit"
};

const TIME_SLOT_HOURS: Record<TimeSlot, string> = {
    matin: "06h - 12h",
    midi: "12h - 18h",
    soir: "18h - 00h",
    nuit: "00h - 06h"
};

const TIME_SLOT_ICONS: Record<TimeSlot, React.ReactNode> = {
    matin: <Sunrise className="w-4 h-4 text-amber-400" />,
    midi: <Sun className="w-4 h-4 text-warning" />,
    soir: <Sunset className="w-4 h-4 text-violet-400" />,
    nuit: <Moon className="w-4 h-4 text-info" />
};

const TIME_SLOT_COLORS: Record<TimeSlot, { bg: string; border: string; glow: string; text: string }> = {
    matin: {
        bg: "bg-amber-400/20",
        border: "border-amber-400/50",
        glow: "",
        text: "text-amber-400",
    },
    midi: {
        bg: "bg-warning/20",
        border: "border-warning/50",
        glow: "",
        text: "text-warning",
    },
    soir: {
        bg: "bg-violet-500/20",
        border: "border-violet-500/50",
        glow: "",
        text: "text-violet-400",
    },
    nuit: {
        bg: "bg-info/20",
        border: "border-info/50",
        glow: "",
        text: "text-info",
    },
};

const DAY_LABELS: Record<DayOfWeek, string> = {
    lundi: "Lun",
    mardi: "Mar",
    mercredi: "Mer",
    jeudi: "Jeu",
    vendredi: "Ven",
    samedi: "Sam",
    dimanche: "Dim",
};

export function AvailabilityHeatmap({
    availability = {},
    onSave,
    readOnly = false,
    vacationStart,
    vacationEnd
}: AvailabilityHeatmapProps) {
    // -------------------------------------------------------------------------
    // STATE: MIGRATION & DATA
    // -------------------------------------------------------------------------

    // Normalize input data to GlobalAvailability structure
    const initialData: GlobalAvailability = useMemo(() => {
        // Check if it's legacy data (simple map)
        const isLegacy = Object.keys(availability).some(k => DAYS_OF_WEEK.includes(k as any));

        if (isLegacy) {
            return {
                template: availability as AvailabilityMap,
                weeks: {}
            };
        }

        return (availability as GlobalAvailability).template ? (availability as GlobalAvailability) : { template: {}, weeks: {} };
    }, [availability]);

    const [globalData, setGlobalData] = useState<GlobalAvailability>(initialData);

    // Week Navigation State (0 = current week)
    const [weekOffset, setWeekOffset] = useState(0);
    const [hoveredSlot, setHoveredSlot] = useState<{ day: DayOfWeek, slot: TimeSlot } | null>(null);

    // -------------------------------------------------------------------------
    // HELPERS: DATE & KEYS
    // -------------------------------------------------------------------------

    // Get current view's reference date (Monday of the selected week)
    const currentMonday = useMemo(() => {
        const now = new Date();
        const start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
        return addWeeks(start, weekOffset);
    }, [weekOffset]);

    // Generate Key for current week: "YYYY-W#"
    const currentWeekKey = useMemo(() => {
        const year = getYear(currentMonday);
        const week = getISOWeek(currentMonday);
        return `${year}-W${week}`;
    }, [currentMonday]);

    // Get actual dates for headers
    const weekDates = useMemo(() => {
        const dates: Record<DayOfWeek, Date> = {} as any;
        DAYS_OF_WEEK.forEach((day, idx) => {
            const date = new Date(currentMonday);
            date.setDate(currentMonday.getDate() + idx);
            dates[day] = date;
        });
        return dates;
    }, [currentMonday]);

    // -------------------------------------------------------------------------
    // LOGIC: GET & SET SLOTS
    // -------------------------------------------------------------------------

    // Get effective availability for current view
    // Priority: Specific Week > Template > Empty
    const currentWeekData = useMemo(() => {
        return globalData.weeks?.[currentWeekKey] || globalData.template || {};
    }, [globalData, currentWeekKey]);

    const isSlotActive = useCallback((day: DayOfWeek, slot: TimeSlot) => {
        return currentWeekData[day]?.includes(slot) ?? false;
    }, [currentWeekData]);

    const isVacation = useCallback((day: DayOfWeek) => {
        if (!vacationStart || !vacationEnd) return false;
        const date = weekDates[day];
        // Normalize time for comparison
        const d = new Date(date); d.setHours(12, 0, 0, 0);
        const start = new Date(vacationStart); start.setHours(0, 0, 0, 0);
        const end = new Date(vacationEnd); end.setHours(23, 59, 59, 999);
        return d >= start && d <= end;
    }, [weekDates, vacationStart, vacationEnd]);

    const debouncedSave = useDebouncedCallback((data: GlobalAvailability) => {
        onSave?.(data);
    }, 1000);

    const toggleSlot = (day: DayOfWeek, slot: TimeSlot) => {
        if (readOnly) return;
        if (isVacation(day)) return;
        if (isPast(day)) return; // Prevent editing past dates

        setGlobalData(prev => {
            // ... (rest of logic same as before, just ensuring we don't break indentation, but since I'm replacing the whole function start, I need to be careful. Actually, I will just replace the specific lines in the loop and the toggle function, but this tool requires contiguous blocks. I'll split into two edits for safety or replace the whole block if confident.)
            // Wait, I can't replace `toggleSlot` AND the render loop in one contiguous block easily without including a huge chunk.
            // I will replace `toggleSlot` first.
            const existingWeekData = prev.weeks?.[currentWeekKey];
            const baseData = existingWeekData || prev.template || {};

            const currentSlots = baseData[day] || [];
            const newSlots = currentSlots.includes(slot)
                ? currentSlots.filter(s => s !== slot)
                : [...currentSlots, slot];

            const newWeekData = {
                ...baseData,
                [day]: newSlots
            };

            const newData = {
                ...prev,
                weeks: {
                    ...(prev.weeks || {}),
                    [currentWeekKey]: newWeekData
                }
            };

            debouncedSave(newData);
            return newData;
        });
    };

    // -------------------------------------------------------------------------
    // UI RENDER
    // -------------------------------------------------------------------------

    const isToday = (day: DayOfWeek) => {
        const today = new Date();
        const date = weekDates[day];
        return today.getDate() === date.getDate() &&
            today.getMonth() === date.getMonth() &&
            today.getFullYear() === date.getFullYear();
    };

    const isPast = (day: DayOfWeek) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const date = new Date(weekDates[day]);
        date.setHours(0, 0, 0, 0);
        return date < today;
    };

    return (
        <div className="p-6 bg-black/20 backdrop-blur-md rounded-2xl border border-border h-full flex flex-col relative overflow-hidden">

            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div>
                        <h3 className="text-sm font-medium text-foreground">Disponibilités</h3>
                        <p className="text-xs text-muted-foreground">
                            Semaine {getISOWeek(currentMonday)} • Année {getYear(currentMonday)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-background/50 p-1 rounded-lg border border-border">
                    <button
                        onClick={() => setWeekOffset(prev => prev - 1)}
                        className="p-1.5 hover:bg-surface rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="px-2 text-xs font-medium text-foreground min-w-[140px] text-center flex items-center justify-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 opacity-70" />
                        {weekOffset === 0 ? "Cette semaine" : format(currentMonday, "d MMMM", { locale: fr }) + " - " + format(endOfWeek(currentMonday, { weekStartsOn: 1 }), "d MMMM", { locale: fr })}
                    </div>
                    <button
                        onClick={() => setWeekOffset(prev => prev + 1)}
                        className="p-1.5 hover:bg-surface rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Heatmap Grid */}
            <div className="flex-1 overflow-x-auto min-h-[220px] flex items-center justify-center">
                <div className="relative">
                    <table className="w-full border-separate border-spacing-1.5 ">
                        <thead>
                            <tr>
                                <th className="w-24"></th>
                                {DAYS_OF_WEEK.map(day => {
                                    const date = weekDates[day];
                                    const isVacationDay = isVacation(day);

                                    return (
                                        <th key={day} className="text-center w-14 pb-2 relative group">
                                            <div className={cn(
                                                "flex flex-col items-center gap-1 py-1 px-2 rounded-lg transition-colors border",
                                                isToday(day)
                                                    ? "bg-primary/10 border-primary/30"
                                                    : "border-transparent",
                                                isVacationDay && "opacity-50 grayscale"
                                            )}>
                                                <span className={cn(
                                                    "text-xs font-semibold uppercase tracking-wider",
                                                    isToday(day) ? "text-primary" : "text-muted-foreground"
                                                )}>
                                                    {DAY_LABELS[day]}
                                                </span>
                                                <span className={cn(
                                                    "text-lg font-bold",
                                                    isToday(day) ? "text-primary" : "text-muted-foreground"
                                                )}>
                                                    {date.getDate()}
                                                </span>
                                            </div>

                                            {/* Vacation Indicator Badge */}
                                            {isVacationDay && (
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-info/90 text-caption text-info-foreground font-bold px-1.5 py-0.5 rounded-full z-10 flex items-center gap-1 shadow-lg">
                                                    <Plane className="w-2.5 h-2.5" />
                                                </div>
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {TIME_SLOTS.map(slot => {
                                const colors = TIME_SLOT_COLORS[slot];
                                return (
                                    <tr key={slot}>
                                        <td className="py-1 pr-3">
                                            <div className="flex items-center gap-2">
                                                <span className={cn("shrink-0", colors.text)}>
                                                    {TIME_SLOT_ICONS[slot]}
                                                </span>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-muted-foreground">
                                                        {TIME_SLOT_LABELS[slot]}
                                                    </span>
                                                    <span className="text-caption text-muted-foreground">
                                                        {TIME_SLOT_HOURS[slot]}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        {DAYS_OF_WEEK.map(day => {
                                            const isActive = isSlotActive(day, slot);
                                            const isVacationDay = isVacation(day);
                                            const isPastDay = isPast(day);
                                            const isHovered = hoveredSlot?.day === day && hoveredSlot?.slot === slot;

                                            return (
                                                <td key={`${day}-${slot}`} className="p-0 relative">
                                                    <button
                                                        onClick={() => toggleSlot(day, slot)}
                                                        onMouseEnter={() => !readOnly && setHoveredSlot({ day, slot })}
                                                        onMouseLeave={() => !readOnly && setHoveredSlot(null)}
                                                        disabled={readOnly || isVacationDay || isPastDay}
                                                        className={cn(
                                                            "w-14 h-11 rounded-lg transition-all duration-200 border transform relative overflow-hidden",
                                                            // Normal State (Active Future)
                                                            !isVacationDay && !isPastDay && isActive
                                                                ? cn(colors.bg, colors.border, "shadow-sm")
                                                                : "bg-surface border-border",

                                                            // Hover States (Active Future)
                                                            !readOnly && !isVacationDay && !isPastDay && isHovered && !isActive && "scale-105 bg-elevated border-border-strong",
                                                            !readOnly && !isVacationDay && !isPastDay && isHovered && isActive && cn("scale-105", colors.bg, colors.border),

                                                            // Past State
                                                            isPastDay && "cursor-not-allowed opacity-30 grayscale brightness-50 border-transparent",

                                                            // Vacation State (High Contrast Fix)
                                                            isVacationDay && !isPastDay && "cursor-not-allowed opacity-70 bg-danger/10 border-danger/20 grayscale-0",
                                                            readOnly && "cursor-default"
                                                        )}
                                                    >
                                                        {/* Active Dot */}
                                                        <div className={cn(
                                                            "w-full h-full flex items-center justify-center transition-all",
                                                            isActive && !isVacationDay ? "opacity-100" : "opacity-0"
                                                        )}>
                                                            <div className={cn(
                                                                "w-2.5 h-2.5 rounded-full shadow-sm",
                                                                slot === "matin" && "bg-warning",
                                                                slot === "midi" && "bg-warning",
                                                                slot === "soir" && "bg-violet-400",
                                                                slot === "nuit" && "bg-info"
                                                            )} />
                                                        </div>

                                                        {/* Vacation Strikethrough (Brighter Red) */}
                                                        {isVacationDay && (
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div className="w-[140%] h-[2px] bg-danger/60 rotate-45 transform " />
                                                            </div>
                                                        )}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Minimal Legend with Hours */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t border-border text-caption text-muted-foreground">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /> <Sunrise className="w-3.5 h-3.5 text-amber-400" /> <span>Matin (06h - 12h)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-warning" /> <Sun className="w-3.5 h-3.5 text-warning" /> <span>Après-midi (12h - 18h)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-violet-400" /> <Sunset className="w-3.5 h-3.5 text-violet-400" /> <span>Soirée (18h - 00h)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-info" /> <Moon className="w-3.5 h-3.5 text-info" /> <span>Nuit (00h - 06h)</span></div>
                <div className="flex items-center gap-1.5 ml-2 text-info"><Plane className="w-3.5 h-3.5" /> <span>Absent (Congés)</span></div>
            </div>
        </div>
    );
}
