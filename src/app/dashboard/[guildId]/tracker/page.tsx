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
            <div className="relative z-10 px-8 pt-10 pb-6 border-b border-border bg-background/40 backdrop-blur-3xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 rounded-xl bg-warning/10 border border-warning/20">
                                <BugIcon className="w-5 h-5 text-warning" />
                            </div>
                            <span className="text-caption font-black uppercase tracking-widest text-warning/60">Système de Suivi</span>
                        </div>
                        <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-4">
                            Tracker de Bugs & Améliorations
                        </h1>
                        <p className="text-muted-foreground text-sm font-medium max-w-2xl">
                            Transparence totale sur l&apos;état technique du projet. Suivez les correctifs en temps réel et les évolutions à venir.
                        </p>
                    </div>

                    <div className="flex items-center gap-6 px-6 py-4 rounded-3xl bg-surface border border-border backdrop-blur-xl">
                        <div className="text-center">
                            <p className="text-caption font-black text-muted-foreground uppercase tracking-widest mb-1">Total</p>
                            <p className="text-xl font-black text-foreground">{issues.length}</p>
                        </div>
                        <div className="w-px h-8 bg-surface" />
                        <div className="text-center">
                            <p className="text-caption font-black text-warning uppercase tracking-widest mb-1">En cours</p>
                            <p className="text-xl font-black text-foreground">{issues.filter(i => i.status === 'EN_COURS').length}</p>
                        </div>
                        <div className="w-px h-8 bg-surface" />
                        <div className="text-center">
                            <p className="text-caption font-black text-success uppercase tracking-widest mb-1">Résolus</p>
                            <p className="text-xl font-black text-foreground">{issues.filter(i => i.status === 'TERMINE').length}</p>
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
            <div className="px-8 py-3 bg-background/80 border-t border-border flex items-center justify-between text-caption font-black uppercase tracking-[0.2em] text-muted-foreground relative z-10">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-success " />
                        <span className="text-success/60">Flux de données actif</span>
                    </div>
                    <div className="w-px h-3 bg-surface" />
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
