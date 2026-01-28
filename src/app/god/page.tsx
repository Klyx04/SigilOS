import { redirect } from "next/navigation";
import { isSuperAdmin, getAllowedGuilds, getPlatformStats } from "@/server/actions/super-admin-actions";
import { GuildManager } from "./guild-manager";

export default async function SuperAdminPage() {
    const isAdmin = await isSuperAdmin();

    // Ultra-secure: no trace, just redirect silently
    if (!isAdmin) {
        redirect("/");
    }

    const [guilds, stats] = await Promise.all([
        getAllowedGuilds(),
        getPlatformStats()
    ]);

    return (
        <div className="min-h-screen bg-black text-white p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="border-b border-zinc-800 pb-6">
                    <h1 className="text-3xl font-bold text-amber-500">🔱 Contrôle Plateforme</h1>
                    <p className="text-zinc-400 mt-2">Gestion des guildes autorisées et statistiques globales</p>
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

                {/* Guild Manager */}
                <GuildManager initialGuilds={guilds} />
            </div>
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
