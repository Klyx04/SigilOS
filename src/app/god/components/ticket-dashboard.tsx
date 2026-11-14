"use client";

import { useState, useTransition, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { FeedbackTracker, type TrackerStats as FeedbackTrackerStats } from "@/components/feedback/feedback-tracker";
import type { TrackerTicketRow } from "@/server/actions/god-bugs-actions";
import {
    Bug,
    Ticket,
    Search,
    Send,
    X,
    Clock,
    CheckCircle2,
    AlertCircle,
    MessageSquare,
    Hash,
    ExternalLink,
    ShieldCheck,
    Loader2,
    Trash2,
    ArrowLeft,
    Inbox,
    Boxes,
    User,
    Tag,
    Calendar,
    ChevronRight,
    Lock,
    Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// =============================================================================
// TYPES
// =============================================================================

interface SupportTicket {
    id: string;
    ticketNumber: number;
    discordThreadId: string | null;
    discordGuildId: string;
    category: "ACCESS_REQUEST" | "BUG_REPORT" | "FEATURE_REQUEST" | "OTHER";
    status: "OPEN" | "IN_PROGRESS" | "WAITING_RESPONSE" | "CLOSED";
    subject: string;
    description: string;
    creatorDiscordId: string;
    creatorDiscordName: string;
    assignedToId: string | null;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
    closedBy: string | null;
    closedReason: string | null;
    targetGuildId: string | null;
    targetGuildName: string | null;
    targetGuildMemberCount: number | null;
}

interface TicketStats {
    open: number;
    inProgress: number;
    waitingResponse: number;
    closedRecent: number;
    total: number;
    feedbackOpen?: number;
    feedbackTotal?: number;
}

interface TicketDashboardProps {
    initialTickets: SupportTicket[];
    initialTotal: number;
    initialStats: TicketStats | null;
    initialFeedback: TrackerTicketRow[];
    initialFeedbackTotal: number;
    initialFeedbackPage: number;
    initialFeedbackTotalPages: number;
    initialFeedbackStats: FeedbackTrackerStats;
}

// =============================================================================
// CONSTANTS — design tokens cohérents avec le God Dashboard
// =============================================================================

const CATEGORY_CONFIG: Record<SupportTicket["category"], { label: string; color: string; chip: string; dot: string; emoji: string }> = {
    ACCESS_REQUEST: { label: "Accès", color: "text-success", chip: "bg-success/10 border-success/20", dot: "bg-success", emoji: "🔑" },
    BUG_REPORT: { label: "Bug", color: "text-danger", chip: "bg-danger/10 border-danger/20", dot: "bg-danger", emoji: "🐛" },
    FEATURE_REQUEST: { label: "Feature", color: "text-info", chip: "bg-info/10 border-info/20", dot: "bg-info", emoji: "💡" },
    OTHER: { label: "Autre", color: "text-muted-foreground", chip: "bg-muted/10 border-border", dot: "bg-muted-foreground", emoji: "📩" },
};

const STATUS_CONFIG: Record<SupportTicket["status"], { label: string; color: string; chip: string; icon: any }> = {
    OPEN: { label: "Nouveau", color: "text-warning", chip: "bg-warning/10 border-warning/20", icon: AlertCircle },
    IN_PROGRESS: { label: "En cours", color: "text-info", chip: "bg-info/10 border-info/20", icon: Clock },
    WAITING_RESPONSE: { label: "En attente", color: "text-primary", chip: "bg-primary/10 border-primary/20", icon: MessageSquare },
    CLOSED: { label: "Fermé", color: "text-muted-foreground", chip: "bg-muted/10 border-border", icon: CheckCircle2 },
};

const STATUS_ORDER: Record<SupportTicket["status"], number> = {
    OPEN: 0, IN_PROGRESS: 1, WAITING_RESPONSE: 2, CLOSED: 3,
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TicketDashboard({
    initialTickets,
    initialTotal,
    initialStats,
    initialFeedback,
    initialFeedbackTotal,
    initialFeedbackPage,
    initialFeedbackTotalPages,
    initialFeedbackStats,
}: TicketDashboardProps) {
    const [activeTab, setActiveTab] = useState<"support" | "feedback">("support");
    const [tickets, setTickets] = useState(initialTickets);
    const [total, setTotal] = useState(initialTotal);
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
    const [search, setSearch] = useState("");
    const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
    const [replyText, setReplyText] = useState("");
    const [isPending, startTransition] = useTransition();
    const [panelChannelId, setPanelChannelId] = useState("");
    const [panelGuildId, setPanelGuildId] = useState("");
    const [botGuilds, setBotGuilds] = useState<any[]>([]);
    const [availableChannels, setAvailableChannels] = useState<any[]>([]);
    const [supportGuildRoles, setSupportGuildRoles] = useState<any[]>([]);
    const [selectedRoleId, setSelectedRoleId] = useState<string>("");
    const searchParams = useSearchParams();
    const subTab = searchParams.get("sub");

    // Sync with sidebar sub-tabs
    useEffect(() => {
        if (subTab === "OPEN" || subTab === "NONE" || !subTab) {
            setStatusFilter("OPEN");
            refreshTickets({ status: "OPEN" });
        } else if (subTab === "CLOSED") {
            setStatusFilter("CLOSED");
            refreshTickets({ status: "CLOSED" });
        }
    }, [subTab]);

    // Fetch bot guilds on mount
    useEffect(() => {
        async function loadGuilds() {
            const { getBotGuilds } = await import("@/server/actions/ticket-actions");
            const res = await getBotGuilds();
            if (res.success && res.guilds) setBotGuilds(res.guilds);
        }
        loadGuilds();
    }, []);

    // Fetch channels when guild changes
    useEffect(() => {
        if (!panelGuildId) {
            setAvailableChannels([]);
            return;
        }
        async function loadChannels() {
            const { getChannelsForGuild } = await import("@/server/actions/ticket-actions");
            const res = await getChannelsForGuild(panelGuildId);
            if (res.success && res.channels) setAvailableChannels(res.channels);
        }
        loadChannels();
    }, [panelGuildId]);

    // Fetch roles when a ticket is selected (target guild roles)
    useEffect(() => {
        if (!selectedTicket) {
            setSupportGuildRoles([]);
            setSelectedRoleId("");
            return;
        }
        async function loadRoles() {
            const { getSupportGuildRoles } = await import("@/server/actions/ticket-actions");
            const roleGuildId = selectedTicket!.targetGuildId || selectedTicket!.discordGuildId;
            const res = await getSupportGuildRoles(roleGuildId);
            if (res.success && res.roles) {
                setSupportGuildRoles(res.roles);
                if (res.roles.length > 0 && !selectedRoleId) {
                    const sigilRole = res.roles.find((r: any) =>
                        r.name.toLowerCase().includes("sigil") || r.name.toLowerCase().includes("membre"));
                    if (sigilRole) setSelectedRoleId(sigilRole.id);
                }
            }
        }
        loadRoles();
    }, [selectedTicket]);

    const stats = initialStats;

    // Auto-refresh every 30s
    useEffect(() => {
        if (typeof window === "undefined") return;
        const interval = setInterval(() => refreshTickets(), 30000);
        return () => clearInterval(interval);
    }, []);

    // Refresh tickets with filters
    async function refreshTickets(customFilters?: { status?: string; category?: string }) {
        startTransition(async () => {
            const { getSupportTickets } = await import("@/server/actions/ticket-actions");
            const result = await getSupportTickets({
                status: (customFilters?.status || statusFilter) === "ALL" ? undefined : (customFilters?.status || statusFilter) as any,
                category: (customFilters?.category || categoryFilter) === "ALL" ? undefined : (customFilters?.category || categoryFilter) as any,
                search: search || undefined,
            });
            setTickets(result.tickets as unknown as SupportTicket[]);
            setTotal(result.total);
        });
    }

    const handleStatusFilterChange = (val: string) => { setStatusFilter(val); refreshTickets({ status: val }); };
    const handleCategoryFilterChange = (val: string) => { setCategoryFilter(val); refreshTickets({ category: val }); };

    // Close ticket
    async function handleClose(ticketId: string) {
        startTransition(async () => {
            const { closeSupportTicket } = await import("@/server/actions/ticket-actions");
            const res = await closeSupportTicket(ticketId, "DASHBOARD", "Admin SigilOS", "Fermé par l'équipe SigilOS");
            if (res.success) {
                toast.success("Ticket fermé et fil Discord archivé");
                await refreshTickets();
                setSelectedTicket(null);
            } else {
                toast.error(res.error || "Erreur de fermeture");
            }
        });
    }

    // Delete ticket
    async function handleDeleteTicket(ticketId: string) {
        if (!confirm("⚠️ Supprimer ce ticket définitivement ? (Action irréversible, le thread Discord sera supprimé)")) return;
        startTransition(async () => {
            const { deleteSupportTicket } = await import("@/server/actions/ticket-actions");
            const res = await deleteSupportTicket(ticketId);
            if (res.success) {
                toast.success("Ticket supprimé définitivement");
                await refreshTickets();
                setSelectedTicket(null);
            } else {
                toast.error(res.error || "Erreur de suppression");
            }
        });
    }

    // Update status (⚠️ CLOSED est exclu : la fermeture doit passer par le bouton "Fermer"
    // → closeSupportTicket, qui archive le fil Discord. updateTicketStatus("CLOSED")
    // fermerait la base sans archiver le fil, avec un closedBy "DASHBOARD" trompeur.)
    async function handleStatusChange(ticketId: string, status: string) {
        if (status === "CLOSED") {
            toast.error("Utilise le bouton « Fermer » pour clôturer un ticket (archive le fil Discord).");
            return;
        }
        startTransition(async () => {
            const { updateTicketStatus } = await import("@/server/actions/ticket-actions");
            const res = await updateTicketStatus(ticketId, status as any);
            if (res.success) {
                toast.success(`Statut : ${STATUS_CONFIG[status as SupportTicket["status"]]?.label || status}`);
                await refreshTickets();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    }

    // Validate Guild Access
    async function handleValidateGuild(ticketId: string, discordGuildId: string, notes?: string) {
        startTransition(async () => {
            const { validateGuildAccess } = await import("@/server/actions/ticket-actions");
            const res = await validateGuildAccess(ticketId, discordGuildId, notes, selectedRoleId || undefined);
            if (res.success) {
                toast.success("Guilde validée — whitelist active et client notifié");
                await refreshTickets();
                setSelectedTicket(null);
            } else {
                toast.error(res.error || "Échec de la validation");
            }
        });
    }

    // Reject Guild Access
    async function handleRejectGuild(ticketId: string, reason: string) {
        if (!reason.trim()) return;
        startTransition(async () => {
            const { rejectGuildAccess } = await import("@/server/actions/ticket-actions");
            const res = await rejectGuildAccess(ticketId, reason);
            if (res.success) {
                toast.success("Demande refusée et ticket fermé");
                await refreshTickets();
                setSelectedTicket(null);
            } else {
                toast.error(res.error || "Échec du rejet");
            }
        });
    }

    // Send reply
    async function handleReply(ticketId: string) {
        if (!replyText.trim()) return;
        startTransition(async () => {
            const { sendTicketReply } = await import("@/server/actions/ticket-actions");
            const res = await sendTicketReply(ticketId, replyText);
            if (res.success) {
                toast.success(res.statusChanged
                    ? "Réponse envoyée — ticket passé en attente de réponse"
                    : "Réponse envoyée dans le fil Discord");
                setReplyText("");
                await refreshTickets();
            } else {
                toast.error(res.error || "Erreur");
            }
        });
    }

    // Post panel
    async function handlePostPanel() {
        if (!panelChannelId.trim() || !panelGuildId.trim()) return;
        startTransition(async () => {
            const { postTicketPanel } = await import("@/server/actions/ticket-actions");
            const result = await postTicketPanel(panelChannelId, panelGuildId);
            if (result.success) {
                setPanelChannelId("");
                setPanelGuildId("");
                toast.success("Panel Discord posté");
            } else {
                toast.error(result.error);
            }
        });
    }

    // ---- Compteurs pour le résumé ----
    const openCount = tickets.filter(t => t.status === "OPEN").length;
    const inProgressCount = tickets.filter(t => t.status === "IN_PROGRESS").length;
    const waitingCount = tickets.filter(t => t.status === "WAITING_RESPONSE").length;

    return (
        <div className="space-y-8">
            <nav className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-1" aria-label="Sections support">
                <button
                    type="button"
                    onClick={() => setActiveTab("support")}
                    aria-pressed={activeTab === "support"}
                    className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        activeTab === "support" ? "bg-elevated text-foreground" : "text-muted-foreground hover:bg-elevated hover:text-foreground",
                    )}
                >
                    <Ticket className="h-4 w-4" />
                    Tickets Discord
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("feedback")}
                    aria-pressed={activeTab === "feedback"}
                    className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        activeTab === "feedback" ? "bg-elevated text-foreground" : "text-muted-foreground hover:bg-elevated hover:text-foreground",
                    )}
                >
                    <Bug className="h-4 w-4" />
                    Signalements
                    {(initialStats?.feedbackOpen ?? 0) > 0 && (
                        <span className="rounded-lg bg-warning/10 px-1.5 py-0.5 text-caption text-warning">
                            {initialStats?.feedbackOpen}
                        </span>
                    )}
                </button>
            </nav>

            {activeTab === "support" && (
            <>
            {/* ── En-tête du module (à l'intérieur du composant, cohérent) ── */}
            <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                            <Ticket className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Console Support</span>
                    </div>
                    <h2 className="text-xl font-semibold text-foreground tracking-tight">Tickets</h2>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    {total} ticket{total > 1 ? "s" : ""} au total
                </div>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard icon={AlertCircle} label="Nouveaux" value={stats?.open ?? openCount} tone="amber" />
                <StatCard icon={Clock} label="En cours" value={stats?.inProgress ?? inProgressCount} tone="blue" />
                <StatCard icon={MessageSquare} label="En attente" value={stats?.waitingResponse ?? waitingCount} tone="violet" />
                <StatCard icon={CheckCircle2} label="Fermés (7j)" value={stats?.closedRecent ?? 0} tone="emerald" />
                <StatCard icon={Boxes} label="Total" value={stats?.total ?? total} tone="zinc" />
            </div>

            {/* ── Toolbar unifiée ── */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && refreshTickets()}
                        placeholder="Rechercher par sujet, auteur ou #numéro..."
                        className="w-full pl-11 pr-14 py-3.5 bg-surface/50 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/40 transition-all shadow-sm"
                    />
                    <button
                        onClick={() => refreshTickets()}
                        disabled={isPending}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-xl text-xs font-semibold text-primary-foreground uppercase tracking-wide transition-all disabled:opacity-50"
                    >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Filtrer"}
                    </button>
                </div>

                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                    <SelectTrigger className="w-full md:w-[200px] h-[54px] bg-surface/50 border-border rounded-xl text-foreground data-[placeholder]:text-muted-foreground">
                        <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Tous les statuts</SelectItem>
                        <SelectItem value="OPEN">🆕 Nouveaux</SelectItem>
                        <SelectItem value="IN_PROGRESS">⏳ En cours</SelectItem>
                        <SelectItem value="WAITING_RESPONSE">📩 En attente</SelectItem>
                        <SelectItem value="CLOSED">🔒 Fermés</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
                    <SelectTrigger className="w-full md:w-[200px] h-[54px] bg-surface/50 border-border rounded-xl text-foreground data-[placeholder]:text-muted-foreground">
                        <SelectValue placeholder="Toutes catégories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Toutes catégories</SelectItem>
                        <SelectItem value="ACCESS_REQUEST">🔑 Accès</SelectItem>
                        <SelectItem value="BUG_REPORT">🐛 Bugs</SelectItem>
                        <SelectItem value="FEATURE_REQUEST">💡 Features</SelectItem>
                        <SelectItem value="OTHER">📩 Autres</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* ── Table ── */}
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-elevated/50">
                                <th className="text-left px-6 py-4 text-caption font-semibold text-muted-foreground uppercase tracking-wide w-24">Ticket</th>
                                <th className="text-left px-6 py-4 text-caption font-semibold text-muted-foreground uppercase tracking-wide">Auteur</th>
                                <th className="text-left px-6 py-4 text-caption font-semibold text-muted-foreground uppercase tracking-wide">Objet</th>
                                <th className="text-left px-6 py-4 text-caption font-semibold text-muted-foreground uppercase tracking-wide">Catégorie</th>
                                <th className="text-left px-6 py-4 text-caption font-semibold text-muted-foreground uppercase tracking-wide">Statut</th>
                                <th className="text-right px-6 py-4 text-caption font-semibold text-muted-foreground uppercase tracking-wide">Ouvert</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-4 opacity-40">
                                            <div className="w-14 h-14 rounded-xl bg-elevated border border-border flex items-center justify-center">
                                                <Inbox className="w-6 h-6 text-muted-foreground" />
                                            </div>
                                            <p className="text-sm font-semibold uppercase tracking-wide">Aucun ticket</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {tickets.map((ticket) => {
                                const cat = CATEGORY_CONFIG[ticket.category];
                                const status = STATUS_CONFIG[ticket.status];
                                const StatusIcon = status.icon;
                                return (
                                    <tr
                                        key={ticket.id}
                                        className="border-b border-border hover:bg-elevated transition-all cursor-pointer group"
                                        onClick={() => setSelectedTicket(ticket)}
                                    >
                                        <td className="px-6 py-4">
                                            <span className="text-warning font-mono font-semibold text-xs">#{ticket.ticketNumber}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-elevated border border-border flex items-center justify-center text-xs font-semibold text-foreground shrink-0">
                                                    {ticket.creatorDiscordName?.[0]?.toUpperCase() || "?"}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-foreground font-semibold text-xs leading-tight">{ticket.creatorDiscordName}</span>
                                                    <span className="text-caption text-muted-foreground font-mono">{ticket.creatorDiscordId}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-foreground font-medium truncate max-w-[260px] block group-hover:text-foreground transition-colors">
                                                {ticket.subject}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn("inline-flex items-center gap-1.5 text-caption font-semibold uppercase px-2.5 py-1 rounded-lg border", cat.chip, cat.color)}>
                                                <span className={cn("w-1.5 h-1.5 rounded-full", cat.dot)} />
                                                {cat.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn("inline-flex items-center gap-1.5 text-caption font-semibold px-2.5 py-1 rounded-lg border uppercase", status.chip, status.color)}>
                                                <StatusIcon className="w-3.5 h-3.5" />
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-muted-foreground text-caption font-medium">
                                                {new Date(ticket.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Tools : Panel Discord + Info ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Manual Post Panel */}
                <div className="lg:col-span-2 bg-surface border border-border rounded-xl p-6 space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-info/10 border border-info/20">
                            <Send className="w-4 h-4 text-info" />
                        </div>
                        <div>
                            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Panel de Tickets Discord</h3>
                            <p className="text-caption text-muted-foreground font-medium mt-0.5">Publie le bouton « Ouvrir un ticket » dans un salon support.</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Select value={panelGuildId} onValueChange={(val) => { setPanelGuildId(val); setPanelChannelId(""); }}>
                            <SelectTrigger className="h-[52px] bg-background border-border rounded-xl text-xs text-foreground">
                                <SelectValue placeholder="Sélectionner le serveur" />
                            </SelectTrigger>
                            <SelectContent>
                                {botGuilds.map((g) => (
                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={panelChannelId} onValueChange={setPanelChannelId} disabled={!panelGuildId}>
                            <SelectTrigger className="h-[52px] bg-background border-border rounded-xl text-xs text-foreground disabled:opacity-50">
                                <SelectValue placeholder="Sélectionner le salon" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableChannels.map((c) => (
                                    <SelectItem key={c.id} value={c.id}># {c.name ?? "Salon masqué"}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <button
                        onClick={handlePostPanel}
                        disabled={isPending || !panelChannelId || !panelGuildId}
                        className="w-full py-3.5 bg-elevated hover:bg-elevated/80 border border-border rounded-xl text-xs font-semibold text-foreground uppercase tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : "Poster le panel (Discord)"}
                    </button>
                </div>

                {/* Automation Info */}
                <div className="bg-surface border border-border rounded-xl p-6 flex flex-col justify-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 text-warning" />
                    </div>
                    <div>
                        <h4 className="text-foreground font-semibold uppercase text-xs tracking-wide mb-1">SigilOS Guard</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                            Les demandes d'accès (<span className="text-warning font-semibold">ACCESS_REQUEST</span>) peuvent être validées ici. Le client est notifié sur Discord et whitelisté automatiquement.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Détail Modale ── */}
            {selectedTicket && (
                <TicketDetailModal
                    ticket={selectedTicket}
                    onClose={() => setSelectedTicket(null)}
                    onReply={handleReply}
                    onCloseTicket={handleClose}
                    onDeleteTicket={handleDeleteTicket}
                    onValidateGuild={handleValidateGuild}
                    onRejectGuild={handleRejectGuild}
                    onStatusChange={handleStatusChange}
                    replyText={replyText}
                    setReplyText={setReplyText}
                    isPending={isPending}
                    guildRoles={supportGuildRoles}
                    selectedRoleId={selectedRoleId}
                    setSelectedRoleId={setSelectedRoleId}
                />
            )}
            </>
            )}

            {activeTab === "feedback" && (
                <FeedbackTracker
                    initialData={initialFeedback}
                    initialTotal={initialFeedbackTotal}
                    initialPage={initialFeedbackPage}
                    initialTotalPages={initialFeedbackTotalPages}
                    initialStats={initialFeedbackStats}
                />
            )}
        </div>
    );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatCard({ icon: Icon, label, value, tone }: {
    icon: any; label: string; value: number; tone: "amber" | "blue" | "violet" | "emerald" | "zinc";
}) {
    const toneMap: Record<string, { text: string; bg: string; border: string; icon: string }> = {
        amber: { text: "text-warning", bg: "bg-warning/10", border: "border-warning/20", icon: "text-warning" },
        blue: { text: "text-info", bg: "bg-info/10", border: "border-info/20", icon: "text-info" },
        violet: { text: "text-primary", bg: "bg-primary/10", border: "border-primary/20", icon: "text-primary" },
        emerald: { text: "text-success", bg: "bg-success/10", border: "border-success/20", icon: "text-success" },
        zinc: { text: "text-foreground", bg: "bg-muted/10", border: "border-border", icon: "text-muted-foreground" },
    };
    const t = toneMap[tone];
    return (
        <div className="rounded-xl border border-border bg-surface p-5 flex items-center gap-4 transition-colors hover:bg-elevated/50">
            <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border", t.bg, t.border)}>
                <Icon className={cn("w-5 h-5", t.icon)} />
            </div>
            <div className="min-w-0">
                <div className={cn("text-2xl font-semibold tracking-tight leading-none", t.text)}>{value}</div>
                <div className="text-caption font-semibold uppercase tracking-wide text-muted-foreground mt-1 truncate">{label}</div>
            </div>
        </div>
    );
}

// =============================================================================
// DETAIL MODAL — layout 2 panneaux : détails/actions à gauche, conversation à droite
// =============================================================================

function TicketDetailModal({
    ticket,
    onClose,
    onReply,
    onCloseTicket,
    onDeleteTicket,
    onValidateGuild,
    onRejectGuild,
    onStatusChange,
    replyText,
    setReplyText,
    isPending,
    guildRoles,
    selectedRoleId,
    setSelectedRoleId,
}: {
    ticket: SupportTicket;
    onClose: () => void;
    onReply: (id: string) => void;
    onCloseTicket: (id: string) => void;
    onDeleteTicket: (id: string) => void;
    onValidateGuild: (ticketId: string, discordGuildId: string, notes?: string) => void;
    onRejectGuild: (ticketId: string, reason: string) => void;
    onStatusChange: (id: string, status: string) => void;
    replyText: string;
    setReplyText: (v: string) => void;
    isPending: boolean;
    guildRoles: any[];
    selectedRoleId: string;
    setSelectedRoleId: (v: string) => void;
}) {
    const [rejectionMode, setRejectionMode] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [validationNotes, setValidationNotes] = useState("");

    const cat = CATEGORY_CONFIG[ticket.category];
    const status = STATUS_CONFIG[ticket.status];
    const StatusIcon = status.icon;
    const isAccessRequest = ticket.category === "ACCESS_REQUEST";
    const isClosed = ticket.status === "CLOSED";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-background/90 " onClick={onClose} />

            <div className="relative w-full max-w-5xl h-[92vh] bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
                {/* Header */}
                <div className="px-6 sm:px-8 py-5 border-b border-border bg-elevated/50 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <button
                            onClick={onClose}
                            className="p-2.5 rounded-xl bg-elevated hover:bg-elevated/80 border border-border text-muted-foreground hover:text-foreground transition-all"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-warning font-mono font-semibold text-sm">#{ticket.ticketNumber}</span>
                                <span className={cn("inline-flex items-center gap-1.5 text-caption font-semibold uppercase px-2.5 py-1 rounded-full border", cat.chip, cat.color)}>
                                    {cat.emoji} {cat.label}
                                </span>
                            </div>
                            <h3 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight truncate mt-1">{ticket.subject}</h3>
                        </div>
                    </div>

                    {/* Statut + fermeture */}
                    {!isClosed ? (
                        <div className="flex items-center gap-3 shrink-0">
                            {/* Statut : CLOSED exclu — la fermeture passe par le bouton "Fermer"
                                (→ closeSupportTicket qui archive le fil Discord). */}
                            <Select value={ticket.status} onValueChange={(val) => onStatusChange(ticket.id, val)}>
                                <SelectTrigger className={cn("h-9 text-caption font-semibold uppercase px-3 py-1 rounded-full border bg-background outline-none w-fit gap-2", status.color, status.chip)}>
                                    <StatusIcon className="w-3.5 h-3.5" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="OPEN">Nouveau</SelectItem>
                                    <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                                    <SelectItem value="WAITING_RESPONSE">En attente</SelectItem>
                                </SelectContent>
                            </Select>
                            <button
                                onClick={() => onCloseTicket(ticket.id)}
                                disabled={isPending}
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-danger/10 hover:bg-danger/20 border border-danger/20 rounded-xl text-caption font-semibold text-danger uppercase tracking-wide transition-all disabled:opacity-50"
                            >
                                <Lock className="w-3.5 h-3.5" />
                                Fermer
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 shrink-0">
                            <span className={cn("inline-flex items-center gap-1.5 text-caption font-semibold uppercase px-3 py-1.5 rounded-full border", status.chip, status.color)}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {status.label}
                            </span>
                        </div>
                    )}
                </div>

                {/* Body — 2 panneaux */}
                <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-5">
                    {/* ── Panneau gauche : détails & actions ── */}
                    <div className="lg:col-span-2 border-r border-border overflow-y-auto scrollbar-thin scrollbar-thumb-border p-6 sm:p-8 space-y-8">
                        {/* Auteur */}
                        <section>
                            <h4 className="flex items-center gap-2 text-caption font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                <User className="w-3.5 h-3.5" /> Auteur
                            </h4>
                            <div className="flex items-center gap-3 bg-surface border border-border rounded-xl p-4">
                                <div className="w-11 h-11 rounded-xl bg-elevated border border-border flex items-center justify-center text-base font-semibold text-foreground shrink-0">
                                    {ticket.creatorDiscordName?.[0]?.toUpperCase() || "?"}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-foreground font-semibold text-sm truncate">{ticket.creatorDiscordName}</div>
                                    <div className="text-caption text-muted-foreground font-mono truncate">{ticket.creatorDiscordId}</div>
                                </div>
                            </div>
                        </section>

                        {/* Métadonnées */}
                        <section>
                            <h4 className="flex items-center gap-2 text-caption font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                <Tag className="w-3.5 h-3.5" /> Détails
                            </h4>
                            <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
                                <MetaRow icon={Calendar} label="Créé le" value={new Date(ticket.createdAt).toLocaleString("fr-FR")} />
                                {ticket.targetGuildName && (
                                    <MetaRow icon={ShieldCheck} label="Guilde cible" value={ticket.targetGuildName} />
                                )}
                                {ticket.targetGuildId && (
                                    <MetaRow icon={Hash} label="Serveur cible" value={ticket.targetGuildId} mono />
                                )}
                                {ticket.discordThreadId && (
                                    <div className="pt-1">
                                        <a
                                            href={`https://discord.com/channels/${ticket.discordGuildId}/${ticket.discordThreadId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-3 py-2 bg-info/10 hover:bg-info/20 border border-info/20 rounded-xl text-caption font-semibold text-info uppercase tracking-wide transition-all"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            Ouvrir le fil
                                        </a>
                                    </div>
                                )}
                                {isClosed && (
                                    <div className="pt-2 border-t border-border space-y-1">
                                        <MetaRow icon={CheckCircle2} label="Fermé le" value={ticket.closedAt ? new Date(ticket.closedAt).toLocaleString("fr-FR") : "—"} />
                                        <MetaRow icon={Lock} label="Fermé par" value={ticket.closedBy || "Anonyme"} />
                                        {ticket.closedReason && (
                                            <div className="pt-1 text-caption text-muted-foreground ">{ticket.closedReason}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Description */}
                        <section>
                            <h4 className="text-caption font-semibold text-muted-foreground uppercase tracking-wide mb-3">Demande</h4>
                            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-surface p-5 rounded-xl border border-border font-medium">
                                {ticket.description}
                            </div>
                        </section>

                        {/* Zone d'action : Décision d'accès */}
                        {isAccessRequest && !isClosed && (
                            <section className="border-t border-border pt-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-xl bg-success/10 border border-success/20">
                                        <ShieldCheck className="w-4 h-4 text-success" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Décision d'accès</h4>
                                        <p className="text-caption text-muted-foreground font-medium mt-0.5">
                                            Whitelist la guilde <span className="text-success/80 font-semibold">{ticket.targetGuildName || ticket.targetGuildId || "cible"}</span> et notifie le client.
                                        </p>
                                    </div>
                                </div>

                                {!rejectionMode ? (
                                    <div className="space-y-4 bg-success/[0.03] border border-success/10 rounded-xl p-4">
                                        <div className="space-y-2">
                                            <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide ml-1">Rôle sur le serveur cible</label>
                                            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                                                <SelectTrigger className="w-full h-12 bg-background border-border rounded-xl text-caption font-semibold uppercase text-foreground focus:ring-1 focus:ring-success/30">
                                                    <SelectValue placeholder="Aucun rôle sélectionné" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-surface border-border text-foreground z-[200]">
                                                    <SelectItem value="SKIP">❌ Aucun rôle</SelectItem>
                                                    {guildRoles.map((role) => (
                                                        <SelectItem key={role.id} value={role.id} className="text-xs font-semibold font-mono">
                                                            {role.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-caption font-semibold text-muted-foreground uppercase tracking-wide ml-1">Message additionnel (optionnel)</label>
                                            <input
                                                type="text"
                                                value={validationNotes}
                                                onChange={(e) => setValidationNotes(e.target.value)}
                                                placeholder="Bienvenue, contraintes particulières..."
                                                className="w-full h-12 px-4 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-success/30 transition-all font-medium"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 pt-1">
                                            <button
                                                onClick={() => onValidateGuild(ticket.id, ticket.targetGuildId!, validationNotes)}
                                                disabled={isPending || !ticket.targetGuildId}
                                                className="w-full py-3.5 bg-success hover:bg-success/90 text-success-foreground rounded-xl text-xs font-semibold uppercase tracking-wide transition-all disabled:opacity-50 shadow-sm shadow-success/10 flex items-center justify-center gap-2"
                                            >
                                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                                Valider & Whitelister
                                            </button>
                                            <button
                                                onClick={() => setRejectionMode(true)}
                                                className="w-full py-3 bg-danger/5 hover:bg-danger/10 border border-danger/20 rounded-xl text-caption font-semibold text-danger uppercase tracking-wide transition-all"
                                            >
                                                Refuser la demande
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-danger/5 p-4 rounded-xl border border-danger/10 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                        <div className="space-y-2">
                                            <label className="text-caption font-semibold text-danger uppercase tracking-wide ml-1">Motif du refus (envoyé au client)</label>
                                            <textarea
                                                value={rejectionReason}
                                                onChange={(e) => setRejectionReason(e.target.value)}
                                                placeholder="Ex: Guilde trop petite, leader absent..."
                                                rows={3}
                                                className="w-full p-4 bg-background border border-danger/20 rounded-xl text-sm text-foreground focus:outline-none focus:border-danger/40 transition-all resize-none font-medium"
                                            />
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => onRejectGuild(ticket.id, rejectionReason)}
                                                disabled={isPending || !rejectionReason.trim()}
                                                className="flex-1 py-3.5 bg-danger hover:bg-danger/90 text-danger-foreground rounded-xl text-xs font-semibold uppercase tracking-wide transition-all disabled:opacity-50"
                                            >
                                                {isPending ? "Refus en cours..." : "Confirmer le refus"}
                                            </button>
                                            <button
                                                onClick={() => setRejectionMode(false)}
                                                className="px-6 py-3.5 bg-elevated hover:bg-elevated/80 rounded-xl text-xs font-semibold text-muted-foreground uppercase tracking-wide transition-all"
                                            >
                                                Annuler
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </section>
                        )}
                    </div>

                    {/* ── Panneau droit : conversation & réponse ── */}
                    <div className="lg:col-span-3 flex flex-col overflow-y-auto scrollbar-thin scrollbar-thumb-border">
                        <div className="flex-1 p-6 sm:p-8">
                            {/* Fil de discussion (placeholder structuré) */}
                            <div className="space-y-4">
                                <h4 className="flex items-center gap-2 text-caption font-semibold text-muted-foreground uppercase tracking-wide">
                                    <MessageSquare className="w-3.5 h-3.5" /> Fil de discussion
                                </h4>
                                <div className="bg-warning/5 border border-warning/10 rounded-xl p-4">
                                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                        La conversation se déroule dans le fil Discord privé associé. Saisis ta réponse ci-dessous pour l'y envoyer directement.
                                        {!isClosed && (
                                            <span className="text-primary/80 font-semibold"> Le ticket passera en « en attente de réponse ».</span>
                                        )}
                                    </p>
                                </div>

                                {/* Archive info si fermé */}
                                {isClosed && (
                                    <div className="bg-elevated border border-border rounded-xl p-4 space-y-3">
                                        <h4 className="text-caption font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                            <Hash className="w-3.5 h-3.5" /> Métadonnées de fermeture
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3 text-caption font-medium text-muted-foreground">
                                            <div>📅 Fermé le : <span className="text-foreground font-mono">{ticket.closedAt ? new Date(ticket.closedAt).toLocaleString() : "N/A"}</span></div>
                                            <div>👤 Par : <span className="text-foreground">{ticket.closedBy || "Anonyme"}</span></div>
                                            <div className="col-span-2 mt-1">💬 Raison : <span className="text-foreground ">"{ticket.closedReason || "Aucune"}"</span></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Réponse directe */}
                        {!isClosed && (
                            <div className="border-t border-border bg-surface p-4 sm:p-6">
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Pencil className="w-3.5 h-3.5 text-primary" />
                                            <h4 className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">Réponse directe</h4>
                                        </div>
                                        <span className="text-caption text-muted-foreground font-semibold uppercase">Le bot répondra en ton nom</span>
                                    </div>
                                    <textarea
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        placeholder="Tape ta réponse — elle sera envoyée dans le fil Discord..."
                                        rows={3}
                                        className="w-full px-5 py-4 bg-surface border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-info/40 transition-all resize-none font-medium"
                                    />
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => onReply(ticket.id)}
                                            disabled={isPending || !replyText.trim()}
                                            className="px-6 py-3 bg-primary hover:bg-primary/90 rounded-xl text-xs font-semibold text-primary-foreground uppercase tracking-wide transition-all disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                            Envoyer
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer d'action si non fermé */}
                        {!isClosed && (
                            <div className="border-t border-border bg-surface px-4 sm:px-6 py-3 flex items-center justify-between group/footer">
                                <span className="text-caption text-muted-foreground font-semibold uppercase tracking-wide">SigilOS Support Engine v2.7</span>
                                <button
                                    onClick={() => onDeleteTicket(ticket.id)}
                                    disabled={isPending}
                                    className="opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1.5 text-caption font-semibold text-danger/60 hover:text-danger uppercase tracking-wide"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Supprimer définitivement
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// =============================================================================
// HELPERS
// =============================================================================

function MetaRow({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-start gap-3">
            <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="min-w-0">
                <div className="text-caption font-semibold text-muted-foreground uppercase tracking-wide">{label}</div>
                <div className={cn("text-caption text-foreground font-medium mt-0.5 break-words", mono && "font-mono text-caption")}>{value}</div>
            </div>
        </div>
    );
}