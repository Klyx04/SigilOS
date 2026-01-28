"use client";

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

    useEffect(() => {
        if (!isLeader) return;
        loadRequests();
        // No polling - will refresh on actions or manual page reload
    }, [runId, isLeader]);

    const loadRequests = async () => {
        const result = await getPendingJoinRequests(guildId, runId);
        if (result.success && result.requests) {
            setRequests(result.requests as JoinRequest[]);
        }
        setLoading(false);
    };

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

    // Only leaders can see this panel
    if (!isLeader) return null;

    if (loading) {
        return (
            <div className="rounded-xl bg-gradient-to-b from-[#1a0933] to-[#0d0520] border border-purple-500/30 p-4">
                <div className="flex items-center justify-center py-4 text-purple-400">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Chargement des candidatures...
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-xl bg-gradient-to-b from-[#1a0933] to-[#0d0520] border border-purple-500/30 p-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-amber-400" />
                Candidatures ({requests.length})
            </h3>

            {requests.length === 0 ? (
                <div className="text-center py-6 text-purple-300/50">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucune candidature en attente</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map((request) => (
                        <div
                            key={request.id}
                            className="p-3 rounded-lg bg-purple-900/30 border border-purple-500/30"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    {/* Candidate Name */}
                                    <h4 className="font-medium text-white mb-1">
                                        {request.displayName || "Joueur"}
                                    </h4>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant="secondary" className="bg-blue-600/20 text-blue-300 border-blue-500/30">
                                            <ClassIcon classId={request.classe} size={14} className="mr-1.5" />
                                            {request.classe}
                                        </Badge>
                                        <span className="text-xs text-purple-300/50">
                                            {new Date(request.createdAt).toLocaleDateString("fr-FR")}
                                        </span>
                                    </div>

                                    {request.message && (
                                        <div className="flex items-start gap-1 text-sm text-purple-200 mt-2">
                                            <MessageSquare className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                                            <span className="line-clamp-2">{request.message}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-1 shrink-0">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 bg-green-900/30 hover:bg-green-600 text-green-400 hover:text-white"
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
                                        className="h-8 w-8 bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white"
                                        onClick={() => handleRespond(request.id, false)}
                                        disabled={actionLoading === request.id || isPending}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
