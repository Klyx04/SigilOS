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
    Filter,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    completeRaidEvent,
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
    canManageRaid?: boolean;
    userPseudo?: string;
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

export function CalendarDashboard({ guildId, currentUserId, canManage, canManageRaid, userPseudo, isDiscordConfigured }: CalendarDashboardProps) {
    const [displayMode, setDisplayMode] = useState<ViewMode>("grid");
    const [gridType, setGridType] = useState<"week" | "month">("week");
    const [currentDate, setCurrentDate] = useState(new Date());

    // Auto-switch to list mode on small screens
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setDisplayMode("list");
            }
        };
        handleResize(); // Initial check
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
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

    // Filter state
    const [selectedFilter, setSelectedFilter] = useState<string | "ALL">("ALL");
    const [showFilters, setShowFilters] = useState(false);

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

    const handleEventClick = (eventId: string) => {
        setSelectedEventId(eventId);
    };

    const handleDayClick = (date: Date) => {
        if (!canManage) return;
        setPrefilledDate(date);
        setIsCreateOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* ============ STABLE HEADER ============ */}
            <div className="space-y-6 mb-8">
                <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50 backdrop-blur-xl p-6 shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-primary/5 pointer-events-none" />

                    <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="relative group shrink-0">
                                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-xl blur-lg group-hover:blur-xl transition-all opacity-70" />
                                <div className="relative h-12 w-12 md:h-14 md:w-14 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                                    <CalendarIcon className="h-6 w-6 md:h-7 md:w-7 text-amber-500" />
                                </div>
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-zinc-100 truncate">Agenda</h2>
                                <p className="text-zinc-500 font-bold text-xs md:text-sm mt-1">
                                    {filteredEvents.length} événements programmés
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Display Mode Toggle */}
                            <div className="flex bg-zinc-900/80 p-1 rounded-full border border-zinc-800 shadow-inner">
                                <button
                                    onClick={() => setDisplayMode("grid")}
                                    className={cn(
                                        "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                                        displayMode === "grid" ? "bg-zinc-100 text-zinc-950 shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    <LayoutGrid className="h-3.5 w-3.5" />
                                    Grille
                                </button>
                                <button
                                    onClick={() => setDisplayMode("list")}
                                    className={cn(
                                        "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                                        displayMode === "list" ? "bg-zinc-100 text-zinc-950 shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    <List className="h-3.5 w-3.5" />
                                    Liste
                                </button>
                            </div>

                            {/* Grid-Specific Navigation */}
                            {displayMode === "grid" && (
                                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-500">
                                    {/* Week/Month Toggle */}
                                    <div className="flex bg-zinc-950/50 border border-zinc-800 rounded-full p-1">
                                        <button
                                            onClick={() => setGridType("week")}
                                            className={cn(
                                                "px-3 py-1 rounded-full text-[9px] font-bold uppercase transition-all",
                                                gridType === "week" ? "bg-amber-500 text-zinc-950" : "text-zinc-500"
                                            )}
                                        >
                                            Semaine
                                        </button>
                                        <button
                                            onClick={() => setGridType("month")}
                                            className={cn(
                                                "px-3 py-1 rounded-full text-[9px] font-bold uppercase transition-all",
                                                gridType === "month" ? "bg-amber-500 text-zinc-950" : "text-zinc-500"
                                            )}
                                        >
                                            Mois
                                        </button>
                                    </div>
                                </div>
                            )}

                            <Button
                                variant="outline"
                                onClick={() => setShowFilters(!showFilters)}
                                className={cn(
                                    "h-10 rounded-full px-4 md:px-5 text-[10px] md:text-sm font-black uppercase italic tracking-widest transition-all border-2",
                                    (showFilters || selectedFilter !== "ALL")
                                        ? "bg-zinc-100 text-zinc-950 border-white shadow-xl scale-105"
                                        : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                                )}
                            >
                                <Filter className={cn("h-4 w-4 mr-2", selectedFilter !== "ALL" && "text-amber-500")} />
                                Filtres
                            </Button>

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

                {/* Filters Bar (Improved Aesthetics) */}
                {showFilters && (
                    <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide animate-in slide-in-from-top-2 duration-300">
                        <button
                            onClick={() => setSelectedFilter("ALL")}
                            className={cn(
                                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase italic tracking-widest transition-all border-2 whitespace-nowrap",
                                selectedFilter === "ALL"
                                    ? "bg-zinc-100 text-zinc-950 border-white shadow-xl"
                                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
                            )}
                        >
                            Tous
                            <span className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-black",
                                selectedFilter === "ALL" ? "bg-zinc-900 text-zinc-100" : "bg-zinc-800 text-zinc-500"
                            )}>
                                {events.length}
                            </span>
                        </button>

                        <div className="h-6 w-px bg-zinc-800 mx-1 shrink-0" />

                        {Object.entries(FILTER_TYPES).map(([type, config]) => {
                            const count = typeCounts[type] || 0;
                            const Icon = config.icon;
                            const isActive = selectedFilter === type;

                            return (
                                <button
                                    key={type}
                                    onClick={() => setSelectedFilter(isActive ? "ALL" : type)}
                                    className={cn(
                                        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase italic tracking-widest transition-all border-2 whitespace-nowrap",
                                        isActive
                                            ? cn(config.bg, config.color, config.border, "shadow-lg scale-105 z-10")
                                            : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    {config.label}
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-md text-[10px] font-black",
                                        isActive ? "bg-current/20" : "bg-zinc-800 text-zinc-500"
                                    )}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ============ ACTIVE PERIOD BANNER (FRESH & ELEGANT) ============ */}
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.04] bg-[#0c1012]/60 backdrop-blur-xl p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                {/* Decorative background ambient lights */}
                <div className="absolute -top-12 -left-12 w-48 h-48 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none" />
                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-orange-500/10 rounded-full blur-[60px] pointer-events-none" />

                <div className="relative flex items-center gap-4">
                    <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                        <Sparkles className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-xl md:text-2xl font-black uppercase tracking-wider text-zinc-100 flex items-center gap-3">
                            <span className="bg-gradient-to-r from-zinc-100 via-amber-200 to-amber-400 bg-clip-text text-transparent">
                                {(() => {
                                    const monthStr = format(currentDate, "MMMM yyyy", { locale: fr });
                                    return monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
                                })()}
                            </span>
                            {displayMode === "grid" && (
                                <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase px-2 py-0.5 tracking-wider shrink-0">
                                    Semaine {format(currentDate, "I", { locale: fr })}
                                </Badge>
                            )}
                        </h3>
                        <p className="text-xs text-zinc-400 font-bold tracking-tight mt-0.5">
                            {displayMode === "grid" 
                                ? (gridType === "week" ? "Agenda hebdomadaire complet" : "Agenda mensuel de la guilde") 
                                : "Liste chronologique des événements"}
                        </p>
                    </div>
                </div>

                <div className="relative flex items-center gap-3">
                    {/* Fast Navigation Controls */}
                    <div className="flex bg-[#070b0c]/90 border border-white/5 rounded-xl p-1 shadow-inner">
                        <button
                            onClick={() => {
                                const date = displayMode === "list"
                                    ? subMonths(currentDate, 1)
                                    : (gridType === "week" ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
                                setCurrentDate(date);
                            }}
                            className="p-2 hover:bg-white/5 rounded-lg transition-all active:scale-95"
                            title="Période précédente"
                        >
                            <ChevronLeft className="h-4.5 w-4.5 text-zinc-300" />
                        </button>
                        <button
                            onClick={() => setCurrentDate(new Date())}
                            className="px-4 py-1.5 text-xs font-black uppercase tracking-wider text-zinc-300 hover:text-white rounded-lg hover:bg-white/5 transition-all"
                        >
                            Aujourd'hui
                        </button>
                        <button
                            onClick={() => {
                                const date = displayMode === "list"
                                    ? addMonths(currentDate, 1)
                                    : (gridType === "week" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));
                                setCurrentDate(date);
                            }}
                            className="p-2 hover:bg-white/5 rounded-lg transition-all active:scale-95"
                            title="Période suivante"
                        >
                            <ChevronRight className="h-4.5 w-4.5 text-zinc-300" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ============ MAIN CONTENT AREA (Stable) ============ */}
            <div className="min-h-[500px]">
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
            ) : displayMode === "grid" ? (
                // ============ GRID VIEW ============
                <CalendarGrid
                    events={filteredEvents}
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                    onEventClick={handleEventClick}
                    onDayClick={handleDayClick}
                    canManage={canManage}
                    viewMode={gridType}
                    onViewModeChange={setGridType}
                />
            ) : (
                // ============ LIST VIEW ============
                <div className="space-y-8">

                    {/* Events List Grouped */}
                    {sortedDates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-2xl bg-foreground/[0.02] text-center px-4">
                            <Sparkles className="h-10 w-10 text-muted-foreground/20 mb-4" />
                            <p className="text-muted-foreground font-bold">Aucun événement ne correspond à vos filtres.</p>
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
                                            <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                                                {format(new Date(dateKey), "MMM", { locale: fr }).replace(".", "")}
                                            </span>
                                            <span className="text-2xl font-black text-foreground leading-none">
                                                {format(new Date(dateKey), "dd")}
                                            </span>
                                        </div>
                                        <div className="h-px bg-border flex-1" />
                                        <span className="text-sm font-black text-muted-foreground uppercase tracking-widest italic">
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
        </div>

        <Dialog 
                open={isCreateOpen} 
                onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) setPrefilledDate(null);
                }}
            >
                <DialogContent draggable className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950/98 border border-white/10 ring-1 ring-orange-500/25 shadow-[0_0_50px_rgba(249,115,22,0.2)]">
                    <DialogTitle className="text-xl font-black uppercase italic tracking-tighter text-foreground">
                        Créer un événement
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground font-bold">
                        Remplissez les informations pour créer un nouvel événement de guilde.
                    </DialogDescription>
                    <EventForm 
                        guildId={guildId}
                        onSubmit={handleCreate} 
                        isDiscordConfigured={isDiscordConfigured}
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
                isDiscordConfigured={isDiscordConfigured}
                discordRoles={discordRoles}
                hasMetamobKey={hasMetamobKey}
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
                <DialogContent draggable className="max-w-2xl max-h-[90vh] overflow-y-auto bg-zinc-950/98 border border-white/10 ring-1 ring-orange-500/25 shadow-[0_0_50px_rgba(249,115,22,0.2)]">
                    <DialogTitle className="text-xl font-black uppercase italic tracking-tighter text-foreground">
                        Modifier l'événement
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground font-bold">
                        Modifiez les informations de l'événement.
                    </DialogDescription>
                    {editingEvent && (
                        <EventForm
                            guildId={guildId}
                            initialData={editingEvent}
                            onSubmit={handleUpdate}
                            isDiscordConfigured={isDiscordConfigured}
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
