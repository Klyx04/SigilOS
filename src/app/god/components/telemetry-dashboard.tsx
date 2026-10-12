"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    Activity,
    CalendarClock,
    RefreshCw,
    Search,
    Globe,
    Cpu,
    Download,
    Layers,
    Zap
} from "lucide-react";
import { TelemetryRetentionPanel } from "@/components/telemetry/telemetry-retention-panel";
import { TelemetryPublicPanel } from "@/components/telemetry/telemetry-public-panel";
import { cn } from "@/lib/utils";
import { getTelemetryStats, exportTelemetryDataAction } from "@/server/actions/telemetry-actions";
import { getProductStats } from "@/server/actions/telemetry-product-actions";
import { getPublicStats } from "@/server/actions/telemetry-public-actions";
import { TelemetryProductOverview } from "@/components/telemetry/telemetry-product-overview";
import { TelemetryAdoptionPanel } from "@/components/telemetry/telemetry-adoption-panel";
import { toast } from "sonner";

type TelemetryStatsType = Awaited<ReturnType<typeof getTelemetryStats>>;

/** Mesures produit (D-2bis) — chargées à côté de la télémétrie de navigation. */
type ProductStatsType = Awaited<ReturnType<typeof getProductStats>>;

/** Compteurs anonymes du site public (la partie externe du produit). */
type PublicStatsType = Awaited<ReturnType<typeof getPublicStats>>;

/**
 * Période du rafraîchissement automatique. 30 s et non 5 s : chaque tick relance 12 requêtes
 * d'agrégation (`groupBy` + `findMany`) côté serveur pour un panneau lu par un seul super-admin.
 */
const AUTO_REFRESH_SECONDS = 30;

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
    const [selectedGuildId, setSelectedGuildId] = useState<string>("all");
    const [isAutoRefresh, setIsAutoRefresh] = useState(true);
    const [countdown, setCountdown] = useState(AUTO_REFRESH_SECONDS);
    const [isPending, setIsPending] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [telemetryTab, setTelemetryTab] = useState<"live" | "adoption" | "retention" | "funnel" | "public">("live");
    const isRefreshingRef = useRef(false);

    // Stable refresh function — accepts target guild filter
    const refreshData = useCallback(async (overrideGuildId?: string) => {
        if (isRefreshingRef.current) return;
        isRefreshingRef.current = true;
        setIsPending(true);
        try {
            const targetGuild = overrideGuildId !== undefined ? overrideGuildId : selectedGuildId;
            const filterArg = targetGuild === "all" ? undefined : targetGuild;
            const newStats = await getTelemetryStats(filterArg);
            setStats(newStats);
            setCountdown(AUTO_REFRESH_SECONDS);
        } catch (err) {
            console.error("Refresh failed", err);
        } finally {
            isRefreshingRef.current = false;
            setIsPending(false);
        }
    }, [selectedGuildId]);

    // Handle guild selection change
    const handleGuildChange = (newGuildId: string) => {
        setSelectedGuildId(newGuildId);
        refreshData(newGuildId);
    };

    // Export handler
    const handleExport = async (format: "json" | "csv") => {
        setIsExporting(true);
        try {
            const filterArg = selectedGuildId === "all" ? undefined : selectedGuildId;
            const res = await exportTelemetryDataAction(filterArg, format);
            if (res.success && res.data) {
                const blob = new Blob([res.data], { type: res.mimeType });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = res.fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success(`Export ${format.toUpperCase()} téléchargé avec succès !`);
            } else {
                toast.error("Échec de l'export télémétrie");
            }
        } catch {
            toast.error("Erreur lors de l'export");
        } finally {
            setIsExporting(false);
        }
    };

    // Auto-refresh timer — countdown only, triggers refresh outside render via ref
    useEffect(() => {
        if (!isAutoRefresh) return;

        const interval = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    Promise.resolve().then(() => refreshData());
                    return AUTO_REFRESH_SECONDS;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isAutoRefresh, refreshData]);

    // Filter live events based on search query
    const filteredEvents = stats.liveEvents.filter((e: any) => {
        if (!searchQuery) return true;

        const query = searchQuery.toLowerCase();
        return (
            e.userName.toLowerCase().includes(query) ||
            e.path.toLowerCase().includes(query) ||
            (e.elementId && e.elementId.toLowerCase().includes(query)) ||
            e.eventType.toLowerCase().includes(query)
        );
    });

    return (
        <div className="space-y-10">
            {/* Header / Control Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-white/5">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
                        <Cpu className="w-6 h-6 text-accent" />
                        Télémétrie & Analyse d'usage
                    </h2>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Activité, fréquentation des modules et comportements par guilde
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Guild Filter Dropdown */}
                    <div className="flex items-center gap-2 bg-surface border border-border px-3 py-1.5 rounded-xl">
                        <Globe className="w-4 h-4 text-accent shrink-0" />
                        <select
                            value={selectedGuildId}
                            onChange={(e) => handleGuildChange(e.target.value)}
                            className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer pr-2"
                        >
                            <option value="all">Toutes les Guildes (Global)</option>
                            {stats.availableGuilds?.map((g: any) => (
                                <option key={g.id} value={g.id}>
                                    Guilde: {g.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Export Buttons */}
                    <div className="flex items-center gap-1.5 bg-surface border border-border p-1 rounded-xl">
                        <button
                            onClick={() => handleExport("json")}
                            disabled={isExporting}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-elevated transition-all flex items-center gap-1.5"
                        >
                            <Download className="w-3.5 h-3.5 text-accent" />
                            JSON
                        </button>
                        <button
                            onClick={() => handleExport("csv")}
                            disabled={isExporting}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-elevated transition-all flex items-center gap-1.5"
                        >
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                            CSV
                        </button>
                    </div>

                    {/* Auto-Refresh Toggle */}
                    <button
                        onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                        className={cn(
                            "flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border",
                            isAutoRefresh
                                ? "bg-accent-soft text-accent border-accent/30"
                                : "bg-surface text-muted-foreground border-border hover:text-foreground"
                        )}
                    >
                        <span className={cn(
                            "w-2.5 h-2.5 rounded-full",
                            isAutoRefresh ? "bg-accent" : "bg-muted-foreground/50"
                        )} />
                        {isAutoRefresh ? `Auto : ${countdown}s` : "Auto-Refresh Off"}
                    </button>

                    {/* Manual Refresh Button */}
                    <button
                        onClick={() => refreshData()}
                        disabled={isPending}
                        className="p-2.5 rounded-xl bg-surface border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <RefreshCw className={cn("w-4 h-4 group-hover:rotate-180 transition-all duration-300", isPending && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Sub Tabs Selection */}
            <div className="flex border-b border-border pb-1 gap-2 overflow-x-auto no-scrollbar">
                {[
                    { id: "live", label: "Usage du site", icon: Activity, count: filteredEvents.length },
                    { id: "adoption", label: "Adoption par module", icon: Layers, count: initialProduct ? initialProduct.adoption.modules.length : null },
                    { id: "retention", label: "Rétention & relances", icon: CalendarClock, count: initialProduct ? initialProduct.freshness.guilds.filter((guild) => guild.status !== "ACTIVE").length : null },
                    { id: "funnel", label: "Entonnoir d'activation", icon: Zap, count: null },
                    { id: "public", label: "Site public", icon: Globe, count: null },
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTelemetryTab(t.id as any)}
                        className={cn(
                            "px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-2 whitespace-nowrap",
                            telemetryTab === t.id
                                ? "bg-accent-soft text-accent border-accent/40 shadow-sm"
                                : "bg-transparent text-muted-foreground border-transparent hover:text-foreground hover:bg-surface"
                        )}
                    >
                        <t.icon className="w-3.5 h-3.5" />
                        {t.label}
                        {t.count !== null && (
                            <span className={cn(
                                "text-[10px] font-black px-1.5 py-0.5 rounded-md",
                                telemetryTab === t.id ? "bg-accent text-accent-foreground" : "bg-elevated text-muted-foreground"
                            )}>
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Vue d'ensemble produit (D-2bis) — remplace les 8 cartes « console » */}
            <TelemetryProductOverview product={initialProduct} />


            {/* TAB CONTENT: LIVE FEED */}
            {telemetryTab === "live" && (
                <div className="p-6 rounded-3xl border border-white/5 bg-zinc-950/60 backdrop-blur-md flex flex-col h-[750px] relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-zinc-950/80 to-transparent pointer-events-none z-10" />
                    
                    {/* Header search bar */}
                    <div className="mb-6 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-4 h-4 text-violet-400 animate-pulse" />
                                Flux d'activité Live
                            </h3>
                            <span className="text-caption font-black uppercase text-zinc-600 bg-zinc-900 border border-white/5 px-3 py-1 rounded-full">
                                {filteredEvents.length} événements
                            </span>
                        </div>
                        
                        <div className="relative">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                            <input
                                type="text"
                                placeholder="Rechercher par membre, route, guilde, clic..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/60 border border-white/5 rounded-xl text-xs font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all"
                            />
                        </div>
                    </div>

                    {/* Scrollable Events list */}
                    <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {filteredEvents.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-xs font-bold uppercase tracking-wider py-20 gap-4">
                                <Activity className="w-8 h-8 opacity-20" />
                                Aucun événement trouvé
                            </div>
                        ) : (
                            filteredEvents.map((event: any) => {
                                const isClick = event.eventType === "INTERACTION";
                                return (
                                    <div 
                                        key={event.id} 
                                        className="p-4 rounded-2xl bg-zinc-900/20 hover:bg-zinc-900/40 border border-white/5 transition-all flex items-start gap-4"
                                    >
                                        {/* Colored Dot Indicator */}
                                        <div className="mt-1 relative flex shrink-0">
                                            <span className={cn(
                                                "w-2.5 h-2.5 rounded-full border shadow-md",
                                                isClick 
                                                    ? "bg-amber-400 border-amber-500/40 shadow-amber-500/20 animate-pulse" 
                                                    : "bg-violet-400 border-violet-500/40 shadow-violet-500/20 animate-pulse"
                                            )} />
                                        </div>

                                        {/* Event Details */}
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="truncate max-w-[250px]">
                                                    <span className="text-xs font-black text-white block truncate">
                                                        {event.userName}
                                                    </span>
                                                    <span className="text-caption text-zinc-500 font-bold uppercase block truncate leading-none mt-0.5">
                                                        {event.guildName}
                                                    </span>
                                                </div>
                                                <span className="text-caption font-black text-zinc-500 uppercase shrink-0 font-mono">
                                                    {new Date(event.createdAt).toLocaleTimeString("fr-FR", { 
                                                        hour: "2-digit", 
                                                        minute: "2-digit", 
                                                        second: "2-digit" 
                                                    })}
                                                </span>
                                            </div>

                                            <div className="space-y-1">
                                                {/* Action label */}
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={cn(
                                                        "text-caption font-black uppercase px-2 py-0.5 rounded-md border tracking-wider",
                                                        isClick 
                                                            ? "bg-amber-500/5 text-amber-400 border-amber-500/10" 
                                                            : "bg-violet-500/5 text-violet-400 border-violet-500/10"
                                                    )}>
                                                        {isClick ? "CLIC" : "VISITE"}
                                                    </span>

                                                    {isClick ? (
                                                        <span className="text-caption font-black text-zinc-400 truncate max-w-[320px]">
                                                            Clic sur <code className="text-amber-300 bg-zinc-950 px-1 py-0.5 rounded font-mono text-caption">{event.elementId}</code>
                                                        </span>
                                                    ) : (
                                                        <span className="text-caption font-bold text-zinc-400 truncate max-w-[320px]">
                                                            Navigué vers <code className="text-violet-300 bg-zinc-950 px-1 py-0.5 rounded font-mono text-caption">{event.path}</code>
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Meta/details rendering */}
                                                {event.details && typeof event.details === "object" && (
                                                    <div className="text-caption text-zinc-600 font-bold uppercase tracking-wider flex items-center gap-2 pt-1">
                                                        {isClick ? (
                                                            (event.details as any).label && (
                                                                <span>Label: "{(event.details as any).label}"</span>
                                                            )
                                                        ) : (
                                                            (event.details as any).userAgent && (
                                                                <span className="truncate max-w-[300px]">
                                                                    Agent: {(event.details as any).userAgent.split(" ").slice(-1)[0]}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: ADOPTION RÉELLE DES MODULES (D-2bis) */}
            {telemetryTab === "adoption" && <TelemetryAdoptionPanel product={initialProduct} />}

            {/* TAB CONTENT: RÉTENTION & GUILDES À RELANCER (D-2bis) */}
            {telemetryTab === "retention" && <TelemetryRetentionPanel product={initialProduct} />}

            {/* TAB CONTENT: SITE PUBLIC (partie externe, compteur anonyme) */}
            {telemetryTab === "public" && <TelemetryPublicPanel stats={initialPublic} />}

            {/* TAB CONTENT: ACTIVATION FUNNEL */}
            {telemetryTab === "funnel" && (
                <div className="space-y-8 animate-in fade-in duration-200">
                    <div className="p-8 rounded-[2rem] border border-border bg-surface shadow-sm">
                        <div className="space-y-1 mb-8">
                            <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-500" />
                                Entonnoir d'Activation des Joueurs (Funnel)
                            </h3>
                            <p className="text-muted-foreground text-caption font-medium">
                                Chaque marche mesure une population différente (comptes, profils configurés, Dofus
                                suivis, membres actifs du journal d&apos;audit) : elles ne sont pas strictement
                                imbriquées. Un écart est donc signalé « population non incluse » au lieu d&apos;être
                                converti en pourcentage de perte.
                            </p>
                        </div>

                        {/* Funnel Steps Visualization */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {stats.activationFunnel?.map((step: any, index: number) => {
                                return (
                                    <div key={step.step} className="p-6 rounded-3xl bg-elevated/60 border border-border flex flex-col justify-between gap-4">
                                        <div className="flex items-center justify-between">
                                            <span className="w-7 h-7 rounded-xl bg-accent-soft text-accent flex items-center justify-center font-black text-xs">
                                                {index + 1}
                                            </span>
                                            {index > 0 && step.exceedsPrevious && (
                                                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                                    population non incluse
                                                </span>
                                            )}
                                            {index > 0 && !step.exceedsPrevious && (
                                                <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                                    -{step.dropoffRate}% perte
                                                </span>
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <span className="text-caption font-bold text-muted-foreground uppercase">{step.step}</span>
                                            <div className="text-3xl font-black text-foreground">{step.count.toLocaleString()}</div>
                                        </div>

                                        <div className="space-y-1.5 pt-2 border-t border-border/60">
                                            <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                                                <span>Part de la 1re marche</span>
                                                <span className="text-foreground">{step.conversionRate}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                                                <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(100, Math.max(0, step.conversionRate))}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
