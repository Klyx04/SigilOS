"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import { LogOut, RefreshCw, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { AccessRequestModal } from "@/components/landing/AccessRequestModal";
import { useSession } from "next-auth/react";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

interface NoGuildMessageProps {
    rateLimited?: boolean;
}

export function NoGuildMessage({ rateLimited }: NoGuildMessageProps) {
    const { data: session } = useSession();
    const [showModal, setShowModal] = useState(false);

    // Auto-reload every 3 seconds when rate limited
    useEffect(() => {
        if (rateLimited) {
            const interval = setInterval(() => {
                window.location.reload();
            }, 15000);
            return () => clearInterval(interval);
        }
    }, [rateLimited]);

    return (
        <div className="relative w-full flex-1 flex flex-col items-center justify-center p-4">

            {/* Background glow effects — same as landing */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[150px]" />
                <div className="absolute inset-0 bg-[url(/noise.svg)] opacity-[0.03] mix-blend-overlay" />
            </div>

            <div className="relative z-10 max-w-md w-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">

                {/* Logo */}
                <div className="mx-auto w-20 h-20 relative">
                    <div className="absolute inset-0 bg-emerald-500/20 blur-[40px] rounded-full animate-pulse" />
                    <Image
                        src="/assets/ui/logo-v2.png"
                        alt="SigilOS"
                        fill
                        className="object-contain drop-shadow-[0_0_24px_rgba(16,185,129,0.4)]"
                        priority
                    />
                </div>

                {/* Main card */}
                <div className="relative bg-zinc-950/80 border border-white/8 rounded-3xl p-8 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/50">
                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <h1 className="text-3xl font-black text-white tracking-tight font-heading">
                                {rateLimited ? "Vérification indisponible" : "Accès Restreint"}
                            </h1>
                            <p className="text-zinc-400 text-sm leading-relaxed">
                                {rateLimited
                                    ? "L'API Discord est temporairement saturée (trop de requêtes). La vérification de vos accès reprendra automatiquement dans quelques instants."
                                    : "Votre compte Discord n'est associé à aucune guilde active sur SigilOS."}
                            </p>
                        </div>

                        {/* CTAs */}
                        <div className="flex flex-col gap-3 pt-2">
                            {rateLimited ? (
                                <Button
                                    onClick={() => window.location.reload()}
                                    className="h-12 rounded-xl bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all hover:scale-105"
                                >
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin-slow" />
                                    Relancer la vérification
                                </Button>
                            ) : (
                                <>
                                    {/* PRIMARY — Demander l'accès */}
                                    <button
                                        onClick={() => setShowModal(true)}
                                        className="group relative w-full h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black font-black uppercase tracking-[0.12em] text-sm shadow-[0_16px_40px_-8px_rgba(16,185,129,0.5)] hover:shadow-[0_20px_50px_-6px_rgba(16,185,129,0.65)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] overflow-hidden flex flex-col items-center justify-center"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                                        <span className="text-[10px] opacity-70 mb-0.5">Chef de Guilde ?</span>
                                        <div className="flex items-center gap-2">
                                            <Crown className="w-4 h-4" />
                                            <span>Inscrire ma Guilde</span>
                                        </div>
                                    </button>

                                    {/* SECONDARY — Changer de compte */}
                                    <button
                                        onClick={() => signOut({ callbackUrl: "/" })}
                                        className="h-10 rounded-xl border border-white/8 text-zinc-500 hover:text-zinc-300 hover:border-white/15 transition-all text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        <LogOut className="h-3.5 w-3.5" />
                                        Changer de compte
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <p className="text-[10px] text-zinc-700 uppercase tracking-[0.3em] font-black">
                    SigilOS · Réseau Sécurisé
                </p>
            </div>

            <AccessRequestModal open={showModal} onClose={() => setShowModal(false)} />
        </div>
    );
}
