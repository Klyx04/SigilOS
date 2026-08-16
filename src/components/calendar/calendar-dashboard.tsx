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
    LayoutGrid,
    Loader2,
    Sparkles,
    Swords,
    PartyPopper,
    Target,
    Wheat,
    Filter,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
    completeRaidEvent,
    cancelCalendarEvent,
    undoCompleteRaidEvent,
    sendEventReminder,
    autoCloseExpiredEvents,
    sendCalendarDiscordNotification,
    getDiscordRolesForCalendar,
    type GuildEventInput
} from "@/server/actions/calendar-actions";
import { getUserRaidEligibility } from "@/server/actions/kama-actions";
import { CalendarGrid } from "./calendar-grid";
import { EventDetailModal } from "./event-detail-modal";
import { EventCard } from "./event-card";
import { EventForm } from "./event-form";
import { RaidHubModal } from "./raid-hub-modal";
import { cn } from "@/lib/utils";

export interface DiscordChannels {
    calendarNotifyChannelId?: string | null;
    raidNotifyChannelId?: string | null;
    raidGigalodonNotifyChannelId?: string | null;
    raidSanctuaireNotifyChannelId?: string | null;
}

interface CalendarDashboardProps {
    guildId: string;
    currentUserId: string;
    canManage: boolean;
    canManageRaid?: boolean;
    userPseudo?: string;
    discordChannels?: DiscordChannels;
    isAdmin?: boolean;
}

type ViewMode = "grid";

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
        label: "Missions",
        icon: Target,
        color: "text-amber-400",
        bg: "bg-amber-500/15",
        border: "border-amber-500/40",
    },
    SORTIE_FARM: {
        label: "Farm",
        icon: Wheat,
        color: "text-emerald-400",
        bg: "bg-emerald-500/15",
        border: "border-emerald-500/40",
    },
};

export function CalendarDashboard({ guildId, currentUserId, canManage, canManageRaid, userPseudo, discordChannels, isAdmin = false }: CalendarDashboardProps) {
    const [displayMode] = useState<ViewMode>("grid");
    const [gridType, setGridType] = useState<"week" | "month">("week");
    // Chantier #87/#88 : `new Date()` en SSR (serveur UTC) vs client (Europe/Paris) peut
    // changer le jour affiché → on initialise null et on ne calcule « aujourd'hui » qu'après
    // montage (hydratation déterministe, plus d'erreur React #418 sur /calendar).
    const [currentDate, setCurrentDate] = useState<Date | null>(null);

    useEffect(() => {
        setCurrentDate(new Date());
    }, []);

    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [prefilledDate, setPrefilledDate] = useState<Date | null>(null);
    const [editingEvent, setEditingEvent] = useState<any>(null);

    // Event detail modal
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [hasMetamobKey, setHasMetamobKey] = useState(false);

    // Discord roles for notifications
    const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
    const [everyoneAllowed, setEveryoneAllowed] = useState<boolean>(false);

    // Filter state
    const [selectedFilter, setSelectedFilter] = useState<string | "ALL">("ALL");
    const [showFilters, setShowFilters] = useState(false);

    // Hub Raid modal
    const [isRaidHubOpen, setIsRaidHubOpen] = useState(false);

    // Day events modal (click on "+N" badge)
    const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: Date; events: any[] } | null>(null);

    // Raid eligibility (kamas gate)
    const [raidEligibility, setRaidEligibility] = useState<{ isEligible: boolean; totalDonated: number } | null>(null);

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
        const start = event.startDate ? new Date(event.startDate) : null;
        if (!start || isNaN(start.getTime())) return groups;
        
        const dateKey = format(start, "yyyy-MM-dd");
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(event);
        return groups;
    }, {} as Record<string, any[]>);

    const sortedDates = Object.keys(groupedEvents).sort();

    const fetchEvents = async () => {
        if (!currentDate) return;
        setLoading(true);

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
            setHasMetamobKey(!!(result as any).hasMetamobKey);
        } else {
            toast.error(result.error || "Impossible de charger l'événement");
        }
        setLoadingDetail(false);
    };

    useEffect(() => {
        fetchEvents();
        // Fetch Discord roles if user can manage
        if (canManage) {
            getDiscordRolesForCalendar(guildId).then(res => {
                setDiscordRoles(res.roles || []);
                setEveryoneAllowed(res.everyoneAllowed || false);
            });
        }
        // Fetch raid kamas eligibility for the current user
        getUserRaidEligibility(guildId).then(res => {
            if (res.success) {
                setRaidEligibility({ isEligible: res.isEligible ?? false, totalDonated: res.totalDonated ?? 0 });
            }
        });
    }, [currentDate, guildId, canManage]);

    const searchParams = useSearchParams();

    // Auto-open event detail modal if ?event= ID parameter is present in URL
    useEffect(() => {
        const eventIdFromUrl = searchParams.get("event");
        if (eventIdFromUrl) {
            setSelectedEventId(eventIdFromUrl);
        }
    }, [searchParams]);

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
            if ((result as any).discordError) {
                toast.warning(`Événement créé, mais la publication Discord a échoué : ${(result as any).discordError}`);
            } else {
                toast.success("Événement créé !");
            }
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
            if ((result as any).isReserve) {
                const msg = (result as any).reserveMessage || "Tes Kamas Violets ne seront pas déduits si tu ne participes pas.";
                toast.success(`Ajouté à la file d'attente — ${msg}`);
            } else {
                toast.success("Inscription réussie !");
            }
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

        // Check if this is a raid with completion data from the modal
        const isRaid = selectedEvent?.type === "RAID_OFFICIAL";
        const raidData = (window as any).__raidCompletionData;

        if (isRaid && raidData) {
            delete (window as any).__raidCompletionData;
            const result = await completeRaidEvent(guildId, selectedEventId, raidData);
            if (result.success) {
                toast.success(`Raid clôturé ! ${result.rewarded} joueur(s) récompensé(s)${result.score ? ` — Score : ${result.score}` : ""}`);
                fetchEventDetails(selectedEventId);
                fetchEvents();
            } else {
                toast.error(result.error);
            }
        } else {
            const result = await completeEvent(guildId, selectedEventId);
            if (result.success) {
                toast.success("Événement terminé !");
                fetchEventDetails(selectedEventId);
                fetchEvents();
            } else {
                toast.error(result.error);
            }
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

    const handleCancel = async () => {
        if (!selectedEventId) return;
        const result = await cancelCalendarEvent(guildId, selectedEventId);
        if (result.success) {
            toast.success("Événement annulé");
            setSelectedEvent(null);
            setSelectedEventId(null);
            fetchEvents();
        } else {
            toast.error(result.error);
        }
    };

    const handleUndoComplete = async () => {
        if (!selectedEventId) return;
        const result = await undoCompleteRaidEvent(guildId, selectedEventId);
        if (result.success) {
            toast.success(`Clôture annulée ! ${result.refunded} joueur(s) remboursé(s).`);
            fetchEventDetails(selectedEventId);
            fetchEvents();
        } else {
            toast.error(result.error);
        }
    };

    const handleEventClick = (eventId: string) => {
        setSelectedEventId(eventId);
    };

    const handleDayEventsClick = (date: Date, events: any[]) => {
        setSelectedDayEvents({ date, events });
    };

    const handleDayClick = (date: Date) => {
        if (!canManage) return;
        if (isBefore(startOfDay(date), startOfDay(new Date()))) {
            toast.error("Impossible de créer un événement sur un jour passé.");
            return;
        }
        setPrefilledDate(date);
        setIsCreateOpen(true);
    };

    // Hydratation déterministe (#87/#88) : le calendrier ne se monte qu'après
    // initialisation de « aujourd'hui » côté client.
    if (currentDate === null) {
        return (
            <div className="p-12 text-center text-zinc-500 font-medium">
                Chargement du calendrier...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ============ STABLE HEADER ============ */}
            <div className="space-y-6 mb-8">
                <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
                    <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="relative h-12 w-12 md:h-14 md:w-14 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800 shrink-0">
                                <CalendarIcon className="h-6 w-6 md:h-7 md:w-7 text-amber-500" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-2xl md:text-3xl font-bold text-zinc-100 truncate">Agenda</h2>
                                <p className="text-zinc-500 text-xs md:text-sm mt-1">
                                    {filteredEvents.length} événements programmés
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className="h-9 px-3 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-all"
                            >
                                <Filter className={cn("h-4 w-4 mr-1.5", selectedFilter !== "ALL" && "text-amber-500")} />
                                Filtres
                                {selectedFilter !== "ALL" && (
                                    <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                                )}
                            </Button>

                            {/* Raid Hub (ghost) */}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsRaidHubOpen(true)}
                                            className="h-9 px-3 rounded-lg text-xs font-semibold text-zinc-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                                        >
                                            <Swords className="h-4 w-4 mr-1.5 text-red-400/70" />
                                            Raids
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-zinc-950 border-zinc-800 text-xs">
                                        Guides et conseils raid
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>

                            {canManage && (
                                <Button
                                    data-tour="calendar-create"
                                    onClick={() => setIsCreateOpen(true)}
                                    className="h-9 px-4 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02]"
                                >
                                    <Plus className="h-4 w-4 mr-1.5" />
                                    Nouvel évent
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filters Bar (Improved Aesthetics) */}
                {showFilters && (
                    <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide animate-in slide-in-from-top-2 duration-300" data-tour="calendar-events">
                        <button
                            onClick={() => setSelectedFilter("ALL")}
                            className={cn(
                                "flex items-center gap-2 h-8 px-3.5 rounded-full text-xs font-medium transition-all shrink-0",
                                selectedFilter === "ALL"
                                    ? "bg-white/10 text-white border border-white/10"
                                    : "bg-zinc-900/60 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                            )}
                        >
                            Tous
                            <span className={cn(
                                "px-1.5 py-0.5 rounded-full text-caption font-bold",
                                selectedFilter === "ALL" ? "bg-white/15 text-white" : "bg-zinc-800 text-zinc-500"
                            )}>
                                {events.length}
                            </span>
                        </button>

                        {Object.entries(FILTER_TYPES).map(([type, config]) => {
                            const count = typeCounts[type] || 0;
                            const Icon = config.icon;
                            const isActive = selectedFilter === type;

                            return (
                                <button
                                    key={type}
                                    onClick={() => setSelectedFilter(isActive ? "ALL" : type)}
                                    className={cn(
                                        "flex items-center gap-2 h-8 px-3.5 rounded-full text-xs font-medium transition-all shrink-0",
                                        isActive
                                            ? cn(config.color, "bg-white/10 border border-white/10")
                                            : "bg-zinc-900/60 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                                    )}
                                >
                                    <Icon className={cn("h-3.5 w-3.5", isActive ? config.color : "")} />
                                    {config.label}
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded-full text-caption font-bold",
                                        isActive ? "bg-white/15" : "bg-zinc-800 text-zinc-500"
                                    )}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ============ COMPACT PERIOD BAR ============ */}
            <div className="flex items-center justify-between gap-4 px-4 py-2.5 rounded-xl bg-zinc-900/40 border border-white/[0.04]">
                <div className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4 text-amber-400/80" />
                    <h3 className="text-base font-bold capitalize text-zinc-200">
                        {format(currentDate, "MMMM yyyy", { locale: fr })}
                        <span className="ml-2 text-xs font-semibold text-zinc-500 normal-case">
                            {gridType === "week" ? `Semaine ${format(currentDate, "I")}` : "Mois"}
                        </span>
                    </h3>
                </div>

                <div className="flex items-center gap-2">
                    {/* Week/Month segment control */}
                    <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5" data-tour="calendar-view">
                        <button
                            onClick={() => setGridType("week")}
                            className={cn(
                                "px-3 py-1 rounded-md text-caption font-semibold transition-all",
                                gridType === "week" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            Semaine
                        </button>
                        <button
                            onClick={() => setGridType("month")}
                            className={cn(
                                "px-3 py-1 rounded-md text-caption font-semibold transition-all",
                                gridType === "month" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            Mois
                        </button>
                    </div>

                    {/* Nav */}
                    <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                        <button
                            onClick={() => {
                                const date = gridType === "week" ? subWeeks(currentDate, 1) : subMonths(currentDate, 1);
                                setCurrentDate(date);
                            }}
                            className="p-1.5 hover:bg-white/5 rounded-md transition-all active:scale-95"
                            title="Précédent"
                        >
                            <ChevronLeft className="h-4 w-4 text-zinc-300" />
                        </button>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="px-3 py-1 text-caption font-semibold text-zinc-400 hover:text-white rounded-md hover:bg-white/5 transition-all"
                        >
                            Aujourd'hui
                        </button>
                        <button
                            onClick={() => {
                                const date = gridType === "week" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1);
                                setCurrentDate(date);
                            }}
                            className="p-1.5 hover:bg-white/5 rounded-md transition-all active:scale-95"
                            title="Suivant"
                        >
                            <ChevronRight className="h-4 w-4 text-zinc-300" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ============ MAIN CONTENT AREA ============ */}
            <div className="min-h-[500px]">
                {loading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                    <div className="relative">
                        <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                            <CalendarIcon className="h-8 w-8 text-zinc-500" />
                        </div>
                        <Loader2 className="absolute -top-1 -right-1 h-6 w-6 text-emerald-500 animate-spin" />
                    </div>
                    <p className="text-zinc-400 text-sm animate-pulse">Chargement de l'agenda...</p>
                </div>
            ) : (
                // ============ GRID VIEW ============
                <CalendarGrid
                    events={filteredEvents}
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                    onEventClick={handleEventClick}
                    onDayClick={handleDayClick}
                    onDayEventsClick={handleDayEventsClick}
                    canManage={canManage}
                    viewMode={gridType}
                    onViewModeChange={setGridType}
                />
            )}
        </div>

        <Dialog 
                open={isCreateOpen} 
                onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) setPrefilledDate(null);
                }}
            >
                <DialogContent draggable className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950/98 border border-white/10 ring-1 ring-white/10">
                    <DialogTitle className="text-title font-bold text-foreground">
                        Créer un événement
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Remplissez les informations pour créer un nouvel événement de guilde.
                    </DialogDescription>
                    <EventForm 
                        guildId={guildId}
                        onSubmit={handleCreate} 
                        discordChannels={discordChannels}
                        canManageRaid={canManageRaid}
                        userPseudo={userPseudo}
                        initialData={prefilledDate ? { startDate: prefilledDate } : undefined}
                        discordRoles={discordRoles}
                    />
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
                isAdmin={isAdmin}
                discordChannels={discordChannels}
                discordRoles={discordRoles}
                everyoneAllowed={everyoneAllowed}
                hasMetamobKey={hasMetamobKey}
                raidEligibility={raidEligibility}
                onRegister={handleRegister}
                onUnregister={handleUnregister}
                onEdit={() => {
                    setEditingEvent(selectedEvent);
                    setSelectedEventId(null);
                }}
                onDelete={handleDelete}
                onCancel={handleCancel}
                onPublish={handlePublish}
                onComplete={handleComplete}
                onUndoComplete={handleUndoComplete}
                onSendReminder={handleSendReminder}
                onShareDiscord={handleShareDiscord}
            />

            {/* ============ DAY EVENTS MODAL (via +N badge) ============ */}
            <Dialog open={!!selectedDayEvents} onOpenChange={(open) => !open && setSelectedDayEvents(null)}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-zinc-950/98 border border-white/10">
                    <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-amber-500" />
                        {selectedDayEvents ? format(selectedDayEvents.date, "EEEE d MMMM", { locale: fr }) : ""}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        {selectedDayEvents ? `${selectedDayEvents.events.length} événement(s) ce jour-là` : ""}
                    </DialogDescription>

                    <div className="space-y-3 mt-2">
                        {selectedDayEvents?.events.map((ev) => (
                            <EventCard
                                key={ev.id}
                                event={ev}
                                currentUserId={currentUserId}
                                onRespond={() => {}}
                                canManage={canManage}
                                variant="list"
                            />
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ============ RAID HUB MODAL ============ */}
            <RaidHubModal
                open={isRaidHubOpen}
                onOpenChange={setIsRaidHubOpen}
                guildId={guildId}
                isAdmin={isAdmin}
            />

            {/* ============ EDIT DIALOG ============ */}
            <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
                <DialogContent draggable className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950/98 border border-white/10">
                    <DialogTitle className="text-xl font-bold text-foreground">
                        Modifier l'événement
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Modifiez les informations de l'événement.
                    </DialogDescription>
                    {editingEvent && (
                        <EventForm
                            guildId={guildId}
                            initialData={editingEvent}
                            onSubmit={handleUpdate}
                            discordChannels={discordChannels}
                            canManageRaid={canManageRaid}
                            userPseudo={userPseudo}
                            discordRoles={discordRoles}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
