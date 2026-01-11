"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DAYS_OF_WEEK, TIME_SLOTS, type AvailabilityMap, type DayOfWeek, type TimeSlot } from "@/lib/dofus-assets";
import { useDebouncedCallback } from "use-debounce";
import { Clock } from "lucide-react";

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
}: AvailabilityHeatmapProps) {
    const [localAvailability, setLocalAvailability] = useState<AvailabilityMap>(availability);
    const [hoveredSlot, setHoveredSlot] = useState<{ day: DayOfWeek, slot: TimeSlot } | null>(null);

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

    return (
        <div className="p-6 bg-zinc-900/60 rounded-2xl border border-white/5 h-full flex flex-col">
            <div className="flex items-center gap-2 mb-6">
                <Clock className="w-5 h-5 text-zinc-400" />
                <h3 className="text-sm font-medium text-zinc-400">Disponibilités Hebdomadaires</h3>
            </div>

            <div className="flex-1 overflow-x-auto min-h-[160px] flex items-center justify-center">
                <div className="relative">
                    {/* Background Grid Lines optional */}
                    <table className="w-full border-separate border-spacing-2">
                        <thead>
                            <tr>
                                <th className="w-20"></th>
                                {DAYS_OF_WEEK.map(day => (
                                    <th key={day} className="text-xs font-semibold text-zinc-500 pb-2 text-center w-12 uppercase tracking-wider">
                                        {DAY_LABELS[day]}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {TIME_SLOTS.map(slot => (
                                <tr key={slot}>
                                    <td className="text-xs font-medium text-zinc-500 pr-4 py-1 text-right">
                                        {TIME_SLOT_LABELS[slot]}
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
                                                    title={!readOnly ? "Cliquer pour modifier" : undefined}
                                                    className={cn(
                                                        "w-12 h-10 rounded-lg transition-all duration-200 border transform",
                                                        isActive
                                                            ? "bg-emerald-500/20 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                                                            : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10",
                                                        !readOnly && isHovered && !isActive && "scale-105 bg-white/10 border-white/20",
                                                        !readOnly && isHovered && isActive && "scale-105 bg-emerald-500/30 border-emerald-500",
                                                        readOnly && "cursor-default"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-full h-full flex items-center justify-center transition-opacity",
                                                        isActive ? "opacity-100" : "opacity-0"
                                                    )}>
                                                        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,1)]" />
                                                    </div>
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-white/5 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <span>Disponible</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-white/5 border border-white/5" />
                    <span>Indisponible</span>
                </div>
            </div>
        </div>
    );
}
