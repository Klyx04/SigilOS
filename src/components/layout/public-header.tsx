"use client";
import { useEffect, useState } from "react";

import Link from "next/link";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { User } from "next-auth";
import { Button } from "@/components/ui/button";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import { DiscordIcon } from "@/components/shared/icons";

type NavItem = {
    label: string;
    href: string;
    id: string;
};

const NAV_ITEMS: NavItem[] = [
    { label: "Fonctionnalités", href: "/#features", id: "features" },
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
        <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/5 transition-all duration-500">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-20">

                    {/* Left: Brand */}
                    <div className="flex items-center gap-12">
                        <Link href="/" className="flex items-center gap-3 group shrink-0">
                            <div className="relative w-10 h-10 transition-transform duration-500 group-hover:rotate-6">
                                {/* Subtle Logo Aura */}
                                <div className="absolute inset-0 bg-emerald-500/30 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Image
                                    src="/assets/ui/logo-v2.png"
                                    alt="SigilOS"
                                    fill
                                    className="object-contain relative z-10 drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                                    priority
                                />
                            </div>
                            <span className="text-2xl font-heading tracking-tight text-white transition-colors group-hover:text-emerald-400">
                                SigilOS
                            </span>
                        </Link>

                        {/* Desktop Nav */}
                        <nav className="hidden md:flex items-center gap-2">
                            {filteredNav.map((item) => {
                                const isActive = activePage === item.id;
                                return (
                                    <Link
                                        key={item.id}
                                        href={item.href}
                                        className={`
                                            px-5 py-2 rounded-full text-sm font-medium transition-all
                                            ${isActive
                                                ? "text-accent-gold bg-accent-gold/10"
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

                    {/* Right: CTA */}
                    <div className="flex items-center gap-4">
                        {user ? (
                            <div className="flex items-center gap-4">
                                <Link
                                    href={dashboardHref}
                                    className="px-6 py-2.5 rounded-full bg-accent-teal text-bg-primary text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 teal-glow"
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    href="/api/auth/signout"
                                    className="p-2.5 rounded-full bg-white/5 border border-white/10 text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-all"
                                    title="Déconnexion"
                                >
                                    <LogOut className="w-4 h-4" />
                                </Link>
                            </div>
                        ) : (
                            <form action={loginWithDiscord}>
                                <Button
                                    type="submit"
                                    className="px-8 py-2.5 rounded-full bg-[#5865F2] hover:bg-[#4752c4] text-white text-[11px] font-black uppercase tracking-widest transition-transform hover:scale-105 active:scale-95 flex items-center gap-2 shadow-[0_4px_20px_-4px_rgba(88,101,242,0.5)] hover:shadow-[0_4px_24px_-4px_rgba(88,101,242,0.7)]"
                                >
                                    <DiscordIcon className="w-4 h-4" />
                                    Connexion Discord
                                </Button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
