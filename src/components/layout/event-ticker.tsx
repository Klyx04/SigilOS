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
    Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { UpcomingEvent } from "@/server/actions/event-actions";

const TYPE_CONFIG: Record<string, { label: string; shortLabel: string; icon: React.ElementType; color: string; bg: string; glow: string }> = {
    RAID_OFFICIAL: {
        label: "Raid 3.6",
        shortLabel: "RAID",
        icon: Swords,
        color: "text-red-400",
        bg: "bg-red-500/10 border-red-500/20",
        glow: "shadow-red-500/20"
    },
    EVENT_GUILD: {
        label: "Event Guilde",
        shortLabel: "EVENT",
        icon: PartyPopper,
        color: "text-purple-400",
        bg: "bg-purple-500/10 border-purple-500/20",
        glow: "shadow-purple-500/20"
    },
    SESSION_MISSIONS: {
        label: "Missions",
        shortLabel: "MISSIONS",
        icon: Target,
        color: "text-amber-400",
        bg: "bg-amber-500/10 border-amber-500/20",
        glow: "shadow-amber-500/20"
    },
    SORTIE_FARM: {
        label: "Farm",
        shortLabel: "FARM",
        icon: Wheat,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
        glow: "shadow-emerald-500/20"
    },
    KRALAMOURE: {
        label: "Kralamoure",
        shortLabel: "KRALA",
        icon: Eye,
        color: "text-pink-400",
        bg: "bg-pink-500/10 border-pink-500/20",
        glow: "shadow-pink-500/20"
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
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 opacity-50">
                <div className="p-1 rounded-full bg-zinc-800 text-zinc-400">
                    <Calendar className="w-3 h-3" />
                </div>
                <span className="text-xs font-medium text-zinc-500">
                    Aucun événement prévu
                </span>
            </div>
        );

        return (
            <Link
                href={`/dashboard/${guildId}/calendar`}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group"
            >
                <div className="p-1 rounded-full bg-zinc-800 text-zinc-400 group-hover:text-white transition-colors">
                    <Calendar className="w-3 h-3" />
                </div>
                <span className="text-xs font-medium text-zinc-500 group-hover:text-zinc-300">
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

    return (
        <div className="flex justify-center w-full">
            <AnimatePresence mode="wait">
                {canViewCalendar ? (
                    <Link
                        key={event.id}
                        href={`/dashboard/${guildId}/calendar?event=${event.id}`}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full border bg-zinc-900/40 backdrop-blur-xl transition-all hover:bg-zinc-800/60 hover:scale-105 active:scale-95 group relative shadow-lg",
                            typeConfig.glow,
                            typeConfig.bg.replace("/10", "/20").replace("border-", "border-white/10 group-hover:border-")
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
                                "text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-tighter uppercase",
                                typeConfig.bg, typeConfig.color, "border-none"
                            )}>
                                {typeConfig.shortLabel}
                            </div>

                            {/* Status Dot */}
                            <div className={cn("h-1.5 w-1.5 rounded-full", typeConfig.color.replace("text-", "bg-"))} />

                            {/* Title */}
                            <span className="text-sm font-bold text-zinc-100 truncate max-w-[120px] lg:max-w-[200px] group-hover:text-amber-400 transition-colors">
                                {event.title}
                            </span>

                            {/* Date */}
                            <span className="text-xs text-zinc-400 font-medium hidden sm:inline-block">
                                {isToday(startDate) ? "Aujourd'hui" : format(startDate, "dd MMM", { locale: fr })} {format(startDate, "HH:mm")}
                            </span>

                            {/* Participants */}
                            <span className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded-full bg-black/40 border border-white/5 flex items-center gap-1 min-w-[32px] justify-center",
                                isFull ? "text-red-400 border-red-500/30" : "text-zinc-500"
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
                            "flex items-center gap-2 px-3 py-1.5 rounded-full border bg-zinc-900/40 backdrop-blur-md opacity-80 group relative shadow-lg",
                            typeConfig.glow,
                            typeConfig.bg.replace("/10", "/20").replace("border-", "border-white/10 group-hover:border-")
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
                                "text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-tighter uppercase",
                                typeConfig.bg, typeConfig.color, "border-none"
                            )}>
                                {typeConfig.shortLabel}
                            </div>

                            {/* Status Dot */}
                            <div className={cn("h-1.5 w-1.5 rounded-full", typeConfig.color.replace("text-", "bg-"))} />

                            {/* Title */}
                            <span className="text-sm font-bold text-zinc-100 truncate max-w-[120px] lg:max-w-[200px]">
                                {event.title}
                            </span>

                            {/* Date */}
                            <span className="text-xs text-zinc-400 font-medium hidden sm:inline-block">
                                {isToday(startDate) ? "Aujourd'hui" : format(startDate, "dd MMM", { locale: fr })} {format(startDate, "HH:mm")}
                            </span>

                            {/* Participants */}
                            <span className={cn(
                                "text-[10px] font-black px-2 py-0.5 rounded-full bg-black/40 border border-white/5 flex items-center gap-1 min-w-[32px] justify-center",
                                isFull ? "text-red-400 border-red-500/30" : "text-zinc-400"
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
