"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    LayoutDashboard,
    Wrench,
    ShieldAlert,
    Terminal,
    Activity,
    Settings2,
    HardDrive,
    Ticket
} from "lucide-react";

interface GodDashboardClientProps {
    overview: React.ReactNode;
    guilds: React.ReactNode;
    infrastructure: React.ReactNode;
    security: React.ReactNode;
    storage: React.ReactNode;
    tickets: React.ReactNode;
}

export function GodDashboardClient({
    overview,
    guilds,
    infrastructure,
    security,
    storage,
    tickets
}: GodDashboardClientProps) {
    const [activeTab, setActiveTab] = useState("overview");

    return (
        <Tabs defaultValue="overview" onValueChange={setActiveTab} className="space-y-12">
            <div className="sticky top-0 z-50 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 -mx-6 lg:-mx-12 px-6 lg:px-12">
                <div className="max-w-[1600px] mx-auto">
                    <TabsList className="h-20 bg-transparent p-0 gap-8 justify-start overflow-x-auto no-scrollbar">
                        <TabsTrigger
                            value="overview"
                            className="relative h-full px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-violet-500 data-[state=active]:bg-transparent data-[state=active]:text-white text-zinc-500 font-bold uppercase tracking-[0.2em] text-[11px] transition-all hover:text-zinc-300 gap-3"
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            Vue d'ensemble
                        </TabsTrigger>
                        <TabsTrigger
                            value="guilds"
                            className="relative h-full px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent data-[state=active]:text-white text-zinc-500 font-bold uppercase tracking-[0.2em] text-[11px] transition-all hover:text-zinc-300 gap-3"
                        >
                            <Settings2 className="w-4 h-4" />
                            Guildes & Onboarding
                        </TabsTrigger>
                        <TabsTrigger
                            value="infrastructure"
                            className="relative h-full px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-amber-500 data-[state=active]:bg-transparent data-[state=active]:text-white text-zinc-500 font-bold uppercase tracking-[0.2em] text-[11px] transition-all hover:text-zinc-300 gap-3"
                        >
                            <Wrench className="w-4 h-4" />
                            Infrastructure & Ops
                        </TabsTrigger>
                        <TabsTrigger
                            value="storage"
                            className="relative h-full px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-white text-zinc-500 font-bold uppercase tracking-[0.2em] text-[11px] transition-all hover:text-zinc-300 gap-3"
                        >
                            <HardDrive className="w-4 h-4" />
                            Stockage VPS
                        </TabsTrigger>
                        <TabsTrigger
                            value="tickets"
                            className="relative h-full px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent data-[state=active]:text-white text-zinc-500 font-bold uppercase tracking-[0.2em] text-[11px] transition-all hover:text-zinc-300 gap-3"
                        >
                            <Ticket className="w-4 h-4" />
                            Tickets Support
                        </TabsTrigger>
                        <TabsTrigger
                            value="security"
                            className="relative h-full px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 data-[state=active]:bg-transparent data-[state=active]:text-white text-zinc-500 font-bold uppercase tracking-[0.2em] text-[11px] transition-all hover:text-zinc-300 gap-3"
                        >
                            <ShieldAlert className="w-4 h-4" />
                            Sécurité & Logs
                        </TabsTrigger>
                    </TabsList>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="w-full mt-10">
                <TabsContent value="overview" className="mt-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {overview}
                </TabsContent>

                <TabsContent value="guilds" className="mt-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {guilds}
                </TabsContent>

                <TabsContent value="infrastructure" className="mt-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {infrastructure}
                </TabsContent>

                <TabsContent value="storage" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {storage}
                </TabsContent>

                <TabsContent value="tickets" className="mt-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {tickets}
                </TabsContent>

                <TabsContent value="security" className="mt-0 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {security}
                </TabsContent>
            </div>
        </Tabs>
    );
}
