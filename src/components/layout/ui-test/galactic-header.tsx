"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    ScrollText,
    InfinityIcon,
    Bug,
    Trophy,
    UserCircle,
    Bell,
    ChevronDown
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function GalacticHeader({ guildId, user }: { guildId: string, user: any }) {
    const pathname = usePathname();

    const NAV_ITEMS = [
        { name: "Dashboard", href: `/dashboard/${guildId}`, icon: LayoutDashboard },
        { name: "Missions", href: `/dashboard/${guildId}/missions`, icon: ScrollText },
        { name: "Songes", href: `/dashboard/${guildId}/songes`, icon: InfinityIcon },
        { name: "Bourse", href: `/dashboard/${guildId}/archimonstres`, icon: Bug },
        { name: "Ladder", href: `/dashboard/${guildId}/ladder`, icon: Trophy },
    ];

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 px-6">
            <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
                {/* Brand */}
                <div className="flex items-center gap-8">
                    <span className="text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-secondary  transition-transform cursor-pointer">
                        SIGILOS
                    </span>

                    {/* Navigation Links */}
                    <div className="hidden md:flex items-center gap-1">
                        {NAV_ITEMS.map((item) => {
                            const active = pathname.includes(item.href);
                            return (
                                <Link key={item.href} href={item.href}>
                                    <div className={cn(
                                        "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 group",
                                        active
                                            ? "text-primary bg-primary/10"
                                            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                                    )}>
                                        <item.icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                                        {item.name}
                                        {active && <div className="h-0.5 w-4 bg-primary absolute bottom-3 rounded-full" />}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* User Stats & Avatar */}
                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex items-center gap-6 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold tracking-wider text-muted-foreground italic">
                        <div className="flex flex-col">
                            <span className="text-caption text-zinc-500 not-italic">XP HEBDO</span>
                            <span className="text-primary">+12,450</span>
                        </div>
                        <div className="h-4 w-px bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-caption text-zinc-500 not-italic">MISSIONS</span>
                            <span className="text-amber-500">8/12</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="relative p-2 hover:bg-white/5 rounded-full transition-colors text-muted-foreground hover:text-foreground">
                            <Bell className="h-5 w-5" />
                            <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full border-2 border-zinc-950" />
                        </button>

                        <div className="flex items-center gap-2 pl-2 border-l border-white/10 cursor-pointer group">
                            <Avatar className="h-8 w-8 border border-white/20 transition-transform group-">
                                <AvatarImage src={user?.image} />
                                <AvatarFallback className="bg-zinc-800 text-caption">USER</AvatarFallback>
                            </Avatar>
                            <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
