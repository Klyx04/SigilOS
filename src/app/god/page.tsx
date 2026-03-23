import { redirect } from "next/navigation";
import Link from "next/link";
import {
    Shield,
    Book,
    Database,
    Activity,
    LayoutDashboard,
    MessageSquare,
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
import { UserList } from "./user-list";
import { GodDashboardClient } from "./god-dashboard-client";
import { AnnouncementPanel } from "./components/announcement-panel";
import { GhostRadarPanel } from "./components/ghost-radar-panel";
import { StorageOverviewPanel } from "@/components/admin/storage-overview-panel";
import { TicketDashboard } from "./components/ticket-dashboard";

import { DeletionPendingPanel } from "@/components/admin/deletion-pending-panel";
import { getSystemAnnouncement } from "@/server/actions/announcement-actions";
import { Suspense } from "react";
import { WorkerTester } from "./components/worker-tester";

export default async function SuperAdminPage() {
    const isAdmin = await isSuperAdmin();

    // Ultra-secure: no trace, just redirect silently
    if (!isAdmin) {
        redirect("/");
    }

    return (
        <div className="min-h-screen bg-[#050505] relative overflow-hidden">
            {/* Background Sophistication */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

            <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-12 space-y-12 relative z-10">
                {/* Header - Enterprise Clean */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 pb-12 border-b border-white/5">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <Shield className="w-5 h-5 text-blue-400" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                                SigilOS • God Mode
                            </span>
                        </div>
                        
                        <div className="space-y-2">
                            <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">
                                Administration
                            </h1>
                            <p className="text-zinc-400 text-lg md:text-xl font-medium max-w-3xl leading-relaxed">
                                Superviser l'infrastructure globale, administrer les instances de guildes et piloter les services système en temps réel.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 rounded-full border border-white/5 backdrop-blur-md">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">Services Online</span>
                        </div>
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mr-2">
                            v1.2.4-stable
                        </span>
                    </div>
                </div>

            <GodDashboardClient
                overview={
                    <div className="space-y-12">
                        {/* Live Stats */}
                        <Suspense fallback={<StatsLoading />}>
                            <LiveStatsServer />
                        </Suspense>

                        {/* Main Grid - Analytics Chart */}
                        <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 backdrop-blur-xl hover:bg-zinc-900/40 transition-all">
                            <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3 uppercase tracking-widest">
                                <Activity className="w-6 h-6 text-violet-500" />
                                Dynamique de Croissance & Activité
                            </h3>
                            <Suspense fallback={<ChartLoading />}>
                                <ChartServer />
                            </Suspense>
                        </div>
                    </div>
                }
                guilds={
                    <div className="space-y-12">
                        {/* Guilds Management */}
                        <div className="bg-zinc-900/20 border border-white/5 rounded-3xl p-1 pb-10 shadow-2xl">
                            <div className="p-8 pb-4">
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                                    <LayoutDashboard className="w-6 h-6 text-blue-500" />
                                    Guildes Actives
                                </h2>
                            </div>
                            <Suspense fallback={<TableLoading />}>
                                <GuildsServer />
                            </Suspense>
                        </div>
                    </div>
                }
                infrastructure={
                    <div className="space-y-12">
                        <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-64 rounded-3xl" />}>
                            <PlatformConfigServer />
                        </Suspense>

                        {/* Communication Panel (Announcement Banner + Discord Broadcast) */}
                        <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-64 rounded-3xl" />}>
                            <AnnouncementServer />
                        </Suspense>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* OCR Stats */}
                            <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-32 rounded-3xl" />}>
                                <OcrStatsServer />
                            </Suspense>

                            {/* Database Links & Config */}
                            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl space-y-6">
                                <h3 className="text-sm font-black text-zinc-500 uppercase tracking-[0.3em]">Resources</h3>
                                <div className="grid gap-3">
                                    <Link
                                        href="/god/changelog"
                                        className="px-6 py-4 bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 rounded-xl text-sm font-black text-zinc-400 hover:text-white transition-all flex items-center gap-3 uppercase tracking-widest group"
                                    >
                                        <Book className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
                                        Changelog
                                    </Link>
                                    <Link
                                        href="/god/onboarding"
                                        className="px-6 py-4 bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 rounded-xl text-sm font-black text-zinc-400 hover:text-white transition-all flex items-center gap-3 uppercase tracking-widest group"
                                    >
                                        <Shield className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                                        Docs Onboarding B2B
                                    </Link>
                                    <Link
                                        href="/god/docs"
                                        className="px-6 py-4 bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 rounded-xl text-sm font-black text-zinc-400 hover:text-white transition-all flex items-center gap-3 uppercase tracking-widest group"
                                    >
                                        <Database className="w-5 h-5 text-violet-400 group-hover:scale-110 transition-transform" />
                                        API Specs
                                    </Link>
                                    <Link
                                        href="/god/chat"
                                        className="px-6 py-4 bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 rounded-xl text-sm font-black text-rose-400 hover:text-white transition-all flex items-center gap-3 uppercase tracking-widest group"
                                    >
                                        <MessageSquare className="w-5 h-5 text-rose-500 group-hover:scale-110 transition-transform" />
                                        Chat Firewall
                                    </Link>
                                </div>
                            </div>

                            {/* Worker Testing */}
                            <WorkerTester />
                        </div>

                        {/* Janitor (Rebranded as Maintenance Service) */}
                        <JanitorButton />
                    </div>
                }
                storage={
                    <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-8 backdrop-blur-xl">
                        <StorageOverviewPanel />
                    </div>
                }
                security={
                    <div className="space-y-12">
                        <div className="flex flex-col gap-2">
                            <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-red-200 to-red-500 bg-clip-text text-transparent uppercase tracking-tight">
                                🛡️ Opérations de Sécurité
                            </h2>
                            <p className="text-lg text-zinc-500 font-medium">
                                Tracking des actions sensibles, détection de fantômes et gestion du cycle de vie.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Ghost Users */}
                            <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-48 rounded-3xl" />}>
                                <GhostUsersServer />
                            </Suspense>

                            {/* Ghost Discord Guilds Radar */}
                            <GhostRadarPanel />
                        </div>

                        {/* [ADM-8] Suppressions de comptes en attente */}
                        <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-48 rounded-3xl" />}>
                            <DeletionPendingPanel />
                        </Suspense>

                        {/* Lifecycle Management */}
                        <div className="bg-zinc-900/20 border border-white/5 rounded-3xl p-1 shadow-2xl">
                            <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-64 rounded-3xl" />}>
                                <LifecycleServer />
                            </Suspense>
                        </div>

                        {/* Security Audit Log */}
                        <div className="bg-zinc-900/20 border border-white/5 rounded-3xl p-1 shadow-2xl">
                            <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-96 rounded-3xl" />}>
                                <GlobalLogsServer />
                            </Suspense>
                        </div>
                    </div>
                }
                tickets={
                    <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-96 rounded-3xl" />}>
                        <TicketsServer />
                    </Suspense>
                }
            />
            </div>
        </div>
    );
}

async function GlobalLogsServer() {
    const { getGlobalAuditLogs, cleanupGlobalAuditLogs } = await import("@/server/actions/audit-actions");

    // [ADM-10] Platform-wide Lazy Cleanup (Retention policy enforcement)
    // Runs on each visit to the global logs to ensure database health.
    await cleanupGlobalAuditLogs().catch(err => {
        console.error("[GlobalLogsServer] Global cleanup error:", err);
    });

    const result = await getGlobalAuditLogs({ limit: 100 });

    // For now we'll just show the raw count or a simple list until a full component is built
    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <span className="text-sm text-zinc-500 font-mono uppercase tracking-widest">Derniers Événements ({result.data?.total || 0})</span>
                <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] text-blue-400 font-black uppercase">Live stream</span>
                </div>
            </div>

            <div className="space-y-3 font-mono text-[11px]">
                {result.data?.logs.map((log: any) => (
                    <div key={log.id} className="flex gap-4 p-3 rounded-lg bg-zinc-950/50 border border-white/5 hover:border-blue-500/20 transition-colors">
                        <span className="text-zinc-600 whitespace-nowrap">{new Date(log.createdAt).toLocaleTimeString()}</span>
                        <span className="text-blue-400 font-bold w-32 truncate">{log.action}</span>
                        <span className="text-zinc-400">by {log.actorName}</span>
                        <span className="text-zinc-600 truncate flex-1">
                            {log.targetType} {log.targetId ? `-> ${log.targetId}` : ""}
                        </span>
                        {log.metadata && (
                            <span className="text-zinc-800 italic">
                                {JSON.stringify(log.metadata).length > 50 ? "..." : JSON.stringify(log.metadata)}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

async function LiveStatsServer() {
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
}

async function ChartServer() {
    const chartData = await getPlatformActivityStats();
    return <ActivityChart data={chartData} />;
}

async function OcrStatsServer() {
    const ocrStats = await getOcrApiStats();
    return (
        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group hover:bg-zinc-900/60 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[60px] -translate-y-1/2 translate-x-1/2" />
            <h3 className="text-sm font-black text-zinc-500 mb-8 uppercase tracking-[0.3em] flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                OCR Core Engine
            </h3>
            <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                    <div className="text-4xl font-black text-cyan-400 tracking-tighter">{ocrStats.todayTotal}</div>
                    <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Cycle 24h</div>
                </div>
                <div className="space-y-1">
                    <div className="text-4xl font-black text-white tracking-tighter">{ocrStats.monthlyTotal}</div>
                    <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Archive Mensuelle</div>
                </div>
            </div>
            <div className="mt-8 pt-6 border-t border-white/5 text-[10px] font-bold text-zinc-700 uppercase tracking-widest">
                Protocoles de tracking actifs
            </div>
        </div>
    );
}

async function GhostUsersServer() {
    const { getGhostUsers } = await import("@/server/actions/super-admin-actions");
    const ghostUsers = await getGhostUsers();

    return (
        <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group hover:bg-zinc-900/60 transition-all">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-[60px] -translate-y-1/2 translate-x-1/2" />
            <h3 className="text-sm font-black text-zinc-500 mb-8 uppercase tracking-[0.3em] flex items-center justify-between">
                <span className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Cibles de Purge
                </span>
                <span className="text-xs bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full text-red-400 font-black tracking-widest">
                    {ghostUsers.length}
                </span>
            </h3>
            <UserList users={JSON.parse(JSON.stringify(ghostUsers))} />
            <div className="mt-8 pt-6 border-t border-white/5 text-[10px] font-bold text-zinc-700 uppercase tracking-widest">
                Comptes orphelins détectés
            </div>
        </div>
    );
}

async function GuildsServer() {
    const { getAllowedGuilds } = await import("@/server/actions/super-admin-actions");
    const { db } = await import("@/lib/prisma");

    const [allowedGuilds, onboardedConfigs] = await Promise.all([
        getAllowedGuilds(),
        db.guildConfig.findMany({
            include: {
                _count: {
                    select: { profiles: true }
                }
            }
        })
    ]);

    // Create a map for quick lookup
    const configMap = new Map(onboardedConfigs.map(c => [c.discordGuildId, c]));

    // Merge logic: Start with whitelisted guilds, then add any onboarded that might have been lost (safety)
    const whitelistedIds = new Set(allowedGuilds.map(g => g.discordGuildId));

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
            _count: {
                profiles: config?._count.profiles || 0
            }
        };
    });

    // Add onboarded guilds that aren't in whitelist (shouldn't happen but for stability)
    onboardedConfigs.forEach(config => {
        if (!whitelistedIds.has(config.discordGuildId)) {
            mergedGuilds.push({
                id: config.id,
                name: config.name || "Unknown",
                discordGuildId: config.discordGuildId,
                iconUrl: config.iconUrl,
                isActive: config.isActive,
                deletedAt: (config as any).deletedAt || null,
                deletionReason: (config as any).deletionReason || null,
                scheduledDeletion: (config as any).scheduledDeletion || null,
                createdAt: config.createdAt,
                maxMembers: (config as any).maxMembers || 350,
                isWhitelistOnly: false,
                notes: "Configuration orpheline (Non whitelisted)",
                tier: "BETA", // Default for orphan configs
                _count: {
                    profiles: config._count.profiles
                }
            });
        }
    });

    return <GuildTable guilds={mergedGuilds} />;
}

async function LifecycleServer() {
    const [
        softDeletedGuilds,
        softDeletedProfiles,
        archivedProfiles,
        bans,
        activeGuilds,
    ] = await Promise.all([
        getSoftDeletedGuilds(),
        getSoftDeletedProfiles(),
        getArchivedProfiles(),
        getPlatformBans(),
        getActiveGuilds(),
    ]);

    return (
        <LifecyclePanel
            guilds={JSON.parse(JSON.stringify(softDeletedGuilds))}
            profiles={JSON.parse(JSON.stringify(softDeletedProfiles))}
            archivedProfiles={JSON.parse(JSON.stringify(archivedProfiles))}
            bans={JSON.parse(JSON.stringify(bans))}
            activeGuilds={JSON.parse(JSON.stringify(activeGuilds))}
        />
    );
}

// Loading States

function StatsLoading() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 h-32" />
            ))}
        </div>
    );
}

function ChartLoading() {
    return (
        <div className="animate-pulse bg-zinc-800/30 rounded-lg h-64" />
    );
}

function TableLoading() {
    return (
        <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-8 backdrop-blur-sm">
            <div className="animate-pulse space-y-4">
                <div className="h-8 bg-zinc-800 rounded w-1/3" />
                <div className="h-32 bg-zinc-800/50 rounded" />
            </div>
        </div>
    );
}

async function AnnouncementServer() {
    const currentAnnouncement = await getSystemAnnouncement();
    return <AnnouncementPanel currentAnnouncement={currentAnnouncement} />;
}

async function TicketsServer() {
    const { getSupportTickets, getTicketStats } = await import("@/server/actions/ticket-actions");
    const [ticketData, stats] = await Promise.all([
        getSupportTickets({ perPage: 50 }),
        getTicketStats(),
    ]);

    return (
        <TicketDashboard
            initialTickets={JSON.parse(JSON.stringify(ticketData.tickets))}
            initialTotal={ticketData.total}
            initialStats={stats}
        />
    );
}
async function PlatformConfigServer() {
    const { getPlatformConfig } = await import("@/server/actions/changelog-actions");
    const { fetchBotGuilds, fetchGuildRoles } = await import("@/server/discord");
    const { PlatformConfigPanel } = await import("./components/platform-config-panel");

    const [configRes, guilds] = await Promise.all([
        getPlatformConfig(),
        fetchBotGuilds()
    ]);

    let roles: any[] = [];
    if (configRes.success && configRes.config?.ticketSupportGuildId) {
        roles = await fetchGuildRoles(configRes.config.ticketSupportGuildId);
    }

    return (
        <PlatformConfigPanel 
            config={configRes.success ? configRes.config as any : null} 
            availableGuilds={guilds.map(g => ({ id: g.id, name: g.name }))}
            availableRoles={roles.map(r => ({ id: r.id, name: r.name }))}
        />
    );
}
