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
        emerald: "text-success border-success/20 bg-success/5",
        indigo: "text-info border-info/20 bg-info/5",
        cyan: "text-info border-info/20 bg-info/5",
        amber: "text-warning border-warning/20 bg-warning/5",
        rose: "text-danger border-danger/20 bg-danger/5",
    };

    return (
        <nav className="relative w-full mb-6">
            <div className="flex items-center gap-1 p-1 bg-background/50 backdrop-blur-xl border border-border rounded-2xl w-fit overflow-x-auto scrollbar-hide no-scrollbar shadow-2xl">
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
                                "border border-transparent text-muted-foreground hover:text-foreground hover:bg-surface",
                                isActive && cn(
                                    "bg-surface border-border shadow-inner font-bold text-foreground",
                                    scheme
                                )
                            )}
                        >
                            <Icon className={cn("w-4 h-4 transition-colors", isActive ? "" : "text-muted-foreground group-hover:text-muted-foreground")} />
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
