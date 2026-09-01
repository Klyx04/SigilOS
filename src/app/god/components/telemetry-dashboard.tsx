"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { 
    ResponsiveContainer, 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    Tooltip, 
    CartesianGrid 
} from "recharts";
import { 
    Activity, 
    MousePointer, 
    Users, 
    Flame, 
    RefreshCw,
    TrendingUp, 
    Calendar,
    Search,
    UserCheck,
    Globe,
    Cpu,
    Download,
    ShieldCheck,
    Layers,
    Zap,
    BarChart3,
    Filter,
    HeartPulse
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTelemetryStats, exportTelemetryDataAction } from "@/server/actions/telemetry-actions";
import { toast } from "sonner";

type TelemetryStatsType = Awaited<ReturnType<typeof getTelemetryStats>>;

export function TelemetryDashboard({ initialStats }: { initialStats: TelemetryStatsType }) {
    const [stats, setStats] = useState<TelemetryStatsType>(initialStats);
    const [selectedGuildId, setSelectedGuildId] = useState<string>("all");
    const [isAutoRefresh, setIsAutoRefresh] = useState(true);
    const [countdown, setCountdown] = useState(5);
    const [isPending, setIsPending] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [telemetryTab, setTelemetryTab] = useState<"live" | "modules" | "analytics" | "funnel" | "guilds" | "users">("live");
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
            setCountdown(5);
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
                    return 5;
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

    const activeUserCount = stats.usersLastSeen.length;

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
                    { id: "live", label: "Flux Temps Réel", icon: Activity, count: filteredEvents.length },
                    { id: "modules", label: "Consommation Modules", icon: Layers, count: stats.moduleStats?.length || 0 },
                    { id: "analytics", label: "Analyses & Heatmap 24/7", icon: TrendingUp, count: null },
                    { id: "funnel", label: "Funnel d'Activation", icon: Zap, count: null },
                    { id: "guilds", label: "Santé des Guildes", icon: HeartPulse, count: stats.guildHealthList?.length || stats.guildActivity.length },
                    { id: "users", label: "Membres Actifs", icon: UserCheck, count: activeUserCount },
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

            {/* KPI Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Pages Views Card */}
                <div className="p-5 rounded-2xl border border-border bg-surface/70 transition-colors group">
                    <div className="flex justify-between items-start">
                        <div className="space-y-3">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Pages Vues (24h)</span>
                            <span className="text-3xl font-black text-foreground tracking-tight block">
                                {stats.summary.pageViews24h.toLocaleString()}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-accent-soft border border-accent/20 text-accent shrink-0">
                            <Globe className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Clicks/Interactions Card */}
                <div className="p-5 rounded-2xl border border-border bg-surface/70 transition-colors group">
                    <div className="flex justify-between items-start">
                        <div className="space-y-3">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Interactions (24h)</span>
                            <span className="text-3xl font-black text-foreground tracking-tight block">
                                {stats.summary.interactions24h.toLocaleString()}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-accent-soft border border-accent/20 text-accent shrink-0">
                            <MousePointer className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Unique Active Users Card */}
                <div className="p-5 rounded-2xl border border-border bg-surface/70 transition-colors group">
                    <div className="flex justify-between items-start">
                        <div className="space-y-3">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Users Actifs (24h)</span>
                            <span className="text-3xl font-black text-foreground tracking-tight block">
                                {stats.summary.uniqueUsers24h.toLocaleString()}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-accent-soft border border-accent/20 text-accent shrink-0">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Intensity Indicator Card */}
                <div className="p-5 rounded-2xl border border-border bg-surface/70 transition-colors group">
                    <div className="flex justify-between items-start">
                        <div className="space-y-3">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest block">Actions Moy. / User</span>
                            <span className="text-3xl font-black text-foreground tracking-tight block">
                                {stats.summary.averageActionsPerUser}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-accent-soft border border-accent/20 text-accent shrink-0">
                            <Flame className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            </div>

            {/* #34 — Volet Data/Product : DAU/WAU, guildes actives, engagement */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl border border-border bg-surface/40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">DAU / WAU</p>
                    <p className="text-sm font-black text-foreground tabular-nums mt-1">
                        {stats.summary.uniqueUsers24h} / {stats.summary.uniqueUsers7d}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Utilisateurs actifs 24h / 7j (rétention)</p>
                </div>
                <div className="p-4 rounded-2xl border border-border bg-surface/40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Guildes actives (7j)</p>
                    <p className="text-sm font-black text-foreground tabular-nums mt-1">{stats.summary.guildsActive7d}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Guildes avec de l'activité cette semaine</p>
                </div>
                <div className="p-4 rounded-2xl border border-border bg-surface/40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Engagement (24h)</p>
                    <p className="text-sm font-black text-foreground tabular-nums mt-1">{stats.summary.engagementRatio}%</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Interactions / pages vues</p>
                </div>
                <div className="p-4 rounded-2xl border border-border bg-surface/40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Événements totaux</p>
                    <p className="text-sm font-black text-foreground tabular-nums mt-1">{stats.summary.totalEvents.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Depuis le début de la télémétrie</p>
                </div>
            </div>

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

            {/* TAB CONTENT: MODULES & FEATURES */}
            {telemetryTab === "modules" && (
                <div className="space-y-8 animate-in fade-in duration-200">
                    {/* Header Banner */}
                    <div className="p-6 rounded-3xl border border-white/5 bg-zinc-900/20 backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-1">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-violet-400" />
                                Cartographie des Modules SigilOS
                            </h3>
                            <p className="text-zinc-500 text-xs font-semibold">
                                Analyse de la fréquentation et de l'adoption de chaque module du Dashboard.
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-black text-violet-400 block font-mono">
                                {stats.moduleStats?.length || 0} Modules analysés
                            </span>
                            <span className="text-caption text-zinc-500 uppercase font-bold">
                                {selectedGuildId === "all" ? "Périmètre Global" : "Filtre Guilde Actif"}
                            </span>
                        </div>
                    </div>

                    {/* Modules Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {stats.moduleStats?.map((mod: any) => {
                            const maxActions = stats.moduleStats[0]?.totalActions || 1;
                            const pct = Math.max(5, (mod.totalActions / maxActions) * 100);
                            
                            return (
                                <div key={mod.name} className="p-6 rounded-3xl border border-white/5 bg-zinc-900/10 hover:bg-zinc-900/30 transition-all flex flex-col justify-between space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-start">
                                            <span className="text-xs font-black text-white uppercase tracking-wider block">
                                                {mod.name}
                                            </span>
                                            <span className="text-caption font-black text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md">
                                                {mod.uniqueUsersCount} membres actifs
                                            </span>
                                        </div>

                                        <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" 
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center">
                                        <div>
                                            <span className="text-caption font-black text-zinc-500 uppercase block">Pages Vues</span>
                                            <span className="text-xs font-black text-zinc-200">{mod.views}</span>
                                        </div>
                                        <div>
                                            <span className="text-caption font-black text-zinc-500 uppercase block">Clics</span>
                                            <span className="text-xs font-black text-amber-400">{mod.interactions}</span>
                                        </div>
                                        <div>
                                            <span className="text-caption font-black text-zinc-500 uppercase block">Total</span>
                                            <span className="text-xs font-black text-violet-400">{mod.totalActions}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Top vs Flop Features */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Top Features */}
                        <div className="p-6 rounded-3xl border border-white/5 bg-zinc-900/10 space-y-4">
                            <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                <Flame className="w-4 h-4" />
                                Features les plus sollicitées
                            </h4>
                            <div className="space-y-3">
                                {stats.topInteractions.slice(0, 7).map((item: any) => (
                                    <div key={item.elementId} className="flex justify-between items-center text-xs font-bold py-1 border-b border-white/5 last:border-0">
                                        <code className="text-emerald-300 font-mono text-caption bg-zinc-950 px-2 py-0.5 rounded truncate max-w-[300px]">
                                            {item.elementId}
                                        </code>
                                        <span className="text-zinc-400 font-mono text-caption">{item.count} clics</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Less Used Features (Needs Attention) */}
                        <div className="p-6 rounded-3xl border border-white/5 bg-zinc-900/10 space-y-4">
                            <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-4 h-4 text-amber-400" />
                                Features à faible engagement (À promouvoir / retravailler)
                            </h4>
                            <div className="space-y-3">
                                {stats.topInteractions.slice(-7).reverse().map((item: any) => (
                                    <div key={item.elementId} className="flex justify-between items-center text-xs font-bold py-1 border-b border-white/5 last:border-0">
                                        <code className="text-amber-300/80 font-mono text-caption bg-zinc-950 px-2 py-0.5 rounded truncate max-w-[300px]">
                                            {item.elementId}
                                        </code>
                                        <span className="text-zinc-500 font-mono text-caption">{item.count} clic(s)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: ANALYTICS & HEATMAP */}
            {telemetryTab === "analytics" && (
                <div className="space-y-8 animate-in fade-in duration-200">
                    {/* #34 / #194 — Heatmap 7 jours x 24 heures */}
                    <div className="p-6 sm:p-8 rounded-[2rem] border border-border bg-surface shadow-sm">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div className="space-y-1">
                                <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Flame className="w-4 h-4 text-amber-500" />
                                    Heatmap d'Affluence & Activité (7j / 24h)
                                </h3>
                                <p className="text-muted-foreground text-caption font-medium">
                                    Intensité des connexions et actions communautaires par jour et par tranche horaire.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 text-caption font-bold text-muted-foreground">
                                <span>Faible</span>
                                <div className="flex gap-1 items-center">
                                    <span className="w-3 h-3 rounded bg-surface border border-border" />
                                    <span className="w-3 h-3 rounded bg-accent/20" />
                                    <span className="w-3 h-3 rounded bg-accent/50" />
                                    <span className="w-3 h-3 rounded bg-accent/80" />
                                    <span className="w-3 h-3 rounded bg-accent" />
                                </div>
                                <span>Intense</span>
                            </div>
                        </div>

                        {/* Heatmap Grid */}
                        <div className="overflow-x-auto pb-2">
                            <div className="min-w-[700px] space-y-2">
                                {/* Hour headers */}
                                <div className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-1 text-[10px] font-mono font-bold text-muted-foreground text-center">
                                    <div className="text-left font-black">Jour</div>
                                    {Array.from({ length: 24 }).map((_, h) => (
                                        <div key={h} className="text-center">{h}h</div>
                                    ))}
                                </div>

                                {/* Heatmap Rows */}
                                {stats.heatmapData?.map((dayData: any) => (
                                    <div key={dayData.day} className="grid grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-1 items-center">
                                        <div className="w-8 text-caption font-black text-foreground">{dayData.day}</div>
                                        {dayData.hours.map((hData: any) => {
                                            const bgClass = hData.count === 0 
                                                ? "bg-elevated/40 border border-border/30" 
                                                : hData.intensity > 0.7 
                                                    ? "bg-accent text-accent-foreground border border-accent" 
                                                    : hData.intensity > 0.4 
                                                        ? "bg-accent/60 text-white border border-accent/70" 
                                                        : hData.intensity > 0.2 
                                                            ? "bg-accent/35 text-foreground border border-accent/40" 
                                                            : "bg-accent/15 text-foreground border border-accent/20";

                                            return (
                                                <div
                                                    key={hData.hour}
                                                    title={`${dayData.day} à ${hData.hour}h : ${hData.count} action(s)`}
                                                    className={cn(
                                                        "h-7 rounded-md flex items-center justify-center text-[10px] font-mono font-bold transition-transform hover:scale-125 cursor-pointer shadow-xs",
                                                        bgClass
                                                    )}
                                                >
                                                    {hData.count > 0 ? hData.count : ""}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Hourly Trend Chart */}
                    <div className="p-8 rounded-[2rem] border border-border bg-surface shadow-sm">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div className="space-y-1">
                                <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-accent" />
                                    Activité par heure (Dernières 24h)
                                </h3>
                                <p className="text-muted-foreground text-caption font-medium">Comparatif des consultations de pages et des clics d'interaction.</p>
                            </div>
                            <div className="flex gap-4 text-caption font-black uppercase tracking-widest">
                                <span className="flex items-center gap-1.5 text-accent">
                                    <span className="w-2.5 h-2.5 rounded-full bg-accent-soft border border-accent" /> Pages Vues
                                </span>
                                <span className="flex items-center gap-1.5 text-warning">
                                    <span className="w-2.5 h-2.5 rounded-full bg-warning/20 border border-warning" /> Clics
                                </span>
                            </div>
                        </div>

                        <div className="h-[280px] w-full mt-4">
                            {stats.chartData.length === 0 ? (
                                <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                    Pas de données suffisantes pour tracer le graphe.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                                        <XAxis 
                                            dataKey="time" 
                                            stroke="currentColor" 
                                            className="text-muted-foreground"
                                            tickLine={false} 
                                            style={{ fontSize: 9, fontWeight: 800 }} 
                                        />
                                        <YAxis 
                                            stroke="currentColor" 
                                            className="text-muted-foreground"
                                            tickLine={false} 
                                            style={{ fontSize: 9, fontWeight: 800 }} 
                                        />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: "var(--surface)", 
                                                borderColor: "var(--border)",
                                                borderRadius: "16px",
                                                color: "var(--foreground)"
                                            }}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="views" 
                                            stroke="var(--accent)" 
                                            strokeWidth={2.5} 
                                            fillOpacity={1} 
                                            fill="url(#viewsGrad)" 
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="interactions" 
                                            stroke="#f59e0b" 
                                            strokeWidth={2.5} 
                                            fillOpacity={1} 
                                            fill="url(#clicksGrad)" 
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Top Visited Pages */}
                        <div className="p-6 rounded-3xl border border-border bg-surface">
                            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-accent" />
                                Pages les plus populaires
                            </h3>
                            <div className="space-y-4">
                                {stats.topPaths.length === 0 ? (
                                    <p className="text-muted-foreground text-xs italic">Aucune visite enregistrée</p>
                                ) : (
                                    stats.topPaths.map((item: any) => {
                                        const maxVal = stats.topPaths[0]?.count || 1;
                                        const pct = Math.max(5, (item.count / maxVal) * 100);
                                        return (
                                            <div key={item.path} className="space-y-1.5">
                                                <div className="flex justify-between text-xs font-bold text-foreground">
                                                    <span className="truncate max-w-[350px] font-mono text-caption">{item.path}</span>
                                                    <span className="text-muted-foreground">{item.count} vues</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-accent rounded-full" 
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Top Interactions (Clicks) */}
                        <div className="p-6 rounded-3xl border border-border bg-surface">
                            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
                                <MousePointer className="w-4 h-4 text-amber-500" />
                                Actions les plus cliquées
                            </h3>
                            <div className="space-y-4">
                                {stats.topInteractions.length === 0 ? (
                                    <p className="text-muted-foreground text-xs italic">Aucune interaction enregistrée</p>
                                ) : (
                                    stats.topInteractions.map((item: any) => {
                                        const maxVal = stats.topInteractions[0]?.count || 1;
                                        const pct = Math.max(5, (item.count / maxVal) * 100);
                                        return (
                                            <div key={item.elementId} className="space-y-1.5">
                                                <div className="flex justify-between text-xs font-bold text-foreground">
                                                    <span className="truncate max-w-[350px] font-mono text-caption text-amber-500">{item.elementId}</span>
                                                    <span className="text-muted-foreground">{item.count} clics</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-elevated rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-amber-500 rounded-full" 
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                                Progression des membres depuis la création de compte jusqu'à l'adoption durable sur 7 jours.
                            </p>
                        </div>

                        {/* Funnel Steps Visualization */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {stats.activationFunnel?.map((step: any, index: number) => {
                                const baseCount = stats.activationFunnel[0]?.count || 1;
                                const conversionPct = Math.round((step.count / baseCount) * 100);

                                return (
                                    <div key={step.step} className="p-6 rounded-3xl bg-elevated/60 border border-border flex flex-col justify-between gap-4">
                                        <div className="flex items-center justify-between">
                                            <span className="w-7 h-7 rounded-xl bg-accent-soft text-accent flex items-center justify-center font-black text-xs">
                                                {index + 1}
                                            </span>
                                            {index > 0 && (
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
                                                <span>Taux global</span>
                                                <span className="text-foreground">{conversionPct}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                                                <div className="h-full bg-accent rounded-full" style={{ width: `${conversionPct}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: ACTIVE USERS */}
            {telemetryTab === "users" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-200">
                    {/* Top Users */}
                    <div className="p-6 rounded-3xl border border-border bg-surface">
                        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-emerald-500" />
                            Membres les plus actifs
                        </h3>
                        <div className="space-y-4">
                            {stats.topUsers.length === 0 ? (
                                <p className="text-muted-foreground text-xs italic">Aucun utilisateur actif</p>
                            ) : (
                                stats.topUsers.map((item: any) => (
                                    <div key={item.userId} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-lg bg-elevated flex items-center justify-center border border-border text-caption font-black text-emerald-500">
                                                {item.userName.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-foreground block leading-tight">{item.userName}</span>
                                                <span className="text-caption text-muted-foreground font-semibold uppercase">{item.guildName}</span>
                                            </div>
                                        </div>
                                        <span className="text-caption font-black uppercase text-muted-foreground bg-elevated px-2 py-1 rounded-md border border-border">
                                            {item.count} act.
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Qui s'est connecté quand (Dernières connexions 30 jours) */}
                    <div className="p-6 rounded-3xl border border-border bg-surface">
                        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-accent" />
                            Historique des connexions (30j)
                        </h3>
                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
                            {!stats.usersLastSeen || stats.usersLastSeen.length === 0 ? (
                                <p className="text-muted-foreground text-xs italic">Aucune connexion enregistrée</p>
                            ) : (
                                stats.usersLastSeen.map((item: any) => (
                                    <div key={item.userId} className="flex justify-between items-center py-2 border-b border-border last:border-0 text-caption">
                                        <div className="min-w-0">
                                            <span className="font-bold text-foreground block truncate">{item.userName}</span>
                                            <span className="text-caption text-muted-foreground font-semibold uppercase truncate block">{item.guildName}</span>
                                        </div>
                                        <span className="text-caption font-semibold text-muted-foreground bg-elevated px-2 py-1 rounded border border-border shrink-0">
                                            {item.lastActive ? new Date(item.lastActive).toLocaleDateString("fr-FR", {
                                                day: "2-digit",
                                                month: "2-digit",
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            }) : "Jamais"}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: GUILD HEALTH MATRIX */}
            {telemetryTab === "guilds" && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="p-6 sm:p-8 rounded-[2rem] border border-border bg-surface shadow-sm">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div className="space-y-1">
                                <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                                    <HeartPulse className="w-4 h-4 text-emerald-500" />
                                    Matrice de Santé & Rétention des Guildes (Guild Health Index)
                                </h3>
                                <p className="text-muted-foreground text-caption font-medium">
                                    Score de santé 0-100 basé sur les interactions réelles, les sorties donjons/quêtes et la fréquentation sur 7 jours.
                                </p>
                            </div>
                        </div>

                        {/* Guild Health Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-border text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                                        <th className="py-3 px-4">Guilde</th>
                                        <th className="py-3 px-4">Santé Produit</th>
                                        <th className="py-3 px-4">Score</th>
                                        <th className="py-3 px-4">Activité 7j</th>
                                        <th className="py-3 px-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {stats.guildHealthList?.map((g: any) => {
                                        const statusBadge = 
                                            g.healthStatus === "THRIVING" 
                                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                                : g.healthStatus === "HEALTHY"
                                                    ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                                    : g.healthStatus === "AT_RISK"
                                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                        : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";

                                        const statusLabel = 
                                            g.healthStatus === "THRIVING" 
                                                ? "🌟 Hyper-Active"
                                                : g.healthStatus === "HEALTHY"
                                                    ? "✅ En Bonne Santé"
                                                    : g.healthStatus === "AT_RISK"
                                                        ? "⚠️ À Risque"
                                                        : "💤 En Sommeil";

                                        return (
                                            <tr key={g.id} className="hover:bg-elevated/40 transition-colors">
                                                <td className="py-3 px-4 font-bold text-foreground">
                                                    {g.name}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black border", statusBadge)}>
                                                        {statusLabel}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-foreground">{g.healthScore}/100</span>
                                                        <div className="w-16 h-1.5 bg-elevated rounded-full overflow-hidden">
                                                            <div 
                                                                className={cn(
                                                                    "h-full rounded-full",
                                                                    g.healthScore >= 80 ? "bg-emerald-500" : g.healthScore >= 50 ? "bg-blue-500" : "bg-amber-500"
                                                                )}
                                                                style={{ width: `${g.healthScore}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 font-mono font-bold text-muted-foreground">
                                                    {g.actions7d} actions
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button
                                                        onClick={() => handleGuildChange(g.id)}
                                                        className="px-2.5 py-1 rounded-lg bg-surface border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
                                                    >
                                                        Filtrer
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
