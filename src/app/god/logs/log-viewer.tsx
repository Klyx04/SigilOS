"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
    History,
    User,
    AlertCircle,
    Key,
    Terminal,
    Plus,
    X,
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Clock,
    UserMinus,
    Trash2,
    Shield,
    Building2,
    Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { useEffect, useCallback } from "react";

interface AuditLog {
    id: string;
    actorUserId: string;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string | null;
    oldValue: any;
    newValue: any;
    metadata: any;
    createdAt: Date;
    guild?: {
        name: string;
        discordGuildId: string;
    };
}

interface LogViewerProps {
    initialLogs: AuditLog[];
    initialTotal: number;
}

const ITEMS_PER_PAGE = 50;

const ACTION_OPTIONS = [
    { value: "all", label: "Toutes les actions" },
    { value: "SECURITY_ALERT", label: "🚨 Alertes de Sécurité" },
    { value: "RBAC_UPDATE,RBAC_ROLE_ADD,RBAC_ROLE_REMOVE", label: "Permissions" },
    { value: "GOD_GUILD_WHITELIST,GOD_USER_PLATFORM_BAN,GOD_CONFIG_OVERRIDE,GOD_DATABASE_SYNC", label: "🛡️ Actions God" },
    { value: "WEBHOOK_MEMBER_ADD,WEBHOOK_MEMBER_REMOVE,WEBHOOK_MEMBER_UPDATE", label: "🔄 Mouvements" },
    { value: "USER_GDPR_DELETE", label: "🗑️ Suppressions RGPD" },
    { value: "CONFIG_UPDATED", label: "Configuration" },
    { value: "ADMIN_FULL_DENIED", label: "Accès refusé" },
];

export function LogViewer({ initialLogs, initialTotal }: LogViewerProps) {
    const [logs, setLogs] = useState(initialLogs);
    const [total, setTotal] = useState(initialTotal);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    // Filters
    const [actionFilter, setActionFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Fetch logs when filters or page change
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: ITEMS_PER_PAGE.toString(),
            });

            if (actionFilter && actionFilter !== "all") {
                params.set("action", actionFilter);
            }
            if (debouncedSearch) {
                params.set("search", debouncedSearch);
            }

            const res = await fetch(`/api/god/audit-logs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs);
                setTotal(data.total);
            }
        } catch (error) {
            console.error("Failed to fetch logs:", error);
        } finally {
            setLoading(false);
        }
    }, [page, actionFilter, debouncedSearch]);

    useEffect(() => {
        // Skip initial fetch since we have initialLogs
        if (page === 1 && actionFilter === "all" && !debouncedSearch) {
            return;
        }
        fetchLogs();
    }, [page, actionFilter, debouncedSearch, fetchLogs]);

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [actionFilter, debouncedSearch]);

    const clearFilters = () => {
        setActionFilter("all");
        setSearchQuery("");
        setDebouncedSearch("");
        setPage(1);
    };

    const hasActiveFilters = actionFilter !== "all" || debouncedSearch;

    const getActionColors = (action: string) => {
        if (action.includes("RBAC")) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
        if (action.includes("SECURITY")) return "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse";
        if (action.includes("CONFIG")) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
        if (action.startsWith("GOD_")) return "bg-violet-500/10 text-violet-400 border-violet-500/20 ";
        if (action === "WEBHOOK_MEMBER_ADD") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        if (action === "WEBHOOK_MEMBER_REMOVE") return "bg-zinc-500/10 text-zinc-400 border-white/10";
        if (action === "WEBHOOK_MEMBER_UPDATE") return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
        if (action === "USER_GDPR_DELETE") return "bg-red-500/10 text-red-400 border-red-500/50 hover:bg-red-500/20";
        return "bg-zinc-500/10 text-zinc-400 border-white/5";
    };

    const getActionIcon = (action: string) => {
        if (action.includes("RBAC")) return <Key className="w-3.5 h-3.5" />;
        if (action.includes("SECURITY")) return <AlertCircle className="w-3.5 h-3.5" />;
        if (action.includes("CONFIG")) return <Settings className="w-3.5 h-3.5" />;
        if (action.includes("MEMBER_ADD")) return <Plus className="w-3.5 h-3.5" />;
        if (action === "WEBHOOK_MEMBER_REMOVE") return <UserMinus className="w-3.5 h-3.5" />;
        if (action === "USER_GDPR_DELETE") return <Trash2 className="w-3.5 h-3.5" />;
        if (action.startsWith("GOD_")) return <Terminal className="w-3.5 h-3.5 text-violet-400" />;
        return <Shield className="w-3.5 h-3.5" />;
    };

    const formatActionLabel = (action: string) => {
        if (action === "WEBHOOK_MEMBER_ADD") return "Arrivée Membre";
        if (action === "WEBHOOK_MEMBER_REMOVE") return "Départ Membre";
        if (action === "WEBHOOK_MEMBER_UPDATE") return "MàJ Membre";
        return action.replace(/_/g, " ");
    };

    const formatValue = (val: any) => {
        if (!val || typeof val !== "object") return String(val);
        return JSON.stringify(val, null, 2);
    };

    return (
        <div className="space-y-4">
            {/* Filters Toolbar */}
            <div className="flex flex-wrap items-center gap-3 bg-zinc-900/40 p-3 rounded-2xl border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-2 px-2 border-r border-white/10 mr-2">
                    <Filter className="h-4 w-4 text-zinc-500" />
                    <span className="text-caption font-black text-zinc-500 uppercase tracking-widest">Filtres</span>
                </div>

                <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="w-[180px] h-9 text-caption font-bold bg-zinc-800/50 border-white/10 rounded-xl">
                        <SelectValue placeholder="Type d'action" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10">
                        {ACTION_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                    <Input
                        type="text"
                        placeholder="Rechercher par acteur, guilde..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="h-9 w-[260px] pl-9 text-caption font-bold bg-zinc-800/50 border-white/10 rounded-xl"
                    />
                </div>

                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-9 text-caption font-black text-zinc-500 hover:text-white uppercase tracking-widest"
                    >
                        <X className="h-3 w-3 mr-2" />
                        Réinitialiser
                    </Button>
                )}

                <div className="ml-auto flex items-center gap-4">
                    <div className="flex items-center gap-2 text-caption font-black text-zinc-500 uppercase tracking-widest">
                        Page <span className="text-zinc-300">{page}</span> / <span className="text-zinc-300">{totalPages || 1}</span>
                    </div>
                    <div className="flex gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            className="h-8 w-8 p-0 bg-zinc-800/50 border-white/10 rounded-lg disabled:opacity-30"
                        >
                            <ChevronLeft className="h-4 h-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || loading}
                            className="h-8 w-8 p-0 bg-zinc-800/50 border-white/10 rounded-lg disabled:opacity-30"
                        >
                            <ChevronRight className="h-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-xl max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5">
                        <tr>
                            <th className="px-6 py-4 text-caption font-black text-zinc-500 uppercase tracking-widest">Événement</th>
                            <th className="px-6 py-4 text-caption font-black text-zinc-500 uppercase tracking-widest">Acteur</th>
                            <th className="px-6 py-4 text-caption font-black text-zinc-500 uppercase tracking-widest">Cible / Guilde</th>
                            <th className="px-6 py-4 text-caption font-black text-zinc-500 uppercase tracking-widest">Détails</th>
                            <th className="px-6 py-4 text-caption font-black text-zinc-500 uppercase tracking-widest text-right">Date</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-20 text-center text-zinc-600 font-medium">
                                    Aucun log détecté dans la base de données.
                                </td>
                            </tr>
                        ) : logs.map((log) => (
                            <tr key={log.id} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-300",
                                            getActionColors(log.action)
                                        )}>
                                            {getActionIcon(log.action)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-caption font-black uppercase tracking-tight text-white leading-none">
                                                {formatActionLabel(log.action)}
                                            </span>
                                            <span className="text-caption font-bold text-zinc-500 uppercase tracking-widest mt-1">
                                                {log.targetType}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded flex items-center justify-center bg-violet-500/10 border border-violet-500/20">
                                            <User className="w-3 h-3 text-violet-400" />
                                        </div>
                                        <span className="text-sm font-medium text-zinc-300">{log.actorName}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-3 h-3 text-zinc-600" />
                                            <span className="text-sm font-medium text-zinc-400">{log.guild?.name || "Global / System"}</span>
                                        </div>
                                        {log.targetId && (
                                            <span className="text-caption font-mono text-zinc-600 ml-5">{log.targetId}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {log.metadata && (
                                        <div className="max-w-xs truncate text-xs text-zinc-500 font-mono italic">
                                            {typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata)}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="text-sm font-medium text-zinc-400">
                                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Bottom Info */}
            <div className="flex items-center justify-between text-caption font-black text-zinc-600 uppercase tracking-widest px-2">
                <span>Affichage de <span className="text-zinc-400">{logs.length}</span> entrées sur un total de <span className="text-zinc-400">{total}</span></span>
            </div>
        </div>
    );
}
