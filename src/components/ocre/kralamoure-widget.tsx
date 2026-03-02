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

            <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Skull className="h-5 w-5 text-pink-400" />
                    Kralamoure
                </CardTitle>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={loadEvents}
                    disabled={loading}
                >
                    <RefreshCw
                        className={cn("h-4 w-4 text-muted-foreground", loading && "animate-spin")}
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
                "relative p-3 rounded-lg border transition-all duration-300",
                "bg-gradient-to-r from-black/30 to-transparent",
                isImminent
                    ? "border-red-500/50 bg-red-500/10 animate-pulse"
                    : isUpcoming
                        ? "border-amber-500/40 bg-amber-500/5"
                        : "border-white/10 hover:border-pink-500/30"
            )}
        >
            {/* Imminent indicator */}
            {isImminent && (
                <div className="absolute -top-1 -right-1">
                    <Badge className="bg-red-500 text-white text-[10px] font-bold animate-bounce">
                        <Timer className="h-2.5 w-2.5 mr-0.5" />
                        Bientôt !
                    </Badge>
                </div>
            )}

            {/* Imported indicator */}
            {isImported && (
                <div className="absolute -top-1 -left-1">
                    <Badge className="bg-green-500 text-white text-[10px] font-bold">
                        <CalendarCheck className="h-2.5 w-2.5 mr-0.5" />
                        Importé
                    </Badge>
                </div>
            )}

            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    {/* Event title/description */}
                    <h4 className="font-medium text-sm flex items-center gap-2">
                        Chasse Kralamoure
                        {isUpcoming && <span className="text-amber-400">✨</span>}
                    </h4>

                    {/* Server */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{event.server.name}</span>
                    </div>

                    {/* Participants & messages */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1 cursor-help">
                                        <Users className="h-3 w-3" />
                                        {event.participants_count}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {event.participants_count} participants ({event.character_count} personnages)
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        {(event.messages_count ?? 0) > 0 && (
                            <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {event.messages_count}
                            </span>
                        )}
                        <span className="text-muted-foreground/40">par {event.creator}</span>
                    </div>

                    {/* Description if available */}
                    {event.description && (
                        <p className="text-[10px] text-muted-foreground/70 line-clamp-2 mt-1">
                            {event.description}
                        </p>
                    )}
                </div>

                {/* Time & Actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right">
                        <p
                            className={cn(
                                "text-xs font-medium",
                                isImminent
                                    ? "text-red-400"
                                    : isUpcoming
                                        ? "text-amber-400"
                                        : "text-pink-400"
                            )}
                        >
                            {formatDistanceToNow(eventTime, { locale: fr, addSuffix: true })}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                            {format(eventTime, "HH:mm", { locale: fr })}
                        </p>
                    </div>

                    {/* Import Button */}
                    {canManageCalendar && (
                        <Button
                            variant="outline"
                            size="icon"
                            className={cn(
                                "h-6 w-6 mt-1 border-white/10",
                                isImported
                                    ? "bg-green-500/20 text-green-400 cursor-not-allowed"
                                    : "hover:bg-pink-500/20 hover:text-pink-400"
                            )}
                            onClick={handleImport}
                            disabled={isImporting || isImported}
                            title={isImported ? "Déjà importé" : "Importer dans le calendrier"}
                        >
                            {isImporting ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : isImported ? (
                                <CalendarCheck className="h-3.5 w-3.5" />
                            ) : (
                                <CalendarPlus className="h-3.5 w-3.5" />
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
