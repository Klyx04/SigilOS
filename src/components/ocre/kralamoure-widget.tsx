"use client";

// =============================================================================
// KRALAMOURE WIDGET - Community Kralamoure events display
// =============================================================================
// Shows upcoming community-organized Kralamoure events from Metamob

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Calendar,
    RefreshCw,
    Skull,
    Timer,
    Users,
    MessageSquare,
    Sparkles,
} from "lucide-react";
import { formatDistanceToNow, format, isWithinInterval, addMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getGuildKralamoureEvents } from "@/server/actions/ocre-actions";
import type { KralamoureEvent } from "@/lib/metamob-client";

import { importKralaEvent, getImportedKralamoureIds } from "@/server/actions/calendar-actions";
import { toast } from "sonner";
import { CalendarPlus, CalendarCheck } from "lucide-react";

interface KralamoureWidgetProps {
    guildId: string;
    maxEvents?: number;
    canManageCalendar?: boolean;
}

export function KralamoureWidget({ guildId, maxEvents = 3, canManageCalendar = false }: KralamoureWidgetProps) {
    const [events, setEvents] = useState<KralamoureEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [importedIds, setImportedIds] = useState<number[]>([]);

    const loadEvents = useCallback(async () => {
        setLoading(true);
        setError(null);
        const result = await getGuildKralamoureEvents(guildId);
        if (result.success && result.data) {
            // Filter to upcoming events only
            const now = new Date();
            const upcoming = result.data
                .filter((e) => new Date(e.event_datetime) > now)
                .slice(0, maxEvents);
            setEvents(upcoming);

            // Load imported IDs
            const importedResult = await getImportedKralamoureIds(guildId);
            if (importedResult.success) {
                setImportedIds(importedResult.ids);
            }
        } else {
            setError(result.error || "Erreur de chargement");
        }
        setLoading(false);
    }, [guildId, maxEvents]);

    useEffect(() => {
        loadEvents();
        // Refresh every 5 minutes
        const interval = setInterval(loadEvents, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [loadEvents]);

    return (
        <Card className="relative overflow-hidden bg-gradient-to-br from-pink-500/10 via-card/50 to-card/30 backdrop-blur-xl border-pink-500/20">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent pointer-events-none" />

            <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 pb-3 px-5 pt-5">
                <CardTitle className="text-base font-black flex items-center gap-2 text-white">
                    <Skull className="h-5 w-5 text-pink-500 fill-pink-500/10" />
                    Kralamoure
                </CardTitle>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all group"
                    onClick={loadEvents}
                    disabled={loading}
                >
                    <RefreshCw
                        className={cn("h-4 w-4 text-muted-foreground group-hover:text-white transition-colors", loading && "animate-spin")}
                    />
                </Button>
            </CardHeader>

            <CardContent className="relative z-10 space-y-3">
                {loading && events.length === 0 ? (
                    <div className="space-y-3">
                        {[...Array(2)].map((_, i) => (
                            <div key={i} className="h-16 w-full bg-white/5 animate-pulse rounded-lg" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                        <Skull className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        {error}
                    </div>
                ) : events.length === 0 ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                        <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        Aucun événement à venir
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {events.map((event, index) => (
                            <KralamoureEventCard
                                key={event.id}
                                event={event}
                                index={index}
                                canManageCalendar={canManageCalendar}
                                guildId={guildId}
                                isImported={importedIds.includes(event.id)}
                                onImportSuccess={loadEvents}
                            />
                        ))}
                    </AnimatePresence>
                )}
            </CardContent>
        </Card>
    );
}

// -----------------------------------------------------------------------------
// Event Card Sub-component
// -----------------------------------------------------------------------------

interface KralamoureEventCardProps {
    event: KralamoureEvent;
    index: number;
    canManageCalendar: boolean;
    guildId: string;
    isImported: boolean;
    onImportSuccess: () => void;
}

function KralamoureEventCard({ event, index, canManageCalendar, guildId, isImported, onImportSuccess }: KralamoureEventCardProps) {
    const eventTime = new Date(event.event_datetime);
    const now = new Date();
    const [isImporting, setIsImporting] = useState(false);

    // Check if event is happening soon (within 15 minutes)
    const isUpcoming = isWithinInterval(eventTime, {
        start: now,
        end: addMinutes(now, 15),
    });

    // Check if event is happening very soon (within 5 minutes)
    const isImminent = isWithinInterval(eventTime, {
        start: now,
        end: addMinutes(now, 5),
    });

    const handleImport = async () => {
        setIsImporting(true);
        const result = await importKralaEvent(guildId, {
            ...event,
            description: event.description || ""
        });
        if (result.success) {
            toast.success("Événement importé dans le calendrier !");
            onImportSuccess(); // Refresh to update imported status
        } else {
            toast.error(result.error || "Erreur lors de l'import");
        }
        setIsImporting(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
                "relative p-4 rounded-xl border transition-all duration-300 overflow-hidden",
                "bg-zinc-900/40 backdrop-blur-md",
                isImminent
                    ? "border-red-500/50 "
                    : isUpcoming
                        ? "border-amber-500/40"
                        : "border-white/5 hover:border-white/10"
            )}
        >
            {/* Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

            {/* Top Row: Title & Badge */}
            <div className="relative z-10 flex items-start justify-between mb-3">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-white tracking-tight">
                            CHASSE KRALAMOURE
                        </h4>
                        {isUpcoming && <Sparkles className="h-3 w-3 text-amber-400 animate-pulse" />}
                    </div>
                    <p className="text-caption font-black text-pink-500 uppercase tracking-[0.1em]">
                        {event.server.name}
                    </p>
                </div>

                {isImported && (
                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-caption font-black uppercase tracking-widest px-2 py-0.5 rounded-md">
                        <CalendarCheck className="h-3 w-3 mr-1" />
                        Importé
                    </Badge>
                )}
            </div>

            {/* Middle Row: Content & Time */}
            <div className="relative z-10 flex items-end justify-between gap-4">
                <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3 text-caption font-bold text-zinc-500">
                        <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {event.participants_count}
                        </span>
                        {(event.messages_count ?? 0) > 0 && (
                            <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {event.messages_count}
                            </span>
                        )}
                        <span className="opacity-40">par {event.creator}</span>
                    </div>

                    {event.description && (
                        <p className="text-caption text-zinc-400/70 italic line-clamp-1 border-l-2 border-white/5 pl-2">
                            {event.description}
                        </p>
                    )}
                </div>

                <div className="text-right shrink-0">
                    <p className={cn(
                        "text-caption font-black uppercase tracking-wider mb-0.5",
                        isImminent ? "text-red-400" : isUpcoming ? "text-amber-400" : "text-zinc-500"
                    )}>
                        {formatDistanceToNow(eventTime, { locale: fr, addSuffix: true })}
                    </p>
                    <div className="flex items-center gap-3">
                        <span className="text-xl font-black text-white tabular-nums leading-none">
                            {format(eventTime, "HH:mm", { locale: fr })}
                        </span>
                        
                        {canManageCalendar && !isImported && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 rounded-lg bg-white/5 border-white/10 hover:bg-pink-500 hover:text-white hover:border-pink-500 transition-all"
                                onClick={handleImport}
                                disabled={isImporting}
                            >
                                {isImporting ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                    <CalendarPlus className="h-4 w-4" />
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
