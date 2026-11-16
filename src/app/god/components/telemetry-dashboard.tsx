"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    Activity,
    CalendarClock,
    Copy,
    Cpu,
    Download,
    ExternalLink,
    Globe,
    Layers,
    RefreshCw,
    Search,
    Zap,
} from "lucide-react";
import { TelemetryRetentionPanel } from "@/components/telemetry/telemetry-retention-panel";
import { TelemetryPublicPanel } from "@/components/telemetry/telemetry-public-panel";
import { TelemetryProductOverview } from "@/components/telemetry/telemetry-product-overview";
import { TelemetryAdoptionPanel } from "@/components/telemetry/telemetry-adoption-panel";
import { cn } from "@/lib/utils";
import {
    exportTelemetryDataAction,
    getTelemetryLiveEvents,
    getTelemetryStats,
} from "@/server/actions/telemetry-actions";
import { getProductStats } from "@/server/actions/telemetry-product-actions";
import { getPublicStats } from "@/server/actions/telemetry-public-actions";
import { classifyTelemetrySurface, type TelemetrySurface } from "@/lib/telemetry/surface";
import { toast } from "sonner";

type TelemetryStatsType = Awaited<ReturnType<typeof getTelemetryStats>>;
type ProductStatsType = Awaited<ReturnType<typeof getProductStats>>;
type PublicStatsType = Awaited<ReturnType<typeof getPublicStats>>;
type TelemetryTab = "live" | "adoption" | "retention" | "funnel" | "public";

type LiveEvent = {
    id: string;
    userId: string;
    userName: string;
    guildId: string | null;
    guildName: string;
    path: string;
    surface: TelemetrySurface;
    eventType: string;
    elementId: string | null;
    details: Record<string, string | number | boolean>;
    createdAt: string;
};

const AUTO_REFRESH_SECONDS = 30;
const LIVE_PAGE_SIZE = 50;

const SURFACE_LABEL: Record<TelemetrySurface, string> = {
    ADMIN: "Admin",
    MEMBER: "Membre",
    GOD: "God",
    PUBLIC: "Public",
};

const SURFACE_CLASS: Record<TelemetrySurface, string> = {
    ADMIN: "border-warning/20 bg-warning/10 text-warning",
    MEMBER: "border-success/20 bg-success/10 text-success",
    GOD: "border-accent/20 bg-accent-soft text-accent",
    PUBLIC: "border-border bg-surface text-muted-foreground",
};

function formatDateTime(iso: string): string {
    return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "Europe/Paris",
    }).format(new Date(iso));
}

function isInternalPath(path: string): boolean {
    return path.startsWith("/") && !path.startsWith("/api") && !path.startsWith("/god");
}

function toLiveEvent(event: TelemetryStatsType["liveEvents"][number]): LiveEvent {
    return {
        ...event,
        surface: classifyTelemetrySurface(event.path),
    };
}

export function TelemetryDashboard({
    initialStats,
    initialProduct,
    initialPublic,
}: {
    initialStats: TelemetryStatsType;
    initialProduct: ProductStatsType | null;
    initialPublic: PublicStatsType | null;
}) {
    const [stats, setStats] = useState<TelemetryStatsType>(initialStats);
    const [selectedGuildId, setSelectedGuildId] = useState("all");
    const [telemetryTab, setTelemetryTab] = useState<TelemetryTab>("live");
    const [isAutoRefresh, setIsAutoRefresh] = useState(true);
    const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);
    const [isPending, setIsPending] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [surfaceFilter, setSurfaceFilter] = useState<"ALL" | TelemetrySurface>("ALL");
    const [eventTypeFilter, setEventTypeFilter] = useState<"ALL" | "PAGE_VIEW" | "INTERACTION">("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [liveEvents, setLiveEvents] = useState<LiveEvent[]>(() =>
        (initialStats.liveEvents ?? []).map(toLiveEvent),
    );
    const [liveCursor, setLiveCursor] = useState<string | null>(null);
    const [liveLoading, setLiveLoading] = useState(false);
    const [liveError, setLiveError] = useState<string | null>(null);
    const [copiedPath, setCopiedPath] = useState<string | null>(null);
    const aggregateLoadingRef = useRef(false);
    const liveLoadingRef = useRef(false);

    const refreshAggregates = useCallback(async (overrideGuildId?: string) => {
        if (aggregateLoadingRef.current) return;
        aggregateLoadingRef.current = true;
        setIsPending(true);
        try {
            const target = overrideGuildId !== undefined ? overrideGuildId : selectedGuildId;
            const next = await getTelemetryStats(target === "all" ? undefined : target);
            setStats(next);
        } catch {
            toast.error("Impossible de charger les agrégats de télémétrie");
        } finally {
            aggregateLoadingRef.current = false;
            setIsPending(false);
        }
    }, [selectedGuildId]);

    const fetchLive = useCallback(async (reset: boolean, cursor: string | null, overrideGuildId?: string) => {
        if (liveLoadingRef.current) return;
        liveLoadingRef.current = true;
        setLiveLoading(true);
        try {
            const target = overrideGuildId !== undefined ? overrideGuildId : selectedGuildId;
            const result = await getTelemetryLiveEvents({
                guildId: target === "all" ? null : target,
                surface: surfaceFilter === "ALL" ? undefined : surfaceFilter,
                eventType: eventTypeFilter === "ALL" ? undefined : eventTypeFilter,
                query: searchQuery.trim() || undefined,
                cursor: reset ? null : cursor,
                limit: LIVE_PAGE_SIZE,
            });
            if (!result.success) {
                setLiveError(result.error ?? "Erreur de chargement du flux");
                return;
            }
            const data = result.data;
            if (!data) {
                setLiveError("Erreur de chargement du flux");
                return;
            }
            setLiveError(null);
            setLiveEvents((previous) => (reset ? data.events : [...previous, ...data.events]));
            setLiveCursor(data.nextCursor);
        } catch {
            setLiveError("Erreur de chargement du flux");
        } finally {
            liveLoadingRef.current = false;
            setLiveLoading(false);
        }
    }, [selectedGuildId, surfaceFilter, eventTypeFilter, searchQuery]);

    const handleGuildChange = (guildId: string) => {
        setSelectedGuildId(guildId);
    };

    const handleExport = async (format: "json" | "csv") => {
        setIsExporting(true);
        try {
            const result = await exportTelemetryDataAction(
                selectedGuildId === "all" ? undefined : selectedGuildId,
                format,
            );
            if (result.success && result.data) {
                const blob = new Blob([result.data], { type: result.mimeType });
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = result.fileName;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                URL.revokeObjectURL(url);
                toast.success(`Export ${format.toUpperCase()} téléchargé`);
            } else {
                toast.error("Échec de l'export de télémétrie");
            }
        } catch {
            toast.error("Erreur lors de l'export");
        } finally {
            setIsExporting(false);
        }
    };

    const handleCopy = async (path: string) => {
        try {
            await navigator.clipboard.writeText(path);
            setCopiedPath(path);
            setTimeout(() => setCopiedPath(null), 1500);
            toast.success("Chemin copié");
        } catch {
            toast.error("Copie impossible");
        }
    };

    // Agrégats : un seul chargement, rejoué au changement de guilde ou à la demande.
    useEffect(() => {
        void refreshAggregates();
    }, [refreshAggregates]);

    // Flux : filtré côté serveur (guilde, surface, type, recherche) avec un léger debounce.
    useEffect(() => {
        const timer = setTimeout(() => {
            void fetchLive(true, null);
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchLive]);

    // Compte à rebours du rafraîchissement automatique (le flux seulement).
    useEffect(() => {
        if (!isAutoRefresh) return;
        const interval = setInterval(() => {
            setCountdown((previous) => (previous <= 1 ? 0 : previous - 1));
        }, 1000);
        return () => clearInterval(interval);
    }, [isAutoRefresh]);

    // À zéro, on recharge la première page du flux et on relance le compte à rebours.
    useEffect(() => {
        if (!isAutoRefresh || countdown > 0) return;
        void fetchLive(true, null);
        setCountdown(AUTO_REFRESH_SECONDS);
    }, [countdown, isAutoRefresh, fetchLive]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
                        <Cpu className="h-5 w-5 text-accent" />
                        Télémétrie & usage
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Qui va où, par guilde et par surface — chemin complet, sans empreinte.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                        <Globe className="h-4 w-4 shrink-0 text-accent" />
                        <span className="sr-only">Guilde</span>
                        <select
                            value={selectedGuildId}
                            onChange={(event) => handleGuildChange(event.target.value)}
                            className="min-w-0 max-w-[240px] bg-transparent text-sm text-foreground focus:outline-none"
                        >
                            <option value="all">Toutes les guildes</option>
                            {(stats.availableGuilds ?? []).map((guild) => (
                                <option key={guild.id} value={guild.id}>
                                    {guild.name}{guild.discordGuildId ? ` · ${guild.discordGuildId.slice(-6)}` : ""}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
                        <button
                            type="button"
                            onClick={() => handleExport("json")}
                            disabled={isExporting}
                            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-elevated hover:text-foreground disabled:opacity-50"
                        >
                            <Download className="h-3.5 w-3.5" />
                            JSON
                        </button>
                        <button
                            type="button"
                            onClick={() => handleExport("csv")}
                            disabled={isExporting}
                            className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-elevated hover:text-foreground disabled:opacity-50"
                        >
                            CSV
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsAutoRefresh((previous) => !previous)}
                        className={cn(
                            "rounded-lg border px-3 py-2 text-sm",
                            isAutoRefresh
                                ? "border-accent/30 bg-accent-soft text-accent"
                                : "border-border bg-surface text-muted-foreground hover:text-foreground",
                        )}
                        aria-pressed={isAutoRefresh}
                    >
                        {isAutoRefresh ? `Auto ${countdown} s` : "Auto désactivé"}
                    </button>
                    <button
                        type="button"
                        onClick={() => { void refreshAggregates(); void fetchLive(true, null); }}
                        disabled={isPending}
                        className="rounded-lg border border-border bg-surface p-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                        aria-label="Rafraîchir les données"
                    >
                        <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                    { label: "Événements", value: stats.summary.totalEvents },
                    { label: "Pages vues (24 h)", value: stats.summary.pageViews24h },
                    { label: "Interactions (24 h)", value: stats.summary.interactions24h },
                    { label: "Membres (24 h)", value: stats.summary.uniqueUsers24h },
                    { label: "Membres (7 j)", value: stats.summary.uniqueUsers7d },
                    ...(selectedGuildId === "all"
                        ? [{ label: "Guildes actives (7 j)", value: stats.summary.guildsActive7d }]
                        : []),
                    { label: "Interactions / pages vues", value: `${stats.summary.engagementRatio} %` },
                    { label: "Actions / membre (24 h)", value: stats.summary.averageActionsPerUser },
                ].map((card) => (
                    <div key={card.label} className="rounded-xl border border-border bg-surface p-3">
                        <p className="text-xs text-muted-foreground">{card.label}</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">
                            {typeof card.value === "number" ? card.value.toLocaleString("fr-FR") : card.value}
                        </p>
                    </div>
                ))}
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-border pb-1">
                {[
                    { id: "live", label: "Usage du site", icon: Activity, count: liveEvents.length },
                    { id: "adoption", label: "Adoption par module", icon: Layers, count: initialProduct ? initialProduct.adoption.modules.length : null },
                    { id: "retention", label: "Rétention & relances", icon: CalendarClock, count: initialProduct ? initialProduct.freshness.guilds.filter((guild) => guild.status !== "ACTIVE").length : null },
                    { id: "funnel", label: "Entonnoir d'activation", icon: Zap, count: null },
                    { id: "public", label: "Site public", icon: Globe, count: null },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setTelemetryTab(tab.id as TelemetryTab)}
                        className={cn(
                            "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm",
                            telemetryTab === tab.id
                                ? "bg-accent-soft text-accent"
                                : "text-muted-foreground hover:bg-surface hover:text-foreground",
                        )}
                    >
                        <tab.icon className="h-4 w-4" />
                        {tab.label}
                        {tab.count !== null && (
                            <span className="rounded-md bg-surface px-1.5 py-0.5 text-xs text-muted-foreground">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            <TelemetryProductOverview product={initialProduct} />
            {telemetryTab === "live" && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-surface p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Activity className="h-4 w-4 text-accent" />
                                Flux d'activité
                            </h3>
                            <span className="text-xs text-muted-foreground">{liveEvents.length} événement(s)</span>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px_170px]">
                            <label className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <span className="sr-only">Rechercher</span>
                                <input
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Membre, chemin, clic, guilde…"
                                    className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                                />
                            </label>
                            <select
                                value={surfaceFilter}
                                onChange={(event) => setSurfaceFilter(event.target.value as "ALL" | TelemetrySurface)}
                                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                                aria-label="Filtrer par surface"
                            >
                                <option value="ALL">Toutes les surfaces</option>
                                <option value="ADMIN">Admin</option>
                                <option value="MEMBER">Membre</option>
                                <option value="GOD">God</option>
                                <option value="PUBLIC">Public</option>
                            </select>
                            <select
                                value={eventTypeFilter}
                                onChange={(event) => setEventTypeFilter(event.target.value as "ALL" | "PAGE_VIEW" | "INTERACTION")}
                                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                                aria-label="Filtrer par type"
                            >
                                <option value="ALL">Tous les types</option>
                                <option value="PAGE_VIEW">Pages vues</option>
                                <option value="INTERACTION">Interactions</option>
                            </select>
                        </div>
                    </div>

                    {liveError && (
                        <p className="rounded-lg border border-danger/20 bg-danger/10 p-3 text-sm text-danger">{liveError}</p>
                    )}

                    <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                        {liveEvents.length === 0 && !liveLoading ? (
                            <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted-foreground">
                                Aucun événement pour ces filtres.
                            </p>
                        ) : (
                            <>
                                {liveEvents.map((event) => (
                                    <article key={event.id} className="rounded-xl border border-border bg-surface p-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-medium text-foreground">{event.userName}</span>
                                            <span className="text-xs text-muted-foreground">{event.guildName}</span>
                                            <span className={cn("rounded-md border px-1.5 py-0.5 text-xs", SURFACE_CLASS[event.surface])}>
                                                {SURFACE_LABEL[event.surface]}
                                            </span>
                                            <span className="rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                                                {event.eventType === "INTERACTION" ? "Interaction" : "Visite"}
                                            </span>
                                            <time className="ml-auto text-xs text-muted-foreground" dateTime={event.createdAt}>
                                                {formatDateTime(event.createdAt)}
                                            </time>
                                        </div>
                                        <div className="mt-2 min-w-0 space-y-1">
                                            {event.eventType === "INTERACTION" && event.elementId && (
                                                <p className="text-xs text-muted-foreground">
                                                    Clic sur <code className="break-all font-mono text-foreground">{event.elementId}</code>
                                                </p>
                                            )}
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                                                <code className="min-w-0 break-all rounded-md bg-background px-2 py-1 font-mono text-xs text-foreground" title={event.path}>
                                                    {event.path}
                                                </code>
                                                <div className="flex shrink-0 items-center gap-1">
                                                    {isInternalPath(event.path) && (
                                                        <a
                                                            href={event.path}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
                                                            aria-label="Ouvrir la page"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </a>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(event.path)}
                                                        className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
                                                        aria-label="Copier le chemin"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                    </button>
                                                    {copiedPath === event.path && <span className="text-xs text-success">Copié</span>}
                                                </div>
                                            </div>
                                            {event.details && typeof event.details === "object" && typeof (event.details as Record<string, unknown>).language === "string" && (
                                                <p className="text-xs text-muted-foreground">
                                                    Langue : {(event.details as Record<string, string>).language}
                                                </p>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </>
                        )}
                    </div>

                    {liveLoading && <p className="text-sm text-muted-foreground">Chargement du flux…</p>}
                    {liveCursor && (
                        <button
                            type="button"
                            onClick={() => { void fetchLive(false, liveCursor); }}
                            disabled={liveLoading}
                            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-elevated disabled:opacity-50"
                        >
                            Charger plus
                        </button>
                    )}

                    <AdminPagesTable pages={stats.adminPages ?? []} />
                </div>
            )}

            {telemetryTab === "funnel" && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-surface p-4">
                        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Zap className="h-4 w-4 text-accent" />
                            Entonnoir d'activation
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Chaque marche mesure une population différente (comptes, profils configurés, Dofus suivis,
                            membres actifs) : un écart est signalé « population non incluse ».
                        </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {(stats.activationFunnel ?? []).map((step, index) => (
                            <div key={step.step} className="rounded-xl border border-border bg-surface p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-xs font-semibold text-accent">
                                        {index + 1}
                                    </span>
                                    {index > 0 && (step.exceedsPrevious ? (
                                        <span className="rounded-md border border-warning/20 bg-warning/10 px-2 py-0.5 text-xs text-warning">
                                            Population non incluse
                                        </span>
                                    ) : (
                                        <span className="rounded-md border border-danger/20 bg-danger/10 px-2 py-0.5 text-xs text-danger">
                                            -{step.dropoffRate} % de perte
                                        </span>
                                    ))}
                                </div>
                                <p className="mt-3 text-xs text-muted-foreground">{step.step}</p>
                                <p className="mt-1 text-2xl font-semibold text-foreground">
                                    {step.count.toLocaleString("fr-FR")}
                                </p>
                                <div className="mt-3">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>Part de la 1re marche</span>
                                        <span className="text-foreground">{step.conversionRate} %</span>
                                    </div>
                                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
                                        <div
                                            className="h-full rounded-full bg-accent"
                                            style={{ width: `${Math.min(100, Math.max(0, step.conversionRate))}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {telemetryTab === "adoption" && <TelemetryAdoptionPanel product={initialProduct} />}
            {telemetryTab === "retention" && <TelemetryRetentionPanel product={initialProduct} />}
            {telemetryTab === "public" && <TelemetryPublicPanel stats={initialPublic} />}
        </div>
    );
}

function AdminPagesTable({ pages }: { pages: Array<{ path: string; count: number; uniqueUsers: number }> }) {
    if (pages.length === 0) return null;
    return (
        <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="text-sm font-medium text-foreground">Pages admin les plus visitées (7 j)</h3>
            <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-border text-xs text-muted-foreground">
                            <th className="py-2 pr-3 font-medium">Page</th>
                            <th className="py-2 pr-3 text-right font-medium">Vues</th>
                            <th className="py-2 text-right font-medium">Membres</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pages.map((page) => (
                            <tr key={page.path} className="border-b border-border/60 last:border-0">
                                <td className="py-2 pr-3">
                                    <code className="break-all font-mono text-xs text-foreground">{page.path}</code>
                                </td>
                                <td className="py-2 pr-3 text-right text-muted-foreground">{page.count}</td>
                                <td className="py-2 text-right text-muted-foreground">{page.uniqueUsers}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
