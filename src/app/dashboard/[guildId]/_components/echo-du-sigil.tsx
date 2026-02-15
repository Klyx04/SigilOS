"use client";

import { FocusCardData } from "@/server/actions/intelligence-actions";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Target, InfinityIcon, ScrollText, ArrowRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function EchoDuSigil({ data }: { data: FocusCardData }) {
    if (!data) return null;

    return (
        <div className="relative group">
            {/* Ambient Glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-emerald-500/20 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />

            <div className="relative glass-premium p-6 md:p-8 rounded-2xl border border-white/10 overflow-hidden bg-zinc-950/40 backdrop-blur-2xl">
                {/* Micro-texture Noise Overlay */}
                <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none" />

                {/* Decorative SVG Pattern (Subtle) */}
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="animate-spin-slow">
                        <circle cx="60" cy="60" r="58" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" />
                        <circle cx="60" cy="60" r="40" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 8" />
                    </svg>
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-4 max-w-2xl">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                                <Sparkles className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400/80">L'Écho du Sigil</span>
                                <h2 className="text-2xl md:text-3xl font-black tracking-tighter text-white">
                                    {data.title}
                                </h2>
                            </div>
                        </div>

                        <p className="text-zinc-400 font-medium leading-loose max-w-lg pt-1">
                            {data.description}
                        </p>

                        <div className="flex items-center gap-4 pt-2">
                            <Button asChild className="bg-white text-black hover:bg-zinc-200 font-black px-6 group/btn relative overflow-hidden">
                                <Link href={data.actionHref}>
                                    <span className="relative z-10 flex items-center gap-2">
                                        {data.actionLabel}
                                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                    </span>
                                </Link>
                            </Button>

                            {data.priority > 80 && (
                                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-black uppercase tracking-widest text-[10px] py-1 animate-pulse">
                                    Recommandé
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Visual Progress/Scoring Indicator */}
                    <div className="hidden lg:flex flex-col items-center gap-2">
                        <div className="relative w-32 h-32">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle
                                    cx="64"
                                    cy="64"
                                    r="60"
                                    fill="transparent"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="text-white/5"
                                />
                                <motion.circle
                                    cx="64"
                                    cy="64"
                                    r="60"
                                    fill="transparent"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                    strokeDasharray="377"
                                    initial={{ strokeDashoffset: 377 }}
                                    animate={{ strokeDashoffset: 377 - (377 * (data.priority / 100)) }}
                                    transition={{ duration: 1.5, ease: "easeOut" }}
                                    className="text-indigo-500 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-[10px] font-black text-zinc-500 uppercase">Urgence</span>
                                <span className="text-2xl font-black text-white">{data.priority}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Decorative Bar */}
                <div className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent w-full opacity-50" />
            </div>
        </div>
    );
}
