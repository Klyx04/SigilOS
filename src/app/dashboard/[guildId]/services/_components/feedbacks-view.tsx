"use client";

import { useState, useTransition } from "react";
import { type ServiceFeedbackWithProvider, type ProviderRanking } from "@/server/actions/service-feedback-actions";
import { moderateServiceFeedback } from "@/server/actions/service-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Star, MessageSquareHeart, Trophy, Award, ThumbsUp, Calendar, Search, ShieldAlert, EyeOff, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS } from "@/server/actions/services-constants";
import { ClassIcon } from "@/components/shared/class-icon";
import { type DofusClass } from "@/lib/dofus-assets";
import { toast } from "sonner";

interface FeedbacksViewProps {
    guildId: string;
    feedbacks: ServiceFeedbackWithProvider[];
    rankings: ProviderRanking[];
    isAdmin?: boolean;
    searchQuery?: string;
    onSearchQueryChange?: (q: string) => void;
}

export function FeedbacksView({
    guildId,
    feedbacks,
    rankings,
    isAdmin = false,
    searchQuery,
    onSearchQueryChange,
}: FeedbacksViewProps) {
    const [localSearch, setLocalSearch] = useState("");
    const search = searchQuery !== undefined ? searchQuery : localSearch;
    const setSearch = onSearchQueryChange || setLocalSearch;
    const [isPending, startTransition] = useTransition();

    const handleModerate = (feedbackId: string, action: "hide" | "delete") => {
        if (action === "delete" && !window.confirm("Êtes-vous sûr de vouloir supprimer définitivement cet avis ?")) {
            return;
        }

        startTransition(async () => {
            const res = await moderateServiceFeedback(guildId, feedbackId, action);
            if (res.success) {
                toast.success(action === "delete" ? "Avis supprimé avec succès." : "Avis masqué avec succès.");
            } else {
                toast.error(res.error || "Erreur lors de la modération.");
            }
        });
    };

    const totalFeedbacks = feedbacks.length;
    const globalAvg = totalFeedbacks > 0
        ? Math.round((feedbacks.reduce((acc, f) => acc + f.rating, 0) / totalFeedbacks) * 10) / 10
        : 5.0;

    const filteredRankings = rankings.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase())
    );

    const filteredFeedbacks = feedbacks.filter((f) =>
        f.serviceTitle.toLowerCase().includes(search.toLowerCase()) ||
        f.clientName.toLowerCase().includes(search.toLowerCase()) ||
        (f.providerProfile?.pseudoDofus || "").toLowerCase().includes(search.toLowerCase()) ||
        (f.providerProfile?.discordNickname || "").toLowerCase().includes(search.toLowerCase()) ||
        (f.comment || "").toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header & Stats Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-surface/60 border-border/80 relative overflow-hidden">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-warning/15 border border-warning/30 flex items-center justify-center text-warning shrink-0">
                            <Star className="w-6 h-6 fill-warning" />
                        </div>
                        <div>
                            <p className="text-caption font-bold text-muted-foreground uppercase tracking-widest">
                                Note moyenne
                            </p>
                            <div className="flex items-baseline gap-2 mt-0.5">
                                <span className="text-2xl font-black text-foreground">{globalAvg}</span>
                                <span className="text-sm font-bold text-muted-foreground">/ 5</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-surface/60 border-border/80 relative overflow-hidden">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-info/15 border border-info/30 flex items-center justify-center text-info shrink-0">
                            <MessageSquareHeart className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-caption font-bold text-muted-foreground uppercase tracking-widest">
                                Avis reçus
                            </p>
                            <div className="flex items-baseline gap-2 mt-0.5">
                                <span className="text-2xl font-black text-foreground">{totalFeedbacks}</span>
                                <span className="text-sm font-bold text-muted-foreground">retours</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-surface/60 border-border/80 relative overflow-hidden">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-success/15 border border-success/30 flex items-center justify-center text-success shrink-0">
                            <Trophy className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-caption font-bold text-muted-foreground uppercase tracking-widest">
                                Passeurs & Artisans
                            </p>
                            <div className="flex items-baseline gap-2 mt-0.5">
                                <span className="text-2xl font-black text-foreground">{rankings.length}</span>
                                <span className="text-sm font-bold text-muted-foreground">notés</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par passeur, client, service ou commentaire..."
                    className="pl-10 h-11 bg-surface/60 border-border"
                />
            </div>

            {/* Classement des Passeurs */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-warning" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                        Classement de satisfaction des prestataires
                    </h3>
                </div>

                {filteredRankings.length === 0 ? (
                    <Card className="bg-surface/40 border-border/60 p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            Aucun prestataire noté pour le moment. Les avis apparaîtront dès la clôture des premiers services !
                        </p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredRankings.map((p, idx) => (
                            <Card key={p.profileId} className="bg-surface/60 border-border/80 hover:border-warning/40 transition-colors">
                                <CardContent className="p-4 flex items-center gap-3.5">
                                    <div className="relative">
                                        <Avatar className="w-12 h-12 border-2 border-border rounded-xl">
                                            <AvatarImage src={p.avatar || undefined} />
                                            <AvatarFallback className="bg-elevated text-sm font-black">
                                                {p.name.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        {idx === 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-warning text-warning-foreground text-[10px] font-black flex items-center justify-center shadow-md">
                                                🥇
                                            </span>
                                        )}
                                        {idx === 1 && (
                                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-400 text-slate-950 text-[10px] font-black flex items-center justify-center shadow-md">
                                                🥈
                                            </span>
                                        )}
                                        {idx === 2 && (
                                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-700 text-white text-[10px] font-black flex items-center justify-center shadow-md">
                                                🥉
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-sm font-black text-foreground truncate">{p.name}</p>
                                            {p.classe && (
                                                <ClassIcon classId={p.classe} size={14} />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="flex items-center text-warning font-black text-xs">
                                                <Star className="w-3.5 h-3.5 fill-warning mr-1" />
                                                {p.averageRating}
                                            </div>
                                            <span className="text-caption text-muted-foreground font-medium">
                                                • {p.feedbackCount} avis
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Mur des derniers avis */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-info" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-foreground">
                        Derniers avis et retours d'expérience
                    </h3>
                </div>

                {filteredFeedbacks.length === 0 ? (
                    <Card className="bg-surface/40 border-border/60 p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            Aucun commentaire correspondant.
                        </p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {filteredFeedbacks.map((f) => {
                            const providerName = f.providerProfile?.pseudoDofus || f.providerProfile?.discordNickname || f.providerProfile?.user?.name || "Prestataire";
                            return (
                                <Card key={f.id} className={`bg-surface/60 border-border/80 hover:bg-surface/80 transition-colors ${f.isModerated ? "opacity-60 border-destructive/40 bg-destructive/5" : ""}`}>
                                    <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar className="w-9 h-9 border border-border rounded-xl shrink-0">
                                                <AvatarImage src={f.clientAvatar || undefined} />
                                                <AvatarFallback className="text-caption font-bold bg-elevated">
                                                    {f.clientName.charAt(0)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="text-xs font-bold text-foreground truncate">
                                                        {f.clientName}
                                                    </p>
                                                    {f.isModerated && (
                                                        <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                                                            Masqué
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-muted-foreground truncate">
                                                    pour <strong className="text-foreground/80">{providerName}</strong>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Stars */}
                                        <div className="flex items-center gap-0.5 shrink-0 bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star
                                                    key={star}
                                                    className={`w-3 h-3 ${star <= f.rating ? "text-warning fill-warning" : "text-muted-foreground/30"}`}
                                                />
                                            ))}
                                        </div>
                                    </CardHeader>

                                    <CardContent className="p-4 pt-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-caption font-bold border-border text-muted-foreground">
                                                {CATEGORY_LABELS[f.category] || f.category}
                                            </Badge>
                                            <span className="text-xs font-bold text-foreground/90 truncate">
                                                {f.serviceTitle}
                                            </span>
                                        </div>

                                        {f.comment && (
                                            <p className="text-xs text-foreground/80 bg-surface/80 border border-border/50 rounded-lg p-2.5 italic leading-relaxed">
                                                "{f.comment}"
                                            </p>
                                        )}

                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {format(new Date(f.createdAt), "d MMMM yyyy à HH:mm", { locale: fr })}
                                            </span>

                                            {/* Modération Admin */}
                                            {isAdmin && (
                                                <div className="flex items-center gap-1.5">
                                                    {!f.isModerated && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={isPending}
                                                            onClick={() => handleModerate(f.id, "hide")}
                                                            className="h-6 px-2 text-[10px] text-warning hover:bg-warning/10"
                                                            title="Masquer cet avis"
                                                        >
                                                            <EyeOff className="w-3 h-3 mr-1" />
                                                            Masquer
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        disabled={isPending}
                                                        onClick={() => handleModerate(f.id, "delete")}
                                                        className="h-6 px-2 text-[10px] text-destructive hover:bg-destructive/10"
                                                        title="Supprimer définitivement"
                                                    >
                                                        <Trash2 className="w-3 h-3 mr-1" />
                                                        Supprimer
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
