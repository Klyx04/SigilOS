import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import GameDataInterface from "@/components/admin/GameDataInterface";
import { EventZoneManager } from "@/components/admin/EventZoneManager";
import { Database, Layers, MapPin, Trophy, Sparkles, ChevronRight } from "lucide-react";

export const metadata = {
    title: "GOD | Game Data Management",
    description: "Super-admin interface for managing Dofus game data",
};

export default async function GameDataPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/");

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    return (
        <div className="p-8 md:p-12 md:pt-16 space-y-16">
            {/* Page Header */}
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

            {/* Quick Stats */}
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

            {/* ── Dofus Quest Tree ─────────────────────────── */}
            <div className="border-t border-white/5 pt-12 space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-black text-emerald-400 uppercase tracking-widest">
                    <Trophy className="w-4 h-4" />
                    <span>Neural Quest Tree</span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-3">
                        <h2 className="text-3xl font-black text-white tracking-tighter">
                            Dofus Quest Tree <span className="text-emerald-500/70 text-xl font-bold">· Curation Engine</span>
                        </h2>
                        <p className="text-zinc-500 text-sm max-w-xl leading-relaxed">
                            Gérez les chaînes de succès pour chaque Dofus. Données enrichies (niveaux, items, objectifs) 
                            pour le suivi de guilde et les missions. Synchronisation directe avec DofusDB.
                        </p>
                    </div>
                    <a
                        href="/god/quetes-dofus"
                        className="inline-flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl font-black italic uppercase tracking-widest hover:bg-zinc-200 transition-all hover:scale-105"
                    >
                        Ouvrir le Curation Engine
                        <ChevronRight className="w-5 h-5" />
                    </a>
                </div>
            </div>

            {/* Main Sync Interface */}
            <GameDataInterface />

            {/* ── Zones Événements ─────────────────────────── */}
            <div className="border-t border-white/5 pt-12 space-y-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-xs font-black text-yellow-400 uppercase tracking-widest">
                    <Sparkles className="w-4 h-4" />
                    <span>Zones Saisonnières</span>
                </div>
                <h2 className="text-3xl font-black text-white tracking-tighter">
                    Zones Événements <span className="text-yellow-500/70 text-xl font-bold">· Dofus 3.5</span>
                </h2>
                <p className="text-zinc-500 text-sm max-w-xl">
                    Associez familles de monstres et donjons aux zones événements saisonnières.
                    Ces données alimentent directement le sélecteur de missions spéciales côté admin.
                </p>
                <EventZoneManager />
            </div>
        </div>
    );
}
