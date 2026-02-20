"use client";

import { useState, useEffect } from "react";
import { getPendingTradeRequests, acceptTradeRequest, rejectTradeRequest, cancelTradeRequest } from "@/server/actions/ocre-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Inbox, Send, Check, X, Handshake } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function OcreTradeInbox({ guildId }: { guildId: string }) {
    const [incoming, setIncoming] = useState<any[]>([]);
    const [outgoing, setOutgoing] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            const res = await getPendingTradeRequests(guildId);
            if (res.success && res.data) {
                setIncoming(res.data.incoming);
                setOutgoing(res.data.outgoing);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [guildId]);

    const handleAction = async (requestId: string, action: 'accept' | 'reject' | 'cancel') => {
        setActionLoading(requestId);
        try {
            let res;
            if (action === 'accept') res = await acceptTradeRequest({ guildId, requestId });
            else if (action === 'reject') res = await rejectTradeRequest({ guildId, requestId });
            else res = await cancelTradeRequest({ guildId, requestId });

            if (res.success) {
                toast.success(action === 'accept' ? 'Échange accepté !' : action === 'reject' ? 'Demande refusée.' : 'Demande annulée.');
                await fetchData();
            } else {
                toast.error(res.error || "Erreur réseau");
                if (res.error === "Demande déjà traitée" || res.error?.includes("introuvable")) {
                    await fetchData();
                }
            }
        } catch (e) {
            toast.error("Erreur serveur");
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <Card className="bg-card/30 backdrop-blur-sm border-white/10">
                <CardContent className="p-6 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                </CardContent>
            </Card>
        );
    }

    if (incoming.length === 0 && outgoing.length === 0) {
        return null; // Don't show anything if no pending trades
    }

    return (
        <div className="space-y-6">
            {incoming.length > 0 && (
                <Card className="bg-emerald-950/20 backdrop-blur-sm border-emerald-500/20">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-400">
                            <Inbox className="h-5 w-5" />
                            Demandes reçues ({incoming.length})
                        </CardTitle>
                        <CardDescription>Ils ont besoin de vos doublons !</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-white/5">
                            {incoming.map((req) => (
                                <div key={req.id} className="p-4 sm:px-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="hidden sm:block mt-1">
                                            <Avatar className="h-10 w-10 border border-white/10">
                                                <AvatarImage src={req.requester.user.image} />
                                                <AvatarFallback className="bg-zinc-800 text-zinc-400">
                                                    {(req.requester.discordNickname || req.requester.user.name || "U")[0].toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-zinc-200">{req.requester.discordNickname || req.requester.user.name}</span>
                                                <span className="text-sm text-zinc-400">({req.requester.metamobPseudo})</span>
                                                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/10 flex items-center gap-1">
                                                    {req.monsterImageUrl && <img src={req.monsterImageUrl} alt={req.monsterName} className="w-3 h-3 object-contain" />}
                                                    {req.monsterName}
                                                </Badge>
                                                <span className="text-xs text-zinc-500">
                                                    il y a {formatDistanceToNow(new Date(req.createdAt), { addSuffix: false, locale: fr })}
                                                </span>
                                            </div>
                                            {req.message && (
                                                <p className="text-sm text-zinc-400 bg-black/40 p-2 rounded-md border border-white/5 mt-2 italic">
                                                    "{req.message}"
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
                                            className="flex-1 sm:flex-none border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                        >
                                            <X className="h-4 w-4 mr-2" />
                                            Refuser
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => handleAction(req.id, 'accept')}
                                            disabled={!!actionLoading}
                                            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white"
                                        >
                                            {actionLoading === req.id ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Check className="h-4 w-4 mr-2" />
                                            )}
                                            Accepter
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {outgoing.length > 0 && (
                <Card className="bg-card/30 backdrop-blur-sm border-white/10">
                    <CardHeader className="pb-3 border-b border-white/5">
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-zinc-300">
                            <Send className="h-5 w-5" />
                            Demandes envoyées ({outgoing.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-white/5">
                            {outgoing.map((req) => (
                                <div key={req.id} className="p-4 sm:px-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm text-zinc-400">Vous avez demandé un monstre à</span>
                                                <span className="font-semibold text-zinc-200">{req.target.discordNickname || req.target.user.name}</span>
                                                <Badge variant="outline" className="text-[10px] border-white/10 text-zinc-400 flex items-center gap-1">
                                                    {req.monsterImageUrl && <img src={req.monsterImageUrl} alt={req.monsterName} className="w-3 h-3 object-contain grayscale opacity-70" />}
                                                    {req.monsterName}
                                                </Badge>
                                            </div>
                                            {req.message && (
                                                <p className="text-xs text-zinc-500 italic mt-1 truncate max-w-sm">"{req.message}"</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="shrink-0 w-full sm:w-auto">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleAction(req.id, 'cancel')}
                                            disabled={!!actionLoading}
                                            className="w-full sm:w-auto text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                                        >
                                            {actionLoading === req.id ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <X className="h-4 w-4 mr-2" />
                                            )}
                                            Annuler la demande
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
