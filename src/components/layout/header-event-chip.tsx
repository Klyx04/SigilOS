"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronRight, Users, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { UpcomingEvent } from "@/server/actions/event-actions";
import { getCalendarEventDetails } from "@/server/actions/calendar-actions";
import { EventDetailModal } from "@/components/calendar/event-detail-modal";
import { DofusUiIcon } from "@/components/shared/dofus-ui-icon";
import { calendarEventTheme } from "@/lib/calendar-event-theme";
import { format, differenceInMinutes, differenceInHours, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { useSession } from "next-auth/react";

/**
 * Vignette d'un événement : **l'illustration réelle** servie par le serveur
 * (`imageUrl` : donjon, titan, Kralamoure), sinon le picto Dofus du type
 * (`calendar-event-theme`, source unique). Un asset absent (404) retombe sur
 * le picto — jamais une image cassée.
 */
function EventThumb({ event, size = 20 }: { event: UpcomingEvent; size?: number }) {
    const [failed, setFailed] = useState(false);
    const theme = calendarEventTheme(event.type);

    if (failed || !event.imageUrl) {
        return <DofusUiIcon name={theme.picto} size={size} />;
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={event.imageUrl}
            alt=""
            width={size}
            height={size}
            onError={() => setFailed(true)}
            className="object-contain shrink-0 select-none"
            style={{ width: size, height: size }}
        />
    );
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
                    const theme = calendarEventTheme(ev.type);
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
                            ) : (
                                <EventThumb event={ev} size={22} />
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate group-hover:text-foreground transition-colors">
                                    {ev.title}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className={cn("text-caption font-bold uppercase tracking-wider", theme.color)}>
                                        {theme.shortLabel}
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
    const theme = calendarEventTheme(first.type);
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
                        "hidden lg:flex items-center gap-2 h-9 px-3 rounded-xl border border-border bg-surface/40 transition-colors shrink-0",
                        "text-muted-foreground hover:text-foreground hover:bg-surface",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        popoverOpen && "bg-surface text-foreground"
                    )}
                >
                    {/* Icon — spinner when loading single event */}
                    <span className="relative flex items-center justify-center w-5 h-5 shrink-0">
                        {isChipLoading ? (
                            <Loader2 className="w-3.5 h-3.5 text-success animate-spin" />
                        ) : (
                            <EventThumb event={first} size={20} />
                        )}
                    </span>

                    {/* Label */}
                    <span className="text-xs font-medium truncate max-w-[92px] xl:max-w-[120px]">
                        {multi ? `${events.length} événements` : first.title}
                    </span>

                    {/* Relative time badge (single event only) — monté après hydration (#87/#88).
                        Texte coloré seul : pas de seconde boîte dans le bouton. */}
                    {!multi && (
                        <span className={cn("hidden xl:inline text-caption font-bold tabular-nums", theme.color)}>
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
