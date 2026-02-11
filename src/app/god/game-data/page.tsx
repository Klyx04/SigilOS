import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import GameDataInterface from "@/components/admin/GameDataInterface";
import { Database, Layers, MapPin, Trophy } from "lucide-react";

export const metadata = {
    title: "GOD | Game Data Management",
    description: "Super-admin interface for managing Dofus game data",
};

export default async function GameDataPage() {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/");
    }

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        redirect("/");
    }

    // 🔒 SECURITY: Block access in production (Game Data should only be managed locally)
    if (process.env.NODE_ENV === 'production') {
        // Log blocked access attempt
        const { logPageAccess } = await import('@/lib/audit-log');
        logPageAccess({
            userId: session.user.id,
            userEmail: session.user.email || 'unknown',
            page: '/god/game-data',
            details: { blocked: true, reason: 'production_environment' }
        });

        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md">
                    <div className="text-6xl">🚫</div>
                    <h1 className="text-2xl font-bold text-red-400">Access Denied</h1>
                    <p className="text-slate-400">
                        Game Data interface is only available in <strong>development mode</strong>.
                    </p>
                    <p className="text-sm text-slate-500">
                        To manage game data, use your local environment and export seeds to Git.
                    </p>
                    <div className="pt-4">
                        <a
                            href="/god"
                            className="text-indigo-400 hover:text-indigo-300 underline"
                        >
                            ← Back to God Dashboard
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div>
                <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                    <Database className="w-10 h-10 text-indigo-400" />
                    Game Data Management
                </h1>
                <p className="text-slate-400">
                    Interface super-admin pour gérer les données de référence Dofus
                </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: "Familles", icon: Layers, color: "text-blue-400", bg: "bg-blue-950/30", border: "border-blue-800/50" },
                    { label: "Zones", icon: MapPin, color: "text-green-400", bg: "bg-green-950/30", border: "border-green-800/50" },
                    { label: "Challenges", icon: Trophy, color: "text-yellow-400", bg: "bg-yellow-950/30", border: "border-yellow-800/50" },
                    { label: "Donjons", icon: Database, color: "text-purple-400", bg: "bg-purple-950/30", border: "border-purple-800/50" },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className={`p-4 rounded-lg border ${stat.bg} ${stat.border} flex items-center gap-3`}
                    >
                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        <div>
                            <div className="text-sm text-slate-400">{stat.label}</div>
                            <div className="text-xl font-bold text-white">-</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Interface */}
            <GameDataInterface />
        </div>
    );
}
