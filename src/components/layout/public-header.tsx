"use client";
import { useState, useEffect } from "react";

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
    { label: "Documentation", href: "/docs", id: "docs" },
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
    /** Custom dashboard link */
    dashboardHref?: string;
    /** Whether the user is an authorized guild member */
    isMember?: boolean;
}

export function PublicHeader({ activePage, backHref, backLabel, user, variant = "standard", dashboardHref = "/dashboard", isMember: isMemberProp }: PublicHeaderProps) {
    const isHero = variant === "hero";

    const [isMember, setIsMember] = useState(isMemberProp ?? false);

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

    // Filter navigation based on access
    const filteredNav = NAV_ITEMS.filter(item => {
        if (item.id === "docs") return isMember;
        return true;
    });

    return (
        <header className={`
            ${isHero ? "absolute" : "fixed"} 
            top-0 left-0 right-0 z-50 
            ${isHero ? "bg-transparent" : "bg-black/60 backdrop-blur-3xl backdrop-saturate-150 border-b border-white/10"}
            transition-all duration-500
        `}>
            <div className="max-w-screen-2xl mx-auto px-6 md:px-12">
                <div className="flex items-center justify-between h-24 md:h-28">

                    {/* Left: Brand + Nav */}
                    <div className="flex items-center gap-10">
                        <Link href="/" className="flex items-center gap-4 group shrink-0">
                            <div className="relative w-12 h-12 md:w-14 md:h-14 transition-all duration-700 ease-out group-hover:scale-110 group-hover:rotate-[3deg]">
                                <Image
                                    src="/assets/ui/logo-v2.png"
                                    alt="SigilOS"
                                    fill
                                    className="object-contain drop-shadow-[0_0_20px_rgba(168,85,247,0.8)] brightness-125 transition-all duration-500"
                                    priority
                                />
                            </div>
                            <span className="text-2xl md:text-3xl font-black tracking-[0.2em] text-white font-heading transition-all duration-500 group-hover:text-purple-100">
                                SIGIL<span className="text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.7)]">OS</span>
                            </span>
                        </Link>

                        {/* Desktop Nav */}
                        <nav className="hidden lg:flex items-center gap-1">
                            {filteredNav.map((item) => {
                                const isActive = activePage === item.id;
                                return (
                                    <Link
                                        key={item.id}
                                        href={item.href}
                                        className={`
                                            relative px-7 py-3.5 rounded-xl text-base font-black transition-all duration-300 tracking-[0.15em] uppercase
                                            ${isActive
                                                ? "text-white bg-white/10 shadow-[0_0_25px_rgba(255,255,255,0.1)] border border-white/15"
                                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                                            }
                                            group/nav
                                        `}
                                    >
                                        {item.label}
                                        <span className={`absolute bottom-2 left-7 right-7 h-1 bg-purple-500 rounded-full scale-x-0 group-hover/nav:scale-x-100 transition-transform duration-500 ${isActive ? 'hidden' : ''}`} />
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
                                className="flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-all group border border-transparent hover:border-white/10"
                            >
                                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                {backLabel || "Retour"}
                            </Link>
                        ) : user ? (
                            <div className="flex items-center gap-3">
                                {activePage !== "dashboard" && (
                                    <Link
                                        href={dashboardHref}
                                        className="hidden md:flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-white text-black text-xs font-black uppercase tracking-widest transition-all hover:scale-105 hover:bg-zinc-100 shadow-xl shadow-white/5 active:scale-95"
                                    >
                                        <LayoutDashboard className="w-4 h-4" />
                                        Dashboard
                                    </Link>
                                )}
                                <Link
                                    href="/api/auth/signout"
                                    className="p-3 rounded-xl bg-zinc-900/80 hover:bg-red-500/10 border border-white/10 hover:border-red-500/50 text-zinc-500 hover:text-red-400 transition-all active:scale-95"
                                    title="Se déconnecter"
                                >
                                    <LogOut className="w-4 h-4" />
                                </Link>
                            </div>
                        ) : (
                            <button
                                onClick={() => loginWithDiscord()}
                                className="px-8 py-3 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-black uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-white/5 active:scale-95"
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
