"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getPendingTradeRequests, acceptTradeRequest, rejectTradeRequest, cancelTradeRequest } from "@/server/actions/ocre-actions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Inbox, Send, Check, X, Handshake, RefreshCw, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

import { getDisplayName } from "@/lib/display-name";

import { io } from "socket.io-client";
import { buildWsUrl } from "@/lib/socket-utils";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 60_000; // Increased to 60s as we now have real-time sockets

export function OcreTradeInbox({ guildId }: { guildId: string }) {
    const { data: session } = useSession();
    const router = useRouter();
    const [incoming, setIncoming] = useState<any[]>([]);
    const [outgoing, setOutgoing] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [isConnected, setIsConnected] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const socketRef = useRef<any>(null);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await getPendingTradeRequests(guildId);
            if (res.success && res.data) {
                setIncoming(res.data.incoming);
                setOutgoing(res.data.outgoing);
                setLastRefresh(new Date());
            }
        } finally {
            if (!silent) setLoading(false);
        }
    }, [guildId]);

    // WebSocket + Polling
    useEffect(() => {
        fetchData(false);
        
        // Polling fallback
        pollRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);

        // Real-time Socket
        const socketUrl = buildWsUrl();
        const socket = io(socketUrl, {
            path: "/socket.io/",
            withCredentials: true,
            query: { guildId }
        });
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("[WS] 📡 Connecté pour l'Inbox Trade");
            setIsConnected(true);
        });
        
        socket.on("disconnect", () => {
            console.log("[WS] 🔴 Déconnecté de l'Inbox Trade");
            setIsConnected(false);
        });
        
        socket.on("ocre:trade:update", (data) => {
            console.log("[WS] 🔄 Update trade reçu:", data);
            fetchData(true);
        });

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [fetchData, guildId]);

    const handleAction = async (requestId: string, action: 'accept' | 'reject' | 'cancel') => {
        setActionLoading(requestId);
        try {
            let res;
            if (action === 'accept') res = await acceptTradeRequest({ guildId, requestId });
            else if (action === 'reject') res = await rejectTradeRequest({ guildId, requestId });
            else res = await cancelTradeRequest({ guildId, requestId });

            if (res.success) {
                toast.success(
                    action === 'accept' ? '🤝 Échange accepté ! Les compteurs Metamob sont mis à jour.' :
                        action === 'reject' ? '❌ Demande refusée.' :
                            '↩️ Demande annulée.'
                );
                await fetchData(true);
                router.refresh(); // Update the main dashboard data
            } else {
                toast.error(res.error || "Erreur réseau");
                if (res.error === "Demande déjà traitée" || res.error?.includes("introuvable")) {
                    await fetchData(true);
                }
            }
        } catch {
            toast.error("Erreur serveur");
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="relative">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500 opacity-20" />
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-400 absolute top-0 left-0 [animation-delay:-0.5s]" />
                </div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest animate-pulse">Chargement de votre inbox...</p>
            </div>
        );
    }

    if (incoming.length === 0 && outgoing.length === 0) {
        return (
            <div className="p-10 rounded-3xl border border-white/5 bg-zinc-900/10 flex flex-col items-center justify-center text-center space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-zinc-800/50 flex items-center justify-center border border-white/5">
                    <Inbox className="h-6 w-6 text-zinc-600" />
                </div>
                <div className="max-w-xs">
                    <h4 className="font-bold text-zinc-400 text-sm">Aucun échange en cours</h4>
                    <p className="text-caption text-zinc-600 mt-1">
                        Utilisez la recherche de doublons ci-dessous pour trouver des partenaires et proposer des échanges.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Header premium */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                        <Handshake className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-black text-zinc-100 uppercase tracking-wider leading-none">
                            Inbox des Échanges
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-caption h-4 border-emerald-500/30 text-emerald-400 bg-emerald-500/10 px-1.5 py-0">
                                {incoming.length + outgoing.length} en attente
                            </Badge>
                            <span className={cn(
                                "text-caption font-bold flex items-center gap-1.5 transition-colors duration-300",
                                isConnected ? "text-emerald-500" : "text-zinc-600"
                            )}>
                                <span className="relative flex h-1.5 w-1.5">
                                    {isConnected && (
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    )}
                                    <span className={cn(
                                        "relative inline-flex rounded-full h-1.5 w-1.5",
                                        isConnected ? "bg-emerald-500" : "bg-zinc-600"
                                    )}></span>
                                </span>
                                {isConnected ? "Temps réel actif" : "Connexion au serveur..."}
                            </span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => fetchData(false)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/50 hover:bg-zinc-800 border border-white/5 text-caption text-zinc-400 hover:text-zinc-200 transition-all font-bold uppercase tracking-wider overflow-hidden group relative"
                >
                    <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-300 relative z-10" />
                    <span className="relative z-10">
                        {formatDistanceToNow(lastRefresh, { addSuffix: true, locale: fr })}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-300"></div>
                </button>
            </div>

            {/* Demandes REÇUES */}
            {incoming.length > 0 && (
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-950/10 overflow-hidden shadow-2xl shadow-emerald-950/20">
                    <div className="px-5 py-4 border-b border-emerald-500/10 flex items-center gap-2 bg-emerald-500/5">
                        <Inbox className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-black text-emerald-100 uppercase tracking-tight">
                            Demandes Reçues <span className="text-emerald-400/60 font-bold ml-1">({incoming.length})</span>
                        </span>
                        <span className="text-caption text-emerald-500/40 font-bold ml-auto uppercase tracking-widest hidden sm:inline">Action requise</span>
                    </div>
                    <div className="divide-y divide-white/[0.04] bg-black/20">
                        {incoming.map((req) => (
                            <div
                                 key={req.id}
                                 className="p-5 sm:p-6 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between hover:bg-white/[0.03] transition-all duration-300 group/item"
                             >
                                 <div className="flex items-start gap-5 flex-1 min-w-0 w-full">
                                     <div className="relative shrink-0">
                                         <div className="absolute -inset-1 bg-emerald-500/20 blur-lg rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                                         <Avatar className="h-12 w-12 border-2 border-emerald-500/20 group-hover/item:border-emerald-500/40 transition-all shadow-xl relative z-10">
                                             <AvatarImage src={req.requester.user.image} />
                                             <AvatarFallback className="bg-zinc-800 text-zinc-400 text-sm font-black uppercase">
                                                 {(getDisplayName(req.requester) || "U")[0]}
                                             </AvatarFallback>
                                         </Avatar>
                                         <div className="absolute -bottom-1 -right-1 bg-emerald-600 p-1 rounded-full border-2 border-zinc-950 shadow-lg z-20">
                                             <Handshake className="w-2.5 h-2.5 text-white" />
                                         </div>
                                     </div>
                                     
                                     <div className="space-y-3 min-w-0 flex-1">
                                         <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                             <span className="font-black text-base text-white tracking-tight leading-none">
                                                 {getDisplayName(req.requester)}
                                             </span>
                                             <Badge variant="outline" className="text-caption font-black uppercase text-zinc-500 border-white/5 bg-white/5 py-0 px-2 h-5">
                                                 {req.requester.metamobPseudo}
                                             </Badge>
                                             <span className="text-caption text-zinc-600 font-bold flex items-center gap-1.5 ml-auto lg:ml-0">
                                                 <Clock className="w-3 h-3" />
                                                 {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true, locale: fr })}
                                             </span>
                                         </div>

                                         <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                             <div className="shrink-0 flex items-center gap-3 bg-white/5 border border-white/5 rounded-2xl px-4 py-2.5 group-hover/item:bg-emerald-500/5 group-hover/item:border-emerald-500/20 transition-all overflow-hidden relative shadow-inner">
                                                 {req.monsterImageUrl && (
                                                     <div className="relative shrink-0">
                                                         <div className="absolute inset-0 bg-emerald-400 blur-md opacity-20"></div>
                                                         <img
                                                             src={req.monsterImageUrl}
                                                             alt={req.monsterName}
                                                             className="w-8 h-8 object-contain relative z-10 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                                                         />
                                                     </div>
                                                 )}
                                                 <div className="flex flex-col min-w-0">
                                                     <span className="text-caption uppercase font-black text-emerald-500/40 leading-none mb-1 tracking-widest">Souhaité</span>
                                                     <span className="text-xs font-black text-emerald-100 truncate tracking-tight">
                                                         {req.monsterName}
                                                     </span>
                                                 </div>
                                             </div>

                                             {req.message && (
                                                 <div className="flex-1 min-w-0 bg-zinc-900/50 border border-white/5 rounded-2xl px-4 py-2.5 flex items-start gap-2 italic relative group-hover/item:border-white/10 transition-colors">
                                                     <span className="text-emerald-500/40 font-serif text-xl leading-none shrink-0 mt-0.5">"</span>
                                                     <p className="text-caption text-zinc-400 leading-relaxed truncate lg:whitespace-normal lg:line-clamp-2">
                                                         {req.message}
                                                     </p>
                                                     <span className="text-emerald-500/40 font-serif text-xl leading-none self-end shrink-0 hidden lg:inline">"</span>
                                                 </div>
                                             )}
                                         </div>
                                     </div>
                                 </div>

                                 <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto pt-2 lg:pt-0">
                                     <Button
                                         variant="outline"
                                         size="sm"
                                         onClick={() => handleAction(req.id, 'reject')}
                                         disabled={!!actionLoading}
                                         className="flex-1 lg:flex-none border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/5 transition-all h-10 rounded-xl px-5 font-bold text-caption uppercase tracking-wider"
                                     >
                                         {actionLoading === req.id ? (
                                             <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                         ) : (
                                             <X className="h-3.5 w-3.5 mr-2" />
                                         )}
                                         Refuser
                                     </Button>
                                     <Button
                                         size="sm"
                                         onClick={() => handleAction(req.id, 'accept')}
                                         disabled={!!actionLoading}
                                         className="flex-1 lg:flex-none bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/20 h-10 rounded-xl px-6 font-black text-caption uppercase tracking-wider transition-all active:scale-95 border-b-2 border-emerald-700"
                                     >
                                         {actionLoading === req.id ? (
                                             <Loader2 className="h-3 w-3 animate-spin mr-2" />
                                         ) : (
                                             <Check className="h-3.5 w-3.5 mr-2" />
                                         )}
                                         Accepter
                                     </Button>
                                 </div>
                             </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Demandes ENVOYÉES */}
            {outgoing.length > 0 && (
                <div className="rounded-3xl border border-zinc-700/30 bg-zinc-900/10 overflow-hidden shadow-xl">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center gap-2 bg-white/[0.02]">
                        <Send className="h-4 w-4 text-zinc-500" />
                        <span className="text-sm font-black text-zinc-400 uppercase tracking-tight">
                            Demandes Envoyées <span className="text-zinc-600 font-bold ml-1">({outgoing.length})</span>
                        </span>
                        <span className="text-caption text-zinc-600 font-bold ml-auto uppercase tracking-widest hidden sm:inline">En attente</span>
                    </div>
                    <div className="divide-y divide-white/[0.04] bg-black/20">
                        {outgoing.map((req) => (
                            <div
                                key={req.id}
                                className="p-5 sm:px-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between hover:bg-white/[0.03] transition-all duration-300 group/item"
                            >
                                <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
                                    <Avatar className="h-10 w-10 border border-white/10 shrink-0 group-hover/item:border-zinc-700 transition-colors shadow-lg">
                                        <AvatarImage src={req.target.user.image} />
                                        <AvatarFallback className="bg-zinc-800 text-zinc-500 text-xs font-black uppercase">
                                            {(getDisplayName(req.target) || "U")[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-2.5 min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                                            <span className="text-caption font-black text-zinc-600 uppercase tracking-widest">Destinataire</span>
                                            <span className="font-black text-sm text-zinc-200">
                                                {getDisplayName(req.target)}
                                            </span>
                                            <Badge variant="outline" className="text-caption font-black uppercase text-zinc-600 border-white/5 bg-white/5 py-0 px-2 h-4">
                                                {req.target.metamobPseudo}
                                            </Badge>
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="bg-white/5 border border-white/5 rounded-xl px-2.5 py-1 flex items-center gap-2 group-hover/item:bg-white/10 transition-colors">
                                                {req.monsterImageUrl && (
                                                    <img
                                                        src={req.monsterImageUrl}
                                                        alt={req.monsterName}
                                                        className="w-5 h-5 object-contain grayscale opacity-60 group-hover/item:grayscale-0 group-hover/item:opacity-100 transition-all"
                                                    />
                                                )}
                                                <span className="text-caption font-bold text-zinc-400 group-hover/item:text-zinc-200 truncate max-w-[150px]">
                                                    {req.monsterName}
                                                </span>
                                            </div>
                                            
                                            {req.message && (
                                                <p className="text-caption text-zinc-600 italic bg-zinc-900/40 px-3 py-1 rounded-lg border border-white/5 truncate max-w-[200px] lg:max-w-xs">
                                                    "{req.message}"
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto pt-2 sm:pt-0">
                                    <span className="hidden lg:flex items-center gap-1 text-caption font-black uppercase text-amber-500/60 mr-2 tracking-widest">
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60"></span>
                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                        </span>
                                        En attente
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleAction(req.id, 'cancel')}
                                        disabled={!!actionLoading}
                                        className="shrink-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all h-9 px-4 rounded-xl font-bold uppercase text-caption tracking-widest border border-white/5 sm:border-transparent hover:border-red-500/20 w-full sm:w-auto"
                                    >
                                        {actionLoading === req.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                                        ) : (
                                            <X className="h-3.5 w-3.5 mr-1" />
                                        )}
                                        Annuler
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
