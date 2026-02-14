import { redirect } from "next/navigation";
import Link from "next/link";
import {
    Shield,
    Book,
    Database,
    Activity,
    LayoutDashboard,
} from "lucide-react";
import {
    isSuperAdmin,
    getPlatformStats,
    getRegistrationStats,
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
import { GuildManager } from "./guild-manager";
import { ActivityChart } from "./activity-chart";
import { JanitorButton } from "./janitor-button";
import { UserList } from "./user-list";
import { Suspense } from "react";

export default async function SuperAdminPage() {
    const isAdmin = await isSuperAdmin();

    // Ultra-secure: no trace, just redirect silently
    if (!isAdmin) {
        redirect("/");
    }

    return (
        <div className="space-y-20 py-8">
            {/* Header - Imposing Scale */}
            <div className="border-b border-white/5 pb-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs font-black text-violet-400 uppercase tracking-[0.3em]">
                            <Shield className="w-4 h-4" />
                            <span>Contrôle Maître</span>
                        </div>
                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter bg-gradient-to-r from-violet-200 via-violet-400 to-violet-600 bg-clip-text text-transparent leading-none drop-shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                            Platform <br />
                            Engine
                        </h1>
                        <p className="text-xl md:text-2xl text-zinc-500 max-w-2xl leading-relaxed font-medium">
                            Noyau central de gestion administrative. Surveillance globale en temps réel et orchestration du cycle de vie SigilOS.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {/* Quick Actions - Scaled */}
                        <Link
                            href="/god/changelog"
                            className="px-6 py-3.5 bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 rounded-xl text-sm font-black text-zinc-400 hover:text-white transition-all flex items-center gap-3 uppercase tracking-widest hover:scale-105"
                        >
                            <Book className="w-5 h-5 text-violet-400" />
                            Changelog
                        </Link>
                        <Link
                            href="/god/docs"
                            className="px-6 py-3.5 bg-zinc-900/50 hover:bg-zinc-900 border border-white/5 rounded-xl text-sm font-black text-zinc-400 hover:text-white transition-all flex items-center gap-3 uppercase tracking-widest hover:scale-105"
                        >
                            <Database className="w-5 h-5 text-violet-400" />
                            API Specs
                        </Link>

                        {/* Live Indicator - Enhanced */}
                        <div className="flex items-center gap-3 px-6 py-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shadow-lg shadow-emerald-500/5">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                            <span className="text-sm text-emerald-400 font-black uppercase tracking-[0.2em]">Live Engine</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Live Stats */}
            <Suspense fallback={<StatsLoading />}>
                <LiveStatsServer />
            </Suspense>

            {/* Main Grid - Scaled containers */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Analytics Chart */}
                <div className="lg:col-span-2 bg-zinc-900/30 border border-white/5 rounded-3xl p-8 backdrop-blur-xl hover:bg-zinc-900/40 transition-all">
                    <h3 className="text-xl font-black text-white mb-8 flex items-center gap-3 uppercase tracking-widest">
                        <Activity className="w-6 h-6 text-violet-500" />
                        Inscriptions (30j)
                    </h3>
                    <Suspense fallback={<ChartLoading />}>
                        <ChartServer />
                    </Suspense>
                </div>

                {/* Side Panel */}
                <div className="space-y-8">
                    {/* OCR Stats */}
                    <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-32 rounded-3xl" />}>
                        <OcrStatsServer />
                    </Suspense>

                    {/* Janitor */}
                    <div className="scale-110 origin-top-left py-2">
                        <JanitorButton />
                    </div>

                    {/* Ghost Users */}
                    <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-48 rounded-3xl" />}>
                        <GhostUsersServer />
                    </Suspense>
                </div>
            </div>

            {/* Guilds Management - Scaled Container */}
            <div className="bg-zinc-900/20 border border-white/5 rounded-3xl p-1 pb-10 shadow-2xl">
                <Suspense fallback={<TableLoading />}>
                    <GuildsServer />
                </Suspense>
            </div>

            {/* Lifecycle Management - Scaled */}
            <div className="bg-zinc-900/20 border border-white/5 rounded-3xl p-1 shadow-2xl">
                <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-64 rounded-3xl" />}>
                    <LifecycleServer />
                </Suspense>
            </div>

            {/* Access Control (Whitelist Management) - Scaled */}
            <div className="space-y-8">
                <div className="flex flex-col gap-2">
                    <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-violet-200 to-violet-500 bg-clip-text text-transparent uppercase tracking-tight">
                        🔐 Access Control
                    </h2>
                    <p className="text-lg text-zinc-500 font-medium">
                        Gestion de la whitelist plateforme (BETA/PROD)
                    </p>
                </div>
                <div className="bg-zinc-900/20 border border-white/5 rounded-3xl p-1 shadow-2xl">
                    <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-96 rounded-3xl" />}>
                        <AccessControlServer />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}

// Server Components (streaming)

async function AccessControlServer() {
    const allowedGuilds = await getAllowedGuilds();
    return <GuildManager initialGuilds={allowedGuilds} />;
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
            }}
        />
    );
}

async function ChartServer() {
    const chartData = await getRegistrationStats();
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
            <UserList users={ghostUsers} />
            <div className="mt-8 pt-6 border-t border-white/5 text-[10px] font-bold text-zinc-700 uppercase tracking-widest">
                Comptes orphelins détectés
            </div>
        </div>
    );
}

async function GuildsServer() {
    const { getAllowedGuilds } = await import("@/server/actions/super-admin-actions");
    const guilds = await getAllowedGuilds();

    // Transform to match GuildTable interface
    const guildsWithCounts = await Promise.all(
        guilds.map(async (guild) => {
            const { db } = await import("@/lib/prisma");
            const profilesCount = await db.userProfile.count({
                where: { guild: { discordGuildId: guild.discordGuildId } }
            });

            // Get GuildConfig if exists (basic fields only - lifecycle fields added via migration)
            const guildConfig = await db.guildConfig.findUnique({
                where: { discordGuildId: guild.discordGuildId }
            });

            return {
                id: guildConfig?.id || guild.id,
                name: guildConfig?.name || guild.name || "Unknown",
                discordGuildId: guild.discordGuildId,
                iconUrl: guildConfig?.iconUrl || null,
                isActive: guild.isActive,
                deletedAt: (guildConfig as any)?.deletedAt || null,
                deletionReason: (guildConfig as any)?.deletionReason || null,
                scheduledDeletion: (guildConfig as any)?.scheduledDeletion || null,
                createdAt: guildConfig?.createdAt || guild.addedAt,
                _count: {
                    profiles: profilesCount
                }
            };
        })
    );

    return <GuildTable guilds={guildsWithCounts} />;
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
            guilds={softDeletedGuilds as any}
            profiles={softDeletedProfiles as any}
            archivedProfiles={archivedProfiles as any}
            bans={bans as any}
            activeGuilds={activeGuilds as any}
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
