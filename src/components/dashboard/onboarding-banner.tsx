"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Shield, ScrollText, BookOpen, Sparkles, Zap, ArrowRight, CheckCircle2, Infinity as InfinityIcon, Users, AlertCircle, Rocket } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    href: string;
    completed: boolean;
    icon: string;
}

export function OnboardingBanner({
    guildId,
    steps,
    title = "Administration",
    subtitle = "Configuration",
    checklistLabel = "Checklist de configuration",
    guideHref
}: {
    guildId: string,
    steps: OnboardingStep[],
    title?: string,
    subtitle?: string,
    checklistLabel?: string,
    guideHref?: string
}) {
    const completedSteps = steps.filter(s => s.completed).length;
    const progress = (completedSteps / steps.length) * 100;
    const isFinished = completedSteps === steps.length;

    const iconMap = {
        shield: Shield,
        "scroll-text": ScrollText,
        "book-open": BookOpen,
        infinity: InfinityIcon,
        users: Users
    };

    return (
        <div className="relative group/onboarding w-full">
            {/* Animated Glow when incomplete */}
            {!isFinished && (
                <div className="absolute -inset-[2px] bg-gradient-to-r from-emerald-500/40 via-teal-500/40 to-emerald-500/40 rounded-2xl blur-md opacity-30 animate-pulse-slow" />
            )}

            <div className={cn(
                "relative glass-premium p-6 md:p-8 rounded-2xl border border-white/10 overflow-hidden transition-all duration-500",
                !isFinished ? "ring-1 ring-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]" : "opacity-90"
            )}>
                {!isFinished && <BorderBeam size={200} duration={6} colorFrom="#10b981" colorTo="#34d399" />}

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-6 flex-1 max-w-2xl">
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "p-3 rounded-2xl border transition-colors",
                                !isFinished
                                    ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 group-hover/onboarding:scale-110 duration-500"
                                    : "bg-zinc-500/10 border-white/10 text-zinc-400"
                            )}>
                                {isFinished ? <CheckCircle2 className="w-6 h-6" /> : <Rocket className="w-6 h-6 animate-bounce-subtle" />}
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400/80 leading-none">
                                        {isFinished ? "Succès" : "Configuration Nécessaire"}
                                    </span>
                                    {!isFinished && (
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                            <span className="w-1 h-1 rounded-full bg-emerald-400 animate-ping" />
                                            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tighter">Priorité</span>
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-white">
                                    {isFinished ? "Votre Guilde est prête !" : "Finalisez votre installation"}
                                </h2>
                                <p className="text-zinc-400 text-sm font-medium leading-relaxed max-w-md">
                                    {isFinished
                                        ? "Tous les systèmes sont opérationnels. Vos membres peuvent désormais profiter pleinement du dashboard."
                                        : "Il reste quelques étapes pour que votre guilde bénéficie de l'expérience complète de SigilOS."}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-2">
                            {guideHref && !isFinished && (
                                <Button asChild className="bg-emerald-500 hover:bg-emerald-400 text-black font-black px-8 py-6 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all group/btn">
                                    <Link href={guideHref}>
                                        AVANCEMENT
                                        <ArrowRight className="ml-2 w-5 h-5 group-hover/btn:translate-x-2 transition-transform" />
                                    </Link>
                                </Button>
                            )}

                            <div className="flex-1 min-w-[200px] space-y-2">
                                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-zinc-500">{checklistLabel}</span>
                                    <span className="text-emerald-400">{completedSteps} / {steps.length}</span>
                                </div>
                                <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 sm:flex items-center gap-4">
                        {steps.map((step, idx) => {
                            const Icon = iconMap[step.icon as keyof typeof iconMap] || Sparkles;
                            return (
                                <Link key={step.id} href={step.href} className="contents">
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 * idx }}
                                        className={cn(
                                            "relative p-4 rounded-2xl border transition-all hover:scale-110 active:scale-95 group/step flex flex-col items-center gap-3 min-w-[90px]",
                                            step.completed
                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                                : "bg-white/5 border-white/10 text-zinc-500 hover:border-white/30 hover:bg-white/10"
                                        )}
                                    >
                                        <Icon className={cn("w-6 h-6", !step.completed && "grayscale opacity-50")} />
                                        <span className="text-[8px] font-black uppercase tracking-widest text-center">{step.title}</span>

                                        {step.completed && (
                                            <div className="absolute -top-1.5 -right-1.5 bg-emerald-500 rounded-full p-1 border-2 border-zinc-950 shadow-lg">
                                                <Check className="w-2.5 h-2.5 text-white" />
                                            </div>
                                        )}

                                        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 p-2 rounded-lg opacity-0 group-hover/step:opacity-100 pointer-events-none transition-all z-50 whitespace-nowrap scale-90 group-hover/step:scale-100 origin-top">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-white">{step.description}</p>
                                        </div>
                                    </motion.div>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className="absolute -bottom-10 -right-10 p-8 opacity-[0.03] pointer-events-none group-hover/onboarding:opacity-[0.07] transition-opacity duration-1000 group-hover/onboarding:rotate-0 rotate-12">
                    <Shield className="w-64 h-64 text-white" />
                </div>
            </div>
        </div>
    );
}
