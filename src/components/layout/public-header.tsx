"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, LogOut, LayoutDashboard } from "lucide-react";
import { User } from "next-auth";
import { loginWithDiscord } from "@/server/actions/auth-actions";

type NavItem = {
    label: string;
    href: string;
    id: string;
};

const NAV_ITEMS: NavItem[] = [
    { label: "Annuaire", href: "/guilds", id: "annuaire" },
    { label: "Changelog", href: "/changelog", id: "changelog" },
    { label: "Status", href: "/status", id: "status" },
];

interface PublicHeaderProps {
    /** Highlights active nav item by id */
    activePage?: string;
    /** Optional back link (overrides nav) */
    backHref?: string;
    /** Back link label */
    backLabel?: string;
    /** Current user for auth state */
    user?: User;
    /** Design variant: hero (landing) or standard (inner) */
    variant?: "hero" | "standard";
}

export function PublicHeader({ activePage, backHref, backLabel, user, variant = "standard" }: PublicHeaderProps) {
    const isHero = variant === "hero";

    return (
        <header className={`
            ${isHero ? "absolute" : "fixed"} 
            top-0 left-0 right-0 z-50 
            ${isHero ? "bg-transparent" : "bg-zinc-950/80 backdrop-blur-xl border-b border-white/5"}
            transition-all duration-300
        `}>
            <div className="max-w-7xl mx-auto px-6 md:px-8">
                <div className="flex items-center justify-between h-20 md:h-28">

                    {/* Left: Brand + Nav */}
                    <div className="flex items-center gap-12">
                        <Link href="/" className="flex items-center gap-4 group shrink-0">
                            <div className="relative w-14 h-14 md:w-16 md:h-16 transition-transform group-hover:scale-110 duration-500 ease-out">
                                <Image
                                    src="/assets/ui/logo-v2.png"
                                    alt="SigilOS"
                                    fill
                                    className="object-contain drop-shadow-[0_0_25px_rgba(168,85,247,0.6)] brightness-110"
                                    priority
                                />
                            </div>
                            <span className="text-3xl md:text-4xl font-black tracking-[0.2em] text-white font-heading drop-shadow-2xl">
                                SIGIL<span className="text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]">OS</span>
                            </span>
                        </Link>

                        {/* Desktop Nav */}
                        <nav className="hidden lg:flex items-center gap-2">
                            {NAV_ITEMS.map((item) => {
                                const isActive = activePage === item.id;
                                return (
                                    <Link
                                        key={item.id}
                                        href={item.href}
                                        className={`
                                            px-5 py-2.5 rounded-xl text-base font-bold transition-all duration-300 uppercase tracking-wide
                                            ${isActive
                                                ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
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

                    {/* Right: Auth or Back */}
                    <div className="flex items-center gap-4">
                        {backHref ? (
                            <Link
                                href={backHref}
                                className="flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-widest text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-all group border border-transparent hover:border-white/10"
                            >
                                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                {backLabel || "Retour"}
                            </Link>
                        ) : user ? (
                            <div className="flex items-center gap-3">
                                {activePage !== "dashboard" && (
                                    <Link
                                        href="/dashboard"
                                        className="hidden md:flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-black uppercase tracking-wider transition-all hover:scale-105 shadow-lg shadow-purple-500/20"
                                    >
                                        <LayoutDashboard className="w-4 h-4" />
                                        Tableau de bord
                                    </Link>
                                )}
                                <Link
                                    href="/api/auth/signout"
                                    className="p-3 rounded-xl bg-zinc-900/80 hover:bg-red-500/10 border border-white/10 hover:border-red-500/50 text-zinc-400 hover:text-red-400 transition-all"
                                    title="Se déconnecter"
                                >
                                    <LogOut className="w-5 h-5" />
                                </Link>
                            </div>
                        ) : (
                            <button
                                onClick={() => loginWithDiscord()}
                                className="px-8 py-3.5 rounded-full bg-white text-black hover:bg-zinc-200 text-sm font-black uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-white/10"
                            >
                                Se connecter
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
