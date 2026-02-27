"use client";

/**
 * CalendarDashboard V2 - Premium Guild Calendar
 * Streamlined dashboard with grid/list toggle
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
    Calendar as CalendarIcon,
    Plus,
    List,
    LayoutGrid,
    Loader2,
    Sparkles,
    Swords,
    PartyPopper,
    Target,
    Wheat,
    Eye,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    getCalendarEvents,
    getCalendarEventDetails,
    createCalendarEvent,
    deleteCalendarEvent,
    updateCalendarEvent,
    registerForEvent,
    unregisterFromEvent,
    publishEvent,
    completeEvent,
    sendEventReminder,
    autoCloseExpiredEvents,
    sendCalendarDiscordNotification,
    getDiscordRolesForCalendar,
    type GuildEventInput
} from "@/server/actions/calendar-actions";
import { CalendarGrid } from "./calendar-grid";
import { EventDetailModal } from "./event-detail-modal";
import { EventCard } from "./event-card";
import { EventForm } from "./event-form";
import { cn } from "@/lib/utils";

interface CalendarDashboardProps {
    guildId: string;
    currentUserId: string;
    canManage: boolean;
    isDiscordConfigured?: boolean;
}

type ViewMode = "grid" | "list";

interface DiscordRole {
    id: string;
    name: string;
    color?: number;
}

const FILTER_TYPES: Record<string, { label: string; icon: any; color: string; bg: string; border: string; }> = {
    RAID_OFFICIAL: {
        label: "Raid 3.6",
        icon: Swords,
        color: "text-red-400",
        bg: "bg-red-500/15",
        border: "border-red-500/40",
    },
    EVENT_GUILD: {
        label: "Event Guilde",
        icon: PartyPopper,
        color: "text-purple-400",
        bg: "bg-purple-500/15",
        border: "border-purple-500/40",
    },
    SESSION_MISSIONS: {
        label: "Missions Guilde",
        icon: Target,
        color: "text-amber-400",
        bg: "bg-amber-500/15",
        border: "border-amber-500/40",
    },
    SORTIE_FARM: {
        label: "Sortie Farm",
        icon: Wheat,
        color: "text-emerald-400",
        bg: "bg-emerald-500/15",
        border: "border-emerald-500/40",
    },
    KRALAMOURE: {
        label: "Kralamoure",
        icon: Eye,
        color: "text-pink-400",
        bg: "bg-pink-500/15",
        border: "border-pink-500/40",
    },
    OTHERS: {
        label: "Autres",
        icon: List,
        color: "text-zinc-400",
        bg: "bg-zinc-500/15",
        border: "border-zinc-500/40",
    },
};

export function CalendarDashboard({ guildId, currentUserId, canManage, isDiscordConfigured }: CalendarDashboardProps) {
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<any>(null);

    // Event detail modal
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Discord roles for notifications
    const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);

    // Filter state
    const [selectedFilter, setSelectedFilter] = useState<string | "ALL">("ALL");

    // Dynamic counts for filters
    const typeCounts = events.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Filter and group events
    const filteredEvents = events.filter(e => selectedFilter === "ALL" || e.type === selectedFilter)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

    // Group by date for List View
    const groupedEvents = filteredEvents.reduce((groups, event) => {
        const dateKey = format(new Date(event.startDate), "yyyy-MM-dd");
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(event);
        return groups;
    }, {} as Record<string, any[]>);

    const sortedDates = Object.keys(groupedEvents).sort();

    const fetchEvents = async () => {
        setLoading(true);

        // Auto-close expired events first
        await autoCloseExpiredEvents(guildId);

        // Fetch events for the entire month (works for both week and month views)
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        // Also include previous and next week for week view edge cases
        const start = startOfWeek(subWeeks(monthStart, 1), { weekStartsOn: 1 });
        const end = endOfWeek(addWeeks(monthEnd, 1), { weekStartsOn: 1 });

        const result = await getCalendarEvents(guildId, start, end);
        if (result.success) {
            setEvents(result.events || []);
        } else {
            toast.error(result.error);
        }
        setLoading(false);
    };

    const fetchEventDetails = async (eventId: string) => {
        setLoadingDetail(true);
        const result = await getCalendarEventDetails(guildId, eventId);
        if (result.success && result.event) {
            setSelectedEvent(result.event);
        } else {
            toast.error(result.error || "Impossible de charger l'événement");
        }
        setLoadingDetail(false);
    };

    useEffect(() => {
        fetchEvents();
        // Fetch Discord roles if user can manage
        if (canManage) {
            getDiscordRolesForCalendar(guildId).then(setDiscordRoles);
        }
    }, [currentDate, guildId, canManage]);

    useEffect(() => {
        if (selectedEventId) {
            fetchEventDetails(selectedEventId);
        } else {
            setSelectedEvent(null);
        }
    }, [selectedEventId]);

    const handleCreate = async (data: GuildEventInput) => {
        const result = await createCalendarEvent(guildId, data);
        if (result.success) {
            toast.success("Événement créé !");
            setIsCreateOpen(false);
            fetchEvents();
        } else {
            toast.error(result.error);
        }
    };

    const handleUpdate = async (data: GuildEventInput) => {
        const result = await updateCalendarEvent(guildId, editingEvent.id, data);
        if (result.success) {
            toast.success("Événement modifié !");
            setEditingEvent(null);
            fetchEvents();
            if (selectedEventId === editingEvent.id) {
                fetchEventDetails(editingEvent.id);
            }
        } else {
            toast.error(result.error);
        }
    };

    const handleDelete = async () => {
        if (!selectedEventId) return;
        const result = await deleteCalendarEvent(guildId, selectedEventId);
        if (result.success) {
            toast.success("Événement supprimé");
            // Clear both event data AND selection simultaneously to prevent
            // the modal from rendering with stale/deleted event data (hydration error)
            setSelectedEvent(null);
            setSelectedEventId(null);
            fetchEvents();
        } else {
            toast.error(result.error);
        }
    };

    const handleRegister = async (data?: { classe?: string; comment?: string }) => {
        if (!selectedEventId) return;
        const result = await registerForEvent(guildId, selectedEventId, data);
        if (result.success) {
            // @ts-ignore - isReserve is present on success
            toast.success(result.isReserve ? "Ajouté à la file d'attente" : "Inscription réussie !");
            fetchEventDetails(selectedEventId);
            fetchEvents();
        } else {
            toast.error(result.error);
        }
    };

    const handleUnregister = async () => {
        if (!selectedEventId) return;
        const result = await unregisterFromEvent(guildId, selectedEventId);
        if (result.success) {
            toast.success("Désinscription effectuée");
            fetchEventDetails(selectedEventId);
            fetchEvents();
        } else {
            toast.error(result.error);
        }
    };

    const handleQuickRespond = async (eventId: string, status: "GOING" | "MAYBE" | "DECLINED") => {
        if (status === "MAYBE") {
            toast.info("L'option 'Peut-être' sera disponible prochainement");
        }

        // Find event to check status (using participants or attendees field depending on what's returned)
        const event = events.find(e => e.id === eventId);
        // Note: event object form fetchEvents usually has 'attendees' mapped from 'participants'
        const isRegistered = event?.attendees?.some((a: any) => a.userId === currentUserId);

        if (status === "GOING") {
            if (isRegistered) {
                const result = await unregisterFromEvent(guildId, eventId);
                if (result.success) {
                    toast.success("Désinscription effectuée");
                } else {
                    toast.error(result.error);
                }
            } else {
                const result = await registerForEvent(guildId, eventId);
                if (result.success) {
                    // @ts-ignore - isReserve is present on success
                    toast.success(result.isReserve ? "Ajouté à la file d'attente" : "Inscription validée !");
                } else {
                    toast.error(result.error);
                }
            }
        }

        fetchEvents();
    };

    const handlePublish = async () => {
        if (!selectedEventId) return;
        const result = await publishEvent(guildId, selectedEventId);
        if (result.success) {
            toast.success("Événement publié !");
            fetchEventDetails(selectedEventId);
            fetchEvents();
        } else {
            toast.error(result.error);
        }
    };

    const handleComplete = async () => {
        if (!selectedEventId) return;
        const result = await completeEvent(guildId, selectedEventId);
        if (result.success) {
            toast.success("Événement terminé !");
            fetchEventDetails(selectedEventId);
            fetchEvents();
        } else {
            toast.error(result.error);
        }
    };

    const handleSendReminder = async (roleId?: string) => {
        if (!selectedEventId) return { success: false, error: "Aucun événement" };
        return await sendEventReminder(guildId, selectedEventId, roleId);
    };

    const handleShareDiscord = async (roleId?: string) => {
        if (!selectedEventId) return { success: false, error: "Aucun événement" };
        return await sendCalendarDiscordNotification(guildId, selectedEventId, roleId);
    };

    const handleEventClick = (eventId: string) => {
        setSelectedEventId(eventId);
    };

    const handleDayClick = (date: Date) => {
        // Future: ouvrir le formulaire pré-rempli avec cette date
    };

    return (
        <div className="space-y-6">
            {/* ============ VIEW TOGGLE (visible only when not loading) ============ */}
            {!loading && (
                <div className="flex items-center justify-end">
                    <div className="flex items-center gap-1 p-1 bg-zinc-900/60 border border-zinc-800/50 rounded-full backdrop-blur-sm">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                                viewMode === "grid"
                                    ? "bg-zinc-800 text-amber-400 shadow-inner"
                                    : "text-zinc-400 hover:text-zinc-300"
                            )}
                        >
                            <LayoutGrid className="h-4 w-4" />
                            <span className="hidden sm:inline">Grille</span>
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                                viewMode === "list"
                                    ? "bg-zinc-800 text-amber-400 shadow-inner"
                                    : "text-zinc-400 hover:text-zinc-300"
                            )}
                        >
                            <List className="h-4 w-4" />
                            <span className="hidden sm:inline">Liste</span>
                        </button>
                    </div>
                </div>
            )}

            {/* ============ MAIN CONTENT ============ */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                    <div className="relative">
                        <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center animate-pulse">
                            <CalendarIcon className="h-8 w-8 text-amber-500/50" />
                        </div>
                        <Loader2 className="absolute -top-1 -right-1 h-6 w-6 text-amber-500 animate-spin" />
                    </div>
                    <p className="text-zinc-400 text-sm animate-pulse">Chargement de l'agenda...</p>
                </div>
            ) : viewMode === "grid" ? (
                // ============ GRID VIEW ============
                <CalendarGrid
                    events={events}
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                    onEventClick={handleEventClick}
                    onDayClick={handleDayClick}
                    canManage={canManage}
                    onCreateClick={() => setIsCreateOpen(true)}
                />
            ) : (
                // ============ LIST VIEW ============
                <div className="space-y-8">
                    {/* Header + Filters */}
                    <div className="space-y-6">
                        {/* Title & Action */}
                        <div className="relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-950/80 backdrop-blur-xl p-6">
                            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 via-transparent to-purple-600/5 pointer-events-none" />

                            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-5">
                                    <div className="relative group shrink-0">
                                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-xl blur-lg group-hover:blur-xl transition-all opacity-70" />
                                        <div className="relative h-14 w-14 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 flex items-center justify-center border border-amber-500/20">
                                            <CalendarIcon className="h-7 w-7 text-amber-400" />
                                        </div>
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-bold text-zinc-50 tracking-tight">Agenda</h2>
                                        <p className="text-zinc-400 text-sm mt-1">
                                            {filteredEvents.length} événements
                                        </p>
                                    </div>
                                </div>



                                <div className="flex items-center gap-3">
                                    {canManage && (
                                        <Button
                                            onClick={() => setIsCreateOpen(true)}
                                            className="h-10 px-5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold shadow-lg shadow-amber-500/25 transition-all hover:shadow-amber-500/40 hover:scale-105"
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            Nouvel évent
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Filters Bar */}
                        <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide">
                            <button
                                onClick={() => setSelectedFilter("ALL")}
                                className={cn(
                                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border-2 whitespace-nowrap",
                                    selectedFilter === "ALL"
                                        ? "bg-zinc-100 text-zinc-900 border-zinc-100 shadow-md shadow-zinc-900/10"
                                        : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
                                )}
                            >
                                Tous
                                <span className={cn(
                                    "px-2 py-0.5 rounded-md text-xs font-bold",
                                    selectedFilter === "ALL" ? "bg-zinc-800 text-zinc-100" : "bg-zinc-800 text-zinc-400"
                                )}>
                                    {events.length}
                                </span>
                            </button>

                            <div className="h-6 w-px bg-zinc-800/50 mx-1 shrink-0" />

                            {Object.entries(FILTER_TYPES).map(([type, config]) => {
                                const count = typeCounts[type] || 0;
                                const Icon = config.icon;
                                const isActive = selectedFilter === type;

                                return (
                                    <button
                                        key={type}
                                        onClick={() => setSelectedFilter(isActive ? "ALL" : type)}
                                        className={cn(
                                            "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all border-2 whitespace-nowrap",
                                            isActive
                                                ? cn(config.bg, config.color, config.border, "shadow-md")
                                                : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {config.label}
                                        <span className={cn(
                                            "px-2 py-0.5 rounded-md text-xs font-bold",
                                            isActive ? "bg-white/10" : "bg-zinc-800"
                                        )}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Events List Grouped */}
                    {sortedDates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800/50 rounded-2xl bg-zinc-900/20 text-center px-4">
                            <Sparkles className="h-10 w-10 text-zinc-700 mb-4" />
                            <p className="text-zinc-500">Aucun événement ne correspond à vos filtres.</p>
                            {canManage && selectedFilter === "ALL" && (
                                <Button variant="link" onClick={() => setIsCreateOpen(true)} className="mt-2 text-amber-500">
                                    Créer un événement
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {sortedDates.map(dateKey => (
                                <div key={dateKey} className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col items-end shrink-0 min-w-[60px]">
                                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                                                {format(new Date(dateKey), "MMM", { locale: fr }).replace(".", "")}
                                            </span>
                                            <span className="text-2xl font-black text-zinc-200 leading-none">
                                                {format(new Date(dateKey), "dd")}
                                            </span>
                                        </div>
                                        <div className="h-px bg-zinc-800 flex-1" />
                                        <span className="text-sm font-medium text-zinc-600 capitalize">
                                            {format(new Date(dateKey), "EEEE", { locale: fr })}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {groupedEvents[dateKey].map((event: any) => (
                                            <div
                                                key={event.id}
                                                onClick={() => handleEventClick(event.id)}
                                                className="cursor-pointer transition-all hover:opacity-90"
                                            >
                                                <EventCard
                                                    event={event}
                                                    currentUserId={currentUserId}
                                                    canManage={canManage}
                                                    onRespond={(status) => handleQuickRespond(event.id, status)}
                                                    onEdit={() => setEditingEvent(event)}
                                                    onDelete={() => {
                                                        setSelectedEventId(event.id);
                                                        handleDelete();
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ============ CREATE DIALOG ============ */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent draggable className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogTitle className="text-xl font-bold text-zinc-100">
                        Créer un événement
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Remplissez les informations pour créer un nouvel événement de guilde.
                    </DialogDescription>
                    <EventForm onSubmit={handleCreate} isDiscordConfigured={isDiscordConfigured} />
                </DialogContent>
            </Dialog>

            {/* ============ DETAIL MODAL ============ */}
            <EventDetailModal
                event={selectedEvent}
                open={!!selectedEventId}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedEventId(null);
                        // Optional: Clear URL param
                        const url = new URL(window.location.href);
                        url.searchParams.delete("event");
                        window.history.replaceState({}, "", url);
                    }
                }}
                currentUserId={currentUserId}
                guildId={guildId}
                canManage={canManage}
                discordRoles={discordRoles}
                onRegister={handleRegister}
                onUnregister={handleUnregister}
                onEdit={() => {
                    setEditingEvent(selectedEvent);
                    setSelectedEventId(null);
                }}
                onDelete={handleDelete}
                onPublish={handlePublish}
                onComplete={handleComplete}
                onSendReminder={handleSendReminder}
                onShareDiscord={handleShareDiscord}
            />

            {/* ============ EDIT DIALOG ============ */}
            <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
                <DialogContent draggable className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800">
                    <DialogTitle className="text-xl font-bold text-zinc-100">
                        Modifier l'événement
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Modifiez les informations de l'événement.
                    </DialogDescription>
                    {editingEvent && (
                        <EventForm
                            initialData={editingEvent}
                            onSubmit={handleUpdate}
                            isDiscordConfigured={isDiscordConfigured}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
