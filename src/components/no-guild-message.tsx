"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { LogOut, Home, RefreshCw, Crown, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

interface NoGuildMessageProps {
    rateLimited?: boolean;
}

export function NoGuildMessage({ rateLimited }: NoGuildMessageProps) {
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
        <div className="relative w-full flex flex-col items-center justify-center p-4 min-h-[60vh]">
            {/* Ambient Noise Overlay */}
            <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none" />

            <div className="relative z-10 max-w-lg w-full text-center space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">

                {/* Logo Section */}
                <div className="mx-auto w-32 h-32 relative group">
                    <div className="absolute inset-0 bg-purple-500/20 blur-[50px] rounded-full opacity-50 group-hover:opacity-80 transition-opacity" />
                    <Image
                        src="/assets/ui/logo-v2.png"
                        alt="SigilOS"
                        fill
                        className="object-contain drop-shadow-[0_0_50px_rgba(168,85,247,0.6)] brightness-110 relative z-10"
                        priority
                    />
                </div>

                {/* Main Content */}
                <div className="space-y-4">
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase font-heading">
                        {rateLimited ? "Initialisation" : "Portail Restreint"}
                    </h1>
                    <div className="h-1 w-20 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mx-auto rounded-full opacity-50"></div>

                    <p className="text-zinc-400 text-lg max-w-md mx-auto leading-relaxed">
                        {rateLimited
                            ? "Synchronisation des protocoles d'accès en cours. Veuillez patienter."
                            : "Aucune guilde active n'est associée à votre compte sur ce secteur."}
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-4 w-full max-w-[280px] mx-auto">
                    {rateLimited ? (
                        <Button
                            onClick={() => window.location.reload()}
                            className="h-12 rounded-xl bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-zinc-200"
                        >
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin-slow" />
                            Relancer la synchro
                        </Button>
                    ) : (
                        <Button
                            onClick={() => signOut({ callbackUrl: "/" })}
                            variant="ghost"
                            className="h-12 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors uppercase font-bold tracking-widest text-[10px]"
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Déconnexion
                        </Button>
                    )}
                </div>

                {/* Guild Leader Conversion Section */}
                {!rateLimited && (
                    <div className="pt-10 border-t border-white/5 space-y-6">
                        <div className="bg-gradient-to-br from-zinc-900/80 to-zinc-950 p-6 rounded-2xl border border-white/5 shadow-xl backdrop-blur-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[40px] -z-10" />

                            <div className="flex flex-col items-center gap-4">
                                <div className="p-3 rounded-full bg-amber-500/10 border border-amber-500/20">
                                    <Crown className="w-6 h-6 text-amber-400" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-white font-black uppercase tracking-tight text-base">Chef de Guilde ?</h3>
                                    <p className="text-zinc-500 text-xs">Propulsez votre gestion dans une nouvelle dimension.</p>
                                </div>

                                <Button asChild className="w-full h-11 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#5865F2]/20">
                                    <Link href="https://discord.gg/uX7G6SUDgN" target="_blank">
                                        <MessageSquare className="w-4 h-4 mr-2" />
                                        Rejoindre la Bêta Privée
                                    </Link>
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-700 uppercase tracking-widest font-black">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span>
                            <span>Système Sécurisé</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
