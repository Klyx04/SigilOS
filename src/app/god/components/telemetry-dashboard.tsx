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
    Cpu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTelemetryStats } from "@/server/actions/telemetry-actions";

type TelemetryStatsType = Awaited<ReturnType<typeof getTelemetryStats>>;

export function TelemetryDashboard({ initialStats }: { initialStats: TelemetryStatsType }) {
    const [stats, setStats] = useState<TelemetryStatsType>(initialStats);
    const [selectedGuildId, setSelectedGuildId] = useState<string>("all");
    const [isAutoRefresh, setIsAutoRefresh] = useState(true);
    const [countdown, setCountdown] = useState(5);
    const [isPending, setIsPending] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [telemetryTab, setTelemetryTab] = useState<"live" | "modules" | "analytics" | "users" | "guilds">("live");
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
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tight flex items-center gap-3">
                        <Cpu className="w-6 h-6 text-violet-400 animate-pulse" />
                        Télémétrie & Analyse d'usage
                    </h2>
                    <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">
                        Activité, fréquentation des modules et comportements par guilde
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {/* Guild Filter Dropdown */}
                    <div className="flex items-center gap-2 bg-zinc-900/80 border border-white/10 px-3 py-1.5 rounded-xl">
                        <Globe className="w-4 h-4 text-violet-400 shrink-0" />
                        <select
                            value={selectedGuildId}
                            onChange={(e) => handleGuildChange(e.target.value)}
                            className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-2"
                        >
                            <option value="all" className="bg-zinc-900 text-white">Toutes les Guildes (Global)</option>
                            {stats.availableGuilds?.map((g: any) => (
                                <option key={g.id} value={g.id} className="bg-zinc-900 text-white">
                                    Guilde: {g.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Auto-Refresh Toggle */}
                    <button
                        onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                        className={cn(
                            "flex items-center gap-2.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                            isAutoRefresh 
                                ? "bg-violet-500/10 text-violet-400 border-violet-500/20" 
                                : "bg-zinc-900/50 text-zinc-500 border-white/5 hover:text-zinc-300"
                        )}
                    >
                        <span className={cn(
                            "w-2.5 h-2.5 rounded-full",
                            isAutoRefresh ? "bg-violet-400 animate-ping" : "bg-zinc-600"
                        )} />
                        {isAutoRefresh ? `Auto : ${countdown}s` : "Auto-Refresh Off"}
                    </button>

                    {/* Manual Refresh Button */}
                    <button
                        onClick={() => refreshData()}
                        disabled={isPending}
                        className="p-2.5 rounded-xl bg-zinc-900 border border-white/5 hover:border-white/10 text-zinc-400 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <RefreshCw className={cn("w-4 h-4 group-hover:rotate-180 transition-all duration-700", isPending && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Sub Tabs Selection */}
            <div className="flex border-b border-white/5 pb-1 gap-2 overflow-x-auto no-scrollbar">
                {[
                    { id: "live", label: "Flux Temps Réel", count: filteredEvents.length },
                    { id: "modules", label: "Consommation Modules", count: stats.moduleStats?.length || 0 },
                    { id: "analytics", label: "Analyses de Trafic", count: null },
                    { id: "users", label: "Membres Actifs", count: activeUserCount },
                    { id: "guilds", label: "Activité Guildes", count: stats.guildActivity.length },
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTelemetryTab(t.id as any)}
                        className={cn(
                            "px-6 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border flex items-center gap-2 whitespace-nowrap",
                            telemetryTab === t.id
                                ? "bg-violet-500/10 text-violet-400 border-violet-500/25"
                                : "bg-transparent text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-white/5"
                        )}
                    >
                        {t.label}
                        {t.count !== null && (
                            <span className={cn(
                                "text-[9px] font-black px-1.5 py-0.5 rounded-md",
                                telemetryTab === t.id ? "bg-violet-500/20 text-violet-300" : "bg-zinc-900 text-zinc-600"
                            )}>
                                {t.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* KPI Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Pages Views Card */}
                <div className="p-6 rounded-3xl border border-white/5 bg-zinc-900/10 hover:bg-zinc-900/20 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 blur-3xl rounded-full" />
                    <div className="flex justify-between items-start">
                        <div className="space-y-3">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Pages Vues (24h)</span>
                            <span className="text-4xl font-black text-white tracking-tighter block group-hover:scale-105 transition-all duration-300">
                                {stats.summary.pageViews24h.toLocaleString()}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 shrink-0">
                            <Globe className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Clicks/Interactions Card */}
                <div className="p-6 rounded-3xl border border-white/5 bg-zinc-900/10 hover:bg-zinc-900/20 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full" />
                    <div className="flex justify-between items-start">
                        <div className="space-y-3">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Interactions (24h)</span>
                            <span className="text-4xl font-black text-white tracking-tighter block group-hover:scale-105 transition-all duration-300">
                                {stats.summary.interactions24h.toLocaleString()}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                            <MousePointer className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Unique Active Users Card */}
                <div className="p-6 rounded-3xl border border-white/5 bg-zinc-900/10 hover:bg-zinc-900/20 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
                    <div className="flex justify-between items-start">
                        <div className="space-y-3">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Users Actifs (24h)</span>
                            <span className="text-4xl font-black text-white tracking-tighter block group-hover:scale-105 transition-all duration-300">
                                {stats.summary.uniqueUsers24h.toLocaleString()}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Intensity Indicator Card */}
                <div className="p-6 rounded-3xl border border-white/5 bg-zinc-900/10 hover:bg-zinc-900/20 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full" />
                    <div className="flex justify-between items-start">
                        <div className="space-y-3">
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Actions Moy. / User</span>
                            <span className="text-4xl font-black text-white tracking-tighter block group-hover:scale-105 transition-all duration-300">
                                {stats.summary.averageActionsPerUser}
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                            <Flame className="w-5 h-5" />
                        </div>
                    </div>
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
                            <span className="text-[9px] font-black uppercase text-zinc-600 bg-zinc-900 border border-white/5 px-3 py-1 rounded-full">
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
                                                    <span className="text-[8px] text-zinc-500 font-bold uppercase block truncate leading-none mt-0.5">
                                                        {event.guildName}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] font-black text-zinc-500 uppercase shrink-0 font-mono">
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
                                                        "text-[9px] font-black uppercase px-2 py-0.5 rounded-md border tracking-wider",
                                                        isClick 
                                                            ? "bg-amber-500/5 text-amber-400 border-amber-500/10" 
                                                            : "bg-violet-500/5 text-violet-400 border-violet-500/10"
                                                    )}>
                                                        {isClick ? "CLIC" : "VISITE"}
                                                    </span>

                                                    {isClick ? (
                                                        <span className="text-[10px] font-black text-zinc-400 truncate max-w-[320px]">
                                                            Clic sur <code className="text-amber-300 bg-zinc-950 px-1 py-0.5 rounded font-mono text-[9px]">{event.elementId}</code>
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-zinc-400 truncate max-w-[320px]">
                                                            Navigué vers <code className="text-violet-300 bg-zinc-950 px-1 py-0.5 rounded font-mono text-[9px]">{event.path}</code>
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Meta/details rendering */}
                                                {event.details && typeof event.details === "object" && (
                                                    <div className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider flex items-center gap-2 pt-1">
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
                            <span className="text-[9px] text-zinc-500 uppercase font-bold">
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
                                            <span className="text-[9px] font-black text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md">
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
                                            <span className="text-[8px] font-black text-zinc-500 uppercase block">Pages Vues</span>
                                            <span className="text-xs font-black text-zinc-200">{mod.views}</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black text-zinc-500 uppercase block">Clics</span>
                                            <span className="text-xs font-black text-amber-400">{mod.interactions}</span>
                                        </div>
                                        <div>
                                            <span className="text-[8px] font-black text-zinc-500 uppercase block">Total</span>
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
                                        <code className="text-emerald-300 font-mono text-[10px] bg-zinc-950 px-2 py-0.5 rounded truncate max-w-[300px]">
                                            {item.elementId}
                                        </code>
                                        <span className="text-zinc-400 font-mono text-[10px]">{item.count} clics</span>
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
                                        <code className="text-amber-300/80 font-mono text-[10px] bg-zinc-950 px-2 py-0.5 rounded truncate max-w-[300px]">
                                            {item.elementId}
                                        </code>
                                        <span className="text-zinc-500 font-mono text-[10px]">{item.count} clic(s)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: ANALYTICS */}
            {telemetryTab === "analytics" && (
                <div className="space-y-8 animate-in fade-in duration-200">
                    {/* Hourly Trend Chart */}
                    <div className="p-8 rounded-[2rem] border border-white/5 bg-zinc-950/80 backdrop-blur-xl">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div className="space-y-1">
                                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-violet-400" />
                                    Activité par heure (Dernières 24h)
                                </h3>
                                <p className="text-zinc-500 text-[11px] font-medium">Comparatif des consultations de pages et des clics d'interaction.</p>
                            </div>
                            <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
                                <span className="flex items-center gap-1.5 text-violet-400">
                                    <span className="w-2.5 h-2.5 rounded-full bg-violet-500/20 border border-violet-500" /> Pages Vues
                                </span>
                                <span className="flex items-center gap-1.5 text-amber-400">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500" /> Clics
                                </span>
                            </div>
                        </div>

                        <div className="h-[300px] w-full mt-4">
                            {stats.chartData.length === 0 ? (
                                <div className="h-full w-full flex items-center justify-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
                                    Pas de données suffisantes pour tracer le graphe.
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="clicksGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                                        <XAxis 
                                            dataKey="time" 
                                            stroke="rgba(255,255,255,0.2)" 
                                            tickLine={false} 
                                            style={{ fontSize: 9, fontWeight: 800 }} 
                                        />
                                        <YAxis 
                                            stroke="rgba(255,255,255,0.2)" 
                                            tickLine={false} 
                                            style={{ fontSize: 9, fontWeight: 800 }} 
                                        />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: "#09090b", 
                                                borderColor: "rgba(255,255,255,0.1)",
                                                borderRadius: "16px",
                                                color: "#fff"
                                            }}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="views" 
                                            stroke="#8b5cf6" 
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
                        <div className="p-6 rounded-3xl border border-white/5 bg-zinc-900/10">
                            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-violet-400" />
                                Pages les plus populaires
                            </h3>
                            <div className="space-y-4">
                                {stats.topPaths.length === 0 ? (
                                    <p className="text-zinc-600 text-xs italic">Aucune visite enregistrée</p>
                                ) : (
                                    stats.topPaths.map((item: any) => {
                                        const maxVal = stats.topPaths[0]?.count || 1;
                                        const pct = Math.max(5, (item.count / maxVal) * 100);
                                        return (
                                            <div key={item.path} className="space-y-1.5">
                                                <div className="flex justify-between text-xs font-bold text-zinc-300">
                                                    <span className="truncate max-w-[350px] font-mono text-[11px]">{item.path}</span>
                                                    <span className="text-zinc-400">{item.count} vues</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-zinc-950/80 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full" 
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
                        <div className="p-6 rounded-3xl border border-white/5 bg-zinc-900/10">
                            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <MousePointer className="w-4 h-4 text-amber-400" />
                                Actions les plus cliquées
                            </h3>
                            <div className="space-y-4">
                                {stats.topInteractions.length === 0 ? (
                                    <p className="text-zinc-600 text-xs italic">Aucune interaction enregistrée</p>
                                ) : (
                                    stats.topInteractions.map((item: any) => {
                                        const maxVal = stats.topInteractions[0]?.count || 1;
                                        const pct = Math.max(5, (item.count / maxVal) * 100);
                                        return (
                                            <div key={item.elementId} className="space-y-1.5">
                                                <div className="flex justify-between text-xs font-bold text-zinc-300">
                                                    <span className="truncate max-w-[350px] font-mono text-[10px] text-amber-400/90">{item.elementId}</span>
                                                    <span className="text-zinc-400">{item.count} clics</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-zinc-950/80 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full" 
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

            {/* TAB CONTENT: ACTIVE USERS */}
            {telemetryTab === "users" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-200">
                    {/* Top Users */}
                    <div className="p-6 rounded-3xl border border-white/5 bg-zinc-900/10">
                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-emerald-400" />
                            Membres les plus actifs
                        </h3>
                        <div className="space-y-4">
                            {stats.topUsers.length === 0 ? (
                                <p className="text-zinc-600 text-xs italic">Aucun utilisateur actif</p>
                            ) : (
                                stats.topUsers.map((item: any) => (
                                    <div key={item.userId} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-lg bg-zinc-950/60 flex items-center justify-center border border-white/5 text-[10px] font-black text-emerald-400">
                                                {item.userName.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-white block leading-tight">{item.userName}</span>
                                                <span className="text-[9px] text-zinc-500 font-semibold uppercase">{item.guildName}</span>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-zinc-500 bg-zinc-950 px-2 py-1 rounded-md border border-white/5">
                                            {item.count} act.
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Qui s'est connecté quand (Dernières connexions 30 jours) */}
                    <div className="p-6 rounded-3xl border border-white/5 bg-zinc-900/10">
                        <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-violet-400" />
                            Historique des connexions (30j)
                        </h3>
                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {!stats.usersLastSeen || stats.usersLastSeen.length === 0 ? (
                                <p className="text-zinc-600 text-xs italic">Aucune connexion enregistrée</p>
                            ) : (
                                stats.usersLastSeen.map((item: any) => (
                                    <div key={item.userId} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 text-[11px]">
                                        <div className="min-w-0">
                                            <span className="font-bold text-white block truncate">{item.userName}</span>
                                            <span className="text-[9px] text-zinc-500 font-semibold uppercase truncate block">{item.guildName}</span>
                                        </div>
                                        <span className="text-[9px] font-semibold text-zinc-400 bg-zinc-950 px-2 py-1 rounded border border-white/5 shrink-0">
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

            {/* TAB CONTENT: GUILD ACTIVITY */}
            {telemetryTab === "guilds" && (
                <div className="p-6 rounded-3xl border border-white/5 bg-zinc-900/10 max-w-3xl animate-in fade-in duration-200">
                    <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        Consommation par Guilde (7j)
                    </h3>
                    <div className="space-y-4">
                        {!stats.guildActivity || stats.guildActivity.length === 0 ? (
                            <p className="text-zinc-600 text-xs italic">Aucune activité de guilde enregistrée</p>
                        ) : (
                            stats.guildActivity.map((item: any) => {
                                const maxVal = stats.guildActivity[0]?.count || 1;
                                const pct = Math.max(5, (item.count / maxVal) * 100);
                                return (
                                    <div key={item.guildId} className="space-y-1.5">
                                        <div className="flex justify-between text-xs font-bold text-zinc-300">
                                            <span className="truncate max-w-[400px] font-mono text-[11px] text-emerald-400/90">{item.guildName}</span>
                                            <span className="text-zinc-400">{item.count} actions</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-zinc-950/80 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full" 
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
