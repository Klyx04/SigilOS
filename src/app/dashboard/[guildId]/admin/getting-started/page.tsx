import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { getGettingStartedProgress, type OnboardingProgress } from "@/server/actions/onboarding-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import {
    Sparkles,
    CheckCircle2,
    ArrowRight,
    Rocket,
    Shield,
    Puzzle,
    BookOpen,
    Swords,
    Bell,
    Lock,
    AlertCircle,
    Check
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AdminTourReplay } from "@/components/tour/admin-tour-replay";
import { AdminConsoleNav } from "@/components/admin/admin-console-nav";

type Step = OnboardingProgress["steps"][number];

const stepIconMap: Record<string, any> = {
    dofus: Rocket,
    rbac: Shield,
    discord: Bell,
    modules: Puzzle,
    presentation: BookOpen,
    missions: Swords,
};

function StepRow({
    step,
    idx,
    mandatoryComplete
}: {
    step: Step;
    idx: number;
    mandatoryComplete: boolean;
}) {
    const Icon = stepIconMap[step.id] || Sparkles;
    const isCompleted = step.status === "COMPLETED";
    const isMandatory = step.mandatory;
    const isLocked = !isMandatory && !mandatoryComplete;

    return (
        <div
            className={cn(
                "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 md:p-5 rounded-xl border transition-all",
                isCompleted
                    ? "border-emerald-500/25 bg-emerald-500/[0.03]"
                    : isMandatory
                        ? "border-amber-500/30 bg-amber-500/[0.03]"
                        : isLocked
                            ? "border-border bg-black/10 opacity-60"
                            : "border-border bg-black/20 hover:border-border-strong hover:bg-black/30"
            )}
        >
            <div className="flex items-start gap-4 min-w-0">
                <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                    isCompleted
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : isMandatory
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : isLocked
                                ? "bg-surface border-border text-muted-foreground"
                                : "bg-surface border-border text-muted-foreground"
                )}>
                    {isLocked ? (
                        <Lock className="w-4 h-4" />
                    ) : isCompleted ? (
                        <Check className="w-5 h-5 text-emerald-400" />
                    ) : (
                        <Icon className="w-5 h-5" />
                    )}
                </div>

                <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-muted-foreground">
                            0{idx + 1}.
                        </span>
                        <h3 className={cn(
                            "text-sm font-bold tracking-tight",
                            isCompleted ? "text-emerald-400" : "text-foreground"
                        )}>
                            {step.title}
                        </h3>

                        {isMandatory ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                                Obligatoire
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 rounded-full bg-surface border border-border text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                                Recommandé
                            </span>
                        )}

                        {isCompleted && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                                ✓ Terminé
                            </span>
                        )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                        {isLocked
                            ? "Débloqué une fois les étapes obligatoires complétées."
                            : step.description}
                    </p>
                </div>
            </div>

            <div className="shrink-0 w-full sm:w-auto flex sm:justify-end">
                {isLocked ? (
                    <button
                        type="button"
                        disabled
                        className="reg-btn reg-btn-secondary text-xs opacity-50 cursor-not-allowed w-full sm:w-auto"
                    >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Verrouillé</span>
                    </button>
                ) : (
                    <Link
                        href={step.href}
                        className={cn(
                            "w-full sm:w-auto text-xs py-2 px-4 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all",
                            isCompleted
                                ? "reg-btn reg-btn-secondary text-xs"
                                : isMandatory
                                    ? "bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
                                    : "reg-btn reg-btn-primary"
                        )}
                    >
                        <span>{isCompleted ? "Revoir" : "Configurer"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                )}
            </div>
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

    const { getGettingStartedPercent } = await import("@/lib/onboarding-gating");
    const { percent } = getGettingStartedPercent(progress.steps);

    const remainingSteps = progress.steps.filter((s) => s.status !== "COMPLETED");
    const completedSteps = progress.steps.filter((s) => s.status === "COMPLETED");

    return (
        <div className="relative min-h-full pb-20 space-y-6">
            <UnifiedModuleHeader
                title="Mise en route de votre Guilde"
                description="Suivez ce guide pas-à-pas pour configurer votre serveur de guilde avant d'inviter vos membres"
                icon={Rocket}
                backHref={`/dashboard/${guildId}/admin`}
                actions={<AdminTourReplay phase="admin" />}
            />

            <AdminConsoleNav
                guildId={guildId}
                showAccess={user.canManageRBAC || user.isAdmin}
                showOnboarding={true}
                showPilotage={user.isDiscordAdmin}
            />

            {/* Alerte si étapes obligatoires incomplètes */}
            {!progress.mandatoryComplete && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 md:p-5 flex items-start gap-3.5">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-amber-400">
                            Configuration obligatoire incomplète
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            L&apos;accès au tableau de bord reste réservé aux administrateurs tant que les étapes{" "}
                            <strong className="text-foreground">Serveur de Jeu</strong> et{" "}
                            <strong className="text-foreground">Rôles &amp; Permissions</strong> ne sont pas enregistrées.
                        </p>
                    </div>
                </div>
            )}

            {/* Bannière Prochaine Action */}
            {progress.nextAction && (
                <div className="reg-panel p-5 border-amber-500/30 bg-gradient-to-r from-amber-500/[0.04] to-black/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                            <span className="text-[10px] font-bold tracking-wider text-amber-400 uppercase block">
                                Votre prochaine action
                            </span>
                            <h3 className="text-sm font-bold text-foreground truncate">
                                {progress.nextAction.title}
                            </h3>
                            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                                {progress.nextAction.description}
                            </p>
                        </div>
                    </div>

                    <Link
                        href={progress.nextAction.href}
                        className="reg-btn reg-btn-gold text-xs px-4 py-2 shrink-0 flex items-center gap-1.5 w-full sm:w-auto justify-center"
                    >
                        <span>{progress.nextAction.mandatory ? "Compléter l'étape" : "Configurer"}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            )}

            {/* Panneau de progression globale — Style Registre */}
            <div className="reg-panel p-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                    <div className="relative shrink-0 flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full border-4 border-border flex items-center justify-center relative">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="40"
                                    cy="40"
                                    r="34"
                                    fill="transparent"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    className="text-foreground/5"
                                />
                                <circle
                                    cx="40"
                                    cy="40"
                                    r="34"
                                    fill="transparent"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    strokeDasharray="213"
                                    strokeDashoffset={213 - (213 * percent) / 100}
                                    className="text-emerald-500 transition-all duration-500 ease-out"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="absolute text-lg font-bold font-mono text-foreground">
                                {percent}%
                            </span>
                        </div>
                    </div>

                    <div className="space-y-1 text-center md:text-left flex-1">
                        <h2 className="text-base font-bold text-foreground">
                            Progression de la mise en route
                        </h2>
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                            {progress.mandatoryComplete
                                ? percent === 100
                                    ? "Votre guilde est prête à 100% ! Tous les modules essentiels sont configurés."
                                    : "Base active ! Les étapes obligatoires sont validées. Vous pouvez dès maintenant partager le lien d'accès à vos membres."
                                : "Complétez les étapes indispensables pour ouvrir l'accès au tableau de bord à vos membres."}
                        </p>
                    </div>
                </div>
            </div>

            {/* Liste des étapes restantes */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h3 className="reg-eyebrow">Étapes à configurer</h3>
                    <span className="text-xs text-muted-foreground font-mono">
                        {remainingSteps.length} restante{remainingSteps.length > 1 ? "s" : ""}
                    </span>
                </div>

                <div className="space-y-2.5">
                    {remainingSteps.length === 0 ? (
                        <div className="reg-panel p-6 text-center text-xs text-muted-foreground">
                            Toutes les étapes sont complétées ! Vous pouvez revoir la configuration à tout moment ci-dessous.
                        </div>
                    ) : (
                        remainingSteps.map((step) => (
                            <StepRow
                                key={step.id}
                                step={step}
                                idx={progress.steps.indexOf(step)}
                                mandatoryComplete={progress.mandatoryComplete}
                            />
                        ))
                    )}
                </div>

                {/* Étapes terminées repliées */}
                {completedSteps.length > 0 && (
                    <details className="group/completed rounded-xl border border-border bg-black/10 mt-4">
                        <summary className="flex cursor-pointer list-none select-none items-center justify-between p-4 text-xs font-semibold text-muted-foreground hover:text-foreground">
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 rounded bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-[10px]">✓</span>
                                Étapes terminées ({completedSteps.length})
                            </span>
                            <span className="text-xs text-muted-foreground group-open/completed:rotate-180 transition-transform">
                                ▼
                            </span>
                        </summary>
                        <div className="space-y-2 p-3 pt-0">
                            {completedSteps.map((step) => (
                                <StepRow
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
    );
}
