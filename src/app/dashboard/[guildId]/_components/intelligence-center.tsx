"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowRight, BrainCircuit, Target, Users } from "lucide-react";
import Link from "next/link";
import { FocusCardData } from "@/server/actions/intelligence-actions";
import { motion } from "framer-motion";

export function IntelligenceCenter({ data }: { data: FocusCardData }) {
    const icons = {
        OCRE_STEP: <Target className="w-6 h-6 text-warning" />,
        SONGES_RECRUIT: <Users className="w-6 h-6 text-info" />,
        MISSION_URGENT: <Sparkles className="w-6 h-6 text-success" />,
        WELCOME: <BrainCircuit className="w-6 h-6 text-primary" />,
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
        >
            <Card className="relative overflow-hidden group border-none bg-background/40 backdrop-blur-2xl ">
                {/* Liquid Glass Effects */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
                <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none" />

                <CardContent className="p-8 relative z-10 flex flex-col md:flex-row items-center gap-8">
                    {/* Visual Indicator */}
                    <div className="relative h-16 w-16 shrink-0 flex items-center justify-center rounded-2xl bg-surface border border-border shadow-inner">
                        <div className="absolute inset-0 blur-xl bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        {icons[data.type]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 text-center md:text-left space-y-2">
                        <div className="flex items-center justify-center md:justify-start gap-3">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-black text-caption tracking-widest uppercase py-0.5">
                                FOCUS INTELLIGENCE
                            </Badge>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight leading-none">
                            {data.title}
                        </h2>
                        <p className="text-muted-foreground font-medium text-sm md:text-base max-w-xl">
                            {data.description}
                        </p>
                    </div>

                    {/* Action */}
                    <div className="shrink-0">
                        <Link href={data.actionHref}>
                            <Button size="lg" className="rounded-full px-8 font-black group/btn bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/20 transition-all  active:scale-95">
                                {data.actionLabel}
                                <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                    </div>
                </CardContent>

                {/* Bottom Status Bar */}
                <div className="h-1 w-full bg-surface overflow-hidden relative">
                    <motion.div
                        className="absolute inset-y-0 left-0 bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${data.priority}%` }}
                        transition={{ duration: 1.5, delay: 0.5, ease: "circOut" }}
                    />
                </div>
            </Card>
        </motion.div>
    );
}
