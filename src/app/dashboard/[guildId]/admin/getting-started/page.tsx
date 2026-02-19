import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserContext } from "@/server/actions/user-actions";
import { getGettingStartedProgress } from "@/server/actions/onboarding-actions";
import { UnifiedModuleHeader } from "@/components/layout/unified-module-header";
import { Sparkles, CheckCircle2, Circle, ArrowRight, Rocket, Shield, Puzzle, BookOpen, Swords, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AuroraBackground } from "@/components/ui/aurora-background";

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
        discord: Shield,
        modules: Puzzle,
        presentation: BookOpen,
        missions: Swords,
        members: Users,
    };

    return (
        <div className="relative min-h-full pb-20 space-y-10">
            {/* Ambient Background */}
            <AuroraBackground className="absolute inset-0 z-0 opacity-10 pointer-events-none" />

            <div className="relative z-10 space-y-10">
                <UnifiedModuleHeader
                    title="Mise en route"
                    description="Configurez votre guilde en 5 étapes clés"
                    icon={Rocket}
                    backHref={`/dashboard/${guildId}/admin`}
                />

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
                                <h2 className="text-2xl font-black text-white tracking-tight uppercase">Progression de l'installation</h2>
                                <p className="text-zinc-400 font-medium">
                                    {percent === 100
                                        ? "Votre guilde est parfaitement configurée ! Vous êtes prêt à dominer le Monde des Douze."
                                        : "Suivez ces étapes pour débloquer tout le potentiel de SigilOS pour vos membres."}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Steps List */}
                <div className="grid grid-cols-1 gap-4 mx-1">
                    {progress.steps.map((step, idx) => {
                        const Icon = iconMap[step.id] || Sparkles;
                        const isCompleted = step.status === "COMPLETED";
                        const isInProgress = step.status === "IN_PROGRESS";

                        return (
                            <div
                                key={step.id}
                                className={cn(
                                    "group relative glass-premium p-6 rounded-xl border transition-all duration-300",
                                    isCompleted ? "border-emerald-500/20 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.05)]" : "border-white/10 hover:border-white/20"
                                )}
                            >
                                <div className="flex items-start gap-6">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110",
                                        isCompleted ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-zinc-400"
                                    )}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className={cn(
                                                "text-lg font-black tracking-tight uppercase",
                                                isCompleted ? "text-emerald-400" : "text-white"
                                            )}>
                                                {idx + 1}. {step.title}
                                            </h3>
                                            {isCompleted && (
                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[8px] font-black uppercase">Terminé</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-zinc-400 font-medium leading-relaxed max-w-2xl">
                                            {step.description}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end justify-center h-full pt-2">
                                        <Button
                                            asChild
                                            variant={isCompleted ? "outline" : "default"}
                                            className={cn(
                                                "font-black uppercase tracking-widest text-[10px] px-6 h-10",
                                                isCompleted ? "border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/5" : "bg-white text-black hover:bg-zinc-200"
                                            )}
                                        >
                                            <Link href={step.href}>
                                                {isCompleted ? "Revoir" : "Configurer"}
                                                <ArrowRight className="ml-2 w-3 h-3 group-hover:translate-x-1 transition-transform" />
                                            </Link>
                                        </Button>
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

function Badge({ children, className, variant }: any) {
    return (
        <span className={cn(
            "px-2 py-0.5 rounded-full text-[10px]",
            className
        )}>
            {children}
        </span>
    );
}
