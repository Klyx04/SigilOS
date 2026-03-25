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
    links: React.ReactNode;
}

export function OverviewTabs({ stats, chart, communication, worker, links }: OverviewTabsProps) {
    const [activeSubTab, setActiveSubTab] = useState<"performance" | "communication" | "system">("performance");

    const TABS = [
        { id: "performance", label: "Performance", icon: Activity, color: "text-violet-400" },
        { id: "communication", label: "Communication", icon: Megaphone, color: "text-amber-400" },
        { id: "system", label: "Système & Labs", icon: ShieldCheck, color: "text-emerald-400" },
    ] as const;

    return (
        <div className="space-y-10">
            {/* Sub-navigation for Overview */}
            <div className="flex gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit overflow-x-auto no-scrollbar">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={cn(
                            "flex items-center gap-3 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 relative whitespace-nowrap",
                            activeSubTab === tab.id
                                ? "bg-white/5 text-white shadow-xl border border-white/10"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] border border-transparent"
                        )}
                    >
                        <tab.icon className={cn(
                            "h-4 w-4 transition-all duration-500",
                            activeSubTab === tab.id ? "text-white scale-110" : "text-zinc-600"
                        )} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                {activeSubTab === "performance" && (
                    <div className="space-y-10">
                        {stats && <div className="animate-in fade-in duration-500">{stats}</div>}
                        <div className="bg-zinc-900/10 border border-white/5 rounded-3xl p-8 backdrop-blur-xl">
                            {chart}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {links}
                        </div>
                    </div>
                )}

                {activeSubTab === "communication" && (
                    <div className="max-w-6xl">
                        {communication}
                    </div>
                )}

                {activeSubTab === "system" && (
                    <div className="space-y-10">
                        <div className="space-y-6">
                            <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] ml-6 italic">État des Infrastructures</h3>
                            <SystemHealthDashboard />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start text-left">
                            <div className="p-10 rounded-[3rem] bg-zinc-900/10 border border-white/5 backdrop-blur-3xl space-y-8">
                                <div className="space-y-2">
                                    <h4 className="text-xl font-black text-white uppercase tracking-tight">Worker Platform Sync</h4>
                                    <p className="text-zinc-500 text-sm leading-relaxed">Outils de diagnostic pour forcer la synchronisation des données externes (Ladder, Metamob, Items).</p>
                                </div>
                                <div className="animate-in fade-in duration-500">
                                    {worker}
                                </div>
                            </div>
                            
                            <div className="p-10 rounded-[3rem] bg-zinc-900/10 border border-white/5 backdrop-blur-3xl space-y-8">
                                <div className="space-y-2">
                                    <h4 className="text-xl font-black text-zinc-500 uppercase tracking-tight">Maintenance Platform</h4>
                                    <p className="text-zinc-500 text-sm leading-relaxed">Nettoyage automatique et protocoles d'hygiène de la base de données.</p>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    {links} 
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
