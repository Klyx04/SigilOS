"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollText, Sparkles, Crown, Trophy } from "lucide-react";

export function ActivitiesNav({ guildId }: { guildId: string }) {
    const pathname = usePathname();

    const tabs = [
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: ScrollText },
        { name: "Songes Infinis", href: `/dashboard/${guildId}/songes`, icon: Sparkles },
        { name: "Quête Ocre", href: `/dashboard/${guildId}/quete-ocre`, icon: Crown },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy },
    ];

    return (
        <div className="relative group/nav">
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-white/5 scrollbar-hide no-scrollbar mask-horizontal-scroll premium-scrollbar lg:mask-none">
                {tabs.map((tab, idx) => {
                    const isActive = pathname.startsWith(tab.href);
                    const Icon = tab.icon;
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            style={{ animationDelay: `${idx * 50}ms` }}
                            className={cn(
                                "flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[13px] font-black uppercase tracking-wider transition-all duration-300 whitespace-nowrap animate-in fade-in slide-in-from-left-2",
                                isActive
                                    ? "bg-indigo-500 text-white shadow-[0_10px_20px_-5px_rgba(99,102,241,0.4)] border-indigo-400"
                                    : "bg-white/[0.03] text-zinc-500 hover:text-white hover:bg-white/10 border border-white/5"
                            )}
                        >
                            <Icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-zinc-500")} />
                            {tab.name}
                        </Link>
                    );
                })}
            </div>
            {/* Visual focus bar for current active tab (Desktop only) */}
            <div className="absolute bottom-0 h-[2px] bg-indigo-500 hidden lg:block transition-all duration-500" />
        </div>
    );
}
