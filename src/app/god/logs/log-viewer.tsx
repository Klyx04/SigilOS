"use client";

/**
 * Journal unifié de la console God — **un seul** viewer (G6 · G11 · A11).
 *
 * Avant : deux écrans (`/god?tab=security`, 200 lignes brutes, et `/god/logs`,
 * 50 lignes) affichaient le **même** `AuditLog`, avec deux listes de filtres
 * différentes et une pagination « Page 1 / 2 ‹ › ». Ce composant est la **seule**
 * table du journal : il sert l'onglet **plateforme** (`isGodLog: true`) et
 * l'onglet **guilde** (`isGodLog: false`, filtrable par guilde).
 *
 * G6 — filtres **en base** (action, catégorie, période, recherche, guilde),
 * pagination **numérotée** + « par page », regroupement par **jour** (UTC), et
 * compteur par **famille** mesuré côté serveur (jamais déduit de la page affichée).
 * A11 — la vue d'un journal de guilde est **en lecture seule** : aucune action God
 * n'y vit (ce composant n'écrit rien, il n'appelle que la route de lecture).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
    Building2,
    Filter,
    History,
    RefreshCw,
    Search,
    ShieldAlert,
    Settings2,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { AUDIT_ACTION_FILTER_OPTIONS, AUDIT_CATEGORY_FILTER_OPTIONS } from "@/lib/audit-taxonomy";
import {
    AUDIT_LOG_PAGE_SIZES,
    AUDIT_LOG_PERIODS,
    DEFAULT_AUDIT_LOG_PAGE_SIZE,
    DEFAULT_AUDIT_LOG_PERIOD,
    auditLogPeriodStart,
    groupLogsByDay,
    totalPagesOf,
    type AuditLogPeriod,
} from "@/lib/audit-log-view";
import { GodEmptyState, GodPagination, GodLoadingSkeleton } from "../ui";

export interface GodLogRow {
    id: string;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string | null;
    metadata: unknown;
    createdAt: string | Date;
    guild?: { name: string } | null;
}

interface LogViewerProps {
    /** Périmètre **fixé par l'onglet** : jamais choisi librement par le client. */
    scope: "platform" | "guild";
    initialLogs: GodLogRow[];
    initialTotal: number;
    initialSecurityCount: number;
    /** Guildes **internes** (id + nom) — requis pour le filtre de l'onglet guilde. */
    guilds?: { id: string; name: string }[];
    /** Guilde déjà sélectionnée (arrivée depuis une fiche guilde). */
    initialGuildConfigId?: string;
}

const ACTION_LABELS: Record<string, string> = {
    WEBHOOK_MEMBER_ADD: "Arrivée membre",
    WEBHOOK_MEMBER_REMOVE: "Départ membre",
    WEBHOOK_MEMBER_UPDATE: "Mise à jour membre",
    SECURITY_ALERT: "Alerte de sécurité",
    ADMIN_FULL_DENIED: "Accès admin refusé",
    BETA_ACCESS_ATTEMPT: "Code bêta invalide",
    GOD_AUTH_BYPASS: "Contournement God",
    GOD_DASHBOARD_ACCESS: "Accès dashboard God (historique)",
    CONFIG_UPDATED: "Configuration modifiée",
    SETTINGS_UPDATED: "Réglages modifiés",
    RBAC_UPDATE: "Permissions modifiées",
};

function actionLabel(action: string): string {
    return ACTION_LABELS[action] ?? action.replace(/_/g, " ").toLowerCase();
}

function actionTone(action: string): string {
    if (action === "SECURITY_ALERT" || action === "USER_GDPR_DELETE") return "border-danger/40 text-danger";
    if (action === "ADMIN_FULL_DENIED" || action === "BETA_ACCESS_ATTEMPT") return "border-warning/40 text-warning";
    if (action.startsWith("GOD_")) return "border-border text-info";
    return "border-border text-muted-foreground";
}

/** Métadonnées → une ligne lisible et **bornée** (jamais un JSON brut tronqué). */
function detailOf(metadata: unknown, maxLength = 90): string {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
    const parts: string[] = [];
    for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
        if (value === null || value === undefined || key === "timestamp" || key === "source") continue;
        parts.push(`${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
        if (parts.join(" · ").length > maxLength) break;
    }
    const text = parts.join(" · ");
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}


export function LogViewer({
    scope,
    initialLogs,
    initialTotal,
    initialSecurityCount,
    guilds = [],
    initialGuildConfigId,
}: LogViewerProps) {
    const [logs, setLogs] = useState<GodLogRow[]>(initialLogs);
    const [total, setTotal] = useState(initialTotal);
    const [securityCount, setSecurityCount] = useState(initialSecurityCount);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(DEFAULT_AUDIT_LOG_PAGE_SIZE);
    const [actionFilter, setActionFilter] = useState("all");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [period, setPeriod] = useState<AuditLogPeriod>(DEFAULT_AUDIT_LOG_PERIOD);
    const [guildConfigId, setGuildConfigId] = useState(initialGuildConfigId ?? "");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const totalPages = totalPagesOf(total, pageSize);
    const firstRun = useRef(true);
    const now = useMemo(() => new Date(), []);

    // 🔎 Recherche : 300 ms de debounce — jamais une requête par frappe.
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Un filtre change ⇒ retour page 1 (jamais une page 7 devenue vide).
    useEffect(() => {
        setPage(1);
    }, [actionFilter, categoryFilter, period, guildConfigId, debouncedSearch, pageSize]);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pageSize),
                scope,
            });
            if (actionFilter !== "all") params.set("action", actionFilter);
            if (categoryFilter !== "all") params.set("category", categoryFilter);
            if (debouncedSearch) params.set("search", debouncedSearch);
            if (scope === "guild" && guildConfigId) params.set("guildConfigId", guildConfigId);
            const dateFrom = auditLogPeriodStart(period);
            if (dateFrom) params.set("dateFrom", dateFrom.toISOString());

            const response = await fetch(`/api/god/audit-logs?${params.toString()}`);
            if (!response.ok) {
                // « Journal indisponible » ≠ « accès refusé » : le refus (403) est un
                // état distinct, jamais un écran vide qui laisserait croire à une absence.
                setError(response.status === 403 ? "Accès refusé à ce journal." : "Journal indisponible (erreur serveur).");
                return;
            }
            const data = await response.json();
            setLogs((data.logs ?? []) as GodLogRow[]);
            setTotal(typeof data.total === "number" ? data.total : 0);
            setSecurityCount(typeof data.securityCount === "number" ? data.securityCount : 0);
        } catch {
            setError("Journal indisponible (réseau).");
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, scope, actionFilter, categoryFilter, debouncedSearch, guildConfigId, period]);

    useEffect(() => {
        // La première page est déjà rendue par le serveur : on ne refetch pas pour rien.
        if (firstRun.current) {
            firstRun.current = false;
            return;
        }
        void fetchLogs();
    }, [fetchLogs]);

    const groups = useMemo(() => groupLogsByDay(logs, (log) => log.createdAt, now), [logs, now]);

    const hasActiveFilters =
        actionFilter !== "all"
        || categoryFilter !== "all"
        || period !== DEFAULT_AUDIT_LOG_PERIOD
        || !!debouncedSearch
        || !!guildConfigId;

    const clearFilters = () => {
        setActionFilter("all");
        setCategoryFilter("all");
        setPeriod(DEFAULT_AUDIT_LOG_PERIOD);
        setSearchQuery("");
        setDebouncedSearch("");
        setGuildConfigId(initialGuildConfigId ?? "");
    };

    const functionalCount = Math.max(total - securityCount, 0);

    return (
        <div className="space-y-4">
            {/* Compteurs par **famille** (G6) — mesurés en base, jamais déduits de la page */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface/40 px-4 py-3">
                <span className="flex items-center gap-2 text-body-sm font-semibold text-foreground">
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span className="tabular-nums">{total}</span> entrée(s)
                </span>
                <span className="flex items-center gap-1.5 text-caption text-danger">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Sécurité <span className="font-bold tabular-nums">{securityCount}</span>
                </span>
                <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
                    <Settings2 className="h-3.5 w-3.5" />
                    Fonctionnel <span className="font-bold tabular-nums">{functionalCount}</span>
                </span>
                {scope === "guild" ? (
                    <span className="text-caption text-muted-foreground">
                        Lecture seule : aucune action God n&apos;est disponible dans le journal d&apos;une guilde.
                    </span>
                ) : null}
            </div>

            {/* Filtres — tout part **en base** (action, catégorie, période, guilde, recherche) */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface/40 p-3">
                <span className="flex items-center gap-2 px-2 text-caption font-semibold uppercase tracking-wider text-muted-foreground">
                    <Filter className="h-4 w-4" /> Filtres
                </span>

                {scope === "guild" && guilds.length > 0 ? (
                    <Select
                        value={guildConfigId || "all"}
                        onValueChange={(value) => setGuildConfigId(value === "all" ? "" : value)}
                    >
                        <SelectTrigger className="h-9 w-[220px] text-caption" aria-label="Filtrer par guilde">
                            <SelectValue placeholder="Guilde" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Toutes les guildes</SelectItem>
                            {guilds.map((guild) => (
                                <SelectItem key={guild.id} value={guild.id}>
                                    {guild.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : null}

                <Select value={period} onValueChange={(value) => setPeriod(value as AuditLogPeriod)}>
                    <SelectTrigger className="h-9 w-[190px] text-caption" aria-label="Période">
                        <SelectValue placeholder="Période" />
                    </SelectTrigger>
                    <SelectContent>
                        {AUDIT_LOG_PERIODS.map((preset) => (
                            <SelectItem key={preset.value} value={preset.value}>
                                {preset.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger className="h-9 w-[200px] text-caption" aria-label="Type d'action">
                        <SelectValue placeholder="Type d'action" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Toutes les actions</SelectItem>
                        {AUDIT_ACTION_FILTER_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9 w-[200px] text-caption" aria-label="Catégorie">
                        <SelectValue placeholder="Catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                        {AUDIT_CATEGORY_FILTER_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Acteur, guilde, action…"
                        aria-label="Rechercher dans le journal"
                        className="h-9 pl-9 text-caption"
                    />
                </div>

                {hasActiveFilters ? (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-caption">
                        <X className="mr-1.5 h-3 w-3" /> Réinitialiser
                    </Button>
                ) : null}

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchLogs()}
                    disabled={loading}
                    className="ml-auto h-9 text-caption"
                >
                    <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} /> Actualiser
                </Button>
            </div>

            {error ? (
                /* Erreur ≠ refus ≠ vide : trois messages distincts (cf. plan §8.3). */
                <div role="alert" className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-body-sm text-danger">
                    {error}
                </div>
            ) : loading ? (
                <GodLoadingSkeleton rows={5} />
            ) : logs.length === 0 ? (
                <GodEmptyState
                    icon={History}
                    title="Aucune entrée sur ce périmètre"
                    description="Élargis la période ou retire un filtre. Rétention : 90 j pour la plateforme, 30 j pour une guilde."
                />
            ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <table className="w-full border-collapse text-left">
                        <thead className="bg-elevated/60">
                            <tr>
                                <th className="px-6 py-3 text-caption font-semibold uppercase tracking-wider text-muted-foreground">Événement</th>
                                <th className="px-6 py-3 text-caption font-semibold uppercase tracking-wider text-muted-foreground">Acteur</th>
                                <th className="px-6 py-3 text-caption font-semibold uppercase tracking-wider text-muted-foreground">Cible / Guilde</th>
                                <th className="px-6 py-3 text-caption font-semibold uppercase tracking-wider text-muted-foreground">Détails</th>
                                <th className="px-6 py-3 text-right text-caption font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                            </tr>
                        </thead>
                        {/* G6 — un `tbody` par **jour** : l'entête de jour reste collée à son groupe */}
                        {groups.map((group) => (
                            <tbody key={group.key}>
                                <tr className="bg-elevated/40">
                                    <td colSpan={5} className="px-6 py-2 text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                        {group.label} · <span className="tabular-nums">{group.rows.length}</span> entrée(s)
                                    </td>
                                </tr>
                                {group.rows.map((log) => (
                                    <tr key={log.id} className="border-t border-border/60 align-top">
                                        <td className="px-6 py-3">
                                            <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-caption font-bold", actionTone(log.action))}>
                                                {actionLabel(log.action)}
                                            </span>
                                            <div className="mt-1 text-caption text-muted-foreground">{log.targetType}</div>
                                        </td>
                                        <td className="px-6 py-3 text-body-sm text-foreground">{log.actorName}</td>
                                        <td className="px-6 py-3">
                                            <span className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
                                                <Building2 className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">{log.guild?.name ?? "Plateforme"}</span>
                                            </span>
                                            {log.targetId ? (
                                                <span className="mt-0.5 block truncate font-mono text-caption text-muted-foreground">{log.targetId}</span>
                                            ) : null}
                                        </td>
                                        <td className="px-6 py-3 text-caption text-muted-foreground">{detailOf(log.metadata) || "—"}</td>
                                        <td className="px-6 py-3 text-right text-caption text-muted-foreground">
                                            <span title={new Date(log.createdAt).toISOString()}>
                                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        ))}
                    </table>
                </div>
            )}

            <GodPagination
                page={page}
                totalPages={totalPages}
                total={total}
                onPageChange={setPage}
                pageSize={pageSize}
                pageSizes={AUDIT_LOG_PAGE_SIZES}
                onPageSizeChange={setPageSize}
                disabled={loading}
            />
        </div>
    );
}

