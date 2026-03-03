"use client";

import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Clock, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fr } from "date-fns/locale";

interface DateTimePickerProps {
    value: string;              // ISO string slice "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD"
    onChange: (value: string) => void;
    minDate?: Date;
    placeholder?: string;
    className?: string;
    timeOptional?: boolean;     // If true, show "Sans heure" option
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

function pad(n: number) {
    return String(n).padStart(2, "0");
}

function formatDisplay(value: string, noTime: boolean): string {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "";
    const datePart = d.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    if (noTime) return datePart;
    return datePart + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function toLocalISOString(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DateTimePicker({
    value,
    onChange,
    minDate,
    placeholder = "Choisir une date et heure",
    className,
    timeOptional = false,
}: DateTimePickerProps) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<"calendar" | "time">("calendar");
    // noTime = user chose date-only mode (when timeOptional=true)
    const [noTime, setNoTime] = useState(false);

    const selectedDate = useMemo(() => {
        if (!value) return undefined;
        const d = new Date(value);
        return isNaN(d.getTime()) ? undefined : d;
    }, [value]);

    const selectedHour = selectedDate?.getHours() ?? 20;
    const selectedMinute = selectedDate?.getMinutes() ?? 0;

    function handleDaySelect(day: Date | undefined) {
        if (!day) return;
        if (noTime) {
            // Date only — set midnight, no time
            day.setHours(0, 0, 0, 0);
            onChange(toLocalISOString(day));
            setOpen(false);
        } else {
            const h = selectedDate?.getHours() ?? 20;
            const m = selectedDate?.getMinutes() ?? 0;
            day.setHours(h, m, 0, 0);
            onChange(toLocalISOString(day));
            setView("time");
        }
    }

    function handleTimeChange(hour: number, minute: number) {
        const base = selectedDate ? new Date(selectedDate) : new Date();
        base.setHours(hour, minute, 0, 0);
        onChange(toLocalISOString(base));
    }

    function handleHourChange(delta: number) {
        const newH = (selectedHour + delta + 24) % 24;
        handleTimeChange(newH, selectedMinute);
    }

    function handleClear() {
        onChange("");
        setOpen(false);
        setView("calendar");
        setNoTime(false);
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all text-left",
                        "bg-slate-900 border-white/5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/50 shadow-inner",
                        !value && "text-slate-500",
                        className
                    )}
                >
                    <CalendarIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span className="flex-1 truncate">
                        {value ? formatDisplay(value, noTime) : placeholder}
                    </span>
                    {value && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleClear(); }}
                            className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="start"
                className="w-auto p-0 bg-zinc-950 border border-white/10 shadow-2xl rounded-2xl overflow-hidden z-50"
            >
                {/* Tab toggle */}
                <div className="flex border-b border-white/5">
                    <button
                        type="button"
                        onClick={() => setView("calendar")}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors",
                            view === "calendar"
                                ? "text-indigo-400 bg-indigo-500/10 border-b-2 border-indigo-500"
                                : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <CalendarIcon className="w-3.5 h-3.5" />
                        Date
                    </button>
                    <button
                        type="button"
                        onClick={() => setView("time")}
                        disabled={!selectedDate || noTime}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                            view === "time"
                                ? "text-indigo-400 bg-indigo-500/10 border-b-2 border-indigo-500"
                                : "text-slate-500 hover:text-slate-300"
                        )}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        Heure
                        {selectedDate && !noTime && (
                            <span className="ml-1 font-mono text-indigo-400">
                                {pad(selectedHour)}:{pad(selectedMinute)}
                            </span>
                        )}
                        {noTime && <span className="ml-1 text-slate-600 text-[10px]">optionnel</span>}
                    </button>
                </div>

                {/* Calendar view */}
                {view === "calendar" && (
                    <div className="p-2">
                        {/* Optional: "Sans heure" toggle */}
                        {timeOptional && (
                            <div className="px-2 pb-2 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setNoTime(v => !v)}
                                    className={cn(
                                        "flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-all",
                                        noTime
                                            ? "bg-slate-600/20 border-slate-500/40 text-slate-300"
                                            : "bg-zinc-900 border-white/5 text-slate-500 hover:text-slate-300"
                                    )}
                                >
                                    <Clock className="w-3 h-3" />
                                    {noTime ? "Heure désactivée" : "Sans heure (optionnel)"}
                                </button>
                            </div>
                        )}
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={handleDaySelect}
                            disabled={minDate ? { before: minDate } : undefined}
                            locale={fr}
                            className="text-white [&_.rdp-day]:text-slate-300 [&_.rdp-day_button:hover]:bg-indigo-500/20 [&_.rdp-day_button[aria-selected=true]]:bg-indigo-600 [&_.rdp-head_cell]:text-slate-500"
                        />
                        {selectedDate && !noTime && (
                            <div className="px-3 pb-3 pt-1 text-center">
                                <button
                                    type="button"
                                    onClick={() => setView("time")}
                                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                    Choisir l&apos;heure →
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Time view */}
                {view === "time" && selectedDate && !noTime && (
                    <div className="p-4 space-y-4 w-72">
                        {/* Hour selector */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Heure</p>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleHourChange(-1)}
                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4 text-slate-400" />
                                </button>
                                <div className="flex-1 grid grid-cols-6 gap-1">
                                    {HOURS.map((h) => (
                                        <button
                                            key={h}
                                            type="button"
                                            onClick={() => handleTimeChange(h, selectedMinute)}
                                            className={cn(
                                                "h-8 rounded-lg text-xs font-bold transition-all",
                                                h === selectedHour
                                                    ? "bg-indigo-600 text-white shadow-sm"
                                                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                                            )}
                                        >
                                            {pad(h)}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleHourChange(1)}
                                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* Minute selector */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Minutes</p>
                            <div className="grid grid-cols-4 gap-2">
                                {MINUTES.map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => handleTimeChange(selectedHour, m)}
                                        className={cn(
                                            "h-10 rounded-xl text-sm font-bold transition-all",
                                            m === selectedMinute
                                                ? "bg-indigo-600 text-white shadow-sm"
                                                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                                        )}
                                    >
                                        :{pad(m)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Summary + confirm */}
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                            <div className="font-mono text-lg font-black text-white">
                                {pad(selectedHour)}:{pad(selectedMinute)}
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setOpen(false)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5"
                            >
                                Confirmer
                            </Button>
                        </div>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
