"use client";

import { useState, useTransition, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
    Ticket,
    Search,
    Send,
    X,
    ChevronDown,
    Clock,
    CheckCircle2,
    AlertCircle,
    MessageSquare,
    Hash,
    ExternalLink,
    ShieldCheck,
    Loader2,
    Trash2,
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
}

interface TicketDashboardProps {
    initialTickets: SupportTicket[];
    initialTotal: number;
    initialStats: TicketStats | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_CONFIG = {
    ACCESS_REQUEST: { label: "Demande d'Accès", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", emoji: "🔑" },
    BUG_REPORT: { label: "Bug Report", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", emoji: "🐛" },
    FEATURE_REQUEST: { label: "Feature Request", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", emoji: "💡" },
    OTHER: { label: "Autre", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", emoji: "📩" },
};

const STATUS_CONFIG = {
    OPEN: { label: "Nouveau (Open)", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertCircle },
    IN_PROGRESS: { label: "En cours", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: Clock },
    WAITING_RESPONSE: { label: "En attente", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", icon: MessageSquare },
    CLOSED: { label: "Fermé", color: "text-zinc-500", bg: "bg-zinc-500/10", border: "border-zinc-500/20", icon: CheckCircle2 },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function TicketDashboard({ initialTickets, initialTotal, initialStats }: TicketDashboardProps) {
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

    // Fetch roles when a ticket is selected (for role assignment)
    useEffect(() => {
        if (!selectedTicket) {
            setSupportGuildRoles([]);
            setSelectedRoleId("");
            return;
        }
        
        async function loadRoles() {
            const { getSupportGuildRoles } = await import("@/server/actions/ticket-actions");
            const res = await getSupportGuildRoles(selectedTicket!.discordGuildId);
            if (res.success && res.roles) {
                setSupportGuildRoles(res.roles);
                // Pre-select first valid role if none
                if (res.roles.length > 0 && !selectedRoleId) {
                    // Try to find a role containing "Sigil" or "Membre"
                    const sigilRole = res.roles.find((r: any) => r.name.toLowerCase().includes("sigil") || r.name.toLowerCase().includes("membre"));
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
        const interval = setInterval(() => {
            refreshTickets();
        }, 30000);
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

    // Auto-refresh on filter change (UX 2026)
    const handleStatusFilterChange = (val: string) => {
        setStatusFilter(val);
        refreshTickets({ status: val });
    };

    const handleCategoryFilterChange = (val: string) => {
        setCategoryFilter(val);
        refreshTickets({ category: val });
    };

    // Close ticket
    async function handleClose(ticketId: string) {
        startTransition(async () => {
            const { closeSupportTicket } = await import("@/server/actions/ticket-actions");
            const res = await closeSupportTicket(ticketId, "DASHBOARD", "Admin SigilOS", "Fermé via le GOD Dashboard");
            if (res.success) {
                toast.success("Ticket fermé !");
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
                toast.success("Ticket supprimé définitivement.");
                await refreshTickets();
                setSelectedTicket(null);
            } else {
                toast.error(res.error || "Erreur de suppression");
            }
        });
    }

    // Update status
    async function handleStatusChange(ticketId: string, status: string) {
        startTransition(async () => {
            const { updateTicketStatus } = await import("@/server/actions/ticket-actions");
            const res = await updateTicketStatus(ticketId, status as any);
            if (res.success) {
                toast.success("Statut mis à jour");
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
                toast.success("Guilde validée et whiteliste créée !");
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
                toast.success("Demande refusée et ticket fermé.");
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
                toast.success("Réponse envoyée");
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
                toast.success("Panel posté !");
            } else {
                toast.error(result.error);
            }
        });
    }

    return (
        <div className="space-y-8 pb-32">
            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <StatCard label="Nouveaux" value={stats.open} color="amber" />
                    <StatCard label="En cours" value={stats.inProgress} color="blue" />
                    <StatCard label="En attente" value={stats.waitingResponse} color="violet" />
                    <StatCard label="Fermés (7j)" value={stats.closedRecent} color="emerald" />
                    <StatCard label="Total" value={stats.total} color="zinc" />
                </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && refreshTickets()}
                        placeholder="Rechercher par sujet, auteur ou #numéro..."
                        className="w-full pl-10 pr-4 py-3 bg-zinc-900/50 border border-white/5 rounded-2xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/30 transition-all shadow-xl shadow-black/20"
                    />
                </div>

                {/* Status filter */}
                <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                    <SelectTrigger className="w-[200px] h-[52px] bg-zinc-900/50 border-white/5 rounded-2xl text-zinc-400">
                        <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Tous les statuts</SelectItem>
                        <SelectItem value="OPEN">🆕 Nouveaux (Open)</SelectItem>
                        <SelectItem value="IN_PROGRESS">⏳ En cours</SelectItem>
                        <SelectItem value="WAITING_RESPONSE">📩 En attente de réponse</SelectItem>
                        <SelectItem value="CLOSED">🔒 Archivés / Fermés</SelectItem>
                    </SelectContent>
                </Select>

                {/* Category filter */}
                <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
                    <SelectTrigger className="w-[220px] h-[52px] bg-zinc-900/50 border-white/5 rounded-2xl text-zinc-400">
                        <SelectValue placeholder="Toutes catégories" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Toutes catégories</SelectItem>
                        <SelectItem value="ACCESS_REQUEST">🔑 Demandes d'accès</SelectItem>
                        <SelectItem value="BUG_REPORT">🐛 Signalements Bugs</SelectItem>
                        <SelectItem value="FEATURE_REQUEST">💡 Suggestions Features</SelectItem>
                        <SelectItem value="OTHER">📩 Autres demandes</SelectItem>
                    </SelectContent>
                </Select>

                <button
                    onClick={() => refreshTickets()}
                    disabled={isPending}
                    className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 rounded-2xl text-sm font-black text-black transition-all disabled:opacity-50 flex items-center justify-center min-w-[100px]"
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Filtrer"}
                </button>
            </div>

            {/* Tickets Table */}
            <div className="bg-zinc-900/30 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="text-left px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Ticket</th>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Utilisateur</th>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Objet</th>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Catégorie</th>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Statut</th>
                                <th className="text-left px-6 py-4 text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Ancienneté</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tickets.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-30">
                                            <Ticket className="w-12 h-12" />
                                            <p className="text-sm font-bold uppercase tracking-widest">Aucun ticket en vue</p>
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
                                        className="border-b border-white/[0.03] hover:bg-white/[0.04] transition-all cursor-pointer group"
                                        onClick={() => setSelectedTicket(ticket)}
                                    >
                                        <td className="px-6 py-4">
                                            <span className="text-amber-500 font-mono font-black text-xs">#{ticket.ticketNumber}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-black uppercase text-[11px] tracking-tight">{ticket.creatorDiscordName}</span>
                                                <span className="text-[9px] text-zinc-600 font-mono">{ticket.creatorDiscordId}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-zinc-300 font-bold truncate max-w-[250px] block group-hover:text-amber-200 transition-colors">
                                                {ticket.subject}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-[10px] font-black uppercase">
                                            <span className={cn("px-2.5 py-1 rounded-lg border", cat.bg, cat.border, cat.color)}>
                                                {cat.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase", status.bg, status.border, status.color)}>
                                                <StatusIcon className="w-3.5 h-3.5" />
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-zinc-500 text-[10px] font-black uppercase">
                                                {new Date(ticket.createdAt).toLocaleDateString("fr-FR")}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tools Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Manual Post Panel */}
                <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 space-y-6">
                    <div className="flex items-center gap-3">
                        <Send className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Panel de Tickets</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <Select
                                value={panelGuildId}
                                onValueChange={(val) => {
                                    setPanelGuildId(val);
                                    setPanelChannelId(""); 
                                }}
                            >
                                <SelectTrigger className="h-[52px] bg-zinc-950 border-white/10 rounded-xl text-xs text-white">
                                    <SelectValue placeholder="Sélect. Serveur" />
                                </SelectTrigger>
                                <SelectContent>
                                    {botGuilds.map((g) => (
                                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select
                                value={panelChannelId}
                                onValueChange={setPanelChannelId}
                                disabled={!panelGuildId}
                            >
                                <SelectTrigger className="h-[52px] bg-zinc-950 border-white/10 rounded-xl text-xs text-white disabled:opacity-50">
                                    <SelectValue placeholder="Sélect. Salon" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableChannels.map((c) => (
                                        <SelectItem key={c.id} value={c.id}># {c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <button
                            onClick={handlePostPanel}
                            disabled={isPending || !panelChannelId || !panelGuildId}
                            className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-xs font-black text-emerald-400 uppercase tracking-widest transition-all"
                        >
                            Poster le panel (Discord)
                        </button>
                    </div>
                </div>

                {/* Automation Info */}
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-3xl p-8 flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-8 h-8 text-amber-500" />
                    </div>
                    <div>
                        <h4 className="text-white font-black uppercase text-xs tracking-widest mb-1">SigilOS Guard 2026</h4>
                        <p className="text-xs text-zinc-500 leading-relaxed font-bold">
                            Le système de tickets prend en charge la validation automatique des guildes. 
                            Activez le mode <span className="text-amber-500">ACCESS_REQUEST</span> pour tester.
                        </p>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
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
        </div>
    );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    const colorMap: Record<string, string> = {
        amber: "text-amber-400 bg-amber-500/10 border-amber-500/20 ring-amber-500/5",
        blue: "text-blue-400 bg-blue-500/10 border-blue-500/20 ring-blue-500/5",
        violet: "text-violet-400 bg-violet-500/10 border-violet-500/20 ring-violet-500/5",
        emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20 ring-emerald-500/5",
        zinc: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20 ring-zinc-500/5",
    };

    return (
        <div className={cn("rounded-3xl border p-6 space-y-2 ring-1 shadow-lg", colorMap[color])}>
            <div className="text-4xl font-black tracking-tighter">{value}</div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">{label}</div>
        </div>
    );
}

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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-10 py-8 border-b border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-4 mb-4">
                        <span className="text-amber-500 font-mono font-black text-lg underline decoration-amber-500/30 decoration-4">#{ticket.ticketNumber}</span>
                        <div className="h-4 w-px bg-white/10" />
                        <span className={cn("text-[10px] font-black uppercase px-3 py-1 rounded-full border", cat.bg, cat.border, cat.color)}>
                            {cat.emoji} {cat.label}
                        </span>
                        <Select
                            value={ticket.status}
                            onValueChange={(val) => onStatusChange(ticket.id, val)}
                        >
                            <SelectTrigger className={cn("h-8 text-[10px] font-black uppercase px-3 py-1 rounded-full border bg-zinc-950 outline-none w-fit", status.color, status.border)}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="OPEN">Nouveau</SelectItem>
                                <SelectItem value="IN_PROGRESS">En cours</SelectItem>
                                <SelectItem value="WAITING_RESPONSE">En attente</SelectItem>
                                <SelectItem value="CLOSED">Archiver</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight leading-tight">{ticket.subject}</h3>
                    <div className="flex items-center gap-4 mt-4">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-black">
                                {ticket.creatorDiscordName[0]}
                            </div>
                            <span className="text-zinc-400 font-bold text-xs">{ticket.creatorDiscordName}</span>
                        </div>
                        <span className="text-zinc-600 font-mono text-[10px]">ID: {ticket.creatorDiscordId}</span>
                    </div>
                </div>

                {/* Body */}
                <div className="px-10 py-8 space-y-8 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                    {/* Description */}
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Détails de la demande</h4>
                        <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap bg-zinc-950 p-6 rounded-3xl border border-white/5 font-medium italic">
                            {ticket.description}
                        </div>
                    </div>

                    {/* Quick Access Actions */}
                    <div className="flex flex-wrap gap-3">
                        {ticket.discordThreadId && (
                            <a
                                href={`https://discord.com/channels/${ticket.discordGuildId}/${ticket.discordThreadId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-2xl text-[11px] font-black text-indigo-400 uppercase tracking-widest transition-all"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Ouvrir Fil Discord
                            </a>
                        )}

                        {/* 🛠️ SPECIFIC TRIGGER: ACCESS VALIDATION */}
                        {ticket.category === "ACCESS_REQUEST" && ticket.status !== "CLOSED" && (
                            <div className="w-full space-y-6 pt-6 mt-6 border-t border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <h4 className="text-xs font-black text-white uppercase tracking-widest">Décision d'Accès Technique</h4>
                                </div>

                                {!rejectionMode ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950/50 p-6 rounded-[2rem] border border-white/5 shadow-inner">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Rôle Discord (Incentive)</label>
                                                <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                                                    <SelectTrigger className="w-full h-12 bg-zinc-950 border-white/5 rounded-xl text-[10px] font-black uppercase text-zinc-400 focus:ring-1 focus:ring-emerald-500/30">
                                                        <SelectValue placeholder="Sélect. Rôle..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-zinc-900 border-white/10 text-white z-[200]">
                                                        <SelectItem value="SKIP">❌ Aucun rôle</SelectItem>
                                                        {guildRoles.map((role) => (
                                                            <SelectItem key={role.id} value={role.id} className="text-xs font-bold font-mono">
                                                                {role.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Message Additionnel (Optionnel)</label>
                                                <input 
                                                    type="text" 
                                                    value={validationNotes}
                                                    onChange={(e) => setValidationNotes(e.target.value)}
                                                    placeholder="Contraintes spécifiques, bienvenue..."
                                                    className="w-full h-12 px-4 bg-zinc-950 border border-white/5 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/30 transition-all font-medium"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-col justify-end gap-3">
                                            <button
                                                onClick={() => onValidateGuild(ticket.id, ticket.targetGuildId!, validationNotes)} 
                                                disabled={isPending || !ticket.targetGuildId}
                                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all disabled:opacity-50 shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-2"
                                            >
                                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                                Valider la Guilde
                                            </button>
                                            <button
                                                onClick={() => setRejectionMode(true)}
                                                className="w-full py-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 rounded-2xl text-[10px] font-black text-red-500 uppercase tracking-widest transition-all"
                                            >
                                                Refuser la demande
                                            </button>
                                            <p className="text-[9px] text-zinc-600 italic text-center font-medium">
                                                L'utilisateur recevra un guide d'installation complet.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-rose-500/5 p-6 rounded-[2rem] border border-rose-500/10 space-y-4 animate-in slide-in-from-top-2 duration-300">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">Motif du Refus (Sera envoyé par MP)</label>
                                            <textarea 
                                                value={rejectionReason}
                                                onChange={(e) => setRejectionReason(e.target.value)}
                                                placeholder="Ex: Guilde trop petite, leader absent, serveur ne respectant pas les CGU..."
                                                rows={3}
                                                className="w-full p-4 bg-zinc-950 border border-rose-500/20 rounded-xl text-sm text-zinc-300 focus:outline-none focus:border-rose-500/40 transition-all resize-none font-medium"
                                            />
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => onRejectGuild(ticket.id, rejectionReason)}
                                                disabled={isPending || !rejectionReason.trim()}
                                                className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                                            >
                                                {isPending ? "Refus en cours..." : "Confirmer le Refus"}
                                            </button>
                                            <button
                                                onClick={() => setRejectionMode(false)}
                                                className="px-6 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-xs font-black text-zinc-400 uppercase tracking-widest transition-all"
                                            >
                                                Annuler
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Reply Section */}
                    {ticket.status !== "CLOSED" && (
                        <div className="space-y-3 pt-4 border-t border-white/5">
                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest pl-1">Réponse directe</h4>
                            <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Tape ta réponse pour l'envoyer directement dans le thread Discord..."
                                rows={4}
                                className="w-full px-6 py-4 bg-zinc-950 border border-white/10 rounded-[2rem] text-sm text-white placeholder:text-zinc-800 focus:outline-none focus:border-indigo-500/30 transition-all resize-none font-medium"
                            />
                            <div className="flex justify-between items-center bg-zinc-950/50 p-2 rounded-[2.5rem] border border-white/5">
                                <span className="text-[9px] text-zinc-600 font-bold uppercase ml-4">
                                    {isPending ? "Traitement en cours..." : "Le bot répondra en ton nom"}
                                </span>
                                <button
                                    onClick={() => onReply(ticket.id)}
                                    disabled={isPending || !replyText.trim()}
                                    className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 rounded-full text-[10px] font-black text-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                    Envoyer la réponse
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Archive Info */}
                    {ticket.status === "CLOSED" && (
                        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-3">
                            <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <Hash className="w-3.5 h-3.5" /> Métadonnées de Fermeture
                            </h4>
                            <div className="grid grid-cols-2 gap-4 text-[11px] font-medium text-zinc-500">
                                <div>📅 Fermé le : <span className="text-zinc-300 font-mono">{ticket.closedAt ? new Date(ticket.closedAt).toLocaleString() : "N/A"}</span></div>
                                <div>👤 Par : <span className="text-zinc-300">{ticket.closedBy || "Anonyme"}</span></div>
                                <div className="col-span-2 mt-2">💬 Raison : <span className="text-zinc-300 italic">"{ticket.closedReason || "Aucune"}"</span></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Action Footer */}
                {ticket.status !== "CLOSED" && (
                    <div className="px-10 py-6 border-t border-white/5 bg-zinc-950/50 flex justify-between items-center group/footer">
                        <div className="flex items-center gap-6">
                            <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">SigilOS Support Engine v2.6</p>
                            <button
                                onClick={() => onDeleteTicket(ticket.id)}
                                disabled={isPending}
                                className="opacity-0 group-hover/footer:opacity-100 transition-opacity flex items-center gap-1.5 text-[9px] font-black text-red-500/50 hover:text-red-500 uppercase tracking-widest"
                            >
                                <Trash2 className="w-3 h-3" />
                                Détruire Définitivement
                            </button>
                        </div>
                        <button
                            onClick={() => onCloseTicket(ticket.id)}
                            disabled={isPending}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-2xl text-[10px] font-black text-red-500 uppercase tracking-[0.2em] transition-all disabled:opacity-50"
                        >
                            <X className="w-3.5 h-3.5" />
                            Archiver Ticket
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
