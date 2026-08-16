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

            <div className="relative z-10 max-w-md w-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-200">

                {/* Logo */}
                <div className="mx-auto w-20 h-20 relative">
                    <Image
                        src="/assets/ui/logo-v2.png"
                        alt="SigilOS"
                        fill
                        className="object-contain"
                        priority
                    />
                </div>

                {/* Main card */}
                <div className="relative bg-background/80 border border-white/8 rounded-3xl p-8 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/50">
                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-success/60 to-transparent" />

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <h1 className="text-display-xl font-bold text-foreground font-heading tracking-tight">
                                {rateLimited ? "Vérification indisponible" : "Accès Restreint"}
                            </h1>
                            <p className="text-muted-foreground text-sm leading-relaxed">
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
                                    className="h-12 rounded-xl bg-background text-foreground font-semibold text-sm hover:bg-surface transition-colors"
                                >
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin-slow" />
                                    Relancer la vérification
                                </Button>
                            ) : (
                                <>
                                    {/* PRIMARY — Demander l'accès */}
                                    <button
                                        onClick={() => setShowModal(true)}
                                        className="group relative w-full h-14 rounded-xl bg-success hover:bg-success text-success-foreground font-bold text-sm transition-colors active:scale-[0.99] overflow-hidden flex flex-col items-center justify-center"
                                    >
                                        <span className="text-caption opacity-80 mb-0.5">Chef de Guilde ?</span>
                                        <div className="flex items-center gap-2">
                                            <Crown className="w-4 h-4" />
                                            <span>Inscrire ma Guilde</span>
                                        </div>
                                    </button>

                                    {/* SECONDARY — Changer de compte */}
                                    <button
                                        onClick={() => signOut({ callbackUrl: "/" })}
                                        className="h-10 rounded-xl border border-white/8 text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors text-xs font-medium flex items-center justify-center gap-2"
                                    >
                                        <LogOut className="h-3.5 w-3.5" />
                                        Changer de compte
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <p className="text-caption text-muted-foreground uppercase tracking-wider font-medium">
                    SigilOS · Réseau Sécurisé
                </p>
            </div>

            <AccessRequestModal open={showModal} onClose={() => setShowModal(false)} />
        </div>
    );
}
