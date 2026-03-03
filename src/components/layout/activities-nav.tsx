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
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-white/5 scrollbar-hide">
            {tabs.map(tab => {
                const isActive = pathname.startsWith(tab.href);
                const Icon = tab.icon;
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                            isActive
                                ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 border-indigo-500"
                                : "bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 border border-white/10"
                        )}
                    >
                        <Icon className="w-4 h-4" />
                        {tab.name}
                    </Link>
                );
            })}
        </div>
    );
}
