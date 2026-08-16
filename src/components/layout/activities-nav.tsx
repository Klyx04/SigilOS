"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollText, Sparkles, Crown, Trophy, Gem } from "lucide-react";

export function ActivitiesNav({ guildId }: { guildId: string }) {
    const pathname = usePathname();

    const tabs = [
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: ScrollText, color: "emerald" },
        { name: "Songes Infinis", href: `/dashboard/${guildId}/songes`, icon: Sparkles, color: "indigo" },
        { name: "Les Dofus", href: `/dashboard/${guildId}/quetes-dofus`, icon: Gem, color: "cyan" },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy, color: "rose" },
    ];

    const colorMap: Record<string, string> = {
        emerald: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
        indigo: "text-indigo-400 border-indigo-500/20 bg-indigo-500/5",
        cyan: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5",
        amber: "text-amber-400 border-amber-500/20 bg-amber-500/5",
        rose: "text-rose-400 border-rose-500/20 bg-rose-500/5",
    };

    return (
        <nav className="relative w-full mb-6">
            <div className="flex items-center gap-1 p-1 bg-zinc-950/50 backdrop-blur-xl border border-white/5 rounded-2xl w-fit overflow-x-auto scrollbar-hide no-scrollbar shadow-2xl">
                {tabs.map((tab) => {
                    const isActive = pathname.startsWith(tab.href);
                    const scheme = colorMap[tab.color];
                    const Icon = tab.icon;
                    
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={cn(
                                "group relative flex h-10 items-center gap-2.5 px-4 rounded-xl transition-all duration-300",
                                "border border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]",
                                isActive && cn(
                                    "bg-white/[0.04] border-white/10 shadow-inner font-bold text-white",
                                    scheme
                                )
                            )}
                        >
                            <Icon className={cn("w-4 h-4 transition-colors", isActive ? "" : "text-zinc-600 group-hover:text-zinc-400")} />
                            <span className="text-caption font-black uppercase tracking-[0.15em] whitespace-nowrap">
                                {tab.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
            {/* Subtle bottom line for the navbar alignment */}
            <div className="absolute -bottom-2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent -z-10" />
        </nav>
    );
}
