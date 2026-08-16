"use client";

import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    ScrollText,
    InfinityIcon,
    Bug,
    Trophy,
    UserCircle,
    Settings,
    Home
} from "lucide-react";
import Link from "next/link";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export function FloatingHUD({ guildId }: { guildId: string }) {
    const ITEMS = [
        { name: "Dashboard", href: `/dashboard/${guildId}`, icon: Home },
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: ScrollText },
        { name: "Songes", href: `/dashboard/${guildId}/songes`, icon: InfinityIcon },
        { name: "Bourse", href: `/dashboard/${guildId}/archimonstres`, icon: Bug },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy },
        { name: "Settings", href: `/dashboard/${guildId}/admin/settings`, icon: Settings },
    ];

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-2 p-2 rounded-full bg-zinc-950/40 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all  hover:border-primary/30 group">
                <TooltipProvider delayDuration={0}>
                    {ITEMS.map((item) => (
                        <Tooltip key={item.href}>
                            <TooltipTrigger asChild>
                                <Link href={item.href}>
                                    <div className="h-12 w-12 rounded-full flex items-center justify-center text-zinc-400 hover:bg-primary/10 hover:text-primary transition-all duration-300 relative group/item">
                                        <item.icon className="h-5 w-5" />
                                        <div className="absolute -top-1 right-1 h-1 w-1 bg-primary rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                    </div>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-zinc-900 border-white/10 text-white font-bold py-2 px-4 rounded-xl shadow-2xl">
                                {item.name}
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </TooltipProvider>

                <div className="h-8 w-px bg-white/10 mx-1" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="h-12 w-12 rounded-full overflow-hidden border border-white/20 cursor-pointer  transition-transform">
                            <div className="w-full h-full bg-gradient-to-br from-primary via-purple-500 to-amber-500" />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-zinc-900 border-white/10 text-white font-bold py-2 px-4 rounded-xl">
                        Profil Agent
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}
