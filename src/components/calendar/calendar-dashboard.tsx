"use client";

import { useState, useEffect } from "react";
import {
    Calendar as CalendarIcon,
    Plus,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Filter
} from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
    getCalendarEvents,
    createCalendarEvent,
    respondToCalendarEvent,
    deleteCalendarEvent,
    updateCalendarEvent
} from "@/server/actions/calendar-actions";
import { EventCard } from "./event-card";
import { EventForm } from "./event-form";
import { Badge } from "@/components/ui/badge";

interface CalendarDashboardProps {
    guildId: string;
    currentUserId: string;
    canManage: boolean;
}

export function CalendarDashboard({ guildId, currentUserId, canManage }: CalendarDashboardProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<any>(null);

    const fetchEvents = async () => {
        setLoading(true);
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);

        const result = await getCalendarEvents(guildId, start, end);
        if (result.success) {
            setEvents(result.events || []);
        } else {
            toast.error(result.error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchEvents();
    }, [currentMonth, guildId]);

    const handleCreate = async (data: any) => {
        const result = await createCalendarEvent(guildId, data);
        if (result.success) {
            toast.success("Événement créé !");
            setIsCreateOpen(false);
            fetchEvents();
        } else {
            toast.error(result.error);
        }
    };

    const handleUpdate = async (data: any) => {
        const result = await updateCalendarEvent(guildId, editingEvent.id, data);
        if (result.success) {
            toast.success("Événement modifié !");
            setEditingEvent(null);
            fetchEvents();
        } else {
            toast.error(result.error);
        }
    };

    const handleDelete = async (eventId: string) => {
        if (!confirm("Supprimer cet événement ?")) return;
        const result = await deleteCalendarEvent(guildId, eventId);
        if (result.success) {
            toast.success("Événement supprimé");
            fetchEvents();
        } else {
            toast.error(result.error);
        }
    };

    const handleRespond = async (eventId: string, status: any) => {
        const result = await respondToCalendarEvent(guildId, eventId, status);
        if (result.success) {
            toast.success("Réponse enregistrée");
            fetchEvents();
        } else {
            toast.error(result.error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/40 p-4 rounded-xl border border-zinc-800/50 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                        <CalendarIcon className="h-6 w-6 text-amber-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-zinc-100 capitalize">
                            {format(currentMonth, "MMMM yyyy", { locale: fr })}
                        </h2>
                        <p className="text-zinc-400 text-sm">Planning de la guilde</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-lg p-1 mr-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="h-8 w-8 hover:bg-zinc-800"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentMonth(new Date())}
                            className="px-3 h-8 text-xs font-medium hover:bg-zinc-800"
                        >
                            Aujourd'hui
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="h-8 w-8 hover:bg-zinc-800"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {canManage && (
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-10">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nouvel évent
                                </Button>
                            </DialogTrigger>
                            <EventForm onSubmit={handleCreate} />
                        </Dialog>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
                    <p className="text-zinc-400 animate-pulse">Chargement de l'agenda...</p>
                </div>
            ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20 text-center px-4">
                    <div className="h-16 w-16 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                        <CalendarIcon className="h-8 w-8 text-zinc-600" />
                    </div>
                    <h3 className="text-lg font-medium text-zinc-300">Aucun événement prévu</h3>
                    <p className="text-zinc-500 max-w-xs mt-1">
                        Il n'y a pas encore d'événements pour ce mois-ci.
                    </p>
                    {canManage && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="mt-6 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                            onClick={() => setIsCreateOpen(true)}
                        >
                            Ajouter le premier
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {events.map((event) => (
                        <EventCard
                            key={event.id}
                            event={event}
                            currentUserId={currentUserId}
                            canManage={canManage}
                            onRespond={(status) => handleRespond(event.id, status)}
                            onEdit={() => setEditingEvent(event)}
                            onDelete={() => handleDelete(event.id)}
                        />
                    ))}
                </div>
            )}

            {/* Edit Dialog */}
            <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
                {editingEvent && (
                    <EventForm
                        initialData={editingEvent}
                        onSubmit={handleUpdate}
                    />
                )}
            </Dialog>
        </div>
    );
}
