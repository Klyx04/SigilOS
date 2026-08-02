"use client";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

import Link from "next/link";
import Image from "next/image";
import { LogOut, ChevronRight, LayoutDashboard } from "lucide-react";
import { User } from "next-auth";
import { Button } from "@/components/ui/button";
import { loginWithDiscord, logoutAction } from "@/server/actions/auth-actions";
import { DiscordIcon } from "@/components/shared/icons";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardDrawer } from "./dashboard-drawer";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = {
    label: string;
    href: string;
    id: string;
};

const NAV_ITEMS: NavItem[] = [
    { label: "Explorer", href: "/#features", id: "features" },
    { label: "Annuaire", href: "/guilds", id: "annuaire" },
    { label: "Guides", href: "/guides", id: "guides" },
    { label: "Changelog", href: "/changelog", id: "changelog" },
    { label: "Status", href: "/status", id: "status" },
];

interface PublicHeaderProps {
    activePage?: string;
    backHref?: string;
    backLabel?: string;
    user?: User;
    variant?: "hero" | "standard";
    dashboardHref?: string;
    isMember?: boolean;
    isFixed?: boolean;
    clientId?: string;
}

export function PublicHeader({ activePage, user, variant = "standard", dashboardHref = "/dashboard", isMember: isMemberProp, isFixed = true, clientId }: PublicHeaderProps) {
    const isHero = variant === "hero";
    const [isMember, setIsMember] = useState(isMemberProp ?? false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        if (isMemberProp !== undefined) {
            setIsMember(isMemberProp);
            return;
        }

        async function checkMembership() {
            if (!user) {
                setIsMember(false);
                return;
            }
            try {
                const { getUserContext } = await import("@/server/actions/user-actions");
                const ctx = await getUserContext();
                setIsMember(ctx.isMember);
            } catch {
                setIsMember(false);
            }
        }
        checkMembership();
    }, [user, isMemberProp]);

    return (
        <motion.header 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={cn(
                isFixed ? "fixed top-0 left-0 right-0 z-50" : "relative z-50",
                "transition-all duration-500 py-4 px-4 sm:px-6 lg:px-8",
                scrolled ? "py-2" : "py-6"
            )}
        >
            <div className={cn(
                "mx-auto transition-all duration-500",
                scrolled 
                ? "max-w-5xl rounded-3xl bg-zinc-950/60 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] px-6" 
                : "max-w-[1400px] bg-transparent border-b border-white/5 px-4"
            )}>
                <div className="flex items-center justify-between h-16 sm:h-20">

                    {/* Left: Brand */}
                    <div className="flex items-center gap-12">
                        <Link href="/" className="flex items-center gap-4 group shrink-0 relative">
                            <div className="absolute -inset-4 bg-emerald-500/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700" />
                            
                            <div className="relative w-10 h-10 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
                                <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
                                <Image
                                    src="/assets/ui/logo-v2.png"
                                    alt="SigilOS"
                                    fill
                                    className="object-contain relative z-10 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                                    priority
                                />
                            </div>
                            <div className="flex flex-col -space-y-1">
                                <span className="text-2xl font-black tracking-tighter text-white transition-all group-hover:text-emerald-400 uppercase leading-none">
                                    Sigil<span className="text-emerald-500 group-hover:text-white transition-colors duration-500">OS</span>
                                </span>
                                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] group-hover:text-emerald-500/40 transition-colors">Evolution</span>
                            </div>
                        </Link>

                        <nav className="hidden lg:flex items-center gap-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full p-1 leading-none shadow-2xl">
                            {NAV_ITEMS.map((item) => {
                                const isActive = activePage === item.id;
                                return (
                                    <Link
                                        key={item.id}
                                        href={item.href}
                                        className={cn(
                                            "px-5 py-2 rounded-full text-[11px] font-black transition-all uppercase tracking-widest leading-none",
                                            isActive
                                                ? "text-white bg-white/20 shadow-lg"
                                                : "text-zinc-300 hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Right: Auth */}
                    <div className="flex items-center gap-3 sm:gap-5">
                        <AnimatePresence mode="wait">
                            {user ? (
                                <motion.div 
                                    key="logged-in"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-3"
                                >
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="group relative flex items-center gap-3 pl-3 pr-4 py-2 rounded-2xl bg-white/[0.05] border border-white/10 hover:bg-white/[0.08] hover:border-emerald-500/30 transition-all shadow-xl active:scale-95 outline-none">
                                                <Avatar className="w-10 h-10 border border-white/10 rounded-xl">
                                                    <AvatarImage src={user.image || ""} />
                                                    <AvatarFallback className="bg-zinc-800 text-white font-black">{user.name?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col items-start -space-y-0.5 hidden sm:flex">
                                                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Session</span>
                                                    <span className="text-[11px] font-bold text-white">{user.name}</span>
                                                </div>
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-64 bg-zinc-950 border border-white/10 rounded-2xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" align="end">
                                            <DropdownMenuLabel className="px-4 py-3">
                                                <div className="flex flex-col space-y-1">
                                                    <p className="text-xs font-black text-white uppercase tracking-widest">Compte SigilOS</p>
                                                    <p className="text-[10px] text-zinc-500 font-medium truncate">{user.email}</p>
                                                </div>
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator className="bg-white/5 mx-2" />
                                            
                                            <DashboardDrawer clientId={clientId}>
                                                <DropdownMenuItem 
                                                    onSelect={(e) => e.preventDefault()}
                                                    className="focus:bg-emerald-500/10 focus:text-emerald-400 rounded-xl p-3 cursor-pointer w-full flex items-center gap-3 outline-none"
                                                >
                                                    <LayoutDashboard className="w-4 h-4" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">Gestion Multi-Guilde</span>
                                                </DropdownMenuItem>
                                            </DashboardDrawer>

                                            <DropdownMenuItem asChild className="focus:bg-zinc-800 focus:text-white rounded-xl p-3 cursor-pointer outline-none">
                                                <Link href={dashboardHref} className="flex items-center gap-3 w-full">
                                                    <LayoutDashboard className="w-4 h-4 opacity-40" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">Dashboard Central</span>
                                                </Link>
                                            </DropdownMenuItem>

                                            <DropdownMenuSeparator className="bg-white/5 mx-2" />
                                            
                                            <DropdownMenuItem 
                                                onSelect={() => logoutAction()}
                                                className="focus:bg-rose-500/10 focus:text-rose-400 rounded-xl p-3 cursor-pointer w-full flex items-center gap-3 outline-none"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                <span className="text-[11px] font-black uppercase tracking-widest text-left flex-1">Déconnexion</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="logged-out"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="hidden sm:block"
                                >
                                    <form action={loginWithDiscord}>
                                        <button className="group relative flex items-center gap-3 px-8 py-3 rounded-2xl bg-zinc-900 border border-white/10 hover:border-emerald-500/50 text-white text-[11px] font-black uppercase tracking-widest transition-all hover:shadow-[0_0_25px_rgba(16,185,129,0.2)] hover:-translate-y-0.5">
                                            <DiscordIcon className="w-4.5 h-4.5 text-emerald-500" />
                                            Connexion
                                        </button>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="lg:hidden">
                            <Sheet>
                                <SheetTrigger asChild>
                                    <button className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all outline-none">
                                        <div className="space-y-1.5">
                                            <div className="w-5 h-0.5 bg-white rounded-full" />
                                            <div className="w-3 h-0.5 bg-white rounded-full ml-auto" />
                                            <div className="w-5 h-0.5 bg-white rounded-full" />
                                        </div>
                                    </button>
                                </SheetTrigger>
                                <SheetContent side="right" className="w-[300px] bg-zinc-950 border-l border-white/5 p-0 overflow-hidden flex flex-col">
                                    <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />
                                    
                                    <div className="p-8 pb-4 relative z-10 flex flex-col items-center gap-6 mt-10">
                                        <div className="w-16 h-16 relative">
                                            <Image src="/assets/ui/logo-v2.png" alt="SigilOS" fill className="object-contain" />
                                        </div>
                                        <div className="text-center">
                                            <span className="text-2xl font-black tracking-tighter text-white uppercase italic">Sigil<span className="text-emerald-500">OS</span></span>
                                            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em] mt-1">L'excellence Gaming</p>
                                        </div>
                                    </div>

                                    <nav className="flex-1 px-4 py-8 space-y-2 relative z-10">
                                        {NAV_ITEMS.map((item) => (
                                            <Link
                                                key={item.id}
                                                href={item.href}
                                                className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 text-[11px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                                            >
                                                {item.label}
                                                <ChevronRight className="w-4 h-4" />
                                            </Link>
                                        ))}
                                    </nav>

                                    {!user && (
                                        <div className="p-6 bg-white/[0.02] border-t border-white/5 relative z-10">
                                            <form action={loginWithDiscord}>
                                                <button className="w-full h-14 rounded-2xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all">
                                                    <DiscordIcon className="w-5 h-5" />
                                                    Connexion
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </SheetContent>
                            </Sheet>
                        </div>
                    </div>
                </div>
            </div>
        </motion.header>
    );
}
