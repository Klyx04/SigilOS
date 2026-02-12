"use client";

import Link from "next/link";
import Image from "next/image";
import { LogOut, LayoutDashboard } from "lucide-react";
import { User } from "next-auth";
import { loginWithDiscord } from "@/server/actions/auth-actions";

export function LandingHeader({ user }: { user?: User }) {
    return (
        <header className="absolute top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-center bg-transparent pointer-events-auto">
            <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-4 group">
                    <div className="relative w-24 h-24 transition-transform group-hover:scale-105 duration-500 ease-out">
                        <Image
                            src="/assets/ui/logo-v2.png"
                            alt="SigilOS"
                            fill
                            className="object-contain drop-shadow-[0_0_35px_rgba(168,85,247,1)] drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] brightness-125 animate-pulse-slow"
                            priority
                        />
                    </div>
                    <div className="text-4xl font-black tracking-widest text-white font-heading drop-shadow-2xl">
                        SIGIL<span className="text-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.8)]">OS</span>
                    </div>
                </Link>

                <nav className="hidden md:flex items-center gap-6">
                    <Link
                        href="/guilds"
                        className="text-sm font-bold text-zinc-300 hover:text-white transition-colors flex items-center gap-2 uppercase tracking-wide hover:tracking-widest duration-300"
                    >
                        Annuaire
                    </Link>
                </nav>
            </div>

            <div className="flex items-center gap-4">
                {user ? (
                    <div className="flex items-center gap-3">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 text-sm font-bold text-white transition-all hover:scale-105 shadow-lg shadow-indigo-500/20"
                        >
                            <LayoutDashboard className="w-4 h-4" />
                            <span>Dashboard</span>
                        </Link>
                        <Link
                            href="/api/auth/signout"
                            className="p-2.5 rounded-full bg-zinc-900/50 hover:bg-red-500/10 border border-white/5 hover:border-red-500/50 text-zinc-400 hover:text-red-400 transition-all"
                            title="Se déconnecter"
                        >
                            <LogOut className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    <button
                        onClick={() => loginWithDiscord()}
                        className="px-6 py-2.5 rounded-full bg-white text-black hover:bg-zinc-200 text-sm font-bold transition-all hover:scale-105 shadow-lg shadow-white/10"
                    >
                        Se connecter
                    </button>
                )}
            </div>
        </header>
    );
}
