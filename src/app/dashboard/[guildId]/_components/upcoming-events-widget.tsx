"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, MapPin, Clock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface UpcomingEvent {
    id: string;
    title: string;
    type: string;
    startDate: Date;
    location?: string | null;
    _count?: {
        participants: number;
    };
}

export function UpcomingEventsWidget({
    guildId,
    events = []
}: {
    guildId: string;
    events: UpcomingEvent[];
}) {
    return (
        <Card className="glass-premium border-white/5 flex flex-col h-full overflow-hidden">
            <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        Agenda de Guilde
                    </CardTitle>
                    <Link href={`/dashboard/${guildId}/calendar`} className="text-[8px] font-black text-zinc-600 hover:text-emerald-400 uppercase tracking-widest border border-white/5 px-2 py-1 rounded-md transition-all">
                        Calendrier
                    </Link>
                </div>
            </CardHeader>

            <CardContent className="px-6 pb-6 space-y-4">
                {events.length > 0 ? (
                    <div className="space-y-3">
                        {events.map((event) => {
                            const isToday = format(new Date(event.startDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                            
                            return (
                                <Link 
                                    key={event.id} 
                                    href={`/dashboard/${guildId}/calendar?event=${event.id}`}
                                    className="group block bg-zinc-950/40 hover:bg-zinc-900/60 border border-white/5 hover:border-emerald-500/20 rounded-xl p-3 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-[8px] font-black uppercase px-1.5 py-0.5 rounded",
                                                    isToday ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-400"
                                                )}>
                                                    {isToday ? "Aujourd'hui" : format(new Date(event.startDate), 'EEEE dd MMMM', { locale: fr })}
                                                </span>
                                                <span className="text-[10px] font-black text-white/90 group-hover:text-emerald-400 transition-colors uppercase italic truncate">
                                                    {event.title}
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center gap-3 text-[9px] text-zinc-500 font-bold uppercase tracking-tighter">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {format(new Date(event.startDate), 'HH:mm')}
                                                </div>
                                                {event.location && (
                                                    <div className="flex items-center gap-1 truncate max-w-[120px]">
                                                        <MapPin className="w-3 h-3" />
                                                        {event.location}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1">
                                                    <Users className="w-3 h-3" />
                                                    {event._count?.participants || 0}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 border border-dashed border-white/5 rounded-2xl">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-zinc-700" />
                        </div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest max-w-[150px]">
                            Aucun événement prévu cette semaine
                        </p>
                    </div>
                )}

                <Link 
                    href={`/dashboard/${guildId}/calendar`} 
                    className="flex items-center justify-center gap-2 text-[9px] font-black text-zinc-700 hover:text-emerald-400 uppercase tracking-widest pt-2 transition-colors border-t border-white/5"
                >
                    Voir tout le calendrier
                </Link>
            </CardContent>
        </Card>
    );
}
