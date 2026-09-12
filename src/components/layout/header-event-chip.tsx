"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronRight, Users, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { UpcomingEvent } from "@/server/actions/event-actions";
import { getCalendarEventDetails } from "@/server/actions/calendar-actions";
import { EventDetailModal } from "@/components/calendar/event-detail-modal";
import { format, differenceInMinutes, differenceInHours, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { useSession } from "next-auth/react";

// ─── Type color mapping ───────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, { dot: string; badge: string; label: string }> = {
    RAID_OFFICIAL:    { dot: "bg-danger",    badge: "text-danger",    label: "Raid" },
    EVENT_GUILD:      { dot: "bg-info", badge: "text-info", label: "Event" },
    SESSION_MISSIONS: { dot: "bg-warning",  badge: "text-warning",  label: "Missions" },
    SORTIE_FARM:      { dot: "bg-success",badge: "text-success",label: "Farm" },
    KRALAMOURE:       { dot: "bg-pink-500",   badge: "text-pink-400",   label: "Krala" },
};

function getTypeConfig(type: string) {
    return TYPE_COLOR[type] ?? { dot: "bg-muted", badge: "text-muted-foreground", label: "Event" };
}

// ─── Relative time label ──────────────────────────────────────────────────────
function relativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const mins = differenceInMinutes(date, now);
    if (mins < 0) return "En cours";
    if (mins < 60) return `dans ${mins}min`;
    const hrs = differenceInHours(date, now);
    if (hrs < 24) return `dans ${hrs}h`;
    if (isSameDay(date, new Date(now.getTime() + 86400000))) return "demain";
    return format(date, "d MMM", { locale: fr });
}

// ─── Popover list (multiple events) ──────────────────────────────────────────
function EventsPopover({
    events,
    guildId,
    onClose,
    onSelectEvent,
    loadingId,
}: {
    events: UpcomingEvent[];
    guildId: string;
    onClose: () => void;
    onSelectEvent: (eventId: string) => void;
    loadingId: string | null;
}) {
    return (
        <div
            className={cn(
                "absolute right-0 top-full mt-2 z-[40]",
                "w-72 rounded-xl border border-border bg-background/98 shadow-2xl",
                "animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden"
            )}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-success" />
                <span className="text-caption font-bold text-muted-foreground uppercase tracking-wider">
                    {events.length} événement{events.length > 1 ? "s" : ""} à venir
                </span>
            </div>

            {/* Event list */}
            <div className="py-1">
                {events.map((ev) => {
                    const cfg = getTypeConfig(ev.type);
                    const isLoading = loadingId === ev.id;
                    return (
                        <button
                            key={ev.id}
                            id={`header-event-item-${ev.id}`}
                            onClick={() => {
                                onSelectEvent(ev.id);
                                onClose();
                            }}
                            disabled={!!loadingId}
                            className={cn(
                                "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors",
                                "hover:bg-surface disabled:cursor-not-allowed group"
                            )}
                        >
                            {isLoading ? (
                                <Loader2 className="w-3.5 h-3.5 text-success animate-spin shrink-0" />
                            ) : ev.type === "KRALAMOURE" ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src="/assets/calendar/kralamoure-head.png" alt="Krala" className="w-5 h-5 object-contain shrink-0" />
                            ) : (
                                <span className={cn("w-2 h-2 rounded-full shrink-0 mt-0.5", cfg.dot)} />
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate group-hover:text-foreground transition-colors">
                                    {ev.title}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={cn("text-caption font-bold uppercase tracking-wider", cfg.badge)}>
                                        {cfg.label}
                                    </span>
                                    <span className="text-caption text-muted-foreground">·</span>
                                    <span className="text-caption text-muted-foreground flex items-center gap-1">
                                        <Clock className="w-2.5 h-2.5" />
                                        {relativeTime(ev.startDate)}
                                    </span>
                                    {ev.participantsCount > 0 && (
                                        <>
                                            <span className="text-caption text-muted-foreground">·</span>
                                            <span className="text-caption text-muted-foreground flex items-center gap-1">
                                                <Users className="w-2.5 h-2.5" />
                                                {ev.participantsCount}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground shrink-0 transition-colors" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main chip component ──────────────────────────────────────────────────────
interface HeaderEventChipProps {
    events: UpcomingEvent[];
    guildId: string;
    canViewCalendar: boolean;
}

export function HeaderEventChip({ events, guildId, canViewCalendar }: HeaderEventChipProps) {
    const { data: session } = useSession();
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [modalEvent, setModalEvent] = useState<any | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    // Chantier #87/#88 : le libellé « dans Xmin » dépend de l'heure locale (UTC serveur
    // vs Europe/Paris client) → rendu uniquement après montage pour éviter le mismatch
    // d'hydration React #418 sur TOUTES les pages du layout.
    const [mounted, setMounted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Close popover on outside click
    useEffect(() => {
        if (!popoverOpen) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setPopoverOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [popoverOpen]);

    if (events.length === 0) return null;

    const first = events[0];
    const cfg = getTypeConfig(first.type);
    const multi = events.length > 1;

    // Fetch full event detail then open modal
    const openEvent = async (eventId: string) => {
        if (!canViewCalendar) return;
        setLoadingId(eventId);
        try {
            const result = await getCalendarEventDetails(guildId, eventId);
            if (result.success && result.event) {
                setModalEvent(result.event);
                setModalOpen(true);
            }
        } finally {
            setLoadingId(null);
        }
    };

    const handleChipClick = () => {
        if (!canViewCalendar) return;
        if (multi) {
            setPopoverOpen((v) => !v);
        } else {
            openEvent(first.id);
        }
    };

    const isChipLoading = !multi && loadingId === first.id;

    return (
        <>
            <div ref={containerRef} className="relative">
                <button
                    id="header-event-chip"
                    onClick={handleChipClick}
                    disabled={!canViewCalendar || !!loadingId}
                    title={multi ? `${events.length} événements à venir` : first.title}
                    className={cn(
                        "hidden lg:flex items-center gap-2 h-9 px-3 transition-colors shrink-0",
                        "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        popoverOpen && "bg-foreground/[0.04] text-foreground"
                    )}
                >
                    {/* Icon — spinner when loading single event */}
                    <span className="relative flex items-center justify-center w-3.5 h-3.5 shrink-0">
                        {isChipLoading ? (
                            <Loader2 className="w-3.5 h-3.5 text-success animate-spin" />
                        ) : first.type === "KRALAMOURE" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src="/assets/calendar/kralamoure-head.png" alt="Krala" className="w-5 h-5 object-contain" />
                        ) : (
                            <>
                                <span className={cn(
                                    "absolute w-full h-full rounded-full opacity-25 animate-ping",
                                    cfg.dot
                                )} />
                                <Calendar className="relative w-3.5 h-3.5 text-success" />
                            </>
                        )}
                    </span>

                    {/* Label */}
                    <span className="text-xs font-medium truncate max-w-[120px]">
                        {multi ? `${events.length} événements` : first.title}
                    </span>

                    {/* Relative time badge (single event only) — monté après hydration (#87/#88) */}
                    {!multi && (
                        <span className={cn(
                            "hidden xl:inline-flex items-center text-caption font-bold px-1.5 py-0.5 rounded-md",
                            "bg-surface border border-border",
                            cfg.badge
                        )}>
                            {mounted ? relativeTime(first.startDate) : "…"}
                        </span>
                    )}
                </button>

                {/* Popover — multiple events only */}
                {popoverOpen && multi && (
                    <EventsPopover
                        events={events}
                        guildId={guildId}
                        onClose={() => setPopoverOpen(false)}
                        onSelectEvent={openEvent}
                        loadingId={loadingId}
                    />
                )}
            </div>

            {/* EventDetailModal — read-only, no management actions */}
            {modalEvent && (
                <EventDetailModal
                    event={modalEvent}
                    open={modalOpen}
                    onOpenChange={(v) => {
                        setModalOpen(v);
                        if (!v) setModalEvent(null);
                    }}
                    currentUserId={session?.user?.id ?? ""}
                    guildId={guildId}
                    canManage={false}
                    isAdmin={false}
                />
            )}
        </>
    );
}
