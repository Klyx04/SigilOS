"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, User, Plus, Minus, Filter, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Action type to color mapping
const ACTION_COLORS: Record<string, string> = {
    RBAC_UPDATE: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    RBAC_ROLE_ADD: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    RBAC_ROLE_REMOVE: "bg-red-500/20 text-red-400 border-red-500/30",
    CONFIG_UPDATED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    API_KEY_UPDATED: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    CHANNEL_CONFIGURED: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    ADMIN_ACCESS_DENIED: "bg-red-600/20 text-red-300 border-red-600/30",
};

const ACTION_LABELS: Record<string, string> = {
    RBAC_UPDATE: "Permissions modifiées",
    RBAC_ROLE_ADD: "Rôle ajouté",
    RBAC_ROLE_REMOVE: "Rôle retiré",
    CONFIG_UPDATED: "Configuration mise à jour",
    API_KEY_UPDATED: "Clé API modifiée",
    CHANNEL_CONFIGURED: "Canal configuré",
    ADMIN_ACCESS_DENIED: "🚨 Accès refusé",
};

const ACTION_OPTIONS = [
    { value: "all", label: "Toutes les actions" },
    { value: "RBAC_UPDATE", label: "Permissions modifiées" },
    { value: "ADMIN_ACCESS_DENIED", label: "Accès refusé" },
    { value: "CONFIG_UPDATED", label: "Configuration" },
    { value: "API_KEY_UPDATED", label: "Clé API" },
    { value: "CHANNEL_CONFIGURED", label: "Canal" },
];

type PermissionChange = {
    roleId: string;
    roleName?: string;
    added: Array<{ permission: string; label: string; module: string }>;
    removed: Array<{ permission: string; label: string; module: string }>;
};

type AuditMetadata = {
    rolesAffected?: number;
    changes?: PermissionChange[];
    timestamp?: string;
};

type AuditLog = {
    id: string;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string | null;
    metadata: AuditMetadata | null;
    createdAt: string;
};

type Props = {
    guildId: string;
    initialLogs: AuditLog[];
    initialTotal: number;
    roleNames: Record<string, string>;
};

const ITEMS_PER_PAGE = 20;

function formatDate(date: string): string {
    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(date));
}

function PermissionChangesDisplay({
    metadata,
    roleNames
}: {
    metadata: AuditMetadata;
    roleNames: Record<string, string>;
}) {
    if (!metadata.changes || metadata.changes.length === 0) {
        return null;
    }

    return (
        <div className="mt-3 space-y-2">
            {metadata.changes.map((change, idx) => {
                const roleName = change.roleName || roleNames[change.roleId] || `Rôle inconnu`;
                return (
                    <div key={idx} className="bg-zinc-800/50 rounded-lg p-3 border border-white/5">
                        <div className="text-xs text-muted-foreground mb-2">
                            Rôle: <span className="font-semibold text-foreground">{roleName}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {change.added.map((perm, i) => (
                                <Badge key={`add-${i}`} variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                                    <Plus className="w-3 h-3 mr-1" />
                                    {perm.label}
                                    <span className="ml-1 text-emerald-400/60 text-[10px]">({perm.module})</span>
                                </Badge>
                            ))}
                            {change.removed.map((perm, i) => (
                                <Badge key={`rem-${i}`} variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">
                                    <Minus className="w-3 h-3 mr-1" />
                                    {perm.label}
                                    <span className="ml-1 text-red-400/60 text-[10px]">({perm.module})</span>
                                </Badge>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function AuditLogsClient({ guildId, initialLogs, initialTotal, roleNames }: Props) {
    const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
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

            const res = await fetch(`/api/guild/${guildId}/audit-logs?${params.toString()}`);
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
    }, [guildId, page, actionFilter, debouncedSearch]);

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

    return (
        <Card className="bg-zinc-900/60 border-white/5">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Historique
                    <Badge variant="secondary" className="ml-2">
                        {total} entrées
                    </Badge>
                </CardTitle>
            </CardHeader>

            {/* Filters Toolbar */}
            <div className="px-6 py-3 border-b border-white/5 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Filtres</span>
                </div>

                <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="w-[180px] h-8 text-xs bg-zinc-800 border-white/10">
                        <SelectValue placeholder="Type d'action" />
                    </SelectTrigger>
                    <SelectContent>
                        {ACTION_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="h-8 w-[160px] pl-7 text-xs bg-zinc-800 border-white/10"
                    />
                </div>

                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-3 w-3 mr-1" />
                        Effacer
                    </Button>
                )}

                <div className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        Page {page} / {totalPages || 1}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        className="h-8 w-8 p-0"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || loading}
                        className="h-8 w-8 p-0"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <CardContent className="pt-4">
                {loading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-16 bg-zinc-800/30 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                        {hasActiveFilters ? "Aucun résultat pour ces filtres." : "Aucune action enregistrée."}
                    </p>
                ) : (
                    <div className="space-y-4">
                        {logs.map((log) => {
                            const metadata = (log.metadata || {}) as AuditMetadata;

                            return (
                                <div key={log.id} className="relative pl-6 border-l-2 border-white/10 pb-4 last:pb-0">
                                    <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-primary" />
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                                <span className="font-semibold text-foreground">
                                                    {log.actorName}
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className={ACTION_COLORS[log.action] || "bg-zinc-500/20 text-zinc-400"}
                                                >
                                                    {ACTION_LABELS[log.action] || log.action}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {log.targetType === "PERMISSION" && "Modification des permissions RBAC"}
                                                {log.targetType === "ROLE" && "Modification d'un rôle Discord"}
                                                {log.targetType === "CONFIG" && "Modification de la configuration"}
                                                {log.targetType === "CHANNEL" && "Modification d'un canal"}
                                                {log.targetType === "ACCESS_ATTEMPT" && (
                                                    <span className="text-red-400">
                                                        Tentative d'accès non autorisé à <code className="bg-red-900/30 px-1 rounded">{log.targetId}</code>
                                                    </span>
                                                )}
                                            </p>

                                            {log.action === "RBAC_UPDATE" && metadata.changes && (
                                                <PermissionChangesDisplay metadata={metadata} roleNames={roleNames} />
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                                            {formatDate(log.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
