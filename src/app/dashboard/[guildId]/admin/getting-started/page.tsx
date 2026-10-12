import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { getGettingStartedProgress, type OnboardingProgress } from "@/server/actions/onboarding-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Sparkles, CheckCircle2, ArrowRight, Rocket, Shield, Puzzle, BookOpen, Swords, Users, AlertTriangle, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { AdminTourReplay } from "@/components/tour/admin-tour-replay";
import { AdminConsoleNav } from "@/components/admin/admin-console-nav";

type Step = OnboardingProgress["steps"][number];

const stepIconMap: Record<string, any> = {
    dofus: Rocket,
    rbac: Shield,
    discord: Shield,
    modules: Puzzle,
    presentation: BookOpen,
    missions: Swords,
    members: Users,
};

const stepTourTarget: Record<string, string> = {
    dofus: "admin-dofus",
    rbac: "admin-rbac",
    discord: "admin-discord",
    modules: "admin-modules",
    presentation: "admin-presentation",
    missions: "admin-missions",
};

function StepCard({ step, idx, mandatoryComplete }: { step: Step; idx: number; mandatoryComplete: boolean }) {
    const Icon = stepIconMap[step.id] || Sparkles;
    const isCompleted = step.status === "COMPLETED";
    const isMandatory = step.mandatory;
    const isLocked = !isMandatory && !mandatoryComplete;
    const tourTarget = stepTourTarget[step.id];

    return (
        <div
            data-tour={tourTarget}
            className={cn(
                "group relative glass-premium p-6 rounded-xl border transition-all duration-300",
                isCompleted
                    ? "border-success/20 bg-success/5 "
                    : isMandatory
                        ? "border-danger/20 hover:border-danger/40"
                        : isLocked
                            ? "border-border opacity-50"
                            : "border-border hover:border-border-strong"
            )}
        >
            <div className="flex items-start gap-6">
                <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform",
                    !isLocked && "group-",
                    isCompleted
                        ? "bg-success/10 text-success"
                        : isMandatory
                            ? "bg-danger/10 text-danger"
                            : "bg-surface text-muted-foreground"
                )}>
                    {isLocked ? <Lock className="w-5 h-5" /> : <Icon className="w-6 h-6" />}
                </div>
                <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h3 className={cn(
                            "text-lg font-black tracking-tight uppercase",
                            isCompleted ? "text-success" : isMandatory ? "text-foreground" : "text-muted-foreground"
                        )}>
                            {idx + 1}. {step.title}
                        </h3>
                        {isMandatory ? (
                            <span className="px-2 py-0.5 rounded-full bg-danger/15 border border-danger/30 text-danger text-caption font-black uppercase tracking-wider">
                                ⚡ Obligatoire
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 rounded-full bg-info/10 border border-info/20 text-info text-caption font-black uppercase tracking-wider">
                                ★ Recommandé
                            </span>
                        )}
                        {isCompleted && (
                            <span className="px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-success text-caption font-black uppercase">
                                ✓ Terminé
                            </span>
                        )}
                        {isLocked && (
                            <span className="px-2 py-0.5 rounded-full bg-surface border border-border text-muted-foreground text-caption font-black uppercase">
                                🔒 Bloqué
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-2xl">
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
                            className="font-black uppercase tracking-widest text-caption px-6 h-10 border-border text-muted-foreground cursor-not-allowed"
                        >
                            Bloqué
                        </Button>
                    ) : (
                        <Button
                            asChild
                            variant={isCompleted ? "outline" : "default"}
                            className={cn(
                                "font-black uppercase tracking-widest text-caption px-6 h-10",
                                isCompleted
                                    ? "border-success/20 text-success hover:bg-success/5"
                                    : isMandatory
                                        ? "bg-danger text-danger-foreground hover:bg-danger "
                                        : "bg-background text-foreground hover:bg-surface"
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
                <div className="absolute top-4 right-4 text-success/20">
                    <CheckCircle2 className="w-12 h-12 rotate-12" />
                </div>
            )}
        </div>
    );
}

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

    // Cas « onboarding en attente » (lien direct avant tout déploiement) :
    // la page crée la config elle-même au lieu de lever « Guild not found ».
    let progress;
    try {
        progress = await getGettingStartedProgress(guildId);
    } catch {
        const { onboardGuild } = await import("@/server/actions/admin-actions");
        const ensured = await onboardGuild(guildId);
        if (!ensured.success) {
            redirect("/dashboard");
        }
        progress = await getGettingStartedProgress(guildId);
    }
    // % honnête : tant que les obligatoires ne sont pas complètes, on progresse
    // sur les obligatoires seules (la 1re étape validée affiche 50%, pas 20%).
    const { getGettingStartedPercent } = await import("@/lib/onboarding-gating");
    const { percent } = getGettingStartedPercent(progress.steps);
    // Le reste à faire d'abord : les étapes terminées (souvent via le wizard)
    // sont repliées — la page ne montre que ce qui reste.
    const remainingSteps = progress.steps.filter((s) => s.status !== "COMPLETED");
    const completedSteps = progress.steps.filter((s) => s.status === "COMPLETED");

    return (
        <div className="relative min-h-full pb-20 space-y-8">
            {/* Ambient Background */}
            <AuroraBackground className="absolute inset-0 z-0 opacity-10 pointer-events-none" />

            <div className="relative z-10 space-y-8">
                <UnifiedModuleHeader
                    title="Configuration"
                    description="L'assistant a posé les bases — finalisez ici les étapes recommandées, et revoyez les obligatoires à tout moment"
                    icon={Rocket}
                    backHref={`/dashboard/${guildId}/admin`}
                    actions={<AdminTourReplay phase="admin" />}
                />

                <AdminConsoleNav
                    guildId={guildId}
                    showModules={user.isDiscordAdmin}
                    showAccess={user.canManageRBAC || user.isAdmin}
                    showOnboarding={true}
                    showPilotage={user.isDiscordAdmin}
                />

                {/* Alerte critique si étapes obligatoires non complètes */}
                {!progress.mandatoryComplete && (
                    <div className="mx-1 relative group">
                        <div className="absolute -inset-px bg-gradient-to-r from-danger/40 to-warning/40 rounded-xl blur-sm opacity-70" />
                        <div className="relative flex items-start gap-4 bg-danger/10 border border-danger/30 rounded-xl p-5">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-danger/15 flex items-center justify-center text-danger">
                                <AlertTriangle className="w-5 h-5" />
                            </div>
                            <div className="flex-1 space-y-1">
                                <p className="text-sm font-black text-danger uppercase tracking-wider">
                                    Configuration obligatoire incomplète
                                </p>
                                <p className="text-sm text-danger/80 font-medium leading-relaxed">
                                    L&apos;accès au Dashboard est bloqué pour tous les membres jusqu&apos;à ce que vous completiez les étapes{" "}
                                    <span className="text-danger font-black">Serveur de Jeu</span> et{" "}
                                    <span className="text-danger font-black">Rôles &amp; Permissions</span>.
                                    Ces deux étapes sont nécessaires pour garantir la sécurité de votre guilde.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* CTA unique — « votre prochaine action ». La page alignait 7 cartes
                    équivalentes : l'admin ne savait pas par où commencer. Une seule
                    action, calculée CÔTÉ SERVEUR (`getNextOnboardingAction`) :
                    obligatoires d'abord, puis l'étape entamée, puis la 1re recommandée. */}
                {progress.nextAction && (
                    <div className="mx-1 relative group">
                        <div className="absolute -inset-px bg-gradient-to-r from-info/30 to-success/30 rounded-xl blur-sm opacity-60" />
                        <div className="relative flex flex-col gap-4 bg-surface border border-info/30 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4 min-w-0">
                                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-info/15 flex items-center justify-center text-info">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <p className="text-caption font-black text-info uppercase tracking-wider">
                                        Votre prochaine action
                                    </p>
                                    <p className="text-sm font-black text-foreground">
                                        Étape {progress.steps.indexOf(progress.nextAction) + 1} ·{" "}
                                        {progress.nextAction.title}
                                    </p>
                                    <p className="max-w-[70ch] text-sm text-muted-foreground font-medium leading-relaxed">
                                        {progress.nextAction.description}
                                    </p>
                                </div>
                            </div>
                            <Button
                                asChild
                                className="shrink-0 font-black uppercase tracking-widest text-caption px-6 h-10"
                            >
                                <Link href={progress.nextAction.href}>
                                    {progress.nextAction.mandatory ? "Débloquer maintenant" : "Configurer maintenant"}
                                    <ArrowRight className="ml-2 w-3 h-3" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                )}

                {/* Main Progress Card */}
                <div className="relative group mx-1">
                    <div className="absolute -inset-1 bg-gradient-to-r from-info/20 via-info/20 to-success/20 rounded-2xl blur-xl opacity-50" />
                    <div className="relative glass-premium p-8 rounded-2xl border border-border overflow-hidden">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="relative flex-shrink-0">
                                <div className="w-24 h-24 rounded-full border-4 border-border flex items-center justify-center relative">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle
                                            cx="48"
                                            cy="48"
                                            r="44"
                                            fill="transparent"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            className="text-foreground/5"
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
                                            className="text-success transition-all duration-300 ease-out"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-black text-foreground">{percent}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 space-y-2 text-center md:text-left">
                                <h2 className="text-2xl font-black text-foreground tracking-tight uppercase">Progression de l&apos;installation</h2>
                                <p className="text-muted-foreground font-medium">
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
                        <span className="px-2 py-0.5 rounded-full bg-danger/15 border border-danger/30 text-danger text-caption">⚡ Obligatoire</span>
                        <span className="text-muted-foreground">Requis pour débloquer l&apos;accès</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-info/10 border border-info/20 text-info text-caption">★ Recommandé</span>
                        <span className="text-muted-foreground">Optimise l&apos;expérience</span>
                    </div>
                </div>

                {/* Steps List — reste à faire, terminées repliées */}
                <div className="grid grid-cols-1 gap-4 mx-1">
                    {remainingSteps.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            Tout est configuré — les étapes terminées restent revoyables ci-dessous.
                        </p>
                    )}
                    {remainingSteps.map((step) => (
                        <StepCard
                            key={step.id}
                            step={step}
                            idx={progress.steps.indexOf(step)}
                            mandatoryComplete={progress.mandatoryComplete}
                        />
                    ))}
                    {completedSteps.length > 0 && (
                        <details className="group/comp rounded-xl border border-border">
                            <summary className="flex cursor-pointer list-none select-none items-center gap-2 px-6 py-4 text-xs font-medium text-muted-foreground">
                                <span aria-hidden="true" className="transition-transform group-open/comp:rotate-90">
                                    ▶
                                </span>
                                <span>
                                    Étapes terminées ({completedSteps.length}) — revoir
                                </span>
                            </summary>
                            <div className="grid grid-cols-1 gap-4 px-4 pb-4">
                                {completedSteps.map((step) => (
                                    <StepCard
                                        key={step.id}
                                        step={step}
                                        idx={progress.steps.indexOf(step)}
                                        mandatoryComplete={progress.mandatoryComplete}
                                    />
                                ))}
                            </div>
                        </details>
                    )}
                </div>
            </div>
        </div>
    );
}
