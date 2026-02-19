import { BarChart3 } from "lucide-react";
import { getUserContext } from "@/server/actions/user-actions";
import { redirect } from "next/navigation";
import AccessDenied from "@/components/access-denied";
import { isModuleEnabled } from "@/server/actions/module-actions";

export default async function StatsPage({ params }: { params: Promise<{ guildId: string }> }) {
    const { guildId } = await params;

    const user = await getUserContext(guildId);
    if (!user.canViewStats) {
        return <AccessDenied />;
    }

    const isAdmin = user.isAdmin;

    if (!isAdmin && !await isModuleEnabled(guildId, "stats")) {
        redirect(`/dashboard/${guildId}`);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 pb-6 border-b border-white/10">
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                    <BarChart3
                        className="w-12 h-12 text-violet-500 drop-shadow-[0_0_15px_rgba(139,92,246,0.6)]"
                        strokeWidth={1.5}
                    />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Statistiques Guilde</h1>
                    <p className="text-zinc-400">Analyse de l'activité et des performances de la guilde.</p>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center min-h-[400px] border border-dashed border-white/10 rounded-xl bg-white/5 animate-in fade-in duration-500">
                <div className="p-4 rounded-full bg-white/5 mb-4 animate-pulse">
                    <BarChart3 className="w-8 h-8 text-white/50" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Module en construction</h3>
                <p className="text-zinc-500 max-w-md text-center">
                    Bientôt, vous pourrez consulter ici des graphiques détaillés sur les missions, les songes et l'activité globale des membres.
                </p>
            </div>
        </div>
    );
}
