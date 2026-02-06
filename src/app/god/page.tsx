import { redirect } from "next/navigation";
import { isSuperAdmin, getAllowedGuilds, getPlatformStats, getRegistrationStats, getGhostUsers, getOcrApiStats } from "@/server/actions/super-admin-actions";
import { GuildManager } from "./guild-manager";
import { JanitorButton } from "./janitor-button";
import { ActivityChart } from "./activity-chart";
import { UserList } from "./user-list";
import { SuperAdminHeader } from "./header";
import { GalacticFooter } from "@/components/layout/galactic-footer";

export default async function SuperAdminPage() {
    const isAdmin = await isSuperAdmin();

    // Ultra-secure: no trace, just redirect silently
    if (!isAdmin) {
        redirect("/");
    }

    const [guilds, stats, chartData, ghostUsers, ocrStats] = await Promise.all([
        getAllowedGuilds(),
        getPlatformStats(),
        getRegistrationStats(),
        getGhostUsers(),
        getOcrApiStats()
    ]);

    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            <SuperAdminHeader />

            <main className="flex-grow pt-24 pb-12 px-8">
                <div className="max-w-7xl mx-auto space-y-12">
                    {/* Header Section */}
                    <div className="flex justify-between items-end border-b border-zinc-800 pb-8">
                        <div>
                            <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-200 to-amber-600 bg-clip-text text-transparent">
                                Contrôle Plateforme
                            </h1>
                            <p className="text-zinc-400 mt-2 max-w-xl">
                                Interface de gestion administrative globale. Surveillez, gérez et maintenez la santé de SigilOS depuis ce point de contrôle central.
                            </p>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <StatCard label="Guildes Autorisées" value={stats.allowedGuilds} />
                        <StatCard label="Guildes Actives" value={stats.activeGuilds} color="green" />
                        <StatCard label="Utilisateurs" value={stats.totalUsers} />
                        <StatCard label="Profils Total" value={stats.totalProfiles} />
                        <StatCard label="Profils Actifs" value={stats.activeProfiles} color="green" />
                        <StatCard label="Missions" value={stats.totalMissions} color="amber" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Chart */}
                        <div className="lg:col-span-2 bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-6 backdrop-blur-sm">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                                Inscriptions (30 jours)
                            </h3>
                            <ActivityChart data={chartData} />
                        </div>

                        {/* Side Panel (Janitor & Extra Tools) */}
                        <div className="space-y-6">
                            {/* OCR API Usage Card */}
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

                            <JanitorButton />

                            <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-6 backdrop-blur-sm">
                                <h3 className="text-sm font-bold text-zinc-400 mb-4 uppercase tracking-wider flex items-center justify-between">
                                    <span>Cibles du Nettoyeur</span>
                                    <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-300">{ghostUsers.length}</span>
                                </h3>
                                <UserList users={ghostUsers} />
                            </div>
                        </div>
                    </div>

                    {/* Guild Manager */}
                    <div className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-8 backdrop-blur-sm">
                        <GuildManager initialGuilds={guilds} />
                    </div>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}

function StatCard({ label, value, color = "white" }: { label: string; value: number; color?: string }) {
    const colorClass = {
        white: "text-white",
        green: "text-green-400",
        amber: "text-amber-400",
        red: "text-red-400"
    }[color] || "text-white";

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
            <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
            <div className="text-xs text-zinc-500 mt-1">{label}</div>
        </div>
    );
}
