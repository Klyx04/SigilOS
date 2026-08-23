"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import { LogOut, RefreshCw, Crown } from "lucide-react";
import { useState, useEffect } from "react";
import { AccessRequestModal } from "@/components/landing/AccessRequestModal";

interface NoGuildMessageProps {
    rateLimited?: boolean;
}

export function NoGuildMessage({ rateLimited }: NoGuildMessageProps) {
    const [showModal, setShowModal] = useState(false);

    // Auto-reload when rate limited (paused while the request modal is open)
    // so the user never stays blocked on a stale state.
    useEffect(() => {
        if (rateLimited && !showModal) {
            const interval = setInterval(() => {
                window.location.reload();
            }, 15000);
            return () => clearInterval(interval);
        }
    }, [rateLimited, showModal]);

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
                                Accès Restreint
                            </h1>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                Votre compte Discord n'est associé à aucune guilde active sur SigilOS.
                            </p>
                        </div>

                        {/* Rate-limit notice — non bloquant, le CTA d'inscription reste l'essentiel */}
                        {rateLimited && (
                            <div className="flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning/5 px-3.5 py-3 text-left">
                                <RefreshCw className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-caption text-warning/90 font-semibold leading-relaxed">
                                        Vérification des accès en cours — l'API Discord répond avec un léger délai.
                                    </p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="text-caption font-bold text-warning underline underline-offset-2 hover:text-foreground transition-colors mt-1"
                                    >
                                        Relancer la vérification
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* CTAs */}
                        <div className="flex flex-col gap-3 pt-2">
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
