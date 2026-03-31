import { redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
    Shield,
    Activity,
    Database,
    Sparkles,
    Layers,
    MapPin,
    Trophy,
    Gamepad2,
    Flag,
    Book
} from "lucide-react";
import {
    isSuperAdmin,
    getPlatformStats,
    getPlatformActivityStats,
    getOcrApiStats,
    getAllowedGuilds
} from "@/server/actions/super-admin-actions";
import {
    getSoftDeletedGuilds,
    getSoftDeletedProfiles,
    getArchivedProfiles,
    getPlatformBans,
    getActiveGuilds,
} from "@/server/actions/god-lifecycle-actions";
import { LiveStats } from "./components/live-stats";
import { GuildTable } from "./components/guild-table";
import { LifecyclePanel } from "./components/lifecycle-panel";
import { ActivityChart } from "./activity-chart";
import { JanitorButton } from "./janitor-button";
import { GodDashboardClient } from "./god-dashboard-client";
import { AnnouncementPanel } from "./components/announcement-panel";
import { GhostRadarPanel } from "./components/ghost-radar-panel";
import { StorageOverviewPanel } from "@/components/admin/storage-overview-panel";
import { TicketDashboard } from "./components/ticket-dashboard";
import GameDataInterface from "@/components/admin/GameDataInterface";
import { EventZoneManager } from "@/components/admin/EventZoneManager";

import { OverviewTabs } from "./components/overview-tabs";
import { DeletionPendingPanel } from "@/components/admin/deletion-pending-panel";
import { getSystemAnnouncement } from "@/server/actions/announcement-actions";
import { Suspense } from "react";
import { WorkerTester } from "./components/worker-tester";
import { getPlatformConfig } from "@/server/actions/god-mini-games-actions";

export default async function SuperAdminPage(props: {
    searchParams: Promise<{ tab?: string }>;
}) {
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    const resolvedSearchParams = await props.searchParams;
    const tab = resolvedSearchParams.tab || "overview";

    console.log(`[GodDashboard] Rendering tab: ${tab}`);

    // Fetch data for LifecyclePanel
    const [softDeletedGuilds, softDeletedProfiles, archivedProfiles, platformBans, activeGuilds, ghostUsers] = await Promise.all([
        getSoftDeletedGuilds(),
        getSoftDeletedProfiles(),
        getArchivedProfiles(),
        getPlatformBans(),
        getActiveGuilds(),
        (await import("@/server/actions/super-admin-actions")).getGhostUsers()
    ]);
    
    const resolvedData = {
        softDeletedGuilds,
        softDeletedProfiles,
        archivedProfiles,
        platformBans,
        activeGuilds,
        ghostUsers
    };

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <Suspense fallback={
                <div className="flex-1 flex items-center justify-center bg-black py-20">
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] animate-pulse">Initializing Interface...</span>
                    </div>
                </div>
            }>
                <GodDashboardClient activeTab={tab}>
                    {tab === "overview" && (
                        <div className="space-y-12">
                            {/* Header Area */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 pb-12 border-b border-white/5">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                                            <Activity className="w-5 h-5 text-violet-400" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                                            Performance Overview
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">
                                            Console
                                        </h1>
                                        <p className="text-zinc-500 text-lg font-medium max-w-3xl leading-relaxed">
                                            Gestion centrale de SigilOS : Analytics, Communication globale et Systèmes.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <OverviewTabs 
                                stats={
                                    <Suspense fallback={<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse"><div className="h-24 bg-zinc-900 rounded-2xl" /></div>}>
                                        <LiveStatsServer />
                                    </Suspense>
                                }
                                chart={
                                    <Suspense fallback={<div className="h-64 bg-zinc-900/50 rounded-3xl animate-pulse" />}>
                                        <ActivityChartServer />
                                    </Suspense>
                                }
                                communication={
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        <div className="lg:col-span-2">
                                            <Suspense fallback={<div className="h-48 bg-zinc-900/50 rounded-3xl animate-pulse" />}>
                                                <AnnouncementServer />
                                            </Suspense>
                                        </div>
                                    </div>
                                }
                                worker={
                                    <Suspense fallback={<div className="h-48 bg-zinc-900/50 rounded-3xl animate-pulse" />}>
                                        <WorkerTester />
                                    </Suspense>
                                }
                            />
                        </div>
                    )}

                    {tab === "guilds" && (
                        <div className="space-y-10">
                            <Suspense fallback={<div className="h-96 bg-zinc-900/10 rounded-[3rem] animate-pulse border border-white/5" />}>
                                <GuildsServer />
                            </Suspense>
                            
                            <LifecyclePanel 
                                guilds={resolvedData.softDeletedGuilds as any}
                                profiles={resolvedData.softDeletedProfiles as any}
                                archivedProfiles={resolvedData.archivedProfiles as any}
                                bans={resolvedData.platformBans as any}
                                activeGuilds={resolvedData.activeGuilds as any}
                                ghostUsers={resolvedData.ghostUsers as any}
                            />
                        </div>
                    )}

                    {tab === "infrastructure" && (
                        <div className="space-y-12">
                            <div className="space-y-4 pb-12 border-b border-white/5">
                                <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">Infrastructure</h1>
                                <p className="text-zinc-500 text-lg font-medium">Configuration globale des services, stockage et OCR.</p>
                            </div>

                            {(resolvedSearchParams as any).sub === "STORAGE" ? (
                                <div className="w-full animate-in fade-in duration-500">
                                    <StorageOverviewPanel />
                                </div>
                            ) : (
                                <>
                                    <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-64 rounded-3xl" />}>
                                        <PlatformConfigServer />
                                    </Suspense>

                                    <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 backdrop-blur-xl">
                                        <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-32 rounded-3xl" />}>
                                            <OcrStatsServer />
                                        </Suspense>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {tab === "security" && (
                        <div className="space-y-12">
                            <div className="space-y-4 pb-12 border-b border-white/5">
                                <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">Sécurité</h1>
                                <p className="text-zinc-500 text-lg font-medium">Logs d'audit, détections sensibles et archivage.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 bg-zinc-900/10 border border-white/5 rounded-3xl">
                                    <Suspense fallback={<div className="animate-pulse h-96 rounded-3xl" />}>
                                        <GlobalLogsServer />
                                    </Suspense>
                                </div>
                                <div className="space-y-8">
                                    <div className="bg-rose-500/5 border border-rose-500/10 rounded-3xl p-8 text-center space-y-6">
                                        <Shield className="w-12 h-12 text-rose-500 mx-auto opacity-50" />
                                        <h3 className="text-sm font-black text-rose-500 uppercase tracking-widest">Chat Firewall</h3>
                                        <Link href="/god/chat" className="inline-block px-6 py-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-sm font-black text-rose-400 hover:text-white transition-all uppercase tracking-widest w-full">
                                            Open Monitor
                                        </Link>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                                <div className="lg:col-span-3 bg-zinc-900/10 border border-white/5 rounded-3xl p-1 shadow-2xl">
                                    <Suspense fallback={<div className="animate-pulse bg-zinc-900/10 h-64 rounded-3xl" />}>
                                        <LifecycleServer />
                                    </Suspense>
                                </div>
                                <div className="lg:col-span-1">
                                    <Suspense fallback={<div className="animate-pulse bg-zinc-900/10 h-64 rounded-3xl" />}>
                                        <DeletionPendingPanel />
                                    </Suspense>
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === "tickets" && (
                        <div className="space-y-12">
                            <div className="space-y-4 pb-12 border-b border-white/5">
                                <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">Support</h1>
                                <p className="text-zinc-500 text-lg font-medium">Gestion centralisée des tickets discord et retours utilisateurs.</p>
                            </div>
                            <Suspense fallback={<div className="animate-pulse bg-zinc-900/10 h-96 rounded-3xl" />}>
                                <TicketsServer />
                            </Suspense>
                        </div>
                    )}

                    {tab === "notifications" && (
                        <div className="space-y-12">
                            <div className="space-y-4 pb-12 border-b border-white/5">
                                <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">Alertes</h1>
                                <p className="text-zinc-500 text-lg font-medium">Rapports d'automatisation, sauvegardes et status VPS.</p>
                            </div>
                            <Suspense fallback={<div className="animate-pulse bg-zinc-900/10 h-96 rounded-3xl" />}>
                                <NotificationsServer />
                            </Suspense>
                        </div>
                    )}

                    {tab === "game-data" && (
                        <div className="space-y-12">
                            <div className="space-y-4 pb-12 border-b border-white/5">
                                <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">Game Data</h1>
                                <p className="text-zinc-500 text-lg font-medium">Synchronisez et orchestrez les données de référence du monde des Douze.</p>
                            </div>

                            {/* Quick Stats Grid */}
                            <Suspense fallback={
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
                                    {[...Array(4)].map((_, i) => <div key={i} className="bg-zinc-900/10 h-24 rounded-3xl border border-white/5" />)}
                                </div>
                            }>
                                <GameDataStatsServer />
                            </Suspense>

                            <Suspense fallback={<div className="animate-pulse bg-zinc-900/10 h-96 rounded-3xl" />}>
                                <GameDataInterface />
                            </Suspense>

                            <div className="border-t border-white/5 pt-12 space-y-6">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-xs font-black text-yellow-400 uppercase tracking-widest">
                                    <Sparkles className="w-4 h-4" />
                                    <span>Zones Saisonnières</span>
                                </div>
                                <h2 className="text-3xl font-black text-white tracking-tighter">Zones Événements</h2>
                                <Suspense fallback={<div className="animate-pulse bg-zinc-900/10 h-96 rounded-3xl" />}>
                                    <EventZoneManager />
                                </Suspense>
                            </div>
                        </div>
                    )}
                </GodDashboardClient>
            </Suspense>
        </div>
    );
}

async function GlobalLogsServer() {
    try {
        const { getGlobalAuditLogs } = await import("@/server/actions/audit-actions");
        const { AuditFeedPanel } = await import("./components/audit-feed-panel");
        
        const result = await getGlobalAuditLogs({ limit: 200 });
        const safeLogs = JSON.parse(JSON.stringify(result.data?.logs || []));
        
        return <AuditFeedPanel logs={safeLogs} total={result.data?.total || 0} />;
    } catch { 
        return <div className="p-8 text-center text-red-500 text-xs font-mono">Error loading global logs</div>; 
    }
}

async function LiveStatsServer() {
    try {
        const stats = await getPlatformStats();
        return (
            <LiveStats
                initialStats={{
                    guilds: stats.allowedGuilds,
                    guildsTrend: stats.guildsTrend,
                    activeGuilds: stats.activeGuilds,
                    users: stats.totalUsers,
                    usersTrend: stats.usersTrend,
                    profiles: stats.totalProfiles,
                    activeProfiles: stats.activeProfiles,
                    missions: stats.totalMissions,
                    missionsTrend: stats.missionsTrend,
                    weeklyActiveUsers: stats.weeklyActiveUsers,
                    retentionRate: stats.retentionRate,
                    density: stats.density
                }}
            />
        );
    } catch { return <div>Error stats</div> }
}

async function ActivityChartServer() {
    try {
        const chartData = await getPlatformActivityStats();
        return <ActivityChart data={chartData} />;
    } catch { return <div className="h-64 flex items-center justify-center">⚠ Chart Error</div>; }
}

async function OcrStatsServer() {
    try {
        const ocrStats = await getOcrApiStats();
        return (
            <div className="bg-zinc-900/10 border border-white/5 rounded-3xl p-8 backdrop-blur-xl group hover:bg-zinc-900/20 transition-all">
                <h3 className="text-xs font-black text-zinc-500 mb-8 uppercase tracking-widest flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                    OCR Core Engine
                </h3>
                <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                        <div className="text-4xl font-black text-cyan-400 tracking-tighter">{ocrStats.todayTotal}</div>
                        <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">24h Cycle</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-4xl font-black text-white tracking-tighter">{ocrStats.monthlyTotal}</div>
                        <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Monthly</div>
                    </div>
                </div>
            </div>
        );
    } catch { return <div>Error OCR</div> }
}

async function GhostUsersServer() {
    try {
        const { getGhostUsers } = await import("@/server/actions/super-admin-actions");
        const { TargetPurgePanel } = await import("./components/target-purge-panel");
        const ghostUsers = await getGhostUsers();
        
        return <TargetPurgePanel ghostUsers={ghostUsers} />;
    } catch { return <div>Error Ghosts</div> }
}

async function GuildsServer() {
    const { getAllowedGuilds } = await import("@/server/actions/super-admin-actions");
    const { db } = await import("@/lib/prisma");
    const [allowedGuilds, onboardedConfigs] = await Promise.all([
        getAllowedGuilds(),
        db.guildConfig.findMany({ include: { _count: { select: { profiles: true } } } })
    ]);
    const configMap = new Map(onboardedConfigs.map(c => [c.discordGuildId, c]));
    const mergedGuilds = allowedGuilds.map(allowed => {
        const config = configMap.get(allowed.discordGuildId);
        return {
            id: config?.id || allowed.id,
            name: config?.name || allowed.name || "En attente...",
            discordGuildId: allowed.discordGuildId,
            iconUrl: config?.iconUrl || null,
            isActive: allowed.isActive && (config ? config.isActive : true),
            deletedAt: (config as any)?.deletedAt || null,
            deletionReason: (config as any)?.deletionReason || null,
            scheduledDeletion: (config as any)?.scheduledDeletion || null,
            createdAt: config?.createdAt || allowed.addedAt,
            maxMembers: (config as any)?.maxMembers || 350,
            isWhitelistOnly: !config,
            notes: allowed.notes,
            tier: allowed.tier,
            _count: { profiles: config?._count.profiles || 0 }
        };
    });
    return <GuildTable guilds={mergedGuilds} />;
}

async function LifecycleServer() {
    return (
        <div className="p-8 text-center text-zinc-500 italic text-xs">
            Le Lifecycle Server est désormais intégré à l'onglet Guildes via LifecyclePanel pour plus de clarté.
        </div>
    );
}

function StatsLoading() { return <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="bg-zinc-900/50 h-32 rounded-3xl" />)}</div>; }
function ChartLoading() { return <div className="animate-pulse bg-zinc-900/50 h-64 rounded-3xl" />; }
function TableLoading() { return <div className="animate-pulse bg-zinc-900/50 h-96 rounded-3xl" />; }

async function AnnouncementServer() {
    const currentAnnouncement = await getSystemAnnouncement();
    return <AnnouncementPanel currentAnnouncement={currentAnnouncement} />;
}

async function TicketsServer() {
    try {
        const { getSupportTickets, getTicketStats } = await import("@/server/actions/ticket-actions");
        const [ticketData, stats] = await Promise.all([ getSupportTickets({ perPage: 50 }), getTicketStats() ]);
        return <TicketDashboard initialTickets={JSON.parse(JSON.stringify(ticketData.tickets, (k, v) => typeof v === 'bigint' ? v.toString() : v))} initialTotal={ticketData.total} initialStats={stats} />;
    } catch { return <div>Error tickets</div> }
}

async function PlatformConfigServer() {
    try {
        const { getPlatformConfig } = await import("@/server/actions/changelog-actions");
        const { fetchBotGuilds, fetchGuildRoles } = await import("@/server/discord");
        const { PlatformConfigPanel } = await import("./components/platform-config-panel");
        const [configRes, guilds] = await Promise.allSettled([ getPlatformConfig(), fetchBotGuilds() ]);
        const configResult = configRes.status === "fulfilled" ? configRes.value : { success: false, config: null };
        const guildsList = guilds.status === "fulfilled" ? guilds.value : [];
        let roles: any[] = [];
        if (configResult.success && (configResult as any).config?.ticketSupportGuildId) {
            try { roles = await fetchGuildRoles((configResult as any).config.ticketSupportGuildId); } catch { /* silent */ }
        }
        return <PlatformConfigPanel config={configResult.success ? (configResult as any).config as any : null} availableGuilds={guildsList.map((g: any) => ({ id: g.id, name: g.name }))} availableRoles={roles.map(r => ({ id: r.id, name: r.name }))} />;
    } catch { return <div>Error infrastructure</div>; }
}

async function NotificationsServer() {
    try {
        const { getGodNotifications } = await import("@/server/actions/god-notif-actions");
        const { GodNotificationPanel } = await import("./components/god-notification-panel");
        const res = await getGodNotifications(50);
        return <GodNotificationPanel notifications={res.success ? res.data : []} />;
    } catch { return <div>Error notifications</div>; }
}

async function GameDataStatsServer() {
    try {
        const { db } = await import("@/lib/prisma");
        const [families, zones, challenges, dungeons] = await Promise.all([
            db.monsterFamily.count(),
            db.zone.count(),
            db.challenge.count(),
            db.dungeon.count()
        ]);
        
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Familles", count: families, icon: Layers, color: "text-blue-400" },
                    { label: "Zones", count: zones, icon: MapPin, color: "text-green-400" },
                    { label: "Challenges", count: challenges, icon: Trophy, color: "text-yellow-400" },
                    { label: "Donjons", count: dungeons, icon: Database, color: "text-purple-400" },
                ].map((stat) => (
                    <div key={stat.label} className="p-6 rounded-3xl border border-white/5 bg-zinc-900/10 flex items-center gap-4">
                        <div className={cn("p-3 rounded-xl bg-zinc-950/50 border border-white/5", stat.color)}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{stat.label}</div>
                            <div className="text-xl font-black text-white">{stat.count}</div>
                        </div>
                    </div>
                ))}
            </div>
        );
    } catch { return <div>Stats indisponibles</div>; }
}
