"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Activity,
    Settings2,
    HardDrive,
    Ticket,
    Bell,
    ShieldAlert,
    Database,
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
    // Optional sub-tabs to render after the main nav
    subTabs?: SubTab[];
    activeSubTab?: string;
    onSubTabChange?: (id: string) => void;
    // Optional right content
    rightContent?: React.ReactNode;
}

// Items marked as alwaysRoute will always navigate, never use onSectionChange
const MAIN_NAV = [
    { name: "Analytics", id: "overview", icon: Activity, href: "/god", alwaysRoute: false },
    { name: "Guildes & Users", id: "guilds", icon: Settings2, href: "/god?tab=guilds", alwaysRoute: false },
    { name: "Système & Infra", id: "infrastructure", icon: HardDrive, href: "/god?tab=infrastructure", alwaysRoute: false },
    { name: "Alertes Système", id: "notifications", icon: Bell, href: "/god?tab=notifications", alwaysRoute: false },
    { name: "Tickets Support", id: "tickets", icon: Ticket, href: "/god?tab=tickets", alwaysRoute: false },
    { name: "Données de Jeu", id: "game-data", icon: Database, href: "/god/mini-games", alwaysRoute: true },
    { name: "Sécurité & Logs", id: "security", icon: ShieldAlert, href: "/god?tab=security", alwaysRoute: false },
];

export function GodTopNav({ activeSection, onSectionChange, subTabs, activeSubTab, onSubTabChange, rightContent }: GodTopNavProps) {
    const router = useRouter();

    const handleNav = (item: typeof MAIN_NAV[0]) => {
        if (item.alwaysRoute || !onSectionChange) {
            router.push(item.href);
        } else {
            onSectionChange(item.id);
        }
    };

    return (
        <div className="h-20 flex-shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-3xl flex items-center px-10 gap-4">
            {/* Main Nav */}
            <div className="flex gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl overflow-x-auto no-scrollbar">
                {MAIN_NAV.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => handleNav(item)}
                        className={cn(
                            "flex items-center gap-3 px-6 py-2 rounded-xl transition-all duration-300 relative whitespace-nowrap",
                            activeSection === item.id
                                ? "bg-white/5 text-white shadow-xl border border-white/10"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] border border-transparent"
                        )}
                    >
                        <item.icon className={cn(
                            "h-4 w-4 transition-all duration-500",
                            activeSection === item.id ? "text-white scale-110" : "text-zinc-600"
                        )} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{item.name}</span>
                    </button>
                ))}
            </div>

            {/* Sub-tabs separator + sub-tabs */}
            {subTabs && subTabs.length > 0 && (
                <>
                    <div className="w-px h-8 bg-white/10 flex-shrink-0" />
                    <div className="flex gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl overflow-x-auto no-scrollbar">
                        {subTabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => onSubTabChange?.(tab.id)}
                                className={cn(
                                    "flex items-center gap-3 px-5 py-2 rounded-xl transition-all duration-300 relative whitespace-nowrap",
                                    activeSubTab === tab.id
                                        ? "bg-white/5 text-white shadow-xl border border-white/10"
                                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02] border border-transparent"
                                )}
                            >
                                <tab.icon className={cn(
                                    "h-3.5 w-3.5 transition-all duration-500",
                                    activeSubTab === tab.id
                                        ? (tab.color || "text-white") + " scale-110"
                                        : "text-zinc-600"
                                )} />
                                <span className="text-[10px] font-black uppercase tracking-widest">{tab.name}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* Right section */}
            <div className="ml-auto hidden md:flex items-center gap-6 flex-shrink-0">
                {rightContent ?? (
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Live Monitoring</span>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-zinc-600 uppercase">All Systems OK</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
