"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Shield,
    LogOut,
    Activity,
    Home,
    Terminal,
    Gamepad2
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
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

    return (
        <div className={cn("flex flex-col h-full bg-black border-r border-white/5", className)}>

            {/* 1. HEADER: BRAND */}
            <div className="p-8 pb-4">
                <Link href="/" className="flex items-center gap-4 px-2 group/brand hover:opacity-80 transition-all">
                    <div className="relative h-10 w-10 shrink-0">
                        <Image
                            src="/assets/ui/logo-v2.png"
                            alt="SigilOS"
                            fill
                            priority
                            sizes="(max-width: 768px) 40px, 40px"
                            className="object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.6)] brightness-110"
                        />
                    </div>
                    <span className="text-xl md:text-2xl font-black tracking-tight text-white leading-none font-heading truncate">
                        SIGIL<span className="text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">GOD</span>
                    </span>
                </Link>
            </div>

            {/* 2. NAVIGATION */}
            <ScrollArea className="flex-1 px-4 py-8">
                <nav className="space-y-6">
                    <div>
                        <h4 className="px-3 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600 mb-4 block">
                            System Access
                        </h4>
                        <Link
                            href="/god"
                            className={cn(
                                "flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group relative",
                                isActive("/god")
                                    ? "bg-white/5 text-white shadow-[0_0_30px_rgba(255,255,255,0.02)] border border-white/10"
                                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02] border border-transparent"
                            )}
                        >
                            {isActive("/god") && <div className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-full" />}
                            <Terminal className={cn(
                                "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                                isActive("/god") ? "text-white" : "text-zinc-600 group-hover:text-zinc-400"
                            )} />
                            <span className="text-sm font-bold tracking-widest uppercase">Console Centrale</span>
                        </Link>

                        <Link
                            href="/god/mini-games"
                            className={cn(
                                "flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group relative",
                                isActive("/god/mini-games")
                                    ? "bg-white/5 text-white shadow-[0_0_30px_rgba(255,255,255,0.02)] border border-white/10"
                                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02] border border-transparent"
                            )}
                        >
                            {isActive("/god/mini-games") && <div className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-full" />}
                            <Gamepad2 className={cn(
                                "h-5 w-5 transition-transform duration-300 group-hover:scale-110",
                                isActive("/god/mini-games") ? "text-white" : "text-zinc-600 group-hover:text-zinc-400"
                            )} />
                            <span className="text-sm font-bold tracking-widest uppercase">Mini-Jeux</span>
                        </Link>
                    </div>

                    <div className="h-px bg-white/5 mx-4" />

                    <div className="space-y-1">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-4 px-4 py-3 rounded-xl text-zinc-600 hover:text-white transition-all group"
                        >
                            <LayoutDashboard className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                            <span className="text-xs font-bold uppercase tracking-widest">Back to Member</span>
                        </Link>
                        <Link
                            href="/"
                            className="flex items-center gap-4 px-4 py-3 rounded-xl text-zinc-600 hover:text-white transition-all group"
                        >
                            <Home className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                            <span className="text-xs font-bold uppercase tracking-widest">Landing Page</span>
                        </Link>
                    </div>
                </nav>
            </ScrollArea>

            {/* 3. USER FOOTER */}
            <div className="p-4 border-t border-white/5 bg-black/50 backdrop-blur-md">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start h-auto p-2 hover:bg-white/5 group">
                            <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-8 w-8 rounded-lg border border-amber-500/30">
                                    <AvatarImage src={user.image} />
                                    <AvatarFallback className="bg-zinc-800 text-xs font-bold text-amber-500">SU</AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start min-w-0 flex-1 text-left">
                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest truncate w-full">
                                        Super Admin
                                    </span>
                                </div>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-zinc-950 border-zinc-900 text-zinc-200" align="end">
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
