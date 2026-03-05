"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getGuildKralamoureEvents } from "@/server/actions/ocre-actions";
import { Anchor, Clock, MapPin, Users, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Interface for type safety
interface KralamoureEvent {
    id: number;
    event_datetime: string;
    description?: string | null;
    creator: string;
    participants_count?: number;
    character_count?: number;
    messages_count?: number;
    server: {
        id: number;
        name: string;
        community: string;
    };
}

export function KralamoureWidget() {
    const params = useParams();
    const guildId = params.guildId as string;

    const [events, setEvents] = useState<KralamoureEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!guildId) return;
        const fetchKrala = async () => {
            setLoading(true);
            try {
                const res = await getGuildKralamoureEvents(guildId);
                if (res.success && res.data) {
                    setEvents(res.data);
                } else {
                    setError("Impossible de charger les événements.");
                }
            } catch (e) {
                setError("Erreur de connexion.");
            } finally {
                setLoading(false);
            }
        };
        fetchKrala();
    }, [guildId]);

    // Format utility
    const formatDate = (isoString: string) => {
        const d = new Date(isoString);
        return new Intl.DateTimeFormat('fr-FR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        }).format(d);
    };

    if (loading) {
        return (
            <div className="flex-1 min-h-[140px] rounded-2xl bg-white/5 animate-pulse border border-white/5 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-emerald-500 animate-spin opacity-50" />
            </div>
        );
    }

    if (error || events.length === 0) {
        return (
            <div className="flex-1 rounded-2xl bg-gradient-to-br from-emerald-950/20 to-black border border-emerald-900/30 p-5 flex flex-col items-center justify-center text-center">
                <Anchor className="h-8 w-8 text-emerald-500/30 mb-2" />
                <h4 className="text-sm font-bold text-white mb-1">Antre du Kralamoure Géant</h4>
                <p className="text-xs text-zinc-500">Aucune ouverture prévue sur votre serveur via Metamob pour le moment.</p>
                <a href="https://metamob.fr/" target="_blank" rel="noopener noreferrer" className="mt-3 text-[10px] uppercase font-bold tracking-widest text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition-colors">
                    Consulter Metamob <ExternalLink className="h-3 w-3" />
                </a>
            </div>
        );
    }

    // Sort events by date
    const sortedEvents = [...events].sort((a, b) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime());
    const nextEvent = sortedEvents[0];
    const isImminent = new Date(nextEvent.event_datetime).getTime() - Date.now() < 3600000 * 24; // Less than 24h

    return (
        <div
            className="flex-1 rounded-2xl relative overflow-hidden group/krala"
            style={{
                background: "linear-gradient(135deg, rgba(6,78,59,0.3) 0%, rgba(2,44,34,0.8) 100%)",
                border: "1px solid rgba(16, 185, 129, 0.2)",
            }}
        >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[40px] opacity-20 pointer-events-none"
                style={{ background: "#10b981", transform: "translate(30%, -30%)" }} />

            <div className="p-4 relative z-10 flex flex-col h-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                            <Anchor className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white flex items-center gap-2">
                                Kralamoure Géant
                                <span className="px-1.5 py-0.5 rounded text-[8px] tracking-widest bg-emerald-500/20 text-emerald-300">
                                    {nextEvent.server.name}
                                </span>
                            </h3>
                            <p className="text-[10px] text-zinc-400 font-medium tracking-wide">Prochaine ouverture Prévue</p>
                        </div>
                    </div>
                </div>

                {/* Event Info */}
                <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex-1 flex flex-col justify-center relative overflow-hidden">
                    {isImminent && (
                        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50" />
                    )}

                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-emerald-950 flex items-center justify-center flex-shrink-0 border border-emerald-800/50">
                            <Clock className={cn("h-5 w-5 text-emerald-400", isImminent && "animate-pulse text-emerald-300")} />
                        </div>
                        <div>
                            <div className="text-emerald-100 font-bold text-sm tracking-wide capitalize">
                                {formatDate(nextEvent.event_datetime)}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[10px] font-medium text-emerald-400/70">
                                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {nextEvent.participants_count ?? 0} Inscrits</span>
                                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Tourbière [-60,-8]</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="mt-3 text-center">
                    <a
                        href={`https://metamob.fr/krala/${nextEvent.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors"
                    >
                        S'inscrire sur Metamob <ExternalLink className="h-3 w-3 mb-0.5" />
                    </a>
                </div>
            </div>
        </div>
    );
}
