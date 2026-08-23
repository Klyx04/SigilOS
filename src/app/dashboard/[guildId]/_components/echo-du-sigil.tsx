"use client";

import { FocusCardData } from "@/server/actions/intelligence-actions";
import { motion } from "framer-motion";
import { Radio, InfinityIcon, ArrowRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function EchoDuSigil({ data }: { data: FocusCardData }) {
    if (!data) return null;

    return (
        <div className="relative">
            <div className="relative bg-surface p-8 md:p-12 rounded-3xl border border-border overflow-hidden">

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                    <div className="space-y-6 max-w-3xl">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-2xl bg-guild/10 border border-guild/20 flex items-center justify-center ">
                                <Radio className="w-5 h-5 text-guild" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-caption font-black uppercase tracking-widest text-guild">Intelligence Focus</span>
                                <h2 className="text-2xl md:text-5xl font-black tracking-tighter text-foreground leading-[1.1]">
                                     {data.title}
                                 </h2>
                            </div>
                        </div>

                        <p className="text-muted-foreground text-sm md:text-lg font-medium leading-relaxed max-w-2xl pt-2">
                            {data.description}
                        </p>

                        <div className="flex items-center gap-6 pt-4">
                            <Button asChild className="h-12 bg-background text-foreground hover:bg-surface font-bold px-8 rounded-2xl group/btn transition-colors active:scale-95">
                                <Link href={data.actionHref}>
                                    <span className="flex items-center gap-3">
                                        {data.actionLabel}
                                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                    </span>
                                </Link>
                            </Button>

                            {data.priority > 80 && (
                                <Badge variant="outline" className="border-guild/30 bg-guild/5 text-guild/80 font-black uppercase tracking-widest text-caption py-1 px-3 h-8">
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
                                        stroke="currentColor"
                                        strokeWidth="1"
                                        className="text-foreground opacity-[0.03]"
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
                                        transition={{ duration: 1, ease: "circOut" }}
                                        className="text-success"
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-caption font-black text-muted-foreground uppercase tracking-widest mb-1">Score</span>
                                    <span className="text-4xl font-black text-foreground tracking-tighter">{Math.round(data.priority)}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="w-40 h-40 flex items-center justify-center">
                                {data.type === "SONGES_RECRUIT" && <InfinityIcon className="w-24 h-24 text-info opacity-30" />}
                                {data.type === "WELCOME" && <Zap className="w-24 h-24 text-warning opacity-30" />}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
