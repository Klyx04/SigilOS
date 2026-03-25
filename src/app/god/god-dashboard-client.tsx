"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { GodTopNav } from "@/components/layout/god-top-nav";

interface GodDashboardClientProps {
    overview: React.ReactNode;
    guilds: React.ReactNode;
    infrastructure: React.ReactNode;
    security: React.ReactNode;
    tickets: React.ReactNode;
    notifications: React.ReactNode;
    gameData?: React.ReactNode;
}

export function GodDashboardClient({
    overview,
    guilds,
    infrastructure,
    security,
    tickets,
    notifications,
    gameData,
}: GodDashboardClientProps) {
    const [activeTab, setActiveTab] = useState("overview");

    return (
        <div className="flex flex-col flex-1 h-full overflow-hidden">
            <GodTopNav
                activeSection={activeTab}
                onSectionChange={setActiveTab}
            />

            {/* MAIN CONTENT */}
            <main className="flex-1 overflow-y-auto no-scrollbar bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/10 via-transparent to-transparent">
                <div className="max-w-[1500px] mx-auto px-6 lg:px-12 py-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {activeTab === "overview" && overview}
                    {activeTab === "guilds" && guilds}
                    {activeTab === "infrastructure" && infrastructure}
                    {activeTab === "tickets" && tickets}
                    {activeTab === "notifications" && notifications}
                    {activeTab === "security" && security}
                    {activeTab === "game-data" && gameData}
                </div>
            </main>
        </div>
    );
}
