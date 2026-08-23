import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/prisma";
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
    getActiveScopes,
    getAccessibleBricks,
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
import { GodLoadingSkeleton } from "./ui";
import { BlacklistSection } from "./components/blacklist-section";
import { DeletionPendingPanel } from "@/components/admin/deletion-pending-panel";
import { getSystemAnnouncement } from "@/server/actions/announcement-actions";
import { Suspense } from "react";
import { WorkerTester } from "./components/worker-tester";
import { getPlatformConfig } from "@/server/actions/god-mini-games-actions";
import { getTelemetryStats } from "@/server/actions/telemetry-actions";
import { TelemetryDashboard } from "./components/telemetry-dashboard";
import { getGodRoute } from "@/lib/god-route";


export default async function SuperAdminPage(props: {
    searchParams: Promise<{ tab?: string }>;
}) {
    // 🔄 P2 — Correspondance tab → brickId (registre `god-bricks.ts`), pour
    // vérifier l'accès d'un sous-god via `getAccessibleBricks` (source de vérité).
    // Fail-closed : tout tab SANS brique listée ici est refusé aux sous-gods.
    const TAB_TO_BRICK: Record<string, string> = {
        overview: "overview",
        telemetry: "telemetry",
        "game-data": "game-data",
        "mini-games": "mini-games",
        guilds: "guilds",
        infrastructure: "infrastructure",
        storage: "storage",
        notifications: "notifications",
        tickets: "tickets",
        security: "security",
        "game-data/bounties": "game-data-bounties",
    };
    // 🔄 R1/P2 — Résout la cible d'atterrissage la plus pertinente pour un sub-god.
    // Priorité : briques accessibles (PIM), puis scopes globaux. Chaque cible pointe
    // vers une page/tab réellement existant. /god/delegates est interdit aux sous-gods.
    function resolveGodLanding(scopes: string[], bricks: string[], godRoute: string): string {
        // Mapping brique accessible → cible (dans l'ordre de priorité d'affichage)
        const BRICK_TARGETS: Array<{ brick: string; target: string }> = [
            { brick: "guilds", target: `${godRoute}?tab=guilds` },
            { brick: "game-data", target: `${godRoute}?tab=game-data` },
            { brick: "tickets", target: `${godRoute}?tab=tickets` },
            { brick: "docs", target: `${godRoute}/docs` },
            { brick: "game-data-quetes", target: `${godRoute}/quetes-dofus` },
            { brick: "game-data-guides", target: `${godRoute}/dofus-guides` },
            { brick: "game-data-rush", target: `${godRoute}/rush-sylvestre` },
        ];
        // 1) Une brique accessible (grant PIM) → sa cible
        for (const t of BRICK_TARGETS) {
            if (bricks.includes(t.brick)) return t.target;
        }
        // 2) Fallback sur un scope global → cible (rétro-compat)
        const SCOPE_TARGETS: Array<{ scope: string | null; target: string }> = [
            { scope: "guilds", target: `${godRoute}?tab=guilds` },
            { scope: "game-data", target: `${godRoute}?tab=game-data` },
            { scope: "users", target: `${godRoute}?tab=tickets` },
        ];
        for (const fb of SCOPE_TARGETS) {
            if (fb.scope && scopes.includes(fb.scope)) return fb.target;
        }
        return "/"; // fail-closed : aucune brique/scope exploitable → sortie
    }

    const godRoute = getGodRoute();

    const session = await auth();
    if (!session?.user?.id) {
        redirect("/");
    }

    // Accepte super-admin ET tout sub-god avec au moins un scope actif OU une brique accessible.
    const isAdmin = await isSuperAdmin();
    const activeScopes = await getActiveScopes();
    const accessibleBricks = await getAccessibleBricks(session.user.id);
    if (activeScopes.length === 0 && accessibleBricks.length === 0) {
        // Log failed GOD attempt (uniquement si on n'a AUCUN scope)
        if (session.user.id) {
            const { logAdminAccessDenied } = await import("@/server/actions/audit-actions");
            const firstGuild = await db.guildConfig.findFirst({ select: { discordGuildId: true } });
            if (firstGuild) {
                await logAdminAccessDenied(firstGuild.discordGuildId, "/god");
            }
        }
        redirect("/");
    }

    const resolvedSearchParams = await props.searchParams;
    const requestedTab = resolvedSearchParams.tab || "overview";
    let tab = requestedTab;

    // 🔄 P2 — Guard fail-closed STRICT (fix #108) : un sous-god n'accède à un onglet
    // QUE si la BRIQUE correspondante est réellement accessible (getAccessibleBricks
    // respecte déjà subGodAccess + scope→brique). Avant : on testait les scopes bruts,
    // ce qui laissait un sous-god scope "game-data"/"logs" ouvrir des onglets super-admin
    // (mini-games, security) par URL directe → fuite de surface.
    if (!isAdmin) {
        const brickId = TAB_TO_BRICK[requestedTab] || requestedTab;
        const hasBrick = accessibleBricks.includes(brickId);
        if (!hasBrick) {
            redirect(resolveGodLanding(activeScopes, accessibleBricks, godRoute));
        }
    }

    // 🔄 R1 — Les lectures lourdes ne sont exécutées QUE pour le tab "guilds"
    // (scope-gated). Les autres tabs chargent leurs données dans leurs composants.
    let resolvedData: any = {
        platformBans: [], softDeletedGuilds: [], softDeletedProfiles: [],
        archivedProfiles: [], activeGuilds: [], ghostUsers: [], unauthorizedConnections: []
    };
    if (tab === "guilds" || tab === "security") {
        const { getGhostUsers, getUnauthorizedBotConnections } = await import("@/server/actions/super-admin-actions");
        const [softDeletedGuilds, softDeletedProfiles, archivedProfiles, platformBans, activeGuilds, ghostUsers, unauthorizedConnections] = await Promise.allSettled([
            getSoftDeletedGuilds(),
            getSoftDeletedProfiles(),
            getArchivedProfiles(),
            getPlatformBans(),
            getActiveGuilds(),
            getGhostUsers(),
            getUnauthorizedBotConnections()
        ]);
        const settled = (p: PromiseSettledResult<any>) => p.status === "fulfilled" ? p.value : [];
        resolvedData = {
            softDeletedGuilds: settled(softDeletedGuilds),
            softDeletedProfiles: settled(softDeletedProfiles),
            archivedProfiles: settled(archivedProfiles),
            platformBans: settled(platformBans),
            activeGuilds: settled(activeGuilds),
            ghostUsers: settled(ghostUsers),
            unauthorizedConnections: settled(unauthorizedConnections)
        };
    }

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <Suspense fallback={
                <div className="flex-1 flex items-center justify-center bg-black py-20">
                    <div className="flex flex-col items-center gap-6">
                        <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                        <span className="text-caption font-black text-zinc-600 uppercase tracking-widest animate-pulse">Initializing Interface...</span>
                    </div>
                </div>
            }>
                <GodDashboardClient activeTab={tab}>
                    {tab === "overview" && (
                        <div className="space-y-12">
                            {/* Header Area */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 pb-12 border-b border-white/5">
                                <div className="space-y-4 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 shrink-0">
                                            <Activity className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <span className="text-caption font-black uppercase tracking-widest text-zinc-400">
                                            Central Operations
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold text-white tracking-tight">
                                            Command Center
                                        </h1>
                                        <p className="text-zinc-500 text-base md:text-lg font-medium max-w-3xl leading-relaxed">
                                            Supervision directe des services, diffusion des annonces système et déclencheurs d'infrastructures.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <OverviewTabs
                                stats={
                                    <Suspense fallback={<GodLoadingSkeleton rows={5} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6" />}>
                                        <LiveStatsServer />
                                    </Suspense>
                                }
                                chart={
                                    <Suspense fallback={<GodLoadingSkeleton rows={4} />}>
                                        <ActivityChartServer />
                                    </Suspense>
                                }
                                communication={
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        <div className="lg:col-span-2">
                                            <Suspense fallback={<GodLoadingSkeleton rows={3} />}>
                                                <AnnouncementServer />
                                            </Suspense>
                                        </div>
                                    </div>
                                }
                                worker={
                                    <Suspense fallback={<GodLoadingSkeleton rows={3} />}>
                                        <WorkerTester />
                                    </Suspense>
                                }
                            />
                        </div>
                    )}

                    {tab === "guilds" && (
                        <div className="space-y-10">
                            <Suspense fallback={<div className="h-96 bg-zinc-900/10 rounded-[3rem] animate-pulse border border-white/5" />}>
                                <GuildsServer isReadOnly={!isAdmin} />
                            </Suspense>

                            <BlacklistSection bans={resolvedData.platformBans as any} />
                        </div>
                    )}

                    {tab === "storage" && (
                        <div className="space-y-12">
                            <div className="space-y-4 pb-12 border-b border-white/5">
                                <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold text-white tracking-tight">Stockage & Captures</h1>
                                <p className="text-zinc-500 text-base md:text-lg font-medium">Espace disque par guilde : missions, kamas, prêts, succès et fichiers orphelins.</p>
                            </div>
                            <div className="w-full animate-in fade-in duration-300">
                                <StorageOverviewPanel />
                            </div>
                        </div>
                    )}

                    {tab === "infrastructure" && (
                        <div className="space-y-12">
                            <div className="space-y-4 pb-12 border-b border-white/5">
                                <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold text-white tracking-tight">Infrastructure</h1>
                                <p className="text-zinc-500 text-base md:text-lg font-medium">Configuration globale des services, stockage et OCR.</p>
                            </div>

                            {(resolvedSearchParams as any).sub === "STORAGE" ? (
                                <div className="w-full animate-in fade-in duration-300">
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
                                <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold text-white tracking-tight">Sécurité</h1>
                                <p className="text-zinc-500 text-base md:text-lg font-medium">Logs d'audit, détections sensibles et archivage.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 bg-zinc-900/10 border border-white/5 rounded-3xl">
                                    <Suspense fallback={<div className="animate-pulse h-96 rounded-3xl" />}>
                                        <GlobalLogsServer />
                                    </Suspense>
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
                                <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold text-white tracking-tight">Support</h1>
                                <p className="text-zinc-500 text-base md:text-lg font-medium">Gestion centralisée des tickets discord et retours utilisateurs.</p>
                            </div>
                            <Suspense fallback={<div className="animate-pulse bg-zinc-900/10 h-96 rounded-3xl" />}>
                                <TicketsServer />
                            </Suspense>
                        </div>
                    )}

                    {tab === "notifications" && (
                        <div className="space-y-12">
                            <div className="space-y-4 pb-12 border-b border-white/5">
                                <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold text-white tracking-tight">Alertes</h1>
                                <p className="text-zinc-500 text-base md:text-lg font-medium">Rapports d'automatisation, sauvegardes et status VPS.</p>
                            </div>
                            <Suspense fallback={<div className="animate-pulse bg-zinc-900/10 h-96 rounded-3xl" />}>
                                <NotificationsServer />
                            </Suspense>
                        </div>
                    )}

                    {tab === "game-data" && (
                        <div className="space-y-12">
                            <div className="space-y-3 pb-8 border-b border-border">
                                <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight">Game Data Engine</h1>
                                <p className="text-muted-foreground text-sm md:text-base font-medium">Synchronisez et orchestrez les données de référence du monde des Douze pour SigilOS.</p>
                            </div>

                            {/* Quick Stats Grid */}
                            <Suspense fallback={
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
                                    {[...Array(4)].map((_, i) => <div key={i} className="bg-surface h-24 rounded-3xl border border-border" />)}
                                </div>
                            }>
                                <GameDataStatsServer />
                            </Suspense>

                            <Suspense fallback={<div className="animate-pulse bg-surface h-96 rounded-3xl border border-border" />}>
                                <GameDataInterface />
                            </Suspense>

                            <div className="border-t border-border pt-10 space-y-6">
                                <Suspense fallback={<div className="animate-pulse bg-surface h-96 rounded-3xl border border-border" />}>
                                    <EventZoneManager />
                                </Suspense>
                            </div>

                            {/* Avis de Recherche Quick Access */}
                            <div className="border-t border-border pt-8">
                                <Link
                                    href={`${godRoute}/game-data/bounties`}
                                    className="group flex items-center gap-6 p-6 sm:p-8 rounded-3xl bg-surface border border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-500/5 transition-all shadow-sm"
                                >
                                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 group-hover:scale-105 transition-all shrink-0">
                                        <Flag className="w-7 h-7 text-rose-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg sm:text-xl font-black text-foreground tracking-tight mb-1">Avis de Recherche</h3>
                                        <p className="text-muted-foreground text-xs sm:text-sm font-medium">
                                            Éditez les mécaniques, doplons, zones et résumés tactiques de tous les avis de recherche de la base de données.
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-rose-500/40 group-hover:text-rose-500 group-hover:translate-x-1 transition-all text-2xl font-black">→</div>
                                </Link>
                            </div>
                        </div>
                    )}

                    {tab === "telemetry" && (
                        <div className="space-y-12">
                            <Suspense fallback={
                                <div className="flex-1 flex items-center justify-center bg-black py-20">
                                    <div className="flex flex-col items-center gap-6">
                                        <div className="w-16 h-16 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
                                        <span className="text-caption font-black text-zinc-600 uppercase tracking-widest animate-pulse">Chargement de la télémétrie...</span>
                                    </div>
                                </div>
                            }>
                                <TelemetryServer />
                            </Suspense>
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
                        <div className="text-caption font-black text-zinc-600 uppercase tracking-widest">24h Cycle</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-4xl font-black text-white tracking-tighter">{ocrStats.monthlyTotal}</div>
                        <div className="text-caption font-black text-zinc-600 uppercase tracking-widest">Monthly</div>
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

async function GuildsServer({ isReadOnly = false }: { isReadOnly?: boolean }) {
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
    return <GuildTable guilds={mergedGuilds} isReadOnly={isReadOnly} />;
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
        const [ticketData, stats] = await Promise.all([getSupportTickets({ perPage: 50 }), getTicketStats()]);
        return <TicketDashboard initialTickets={JSON.parse(JSON.stringify(ticketData.tickets, (k, v) => typeof v === 'bigint' ? v.toString() : v))} initialTotal={ticketData.total} initialStats={stats} />;
    } catch { return <div>Error tickets</div> }
}

async function PlatformConfigServer() {
    try {
        const { getPlatformConfig } = await import("@/server/actions/changelog-actions");
        const { fetchBotGuilds, fetchGuildRoles } = await import("@/server/discord");
        const { PlatformConfigPanel } = await import("./components/platform-config-panel");
        const [configRes, guilds] = await Promise.allSettled([getPlatformConfig(), fetchBotGuilds()]);
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Familles", count: families, icon: Layers, color: "text-blue-500" },
                    { label: "Zones", count: zones, icon: MapPin, color: "text-emerald-500" },
                    { label: "Succès", count: challenges, icon: Trophy, color: "text-amber-500" },
                    { label: "Donjons", count: dungeons, icon: Database, color: "text-purple-500" },
                ].map((stat) => (
                    <div key={stat.label} className="p-6 rounded-3xl border border-border bg-surface shadow-sm flex items-center gap-4">
                        <div className={cn("p-3 rounded-2xl bg-elevated border border-border", stat.color)}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-caption font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                            <div className="text-2xl font-black text-foreground">{stat.count}</div>
                        </div>
                    </div>
                ))}
            </div>
        );
    } catch { return <div>Stats indisponibles</div>; }
}

async function TelemetryServer() {
    try {
        const stats = await getTelemetryStats();
        return <TelemetryDashboard initialStats={stats} />;
    } catch (err) {
        const { logger } = await import("@/lib/logger");
        logger.error("[Telemetry ERROR]", { error: String(err) });
        return <div className="p-8 text-center text-red-500 text-xs font-mono">Error loading telemetry data</div>;
    }
}


