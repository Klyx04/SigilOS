"use client";

import { useEffect, useState } from "react";
import { Timer, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function getTimeUntilReset() {
    const now = new Date();

    // Create date for the next reset (Tuesday 07:00)
    const reset = new Date(now);

    const day = now.getDay(); // 0 is Sunday, 1 is Monday, 2 is Tuesday
    // (targetDay + 7 - currentDay) % 7. Tuesday is 2.
    let daysUntilTuesday = (2 + 7 - day) % 7;

    // If today is Tuesday and it's already past 7am, next reset is next week
    if (day === 2 && now.getHours() >= 7) {
        daysUntilTuesday = 7;
    }

    reset.setDate(now.getDate() + daysUntilTuesday);
    reset.setHours(7, 0, 0, 0);

    const diff = reset.getTime() - now.getTime();

    // Convert to days, hours, minutes, seconds
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
}

export function ResetCountdown() {
    const [timeLeft, setTimeLeft] = useState(getTimeUntilReset());
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const timer = setInterval(() => {
            setTimeLeft(getTimeUntilReset());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Prevent hydration mismatch
    if (!mounted) return null;

    return (
        <div className="flex items-center gap-4 bg-info/20 px-3 py-1.5 rounded-full border border-info/10 group hover:bg-info/40 transition-colors">
            <div className="flex items-center gap-2 text-caption font-semibold text-info uppercase tracking-widest">
                <Timer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prochain Reset</span>
            </div>

            <div className="flex items-baseline gap-1.5 font-mono text-foreground text-xs">
                <span className="font-bold">{timeLeft.days}j</span>
                <span className="opacity-60">{timeLeft.hours.toString().padStart(2, '0')}h</span>
                <span className="opacity-60">{timeLeft.minutes.toString().padStart(2, '0')}m</span>
                <span className="text-info font-bold w-[18px] text-center animate-pulse">
                    {timeLeft.seconds.toString().padStart(2, '0')}s
                </span>
            </div>
        </div>
    );
}
