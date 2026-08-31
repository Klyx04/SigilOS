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
import { ThemeToggle } from "./ThemeToggle";

type NavItem = {
    label: string;
    href: string;
    id: string;
};

const NAV_ITEMS: NavItem[] = [
    { label: "Produit", href: "/#produit", id: "produit" },
    { label: "Almanax", href: "/almanax", id: "almanax" },
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

export function PublicHeader({ activePage, user, variant: _variant = "standard", dashboardHref = "/dashboard", isFixed = true, clientId, isMember }: PublicHeaderProps) {
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
                    ? "bg-background/95 backdrop-blur-md border-b border-border py-2.5"
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
                            <span className="text-lg font-bold tracking-tight text-foreground leading-none">
                                Sigil<span className="text-success">OS</span>
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
                                                ? "text-foreground bg-surface"
                                                : "text-muted-foreground hover:text-foreground hover:bg-surface"
                                        )}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Right: Auth & Theme */}
                    <div className="flex items-center gap-3 sm:gap-4">
                        <ThemeToggle />
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
                                            <button className="flex items-center gap-3 pl-3 pr-4 py-2 rounded-xl bg-background/[0.05] border border-border hover:bg-background/[0.08] hover:border-success/30 transition-colors outline-none">
                                                <Avatar className="w-10 h-10 border border-border rounded-xl">
                                                    <AvatarImage src={user.image || ""} />
                                                    <AvatarFallback className="bg-elevated text-foreground font-black">{user.name?.[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col items-start -space-y-0.5 hidden sm:flex">
                                                    <span className="text-caption font-black text-foreground/40 uppercase tracking-widest">Session</span>
                                                    <span className="text-caption font-bold text-foreground">{user.name}</span>
                                                </div>
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-64 bg-background border border-border rounded-2xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" align="end">
                                            <DropdownMenuLabel className="px-4 py-3">
                                                <div className="flex flex-col space-y-1">
                                                    <p className="text-xs font-black text-foreground uppercase tracking-widest">Compte SigilOS</p>
                                                    <p className="text-caption text-muted-foreground font-medium truncate">{user.name || "Connecté via Discord"}</p>
                                                </div>
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator className="bg-surface mx-2" />
                                            
                                            {isMember !== false && (
                                                <>
                                                    <DashboardDrawer clientId={clientId}>
                                                        <DropdownMenuItem 
                                                            onSelect={(e) => e.preventDefault()}
                                                            className="focus:bg-success/10 focus:text-success rounded-xl p-3 cursor-pointer w-full flex items-center gap-3 outline-none"
                                                        >
                                                            <LayoutDashboard className="w-4 h-4" />
                                                            <span className="text-caption font-black uppercase tracking-widest">Gestion Multi-Guilde</span>
                                                        </DropdownMenuItem>
                                                    </DashboardDrawer>

                                                    <DropdownMenuItem asChild className="focus:bg-elevated focus:text-foreground rounded-xl p-3 cursor-pointer outline-none">
                                                        <Link href={dashboardHref} className="flex items-center gap-3 w-full">
                                                            <LayoutDashboard className="w-4 h-4 opacity-40" />
                                                            <span className="text-caption font-black uppercase tracking-widest">Dashboard Central</span>
                                                        </Link>
                                                    </DropdownMenuItem>
                                                </>
                                            )}

                                            <DropdownMenuSeparator className="bg-surface mx-2" />
                                            
                                            <DropdownMenuItem 
                                                onSelect={() => logoutAction()}
                                                className="focus:bg-danger/10 focus:text-danger rounded-xl p-3 cursor-pointer w-full flex items-center gap-3 outline-none"
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
                                        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface border border-border hover:border-success/40 hover:bg-background/[0.08] text-body-sm font-semibold text-foreground transition-colors">
                                            <DiscordIcon className="w-4 h-4 text-success" />
                                            Connexion
                                        </button>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="lg:hidden">
                            <Sheet>
                                <SheetTrigger asChild>
                                    <button aria-label="Ouvrir le menu" className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface border border-border text-foreground hover:bg-elevated transition-colors outline-none">
                                        <div className="space-y-1.5">
                                            <div className="w-5 h-0.5 bg-foreground/40 rounded-full" />
                                            <div className="w-3 h-0.5 bg-foreground/40 rounded-full ml-auto" />
                                            <div className="w-5 h-0.5 bg-foreground/40 rounded-full" />
                                        </div>
                                    </button>
                                </SheetTrigger>
                                <SheetContent side="right" className="w-[300px] bg-background border-l border-border p-0 overflow-hidden flex flex-col">
                                    <div className="p-6 pb-2 flex flex-col gap-1 mt-8">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <Image src="/assets/ui/logo-v2.png" alt="SigilOS" width={28} height={28} className="object-contain" />
                                                <span className="text-lg font-bold tracking-tight text-foreground">Sigil<span className="text-success">OS</span></span>
                                            </div>
                                            <ThemeToggle />
                                        </div>
                                    </div>

                                    <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto" aria-label="Navigation mobile">
                                        {NAV_ITEMS.map((item) => (
                                            <Link
                                                key={item.id}
                                                href={item.href}
                                                className="flex items-center justify-between p-3 rounded-lg text-sm font-medium text-foreground hover:text-foreground hover:bg-surface transition-colors"
                                            >
                                                {item.label}
                                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                            </Link>
                                        ))}
                                    </nav>

                                    {!user && (
                                        <div className="p-4 border-t border-border">
                                            <form action={loginWithDiscord}>
                                                <button className="w-full h-11 rounded-lg bg-[#5865F2] hover:bg-[#4752c4] text-foreground text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
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
