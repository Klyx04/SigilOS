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
    Book
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

    const isActive = (href: string) => pathname === href;

    const NAV_ITEMS = [
        { name: "Vue d'ensemble", href: "/god", icon: LayoutDashboard },
        { name: "Documentation", href: "/god/docs", icon: Book },
        { name: "Données de Jeu", href: "/god/game-data", icon: Database },
        // { name: "Guildes", href: "/god/guilds", icon: Server }, // WIP
        // { name: "Utilisateurs", href: "/god/users", icon: Users }, // WIP
        // { name: "Audit Logs", href: "/god/audit", icon: Activity }, // WIP
    ];

    return (
        <div className={cn("flex flex-col h-full bg-zinc-950 border-r border-white/5", className)}>

            {/* 1. HEADER: BRAND */}
            <div className="p-4 pb-2 space-y-4">
                <Link href="/" className="flex items-center gap-3 px-2 group/brand hover:opacity-80 transition-opacity">
                    <div className="relative h-8 w-8">
                        <Image
                            src="/assets/ui/logo-v2.png"
                            alt="SigilOS"
                            fill
                            className="object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                        />
                    </div>
                    <span className="text-lg font-black tracking-[0.2em] text-white leading-none font-heading">
                        SIGIL<span className="text-amber-500">GOD</span>
                    </span>
                </Link>
            </div>

            {/* 2. SCROLLABLE NAVIGATION */}
            <ScrollArea className="flex-1 px-3 py-6">
                <nav className="space-y-1">
                    <h4 className="px-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Super Admin</h4>
                    {NAV_ITEMS.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group relative",
                                isActive(item.href)
                                    ? "bg-amber-500/10 text-amber-500"
                                    : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.02]"
                            )}
                        >
                            {isActive(item.href) && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-500" />}
                            <item.icon className="h-4 w-4 shrink-0 transition-colors" />
                            <span className="text-sm font-medium">{item.name}</span>
                        </Link>
                    ))}

                    <div className="my-4 h-px bg-white/5" />

                    <Link
                        href="/"
                        className="flex items-center gap-3 px-3 py-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.02] transition-colors"
                    >
                        <Home className="h-4 w-4" />
                        <span className="text-sm font-medium">Retour Accueil</span>
                    </Link>
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
