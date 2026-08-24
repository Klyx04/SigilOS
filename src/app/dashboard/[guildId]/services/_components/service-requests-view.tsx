"use client";

import { useState, useTransition } from "react";
import { type ServiceRequestWithDetails, closeServiceRequestAction } from "@/server/actions/service-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Clock, CheckCircle2, MessageSquare, Star, ArrowRight, UserCheck, ShieldCheck, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS } from "@/server/actions/services-constants";
import { ServiceCategory, ServiceRequestStatus } from "@prisma/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ServiceRequestsViewProps {
    guildId: string;
    requests: ServiceRequestWithDetails[];
    currentUserId?: string;
    currentProfileId?: string;
    isAdmin?: boolean;
    onLeaveFeedback?: (req: ServiceRequestWithDetails) => void;
    onReply?: (req: ServiceRequestWithDetails) => void;
}

export function ServiceRequestsView({
    guildId,
    requests,
    currentUserId,
    currentProfileId,
    isAdmin = false,
    onLeaveFeedback,
    onReply,
}: ServiceRequestsViewProps) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<"ALL" | ServiceRequestStatus>("ALL");
    const [roleFilter, setRoleFilter] = useState<"ALL" | "CLIENT" | "PROVIDER">("ALL");
    const [isPending, startTransition] = useTransition();

    const handleCloseRequest = (requestId: string, serviceTitle: string) => {
        startTransition(async () => {
            const res = await closeServiceRequestAction(guildId, requestId);
            if (res.success) {
                toast.success("Demande clôturée avec succès !", {
                    description: `Une invitation à laisser un avis a été envoyée au client pour "${serviceTitle}".`,
                });
            } else {
                toast.error(res.error || "Erreur lors de la clôture de la demande");
            }
        });
    };

    const filteredRequests = requests.filter((r) => {
        // Status filter
        if (statusFilter !== "ALL" && r.status !== statusFilter) return false;

        // Role filter
        if (roleFilter === "CLIENT" && r.clientProfileId !== currentProfileId) return false;
        if (roleFilter === "PROVIDER" && r.providerProfileId !== currentProfileId) return false;

        // Search text
        if (!search) return true;
        const q = search.toLowerCase();
        const clientName = r.clientProfile?.pseudoDofus || r.clientProfile?.discordNickname || r.clientName;
        const providerName = r.providerProfile?.pseudoDofus || r.providerProfile?.discordNickname || "Passeur";
        return (
            r.listing.title.toLowerCase().includes(q) ||
            clientName.toLowerCase().includes(q) ||
            providerName.toLowerCase().includes(q) ||
            (r.customMessage || "").toLowerCase().includes(q)
        );
    });

    const pendingCount = requests.filter((r) => r.status === "PENDING" || r.status === "REPLIED").length;
    const closedCount = requests.filter((r) => r.status === "CLOSED").length;

    return (
        <div className="space-y-5">
            {/* Stats summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <Card className="bg-surface/60 border-border/80 p-4 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-info/15 border border-info/30 flex items-center justify-center text-info shrink-0">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-caption font-bold text-muted-foreground uppercase tracking-wider">
                            Total demandes
                        </p>
                        <p className="text-xl font-black text-foreground">{requests.length}</p>
                    </div>
                </Card>

                <Card className="bg-surface/60 border-border/80 p-4 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-warning/15 border border-warning/30 flex items-center justify-center text-warning shrink-0">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-caption font-bold text-muted-foreground uppercase tracking-wider">
                            En cours
                        </p>
                        <p className="text-xl font-black text-warning">{pendingCount}</p>
                    </div>
                </Card>

                <Card className="bg-surface/60 border-border/80 p-4 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center text-success shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-caption font-bold text-muted-foreground uppercase tracking-wider">
                            Clôturées
                        </p>
                        <p className="text-xl font-black text-success">{closedCount}</p>
                    </div>
                </Card>
            </div>

            {/* Filter toolbar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher par service, passeur, client..."
                        className="pl-10 h-10 bg-surface/60 border-border text-sm"
                    />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Role Filter */}
                    <div className="bg-surface/80 border border-border p-1 rounded-xl flex items-center gap-1 text-xs">
                        <button
                            type="button"
                            onClick={() => setRoleFilter("ALL")}
                            className={cn(
                                "px-2.5 py-1 rounded-lg font-bold transition-colors",
                                roleFilter === "ALL" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Toutes
                        </button>
                        <button
                            type="button"
                            onClick={() => setRoleFilter("CLIENT")}
                            className={cn(
                                "px-2.5 py-1 rounded-lg font-bold transition-colors",
                                roleFilter === "CLIENT" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Mes demandes
                        </button>
                        <button
                            type="button"
                            onClick={() => setRoleFilter("PROVIDER")}
                            className={cn(
                                "px-2.5 py-1 rounded-lg font-bold transition-colors",
                                roleFilter === "PROVIDER" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Mes prestations
                        </button>
                    </div>

                    {/* Status Filter */}
                    <div className="bg-surface/80 border border-border p-1 rounded-xl flex items-center gap-1 text-xs">
                        <button
                            type="button"
                            onClick={() => setStatusFilter("ALL")}
                            className={cn(
                                "px-2.5 py-1 rounded-lg font-bold transition-colors",
                                statusFilter === "ALL" ? "bg-elevated text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Tous statuts
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter(ServiceRequestStatus.PENDING)}
                            className={cn(
                                "px-2.5 py-1 rounded-lg font-bold transition-colors",
                                statusFilter === ServiceRequestStatus.PENDING ? "bg-warning/20 text-warning border border-warning/30" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Attente
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter(ServiceRequestStatus.CLOSED)}
                            className={cn(
                                "px-2.5 py-1 rounded-lg font-bold transition-colors",
                                statusFilter === ServiceRequestStatus.CLOSED ? "bg-success/20 text-success border border-success/30" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Clôturées
                        </button>
                    </div>
                </div>
            </div>

            {/* List of Requests */}
            {filteredRequests.length === 0 ? (
                <Card className="bg-surface/40 border-border/60 p-12 text-center">
                    <p className="text-sm text-muted-foreground">
                        Aucune demande trouvée avec ces critères.
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {filteredRequests.map((r) => {
                        const clientName = r.clientProfile?.pseudoDofus || r.clientProfile?.discordNickname || r.clientName;
                        const providerName = r.providerProfile?.pseudoDofus || r.providerProfile?.discordNickname || r.providerProfile?.user?.name || "Passeur";
                        const isProvider = r.providerProfileId === currentProfileId;
                        const isClient = r.clientProfileId === currentProfileId;

                        return (
                            <Card key={r.id} className="bg-surface/60 border-border/80 hover:bg-surface/80 transition-colors">
                                <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    {/* Left: Service info & parties */}
                                    <div className="space-y-2.5 flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant="outline" className="text-caption font-bold border-border text-muted-foreground">
                                                {CATEGORY_LABELS[r.listing.category] || r.listing.category}
                                            </Badge>
                                            <span className="text-sm font-black text-foreground truncate">
                                                {r.listing.title}
                                            </span>

                                            {/* Status Badge */}
                                            {r.status === "PENDING" && (
                                                <Badge className="bg-warning/15 text-warning border-warning/30 text-caption font-bold flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    En attente de réponse
                                                </Badge>
                                            )}
                                            {r.status === "REPLIED" && (
                                                <Badge className="bg-info/15 text-info border-info/30 text-caption font-bold flex items-center gap-1">
                                                    <MessageSquare className="w-3 h-3" />
                                                    Réponse envoyée
                                                </Badge>
                                            )}
                                            {r.status === "CLOSED" && (
                                                <Badge className="bg-success/15 text-success border-success/30 text-caption font-bold flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Prestation terminée
                                                </Badge>
                                            )}
                                        </div>

                                        {/* Client ↔ Provider flow */}
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-caption text-muted-foreground font-semibold">Client :</span>
                                                <span className="font-bold text-foreground">{clientName}</span>
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-caption text-muted-foreground font-semibold">Passeur :</span>
                                                <span className="font-bold text-foreground">{providerName}</span>
                                            </div>
                                            <span className="text-caption text-muted-foreground">
                                                • {format(new Date(r.createdAt), "d MMM yyyy à HH:mm", { locale: fr })}
                                            </span>
                                        </div>

                                        {/* Options / Message */}
                                        {r.options && r.options.length > 0 && (
                                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                                <span className="text-caption text-muted-foreground font-semibold">Options :</span>
                                                {r.options.map((opt, i) => (
                                                    <Badge key={i} variant="secondary" className="text-[11px] px-2 py-0">
                                                        {opt}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}

                                        {r.customMessage && (
                                            <p className="text-xs text-foreground/80 italic bg-surface/80 border border-border/50 rounded-lg p-2 leading-relaxed">
                                                "{r.customMessage}"
                                            </p>
                                        )}
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
                                        {/* Passeur : Clôturer */}
                                        {(isProvider || isAdmin) && r.status !== "CLOSED" && (
                                            <Button
                                                size="sm"
                                                variant="default"
                                                disabled={isPending}
                                                onClick={() => handleCloseRequest(r.id, r.listing.title)}
                                                className="bg-success text-success-foreground hover:bg-success/90 h-8 text-xs font-bold"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                                Clôturer la prestation
                                            </Button>
                                        )}

                                        {/* Client : Laisser un avis */}
                                        {isClient && r.status === "CLOSED" && (
                                            r.hasFeedback ? (
                                                <Badge variant="outline" className="text-xs font-bold text-warning border-warning/30 bg-warning/10 py-1 px-2.5">
                                                    <Star className="w-3.5 h-3.5 mr-1 fill-warning" />
                                                    Avis envoyé
                                                </Badge>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    disabled={isPending}
                                                    onClick={() => onLeaveFeedback?.(r)}
                                                    className="bg-warning text-warning-foreground hover:bg-warning/90 h-8 text-xs font-bold shadow-sm"
                                                >
                                                    <Star className="w-3.5 h-3.5 mr-1.5 fill-warning-foreground" />
                                                    Laisser un avis
                                                </Button>
                                            )
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
