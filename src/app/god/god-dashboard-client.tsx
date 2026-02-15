"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    LayoutDashboard,
    Wrench,
    ShieldAlert,
    Terminal,
    Activity,
    Settings2
} from "lucide-react";

interface GodDashboardClientProps {
    overview: React.ReactNode;
    maintenance: React.ReactNode;
    logs: React.ReactNode;
    systems: React.ReactNode;
}

export function GodDashboardClient({
    overview,
    maintenance,
    logs,
    systems
}: GodDashboardClientProps) {
    const [activeTab, setActiveTab] = useState("overview");

    return (
        <Tabs defaultValue="overview" onValueChange={setActiveTab} className="space-y-12">
            <div className="flex items-center justify-between border-b border-white/5 pb-6 sticky top-0 bg-black/50 backdrop-blur-xl z-50">
                <TabsList className="bg-zinc-900/50 border border-white/5 p-1 rounded-2xl h-14">
                    <TabsTrigger
                        value="overview"
                        className="rounded-xl px-8 h-full data-[state=active]:bg-violet-500 data-[state=active]:text-white gap-3 font-bold uppercase tracking-widest text-[10px]"
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Vue d'ensemble
                    </TabsTrigger>
                    <TabsTrigger
                        value="maintenance"
                        className="rounded-xl px-8 h-full data-[state=active]:bg-amber-500 data-[state=active]:text-white gap-3 font-bold uppercase tracking-widest text-[10px]"
                    >
                        <Wrench className="w-4 h-4" />
                        Maintenance
                    </TabsTrigger>
                    <TabsTrigger
                        value="logs"
                        className="rounded-xl px-8 h-full data-[state=active]:bg-blue-500 data-[state=active]:text-white gap-3 font-bold uppercase tracking-widest text-[10px]"
                    >
                        <ShieldAlert className="w-4 h-4" />
                        Sécurité & Logs
                    </TabsTrigger>
                    <TabsTrigger
                        value="systems"
                        className="rounded-xl px-8 h-full data-[state=active]:bg-zinc-700 data-[state=active]:text-white gap-3 font-bold uppercase tracking-widest text-[10px]"
                    >
                        <Terminal className="w-4 h-4" />
                        Systèmes & API
                    </TabsTrigger>
                </TabsList>

                <div className="hidden md:flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em]">
                        <Activity className="w-3 h-3 text-emerald-500" />
                        Engine: 1.2.0-beta
                    </div>
                </div>
            </div>

            <TabsContent value="overview" className="mt-0 space-y-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {overview}
            </TabsContent>

            <TabsContent value="maintenance" className="mt-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {maintenance}
            </TabsContent>

            <TabsContent value="logs" className="mt-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {logs}
            </TabsContent>

            <TabsContent value="systems" className="mt-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {systems}
            </TabsContent>
        </Tabs>
    );
}
