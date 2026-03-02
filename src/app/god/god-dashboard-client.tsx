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
    guilds: React.ReactNode;
    infrastructure: React.ReactNode;
    security: React.ReactNode;
}

export function GodDashboardClient({
    overview,
    guilds,
    infrastructure,
    security
}: GodDashboardClientProps) {
    const [activeTab, setActiveTab] = useState("overview");

    return (
        <Tabs defaultValue="overview" onValueChange={setActiveTab} orientation="vertical" className="flex flex-col lg:flex-row gap-12 max-w-[1400px] mx-auto">
            {/* Sidebar Navigation */}
            <div className="lg:w-72 flex-shrink-0">
                <div className="sticky top-24 bg-zinc-900/30 backdrop-blur-xl border border-white/5 p-3 rounded-3xl shadow-2xl space-y-2">
                    <div className="px-4 py-3 mb-2">
                        <div className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-1">
                            Navigation
                        </div>
                        <div className="flex items-center gap-2 text-[10px] uppercase text-emerald-500 font-bold tracking-widest bg-emerald-500/10 px-2 py-1 rounded-full w-max mt-2">
                            <Activity className="w-3 h-3" />
                            Engine 1.2
                        </div>
                    </div>
                    <TabsList className="flex flex-col h-auto bg-transparent p-0 gap-2 items-stretch border-none">
                        <TabsTrigger
                            value="overview"
                            className="justify-start rounded-2xl px-5 py-4 h-14 data-[state=active]:bg-violet-500 data-[state=active]:text-white data-[state=active]:shadow-xl data-[state=active]:shadow-violet-500/20 gap-4 font-black uppercase tracking-widest text-[11px] hover:bg-white/5 transition-all text-zinc-400"
                        >
                            <LayoutDashboard className="w-5 h-5" />
                            Vue d'ensemble
                        </TabsTrigger>
                        <TabsTrigger
                            value="guilds"
                            className="justify-start rounded-2xl px-5 py-4 h-14 data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-xl data-[state=active]:shadow-blue-500/20 gap-4 font-black uppercase tracking-widest text-[11px] hover:bg-white/5 transition-all text-zinc-400"
                        >
                            <Settings2 className="w-5 h-5" />
                            Guildes & Onboarding
                        </TabsTrigger>
                        <TabsTrigger
                            value="infrastructure"
                            className="justify-start rounded-2xl px-5 py-4 h-14 data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-xl data-[state=active]:shadow-amber-500/20 gap-4 font-black uppercase tracking-widest text-[11px] hover:bg-white/5 transition-all text-zinc-400"
                        >
                            <Wrench className="w-5 h-5" />
                            Infrastructure & Ops
                        </TabsTrigger>
                        <TabsTrigger
                            value="security"
                            className="justify-start rounded-2xl px-5 py-4 h-14 data-[state=active]:bg-red-500 data-[state=active]:text-white data-[state=active]:shadow-xl data-[state=active]:shadow-red-500/20 gap-4 font-black uppercase tracking-widest text-[11px] hover:bg-white/5 transition-all text-zinc-400"
                        >
                            <ShieldAlert className="w-5 h-5" />
                            Sécurité & Logs
                        </TabsTrigger>
                    </TabsList>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
                <TabsContent value="overview" className="mt-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {overview}
                </TabsContent>

                <TabsContent value="guilds" className="mt-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {guilds}
                </TabsContent>

                <TabsContent value="infrastructure" className="mt-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {infrastructure}
                </TabsContent>

                <TabsContent value="security" className="mt-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {security}
                </TabsContent>
            </div>
        </Tabs>
    );
}
