"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Ticket,
    CheckCircle2,
    Clock,
    User,
    Shield,
    MessageSquare,
    Search,
    Filter,
    Send,
    Lock,
    ExternalLink,
    AlertCircle,
    Eye,
    X,
    FileText,
} from "lucide-react";
import {
    claimTicketAction,
    unclaimTicketAction,
    addTicketNoteAction,
    closeTicketAction,
    renameTicketAction,
} from "@/server/actions/ticket-bot-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface TicketInboxTabProps {
    guildId: string;
    tickets: any[];
    categories: any[];
    onRefresh: () => void;
}

export function TicketInboxTab({ guildId, tickets, categories, onRefresh }: TicketInboxTabProps) {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [noteContent, setNoteContent] = useState("");
    const [closeModalOpen, setCloseModalOpen] = useState(false);
    const [closeReason, setCloseReason] = useState("");
    const [renameModalOpen, setRenameModalOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [isPending, startTransition] = useTransition();

    const filteredTickets = tickets.filter((t) => {
        if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
        if (categoryFilter !== "ALL" && t.categoryId !== categoryFilter) return false;
        if (search) {
            const s = search.toLowerCase();
            const matchName = t.creatorDiscordName.toLowerCase().includes(s);
            const matchNum = String(t.ticketNumber).includes(s);
            const matchCategory = t.category?.name?.toLowerCase().includes(s);
            if (!matchName && !matchNum && !matchCategory) return false;
        }
        return true;
    });

    const handleClaim = (ticketId: string) => {
        startTransition(async () => {
            const res = await claimTicketAction(guildId, ticketId);
            if (res.success) {
                toast.success("Ticket pris en charge !");
                onRefresh();
                if (selectedTicket?.id === ticketId) {
                    setSelectedTicket((prev: any) => ({ ...prev, status: "CLAIMED", claimedByName: "Moi" }));
                }
            } else {
                toast.error(res.error || "Erreur de prise en charge");
            }
        });
    };

    const handleUnclaim = (ticketId: string) => {
        startTransition(async () => {
            const res = await unclaimTicketAction(guildId, ticketId);
            if (res.success) {
                toast.success("Ticket libéré !");
                onRefresh();
                if (selectedTicket?.id === ticketId) {
                    setSelectedTicket((prev: any) => ({ ...prev, status: "OPEN", claimedByName: null }));
                }
            } else {
                toast.error(res.error || "Erreur unclaim");
            }
        });
    };

    const handleAddNote = (ticketId: string) => {
        if (!noteContent.trim()) return;
        startTransition(async () => {
            const res = await addTicketNoteAction(guildId, ticketId, noteContent);
            if (res.success) {
                toast.success("Note interne ajoutée !");
                setNoteContent("");
                onRefresh();
                if (selectedTicket?.id === ticketId) {
                    setSelectedTicket((prev: any) => ({
                        ...prev,
                        notes: [...(prev.notes || []), res.data],
                    }));
                }
            } else {
                toast.error(res.error || "Erreur ajout note");
            }
        });
    };

    const handleClose = () => {
        if (!selectedTicket) return;
        startTransition(async () => {
            const res = await closeTicketAction(guildId, selectedTicket.id, closeReason);
            if (res.success) {
                toast.success("Ticket clôturé !");
                setCloseModalOpen(false);
                setCloseReason("");
                setSelectedTicket(null);
                onRefresh();
            } else {
                toast.error(res.error || "Erreur fermeture ticket");
            }
        });
    };

    const handleRename = () => {
        if (!selectedTicket || !newName.trim()) return;
        startTransition(async () => {
            const res = await renameTicketAction(guildId, selectedTicket.id, newName.trim());
            if (res.success) {
                toast.success("Ticket renommé !");
                setRenameModalOpen(false);
                setNewName("");
                onRefresh();
            } else {
                toast.error(res.error || "Erreur renommage");
            }
        });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Tickets Inbox List */}
            <div className="lg:col-span-5 space-y-4">
                {/* Search & Filters */}
                <div className="p-4 rounded-xl bg-card border border-border space-y-3 shadow-sm">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher par membre, #ID ou sujet..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9 text-xs"
                        />
                    </div>

                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-1/2 h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
                        >
                            <option value="ALL">Tous les statuts</option>
                            <option value="OPEN">🟡 Non assignés</option>
                            <option value="CLAIMED">🟢 Pris en charge</option>
                            <option value="CLOSED">⚪ Clôturés</option>
                        </select>

                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-1/2 h-8 px-2 text-xs rounded-lg border border-border bg-background text-foreground"
                        >
                            <option value="ALL">Toutes les catégories</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.emoji} {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Ticket Cards */}
                <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
                    {filteredTickets.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-border rounded-xl bg-surface/30">
                            <Ticket className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm font-medium text-foreground">Aucun ticket trouvé</p>
                            <p className="text-xs text-muted-foreground">Modifiez vos filtres de recherche.</p>
                        </div>
                    ) : (
                        filteredTickets.map((ticket) => {
                            const isSelected = selectedTicket?.id === ticket.id;
                            const isClaimed = ticket.status === "CLAIMED";
                            const isClosed = ticket.status === "CLOSED";

                            return (
                                <div
                                    key={ticket.id}
                                    onClick={() => setSelectedTicket(ticket)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                                        isSelected
                                            ? "border-amber-500 bg-amber-500/5 shadow-md shadow-amber-500/5"
                                            : "border-border/60 bg-card hover:border-border hover:bg-surface/50"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold text-xs text-amber-400">
                                                #{ticket.ticketNumber}
                                            </span>
                                            <span className="font-medium text-sm text-foreground truncate max-w-[160px]">
                                                {ticket.creatorDiscordName}
                                            </span>
                                        </div>

                                        <div>
                                            {isClosed ? (
                                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                                    Fermé
                                                </Badge>
                                            ) : isClaimed ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                                                    Pris en charge
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                                                    En attente
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                                        <span>{ticket.category?.emoji || "🎫"}</span>
                                        <span className="font-medium text-foreground">{ticket.category?.name}</span>
                                        <span>·</span>
                                        <span>{new Date(ticket.createdAt).toLocaleDateString("fr-FR")}</span>
                                    </div>

                                    {ticket.claimedByName && (
                                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                                            <Shield className="h-3 w-3" /> Staff: {ticket.claimedByName}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Right: Detailed Ticket View */}
            <div className="lg:col-span-7">
                {selectedTicket ? (
                    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h2 className="text-xl font-bold text-foreground">
                                        Ticket #{selectedTicket.ticketNumber}
                                    </h2>
                                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
                                        {selectedTicket.category?.name}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Créé par <strong className="text-foreground">{selectedTicket.creatorDiscordName}</strong> (
                                    <code className="text-[10px]">{selectedTicket.creatorDiscordId}</code>) le{" "}
                                    {new Date(selectedTicket.createdAt).toLocaleString("fr-FR")}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                {selectedTicket.status !== "CLOSED" && (
                                    <>
                                        {selectedTicket.status === "CLAIMED" ? (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleUnclaim(selectedTicket.id)}
                                                disabled={isPending}
                                                className="text-xs h-8"
                                            >
                                                Libérer
                                            </Button>
                                        ) : (
                                            <Button
                                                size="sm"
                                                onClick={() => handleClaim(selectedTicket.id)}
                                                disabled={isPending}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                                            >
                                                <Shield className="h-3.5 w-3.5 mr-1" /> Prendre en charge
                                            </Button>
                                        )}

                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => {
                                                setCloseReason("");
                                                setCloseModalOpen(true);
                                            }}
                                            disabled={isPending}
                                            className="text-xs h-8"
                                        >
                                            Fermer
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Intake Answers Box */}
                        {selectedTicket.intakeAnswersJson &&
                            Object.keys(selectedTicket.intakeAnswersJson).length > 0 && (
                                <div className="p-4 rounded-xl bg-surface/50 border border-border/60 space-y-2">
                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5 text-amber-400" /> Réponses au formulaire d'ouverture
                                    </h3>
                                    <div className="grid grid-cols-1 gap-2 text-xs">
                                        {Object.entries(selectedTicket.intakeAnswersJson).map(([k, v]) => (
                                            <div key={k} className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                                                <span className="font-semibold text-muted-foreground sm:w-1/3">{k} :</span>
                                                <span className="font-medium text-foreground sm:w-2/3">{String(v)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        {/* Internal Notes Section */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Lock className="h-3.5 w-3.5 text-amber-400" /> Notes Internes Staff (Masquées au membre)
                            </h3>

                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {selectedTicket.notes && selectedTicket.notes.length > 0 ? (
                                    selectedTicket.notes.map((note: any) => (
                                        <div
                                            key={note.id}
                                            className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-1"
                                        >
                                            <div className="flex items-center justify-between text-muted-foreground font-medium">
                                                <span className="text-amber-400 font-semibold">{note.authorName}</span>
                                                <span>{new Date(note.createdAt).toLocaleString("fr-FR")}</span>
                                            </div>
                                            <p className="text-foreground whitespace-pre-wrap">{note.content}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">Aucune note interne pour l'instant.</p>
                                )}
                            </div>

                            {selectedTicket.status !== "CLOSED" && (
                                <div className="flex gap-2 pt-2">
                                    <Input
                                        placeholder="Écrire une note interne..."
                                        value={noteContent}
                                        onChange={(e) => setNoteContent(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                handleAddNote(selectedTicket.id);
                                            }
                                        }}
                                        className="text-xs h-9"
                                    />
                                    <Button
                                        size="sm"
                                        onClick={() => handleAddNote(selectedTicket.id)}
                                        disabled={isPending || !noteContent.trim()}
                                        className="h-9 px-3"
                                    >
                                        <Send className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Transcript link if closed */}
                        {selectedTicket.transcript && (
                            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                                    <CheckCircle2 className="h-4 w-4" /> Transcript HTML archivé avec succès
                                </div>
                                <a
                                    href={`/api/tickets/transcript/${selectedTicket.transcript.secretToken}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-emerald-400 font-semibold hover:underline flex items-center gap-1"
                                >
                                    Consulter <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-muted-foreground">
                        <Ticket className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
                        <h3 className="text-base font-semibold text-foreground mb-1">Sélectionnez un ticket</h3>
                        <p className="text-xs">Cliquez sur un ticket à gauche pour voir les détails, timeline et notes internes.</p>
                    </div>
                )}
            </div>

            {/* Close Modal */}
            <Dialog open={closeModalOpen} onOpenChange={setCloseModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Fermer le ticket #{selectedTicket?.ticketNumber}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-xs text-muted-foreground">
                            Cette action archivera le ticket, génèrera le transcript HTML et supprimera le salon Discord associé.
                        </p>
                        <Textarea
                            placeholder="Motif de fermeture (ex: Problème résolu, inactivité...)"
                            value={closeReason}
                            onChange={(e) => setCloseReason(e.target.value)}
                            className="text-xs"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setCloseModalOpen(false)}>
                            Annuler
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleClose} disabled={isPending}>
                            Confirmer la fermeture
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
