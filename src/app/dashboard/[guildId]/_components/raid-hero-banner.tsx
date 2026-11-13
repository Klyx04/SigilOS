"use client";

import { useEffect, useState } from "react";
import { Users, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { resolveEventImagePath } from "@/lib/calendar-event-images";

interface RaidEvent {
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
    location?: string | null;
    maxParticipants?: number | null;
    /** `metadata.raidType` (`gigalodon` | `jardin`) choisit le **visuel réel** du raid. */
    metadata?: unknown;
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
        <div className="relative overflow-hidden rounded-xl border border-border bg-surface">
            <div className="relative flex flex-col md:flex-row items-start md:items-center gap-5 p-5 md:p-6">
                {/* Visuel **réel** du raid — même source que les cartes du calendrier
                    (`resolveEventImagePath`), jamais un glyphe générique. */}
                <div className="flex items-center gap-3 shrink-0">
                    <img
                        src={resolveEventImagePath("RAID_OFFICIAL", raid.metadata)}
                        alt=""
                        width={56}
                        height={56}
                        className="h-14 w-14 rounded-lg border border-border object-cover"
                        onError={(e) => { e.currentTarget.src = "/assets/calendar/calendar_raid_official.png"; }}
                    />
                    <div className="md:hidden">
                        <span className="text-caption font-semibold text-danger block">Raid officiel</span>
                        <span className="text-xs text-muted-foreground">En cours</span>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0 space-y-3">
                    <div className="hidden md:block">
                        <span className="text-caption font-semibold text-danger">Raid officiel · en cours</span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground leading-tight">
                        {raid.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        {raid.location && (
                            <span className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-muted" />
                                {raid.location}
                            </span>
                        )}
                        <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            {participants}{maxParts ? `/${maxParts}` : ""} participants
                        </span>
                    </div>

                    {/* Participant Fill Bar */}
                    {fillPct !== null && (
                        <div className="w-full max-w-xs space-y-1">
                            <div className="h-1.5 bg-elevated rounded-sm overflow-hidden">
                                <div
                                    className="h-full bg-danger transition-colors duration-200"
                                    style={{ width: `${fillPct}%` }}
                                />
                            </div>
                            <p className="text-caption text-muted-foreground">
                                {fillPct >= 100 ? "Raid complet" : `${Math.round(fillPct)}% de places prises`}
                            </p>
                        </div>
                    )}
                </div>

                {/* Countdown + CTA */}
                <div className="flex flex-col items-start md:items-end gap-4 shrink-0">
                    {countdown ? (
                        <div className="flex flex-col items-start md:items-end gap-1">
                            <span className="text-caption font-semibold text-muted-foreground flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                Se termine dans
                            </span>
                            <div className="flex items-center gap-1 font-mono">
                                {countdown.h > 0 && (
                                    <>
                                        <span className="text-2xl font-semibold text-danger tabular-nums">{pad(countdown.h)}</span>
                                        <span className="text-sm text-muted-foreground font-medium">h</span>
                                    </>
                                )}
                                <span className="text-2xl font-semibold text-danger tabular-nums">{pad(countdown.m)}</span>
                                <span className="text-sm text-muted-foreground font-medium">m</span>
                                <span className="text-2xl font-semibold text-danger tabular-nums">{pad(countdown.s)}</span>
                                <span className="text-sm text-muted-foreground font-medium">s</span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-caption font-semibold text-muted-foreground">Raid terminé</span>
                    )}

                    <Button asChild className="bg-danger text-danger-foreground hover:bg-danger/90">
                        <Link href={`/dashboard/${guildId}/calendar?event=${raid.id}`}>
                            Voir le raid
                            <ArrowRight className="size-4" />
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
