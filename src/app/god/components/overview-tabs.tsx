"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Activity, Megaphone, ShieldCheck, Zap } from "lucide-react";
import { SystemHealthDashboard } from "./system-health-dashboard";

interface OverviewTabsProps {
    stats: React.ReactNode;
    chart: React.ReactNode;
    communication: React.ReactNode;
    worker: React.ReactNode;
}

export function OverviewTabs({ stats, chart, communication, worker }: OverviewTabsProps) {
    return (
        <div className="space-y-12">
            {/* Section 1: System Status & Infrastructure (Immediate Full-Width Visibility) */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">
                        État des Services & Infrastructures
                    </h3>
                </div>
                <SystemHealthDashboard />
            </div>

            {/* Section 2: Unified Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Left Column (2 Cols): Communication & System Announcements */}
                <div className="lg:col-span-2 space-y-6">
                    {communication}
                </div>

                {/* Right Column (1 Col): Worker Controls & Quick Admin Tools */}
                <div className="lg:col-span-1 space-y-6 sticky top-6">
                    {/* Worker Sync Card */}
                    <div className="p-6 rounded-3xl bg-zinc-900/30 border border-white/5 backdrop-blur-xl space-y-4 shadow-xl">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                            <Zap className="w-4 h-4 text-violet-400" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">
                                Worker Sync & Diagnostic
                            </h3>
                        </div>
                        <p className="text-zinc-500 text-xs font-medium leading-relaxed">
                            Outils de forçage manuel et réinitialisation des caches externes (Ladder, Metamob, Items Dofus).
                        </p>
                        {worker}
                    </div>
                </div>
            </div>
        </div>
    );
}
