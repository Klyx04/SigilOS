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

const POLL_INTERVAL_MS = 10_000; // 10 secondes

export function OcreTradeInbox({ guildId }: { guildId: string }) {
    const [incoming, setIncoming] = useState<any[]>([]);
    const [outgoing, setOutgoing] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // Initial load + polling toutes les 10s
    useEffect(() => {
        fetchData(false);
        pollRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [fetchData]);

    const handleAction = async (requestId: string, action: 'accept' | 'reject' | 'cancel') => {
        setActionLoading(requestId);
        try {
            let res;
            if (action === 'accept') res = await acceptTradeRequest({ guildId, requestId });
            else if (action === 'reject') res = await rejectTradeRequest({ guildId, requestId });
            else res = await cancelTradeRequest({ guildId, requestId });

            if (res.success) {
                toast.success(
                    action === 'accept' ? '🤝 Échange accepté ! Les compteurs metamob sont mis à jour.' :
                        action === 'reject' ? '❌ Demande refusée.' :
                            '↩️ Demande annulée.'
                );
                await fetchData(true);
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
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
            </div>
        );
    }

    if (incoming.length === 0 && outgoing.length === 0) return null;

    return (
        <div className="space-y-4">
            {/* Header avec dernière mise à jour */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    <Handshake className="w-3.5 h-3.5 text-emerald-400/70" />
                    <span>Demandes de Trade</span>
                    {(incoming.length + outgoing.length) > 0 && (
                        <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 px-1.5 py-0">
                            {incoming.length + outgoing.length}
                        </Badge>
                    )}
                </div>
                <button
                    onClick={() => fetchData(false)}
                    className="flex items-center gap-1.5 text-[9px] text-zinc-600 hover:text-zinc-300 transition-colors font-bold uppercase tracking-widest group"
                >
                    <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                    <span className="hidden sm:inline">
                        <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                        {formatDistanceToNow(lastRefresh, { addSuffix: true, locale: fr })}
                    </span>
                </button>
            </div>

            {/* Demandes REÇUES */}
            {incoming.length > 0 && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 overflow-hidden">
                    <div className="px-4 py-3 border-b border-emerald-500/10 flex items-center gap-2">
                        <Inbox className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-black text-emerald-400">
                            Reçues <span className="text-emerald-300/60 font-bold">({incoming.length})</span>
                        </span>
                        <span className="text-[10px] text-zinc-500 font-bold ml-auto">Ils ont besoin de vos doublons</span>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                        {incoming.map((req) => (
                            <div
                                key={req.id}
                                className="p-4 sm:px-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-white/[0.02] transition-colors"
                            >
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <Avatar className="h-9 w-9 border border-white/10 shrink-0">
                                        <AvatarImage src={req.requester.user.image} />
                                        <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                                            {(req.requester.discordNickname || req.requester.user.name || "U")[0].toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-1.5 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-black text-sm text-zinc-100">
                                                {req.requester.discordNickname || req.requester.user.name}
                                            </span>
                                            <span className="text-xs text-zinc-500">
                                                ({req.requester.metamobPseudo})
                                            </span>
                                            {/* Badge monstre avec nom résolu */}
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] border-emerald-500/30 text-emerald-300 bg-emerald-500/10 flex items-center gap-1 max-w-[180px] truncate"
                                            >
                                                {req.monsterImageUrl && (
                                                    <img
                                                        src={req.monsterImageUrl}
                                                        alt={req.monsterName}
                                                        className="w-3.5 h-3.5 object-contain flex-shrink-0"
                                                    />
                                                )}
                                                <span className="truncate">{req.monsterName}</span>
                                            </Badge>
                                            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                                                <Clock className="w-2.5 h-2.5" />
                                                {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true, locale: fr })}
                                            </span>
                                        </div>
                                        {req.message && (
                                            <p className="text-xs text-zinc-400 bg-zinc-900/50 px-3 py-1.5 rounded-xl border border-white/5 italic max-w-xs">
                                                " {req.message} "
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleAction(req.id, 'reject')}
                                        disabled={!!actionLoading}
                                        className="flex-1 sm:flex-none border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-400/30 transition-all h-8"
                                    >
                                        {actionLoading === req.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <X className="h-3 w-3 mr-1.5" />
                                        )}
                                        Refuser
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => handleAction(req.id, 'accept')}
                                        disabled={!!actionLoading}
                                        className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 h-8"
                                    >
                                        {actionLoading === req.id ? (
                                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                        ) : (
                                            <Check className="h-3 w-3 mr-1.5" />
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
                <div className="rounded-2xl border border-zinc-700/30 bg-zinc-900/20 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                        <Send className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm font-black text-zinc-300">
                            Envoyées <span className="text-zinc-500 font-bold">({outgoing.length})</span>
                        </span>
                        <span className="text-[10px] text-zinc-600 font-bold ml-auto">En attente de réponse</span>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                        {outgoing.map((req) => (
                            <div
                                key={req.id}
                                className="p-4 sm:px-5 flex items-center gap-4 justify-between hover:bg-white/[0.02] transition-colors"
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <Avatar className="h-8 w-8 border border-white/10 shrink-0">
                                        <AvatarImage src={req.target.user.image} />
                                        <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                                            {(req.target.discordNickname || req.target.user.name || "U")[0].toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-xs text-zinc-400">À</span>
                                            <span className="font-black text-sm text-zinc-100">
                                                {req.target.discordNickname || req.target.user.name}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] border-zinc-600/40 text-zinc-400 bg-zinc-800/50 flex items-center gap-1 max-w-[160px] truncate"
                                            >
                                                {req.monsterImageUrl && (
                                                    <img
                                                        src={req.monsterImageUrl}
                                                        alt={req.monsterName}
                                                        className="w-3 h-3 object-contain grayscale opacity-60 flex-shrink-0"
                                                    />
                                                )}
                                                <span className="truncate">{req.monsterName}</span>
                                            </Badge>
                                            <span className={cn(
                                                "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border",
                                                "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                            )}>
                                                En attente
                                            </span>
                                        </div>
                                        {req.message && (
                                            <p className="text-[11px] text-zinc-500 italic truncate max-w-xs">
                                                " {req.message} "
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleAction(req.id, 'cancel')}
                                    disabled={!!actionLoading}
                                    className="shrink-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all h-8 px-3"
                                >
                                    {actionLoading === req.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <X className="h-3.5 w-3.5 mr-1.5" />
                                    )}
                                    Annuler
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
