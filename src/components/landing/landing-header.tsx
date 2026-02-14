"use client";

import Link from "next/link";
import Image from "next/image";
import { LogOut, LayoutDashboard } from "lucide-react";
import { User } from "next-auth";
import { loginWithDiscord } from "@/server/actions/auth-actions";

export function LandingHeader({ user }: { user?: User }) {
    return (
        <header className="absolute top-0 left-0 right-0 z-50 px-6 py-4 flex justify-between items-center bg-transparent pointer-events-auto transition-all duration-500">
            <div className="flex items-center gap-10">
                <Link href="/" className="flex items-center gap-4 group">
                    <div className="relative w-14 h-14 md:w-16 md:h-16 transition-all group-hover:scale-110 group-hover:rotate-[3deg] duration-700 ease-out">
                        <Image
                            src="/assets/ui/logo-v2.png"
                            alt="SigilOS"
                            fill
                            className="object-contain drop-shadow-[0_0_25px_rgba(168,85,247,0.7)] brightness-125"
                            priority
                        />
                    </div>
                    <div className="text-2xl md:text-3xl font-black tracking-[0.2em] text-white font-heading transition-all duration-500 group-hover:text-purple-100">
                        SIGIL<span className="text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.7)]">OS</span>
                    </div>
                </Link>

                <nav className="hidden md:flex items-center gap-2">
                    <Link
                        href="/guilds"
                        className="px-4 py-2 rounded-lg text-xs font-black text-zinc-500 hover:text-white hover:bg-white/5 transition-all uppercase tracking-[0.1em]"
                    >
                        Annuaire
                    </Link>
                </nav>
            </div>

            <div className="flex items-center gap-4">
                {user ? (
                    <div className="flex items-center gap-3">
                        <Link
                            href="/api/auth/signout"
                            className="p-2.5 rounded-lg bg-zinc-900/80 hover:bg-red-500/10 border border-white/10 hover:border-red-500/50 text-zinc-500 hover:text-red-400 transition-all"
                            title="Se déconnecter"
                        >
                            <LogOut className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    <button
                        onClick={() => loginWithDiscord()}
                        className="px-6 py-2.5 rounded-full bg-white text-black hover:bg-zinc-200 text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-white/10"
                    >
                        Se connecter
                    </button>
                )}
            </div>
        </header>
    );
}
