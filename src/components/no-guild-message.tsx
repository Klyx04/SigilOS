"use client";

import { signOut, signIn } from "next-auth/react";
import Image from "next/image";
import { LogOut, RefreshCw, Crown, ShieldAlert } from "lucide-react";
import { useState, useEffect } from "react";
import { AccessRequestModal } from "@/components/landing/AccessRequestModal";
import { shouldAutoReloadPortal } from "@/lib/onboarding-gating";

interface NoGuildMessageProps {
    rateLimited?: boolean;
    /**
     * true quand Discord refuse le token (scope `guilds` manquant) : recharger
     * ne sert à rien, il faut un re-consentement explicite.
     */
    needsReconnect?: boolean;
}

const RELOAD_KEY = "sigilos-portal-reloads";

function readReloadAttempts(): number {
    try {
        const raw = sessionStorage.getItem(RELOAD_KEY);
        if (!raw) return 0;
        const parsed = JSON.parse(raw) as { count: number; ts: number };
        // Fenêtre de 5 min : au-delà, on repart de zéro (nouvelle visite).
        if (Date.now() - parsed.ts > 5 * 60 * 1000) return 0;
        return parsed.count || 0;
    } catch {
        return 0;
    }
}

export function NoGuildMessage({ rateLimited, needsReconnect }: NoGuildMessageProps) {
    const [showModal, setShowModal] = useState(false);
    const [attempts, setAttempts] = useState(0);

    useEffect(() => {
        setAttempts(readReloadAttempts());
    }, []);

    // Re-vérification auto PLAFONNÉE quand Discord est en rate-limit.
    // Sans plafond, un échec permanent + reload/10 s = tempête de 429 en boucle.
    const autoReload = shouldAutoReloadPortal({
        rateLimited: !!rateLimited,
        needsReconnect: !!needsReconnect,
        attempts,
    });

    useEffect(() => {
        if (!autoReload || showModal) return;
        const timer = setTimeout(() => {
            try {
                sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ count: attempts + 1, ts: Date.now() }));
            } catch { /* stockage indisponible — on recharge quand même une fois */ }
            window.location.reload();
        }, 10000);
        return () => clearTimeout(timer);
    }, [autoReload, showModal, attempts]);

    const reconnectWithGuildsScope = () => {
        // Re-consentement explicite : Discord réaffiche l'écran d'autorisation
        // (avec la liste des serveurs) au lieu de réutiliser l'ancienne
        // autorisation sans scope `guilds`.
        void signIn("discord", { callbackUrl: "/dashboard" }, { prompt: "consent" });
    };

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
                                Votre compte Discord n&apos;est associé à aucune guilde active sur SigilOS et vous n&apos;administrez aucun serveur éligible.
                            </p>
                        </div>

                        {/* Scope manquant : recharger ne sert à rien, il faut ré-autoriser */}
                        {needsReconnect ? (
                            <div className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-3 text-left">
                                <ShieldAlert className="h-4 w-4 text-danger shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-caption text-danger/90 font-semibold leading-relaxed">
                                        Discord n&apos;a pas partagé ta liste de serveurs (autorisation incomplète). Inutile de recharger : reconnecte-toi en cochant l&apos;accès aux serveurs.
                                    </p>
                                    <button
                                        onClick={reconnectWithGuildsScope}
                                        className="text-caption font-bold text-danger underline underline-offset-2 hover:text-foreground transition-colors mt-1"
                                    >
                                        Reconnecter avec l&apos;accès serveurs
                                    </button>
                                </div>
                            </div>
                        ) : (
                        <>
                        {/* Rate-limit notice — non bloquant, le CTA d'inscription reste l'essentiel */}
                        {rateLimited && (
                            <div className="flex items-start gap-2.5 rounded-xl border border-warning/20 bg-warning/5 px-3.5 py-3 text-left">
                                <RefreshCw className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-caption text-warning/90 font-semibold leading-relaxed">
                                        {autoReload
                                            ? "Vérification des accès en cours — Discord met quelques secondes à confirmer vos droits admin. Pas besoin de cliquer : la page re-vérifie automatiquement."
                                            : "Discord met du temps à répondre. La re-vérification automatique est en pause : relancez-la manuellement."}
                                    </p>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="text-caption font-bold text-warning underline underline-offset-2 hover:text-foreground transition-colors mt-1"
                                    >
                                        Relancer la vérification maintenant
                                    </button>
                                </div>
                            </div>
                        )}
                        </>
                        )}

                        {/* CTAs */}
                        <div className="flex flex-col gap-3 pt-2">
                            {/* PRIMARY — Demander l'accès ou Déployer */}
                            <button
                                onClick={() => setShowModal(true)}
                                className="group relative w-full h-14 rounded-xl bg-success hover:bg-success text-success-foreground font-bold text-sm transition-colors active:scale-[0.99] overflow-hidden flex flex-col items-center justify-center"
                            >
                                <span className="text-caption opacity-80 mb-0.5">Chef ou Admin de Guilde ?</span>
                                <div className="flex items-center gap-2">
                                    <Crown className="w-4 h-4" />
                                    <span>Installer ou Inscrire ma Guilde</span>
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
