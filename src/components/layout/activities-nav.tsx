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
        { name: "Quête Ocre", href: `/dashboard/${guildId}/quete-ocre`, icon: Crown, color: "amber" },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy, color: "rose" },
    ];

    const colorMap: Record<string, { bg: string, border: string, text: string, icon: string }> = {
        emerald: { bg: "from-emerald-600/20 to-emerald-400/10", border: "border-emerald-500/30", text: "text-emerald-400", icon: "text-emerald-500" },
        indigo: { bg: "from-indigo-600/20 to-indigo-400/10", border: "border-indigo-500/30", text: "text-indigo-400", icon: "text-indigo-500" },
        cyan: { bg: "from-cyan-600/20 to-cyan-400/10", border: "border-cyan-500/30", text: "text-cyan-400", icon: "text-cyan-500" },
        amber: { bg: "from-amber-600/20 to-amber-400/10", border: "border-amber-500/30", text: "text-amber-400", icon: "text-amber-500" },
        rose: { bg: "from-rose-600/20 to-rose-400/10", border: "border-rose-500/30", text: "text-rose-400", icon: "text-rose-500" },
    };

    return (
        <nav className="relative w-full overflow-hidden mb-10">
            <div className="flex items-center gap-3 overflow-x-auto pb-6 scrollbar-hide no-scrollbar pt-2 px-1">
                {tabs.map((tab, idx) => {
                    const isActive = pathname.startsWith(tab.href);
                    const scheme = colorMap[tab.color];
                    const Icon = tab.icon;
                    
                    return (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            className={cn(
                                "group relative flex h-14 items-center gap-4 px-6 rounded-2xl transition-all duration-500",
                                "border backdrop-blur-md shadow-lg",
                                isActive
                                    ? cn(
                                        "bg-gradient-to-br", scheme.bg, scheme.border,
                                        "shadow-[0_0_30px_-5px_rgba(0,0,0,0.3)] min-w-[180px]"
                                    )
                                    : "bg-white/[0.03] border-white/5 text-muted-foreground/40 hover:bg-white/[0.08] hover:border-white/10 hover:text-foreground/80"
                            )}
                        >
                            {/* Active Underline Glow */}
                            {isActive && (
                                <div className={cn(
                                    "absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-1/2 h-[3px] rounded-full blur-[2px] transition-all duration-700",
                                    scheme.bg.split(' ')[0].replace('from-', 'bg-')
                                )} />
                            )}

                            <div className={cn(
                                "p-2.5 rounded-xl transition-all duration-500",
                                isActive 
                                    ? "bg-white/10 shadow-[inner_0_0_15px_rgba(255,255,255,0.1)] scale-110" 
                                    : "bg-white/5 opacity-50 group-hover:opacity-100 group-hover:scale-110"
                            )}>
                                <Icon className={cn(
                                    "w-5 h-5 transition-all duration-500", 
                                    isActive ? scheme.icon : "text-white/40"
                                )} />
                            </div>

                            <div className="flex flex-col">
                                <span className={cn(
                                    "text-[11px] font-black uppercase tracking-[0.25em] transition-all leading-tight",
                                    isActive ? "text-foreground drop-shadow-sm" : "text-muted-foreground/60"
                                )}>
                                    {tab.name}
                                </span>
                                {isActive && (
                                    <span className={cn("text-[8px] font-bold uppercase tracking-widest opacity-60 mt-0.5 animate-in fade-in slide-in-from-top-1", scheme.text)}>
                                        Actif
                                    </span>
                                )}
                            </div>

                            {/* Hover Shine Effect */}
                            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shine" />
                            </div>
                        </Link>
                    );
                })}
            </div>
            
            {/* Ambient Background Gradient for the active section */}
            <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/5 to-transparent -z-10" />
        </nav>
    );
}
