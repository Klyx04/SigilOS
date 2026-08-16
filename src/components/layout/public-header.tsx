"use client";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

import Link from "next/link";
import Image from "next/image";
import { LogOut, ChevronRight, LayoutDashboard } from "lucide-react";
import { User } from "next-auth";
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
    { label: "Produit", href: "/#produit", id: "produit" },
    { label: "Annuaire", href: "/guilds", id: "annuaire" },
    { label: "Guides", href: "/guides", id: "guides" },
    { label: "Changelog", href: "/changelog", id: "changelog" },
    { label: "Statut", href: "/status", id: "status" },
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

export function PublicHeader({ activePage, user, variant: _variant = "standard", dashboardHref = "/dashboard", isFixed = true, clientId }: PublicHeaderProps) {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <motion.header 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={cn(
                isFixed ? "fixed top-0 left-0 right-0 z-50" : "relative z-50",
                "transition-all duration-300",
                scrolled
                    ? "bg-[#0b0d0d]/95 backdrop-blur-md border-b border-white/10 py-2.5"
                    : "bg-transparent border-b border-transparent py-4"
            )}
        >
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14">

                    {/* Left: Brand */}
                    <div className="flex items-center gap-12">
                        <Link href="/" className="flex items-center gap-2.5 shrink-0">
                            <Image
                                src="/assets/ui/logo-v2.png"
                                alt="SigilOS"
                                width={34}
                                height={34}
                                className="object-contain"
                                priority
                            />
                            <span className="text-lg font-bold tracking-tight text-white leading-none">
                                Sigil<span className="text-emerald-400">OS</span>
                            </span>
                        </Link>

                        <nav className="hidden lg:flex items-center gap-1" aria-label="Navigation principale">
                            {NAV_ITEMS.map((item) => {
                                const isActive = activePage === item.id;
                                return (
                                    <Link
                                        key={item.id}
                                        href={item.href}
                                        aria-current={isActive ? "page" : undefined}
                                        className={cn(
                                            "px-3 py-1.5 rounded-md text-body-sm font-medium transition-colors",
                                            isActive
                                                ? "text-white bg-white/5"
                                                : "text-zinc-400 hover:text-white hover:bg-white/5"
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
                                            <button className="flex items-center gap-3 pl-3 pr-4 py-2 rounded-xl bg-white/[0.05] border border-white/10 hover:bg-white/[0.08] hover:border-emerald-500/30 transition-colors outline-none">
                                                <Avatar className="w-10 h-10 border border-white/10 rounded-xl">
                                                    <AvatarImage src={user.image || ""} />
                                                    <AvatarFallback className="bg-zinc-800 text-white font-black">{user.name?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col items-start -space-y-0.5 hidden sm:flex">
                                                    <span className="text-caption font-black text-white/40 uppercase tracking-widest">Session</span>
                                                    <span className="text-caption font-bold text-white">{user.name}</span>
                                                </div>
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-64 bg-zinc-950 border border-white/10 rounded-2xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" align="end">
                                            <DropdownMenuLabel className="px-4 py-3">
                                                <div className="flex flex-col space-y-1">
                                                    <p className="text-xs font-black text-white uppercase tracking-widest">Compte SigilOS</p>
                                                    <p className="text-caption text-zinc-500 font-medium truncate">{user.email}</p>
                                                </div>
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator className="bg-white/5 mx-2" />
                                            
                                            <DashboardDrawer clientId={clientId}>
                                                <DropdownMenuItem 
                                                    onSelect={(e) => e.preventDefault()}
                                                    className="focus:bg-emerald-500/10 focus:text-emerald-400 rounded-xl p-3 cursor-pointer w-full flex items-center gap-3 outline-none"
                                                >
                                                    <LayoutDashboard className="w-4 h-4" />
                                                    <span className="text-caption font-black uppercase tracking-widest">Gestion Multi-Guilde</span>
                                                </DropdownMenuItem>
                                            </DashboardDrawer>

                                            <DropdownMenuItem asChild className="focus:bg-zinc-800 focus:text-white rounded-xl p-3 cursor-pointer outline-none">
                                                <Link href={dashboardHref} className="flex items-center gap-3 w-full">
                                                    <LayoutDashboard className="w-4 h-4 opacity-40" />
                                                    <span className="text-caption font-black uppercase tracking-widest">Dashboard Central</span>
                                                </Link>
                                            </DropdownMenuItem>

                                            <DropdownMenuSeparator className="bg-white/5 mx-2" />
                                            
                                            <DropdownMenuItem 
                                                onSelect={() => logoutAction()}
                                                className="focus:bg-rose-500/10 focus:text-rose-400 rounded-xl p-3 cursor-pointer w-full flex items-center gap-3 outline-none"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                <span className="text-caption font-black uppercase tracking-widest text-left flex-1">Déconnexion</span>
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
                                        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-emerald-500/40 hover:bg-white/[0.08] text-body-sm font-semibold text-white transition-colors">
                                            <DiscordIcon className="w-4 h-4 text-emerald-400" />
                                            Connexion
                                        </button>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="lg:hidden">
                            <Sheet>
                                <SheetTrigger asChild>
                                    <button aria-label="Ouvrir le menu" className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors outline-none">
                                        <div className="space-y-1.5">
                                            <div className="w-5 h-0.5 bg-white rounded-full" />
                                            <div className="w-3 h-0.5 bg-white rounded-full ml-auto" />
                                            <div className="w-5 h-0.5 bg-white rounded-full" />
                                        </div>
                                    </button>
                                </SheetTrigger>
                                <SheetContent side="right" className="w-[300px] bg-zinc-950 border-l border-white/5 p-0 overflow-hidden flex flex-col">
                                    <div className="p-6 pb-2 flex flex-col gap-1 mt-8">
                                        <div className="flex items-center gap-2.5">
                                            <Image src="/assets/ui/logo-v2.png" alt="SigilOS" width={28} height={28} className="object-contain" />
                                            <span className="text-lg font-bold tracking-tight text-white">Sigil<span className="text-emerald-400">OS</span></span>
                                        </div>
                                    </div>

                                    <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto" aria-label="Navigation mobile">
                                        {NAV_ITEMS.map((item) => (
                                            <Link
                                                key={item.id}
                                                href={item.href}
                                                className="flex items-center justify-between p-3 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                                            >
                                                {item.label}
                                                <ChevronRight className="w-4 h-4 text-zinc-600" />
                                            </Link>
                                        ))}
                                    </nav>

                                    {!user && (
                                        <div className="p-4 border-t border-white/10">
                                            <form action={loginWithDiscord}>
                                                <button className="w-full h-11 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                                                    <DiscordIcon className="w-4 h-4" />
                                                    Se connecter
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
