"use client";
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users, Check, X, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    getPendingJoinRequests,
    respondToJoinRequest
} from "@/server/actions/songes/dream-run-actions";
import { ClassIcon } from "@/components/shared/class-icon";
import { PseudoChip } from "@/components/shared/pseudo-chip";

interface JoinRequest {
    id: string;
    userId: string;
    classe: string;
    message: string | null;
    createdAt: Date;
    displayName?: string; // Discord pseudo or Dofus pseudo
}

interface JoinRequestsPanelProps {
    guildId: string;
    runId: string;
    isLeader: boolean;
}

export function JoinRequestsPanel({ guildId, runId, isLeader }: JoinRequestsPanelProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [requests, setRequests] = useState<JoinRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadRequests = async () => {
        const result = await getPendingJoinRequests(guildId, runId);
        if (result.success && result.requests) {
            setRequests(result.requests as JoinRequest[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadRequests();
        // No polling - will refresh on actions or manual page reload
    }, [runId]);

    const handleRespond = (requestId: string, accept: boolean) => {
        setActionLoading(requestId);
        startTransition(async () => {
            await respondToJoinRequest(guildId, { requestId, accept });
            // Reload to refresh list
            await loadRequests();
            setActionLoading(null);
            // Refresh the entire page to update team members display
            router.refresh();
        });
    };

    // Tous les membres peuvent voir ce panneau (UI modifiée)

    if (loading) {
        return (
            <div className="rounded-xl bg-gradient-to-b from-[#1a0933] to-[#0d0520] border border-info/30 p-4">
                <div className="flex items-center justify-center py-4 text-info">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Chargement des candidatures...
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-gradient-to-b from-[#1a0933] to-[#0d0520] border border-info/30 p-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-warning" />
                Candidatures ({requests.length})
            </h3>

            {requests.length === 0 ? (
                <div className="text-center py-6 text-info/50">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucune candidature en attente</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map((request) => (
                        <div
                            key={request.id}
                            className="p-3 rounded-lg bg-surface/40 border border-border"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    {/* Pseudo du candidat : icône de classe + copie unitaire `/w` */}
                                    <PseudoChip
                                        pseudo={request.displayName || "Joueur"}
                                        classe={request.classe}
                                        className="mb-1 text-sm font-medium text-foreground"
                                    />
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs text-foreground/40">
                                            {new Date(request.createdAt).toLocaleDateString("fr-FR")}
                                        </span>
                                    </div>

                                    {request.message && (
                                        <div className="flex items-start gap-1 text-sm text-foreground/70 mt-2">
                                            <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />
                                            <span className="line-clamp-2">{request.message}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                {isLeader && (
                                    <div className="flex gap-1 shrink-0">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 bg-green-900/30 hover:bg-green-600 text-green-400 hover:text-foreground"
                                            onClick={() => handleRespond(request.id, true)}
                                            disabled={actionLoading === request.id || isPending}
                                        >
                                            {actionLoading === request.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Check className="w-4 h-4" />
                                            )}
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 bg-danger/30 hover:bg-danger text-danger hover:text-danger-foreground"
                                            onClick={() => handleRespond(request.id, false)}
                                            disabled={actionLoading === request.id || isPending}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
