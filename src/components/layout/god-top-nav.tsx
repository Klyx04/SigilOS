"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Activity,
    Settings2,
    HardDrive,
    Ticket,
    Bell,
    ShieldAlert,
    Database,
    Power,
    Ban,
    LucideIcon,
} from "lucide-react";

interface SubTab {
    id: string;
    name: string;
    icon: LucideIcon;
    color?: string;
}

interface GodTopNavProps {
    // Which main nav section is currently active
    activeSection: string;
    // If provided, clicking nav items calls this instead of routing
    onSectionChange?: (id: string) => void;
    rightContent?: React.ReactNode;
    unreadCount?: number;
    // 🔒 R3 : route secrète du panel God (jamais "/god" en dur)
    godRoute?: string;
}

export function GodTopNav({ activeSection, onSectionChange, rightContent, unreadCount = 0, godRoute = "/god" }: GodTopNavProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeSubTab = searchParams.get("sub") || "NONE";

    const handleTabChange = (id: string) => {
        if (onSectionChange) {
            onSectionChange(id);
        } else {
            router.push(`/god?tab=${id}`);
        }
    };

    const handleSubTabChange = (subId: string) => {
        // 🗺️ Sigil-Guesser : la blacklist des maps signalées vit sur la page dédiée /mini-games (onglet GUESSER).
        if (subId === "GUESSER") {
            router.push(`${godRoute}/mini-games?sub=GUESSER`);
            return;
        }
        const params = new URLSearchParams(searchParams.toString());
        params.set("sub", subId);
        router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    };

    // Sub-tabs depending on active main section
    const subTabs: Record<string, SubTab[]> = {
        "game-data": [
            { id: "MAINTENANCE", name: "Maintenance", icon: Power, color: "text-amber-400" },
            { id: "GUESSER", name: "Sigil-Guesser", icon: Ban, color: "text-red-400" },
        ],
        "infrastructure": [
            { id: "STATUS", name: "Status", icon: Activity, color: "text-emerald-400" },
            { id: "STORAGE", name: "Stockage", icon: HardDrive, color: "text-blue-400" },
        ],
        "tickets": [
            { id: "OPEN", name: "Tickets Ouverts", icon: Ticket, color: "text-indigo-400" },
            { id: "CLOSED", name: "Archives", icon: Database, color: "text-zinc-400" },
        ],
        "security": [
            { id: "AUDIT", name: "Audit Logs", icon: ShieldAlert, color: "text-zinc-400" },
        ]
    };

    const currentSubTabs = subTabs[activeSection] || [];

    return (
        <div className="h-20 flex-shrink-0 border-b border-white/10 bg-[#050505]/60 backdrop-blur-3xl flex items-center px-10 gap-8">
            {/* Main Tabs */}
            <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar py-2">
                {[
                    { id: "overview", name: "Analytics", icon: Activity, color: "text-blue-400" },
                    { id: "guilds", name: "Guildes", icon: Settings2, color: "text-emerald-400" },
                    { id: "game-data", name: "Mini-Games", icon: Database, color: "text-cyan-400" },
                    { id: "notifications", name: "Alertes", icon: Bell, color: "text-amber-500", badge: unreadCount },
                    { id: "infrastructure", name: "System", icon: HardDrive, color: "text-violet-400" },
                    { id: "security", name: "Security", icon: ShieldAlert, color: "text-zinc-400" },
                    { id: "tickets", name: "Tickets", icon: Ticket, color: "text-indigo-400" },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={cn(
                            "flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all duration-300 relative whitespace-nowrap group hover:bg-white/[0.03]",
                            activeSection === tab.id
                                ? "text-white bg-white/5 border border-white/10"
                                : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        <tab.icon className={cn(
                            "h-3.5 w-3.5 transition-all duration-500",
                            activeSection === tab.id ? tab.color : "text-zinc-700 group-hover:text-zinc-500"
                        )} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{tab.name}</span>

                        {tab.badge && tab.badge > 0 && (
                            <span className="flex items-center justify-center bg-rose-500 text-white text-[9px] font-black h-4 px-1.5 rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-bounce ml-1">
                                {tab.badge}
                            </span>
                        )}

                        {activeSection === tab.id && (
                            <div className="absolute -bottom-2 left-4 right-4 h-[2px] bg-white rounded-full shadow-[0_0_8px_white]" />
                        )}
                    </button>
                ))}
            </div>

            {/* Sub-tabs separator if any */}
            <div className="flex items-center gap-8">
                {currentSubTabs.length > 0 && (
                    <div className="flex gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl overflow-x-auto no-scrollbar">
                        {currentSubTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleSubTabChange(tab.id)}
                                className={cn(
                                    "flex items-center gap-3 px-5 py-2 rounded-xl transition-all duration-300 relative whitespace-nowrap",
                                    activeSubTab === tab.id || (activeSubTab === "NONE" && tab.id === currentSubTabs[0].id)
                                        ? "bg-white/5 text-white shadow-xl border border-white/10 font-bold"
                                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] border border-transparent"
                                )}
                            >
                                <tab.icon className={cn(
                                    "h-3.5 w-3.5 transition-all duration-500",
                                    activeSubTab === tab.id || (activeSubTab === "NONE" && tab.id === currentSubTabs[0].id)
                                        ? (tab.color || "text-white") + " scale-110"
                                        : "text-zinc-600"
                                )} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{tab.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Right section */}
            <div className="ml-auto hidden md:flex items-center gap-6 flex-shrink-0">
                {rightContent ?? (
                    <div className="flex flex-col items-end">
                        <span className={cn(
                            "text-[10px] font-black uppercase tracking-[0.2em]",
                            unreadCount > 0 ? "text-rose-500 animate-pulse" : "text-amber-500"
                        )}>
                            {unreadCount > 0 ? "System Alert" : "Live Monitoring"}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                unreadCount > 0 ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse"
                            )} />
                            <span className="text-[10px] font-bold text-zinc-600 uppercase">
                                {unreadCount > 0 ? `${unreadCount} Unread Alerts` : "All Systems OK"}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
