'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
    createdAt: Date;
    className?: string;
};

const EXPIRATION_HOURS = 24;

export function SubmissionCountdown({ createdAt, className }: Props) {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [percentLeft, setPercentLeft] = useState<number>(100);
    const [isUrgent, setIsUrgent] = useState(false);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const created = new Date(createdAt).getTime();
            const expiresAt = created + (EXPIRATION_HOURS * 60 * 60 * 1000); // 24h
            const remaining = expiresAt - now;

            if (remaining <= 0) {
                setTimeLeft('Expiré');
                setPercentLeft(0);
                setIsUrgent(true);
                return;
            }

            // Calculate percentage remaining
            const totalTime = EXPIRATION_HOURS * 60 * 60 * 1000;
            const percent = (remaining / totalTime) * 100;
            setPercentLeft(percent);

            // Set urgent if less than 2 hours left
            setIsUrgent(remaining < 2 * 60 * 60 * 1000);

            // Format time left
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

            if (hours > 0) {
                setTimeLeft(`${hours}h ${minutes}m`);
            } else {
                setTimeLeft(`${minutes}m`);
            }
        };

        calculateTimeLeft();
        const interval = setInterval(calculateTimeLeft, 60000); // Update every minute

        return () => clearInterval(interval);
    }, [createdAt]);

    return (
        <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg backdrop-blur-sm",
            isUrgent
                ? "bg-red-500/40 text-red-200 border border-red-500/60 animate-pulse"
                : percentLeft < 50
                    ? "bg-orange-500/40 text-orange-200 border border-orange-500/60"
                    : "bg-zinc-800/80 text-zinc-200 border border-zinc-600/80",
            className
        )}>
            <Clock className={cn(
                "w-3 h-3",
                isUrgent ? "animate-pulse" : ""
            )} />
            <span>{timeLeft}</span>
            <div className="w-12 h-1 bg-black/60 rounded-full overflow-hidden ml-1">
                <div
                    className={cn(
                        "h-full transition-all duration-1000",
                        isUrgent
                            ? "bg-red-400"
                            : percentLeft < 50
                                ? "bg-orange-400"
                                : "bg-zinc-400"
                    )}
                    style={{ width: `${percentLeft}%` }}
                />
            </div>
        </div>
    );
}
