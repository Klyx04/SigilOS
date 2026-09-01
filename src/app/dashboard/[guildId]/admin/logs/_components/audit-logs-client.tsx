"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, User, Plus, Minus, Filter, ChevronLeft, ChevronRight, Search, X, Shield, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Action type to color mapping
const ACTION_COLORS: Record<string, string> = {
    RBAC_UPDATE: "bg-warning/20 text-warning border-warning/30",
    RBAC_ROLE_ADD: "bg-success/20 text-success border-success/30",
    RBAC_ROLE_REMOVE: "bg-danger/20 text-danger border-danger/30",
    CONFIG_UPDATED: "bg-info/20 text-info border-info/30",
    SETTINGS_UPDATED: "bg-info/20 text-info border-info/30",
    SECURITY_ALERT: "bg-danger/20 text-danger border-danger/30 animate-pulse",
    ADMIN_FULL_DENIED: "bg-warning/20 text-warning border-warning/30",
    MEMBER_LEFT: "bg-muted/20 text-muted-foreground border-border",
    MEMBER_ARCHIVED: "bg-warning/20 text-warning border-warning/30",
    MEMBER_BANNED: "bg-danger/20 text-danger border-danger/30",
    MEMBER_PURGED: "bg-danger/20 text-danger border-danger/30",
    WEBHOOK_MEMBER_ADD: "bg-success/20 text-success border-success/30",
    WEBHOOK_MEMBER_REMOVE: "bg-muted/20 text-muted-foreground border-border",
    PLATFORM_ARRIVAL: "bg-success/20 text-success border-success/30",
    PLATFORM_DEPARTURE: "bg-muted/20 text-muted-foreground border-border",
    PROFILE_ARCHIVED: "bg-warning/20 text-warning border-warning/30",
    PROFILE_REACTIVATED: "bg-success/20 text-success border-success/30",
    MEMBER_PSEUDO_UPDATE: "bg-info/20 text-info border-info/30",
    MEMBER_ANKAMA_ID_UPDATE: "bg-info/20 text-info border-info/30",
    // Missions
    MISSION_CREATED: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    MISSION_DELETED: "bg-danger/20 text-danger border-danger/30",
    MISSION_VALIDATED: "bg-success/20 text-success border-success/30",
    MISSION_REJECTED: "bg-danger/20 text-danger border-danger/30",
    // Bonus
    BONUS_PURCHASED: "bg-info/20 text-info border-info/30",
    BONUS_CANCELLED: "bg-muted/20 text-muted-foreground border-border",
    // Polls
    POLL_CREATED: "bg-info/20 text-info border-info/30",
    POLL_CLOSED: "bg-warning/20 text-warning border-warning/30",
    POLL_DELETED: "bg-danger/20 text-danger border-danger/30",
    POLL_CREATOR_ROLE_ACQUIRED: "bg-info/10 text-info border-info/20 ",
    // GDPR
    USER_GDPR_DELETE: "bg-danger/20 text-danger border-danger/30",
};

const ACTION_LABELS: Record<string, string> = {
    RBAC_UPDATE: "Permissions modifiées",
    RBAC_ROLE_ADD: "Rôle ajouté",
    RBAC_ROLE_REMOVE: "Rôle retiré",
    CONFIG_UPDATED: "Configuration mise à jour",
    SETTINGS_UPDATED: "Paramètres mis à jour",
    SECURITY_ALERT: "🚨 ALERTE SÉCURITÉ",
    ADMIN_FULL_DENIED: "Accès refusé",
    MEMBER_LEFT: "Départ membre",
    MEMBER_ARCHIVED: "Membre archivé",
    MEMBER_BANNED: "Membre banni",
    MEMBER_PURGED: "Données purgées",
    WEBHOOK_MEMBER_ADD: "Arrivée Discord (Bot)",
    WEBHOOK_MEMBER_REMOVE: "Départ Discord (Bot)",
    WEBHOOK_MEMBER_UPDATE: "Événement Discord (Bot)",
    PLATFORM_ARRIVAL: "🚀 Arrivée Plateforme",
    PLATFORM_DEPARTURE: "👋 Départ Plateforme",
    PROFILE_ARCHIVED: "📁 Profil Archivé",
    PROFILE_REACTIVATED: "⚡ Profil Réactivé",
    MEMBER_PSEUDO_UPDATE: "🏷️ Pseudo Dofus modifié",
    MEMBER_ANKAMA_ID_UPDATE: "🆔 ID Dofus (Ankama) modifié",
    // Missions
    MISSION_CREATED: "⚔️ Missions publiées",
    MISSION_DELETED: "🗑️ Mission supprimée",
    MISSION_VALIDATED: "✅ Soumission validée",
    MISSION_REJECTED: "❌ Soumission refusée",
    // Bonus
    BONUS_PURCHASED: "🔮 Bonus acheté",
    BONUS_CANCELLED: "Bonus annulé",
    // Polls
    POLL_CREATED: "📊 Sondage créé",
    POLL_CLOSED: "🔒 Sondage clôturé",
    POLL_DELETED: "🗑️ Sondage supprimé",
    POLL_CREATOR_ROLE_ACQUIRED: "🎤 Micro acquis",
    // GDPR
    USER_GDPR_DELETE: "🗑️ Suppression RGPD",
};

const ACTION_OPTIONS = [
    { value: "all", label: "Toutes les actions" },
    { value: "SECURITY_ALERT", label: "🚨 Alertes de Sécurité" },
    { value: "RBAC_UPDATE", label: "Permissions modifiées" },
    { value: "MISSION_CREATED,MISSION_DELETED,MISSION_VALIDATED,MISSION_REJECTED", label: "⚔️ Missions" },
    { value: "BONUS_PURCHASED,BONUS_CANCELLED", label: "🔮 Bonus" },
    { value: "POLL_CREATED,POLL_CLOSED,POLL_DELETED,POLL_CREATOR_ROLE_ACQUIRED", label: "📊 Sondages & Micro" },
    { value: "MEMBER_PURGED,MEMBER_BANNED,MEMBER_ARCHIVED,MEMBER_LEFT,WEBHOOK_MEMBER_ADD,WEBHOOK_MEMBER_REMOVE,PLATFORM_ARRIVAL,PLATFORM_DEPARTURE,PROFILE_ARCHIVED,PROFILE_REACTIVATED,MEMBER_PSEUDO_UPDATE,MEMBER_ANKAMA_ID_UPDATE", label: "🔄 Mouvements" },
    { value: "CONFIG_UPDATED,SETTINGS_UPDATED", label: "⚙️ Configuration" },
    { value: "ADMIN_FULL_DENIED,SECURITY_ALERT", label: "🛡️ Sécurité" },
    { value: "USER_GDPR_DELETE", label: "🗑️ Suppressions RGPD" },
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
    description?: string;
    reason?: string;
    fileName?: string;
    missionTitle?: string;
    scores?: any[];
    // GDPR
    discordId?: string;
    guildName?: string;
    message?: string;
};

// ... (inside component render)

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

/**
 * Résout une cible de log en libellé lisible.
 * Priorité : surnom sur le serveur Discord / pseudo Dofus / compte Discord / description.
 * Si le surnom serveur est différent du nom de compte, retourne les deux pour clarté absolue.
 */
function formatTargetLabel(targetId: string | null, meta: AuditMetadata | null): { primary: string; secondary?: string } {
    const m = (meta || {}) as any;
    const serverName = m.serverNickname || m.guildNickname || m.pseudoDofus || m.displayName;
    const accountTag = m.username || m.submitterName;
    
    if (serverName && accountTag && serverName !== accountTag && `@${accountTag}` !== serverName) {
        return { primary: String(serverName), secondary: `@${accountTag}` };
    }
    if (serverName) return { primary: String(serverName) };
    if (accountTag) return { primary: String(accountTag) };
    if (m.description) return { primary: String(m.description) };
    if (targetId && targetId.length > 8) {
        return { primary: `Membre Discord (ID ${targetId.slice(0, 4)}…${targetId.slice(-4)})` };
    }
    return { primary: targetId || "Membre Discord" };
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
                    <div key={idx} className="bg-elevated/50 rounded-lg p-3 border border-border">
                        <div className="text-xs text-muted-foreground mb-2">
                            Rôle: <span className="font-semibold text-foreground">{roleName}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {change.added.map((perm, i) => (
                                <Badge key={`add-${i}`} variant="outline" className="bg-success/10 text-success border-success/30 text-xs">
                                    <Plus className="w-3 h-3 mr-1" />
                                    {perm.label}
                                    <span className="ml-1 text-success/60 text-caption">({perm.module})</span>
                                </Badge>
                            ))}
                            {change.removed.map((perm, i) => (
                                <Badge key={`rem-${i}`} variant="outline" className="bg-danger/10 text-danger border-danger/30 text-xs">
                                    <Minus className="w-3 h-3 mr-1" />
                                    {perm.label}
                                    <span className="ml-1 text-danger/60 text-caption">({perm.module})</span>
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
    const [actorFilter, setActorFilter] = useState("");
    const [debouncedActor, setDebouncedActor] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Debounce actor filter
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedActor(actorFilter);
        }, 300);
        return () => clearTimeout(timer);
    }, [actorFilter]);

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
            if (debouncedActor) {
                params.set("actor", debouncedActor);
            }
            if (dateFrom) {
                params.set("dateFrom", dateFrom);
            }
            if (dateTo) {
                params.set("dateTo", dateTo);
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
    }, [guildId, page, actionFilter, debouncedSearch, debouncedActor, dateFrom, dateTo]);

    useEffect(() => {
        // Skip initial fetch since we have initialLogs
        if (page === 1 && actionFilter === "all" && !debouncedSearch && !debouncedActor && !dateFrom && !dateTo) {
            return;
        }
        fetchLogs();
    }, [page, actionFilter, debouncedSearch, debouncedActor, dateFrom, dateTo, fetchLogs]);

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [actionFilter, debouncedSearch, debouncedActor, dateFrom, dateTo]);

    const clearFilters = () => {
        setActionFilter("all");
        setSearchQuery("");
        setDebouncedSearch("");
        setActorFilter("");
        setDebouncedActor("");
        setDateFrom("");
        setDateTo("");
        setPage(1);
    };

    const hasActiveFilters = actionFilter !== "all" || debouncedSearch || debouncedActor || dateFrom || dateTo;

    return (
        <Card className="bg-surface/60 border-border">
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
            <div className="overflow-x-auto no-scrollbar border-b border-border">
                <div className="px-6 py-3 flex items-center gap-3 min-w-max">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Filtres</span>
                    </div>

                    <Select value={actionFilter} onValueChange={setActionFilter}>
                        <SelectTrigger className="w-[180px] h-8 text-xs bg-elevated border-border">
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
                        <input
                            type="text"
                            placeholder="Mot-clé..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="h-8 w-[140px] pl-7 pr-2 rounded-md border border-border bg-elevated text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                        />
                    </div>

                    <div className="relative">
                        <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Acteur..."
                            value={actorFilter}
                            onChange={e => setActorFilter(e.target.value)}
                            className="h-8 w-[140px] pl-7 pr-2 rounded-md border border-border bg-elevated text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="h-8 w-[140px] px-2 rounded-md border border-border bg-elevated text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-white/20 transition-all [color-scheme:dark]"
                        />
                        <span className="text-xs text-muted-foreground">→</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="h-8 w-[140px] px-2 rounded-md border border-border bg-elevated text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-white/20 transition-all [color-scheme:dark]"
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

                    <div className="flex items-center gap-2 ml-4">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
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
            </div>

            <CardContent className="pt-4">
                {loading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-16 bg-elevated/30 rounded-lg animate-pulse" />
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
                                <div key={log.id} className="relative pl-6 border-l-2 border-border pb-4 last:pb-0">
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
                                                    className={ACTION_COLORS[log.action] || "bg-muted/20 text-muted-foreground"}
                                                >
                                                    {ACTION_LABELS[log.action] || log.action}
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-muted-foreground mt-1">
                                                {log.targetType === "PERMISSION" && "Modification des permissions RBAC"}
                                                {log.targetType === "ROLE" && "Modification d'un rôle Discord"}
                                                {log.targetType === "CONFIG" && "Modification de la configuration"}
                                                {log.targetType === "CHANNEL" && "Modification d'un canal"}
                                                {log.targetType === "ACCESS_ATTEMPT" && (
                                                    <span className="text-danger">
                                                        Tentative d'accès non autorisé à <code className="bg-danger/30 px-1 rounded">{log.targetId}</code>
                                                    </span>
                                                )}
                                                {log.targetType === "PROFILE" && (() => {
                                                    const labelInfo = formatTargetLabel(log.targetId, log.metadata);
                                                    return (
                                                        <div className="space-y-1 mt-1">
                                                            <div className="flex items-center gap-2 flex-wrap text-sm">
                                                                <span className="text-muted-foreground">
                                                                    {log.action === "PROFILE_ARCHIVED"
                                                                        ? "Archivage du profil de"
                                                                        : log.action === "PROFILE_REACTIVATED"
                                                                        ? "Réactivation du profil de"
                                                                        : log.action === "WEBHOOK_MEMBER_ADD"
                                                                        ? "Arrivée Discord de"
                                                                        : log.action === "WEBHOOK_MEMBER_REMOVE"
                                                                        ? "Départ Discord de"
                                                                        : log.action === "WEBHOOK_MEMBER_UPDATE"
                                                                        ? "Événement Discord sur"
                                                                        : "Profil de"}
                                                                </span>
                                                                <span className="font-bold text-foreground">
                                                                    {labelInfo.primary}
                                                                </span>
                                                                {labelInfo.secondary && (
                                                                    <span className="text-xs text-muted-foreground font-normal">
                                                                        ({labelInfo.secondary})
                                                                    </span>
                                                                )}
                                                                
                                                                {(metadata as any).source && (
                                                                    <Badge variant="outline" className="text-caption px-1.5 py-0 h-4 font-black uppercase tracking-widest bg-info/10 text-info border-info/20">
                                                                        {(metadata as any).source === "discord_button" ? "Discord" : "Dashboard"}
                                                                    </Badge>
                                                                )}
                                                                {(metadata as any).reason && (
                                                                    <span className="text-xs opacity-70 italic">({(metadata as any).reason})</span>
                                                                )}
                                                            </div>

                                                            {(metadata as any).changeDetail && (
                                                                <div className="text-xs text-info font-medium bg-info/10 px-2 py-0.5 rounded inline-block border border-info/20">
                                                                    {(metadata as any).changeDetail}
                                                                </div>
                                                            )}

                                                            {(metadata as any).points !== undefined && (
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-caption font-black text-success flex items-center gap-1">
                                                                        <Plus className="w-2.5 h-2.5" /> {(metadata as any).points} Points Succès
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                                {log.targetType === "USER" && log.action === "USER_GDPR_DELETE" && (
                                                    <span className="text-danger">
                                                        Compte supprimé (RGPD)
                                                        {metadata.discordId && (
                                                             <code className="ml-1.5 bg-danger/30 px-1.5 py-0.5 rounded text-caption font-mono">
                                                                Discord #{metadata.discordId}
                                                            </code>
                                                        )}
                                                    </span>
                                                )}
                                                {log.targetType === "CONTENT_SAFETY" && (
                                                    <div className="text-danger font-medium space-y-1">
                                                        <div>{metadata.description || "Alerte de sécurité"}</div>
                                                        {metadata.missionTitle && (
                                                            <div className="text-xs opacity-80">Mission : {metadata.missionTitle}</div>
                                                        )}
                                                        {metadata.fileName && (
                                                            <div className="text-xs opacity-80">Fichier : {metadata.fileName}</div>
                                                        )}
                                                        {metadata.reason && (
                                                            <div className="text-xs mt-1 bg-danger/30 p-1.5 rounded border border-danger/20">
                                                                Raison : {metadata.reason}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                {log.targetType === "MISSION" && (
                                                    <div className="space-y-1.5 mt-1">
                                                        <div className="flex items-center gap-2 flex-wrap text-sm">
                                                            <span className="font-bold text-foreground italic">
                                                                {(metadata as any).missionTitle || "Mission"}
                                                            </span>
                                                            <span className="text-muted-foreground">pour</span>
                                                            <span className="font-bold text-foreground">
                                                                {(metadata as any).submitterName || "un membre"}
                                                            </span>
                                                            
                                                            {(metadata as any).source && (
                                                                <Badge variant="outline" className={cn(
                                                                    "text-caption px-1.5 py-0 h-4 font-black uppercase tracking-widest",
                                                                    (metadata as any).source === "discord_button" 
                                                                        ? "bg-info/10 text-info border-info/20" 
                                                                        : "bg-info/10 text-info border-info/20"
                                                                )}>
                                                                    {(metadata as any).source === "discord_button" ? "Discord" : "Dashboard"}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        
                                                        {log.action === "MISSION_VALIDATED" && (
                                                            <div className="flex items-center gap-3">
                                                                {(metadata as any).xpReward > 0 && (
                                                                    <span className="text-caption font-black text-success flex items-center gap-1">
                                                                        <Plus className="w-2.5 h-2.5" /> {(metadata as any).xpReward} XP
                                                                    </span>
                                                                )}
                                                                {(metadata as any).guildatonsReward > 0 && (
                                                                    <span className="text-caption font-black text-warning flex items-center gap-1">
                                                                        <Plus className="w-2.5 h-2.5" /> {(metadata as any).guildatonsReward} Guildatons
                                                                    </span>
                                                                )}
                                                                {(metadata as any).helpersCount > 0 && (
                                                                    <span className="text-caption font-black text-info flex items-center gap-1">
                                                                        <Plus className="w-2.5 h-2.5" /> {(metadata as any).helpersCount} Helpers
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {log.targetType === "GUILD" && (
                                                    <span className="text-sm">
                                                        {(metadata as any).bonusName && (
                                                            <span className="font-medium text-info">{(metadata as any).bonusName}</span>
                                                        )}
                                                        {(metadata as any).cost && (
                                                            <span className="text-xs opacity-70 ml-2">{(metadata as any).cost} Guildatons</span>
                                                        )}
                                                        {(metadata as any).field === "bonusNotifyChannelId" && (
                                                            <span className="text-xs opacity-70">Canal de notification bonus mis à jour</span>
                                                        )}
                                                    </span>
                                                )}
                                            </div>

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
