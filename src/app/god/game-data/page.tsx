import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import GameDataInterface from "@/components/admin/GameDataInterface";
import { Database, Layers, MapPin, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

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
            <div className="min-h-[70vh] flex items-center justify-center p-8">
                <div className="relative z-10 max-w-2xl w-full text-center space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-1000">
                    <div className="mx-auto w-48 h-48 relative mb-8">
                        <Database className="w-full h-full text-red-500/20 drop-shadow-[0_0_80px_rgba(239,68,68,0.3)]" />
                    </div>
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-black text-red-400 uppercase tracking-widest shadow-xl">
                            <Database className="w-4 h-4" />
                            <span>Protocole de Sécurité Actif</span>
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter font-heading leading-tight drop-shadow-2xl">
                            Accès <br />
                            <span className="text-red-500">Verrouillé</span>
                        </h1>
                    </div>
                    <p className="text-zinc-400 text-xl max-w-md mx-auto leading-relaxed font-medium">
                        La gestion des données de référence est exclusivement réservée à l'environnement de <strong>développement local</strong>.
                    </p>
                    <div className="pt-8">
                        <Button asChild variant="outline" className="h-16 px-12 text-base rounded-full border-white/10 hover:bg-white/5 text-white font-black uppercase tracking-widest transition-all hover:scale-105">
                            <a href="/god">
                                ← Retour au Dashboard
                            </a>
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 md:p-12 md:pt-16 space-y-16">
            {/* Page Header - Scaled */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-12">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-black text-indigo-400 uppercase tracking-widest">
                        <Database className="w-4 h-4" />
                        <span>Core Database Engine</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black text-white font-heading tracking-tighter leading-none">
                        Game Data <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-indigo-400 to-indigo-600">Sync Manager</span>
                    </h1>
                    <p className="text-xl md:text-2xl text-zinc-500 max-w-2xl leading-relaxed font-medium">
                        Synchronisez et orchestrez les données de référence du monde des Douze pour SigilOS.
                    </p>
                </div>
            </div>

            {/* Quick Stats - Scaled */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: "Familles", icon: Layers, color: "text-blue-400", bg: "bg-blue-500/5", border: "border-blue-500/20", glow: "shadow-blue-500/10" },
                    { label: "Zones", icon: MapPin, color: "text-green-400", bg: "bg-green-500/5", border: "border-green-500/20", glow: "shadow-green-500/10" },
                    { label: "Challenges", icon: Trophy, color: "text-yellow-400", bg: "bg-yellow-500/5", border: "border-yellow-500/20", glow: "shadow-yellow-500/10" },
                    { label: "Donjons", icon: Database, color: "text-purple-400", bg: "bg-purple-500/5", border: "border-purple-500/20", glow: "shadow-purple-500/10" },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className={`group p-8 rounded-3xl border ${stat.bg} ${stat.border} ${stat.glow} flex items-center gap-6 hover:bg-zinc-900/40 transition-all duration-300 hover:scale-105 shadow-2xl backdrop-blur-sm`}
                    >
                        <div className={`p-4 rounded-2xl bg-zinc-950/50 border border-white/5 ${stat.color} group-hover:scale-110 transition-transform`}>
                            <stat.icon className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-xs font-black text-zinc-500 uppercase tracking-widest">{stat.label}</div>
                            <div className="text-3xl font-black text-white tracking-tighter italic">Sync OK</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Interface */}
            <GameDataInterface />
        </div>
    );
}
