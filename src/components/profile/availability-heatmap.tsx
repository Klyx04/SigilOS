"use client";

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { DAYS_OF_WEEK, TIME_SLOTS, type AvailabilityMap, type DayOfWeek, type TimeSlot } from "@/lib/dofus-assets";
import { useDebouncedCallback } from "use-debounce";
import { Clock, Sunrise, Sun, Moon } from "lucide-react";

interface AvailabilityHeatmapProps {
    availability?: AvailabilityMap;
    onSave?: (availability: AvailabilityMap) => void;
    readOnly?: boolean;
}

const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
    matin: "Matin",
    midi: "Après-midi",
    soir: "Soir",
};

const TIME_SLOT_HOURS: Record<TimeSlot, string> = {
    matin: "6h-12h",
    midi: "12h-18h",
    soir: "18h-00h",
};

const TIME_SLOT_ICONS: Record<TimeSlot, React.ReactNode> = {
    matin: <Sunrise className="w-4 h-4" />,
    midi: <Sun className="w-4 h-4" />,
    soir: <Moon className="w-4 h-4" />,
};

const TIME_SLOT_COLORS: Record<TimeSlot, { bg: string; border: string; glow: string; text: string }> = {
    matin: {
        bg: "bg-orange-500/20",
        border: "border-orange-500/50",
        glow: "shadow-[0_0_10px_rgba(249,115,22,0.3)]",
        text: "text-orange-400",
    },
    midi: {
        bg: "bg-amber-400/20",
        border: "border-amber-400/50",
        glow: "shadow-[0_0_10px_rgba(251,191,36,0.3)]",
        text: "text-amber-400",
    },
    soir: {
        bg: "bg-violet-500/20",
        border: "border-violet-500/50",
        glow: "shadow-[0_0_10px_rgba(139,92,246,0.3)]",
        text: "text-violet-400",
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

// Map day names to JavaScript day numbers (0=Sunday, 1=Monday, etc.)
const DAY_TO_JS_DAY: Record<DayOfWeek, number> = {
    dimanche: 0,
    lundi: 1,
    mardi: 2,
    mercredi: 3,
    jeudi: 4,
    vendredi: 5,
    samedi: 6,
};

function getWeekDates(): Record<DayOfWeek, number> {
    const today = new Date();
    const currentJsDay = today.getDay(); // 0-6 (Sunday-Saturday)

    // Calculate Monday of current week
    // If today is Sunday (0), Monday was 6 days ago
    // Otherwise, Monday was (currentJsDay - 1) days ago
    const mondayOffset = currentJsDay === 0 ? -6 : (1 - currentJsDay);
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const dates: Record<DayOfWeek, number> = {} as Record<DayOfWeek, number>;

    DAYS_OF_WEEK.forEach((day, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        dates[day] = date.getDate();
    });

    return dates;
}

export function AvailabilityHeatmap({
    availability = {},
    onSave,
    readOnly = false,
}: AvailabilityHeatmapProps) {
    const [localAvailability, setLocalAvailability] = useState<AvailabilityMap>(availability);
    const [hoveredSlot, setHoveredSlot] = useState<{ day: DayOfWeek, slot: TimeSlot } | null>(null);

    // Calculate week dates once
    const weekDates = useMemo(() => getWeekDates(), []);

    const debouncedSave = useDebouncedCallback((data: AvailabilityMap) => {
        onSave?.(data);
    }, 1000);

    const isSlotActive = useCallback((day: DayOfWeek, slot: TimeSlot) => {
        return localAvailability[day]?.includes(slot) ?? false;
    }, [localAvailability]);

    const toggleSlot = (day: DayOfWeek, slot: TimeSlot) => {
        if (readOnly) return;

        setLocalAvailability(prev => {
            const daySlots = prev[day] || [];
            const newSlots = daySlots.includes(slot)
                ? daySlots.filter(s => s !== slot)
                : [...daySlots, slot];

            const newAvailability = {
                ...prev,
                [day]: newSlots,
            };

            debouncedSave(newAvailability);
            return newAvailability;
        });
    };

    // Check if a day is today
    const isToday = (day: DayOfWeek): boolean => {
        const today = new Date();
        return today.getDay() === DAY_TO_JS_DAY[day];
    };

    return (
        <div className="p-6 bg-zinc-900/60 rounded-2xl border border-white/5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-zinc-400" />
                    <h3 className="text-sm font-medium text-zinc-400">Disponibilités Hebdomadaires</h3>
                </div>
                {!readOnly && (
                    <span className="text-xs text-zinc-600">Cliquez pour modifier</span>
                )}
            </div>

            <div className="flex-1 overflow-x-auto min-h-[180px] flex items-center justify-center">
                <div className="relative">
                    <table className="w-full border-separate border-spacing-1.5">
                        <thead>
                            <tr>
                                <th className="w-24"></th>
                                {DAYS_OF_WEEK.map(day => (
                                    <th
                                        key={day}
                                        className={cn(
                                            "text-center w-14 pb-2",
                                            isToday(day) && "relative"
                                        )}
                                    >
                                        <div className={cn(
                                            "flex flex-col items-center gap-1 py-1 px-2 rounded-lg transition-colors",
                                            isToday(day) && "bg-primary/10 border border-primary/30"
                                        )}>
                                            <span className={cn(
                                                "text-xs font-semibold uppercase tracking-wider",
                                                isToday(day) ? "text-primary" : "text-zinc-500"
                                            )}>
                                                {DAY_LABELS[day]}
                                            </span>
                                            <span className={cn(
                                                "text-lg font-bold",
                                                isToday(day) ? "text-primary" : "text-zinc-600"
                                            )}>
                                                {weekDates[day]}
                                            </span>
                                        </div>
                                    </th>
                                ))}
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
                                                    <span className="text-xs font-medium text-zinc-400">
                                                        {TIME_SLOT_LABELS[slot]}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-600">
                                                        {TIME_SLOT_HOURS[slot]}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        {DAYS_OF_WEEK.map(day => {
                                            const isActive = isSlotActive(day, slot);
                                            const isHovered = hoveredSlot?.day === day && hoveredSlot?.slot === slot;
                                            return (
                                                <td key={`${day}-${slot}`} className="p-0">
                                                    <button
                                                        onClick={() => toggleSlot(day, slot)}
                                                        onMouseEnter={() => !readOnly && setHoveredSlot({ day, slot })}
                                                        onMouseLeave={() => !readOnly && setHoveredSlot(null)}
                                                        disabled={readOnly}
                                                        className={cn(
                                                            "w-14 h-11 rounded-lg transition-all duration-200 border transform",
                                                            isActive
                                                                ? cn(colors.bg, colors.border, colors.glow)
                                                                : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10",
                                                            !readOnly && isHovered && !isActive && "scale-105 bg-white/10 border-white/20",
                                                            !readOnly && isHovered && isActive && cn("scale-105", colors.bg, colors.border),
                                                            readOnly && "cursor-default"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-full h-full flex items-center justify-center transition-all",
                                                            isActive ? "opacity-100" : "opacity-0"
                                                        )}>
                                                            <div className={cn(
                                                                "w-2.5 h-2.5 rounded-full",
                                                                slot === "matin" && "bg-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.8)]",
                                                                slot === "midi" && "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]",
                                                                slot === "soir" && "bg-violet-400 shadow-[0_0_6px_rgba(139,92,246,0.8)]"
                                                            )} />
                                                        </div>
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

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-white/5 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                        <span className="text-orange-400/80">Matin</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        <span className="text-amber-400/80">Après-midi</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-violet-400" />
                        <span className="text-violet-400/80">Soir</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
