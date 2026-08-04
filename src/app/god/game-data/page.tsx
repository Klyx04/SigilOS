import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import GameDataInterface from "@/components/admin/GameDataInterface";
import { EventZoneManager } from "@/components/admin/EventZoneManager";
import { GameDataMonsterManager } from "@/components/admin/GameDataMonsterManager";
import { Database, Layers, MapPin, Trophy, Sparkles, ChevronRight, Activity, RefreshCw, ShieldCheck, Network, Skull } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = {
    title: "GOD | Game Data Management",
    description: "Super-admin interface for managing Dofus game data",
};

function SectionBadge({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
    return (
        <div className={cn("inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-black uppercase tracking-widest", color)}>
            <Icon className="w-4 h-4" />
            <span>{label}</span>
        </div>
    );
}

function StatCard({ label, icon: Icon, color, border, glow, value = "Sync OK", sub }: { label: string; icon: any; color: string; border: string; glow: string; value?: string; sub?: string }) {
    return (
        <div className={cn("group p-7 rounded-3xl border bg-zinc-950/40 backdrop-blur-md", border, glow)}>
            <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl bg-zinc-900/60 border border-white/5 transition-transform group-hover:scale-110", color)}>
                    <Icon className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</div>
                    <div className="text-2xl font-black text-white tracking-tighter italic truncate">{value}</div>
                    {sub && <div className="text-[10px] text-zinc-600 font-bold">{sub}</div>}
                </div>
            </div>
        </div>
    );
}

export default async function GameDataPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/");
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) redirect("/");

    return (
        <div className="p-6 md:p-10 lg:p-14 space-y-14 max-w-[1400px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-white/5 pb-10">
                <div className="space-y-4">
                    <SectionBadge icon={Database} label="Core Database Engine" color="bg-indigo-500/10 border-indigo-500/20 text-indigo-400" />
                    <h1 className="text-4xl md:text-6xl font-black text-white font-heading tracking-tighter leading-none">
                        Game Data{" "}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-indigo-400 to-indigo-600">Sync Manager</span>
                    </h1>
                    <p className="text-lg md:text-xl text-zinc-500 max-w-2xl leading-relaxed font-medium">
                        Synchronisez et orchestrez les données de référence du monde des Douze pour SigilOS.
                    </p>
                </div>
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <div className="space-y-0.5">
                        <div className="text-xs font-black text-emerald-400 uppercase tracking-widest leading-none">Synchronisation</div>
                        <div className="text-[10px] text-emerald-500/70 font-bold">Opérationnelle</div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Accès Super Admin vérifié
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 font-bold">
                    <Network className="w-4 h-4 text-blue-400" /> Prisma connected
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-zinc-300 font-bold">
                    <Activity className="w-4 h-4 text-purple-400" /> Worker ready
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard label="Familles" icon={Layers} color="text-blue-400" border="border-blue-500/20" glow="shadow-blue-500/10" />
                <StatCard label="Zones" icon={MapPin} color="text-green-400" border="border-green-500/20" glow="shadow-green-500/10" />
                <StatCard label="Challenges" icon={Trophy} color="text-yellow-400" border="border-yellow-500/20" glow="shadow-yellow-500/10" />
                <StatCard label="Donjons" icon={Database} color="text-purple-400" border="border-purple-500/20" glow="shadow-purple-500/10" />
            </div>

            <div className="rounded-3xl border border-white/5 bg-zinc-950/20 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-3">
                        <RefreshCw className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm font-black text-white uppercase tracking-widest">Console de Synchronisation</span>
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">GOD · Read-only logs</span>
                </div>
                <div className="p-6"><GameDataInterface /></div>
            </div>

            <div className="border-t border-white/5 pt-12 space-y-6">
                <SectionBadge icon={Sparkles} label="Zones Saisonnières" color="bg-yellow-500/10 border-yellow-500/20 text-yellow-400" />
                <h2 className="text-3xl font-black text-white tracking-tighter">
                    Zones Événements <span className="text-yellow-500/70 text-xl font-bold">· Dofus 3.5</span>
                </h2>
                <p className="text-zinc-500 text-sm max-w-xl">
                    Associez familles de monstres et donjons aux zones événements saisonnières.
                    Ces données alimentent directement le sélecteur de missions spéciales côté admin.
                </p>
                <EventZoneManager />
            </div>

            <div className="border-t border-white/5 pt-12 space-y-6">
                <SectionBadge icon={Skull} label="Monstres Spéciaux" color="bg-purple-500/10 border-purple-500/20 text-purple-400" />
                <h2 className="text-3xl font-black text-white tracking-tighter">
                    Base Monstres Spéciaux <span className="text-purple-500/70 text-xl font-bold">· Missions Événement</span>
                </h2>
                <p className="text-zinc-500 text-sm max-w-xl">
                    Créez et gérez les monstres spéciaux utilisés par le sélecteur « Monstre Spécial » du flow de mission.
                    Ces données alimentent directement les missions événement côté admin.
                </p>
                <GameDataMonsterManager />
            </div>

            <div className="border-t border-white/5 pt-12 space-y-6">
                <SectionBadge icon={Sparkles} label="Quête Ocre" color="bg-amber-500/10 border-amber-500/20 text-amber-400" />
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h2 className="text-3xl font-black text-white tracking-tighter">
                            Archimonstres <span className="text-amber-500/70 text-xl font-bold">· 286 monstres</span>
                        </h2>
                        <p className="text-zinc-500 text-sm max-w-xl mt-2">
                            Gérez la base locale des archimonstres de l'Éternelle Moisson.
                            Synchronisez depuis Metamob pour enrichir la carte interactive avec zones et positions.
                        </p>
                    </div>
                    <a href="/god/game-data/archimonstres" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 font-bold text-sm transition-all">
                        Gérer les archimonstres <ChevronRight size={16} />
                    </a>
                </div>
            </div>
        </div>
    );
}