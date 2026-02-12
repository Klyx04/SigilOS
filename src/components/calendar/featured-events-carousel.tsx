"use client";

import { useState, useEffect } from "react";
import { format, isToday, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import {
    Clock,
    Users,
    Swords,
    PartyPopper,
    Target,
    Wheat
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
    RAID_OFFICIAL: {
        label: "Raid 3.6",
        icon: Swords,
        color: "text-red-400",
        bg: "bg-red-500/10 border-red-500/20"
    },
    EVENT_GUILD: {
        label: "Event Guilde",
        icon: PartyPopper,
        color: "text-purple-400",
        bg: "bg-purple-500/10 border-purple-500/20"
    },
    SESSION_MISSIONS: {
        label: "Missions",
        icon: Target,
        color: "text-amber-400",
        bg: "bg-amber-500/10 border-amber-500/20"
    },
    SORTIE_FARM: {
        label: "Farm",
        icon: Wheat,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20"
    },
    KRALAMOURE: {
        label: "Kralamoure",
        icon: Users,
        color: "text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20"
    }
};

interface FeaturedEventsCarouselProps {
    events: any[];
    onEventClick: (eventId: string) => void;
}

export function FeaturedEventsCarousel({ events, onEventClick }: FeaturedEventsCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Filter only future/today events and take next 5
    const upcoming = events
        .filter(e => new Date(e.startDate) >= new Date(new Date().setHours(0, 0, 0, 0)))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
        .slice(0, 5);

    useEffect(() => {
        if (upcoming.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % upcoming.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [upcoming.length]);

    if (upcoming.length === 0) return null;

    const event = upcoming[currentIndex];
    const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.EVENT_GUILD;
    const startDate = new Date(event.startDate);

    // Participants logic
    const participantCount = event._count?.participants ||
        (event.participants ? event.participants.length : 0);
    const maxParticipants = event.maxParticipants;
    const isFull = maxParticipants && participantCount >= maxParticipants;

    return (
        <div className="flex justify-center w-full">
            <AnimatePresence mode="wait">
                <motion.button
                    key={event.id}
                    onClick={() => onEventClick(event.id)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                        "flex items-center gap-3 px-4 py-2 rounded-full border bg-zinc-900/50 backdrop-blur-md transition-all hover:bg-zinc-800/50 hover:scale-105 hover:border-zinc-700 group",
                        config.bg.replace("/10", "/20").replace("border-", "border-zinc-800/50 ")
                    )}
                >
                    {/* Status Dot */}
                    <div className={cn("h-2 w-2 rounded-full animate-pulse", config.color.replace("text-", "bg-"))} />

                    {/* Title */}
                    <span className="text-sm font-bold text-zinc-100 truncate max-w-[150px] group-hover:text-amber-400 transition-colors">
                        {event.title}
                    </span>

                    {/* Date */}
                    <span className="text-xs text-zinc-400 font-medium hidden sm:inline-block">
                        {isToday(startDate) ? "Aujourd'hui" : format(startDate, "dd MMM", { locale: fr })} {format(startDate, "HH:mm")}
                    </span>

                    {/* Participants */}
                    <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-950/30 border border-zinc-800 flex items-center gap-1",
                        isFull ? "text-red-400 border-red-900/30" : "text-zinc-500"
                    )}>
                        <Users className="h-3 w-3" />
                        {participantCount}{maxParticipants ? `/${maxParticipants}` : ""}
                    </span>
                </motion.button>
            </AnimatePresence>
        </div>
    );
}
