import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { getGettingStartedProgress } from "@/server/actions/onboarding-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Sparkles, CheckCircle2, ArrowRight, Rocket, Shield, Puzzle, BookOpen, Swords, Users, AlertTriangle, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { AdminTourReplay } from "@/components/tour/admin-tour-replay";

export default async function GettingStartedPage({
    params,
}: {
    params: Promise<{ guildId: string }>;
}) {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { guildId } = await params;
    const user = await getUserContext(guildId);

    if (!user.isAdmin) {
        redirect(`/dashboard/${guildId}`);
    }

    const progress = await getGettingStartedProgress(guildId);
    const percent = Math.round((progress.totalPoints / progress.maxPoints) * 100);

    const iconMap: Record<string, any> = {
        dofus: Rocket,
        rbac: Shield,
        discord: Shield,
        modules: Puzzle,
        presentation: BookOpen,
        missions: Swords,
        members: Users,
    };

    return (
        <div className="relative min-h-full pb-20 space-y-8">
            {/* Ambient Background */}
            <AuroraBackground className="absolute inset-0 z-0 opacity-10 pointer-events-none" />

            <div className="relative z-10 space-y-8">
                <div className="flex items-start justify-between gap-4 mx-1">
                    <UnifiedModuleHeader
                        title="Mise en route"
                        description="Configurez votre guilde en suivant les étapes obligatoires, puis les recommandées"
                        icon={Rocket}
                        backHref={`/dashboard/${guildId}/admin`}
                    />
                    <AdminTourReplay user={user} />
                </div>

                {/* Alerte critique si étapes obligatoires non complètes */}
                {!progress.mandatoryComplete && (
                    <div className="mx-1 relative group">
                        <div className="absolute -inset-px bg-gradient-to-r from-rose-500/40 to-orange-500/40 rounded-xl blur-sm opacity-70" />
                        <div className="relative flex items-start gap-4 bg-rose-500/10 border border-rose-500/30 rounded-xl p-5">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-black text-rose-300 uppercase tracking-wider">
                                    Configuration obligatoire incomplète
                                </p>
                                <p className="text-sm text-rose-400/80 font-medium leading-relaxed">
                                    L&apos;accès au Dashboard est bloqué pour tous les membres jusqu&apos;à ce que vous completiez les étapes{" "}
                                    <span className="text-rose-300 font-black">Serveur de Jeu</span> et{" "}
                                    <span className="text-rose-300 font-black">Rôles &amp; Permissions</span>.
                                    Ces deux étapes sont nécessaires pour garantir la sécurité de votre guilde.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Progress Card */}
                <div className="relative group mx-1">
                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-emerald-500/20 rounded-2xl blur-xl opacity-50" />
                    <div className="relative glass-premium p-8 rounded-2xl border border-white/10 overflow-hidden">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="relative flex-shrink-0">
                                <div className="w-24 h-24 rounded-full border-4 border-white/5 flex items-center justify-center relative">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle
                                            cx="48"
                                            cy="48"
                                            r="44"
                                            fill="transparent"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            className="text-white/5"
                                        />
                                        <circle
                                            cx="48"
                                            cy="48"
                                            r="44"
                                            fill="transparent"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            strokeDasharray="276"
                                            strokeDashoffset={276 - (276 * percent) / 100}
                                            className="text-emerald-500 transition-all duration-1000 ease-out"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-black text-white">{percent}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 space-y-2 text-center md:text-left">
                                <h2 className="text-2xl font-black text-white tracking-tight uppercase">Progression de l&apos;installation</h2>
                                <p className="text-zinc-400 font-medium">
                                    {progress.mandatoryComplete
                                        ? percent === 100
                                            ? "Votre guilde est parfaitement configurée ! Vous êtes prêt à dominer le Monde des Douze."
                                            : "Les étapes obligatoires sont complètes ✅ — continuez avec les étapes recommandées pour optimiser votre guilde."
                                        : "Complétez d'abord les étapes obligatoires pour débloquer l'accès au Dashboard."}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="mx-1 flex items-center gap-6 text-xs font-black uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[9px]">⚡ Obligatoire</span>
                        <span className="text-zinc-500">Requis pour débloquer l&apos;accès</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px]">★ Recommandé</span>
                        <span className="text-zinc-500">Optimise l&apos;expérience</span>
                    </div>
                </div>

                {/* Steps List */}
                <div className="grid grid-cols-1 gap-4 mx-1">
                    {progress.steps.map((step, idx) => {
                        const Icon = iconMap[step.id] || Sparkles;
                        const isCompleted = step.status === "COMPLETED";
                        const isMandatory = step.mandatory;
                        const isLocked = !isMandatory && !progress.mandatoryComplete;

                        const tourTarget = {
                            dofus: "admin-dofus",
                            rbac: "admin-rbac",
                            discord: "admin-discord",
                            modules: "admin-modules",
                            presentation: "admin-presentation",
                            missions: "admin-missions",
                        }[step.id];

                        return (
                            <div
                                key={step.id}
                                data-tour={tourTarget}
                                className={cn(
                                    "group relative glass-premium p-6 rounded-xl border transition-all duration-300",
                                    isCompleted
                                        ? "border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.05)]"
                                        : isMandatory
                                            ? "border-rose-500/20 hover:border-rose-500/40"
                                            : isLocked
                                                ? "border-white/5 opacity-50"
                                                : "border-white/10 hover:border-white/20"
                                )}
                            >
                                <div className="flex items-start gap-6">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform",
                                        !isLocked && "group-hover:scale-110",
                                        isCompleted
                                            ? "bg-emerald-500/10 text-emerald-400"
                                            : isMandatory
                                                ? "bg-rose-500/10 text-rose-400"
                                                : "bg-white/5 text-zinc-500"
                                    )}>
                                        {isLocked ? <Lock className="w-5 h-5" /> : <Icon className="w-6 h-6" />}
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <h3 className={cn(
                                                "text-lg font-black tracking-tight uppercase",
                                                isCompleted ? "text-emerald-400" : isMandatory ? "text-white" : "text-zinc-400"
                                            )}>
                                                {idx + 1}. {step.title}
                                            </h3>
                                            {isMandatory ? (
                                                <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[9px] font-black uppercase tracking-wider">
                                                    ⚡ Obligatoire
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-wider">
                                                    ★ Recommandé
                                                </span>
                                            )}
                                            {isCompleted && (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase">
                                                    ✓ Terminé
                                                </span>
                                            )}
                                            {isLocked && (
                                                <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-600 text-[9px] font-black uppercase">
                                                    🔒 Bloqué
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-zinc-400 font-medium leading-relaxed max-w-2xl">
                                            {isLocked
                                                ? "Débloqué après avoir complété les étapes obligatoires."
                                                : step.description}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end justify-center h-full pt-2">
                                        {isLocked ? (
                                            <Button
                                                disabled
                                                variant="outline"
                                                className="font-black uppercase tracking-widest text-[10px] px-6 h-10 border-white/5 text-zinc-600 cursor-not-allowed"
                                            >
                                                Bloqué
                                            </Button>
                                        ) : (
                                            <Button
                                                asChild
                                                variant={isCompleted ? "outline" : "default"}
                                                className={cn(
                                                    "font-black uppercase tracking-widest text-[10px] px-6 h-10",
                                                    isCompleted
                                                        ? "border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5"
                                                        : isMandatory
                                                            ? "bg-rose-500 text-white hover:bg-rose-600 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                                                            : "bg-white text-black hover:bg-zinc-200"
                                                )}
                                            >
                                                <Link href={step.href}>
                                                    {isCompleted ? "Revoir" : "Configurer"}
                                                    <ArrowRight className="ml-2 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {isCompleted && (
                                    <div className="absolute top-4 right-4 text-emerald-500/20">
                                        <CheckCircle2 className="w-12 h-12 rotate-12" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
