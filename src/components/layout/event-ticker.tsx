"use client";

import { useState, useEffect } from "react";
import { format, isToday, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import {
    Users,
    Swords,
    PartyPopper,
    Target,
    Wheat,
    Calendar,
    Eye,
    Gamepad2,
    MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { UpcomingEvent } from "@/server/actions/event-actions";

const TYPE_CONFIG: Record<string, { label: string; shortLabel: string; icon: React.ElementType; color: string; bg: string; glow: string }> = {
    RAID_OFFICIAL: {
        label: "Raid 3.6",
        shortLabel: "RAID",
        icon: Swords,
        color: "text-danger",
        bg: "bg-danger/10 border-danger/20",
        glow: "shadow-red-500/20"
    },
    EVENT_GUILD: {
        label: "Event Guilde",
        shortLabel: "EVENT",
        icon: PartyPopper,
        color: "text-info",
        bg: "bg-info/10 border-info/20",
        glow: "shadow-purple-500/20"
    },
    SESSION_MISSIONS: {
        label: "Missions",
        shortLabel: "MISSIONS",
        icon: Target,
        color: "text-warning",
        bg: "bg-warning/10 border-warning/20",
        glow: "shadow-amber-500/20"
    },
    SORTIE_FARM: {
        label: "Farm",
        shortLabel: "FARM",
        icon: Wheat,
        color: "text-success",
        bg: "bg-success/10 border-success/20",
        glow: "shadow-emerald-500/20"
    },
    KRALAMOURE: {
        label: "Kralamoure",
        shortLabel: "KRALA",
        icon: Eye,
        color: "text-pink-400",
        bg: "bg-pink-500/10 border-pink-500/20",
        glow: "shadow-pink-500/20"
    },
    GAME_GEOGUESSER: {
        label: "Guesser",
        shortLabel: "LIVE",
        icon: MapPin,
        color: "text-info",
        bg: "bg-info/10 border-info/20",
        glow: "shadow-blue-500/20"
    },
    GAME_KING: {
        label: "Sigil King",
        shortLabel: "LIVE",
        icon: Gamepad2,
        color: "text-success",
        bg: "bg-success/10 border-success/20",
        glow: "shadow-emerald-500/20"
    }
};

interface EventTickerProps {
    events: UpcomingEvent[];
    guildId: string;
    canViewCalendar?: boolean;
}

export function EventTicker({ events, guildId, canViewCalendar = true }: EventTickerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Filter only future/today events and take next 5
    const upcoming = events
        .filter(e => new Date(e.startDate) >= new Date(new Date().setHours(0, 0, 0, 0)))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        .slice(0, 5);

    useEffect(() => {
        if (upcoming.length <= 1) {
            if (currentIndex !== 0) setCurrentIndex(0);
            return;
        }

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % upcoming.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [upcoming.length, currentIndex]);

    // Safety: Reset index if out of bounds (e.g. after a deletion)
    useEffect(() => {
        if (currentIndex >= upcoming.length && upcoming.length > 0) {
            setCurrentIndex(0);
        }
    }, [upcoming.length, currentIndex]);

    if (upcoming.length === 0) {
        if (!canViewCalendar) return (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border opacity-50">
                <div className="p-1 rounded-full bg-elevated text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                    Aucun événement prévu
                </span>
            </div>
        );

        return (
            <Link
                href={`/dashboard/${guildId}/calendar`}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border hover:bg-surface transition-colors group"
            >
                <div className="p-1 rounded-full bg-elevated text-muted-foreground group-hover:text-foreground transition-colors">
                    <Calendar className="w-3 h-3" />
                </div>
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                    Aucun événement prévu
                </span>
            </Link>
        );
    }

    const event = upcoming[currentIndex];
    if (!event) return null;

    // @ts-ignore - Handle type mismatch gracefully
    const typeConfig = TYPE_CONFIG[event.type] || TYPE_CONFIG.EVENT_GUILD;
    const startDate = new Date(event.startDate);

    // Participants logic
    const participantCount = event.participantsCount || 0;
    // @ts-ignore
    const maxParticipants = event.maxParticipants;
    const isFull = maxParticipants && participantCount >= maxParticipants;

    // Link Logic
    let href = `/dashboard/${guildId}/calendar?event=${event.id}`;
    const isLive = (event.metadata as any)?.isLive;
    const gameState = (event.metadata as any)?.state;

    if (event.type === "GAME_GEOGUESSER") {
        const spec = gameState !== 'LOBBY' ? '&spectate=true' : '';
        href = `/dashboard/${guildId}/mini-jeux?room=${(event.metadata as any).roomId}${spec}#mini-jeux`;
    }

    return (
        <div className="flex justify-center w-full">
            <AnimatePresence mode="wait">
                {canViewCalendar ? (
                    <Link
                        key={event.id}
                        href={href}
                        className={cn(
                            "flex h-8 items-center gap-2.5 px-3 rounded-full border bg-background/40 backdrop-blur-xl transition-all hover:bg-foreground/[0.05] hover:scale-[1.02] active:scale-95 group relative shadow-lg shrink-0",
                            typeConfig.glow,
                            typeConfig.bg.replace("border-", "border-border group-hover:border-")
                        )}
                    >
                        {isLive && (
                            <span className="absolute -top-1 -left-1 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger"></span>
                            </span>
                        )}
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="flex items-center gap-2.5"
                        >
                            {/* Type Badge */}
                            <div className={cn(
                                "text-caption font-black px-1.5 py-0.5 rounded-md tracking-tighter uppercase",
                                typeConfig.bg, typeConfig.color, "border-none"
                            )}>
                                {typeConfig.shortLabel}
                            </div>

                            {/* Status Dot */}
                            <div className={cn("h-1.5 w-1.5 rounded-full", typeConfig.color.replace("text-", "bg-"))} />

                            {/* Title */}
                            <span className="text-caption font-black text-foreground uppercase tracking-tight truncate max-w-[120px] lg:max-w-[180px] group-hover:text-primary transition-colors italic">
                                {event.title}
                            </span>

                            {/* Date */}
                            <span className="text-caption text-muted-foreground font-black uppercase tracking-widest hidden sm:inline-block whitespace-nowrap">
                                {isToday(startDate) ? "Aujourd'hui" : format(startDate, "dd MMM", { locale: fr })} {format(startDate, "HH:mm")}
                            </span>

                            {/* Participants */}
                            <span className={cn(
                                "text-caption font-black px-2 py-0.5 rounded-full bg-black/40 border border-border flex items-center gap-1 min-w-[32px] justify-center",
                                isFull ? "text-danger border-danger/30" : "text-muted-foreground"
                            )}>
                                <Users className="h-2.5 w-2.5" />
                                {participantCount}
                            </span>
                        </motion.div>
                    </Link>
                ) : (
                    <div
                        key={event.id}
                        className={cn(
                            "flex h-8 items-center gap-2.5 px-3 rounded-full border bg-background/40 backdrop-blur-md opacity-80 group relative shadow-lg shrink-0",
                            typeConfig.glow,
                            typeConfig.bg.replace("border-", "border-border group-hover:border-")
                        )}
                    >
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                            className="flex items-center gap-2.5"
                        >
                            {/* Type Badge */}
                            <div className={cn(
                                "text-caption font-black px-1.5 py-0.5 rounded-md tracking-tighter uppercase",
                                typeConfig.bg, typeConfig.color, "border-none"
                            )}>
                                {typeConfig.shortLabel}
                            </div>

                            {/* Status Dot */}
                            <div className={cn("h-1.5 w-1.5 rounded-full", typeConfig.color.replace("text-", "bg-"))} />

                            {/* Title */}
                            <span className="text-sm font-bold text-foreground truncate max-w-[120px] lg:max-w-[200px]">
                                {event.title}
                            </span>

                            {/* Date */}
                            <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block">
                                {isToday(startDate) ? "Aujourd'hui" : format(startDate, "dd MMM", { locale: fr })} {format(startDate, "HH:mm")}
                            </span>

                            {/* Participants */}
                            <span className={cn(
                                "text-caption font-black px-2 py-0.5 rounded-full bg-black/40 border border-border flex items-center gap-1 min-w-[32px] justify-center",
                                isFull ? "text-danger border-danger/30" : "text-muted-foreground"
                            )}>
                                <Users className="h-2.5 w-2.5" />
                                {participantCount}
                            </span>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
