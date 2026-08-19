import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/server/actions/super-admin-actions";
import GameDataInterface from "@/components/admin/GameDataInterface";
import { EventZoneManager } from "@/components/admin/EventZoneManager";
import { Database, Layers, MapPin, Trophy, Sparkles, ChevronRight, Activity, RefreshCw, ShieldCheck, Network } from "lucide-react";
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
        <div className={cn("group p-6 rounded-3xl border bg-surface shadow-sm", border)}>
            <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl bg-elevated border border-border transition-transform group-hover:scale-105", color)}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                    <div className="text-caption font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
                    <div className="text-xl font-black text-foreground tracking-tight italic truncate">{value}</div>
                    {sub && <div className="text-caption text-muted-foreground font-bold">{sub}</div>}
                </div>
            </div>
        </div>
    );
}

export default async function GameDataPage() {
    const session = await auth();
    if (!session?.user?.id) redirect("/");
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        const { canAccessBrick } = await import("@/server/actions/super-admin-actions");
        const hasBrick = await canAccessBrick("game-data");
        if (hasBrick) redirect("/god?tab=game-data");
        redirect("/");
    }

    return (
        <div className="p-6 md:p-10 space-y-12 max-w-[1400px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
                <div className="space-y-3">
                    <SectionBadge icon={Database} label="Core Database Engine" color="bg-indigo-500/10 border-indigo-500/20 text-indigo-500" />
                    <h1 className="text-3xl sm:text-5xl font-black text-foreground tracking-tight">
                        Game Data Engine
                    </h1>
                    <p className="text-sm md:text-base text-muted-foreground max-w-2xl font-medium">
                        Synchronisez et orchestrez les données de référence du monde des Douze pour SigilOS.
                    </p>
                </div>
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                    <div className="space-y-0.5">
                        <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Synchronisation</div>
                        <div className="text-caption text-emerald-600/80 dark:text-emerald-400/80 font-bold">Opérationnelle</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Familles" icon={Layers} color="text-blue-500" border="border-blue-500/20" glow="" />
                <StatCard label="Zones" icon={MapPin} color="text-emerald-500" border="border-emerald-500/20" glow="" />
                <StatCard label="Challenges" icon={Trophy} color="text-amber-500" border="border-amber-500/20" glow="" />
                <StatCard label="Donjons" icon={Database} color="text-purple-500" border="border-purple-500/20" glow="" />
            </div>

            <div className="rounded-3xl border border-border bg-surface overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-elevated/50">
                    <div className="flex items-center gap-3">
                        <RefreshCw className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">Console de Synchronisation</span>
                    </div>
                    <span className="text-caption font-bold text-muted-foreground uppercase tracking-wider">GOD · Master Control</span>
                </div>
                <div className="p-6"><GameDataInterface /></div>
            </div>

            <div className="border-t border-border pt-10 space-y-6">
                <EventZoneManager />
            </div>

            <div className="border-t border-border pt-10 space-y-4">
                <SectionBadge icon={Sparkles} label="Quête Ocre" color="bg-amber-500/10 border-amber-500/20 text-amber-500" />
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">
                            Archis & Boss <span className="text-amber-500 text-lg font-bold">· 286 monstres</span>
                        </h2>
                        <p className="text-muted-foreground text-xs sm:text-sm max-w-xl mt-1">
                            Gérez la base locale des archimonstres de l'Éternelle Moisson, des boss et des monstres DofusDB.
                            Synchronisez depuis Metamob pour enrichir la carte interactive avec zones et positions.
                        </p>
                    </div>
                    <a href="/god/game-data/archimonstres" className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-600 dark:text-amber-300 font-bold text-xs transition-all">
                        Gérer les archis & boss <ChevronRight size={16} />
                    </a>
                </div>
            </div>
        </div>
    );
}