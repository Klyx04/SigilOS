import { getMemberSystemIssues } from "@/server/actions/god-bugs-actions";
import { SystemTrackerView } from "@/components/tracker/system-tracker-view";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { BugIcon, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

interface TrackerPageProps {
    params: Promise<{
        guildId: string;
    }>;
}

export const metadata = {
    title: "Tracker de Bugs & Améliorations — SigilOS",
    description: "Suivez l'évolution technique de SigilOS, les bugs en cours de résolution et les améliorations prévues.",
};

export default async function MemberTrackerPage({ params }: TrackerPageProps) {
    const { guildId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/login");
    }

    const response = await getMemberSystemIssues(guildId);

    if (!response.success) {
        // If not a member or error, redirect to dashboard root
        redirect(`/dashboard/${guildId}`);
    }

    const issues = response.data || [];

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden">
            <AuroraBackground className="absolute inset-0 z-0 opacity-10 pointer-events-none" />
            
            {/* Header Area */}
            <div className="relative z-10 px-8 pt-10 pb-6 border-b border-white/5 bg-zinc-950/40 backdrop-blur-3xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <BugIcon className="w-5 h-5 text-amber-500" />
                            </div>
                            <span className="text-caption font-black uppercase tracking-widest text-amber-500/60">Système de Suivi</span>
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-4">
                            Tracker de Bugs & Améliorations
                        </h1>
                        <p className="text-zinc-500 text-sm font-medium max-w-2xl">
                            Transparence totale sur l&apos;état technique du projet. Suivez les correctifs en temps réel et les évolutions à venir.
                        </p>
                    </div>

                    <div className="flex items-center gap-6 px-6 py-4 rounded-3xl bg-white/[0.03] border border-white/5 backdrop-blur-xl">
                        <div className="text-center">
                            <p className="text-caption font-black text-zinc-600 uppercase tracking-widest mb-1">Total</p>
                            <p className="text-xl font-black text-white">{issues.length}</p>
                        </div>
                        <div className="w-px h-8 bg-white/5" />
                        <div className="text-center">
                            <p className="text-caption font-black text-amber-500 uppercase tracking-widest mb-1">En cours</p>
                            <p className="text-xl font-black text-white">{issues.filter(i => i.status === 'EN_COURS').length}</p>
                        </div>
                        <div className="w-px h-8 bg-white/5" />
                        <div className="text-center">
                            <p className="text-caption font-black text-emerald-500 uppercase tracking-widest mb-1">Résolus</p>
                            <p className="text-xl font-black text-white">{issues.filter(i => i.status === 'TERMINE').length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="relative z-10 flex-1 p-8 overflow-y-auto no-scrollbar">
                <div className="max-w-7xl mx-auto">
                    <SystemTrackerView initialIssues={issues as any} />
                </div>
            </div>

            {/* Footer Status */}
            <div className="px-8 py-3 bg-zinc-950/80 border-t border-white/5 flex items-center justify-between text-caption font-black uppercase tracking-[0.2em] text-zinc-600 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 " />
                        <span className="text-emerald-500/60">Flux de données actif</span>
                    </div>
                    <div className="w-px h-3 bg-white/10" />
                    <span className="flex items-center gap-2">
                        <ShieldCheck className="w-3 h-3" />
                        Accès Membre Autorisé
                    </span>
                </div>
                <span>SigilOS v4.2 Tracker Hub</span>
            </div>
        </div>
    );
}
