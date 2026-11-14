"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Bell,
    Bug,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    ExternalLink,
    Inbox,
    Lightbulb,
    MessageSquare,
    Pencil,
    Plus,
    Search,
    Trash2,
    XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from "@/hooks/use-debounce";
import {
    createTrackerNote,
    deleteTrackerTicket,
    getTrackerStats,
    getTrackerTickets,
    updateTrackerTicket,
    updateTrackerTicketStatus,
    type TrackerTicketRow,
} from "@/server/actions/god-bugs-actions";
import { notifyMemberFeedbackAction } from "@/server/actions/feedback-actions";
import { FEEDBACK_LABELS, FEEDBACK_TYPES } from "@/lib/feedback-types";
import {
    TRACKER_STATUSES,
    TRACKER_STATUS_LABELS,
    type TrackerStatusValue,
} from "@/lib/feedback-ticket-mapping";
import { cn } from "@/lib/utils";

export type TrackerStats = {
    total: number;
    open: number;
    resolved: number;
    ignored: number;
    internal: number;
    feedback: number;
};

interface FeedbackTrackerProps {
    initialData: TrackerTicketRow[];
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

export function StatusBadge({ status }: { status: TrackerStatusValue }) {
    const config = STATUS_STYLES[status];
    return (
        <Badge variant="outline" className={cn("gap-1 rounded-lg px-2 py-0.5 text-caption font-medium", config.className)}>
            <config.icon className="h-3 w-3" />
            {TRACKER_STATUS_LABELS[status]}
        </Badge>
    );
}

function feedbackLabel(feedbackType: string | null): string {
    if (!feedbackType) return "Note interne";
    return FEEDBACK_LABELS[feedbackType as keyof typeof FEEDBACK_LABELS]?.label ?? feedbackType;
}

export function FeedbackTracker({
    initialData,
    initialTotal,
    initialPage,
    initialTotalPages,
    initialStats,
    initialRef,
}: FeedbackTrackerProps) {
    const [data, setData] = useState(initialData);
    const [total, setTotal] = useState(initialTotal);
    const [page, setPage] = useState(initialPage);
    const [totalPages, setTotalPages] = useState(initialTotalPages);
    const [stats, setStats] = useState(initialStats);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const [statusFilter, setStatusFilter] = useState<"ALL" | TrackerStatusValue>("ALL");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [originFilter, setOriginFilter] = useState<"ALL" | "FEEDBACK" | "INTERNAL">("ALL");
    const [guildFilter, setGuildFilter] = useState("");
    const debouncedGuild = useDebounce(guildFilter, 300);
    const [refFilter, setRefFilter] = useState(initialRef ?? "");
    const [selected, setSelected] = useState<TrackerTicketRow | null>(null);
    const [notifyTarget, setNotifyTarget] = useState<TrackerTicketRow | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const firstRender = useRef(true);

    function load(nextPage: number) {
        startTransition(async () => {
            const [response, statsResponse] = await Promise.all([
                getTrackerTickets({
                    page: nextPage,
                    perPage: 20,
                    search: debouncedSearch || undefined,
                    status: statusFilter === "ALL" ? undefined : statusFilter,
                    origin: originFilter === "ALL" ? undefined : originFilter,
                    feedbackType: typeFilter === "ALL" ? undefined : typeFilter,
                    guild: debouncedGuild || undefined,
                    ref: refFilter || undefined,
                }),
                getTrackerStats(),
            ]);

            if (!response.success) {
                toast.error(response.error || "Impossible de charger les signalements.");
                return;
            }

            setData(response.data);
            setTotal(response.total);
            setPage(response.page);
            setTotalPages(response.totalPages);
            if (statsResponse.success) setStats(statsResponse.data);
        });
    }

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;
            return;
        }
        load(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, statusFilter, typeFilter, originFilter, debouncedGuild, refFilter]);

    function handleUpdate(ref: string, payload: NoteFormPayload) {
        startTransition(async () => {
            const response = await updateTrackerTicket(ref, payload);
            if (response.success) {
                toast.success("Signalement mis à jour.");
                setSelected(null);
                load(page);
            } else {
                toast.error(response.error || "Mise à jour impossible.");
            }
        });
    }

    function handleStatus(ref: string, status: TrackerStatusValue) {
        startTransition(async () => {
            const response = await updateTrackerTicketStatus(ref, status);
            if (response.success) {
                toast.success(`Statut : ${TRACKER_STATUS_LABELS[status]}`);
                setData((current) => current.map((ticket) => ticket.ref === ref ? { ...ticket, status } : ticket));
                load(page);
            } else {
                toast.error(response.error || "Changement de statut impossible.");
            }
        });
    }

    function handleDelete(ref: string) {
        if (!confirm("Supprimer définitivement ce signalement ?")) return;
        startTransition(async () => {
            const response = await deleteTrackerTicket(ref);
            if (response.success) {
                toast.success("Signalement supprimé.");
                setSelected(null);
                load(page);
            } else {
                toast.error(response.error || "Suppression impossible.");
            }
        });
    }

    function handleNotify(ticket: TrackerTicketRow, emoji: string, message: string) {
        startTransition(async () => {
            const response = await notifyMemberFeedbackAction({
                ticketRef: ticket.ref,
                memberName: ticket.memberName ?? "ce membre",
                emoji,
                message,
            });
            if (response.success) {
                toast.success("Réponse envoyée au membre.");
                setNotifyTarget(null);
                load(page);
            } else {
                toast.error(response.error || "Envoi impossible.");
            }
        });
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-foreground">Signalements</h2>
                    <p className="text-sm text-muted-foreground">
                        Bugs et améliorations des membres, notes internes et réponses.
                    </p>
                </div>
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nouvelle note
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card className="border-border bg-surface">
                    <CardContent className="p-4">
                        <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Total</p>
                        <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
                    </CardContent>
                </Card>
                <Card className="border-border bg-surface">
                    <CardContent className="p-4">
                        <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">À traiter</p>
                        <p className="text-2xl font-semibold text-warning">{stats.open}</p>
                    </CardContent>
                </Card>
                <Card className="border-border bg-surface">
                    <CardContent className="p-4">
                        <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Résolus</p>
                        <p className="text-2xl font-semibold text-success">{stats.resolved}</p>
                    </CardContent>
                </Card>
                <Card className="border-border bg-surface">
                    <CardContent className="p-4">
                        <p className="text-caption font-medium uppercase tracking-wide text-muted-foreground">Notes internes</p>
                        <p className="text-2xl font-semibold text-info">{stats.internal}</p>
                    </CardContent>
                </Card>
            </div>

            {refFilter && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-info/30 bg-info/5 px-4 py-3">
                    <p className="text-sm text-foreground">
                        Signalement ciblé : <span className="font-mono">{refFilter}</span>
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setRefFilter("")}>Voir tout</Button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-2 xl:grid-cols-5">
                <div className="relative min-w-0 md:col-span-2 xl:col-span-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Référence, description, pseudo…"
                        className="pl-9"
                        aria-label="Rechercher un signalement"
                    />
                </div>
                <Select value={originFilter} onValueChange={(value) => setOriginFilter(value as typeof originFilter)}>
                    <SelectTrigger aria-label="Filtrer par origine"><SelectValue placeholder="Origine" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Toutes origines</SelectItem>
                        <SelectItem value="FEEDBACK">Signalements membres</SelectItem>
                        <SelectItem value="INTERNAL">Notes internes</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "ALL" | TrackerStatusValue)}>
                    <SelectTrigger aria-label="Filtrer par statut"><SelectValue placeholder="Statut" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Tous les statuts</SelectItem>
                        {TRACKER_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>{TRACKER_STATUS_LABELS[status]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger aria-label="Filtrer par type de retour"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Tous les types</SelectItem>
                        {FEEDBACK_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>{FEEDBACK_LABELS[type].label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Input
                    value={guildFilter}
                    onChange={(event) => setGuildFilter(event.target.value)}
                    placeholder="Guilde…"
                    aria-label="Filtrer par guilde"
                />
            </div>
            <div className="space-y-3">
                {data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface px-6 py-14 text-center">
                        <Inbox className="h-8 w-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Aucun signalement ne correspond à ces filtres.</p>
                    </div>
                ) : (
                    data.map((ticket) => (
                        <article key={ticket.ref} className="min-w-0 rounded-xl border border-border bg-surface p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs text-muted-foreground">{ticket.ref}</span>
                                    <Badge variant="outline" className="rounded-lg border-border px-2 py-0.5 text-caption font-medium text-muted-foreground">
                                        {ticket.origin === "INTERNAL" ? "Note interne" : "Membre"}
                                    </Badge>
                                    <StatusBadge status={ticket.status} />
                                    <Badge variant="outline" className="gap-1 rounded-lg border-border px-2 py-0.5 text-caption font-medium text-muted-foreground">
                                        {ticket.type === "BUG" ? <Bug className="h-3 w-3 text-danger" /> : <Lightbulb className="h-3 w-3 text-info" />}
                                        {feedbackLabel(ticket.feedbackType)}
                                    </Badge>
                                </div>
                                <span className="text-caption text-muted-foreground">
                                    {format(new Date(ticket.createdAt), "dd MMM yyyy", { locale: fr })}
                                </span>
                            </div>

                            <p className="mt-3 whitespace-pre-wrap break-words text-sm text-foreground">{ticket.description}</p>

                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-muted-foreground">
                                {ticket.memberName && <span className="break-words">{ticket.memberName}</span>}
                                {ticket.memberGuildName && <span className="break-words">{ticket.memberGuildName}</span>}
                                {ticket.sourcePage && <span>Page : {ticket.sourcePage}</span>}
                                {ticket.replies.length > 0 && (
                                    <span className="flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        {ticket.replies.length} réponse{ticket.replies.length > 1 ? "s" : ""}
                                    </span>
                                )}
                                <div className="ml-auto flex flex-wrap items-center gap-2">
                                    <Select value={ticket.status} onValueChange={(value) => handleStatus(ticket.ref, value as TrackerStatusValue)}>
                                        <SelectTrigger className="h-8 w-[160px] text-caption" aria-label={`Statut de ${ticket.ref}`}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TRACKER_STATUSES.map((status) => (
                                                <SelectItem key={status} value={status}>{TRACKER_STATUS_LABELS[status]}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {ticket.origin === "FEEDBACK" && ticket.memberName && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-1 px-2 text-caption"
                                            onClick={() => setNotifyTarget(ticket)}
                                        >
                                            <Bell className="h-3.5 w-3.5" />
                                            Répondre
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 gap-1 px-2 text-caption"
                                        onClick={() => setSelected(ticket)}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Détails
                                    </Button>
                                </div>
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
            <CreateNoteDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                isPending={isPending}
                onCreate={(payload) => {
                    startTransition(async () => {
                        const response = await createTrackerNote(payload);
                        if (response.success) {
                            toast.success("Note interne créée.");
                            setCreateOpen(false);
                            load(page);
                        } else {
                            toast.error(response.error || "Création impossible.");
                        }
                    });
                }}
            />

            <TicketDetailDialog
                ticket={selected}
                onClose={() => setSelected(null)}
                isPending={isPending}
                onUpdate={handleUpdate}
                onStatus={handleStatus}
                onDelete={handleDelete}
                onNotify={(ticket) => setNotifyTarget(ticket)}
            />

            <NotifyDialog
                ticket={notifyTarget}
                onClose={() => setNotifyTarget(null)}
                isPending={isPending}
                onSend={handleNotify}
            />
        </div>
    );
}

export type NoteFormPayload = {
    type: "BUG" | "AMELIORATION";
    category: string;
    priority: string;
    description: string;
    forumLink?: string;
};

const PRIORITIES = ["Très important", "Important", "Normal", "Faible"];

function CreateNoteDialog({
    open,
    onOpenChange,
    isPending,
    onCreate,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isPending: boolean;
    onCreate: (payload: NoteFormPayload) => void;
}) {
    const [form, setForm] = useState<NoteFormPayload>({
        type: "BUG",
        category: "Divers",
        priority: "Normal",
        description: "",
        forumLink: "",
    });

    useEffect(() => {
        if (open) {
            setForm({ type: "BUG", category: "Divers", priority: "Normal", description: "", forumLink: "" });
        }
    }, [open]);

    const canSubmit = form.description.trim().length >= 10;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Nouvelle note interne</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="note-type">Type</Label>
                            <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value as NoteFormPayload["type"] })}>
                                <SelectTrigger id="note-type"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="BUG">Bug</SelectItem>
                                    <SelectItem value="AMELIORATION">Amélioration</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="note-category">Catégorie</Label>
                            <Input
                                id="note-category"
                                value={form.category}
                                maxLength={50}
                                onChange={(event) => setForm({ ...form, category: event.target.value })}
                                placeholder="Divers"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="note-priority">Priorité</Label>
                            <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
                                <SelectTrigger id="note-priority"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {PRIORITIES.map((priority) => (
                                        <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="note-forum">Lien forum (optionnel)</Label>
                            <Input
                                id="note-forum"
                                value={form.forumLink ?? ""}
                                maxLength={500}
                                onChange={(event) => setForm({ ...form, forumLink: event.target.value })}
                                placeholder="https://…"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="note-description">Description</Label>
                        <Textarea
                            id="note-description"
                            value={form.description}
                            maxLength={4000}
                            onChange={(event) => setForm({ ...form, description: event.target.value })}
                            placeholder="Décris le bug ou l'amélioration à suivre…"
                            className="min-h-[140px]"
                        />
                        <p className="text-right text-caption text-muted-foreground">{form.description.length}/4000</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>Annuler</Button>
                    <Button
                        onClick={() => onCreate({
                            ...form,
                            category: form.category.trim() || "Divers",
                            description: form.description.trim(),
                            forumLink: form.forumLink?.trim() || undefined,
                        })}
                        disabled={isPending || !canSubmit}
                    >
                        Créer la note
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TicketDetailDialog({
    ticket,
    onClose,
    isPending,
    onUpdate,
    onStatus,
    onDelete,
    onNotify,
}: {
    ticket: TrackerTicketRow | null;
    onClose: () => void;
    isPending: boolean;
    onUpdate: (ref: string, payload: NoteFormPayload) => void;
    onStatus: (ref: string, status: TrackerStatusValue) => void;
    onDelete: (ref: string) => void;
    onNotify: (ticket: TrackerTicketRow) => void;
}) {
    const [form, setForm] = useState<NoteFormPayload>({
        type: "BUG",
        category: "Divers",
        priority: "Normal",
        description: "",
        forumLink: "",
    });

    useEffect(() => {
        if (ticket) {
            setForm({
                type: ticket.type,
                category: ticket.category,
                priority: ticket.priority,
                description: ticket.description,
                forumLink: ticket.forumLink ?? "",
            });
        }
    }, [ticket]);

    return (
        <Dialog open={Boolean(ticket)} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
                {ticket && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex flex-wrap items-center gap-2 text-left">
                                <span className="font-mono text-sm text-muted-foreground">{ticket.ref}</span>
                                <StatusBadge status={ticket.status} />
                                <Badge variant="outline" className="rounded-lg border-border px-2 py-0.5 text-caption font-medium text-muted-foreground">
                                    {ticket.origin === "INTERNAL" ? "Note interne" : "Signalement membre"}
                                </Badge>
                            </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface p-3 text-sm sm:grid-cols-2">
                                <p><span className="text-muted-foreground">Type :</span> {feedbackLabel(ticket.feedbackType)}</p>
                                <p><span className="text-muted-foreground">Signalé le :</span> {format(new Date(ticket.createdAt), "dd MMMM yyyy", { locale: fr })}</p>
                                {ticket.memberName && <p className="break-words"><span className="text-muted-foreground">Auteur :</span> {ticket.memberName}</p>}
                                {ticket.memberGuildName && <p className="break-words"><span className="text-muted-foreground">Guilde :</span> {ticket.memberGuildName}</p>}
                                {ticket.sourcePage && <p className="break-words"><span className="text-muted-foreground">Page :</span> {ticket.sourcePage}</p>}
                                {ticket.targetSlug && <p className="break-words"><span className="text-muted-foreground">Cible :</span> {ticket.targetSlug}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="detail-status">Statut de suivi</Label>
                                <Select value={ticket.status} onValueChange={(value) => onStatus(ticket.ref, value as TrackerStatusValue)}>
                                    <SelectTrigger id="detail-status"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {TRACKER_STATUSES.map((status) => (
                                            <SelectItem key={status} value={status}>{TRACKER_STATUS_LABELS[status]}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="detail-type">Type</Label>
                                    <Select value={form.type} onValueChange={(value) => setForm({ ...form, type: value as NoteFormPayload["type"] })}>
                                        <SelectTrigger id="detail-type"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="BUG">Bug</SelectItem>
                                            <SelectItem value="AMELIORATION">Amélioration</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="detail-category">Catégorie</Label>
                                    <Input
                                        id="detail-category"
                                        value={form.category}
                                        maxLength={50}
                                        onChange={(event) => setForm({ ...form, category: event.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="detail-priority">Priorité</Label>
                                    <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value })}>
                                        <SelectTrigger id="detail-priority"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {PRIORITIES.map((priority) => (
                                                <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="detail-forum">Lien forum</Label>
                                    <Input
                                        id="detail-forum"
                                        value={form.forumLink ?? ""}
                                        maxLength={500}
                                        onChange={(event) => setForm({ ...form, forumLink: event.target.value })}
                                        placeholder="https://…"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="detail-description">Description</Label>
                                <Textarea
                                    id="detail-description"
                                    value={form.description}
                                    maxLength={4000}
                                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                                    className="min-h-[140px]"
                                />
                            </div>

                            <div className="space-y-2">
                                <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <MessageSquare className="h-4 w-4" />
                                    Réponses visibles par le membre
                                </h4>
                                {ticket.replies.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Aucune réponse pour le moment.</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {ticket.replies.map((reply, index) => (
                                            <li key={`${reply.at}-${index}`} className="rounded-lg border border-border bg-surface p-3">
                                                <p className="break-words text-sm text-foreground">{reply.emoji ? `${reply.emoji} ` : ""}{reply.message}</p>
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

                            {ticket.forumLink && (
                                <a
                                    href={ticket.forumLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-sm text-info hover:underline"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                    Ouvrir le lien de suivi
                                </a>
                            )}
                        </div>

                        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                            <Button
                                variant="ghost"
                                className="gap-2 text-danger hover:text-danger"
                                onClick={() => onDelete(ticket.ref)}
                                disabled={isPending}
                            >
                                <Trash2 className="h-4 w-4" />
                                Supprimer
                            </Button>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                {ticket.origin === "FEEDBACK" && ticket.memberName && (
                                    <Button variant="outline" className="gap-2" onClick={() => onNotify(ticket)} disabled={isPending}>
                                        <Bell className="h-4 w-4" />
                                        Répondre au membre
                                    </Button>
                                )}
                                <Button
                                    className="gap-2"
                                    onClick={() => onUpdate(ticket.ref, {
                                        ...form,
                                        category: form.category.trim() || "Divers",
                                        description: form.description.trim(),
                                        forumLink: form.forumLink?.trim() || undefined,
                                    })}
                                    disabled={isPending || form.description.trim().length < 10}
                                >
                                    Enregistrer
                                </Button>
                            </div>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

const REPLY_EMOJIS = ["🎉", "🏆", "💖", "👏", "👍", "⭐", "🔥", "🎁"];

function NotifyDialog({
    ticket,
    onClose,
    isPending,
    onSend,
}: {
    ticket: TrackerTicketRow | null;
    onClose: () => void;
    isPending: boolean;
    onSend: (ticket: TrackerTicketRow, emoji: string, message: string) => void;
}) {
    const [emoji, setEmoji] = useState("🎉");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (ticket) {
            setEmoji("🎉");
            setMessage("");
        }
    }, [ticket]);

    return (
        <Dialog open={Boolean(ticket)} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-lg">
                {ticket && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Répondre à {ticket.memberName ?? "ce membre"}</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4">
                            <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
                                Référence <span className="font-mono text-foreground">{ticket.ref}</span>. La réponse apparaîtra
                                dans le tracker du membre et déclenchera une notification.
                            </p>

                            <div className="space-y-2">
                                <Label>Émoji</Label>
                                <div className="flex flex-wrap gap-2">
                                    {REPLY_EMOJIS.map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setEmoji(value)}
                                            aria-label={`Choisir l'émoji ${value}`}
                                            aria-pressed={emoji === value}
                                            className={cn(
                                                "h-9 w-9 rounded-lg border text-lg transition-colors",
                                                emoji === value
                                                    ? "border-info bg-info/10"
                                                    : "border-border bg-surface hover:bg-elevated",
                                            )}
                                        >
                                            {value}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="reply-message">Message</Label>
                                <Textarea
                                    id="reply-message"
                                    value={message}
                                    maxLength={1000}
                                    onChange={(event) => setMessage(event.target.value)}
                                    placeholder="Merci pour ton retour, c'est corrigé…"
                                    className="min-h-[110px]"
                                />
                                <p className="text-right text-caption text-muted-foreground">{message.length}/1000</p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="ghost" onClick={onClose} disabled={isPending}>Annuler</Button>
                            <Button
                                onClick={() => onSend(ticket, emoji, message.trim())}
                                disabled={isPending || message.trim().length === 0}
                            >
                                Envoyer la réponse
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
