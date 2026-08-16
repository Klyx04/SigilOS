"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Check, Shield, ScrollText, BookOpen, Sparkles, Zap, ArrowRight, CheckCircle2, Infinity as InfinityIcon, Users, AlertCircle, Rocket, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";
import { useEffect, useState } from "react";

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
    guideHref,
    variant = "admin",
    dismissible = false,
    storageKey
}: {
    guildId: string,
    steps: OnboardingStep[],
    title?: string,
    subtitle?: string,
    checklistLabel?: string,
    guideHref?: string,
    variant?: "admin" | "user",
    dismissible?: boolean,
    storageKey?: string
}) {
    const [isDismissed, setIsDismissed] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (storageKey) {
            const dismissed = localStorage.getItem(`sigilos-dismiss-${storageKey}`);
            if (dismissed === "true") setIsDismissed(true);
        }
    }, [storageKey]);

    const handleDismiss = () => {
        setIsDismissed(true);
        if (storageKey) {
            localStorage.setItem(`sigilos-dismiss-${storageKey}`, "true");
        }
    };

    const completedSteps = steps.filter(s => s.completed).length;
    const progress = (completedSteps / steps.length) * 100;
    const isFinished = completedSteps === steps.length;

    // Automatic dismissal if everything is done — don't show the banner anymore
    useEffect(() => {
        if (mounted && isFinished) {
            handleDismiss();
        }
    }, [isFinished, mounted]);

    const iconMap = {
        shield: Shield,
        "scroll-text": ScrollText,
        "book-open": BookOpen,
        infinity: InfinityIcon,
        users: Users,
        sparkles: Sparkles,
        zap: Zap,
        rocket: Rocket
    };

    if (isDismissed || !mounted) return null;

    return (
        <div className="relative group/onboarding w-full">
            {/* Animated Glow when incomplete */}
            {!isFinished && (
                <div className={cn(
                    "absolute -inset-[2px] rounded-2xl blur-md opacity-30 animate-pulse-slow",
                    variant === "user" ? "bg-gradient-to-r from-info/40 via-info/40 to-info/40" : "bg-gradient-to-r from-success/40 via-teal-500/40 to-success/40"
                )} />
            )}

            <div className={cn(
                "relative glass-premium p-6 md:p-8 rounded-2xl border border-border overflow-hidden transition-all duration-300 group-hover/onboarding:border-border-strong",
                variant === "user" ? "ring-1 ring-info/20 " : "ring-1 ring-success/20 ",
                !isFinished ? "opacity-100" : "opacity-90"
            )}>
                {dismissible && (
                    <button
                        onClick={handleDismiss}
                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-surface text-muted-foreground hover:text-foreground transition-all z-20 group/close"
                    >
                        <X className="w-4 h-4 group-hover/close:rotate-90 transition-transform" />
                    </button>
                )}
                
                {!isFinished && (
                    <BorderBeam
                        size={200}
                        duration={6}
                        colorFrom={variant === "user" ? "#3b82f6" : "#10b981"}
                        colorTo={variant === "user" ? "#60a5fa" : "#34d399"}
                    />
                )}

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-6 flex-1 max-w-2xl">
                        <div className="flex items-start gap-4">
                            <div className={cn(
                                "p-3 rounded-2xl border transition-colors",
                                !isFinished
                                    ? (variant === "user" ? "bg-info/20 border-info/30 text-info group-hover/onboarding:scale-110 duration-300" : "bg-success/20 border-success/30 text-success group-hover/onboarding:scale-110 duration-300")
                                    : "bg-muted/10 border-border text-muted-foreground"
                            )}>
                                {isFinished ? (
                                    <CheckCircle2 className="w-6 h-6" />
                                ) : (
                                    variant === "user" ? <Sparkles className="w-6 h-6 animate-pulse" /> : <Rocket className="w-6 h-6 animate-bounce-subtle" />
                                )}
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "text-caption font-black uppercase tracking-widest leading-none",
                                        variant === "user" ? "text-info/80" : "text-success/80"
                                    )}>
                                        {isFinished ? (variant === "user" ? "Prêt pour l'aventure" : "Succès") : (variant === "user" ? "Préparation" : "Configuration Nécessaire")}
                                    </span>
                                    {!isFinished && (
                                        <div className={cn(
                                            "flex items-center gap-1 px-1.5 py-0.5 rounded-full border",
                                            variant === "user" ? "bg-info/10 border-info/20" : "bg-success/10 border-success/20"
                                        )}>
                                            <span className={cn(
                                                "w-1 h-1 rounded-full animate-ping",
                                                variant === "user" ? "bg-info" : "bg-success"
                                            )} />
                                            <span className={cn(
                                                "text-caption font-black uppercase tracking-tighter",
                                                variant === "user" ? "text-info" : "text-success"
                                            )}>Priorité</span>
                                        </div>
                                    )}
                                </div>
                                <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground">
                                    {isFinished
                                        ? (variant === "user" ? "Votre profil est prêt !" : "Votre Guilde est prête !")
                                        : title}
                                </h2>
                                <p className="text-muted-foreground text-sm font-medium leading-relaxed max-w-md">
                                    {isFinished
                                        ? (variant === "user"
                                            ? "Vous avez configuré les piliers essentiels de votre identité. Profitez pleinement de SigilOS !"
                                            : "Tous les systèmes sont opérationnels. Vos membres peuvent désormais profiter pleinement du dashboard.")
                                        : (variant === "user"
                                            ? "Suivez ces quelques étapes pour préparer votre profil et faciliter votre intégration dans l'écosystème de la guilde."
                                            : "Il reste quelques étapes pour que votre guilde bénéficie de l'expérience complète de SigilOS.")}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-2">
                            {guideHref && !isFinished && (
                                <Button asChild variant={variant === "user" ? "sigil" : "sigil-emerald"} className="h-12 px-8">
                                    <Link href={guideHref}>
                                        {variant === "user" ? "MON PARCOURS" : "AVANCEMENT"}
                                        <ArrowRight className="ml-2 w-5 h-5 group-hover/btn:translate-x-2 transition-transform" />
                                    </Link>
                                </Button>
                            )}

                            <div className="flex-1 min-w-[200px] space-y-2">
                                <div className="flex justify-between text-caption font-black uppercase tracking-widest">
                                    <span className="text-muted-foreground">{checklistLabel}</span>
                                    <span className={variant === "user" ? "text-info" : "text-success"}>{completedSteps} / {steps.length}</span>
                                </div>
                                <div className="h-2 w-full bg-surface rounded-full overflow-hidden border border-border">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className={cn(
                                            "h-full transition-all duration-300",
                                            variant === "user" ? "bg-gradient-to-r from-info to-info " : "bg-gradient-to-r from-success to-success "
                                        )}
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
                                            "relative p-4 rounded-2xl border transition-all  active:scale-95 group/step flex flex-col items-center gap-3 min-w-[90px]",
                                            step.completed
                                                ? (variant === "user" ? "bg-info/10 border-info/30 text-info " : "bg-success/10 border-success/30 text-success")
                                                : "bg-surface border-border text-muted-foreground hover:border-border-strong hover:bg-surface"
                                        )}
                                    >
                                        <Icon className={cn("w-6 h-6", !step.completed && "grayscale opacity-50")} />
                                        <span className="text-caption font-black uppercase tracking-widest text-center leading-tight">{step.title}</span>

                                        {step.completed && (
                                            <div className={cn(
                                                "absolute -top-1.5 -right-1.5 rounded-full p-1 border-2 border-zinc-950 shadow-lg",
                                                variant === "user" ? "bg-info" : "bg-success"
                                            )}>
                                                <Check className="w-2.5 h-2.5 text-foreground" />
                                            </div>
                                        )}

                                        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-surface border border-border p-2 rounded-lg opacity-0 group-hover/step:opacity-100 pointer-events-none transition-all z-50 whitespace-nowrap scale-90 group-hover/step:scale-100 origin-top">
                                            <p className="text-caption font-black uppercase tracking-widest text-foreground">{step.description}</p>
                                        </div>
                                    </motion.div>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className="absolute -bottom-10 -right-10 p-8 opacity-[0.03] pointer-events-none group-hover/onboarding:opacity-[0.07] transition-opacity duration-300 group-hover/onboarding:rotate-0 rotate-12">
                    {variant === "user" ? <Sparkles className="w-64 h-64 text-foreground" /> : <Shield className="w-64 h-64 text-foreground" />}
                </div>
            </div>
        </div>
    );
}
