"use client";
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
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 py-4 ${
                scrolled ? "px-4" : "px-0"
            }`}
        >
            <div className={`mx-auto transition-all duration-500 ${
                scrolled 
                ? "max-w-5xl rounded-2xl bg-zinc-950/60 backdrop-blur-2xl border border-white/10 shadow-2xl px-6" 
                : "max-w-7xl bg-transparent border-b border-white/5 px-6"
            }`}>
                <div className="flex items-center justify-between h-16">

                    {/* Left: Brand */}
                    <div className="flex items-center gap-10">
                        <Link href="/" className="flex items-center gap-3 group shrink-0">
                            <div className="relative w-8 h-8 transition-transform duration-500 group-hover:rotate-6">
                                <div className="absolute inset-0 bg-emerald-500/30 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Image
                                    src="/assets/ui/logo-v2.png"
                                    alt="SigilOS"
                                    fill
                                    className="object-contain relative z-10"
                                    priority
                                />
                            </div>
                            <span className="text-xl font-heading tracking-tight text-white transition-colors group-hover:text-emerald-400">
                                SigilOS
                            </span>
                        </Link>

                        {/* Desktop Nav */}
                        <nav className="hidden md:flex items-center gap-1">
                            {NAV_ITEMS.map((item) => {
                                const isActive = activePage === item.id;
                                return (
                                    <Link
                                        key={item.id}
                                        href={item.href}
                                        className={`
                                            px-4 py-1.5 rounded-full text-[13px] font-bold transition-all uppercase tracking-wider
                                            ${isActive
                                                ? "text-emerald-400 bg-emerald-400/10"
                                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                                            }
                                        `}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Right: Auth / CTA */}
                    <div className="flex items-center gap-4">
                        <AnimatePresence mode="wait">
                            {user ? (
                                <motion.div 
                                    key="logged-in"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="flex items-center gap-3"
                                >
                                    <DashboardDrawer>
                                        <button
                                            className="group relative flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-[11px] font-black uppercase tracking-widest transition-all hover:scale-[1.03] active:scale-95 shadow-xl"
                                        >
                                            Dashboard
                                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                                        </button>
                                    </DashboardDrawer>
                                    
                                    <Link
                                        href="/api/auth/signout"
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-all"
                                        title="Déconnexion"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </Link>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="logged-out"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <form action={loginWithDiscord}>
                                        <button
                                            type="submit"
                                            className="group relative flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-[11px] font-black uppercase tracking-widest transition-all hover:shadow-[0_0_20px_rgba(88,101,242,0.4)]"
                                        >
                                            <DiscordIcon className="w-4 h-4" />
                                            Connexion
                                        </button>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </motion.header>
    );
}
