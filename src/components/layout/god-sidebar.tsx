"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Shield,
    LogOut,
    Server,
    Users,
    Activity,
    Database,
    Home,
    Book,
    ClipboardList,
    Gamepad2,
    Bug
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function GodSidebar({ className, user }: { className?: string, user: any }) {
    const pathname = usePathname();

    const isActive = (href: string) => {
        if (href === "/god") return pathname === "/god";
        return pathname.startsWith(href);
    };

    const NAV_ITEMS = [
        { name: "Vue d'ensemble", href: "/god", icon: LayoutDashboard },
        { name: "Maintenance Jeux", href: "/god/mini-games", icon: Gamepad2 },
        { name: "Tracker Bugs", href: "/god/bugs", icon: Bug },
        { name: "Documentation", href: "/god/docs", icon: Book },
        { name: "Changelog", href: "/god/changelog", icon: ClipboardList },
        { name: "Chat Firewall", href: "/god/chat", icon: Shield },
        { name: "Données de Jeu", href: "/god/game-data", icon: Database },
        { name: "Audit Logs", href: "/god/logs", icon: Activity },
    ];

    return (
        <div className={cn("flex flex-col h-full bg-zinc-950 border-r border-white/5", className)}>

            {/* 1. HEADER: BRAND - SCALED */}
            <div className="p-8 pb-4 space-y-6">
                <Link href="/" className="flex items-center gap-4 px-2 group/brand hover:opacity-80 transition-opacity">
                    <div className="relative h-10 w-10 shrink-0">
                        <Image
                            src="/assets/ui/logo-v2.png"
                            alt="SigilOS"
                            fill
                            className="object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.6)] brightness-110"
                        />
                    </div>
                    <span className="text-xl md:text-2xl font-black tracking-tight text-white leading-none font-heading truncate">
                        SIGIL<span className="text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">GOD</span>
                    </span>
                </Link>
            </div>

            {/* 2. SCROLLABLE NAVIGATION - ENHANCED */}
            <ScrollArea className="flex-1 px-4 py-8">
                <nav className="space-y-2">
                    <h4 className="px-3 text-xs font-black uppercase tracking-[0.3em] text-zinc-600 mb-4">Command Terminal</h4>
                    {NAV_ITEMS.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group relative",
                                isActive(item.href)
                                    ? "bg-amber-500/10 text-amber-500 shadow-lg shadow-amber-500/5 border border-amber-500/20"
                                    : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.03] border border-transparent"
                            )}
                        >
                            {isActive(item.href) && <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-amber-500 rounded-full" />}
                            <item.icon className={cn(
                                "h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110",
                                isActive(item.href) ? "text-amber-500" : "text-zinc-500 group-hover:text-amber-400"
                            )} />
                            <span className="text-base font-bold tracking-wide">{item.name}</span>
                        </Link>
                    ))}

                    <div className="my-8 h-px bg-white/5 mx-4" />

                    <div className="space-y-1">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-4 px-4 py-3 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.03] transition-all group"
                        >
                            <LayoutDashboard className="h-5 w-5 group-hover:scale-110 transition-transform opacity-60" />
                            <span className="text-base font-bold tracking-wide">Dashboard Membre</span>
                        </Link>

                        <Link
                            href="/"
                            className="flex items-center gap-4 px-4 py-3 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] transition-all group"
                        >
                            <Home className="h-5 w-5 group-hover:-translate-x-1 transition-transform opacity-40" />
                            <span className="text-base font-bold tracking-wide">Landing Page</span>
                        </Link>
                    </div>
                </nav>
            </ScrollArea>

            {/* 3. FOOTER: USER */}
            <div className="p-4 border-t border-white/5 bg-zinc-950/50 backdrop-blur-md">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start h-auto p-2 hover:bg-white/5 group">
                            <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-8 w-8 rounded-lg border border-amber-500/30">
                                    <AvatarImage src={user.image} />
                                    <AvatarFallback className="bg-zinc-800 text-xs font-bold text-amber-500">SU</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start min-w-0 flex-1 text-left">
                                    <span className="text-xs font-bold text-amber-500 truncate w-full">
                                        Super Admin
                                    </span>
                                </div>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-zinc-950 border-zinc-800 text-zinc-200" align="end">
                        <DropdownMenuItem onClick={() => signOut()} className="text-red-400 focus:text-red-400 focus:bg-red-950/20 cursor-pointer">
                            <LogOut className="mr-2 h-4 w-4" />
                            Déconnexion
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
