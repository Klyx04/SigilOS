"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DAYS_OF_WEEK, TIME_SLOTS, type AvailabilityMap, type DayOfWeek, type TimeSlot } from "@/lib/dofus-assets";
import { useDebouncedCallback } from "use-debounce";

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
        <div className="p-6 bg-zinc-900/60 rounded-2xl border border-white/5">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">Disponibilités</h3>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr>
                            <th className="w-16"></th>
                            {DAYS_OF_WEEK.map(day => (
                                <th key={day} className="text-xs font-medium text-zinc-500 pb-2">
                                    {DAY_LABELS[day]}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {TIME_SLOTS.map(slot => (
                            <tr key={slot}>
                                <td className="text-xs font-medium text-zinc-500 pr-2 py-1">
                                    {TIME_SLOT_LABELS[slot]}
                                </td>
                                {DAYS_OF_WEEK.map(day => (
                                    <td key={`${day}-${slot}`} className="p-1">
                                        <button
                                            onClick={() => toggleSlot(day, slot)}
                                            disabled={readOnly}
                                            className={cn(
                                                "w-full h-8 rounded transition-all",
                                                isSlotActive(day, slot)
                                                    ? "bg-primary/60 hover:bg-primary/70"
                                                    : "bg-white/5 hover:bg-white/10",
                                                readOnly && "cursor-default"
                                            )}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-primary/60" />
                    <span>Disponible</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-white/5" />
                    <span>Indisponible</span>
                </div>
            </div>
        </div>
    );
}
