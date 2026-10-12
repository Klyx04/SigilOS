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
    /** Jours de la semaine AUTORISÉS (0=Dim … 6=Sam). Les autres jours sont grisés et non sélectionnables. */
    allowedDaysOfWeek?: number[];
    /** Fenêtre horaire [début, fin] en heures (0-23) pour la sélection d'heure. */
    hourRange?: [number, number];
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
    allowedDaysOfWeek,
    hourRange,
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
        // Mode contraint (Titan) : bloque la sélection d'un jour hors fenêtre de disponibilité.
        if (allowedDaysOfWeek && allowedDaysOfWeek.length > 0 && !allowedDaysOfWeek.includes(day.getDay())) return;
        if (noTime) {
            // Date only — set midnight, no time
            day.setHours(0, 0, 0, 0);
            onChange(toLocalISOString(day));
            setOpen(false);
        } else {
            let h = selectedDate?.getHours() ?? 20;
            // Clampe l'heure par défaut dans la fenêtre de dispo (si fournie) pour ne pas atterrir hors créneau.
            if (hourRange) {
                const [lo, hi] = hourRange;
                const inRange = lo <= hi ? (h >= lo && h <= hi) : (h >= lo || h <= hi);
                if (!inRange) h = lo <= hi ? lo : hi;
            }
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
                        "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm transition-all text-left",
                        "bg-surface/60 hover:bg-surface/80 border-border text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 hover:border-border shadow-xl",
                        !value && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon className="w-4 h-4 text-info shrink-0" />
                    <span className="flex-1 truncate">
                        {value ? formatDisplay(value, noTime) : placeholder}
                    </span>
                    {value && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleClear(); }}
                            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="start"
                className="w-auto p-0 bg-background border border-border shadow-2xl rounded-2xl overflow-hidden z-[200]"
            >
                {/* Tab toggle */}
                <div className="flex border-b border-border">
                    <button
                        type="button"
                        onClick={() => setView("calendar")}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors",
                            view === "calendar"
                                ? "text-info bg-info/10 border-b-2 border-info"
                                : "text-muted-foreground hover:text-foreground"
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
                                ? "text-info bg-info/10 border-b-2 border-info"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        Heure
                        {selectedDate && !noTime && (
                            <span className="ml-1 font-mono text-info">
                                {pad(selectedHour)}:{pad(selectedMinute)}
                            </span>
                        )}
                        {noTime && <span className="ml-1 text-muted-foreground text-caption">optionnel</span>}
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
                                            ? "bg-muted/20 border-border/40 text-foreground"
                                            : "bg-surface border-border text-muted-foreground hover:text-foreground"
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
                            disabled={(() => {
                                const matchers: any[] = [];
                                if (minDate) matchers.push({ before: minDate });
                                // Jours à griser = complément des jours AUTORISÉS (0=Dim … 6=Sam).
                                if (allowedDaysOfWeek && allowedDaysOfWeek.length > 0) {
                                    const toDisable = [0, 1, 2, 3, 4, 5, 6].filter((d) => !allowedDaysOfWeek.includes(d));
                                    if (toDisable.length) matchers.push({ daysOfWeek: toDisable });
                                }
                                return matchers.length ? matchers : undefined;
                            })()}
                            locale={fr}
                            className="text-foreground [&_.rdp-day]:text-foreground [&_.rdp-day_button:hover]:bg-info/20 [&_.rdp-day_button[aria-selected=true]]:bg-info [&_.rdp-day_button[aria-selected=true]]:text-info-foreground [&_.rdp-head_cell]:text-muted-foreground"
                        />
                        {selectedDate && !noTime && (
                            <div className="px-3 pb-3 pt-1 text-center">
                                <button
                                    type="button"
                                    onClick={() => setView("time")}
                                    className="text-xs font-bold text-info hover:text-info transition-colors"
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
                            <p className="text-caption font-black uppercase tracking-widest text-muted-foreground">Heure</p>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => handleHourChange(-1)}
                                    className="w-8 h-8 rounded-lg bg-surface hover:bg-surface flex items-center justify-center transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                                </button>
                                <div className="flex-1 grid grid-cols-6 gap-1">
                                    {HOURS.filter((h) => {
                                        if (!hourRange) return true;
                                        // Gère les fenêtres qui passent minuit (ex. 19h→8h) : start > end.
                                        return hourRange[0] <= hourRange[1]
                                            ? (h >= hourRange[0] && h <= hourRange[1])
                                            : (h >= hourRange[0] || h <= hourRange[1]);
                                    }).map((h) => (
                                        <button
                                            key={h}
                                            type="button"
                                            onClick={() => handleTimeChange(h, selectedMinute)}
                                            className={cn(
                                                "h-8 rounded-lg text-xs font-bold transition-all",
                                                h === selectedHour
                                                    ? "bg-info text-info-foreground shadow-sm"
                                                    : "text-muted-foreground hover:bg-surface hover:text-foreground"
                                            )}
                                        >
                                            {pad(h)}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleHourChange(1)}
                                    className="w-8 h-8 rounded-lg bg-surface hover:bg-surface flex items-center justify-center transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        {/* Minute selector */}
                        <div className="space-y-2">
                            <p className="text-caption font-black uppercase tracking-widest text-muted-foreground">Minutes</p>
                            <div className="grid grid-cols-4 gap-2">
                                {MINUTES.map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => handleTimeChange(selectedHour, m)}
                                        className={cn(
                                            "h-10 rounded-xl text-sm font-bold transition-all",
                                            m === selectedMinute
                                                ? "bg-info text-info-foreground shadow-sm"
                                                : "bg-surface text-muted-foreground hover:bg-surface hover:text-foreground"
                                        )}
                                    >
                                        :{pad(m)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Summary + confirm */}
                        <div className="pt-2 border-t border-border flex items-center justify-between">
                            <div className="font-mono text-lg font-black text-foreground">
                                {pad(selectedHour)}:{pad(selectedMinute)}
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                onClick={() => setOpen(false)}
                                className="bg-info hover:bg-info text-info-foreground font-bold px-5"
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
