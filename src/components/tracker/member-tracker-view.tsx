"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Bug,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    ExternalLink,
    Inbox,
    Lightbulb,
    MessageSquare,
    Search,
    XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { getMemberTrackerTickets } from "@/server/actions/god-bugs-actions";
import { FEEDBACK_TYPES, FEEDBACK_LABELS } from "@/lib/feedback-types";
import {
    TRACKER_STATUSES,
    TRACKER_STATUS_LABELS,
    anonymousMemberLabel,
    type MemberTrackerTicket,
    type TrackerStatusValue,
} from "@/lib/feedback-ticket-mapping";
import { cn } from "@/lib/utils";

type TrackerStats = { total: number; open: number; resolved: number; ignored: number };

interface MemberTrackerViewProps {
    guildId: string;
    initialData: MemberTrackerTicket[];
    initialTotal: number;
    initialPage: number;
    initialTotalPages: number;
    initialStats: TrackerStats;
    initialRef?: string;
}

const STATUS_STYLES: Record<TrackerStatusValue, { className: string; icon: typeof Clock }> = {
    A_FAIRE: { className: "text-muted-foreground border-border bg-elevated", icon: Clock },
    A_INVESTIGUER: { className: "text-danger border-danger/30 bg-danger/10", icon: Bug },
    EN_COURS: { className: "text-warning border-warning/30 bg-warning/10", icon: Clock },
    TERMINE: { className: "text-success border-success/30 bg-success/10", icon: CheckCircle2 },
    IGNORE: { className: "text-muted-foreground border-border bg-transparent", icon: XCircle },
};

function StatusBadge({ status }: { status: TrackerStatusValue }) {
    const config = STATUS_STYLES[status];
    return (
        <Badge variant="outline" className={cn("gap-1 rounded-lg px-2 py-0.5 text-caption font-medium", config.className)}>
            <config.icon className="h-3 w-3" />
            {TRACKER_STATUS_LABELS[status]}
        </Badge>
    );
}

function feedbackLabel(feedbackType: string | null): string {
    if (!feedbackType) return "Signalement";
    return FEEDBACK_LABELS[feedbackType as keyof typeof FEEDBACK_LABELS]?.label ?? feedbackType;
}

export function MemberTrackerView({
    guildId,
    initialData,
    initialTotal,
    initialPage,
    initialTotalPages,
    initialStats,
    initialRef,
}: MemberTrackerViewProps) {
    const [data, setData] = useState(initialData);
    const [total, setTotal] = useState(initialTotal);
    const [page, setPage] = useState(initialPage);
    const [totalPages, setTotalPages] = useState(initialTotalPages);
    const [stats, setStats] = useState(initialStats);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [statusFilter, setStatusFilter] = useState<"ALL" | TrackerStatusValue>("ALL");
    const [typeFilter, setTypeFilter] = useState<"ALL" | string>("ALL");
    const [refFilter, setRefFilter] = useState(initialRef ?? "");
    const [selected, setSelected] = useState<MemberTrackerTicket | null>(null);
    const [isPending, startTransition] = useTransition();
    const firstRender = useRef(true);

    function load(nextPage: number) {
        startTransition(async () => {
            const response = await getMemberTrackerTickets(guildId, {
                page: nextPage,
                perPage: 20,
                search: debouncedSearch || undefined,
                status: statusFilter === "ALL" ? undefined : statusFilter,
                feedbackType: typeFilter === "ALL" ? undefined : typeFilter,
                ref: refFilter || undefined,
            });

            if (!response.success) {
                toast.error(response.error || "Impossible de charger le tracker.");
                return;
            }

            setData(response.data);
            setTotal(response.total);
            setPage(response.page);
            setTotalPages(response.totalPages);
            setStats(response.stats);
        });
    }

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        load(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, statusFilter, typeFilter, refFilter]);

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Card className="border-border bg-surface">
                    <CardContent className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Signalements</p>
                            <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
                        </div>
                        <Inbox className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                </Card>
                <Card className="border-border bg-surface">
                    <CardContent className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">En cours</p>
                            <p className="text-2xl font-semibold text-warning">{stats.open}</p>
                        </div>
                        <Clock className="h-5 w-5 text-warning" />
                    </CardContent>
                </Card>
                <Card className="border-border bg-surface">
                    <CardContent className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Résolus</p>
                            <p className="text-2xl font-semibold text-success">{stats.resolved}</p>
                        </div>
                        <CheckCircle2 className="h-5 w-5 text-success" />
                    </CardContent>
                </Card>
            </div>

            {refFilter && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-info/30 bg-info/5 px-4 py-3">
                    <p className="text-sm text-foreground">
                        Signalement ciblé : <span className="font-mono">{refFilter}</span>
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setRefFilter("")}>
                        Voir tout le tracker
                    </Button>
                </div>
            )}

            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 md:flex-row md:items-center">
                <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Rechercher une référence ou une description…"
                        className="pl-9"
                        aria-label="Rechercher dans le tracker"
                    />
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "ALL" | TrackerStatusValue)}>
                    <SelectTrigger className="w-full md:w-[190px]" aria-label="Filtrer par statut">
                        <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Tous les statuts</SelectItem>
                        {TRACKER_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>{TRACKER_STATUS_LABELS[status]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full md:w-[210px]" aria-label="Filtrer par type de retour">
                        <SelectValue placeholder="Tous les types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Tous les types</SelectItem>
                        {FEEDBACK_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{FEEDBACK_LABELS[type].label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-3">
                {data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface px-6 py-14 text-center">
                        <Inbox className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Aucun signalement ne correspond à ces filtres.</p>
                    </div>
                ) : (
                    data.map((ticket) => (
                        <article
                            key={ticket.ref}
                            className="min-w-0 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-elevated"
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs text-muted-foreground">{ticket.ref}</span>
                                    <StatusBadge status={ticket.trackerStatus} />
                                    <Badge variant="outline" className="gap-1 rounded-lg border-border px-2 py-0.5 text-caption font-medium text-muted-foreground">
                                        {ticket.category === "BUG_REPORT" ? <Bug className="h-3 w-3 text-danger" /> : <Lightbulb className="h-3 w-3 text-info" />}
                                        {feedbackLabel(ticket.feedbackType)}
                                    </Badge>
                                </div>
                                <span className="text-caption text-muted-foreground">
                                    {format(new Date(ticket.createdAt), "dd MMM yyyy", { locale: fr })}
                                </span>
                            </div>

                            <p className="mt-3 break-words text-sm text-foreground">{ticket.description}</p>

                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-muted-foreground">
                                <span className="break-words">
                                    {ticket.memberName ?? anonymousMemberLabel(ticket.memberGuildName)}
                                </span>
                                {ticket.sourcePage && <span>Page : {ticket.sourcePage}</span>}
                                {ticket.replies.length > 0 && (
                                    <span className="flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        {ticket.replies.length} réponse{ticket.replies.length > 1 ? "s" : ""}
                                    </span>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto h-7 px-2 text-caption"
                                    onClick={() => setSelected(ticket)}
                                >
                                    Détails
                                </Button>
                            </div>
                        </article>
                    ))
                )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-caption text-muted-foreground">
                    {total} signalement{total > 1 ? "s" : ""} · page {page} / {totalPages}
                </p>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending || page <= 1}
                        onClick={() => load(page - 1)}
                        aria-label="Page précédente"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending || page >= totalPages}
                        onClick={() => load(page + 1)}
                        aria-label="Page suivante"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
                <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
                    {selected && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
                                    <span className="font-mono text-sm text-muted-foreground">{selected.ref}</span>
                                    <StatusBadge status={selected.trackerStatus} />
                                </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                                <p className="whitespace-pre-wrap break-words text-sm text-foreground">{selected.description}</p>

                                <div className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface p-3 text-sm sm:grid-cols-2">
                                    <p><span className="text-muted-foreground">Type :</span> {feedbackLabel(selected.feedbackType)}</p>
                                    <p><span className="text-muted-foreground">Signalé le :</span> {format(new Date(selected.createdAt), "dd MMMM yyyy", { locale: fr })}</p>
                                    <p className="break-words"><span className="text-muted-foreground">Auteur :</span> {selected.memberName ?? anonymousMemberLabel(selected.memberGuildName)}</p>
                                    {selected.sourcePage && <p className="break-words"><span className="text-muted-foreground">Page :</span> {selected.sourcePage}</p>}
                                    {selected.targetSlug && <p className="break-words"><span className="text-muted-foreground">Cible :</span> {selected.targetSlug}</p>}
                                </div>

                                <div className="space-y-2">
                                    <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
                                        <MessageSquare className="h-4 w-4" />
                                        Réponses de l&apos;équipe
                                    </h4>
                                    {selected.replies.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">Aucune réponse pour le moment.</p>
                                    ) : (
                                        <ul className="space-y-2">
                                            {selected.replies.map((reply, index) => (
                                                <li key={`${reply.at}-${index}`} className="rounded-lg border border-border bg-surface p-3">
                                                    <p className="break-words text-sm text-foreground">
                                                        {reply.emoji ? `${reply.emoji} ` : ""}{reply.message}
                                                    </p>
                                                    {reply.at && (
                                                        <p className="mt-1 text-caption text-muted-foreground">
                                                            {format(new Date(reply.at), "dd MMM yyyy HH:mm", { locale: fr })}
                                                        </p>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {selected.forumLink && (
                                    <a
                                        href={selected.forumLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm text-info hover:underline"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Voir le suivi détaillé
                                    </a>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
