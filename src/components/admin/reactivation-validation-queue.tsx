"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X, Clock, MessageSquare, History, UserCheck, ShieldAlert, RefreshCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { updateMemberProfileStatus } from "@/server/actions/user-actions";
import { Input } from "@/components/ui/input";
import { getDisplayName, getGameDisplayName } from "@/lib/display-name";

interface ReactivationRequest {
    id: string;
    userId: string;
    pseudoDofus: string | null;
    discordNickname: string | null;
    reactivationRequestedAt: Date | string | null;
    reactivationRequestReason: string | null;
    archiveReason: string | null;
    archivedAt: Date | string | null;
    scheduledDeletion: Date | string | null;
    user: {
        name: string | null;
        image: string | null;
    };
}

export function ReactivationValidationQueue({ requests: initialRequests, guildId }: { requests: any[], guildId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [requests, setRequests] = useState(initialRequests);
    const [searchTerm, setSearchTerm] = useState("");
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [adminMessages, setAdminMessages] = useState<Record<string, string>>({});

    const handleDecision = (profileId: string, status: "ACTIVE" | "ARCHIVED") => {
        const message = adminMessages[profileId];
        setProcessingId(profileId);
        startTransition(async () => {
            try {
                const res = await updateMemberProfileStatus(
                    profileId, 
                    status, 
                    status === "ACTIVE" ? "REACTIVATION_APPROVED" : "REACTIVATION_REJECTED",
                    undefined,
                    message
                );
                
                if (res) {
                    toast.success(status === "ACTIVE" ? "Membre réintégré !" : "Demande refusée");
                    setRequests(prev => prev.filter(r => r.id !== profileId));
                    router.refresh();
                }
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Erreur action");
            } finally {
                setProcessingId(null);
            }
        });
    };

    const filteredRequests = requests.filter(r => 
        (r.pseudoDofus || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.user.name || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-zinc-900/50 p-4 rounded-2xl border border-white/5">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-zinc-400 border-r border-white/10 pr-4">
                        <span className="text-white font-medium">{requests.length}</span> demandes en attente
                    </div>
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                    <Input
                        placeholder="Chercher un membre..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 bg-black/20 border-white/10 text-xs"
                    />
                </div>
            </div>

            {filteredRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[30vh] text-zinc-500 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20">
                    <UserCheck className="w-12 h-12 mb-4 opacity-20" />
                    <p className="font-medium">Aucune demande de réintégration en cours.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRequests.map((req) => (
                        <Card key={req.id} className="bg-zinc-900/40 border-white/5 overflow-hidden rounded-2xl group hover:border-emerald-500/20 transition-all duration-300">
                            <CardHeader className="p-6 pb-4 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <Avatar className="h-12 w-12 border-2 border-white/5">
                                                <AvatarImage src={req.user.image} />
                                                <AvatarFallback>{(getGameDisplayName(req) || "?")[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-zinc-900 flex items-center justify-center">
                                                <RefreshCcw className="w-3 h-3 text-white" />
                                            </div>
                                        </div>
                                        <div className="space-y-0.5">
                                            <h3 className="text-sm font-black text-white uppercase tracking-tight">{getGameDisplayName(req)}</h3>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-caption bg-amber-500/5 text-amber-500 border-amber-500/20 h-4 uppercase">
                                                    Archivé
                                                </Badge>
                                                <span className="text-caption text-zinc-500 font-medium italic">
                                                    {req.archivedAt ? `depuis ${formatDistanceToNow(new Date(req.archivedAt), { locale: fr })}` : "Archive indéterminée"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-caption text-emerald-400 font-black uppercase tracking-widest block">Demande</span>
                                        <span className="text-caption text-zinc-500 font-medium">
                                            {req.reactivationRequestedAt ? formatDistanceToNow(new Date(req.reactivationRequestedAt), { addSuffix: true, locale: fr }) : "?"}
                                        </span>
                                    </div>
                                </div>
                            </CardHeader>

                            <CardContent className="px-6 pb-6 space-y-4">
                                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                                    <div className="flex items-center gap-2 text-caption font-black uppercase tracking-wider text-emerald-500">
                                        <MessageSquare className="w-3 h-3" />
                                        Motif du retour
                                    </div>
                                    <p className="text-xs text-zinc-300 italic leading-relaxed">
                                        "{req.reactivationRequestReason || "Aucun motif précisé"}"
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2 rounded-lg bg-black/20 border border-white/5">
                                        <span className="block text-caption text-zinc-500 uppercase font-bold">Raison Archive</span>
                                        <span className="text-caption text-zinc-300 font-medium">{req.archiveReason || "Action Admin"}</span>
                                    </div>
                                    <div className="p-2 rounded-lg bg-black/20 border border-white/5">
                                        <span className="block text-caption text-zinc-500 uppercase font-bold">Suppression</span>
                                        <span className="text-xs text-red-400 font-black tabular-nums">
                                            {req.scheduledDeletion ? `J-${Math.ceil((new Date(req.scheduledDeletion).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}` : "Jamais"}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-caption font-black uppercase tracking-wider text-zinc-500">
                                        <MessageSquare className="w-3 h-3" />
                                        Message au membre (optionnel)
                                    </div>
                                    <textarea
                                        placeholder="Ex: Bon retour parmi nous ! ou Précise ton pseudo..."
                                        value={adminMessages[req.id] || ""}
                                        onChange={(e) => setAdminMessages(prev => ({ ...prev, [req.id]: e.target.value }))}
                                        className="w-full bg-black/20 border border-white/5 rounded-xl p-3 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50 transition-colors placeholder:text-zinc-600 resize-none h-20"
                                    />
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button 
                                        onClick={() => handleDecision(req.id, "ACTIVE")}
                                        disabled={processingId === req.id}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-caption h-10 rounded-xl"
                                    >
                                        {processingId === req.id ? <RefreshCcw className="w-3 h-3 animate-spin mr-2" /> : <Check className="w-3.5 h-3.5 mr-2" />}
                                        Accepter
                                    </Button>
                                    <Button 
                                        variant="outline"
                                        onClick={() => handleDecision(req.id, "ARCHIVED")}
                                        disabled={processingId === req.id}
                                        className="flex-1 border-white/5 hover:border-red-500/30 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 font-black uppercase tracking-widest text-caption h-10 rounded-xl transition-all"
                                    >
                                        <X className="w-3.5 h-3.5 mr-2" />
                                        Refuser
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
