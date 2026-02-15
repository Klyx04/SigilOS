"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { LogOut, Home, RefreshCw, Crown, MessageSquare, ShieldAlert, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { PublicHeader } from "@/components/layout/public-header";
import { useSession } from "next-auth/react";

interface NoGuildMessageProps {
    rateLimited?: boolean;
}

export function NoGuildMessage({ rateLimited }: NoGuildMessageProps) {
    const { data: session } = useSession();

    // Auto-reload every 3 seconds when rate limited (Discord sync in progress)
    useEffect(() => {
        if (rateLimited) {
            const interval = setInterval(() => {
                window.location.reload();
            }, 3000); // Reload every 3 seconds

            return () => clearInterval(interval);
        }
    }, [rateLimited]);

    return (
        <div className="relative w-full flex flex-col items-center justify-center p-4 min-h-screen">
            <PublicHeader user={session?.user} />
            <AuroraBackground className="absolute inset-0 z-0 pointer-events-none opacity-40" />
            {/* Ambient Noise Overlay */}
            <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none" />

            <div className="relative z-10 max-w-lg w-full text-center space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-1000">

                {/* Main Content Card */}
                <div className="glass-premium p-10 rounded-3xl border border-white/5 bg-zinc-900/20 backdrop-blur-2xl relative overflow-hidden group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-3xl blur opacity-25 group-hover:opacity-40 transition duration-1000" />

                    <div className="relative z-10 space-y-8">
                        {/* Logo Animation */}
                        <div className="mx-auto w-24 h-24 relative">
                            <div className="absolute inset-0 bg-purple-500/30 blur-[40px] rounded-full animate-pulse" />
                            <Image
                                src="/assets/ui/logo-v2.png"
                                alt="SigilOS"
                                fill
                                className="object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.5)] brightness-125"
                                priority
                            />
                        </div>

                        <div className="space-y-4">
                            <h1 className="text-4xl font-black text-white tracking-tighter uppercase font-heading drop-shadow-lg">
                                {rateLimited ? "Exploration..." : "Portail Restreint"}
                            </h1>
                            <div className="h-1 w-20 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mx-auto rounded-full opacity-50"></div>

                            <p className="text-zinc-400 text-base max-w-sm mx-auto leading-relaxed">
                                {rateLimited
                                    ? "Synchronisation des protocoles d'accès en cours. Nous scannons la galaxie..."
                                    : "Aucune guilde active n'est associée à votre compte Discord."}
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-4 w-full max-w-[240px] mx-auto pt-4">
                            {rateLimited ? (
                                <Button
                                    onClick={() => window.location.reload()}
                                    className="h-12 rounded-xl bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all hover:scale-105"
                                >
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin-slow" />
                                    Relancer la synchro
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => signOut({ callbackUrl: "/" })}
                                    variant="outline"
                                    className="h-12 rounded-xl border-white/10 text-white hover:bg-white/5 transition-all uppercase font-bold tracking-widest text-[10px]"
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Changer de Compte
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Conversion Section with improved visuals */}
                {!rateLimited && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                        <div className="relative group/beta">
                            <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/50 to-orange-500/50 rounded-2xl blur opacity-0 group-hover/beta:opacity-10 transition duration-500" />
                            <div className="relative bg-zinc-900/40 p-6 rounded-2xl border border-white/5 backdrop-blur-sm overflow-hidden text-center">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="p-3 rounded-full bg-amber-500/10 border border-amber-500/20 group-hover/beta:scale-110 transition-transform">
                                        <Crown className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-white font-black uppercase tracking-widest text-sm">Responsable de Guilde ?</h3>
                                        <p className="text-zinc-500 text-[10px] font-bold">Propulsez votre serveur dans une nouvelle dimension.</p>
                                    </div>

                                    <Button asChild className="w-full max-w-xs h-11 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#5865F2]/20 transition-all hover:scale-[1.02]">
                                        <Link href="https://discord.gg/uX7G6SUDgN" target="_blank">
                                            <MessageSquare className="w-4 h-4 mr-2" />
                                            Rejoindre le Discord Support
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-[9px] text-zinc-700 uppercase tracking-[0.4em] font-black">
                            <span className="w-1 h-1 rounded-full bg-emerald-500/30"></span>
                            <span>SigilOS • Réseau Sécurisé</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
