"use client";

import { FocusCardData } from "@/server/actions/intelligence-actions";
import { motion } from "framer-motion";
import { Sparkles, InfinityIcon, ArrowRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function EchoDuSigil({ data }: { data: FocusCardData }) {
    if (!data) return null;

    return (
        <div className="relative group perspective-1000">
            {/* Ambient Background Glow (Subtle) */}
            <div className="absolute -inset-10 bg-indigo-500/5 rounded-[40px] blur-[100px] opacity-50 pointer-events-none group-hover:opacity-100 transition-opacity duration-1000" />

            <div className="relative glass-premium p-8 md:p-12 rounded-3xl border border-white/5 overflow-hidden group-hover:border-white/10 transition-all duration-500">
                {/* Decorative Pattern Layer */}
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity duration-700">
                    <svg width="240" height="240" viewBox="0 0 120 120" fill="none" className="animate-spin-slow">
                        <circle cx="60" cy="60" r="58" stroke="white" strokeWidth="0.2" strokeDasharray="4 4" />
                        <circle cx="60" cy="60" r="40" stroke="white" strokeWidth="0.2" strokeDasharray="2 8" />
                        <path d="M60 2L62 58L118 60L62 62L60 118L58 62L2 60L58 58Z" stroke="white" strokeWidth="0.1" />
                    </svg>
                </div>

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                    <div className="space-y-6 max-w-3xl">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                                <Sparkles className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Intelligence Focus</span>
                                <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white leading-tight">
                                    {data.title}
                                </h2>
                            </div>
                        </div>

                        <p className="text-zinc-400 text-base md:text-lg font-medium leading-relaxed max-w-2xl pt-2">
                            {data.description}
                        </p>

                        <div className="flex items-center gap-6 pt-4">
                            <Button asChild className="h-12 bg-white text-black hover:bg-zinc-100 font-bold px-8 rounded-2xl group/btn transition-all hover:scale-105 active:scale-95 shadow-[0_10px_30px_rgba(255,255,255,0.1)]">
                                <Link href={data.actionHref}>
                                    <span className="flex items-center gap-3">
                                        {data.actionLabel}
                                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                    </span>
                                </Link>
                            </Button>

                            {data.priority > 80 && (
                                <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/5 text-indigo-400/80 font-black uppercase tracking-widest text-[9px] py-1 px-3 h-8 shadow-[inset_0_0_12px_rgba(99,102,241,0.1)]">
                                    Priorité Critique
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* High-Fidelity Indicator */}
                    <div className="flex shrink-0">
                        {data.type === "OCRE_STEP" ? (
                            <div className="relative w-40 h-40 group/progress">
                                <svg className="w-full h-full transform -rotate-90">
                                    {/* Track */}
                                    <circle
                                        cx="80"
                                        cy="80"
                                        r="74"
                                        fill="transparent"
                                        stroke="white"
                                        strokeWidth="1"
                                        className="opacity-[0.03]"
                                    />
                                    {/* Fill */}
                                    <motion.circle
                                        cx="80"
                                        cy="80"
                                        r="74"
                                        fill="transparent"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        strokeDasharray="465"
                                        initial={{ strokeDashoffset: 465 }}
                                        animate={{ strokeDashoffset: 465 - (465 * (data.priority / 100)) }}
                                        transition={{ duration: 2, ease: "circOut" }}
                                        className="text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all duration-500 group-hover/progress:scale-110">
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Score</span>
                                    <span className="text-4xl font-black text-white tracking-tighter">{Math.round(data.priority)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="w-40 h-40 flex items-center justify-center">
                                <div className="absolute inset-0 bg-white/5 rounded-full blur-3xl opacity-20 scale-50" />
                                {data.type === "SONGES_RECRUIT" && <InfinityIcon className="w-24 h-24 text-indigo-300 drop-shadow-[0_0_20px_#818cf8] opacity-30" />}
                                {data.type === "WELCOME" && <Zap className="w-24 h-24 text-amber-300 drop-shadow-[0_0_20px_#fbbf24] opacity-30" />}
                            </div>
                        )}
                    </div>
                </div>

                {/* Subtle Decorative Line */}
                <div className="absolute bottom-0 left-0 h-1 w-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent w-full" />
                </div>
            </div>
        </div>
    );
}
