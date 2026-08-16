"use client";

import { useEffect, useState } from "react";
import { Swords, Users, Clock, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface RaidEvent {
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
    location?: string | null;
    maxParticipants?: number | null;
    _count?: { participants: number };
}

function useCountdown(endDate: Date) {
    const [remaining, setRemaining] = useState<{ h: number; m: number; s: number } | null>(null);
    // Use a stable timestamp (number) as dependency to avoid infinite re-renders
    const endTs = new Date(endDate).getTime();

    useEffect(() => {
        function tick() {
            const diff = endTs - Date.now();
            if (diff <= 0) { setRemaining(null); return; }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setRemaining({ h, m, s });
        }
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [endTs]); // ✅ number — stable reference

    return remaining;
}

export function RaidHeroBanner({
    guildId,
    raid
}: {
    guildId: string;
    raid: RaidEvent;
}) {
    const countdown = useCountdown(new Date(raid.endDate));
    const participants = raid._count?.participants ?? 0;
    const maxParts = raid.maxParticipants;
    const fillPct = maxParts ? Math.min(100, (participants / maxParts) * 100) : null;

    const pad = (n: number) => String(n).padStart(2, "0");

    return (
        <div className="relative group overflow-hidden rounded-3xl border border-danger/20 bg-background/80 animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Ambient glow */}
            <div className="absolute -inset-4 bg-danger/10 blur-3xl pointer-events-none opacity-60 group-hover:opacity-90 transition-opacity duration-300" />
            {/* Scanline overlay */}
            <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(239,68,68,0.02)_2px,rgba(239,68,68,0.02)_4px)] pointer-events-none" />
            {/* Animated border glow */}
            <div className="absolute inset-0 rounded-3xl ring-1 ring-danger/30 group-hover:ring-danger/50 transition-all duration-300" />

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6 p-6 md:p-8">
                {/* Icon + Status */}
                <div className="flex items-center gap-4 shrink-0">
                    <div className="relative">
                        <div className="h-16 w-16 rounded-2xl bg-danger/10 border border-danger/30 flex items-center justify-center   transition-shadow duration-300">
                            <Swords className="w-8 h-8 text-danger" />
                        </div>
                        {/* Pulse ring */}
                        <span className="absolute -top-1 -right-1 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-50" />
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-danger items-center justify-center">
                                <Zap className="w-2 h-2 text-foreground" />
                            </span>
                        </span>
                    </div>
                    <div className="md:hidden">
                        <span className="text-caption font-black uppercase tracking-widest text-danger block">Raid Officiel</span>
                        <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">En cours maintenant</span>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 space-y-3">
                    <div className="hidden md:block">
                        <span className="text-caption font-black uppercase tracking-widest text-danger">Raid Officiel · En cours</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground uppercase italic leading-tight">
                        {raid.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        {raid.location && (
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-muted" />
                                {raid.location}
                            </span>
                        )}
                        <span className="flex items-center gap-1.5 text-danger/80">
                            <Users className="w-3.5 h-3.5" />
                            {participants}{maxParts ? `/${maxParts}` : ""} participants
                        </span>
                    </div>

                    {/* Participant Fill Bar */}
                    {fillPct !== null && (
                        <div className="w-full max-w-xs space-y-1">
                            <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-danger to-danger rounded-full transition-all duration-300"
                                    style={{ width: `${fillPct}%` }}
                                />
                            </div>
                            <p className="text-caption text-muted-foreground font-bold uppercase tracking-widest">
                                {fillPct >= 100 ? "Raid complet" : `${Math.round(fillPct)}% de places prises`}
                            </p>
                        </div>
                    )}
                </div>

                {/* Countdown + CTA */}
                <div className="flex flex-col items-start md:items-end gap-4 shrink-0">
                    {countdown ? (
                        <div className="flex flex-col items-start md:items-end gap-1">
                            <span className="text-caption font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                Se termine dans
                            </span>
                            <div className="flex items-center gap-1 font-mono">
                                {countdown.h > 0 && (
                                    <>
                                        <span className="text-2xl font-black text-danger tabular-nums">{pad(countdown.h)}</span>
                                        <span className="text-sm text-muted-foreground font-black">h</span>
                                    </>
                                )}
                                <span className="text-2xl font-black text-danger tabular-nums">{pad(countdown.m)}</span>
                                <span className="text-sm text-muted-foreground font-black">m</span>
                                <span className="text-2xl font-black text-danger tabular-nums animate-pulse">{pad(countdown.s)}</span>
                                <span className="text-sm text-muted-foreground font-black">s</span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">Raid terminé</span>
                    )}

                    <Button
                        asChild
                        className="h-11 bg-danger hover:bg-danger text-danger-foreground font-black px-6 rounded-2xl group/btn transition-all  active:scale-95 shadow-[0_8px_24px_rgba(239,68,68,0.35)]"
                    >
                        <Link href={`/dashboard/${guildId}/calendar?event=${raid.id}`}>
                            <span className="flex items-center gap-2">
                                Voir le Raid
                                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </span>
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
