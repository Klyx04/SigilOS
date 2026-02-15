"use client";

import { motion } from "framer-motion";
import { Check, Shield, ScrollText, BookOpen, Sparkles, Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
    steps
}: {
    guildId: string,
    steps: OnboardingStep[]
}) {
    const completedSteps = steps.filter(s => s.completed).length;
    const progress = (completedSteps / steps.length) * 100;

    const iconMap = {
        shield: Shield,
        "scroll-text": ScrollText,
        "book-open": BookOpen
    };

    return (
        <div className="relative group/onboarding h-full w-full">
            {/* Background Glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl blur opacity-25 group-hover/onboarding:opacity-50 transition duration-1000" />

            <div className="relative glass-premium p-6 rounded-2xl border border-white/10 h-full flex flex-col justify-between overflow-hidden bg-zinc-950/20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                    <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                <Zap className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400/80 leading-none">Configuration</span>
                                <h2 className="text-xl font-black tracking-tighter text-white">Éveil du Sigil</h2>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                <span>Installation</span>
                                <span>{completedSteps} / {steps.length}</span>
                            </div>
                            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {steps.map((step) => {
                            const Icon = iconMap[step.icon as keyof typeof iconMap] || Sparkles;
                            return (
                                <Link key={step.id} href={step.href}>
                                    <div
                                        className={cn(
                                            "relative p-3 rounded-xl border transition-all hover:scale-105 active:scale-95 group/step",
                                            step.completed
                                                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                                                : "bg-white/5 border-white/10 text-zinc-500 hover:border-white/20"
                                        )}
                                    >
                                        <Icon className="w-5 h-5" />
                                        {step.completed && (
                                            <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-zinc-950">
                                                <Check className="w-2 h-2 text-white" />
                                            </div>
                                        )}
                                        {/* Tooltip-like label on hover */}
                                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900 border border-white/10 p-2 rounded-lg opacity-0 group-hover/step:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-white">{step.title}</p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <Shield className="w-32 h-32 text-white rotate-12" />
                </div>
            </div>
        </div>
    );
}
