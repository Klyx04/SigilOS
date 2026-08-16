'use client';

import { useState, useEffect } from 'react';
import { Timer, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResidencyCountdownProps {
    availableAt: string;
    className?: string;
}

export function ResidencyCountdown({ availableAt, className }: ResidencyCountdownProps) {
    const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

    useEffect(() => {
        const target = new Date(availableAt).getTime();

        const updateCountdown = () => {
            const now = Date.now();
            const diff = target - now;

            if (diff <= 0) {
                setTimeLeft(null);
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft({ hours, minutes, seconds });
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);

        return () => clearInterval(interval);
    }, [availableAt]);

    if (!timeLeft) return null;

    return (
        <div className={cn(
            "relative group overflow-hidden bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left transition-all hover:bg-amber-500/10",
            className
        )}>
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[80px] rounded-full -mr-20 -mt-20 pointer-events-none" />
            
            <div className="relative shrink-0 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 group- transition-transform duration-300">
                <Timer className="w-8 h-8 text-amber-500 animate-pulse" />
            </div>

            <div className="relative flex-1 space-y-2">
                <div className="flex items-center justify-center md:justify-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-black text-amber-500 uppercase tracking-widest">Accès Restreint</h3>
                </div>
                <p className="text-zinc-400 text-xs md:text-sm max-w-xl leading-relaxed">
                    Pour garantir l'intégrité des missions, les nouveaux arrivants doivent attendre <span className="text-white font-bold">24 heures</span> après leur arrivée sur le Dashboard avant d'envoyer leurs preuves.
                </p>
            </div>

            <div className="relative shrink-0 flex items-center gap-3">
                <div className="flex flex-col items-center">
                    <span className="text-2xl md:text-3xl font-black text-white tabular-nums tracking-tighter">
                        {String(timeLeft.hours).padStart(2, '0')}
                    </span>
                    <span className="text-caption font-bold text-amber-500/60 uppercase tracking-tighter">Heures</span>
                </div>
                <span className="text-xl md:text-2xl font-black text-zinc-700 animate-pulse">:</span>
                <div className="flex flex-col items-center">
                    <span className="text-2xl md:text-3xl font-black text-white tabular-nums tracking-tighter">
                        {String(timeLeft.minutes).padStart(2, '0')}
                    </span>
                    <span className="text-caption font-bold text-amber-500/60 uppercase tracking-tighter">Minutes</span>
                </div>
                <span className="text-xl md:text-2xl font-black text-zinc-700 animate-pulse">:</span>
                <div className="flex flex-col items-center">
                    <span className="text-2xl md:text-3xl font-black text-white tabular-nums tracking-tighter">
                        {String(timeLeft.seconds).padStart(2, '0')}
                    </span>
                    <span className="text-caption font-bold text-amber-500/60 uppercase tracking-tighter">Secondes</span>
                </div>
            </div>
        </div>
    );
}
