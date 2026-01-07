"use client";

import { useEffect, useState } from "react";
import { Timer, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function getTimeUntilReset() {
    const now = new Date();

    // Create date for the next reset (Monday 08:00)
    const reset = new Date(now);

    const day = now.getDay(); // 0 is Sunday, 1 is Monday
    const daysUntilMonday = (1 + 7 - day) % 7;

    reset.setDate(now.getDate() + daysUntilMonday);
    reset.setHours(8, 0, 0, 0);

    // If today is Monday and it's already past 8am, next reset is next week
    if (day === 1 && now.getHours() >= 8) {
        reset.setDate(reset.getDate() + 7);
    }
    // If today is NOT Monday, but the logic above landed on today (e.g. Sunday -> Monday is tomorrow), it's correct.
    // However, if we are e.g. Tuesday, (1+7-2)%7 = 6 days. Correct.

    // Edge case correction: If logic above sets reset to 'today' (because daysUntilMonday is 0, i.e. it is Monday)
    // but time is past 8am, we already handled it.
    // If it is Monday BEFORE 8am, daysUntilMonday is 0, reset is today 8am. Calculated correctly.
    // Check if reset is in the past (which shouldn't happen with above logic, but safety first)
    if (reset.getTime() <= now.getTime()) {
        reset.setDate(reset.getDate() + 7);
    }

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
        <div className="flex items-center gap-4 bg-indigo-950/20 px-3 py-1.5 rounded-full border border-indigo-500/10 group hover:bg-indigo-950/40 transition-colors">
            <div className="flex items-center gap-2 text-[10px] font-semibold text-indigo-300 uppercase tracking-widest">
                <Timer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prochain Reset</span>
            </div>

            <div className="flex items-baseline gap-1.5 font-mono text-slate-200 text-xs">
                <span className="font-bold">{timeLeft.days}j</span>
                <span className="opacity-60">{timeLeft.hours.toString().padStart(2, '0')}h</span>
                <span className="opacity-60">{timeLeft.minutes.toString().padStart(2, '0')}m</span>
                <span className="text-indigo-400 font-bold w-[18px] text-center animate-pulse">
                    {timeLeft.seconds.toString().padStart(2, '0')}s
                </span>
            </div>
        </div>
    );
}
