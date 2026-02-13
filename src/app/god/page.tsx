import { redirect } from "next/navigation";
import Link from "next/link";
import {
    isSuperAdmin,
    getPlatformStats,
    getRegistrationStats,
    getOcrApiStats,
    getAllowedGuilds
} from "@/server/actions/super-admin-actions";
import { getSoftDeletedGuilds, getSoftDeletedProfiles } from "@/server/actions/god-lifecycle-actions";
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
        <div className="space-y-12">
            {/* Header */}
            <div className="border-b border-zinc-800/60 pb-8">
                <div className="flex items-end justify-between">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-200 via-violet-400 to-violet-600 bg-clip-text text-transparent">
                            ✨ Contrôle Plateforme
                        </h1>
                        <p className="text-zinc-400 mt-2 max-w-xl">
                            Interface de gestion administrative globale. Dashboard moderne avec suivi en temps réel et gestion complète du cycle de vie.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Quick Actions */}
                        <Link
                            href="/god/changelog"
                            className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 hover:text-white transition-all flex items-center gap-2"
                        >
                            📝 Changelog
                        </Link>
                        <Link
                            href="/god/docs"
                            className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-lg text-sm text-zinc-300 hover:text-white transition-all flex items-center gap-2"
                        >
                            📚 Docs
                        </Link>

                        {/* Live Indicator */}
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-sm text-green-400 font-medium">LIVE</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Live Stats */}
            <Suspense fallback={<StatsLoading />}>
                <LiveStatsServer />
            </Suspense>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Analytics Chart */}
                <div className="lg:col-span-2 bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                        Inscriptions (30 jours)
                    </h3>
                    <Suspense fallback={<ChartLoading />}>
                        <ChartServer />
                    </Suspense>
                </div>

                {/* Side Panel */}
                <div className="space-y-6">
                    {/* OCR Stats */}
                    <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-32 rounded-xl" />}>
                        <OcrStatsServer />
                    </Suspense>

                    {/* Janitor */}
                    <JanitorButton />

                    {/* Ghost Users */}
                    <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-48 rounded-xl" />}>
                        <GhostUsersServer />
                    </Suspense>
                </div>
            </div>

            {/* Guilds Management */}
            <Suspense fallback={<TableLoading />}>
                <GuildsServer />
            </Suspense>

            {/* Lifecycle Management */}
            <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-64 rounded-xl" />}>
                <LifecycleServer />
            </Suspense>

            {/* Access Control (Whitelist Management) */}
            <div>
                <div className="mb-6">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-violet-200 to-violet-500 bg-clip-text text-transparent">
                        🔐 Contrôle d'Accès
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1">
                        Gestion de la whitelist platforme (BETA/PROD)
                    </p>
                </div>
                <Suspense fallback={<div className="animate-pulse bg-zinc-900/30 h-96 rounded-xl" />}>
                    <AccessControlServer />
                </Suspense>
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
        <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-sm font-bold text-zinc-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
                OCR.space API
            </h3>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-2xl font-bold text-cyan-400">{ocrStats.todayTotal}</div>
                    <div className="text-xs text-zinc-500">Aujourd&apos;hui</div>
                </div>
                <div>
                    <div className="text-2xl font-bold text-white">{ocrStats.monthlyTotal}</div>
                    <div className="text-xs text-zinc-500">Ce mois</div>
                </div>
            </div>
            <div className="mt-4 text-xs text-zinc-600">
                Tracking local uniquement
            </div>
        </div>
    );
}

async function GhostUsersServer() {
    const { getGhostUsers } = await import("@/server/actions/super-admin-actions");
    const ghostUsers = await getGhostUsers();

    return (
        <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-6 backdrop-blur-sm">
            <h3 className="text-sm font-bold text-zinc-400 mb-4 uppercase tracking-wider flex items-center justify-between">
                <span>Cibles du Nettoyeur</span>
                <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-300">{ghostUsers.length}</span>
            </h3>
            <UserList users={ghostUsers} />
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
    const [softDeletedGuilds, softDeletedProfiles] = await Promise.all([
        getSoftDeletedGuilds(),
        getSoftDeletedProfiles()
    ]);

    // Transform profiles to match interface
    const transformedProfiles = softDeletedProfiles.map(p => ({
        id: p.id,
        guildName: p.guild.name,
        userName: p.user.name || "Unknown",
        archivedAt: p.archivedAt!,
        archiveReason: p.archiveReason!,
        scheduledDeletion: p.scheduledDeletion!
    }));

    return (
        <LifecyclePanel
            guilds={softDeletedGuilds as any}
            profiles={transformedProfiles}
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
