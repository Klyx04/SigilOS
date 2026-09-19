"use client";

import { useState, useEffect } from "react";
import { format, isToday, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import {
    Clock,
    Users
} from "lucide-react";
import { DofusUiIcon } from "@/components/shared/dofus-ui-icon";
import { calendarEventTheme } from "@/lib/calendar-event-theme";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Libellés, couleurs et pictos Dofus : `@/lib/calendar-event-theme` (source unique).

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
    const config = calendarEventTheme(event.type);
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
                        "flex items-center gap-3 px-4 py-2 rounded-full border bg-surface/50 transition-all hover:bg-elevated/50 group",
                        config.bg,
                        config.border
                    )}
                >
                    {/* Pastille du type (couleur sémantique, jamais un dégradé) */}
                    <div className={cn("h-2 w-2 rounded-full", config.dot)} />

                    {/* Title */}
                    <span className="text-sm font-bold text-foreground truncate max-w-[150px] group-hover:text-warning transition-colors">
                        {event.title}
                    </span>

                    {/* Date */}
                    <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block">
                        {isToday(startDate) ? "Aujourd'hui" : format(startDate, "dd MMM", { locale: fr })} {format(startDate, "HH:mm")}
                    </span>

                    {/* Participants */}
                    <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full bg-background/30 border border-border flex items-center gap-1",
                        isFull ? "text-danger border-danger/30" : "text-muted-foreground"
                    )}>
                        <Users className="h-3 w-3" />
                        {participantCount}{maxParticipants ? `/${maxParticipants}` : ""}
                    </span>
                </motion.button>
            </AnimatePresence>
        </div>
    );
}
