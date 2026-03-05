"use client";

import { useState, useTransition } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
}

interface TicketStats {
    open: number;
    inProgress: number;
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
    ACCESS_REQUEST: { label: "Accès", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", emoji: "🔑" },
    BUG_REPORT: { label: "Bug", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", emoji: "🐛" },
    FEATURE_REQUEST: { label: "Feature", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", emoji: "💡" },
    OTHER: { label: "Autre", color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", emoji: "📩" },
};

const STATUS_CONFIG = {
    OPEN: { label: "Ouvert", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertCircle },
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

    const stats = initialStats;

    // Refresh tickets with filters
    async function refreshTickets() {
        startTransition(async () => {
            const { getSupportTickets } = await import("@/server/actions/ticket-actions");
            const result = await getSupportTickets({
                status: statusFilter === "ALL" ? undefined : statusFilter as any,
                category: categoryFilter === "ALL" ? undefined : categoryFilter as any,
                search: search || undefined,
            });
            setTickets(result.tickets as unknown as SupportTicket[]);
            setTotal(result.total);
        });
    }

    // Close ticket
    async function handleClose(ticketId: string) {
        startTransition(async () => {
            const { updateTicketStatus } = await import("@/server/actions/ticket-actions");
            await updateTicketStatus(ticketId, "CLOSED");
            await refreshTickets();
            setSelectedTicket(null);
        });
    }

    // Update status
    async function handleStatusChange(ticketId: string, status: string) {
        startTransition(async () => {
            const { updateTicketStatus } = await import("@/server/actions/ticket-actions");
            await updateTicketStatus(ticketId, status as any);
            await refreshTickets();
        });
    }

    // Send reply
    async function handleReply(ticketId: string) {
        if (!replyText.trim()) return;
        startTransition(async () => {
            const { sendTicketReply } = await import("@/server/actions/ticket-actions");
            await sendTicketReply(ticketId, replyText);
            setReplyText("");
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
                alert("✅ Panel posté avec succès !");
            } else {
                alert(`❌ ${result.error}`);
            }
        });
    }

    // Filter display
    const filteredTickets = tickets;

    return (
        <div className="space-y-8">
            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Ouverts" value={stats.open} color="amber" />
                    <StatCard label="En cours" value={stats.inProgress} color="blue" />
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
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/50 border border-white/5 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/30"
                    />
                </div>

                {/* Status filter */}
                <select
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); }}
                    className="px-4 py-2.5 bg-zinc-900/50 border border-white/5 rounded-xl text-sm text-zinc-400 focus:outline-none"
                >
                    <option value="ALL">Tous les statuts</option>
                    <option value="OPEN">Ouverts</option>
                    <option value="IN_PROGRESS">En cours</option>
                    <option value="WAITING_RESPONSE">En attente</option>
                    <option value="CLOSED">Fermés</option>
                </select>

                {/* Category filter */}
                <select
                    value={categoryFilter}
                    onChange={(e) => { setCategoryFilter(e.target.value); }}
                    className="px-4 py-2.5 bg-zinc-900/50 border border-white/5 rounded-xl text-sm text-zinc-400 focus:outline-none"
                >
                    <option value="ALL">Toutes catégories</option>
                    <option value="ACCESS_REQUEST">🔑 Accès</option>
                    <option value="BUG_REPORT">🐛 Bug</option>
                    <option value="FEATURE_REQUEST">💡 Feature</option>
                    <option value="OTHER">📩 Autre</option>
                </select>

                <button
                    onClick={refreshTickets}
                    disabled={isPending}
                    className="px-5 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl text-sm font-bold text-indigo-400 transition-all disabled:opacity-50"
                >
                    {isPending ? "..." : "Filtrer"}
                </button>
            </div>

            {/* Post Panel Tool */}
            <details className="bg-zinc-900/30 border border-white/5 rounded-2xl">
                <summary className="px-6 py-4 cursor-pointer text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <ChevronDown className="w-4 h-4" />
                    Poster le panel de tickets dans un salon
                </summary>
                <div className="px-6 pb-6 space-y-4">
                    {/* Help text */}
                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-4 space-y-2">
                        <p className="text-xs text-indigo-300 font-bold">💡 Comment trouver les IDs Discord ?</p>
                        <ol className="text-[11px] text-zinc-500 space-y-1 list-decimal list-inside">
                            <li>Ouvre les <span className="text-zinc-300">Paramètres Discord</span> → <span className="text-zinc-300">Avancé</span> → Active le <span className="text-indigo-400 font-bold">Mode développeur</span></li>
                            <li><span className="text-zinc-300">Clic droit sur ton serveur</span> (colonne de gauche) → <span className="text-indigo-400 font-bold">Copier l&apos;identifiant du serveur</span> = Guild ID</li>
                            <li><span className="text-zinc-300">Clic droit sur le salon</span> où poster le panel → <span className="text-indigo-400 font-bold">Copier l&apos;identifiant du salon</span> = Channel ID</li>
                        </ol>
                    </div>

                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-1 block">Channel ID</label>
                            <input
                                value={panelChannelId}
                                onChange={(e) => setPanelChannelId(e.target.value)}
                                placeholder="ID du salon Discord"
                                className="w-full px-4 py-2 bg-zinc-900/50 border border-white/5 rounded-lg text-sm text-white placeholder:text-zinc-700 focus:outline-none"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold mb-1 block">Guild ID</label>
                            <input
                                value={panelGuildId}
                                onChange={(e) => setPanelGuildId(e.target.value)}
                                placeholder="ID du serveur Discord"
                                className="w-full px-4 py-2 bg-zinc-900/50 border border-white/5 rounded-lg text-sm text-white placeholder:text-zinc-700 focus:outline-none"
                            />
                        </div>
                        <button
                            onClick={handlePostPanel}
                            disabled={isPending || !panelChannelId || !panelGuildId}
                            className="px-6 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg text-sm font-bold text-emerald-400 transition-all disabled:opacity-50 whitespace-nowrap"
                        >
                            📬 Poster
                        </button>
                    </div>
                </div>
            </details>

            {/* Tickets Table */}
            <div className="bg-zinc-900/20 border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left px-5 py-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">#</th>
                                <th className="text-left px-5 py-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Auteur</th>
                                <th className="text-left px-5 py-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Sujet</th>
                                <th className="text-left px-5 py-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Cat.</th>
                                <th className="text-left px-5 py-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Statut</th>
                                <th className="text-left px-5 py-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Date</th>
                                <th className="text-right px-5 py-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTickets.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center text-zinc-600 text-sm">
                                        Aucun ticket trouvé
                                    </td>
                                </tr>
                            )}
                            {filteredTickets.map((ticket) => {
                                const cat = CATEGORY_CONFIG[ticket.category];
                                const status = STATUS_CONFIG[ticket.status];
                                const StatusIcon = status.icon;
                                return (
                                    <tr
                                        key={ticket.id}
                                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer"
                                        onClick={() => setSelectedTicket(ticket)}
                                    >
                                        <td className="px-5 py-3">
                                            <span className="text-zinc-500 font-mono font-bold">#{ticket.ticketNumber}</span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-white font-bold">{ticket.creatorDiscordName}</span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-zinc-300 truncate max-w-[200px] block">{ticket.subject}</span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", cat.bg, cat.border, cat.color)}>
                                                {cat.emoji} {cat.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border", status.bg, status.border, status.color)}>
                                                <StatusIcon className="w-3 h-3" />
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-zinc-600 text-xs font-mono">
                                                {new Date(ticket.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                                                {ticket.status !== "CLOSED" && (
                                                    <select
                                                        value={ticket.status}
                                                        onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                                                        className="px-2 py-1 bg-zinc-900/50 border border-white/5 rounded-lg text-[10px] text-zinc-400 focus:outline-none"
                                                    >
                                                        <option value="OPEN">Ouvert</option>
                                                        <option value="IN_PROGRESS">En cours</option>
                                                        <option value="WAITING_RESPONSE">En attente</option>
                                                        <option value="CLOSED">Fermer</option>
                                                    </select>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination indicator */}
                <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-600 font-mono uppercase">{total} ticket{total !== 1 ? "s" : ""}</span>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedTicket && (
                <TicketDetailModal
                    ticket={selectedTicket}
                    onClose={() => setSelectedTicket(null)}
                    onReply={handleReply}
                    onCloseTicket={handleClose}
                    replyText={replyText}
                    setReplyText={setReplyText}
                    isPending={isPending}
                />
            )}
        </div>
    );
}

// =============================================================================
// STAT CARD
// =============================================================================

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    const colorMap: Record<string, string> = {
        amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        zinc: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    };

    return (
        <div className={cn("rounded-2xl border p-5 space-y-2", colorMap[color])}>
            <div className="text-3xl font-black tracking-tighter">{value}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</div>
        </div>
    );
}

// =============================================================================
// DETAIL MODAL
// =============================================================================

function TicketDetailModal({
    ticket,
    onClose,
    onReply,
    onCloseTicket,
    replyText,
    setReplyText,
    isPending,
}: {
    ticket: SupportTicket;
    onClose: () => void;
    onReply: (id: string) => void;
    onCloseTicket: (id: string) => void;
    replyText: string;
    setReplyText: (v: string) => void;
    isPending: boolean;
}) {
    const cat = CATEGORY_CONFIG[ticket.category];
    const status = STATUS_CONFIG[ticket.status];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="px-8 py-6 border-b border-white/5 flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-zinc-500 font-black">#{ticket.ticketNumber}</span>
                            <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", cat.bg, cat.border, cat.color)}>
                                {cat.emoji} {cat.label}
                            </span>
                            <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border", status.bg, status.border, status.color)}>
                                {status.label}
                            </span>
                        </div>
                        <h3 className="text-xl font-black text-white">{ticket.subject}</h3>
                        <p className="text-xs text-zinc-500 mt-1">
                            par <span className="text-zinc-300 font-bold">{ticket.creatorDiscordName}</span> · {new Date(ticket.createdAt).toLocaleString("fr-FR")}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-500 hover:text-white transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-8 py-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    {/* Description */}
                    <div>
                        <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-2">Description</h4>
                        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap bg-zinc-900/40 border border-white/5 rounded-xl p-4">
                            {ticket.description}
                        </div>
                    </div>

                    {/* Discord Thread link */}
                    {ticket.discordThreadId && (
                        <a
                            href={`https://discord.com/channels/${ticket.discordGuildId}/${ticket.discordThreadId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-sm font-bold text-indigo-400 transition-all"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Ouvrir le fil Discord
                        </a>
                    )}

                    {/* Reply */}
                    {ticket.status !== "CLOSED" && (
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Répondre via le bot</h4>
                            <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Écrire une réponse..."
                                rows={3}
                                className="w-full px-4 py-3 bg-zinc-900/50 border border-white/5 rounded-xl text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/30 resize-none"
                            />
                            <button
                                onClick={() => onReply(ticket.id)}
                                disabled={isPending || !replyText.trim()}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-sm font-bold text-emerald-400 transition-all disabled:opacity-50"
                            >
                                <Send className="w-4 h-4" />
                                Envoyer
                            </button>
                        </div>
                    )}

                    {/* Closed info */}
                    {ticket.status === "CLOSED" && ticket.closedAt && (
                        <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-4">
                            <p className="text-xs text-zinc-500">
                                Fermé le {new Date(ticket.closedAt).toLocaleString("fr-FR")}
                                {ticket.closedReason && <> — {ticket.closedReason}</>}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {ticket.status !== "CLOSED" && (
                    <div className="px-8 py-4 border-t border-white/5 flex justify-end">
                        <button
                            onClick={() => onCloseTicket(ticket.id)}
                            disabled={isPending}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-sm font-bold text-red-400 transition-all disabled:opacity-50"
                        >
                            🔒 Fermer le ticket
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
