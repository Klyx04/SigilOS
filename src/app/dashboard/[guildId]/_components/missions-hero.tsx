"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollText, ArrowRight, Zap, Target, BookOpen } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export function MissionsHero({ 
    guildId,
    totalMissionsValidated = 0,
    totalXp = 0
}: { 
    guildId: string;
    totalMissionsValidated?: number;
    totalXp?: number;
}) {
    return (
        <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-success to-teal-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-300 group-hover:duration-200"></div>
            
            <Card className="relative glass-premium border-border overflow-hidden rounded-[2rem] min-h-[220px] flex flex-col md:flex-row items-center border-t-emerald-500/20">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(circle_at_70%_30%,rgba(16,185,129,0.1),transparent_70%)] pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-success/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
                
                <CardContent className="flex-1 p-8 md:p-10 flex flex-col md:flex-row items-center gap-8 z-10 w-full">
                    {/* Left: Icon & Title */}
                    <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-4">
                        <div className="p-4 bg-success/10 rounded-2xl border border-success/20 relative group- transition-transform duration-300">
                            <ScrollText className="w-10 h-10 text-success" />
                            <Zap className="w-5 h-5 text-warning absolute -top-1 -right-1 animate-bounce" />
                        </div>
                        <div>
                            <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-foreground uppercase italic">
                                Missions <span className="text-success text-success">de Guilde</span>
                            </h2>
                            <p className="text-muted-foreground font-bold text-sm md:text-base mt-2 max-w-[400px]">
                                Relevez les défis hebdomadaires pour faire briller le Sigil et gagner des récompenses exclusives.
                            </p>
                        </div>
                    </div>

                    {/* Middle: Quick stats or highlight */}
                    <div className="flex flex-1 justify-center gap-10">
                        <div className="space-y-1 text-center">
                            <p className="text-caption font-black text-muted-foreground uppercase tracking-widest">VALIDÉES</p>
                            <p className="text-4xl font-black text-foreground tracking-tighter tabular-nums">{totalMissionsValidated}</p>
                        </div>
                        <div className="w-px h-12 bg-border self-center" />
                        <div className="space-y-1 text-center">
                            <p className="text-caption font-black text-muted-foreground uppercase tracking-widest">GLOIRE</p>
                            <p className="text-4xl font-black text-success text-success tracking-tighter tabular-nums">+{totalXp}</p>
                        </div>
                    </div>

                    {/* Right: CTA */}
                    <div className="w-full md:w-auto flex flex-col gap-3">
                        <Link href={`/dashboard/${guildId}/missions`} className="w-full h-full">
                            <Button className="w-full md:w-56 h-16 bg-success hover:bg-success text-success-foreground font-black uppercase tracking-widest text-lg rounded-2xl   transition-all group/btn border-t border-border-strong">
                                REJOINDRE
                                <ArrowRight className="ml-2 w-6 h-6 group-hover/btn:translate-x-2 transition-transform" />
                            </Button>
                        </Link>
                        <Link href="/docs?tab=missions" className="text-center text-caption font-black text-muted-foreground hover:text-success dark:hover:text-success uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                            <BookOpen className="w-3 h-3" />
                            Comprendre le système
                        </Link>
                    </div>
                </CardContent>

                {/* Animated progress bar at bottom */}
                <div className="absolute bottom-0 left-0 w-full h-1.5 bg-foreground/5">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "65%" }}
                        transition={{ duration: 2, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-success to-teal-400 relative"
                    >
                        <div className="absolute inset-0 bg-elevated animate-pulse" />
                    </motion.div>
                </div>
            </Card>
        </div>
    );
}
