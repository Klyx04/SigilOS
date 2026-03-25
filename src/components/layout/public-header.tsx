"use client";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

import Link from "next/link";
import Image from "next/image";
import { LogOut, ChevronRight } from "lucide-react";
import { User } from "next-auth";
import { Button } from "@/components/ui/button";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import { DiscordIcon } from "@/components/shared/icons";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardDrawer } from "./dashboard-drawer";

type NavItem = {
    label: string;
    href: string;
    id: string;
};

const NAV_ITEMS: NavItem[] = [
    { label: "Explorer", href: "/#features", id: "features" },
    { label: "Annuaire", href: "/guilds", id: "annuaire" },
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
}

export function PublicHeader({ activePage, user, variant = "standard", dashboardHref = "/dashboard", isMember: isMemberProp }: PublicHeaderProps) {
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
                "fixed top-0 left-0 right-0 z-50 transition-all duration-500 py-4 px-4 sm:px-6 lg:px-8",
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
                        <Link href="/" className="flex items-center gap-3 group shrink-0">
                            <div className="relative w-8 h-8 sm:w-10 sm:h-10 transition-all duration-500 group-hover:scale-110">
                                <div className="absolute inset-0 bg-emerald-500/40 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Image
                                    src="/assets/ui/logo-v2.png"
                                    alt="SigilOS"
                                    fill
                                    className="object-contain relative z-10 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                    priority
                                />
                            </div>
                            <span className="text-xl sm:text-2xl font-black tracking-tighter text-white transition-all group-hover:text-emerald-400 group-hover:italic uppercase leading-none">
                                Sigil<span className="text-emerald-500 group-hover:text-white">OS</span>
                            </span>
                        </Link>

                        {/* Desktop Nav (Standard 2026) */}
                        <nav className="hidden lg:flex items-center gap-1 bg-white/[0.03] border border-white/5 rounded-full p-1 leading-none">
                            {NAV_ITEMS.map((item) => {
                                const isActive = activePage === item.id;
                                return (
                                    <Link
                                        key={item.id}
                                        href={item.href}
                                        className={cn(
                                            "px-5 py-2 rounded-full text-[11px] font-black transition-all uppercase tracking-widest leading-none",
                                            isActive
                                                ? "text-white bg-white/10 shadow-lg"
                                                : "text-zinc-500 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Right: Auth / CTA / Mobile Toggle */}
                    <div className="flex items-center gap-3 sm:gap-5">
                        <AnimatePresence mode="wait">
                            {user ? (
                                <motion.div 
                                    key="logged-in"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-3"
                                >
                                    <DashboardDrawer>
                                        <button className="group relative flex items-center gap-3 px-6 py-3 rounded-2xl bg-white text-black text-[12px] font-black uppercase tracking-widest transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:-translate-y-0.5 active:scale-95 shadow-2xl">
                                            Dashboard
                                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                        </button>
                                    </DashboardDrawer>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="logged-out"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="hidden sm:block"
                                >
                                    <form action={loginWithDiscord}>
                                        <button className="group relative flex items-center gap-3 px-8 py-3 rounded-2xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-[11px] font-black uppercase tracking-widest transition-all hover:shadow-[0_0_25px_rgba(88,101,242,0.5)] hover:-translate-y-0.5">
                                            <DiscordIcon className="w-4.5 h-4.5" />
                                            Connexion
                                        </button>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Mobile Menu Button - PREMIUM 2026 */}
                        <div className="lg:hidden">
                             {/* Simple burger menu toggle button - would be connected to a mobile sheet in production */}
                             <button className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all">
                                 <div className="space-y-1.5">
                                     <div className="w-5 h-0.5 bg-white rounded-full" />
                                     <div className="w-3 h-0.5 bg-white rounded-full ml-auto" />
                                     <div className="w-5 h-0.5 bg-white rounded-full" />
                                 </div>
                             </button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.header>
    );
}
