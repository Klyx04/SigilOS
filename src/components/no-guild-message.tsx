"use client";

/**
 * Écran « aucune guilde » du portail (utilisé seulement par `/dashboard`).
 *
 * La logique est inchangée : re-vérification automatique plafonnée en cas de
 * rate-limit Discord, re-consentement explicite quand le scope `guilds` manque,
 * modale d'installation/accompagnement, changement de compte.
 *
 * Seule la présentation change : plus de carte `rounded-3xl backdrop-blur-xl
 * shadow-2xl`, plus de logo centré, plus de ligne d'accent en dégradé ni de
 * mention « Réseau Sécurisé », plus d'animation d'entrée. À la place, un
 * en-tête gauche-aligné et des encadrés `.reg-callout` qui portent l'état.
 */

import { signOut, signIn } from "next-auth/react";
import { RefreshCw, Crown, ShieldAlert } from "lucide-react";
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
    /** Kill-switch God : OFF = pas de promesse d'autonomie. Défaut true. */
    autoOnboardingOn?: boolean;
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

export function NoGuildMessage({ rateLimited, needsReconnect, autoOnboardingOn = true }: NoGuildMessageProps) {
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
        <>
            <div className="max-w-[56rem]">
                <p className="reg-eyebrow">Accès restreint</p>
                <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                    Aucune guilde rattachée à ce compte.
                </h1>
                <p className="mt-3 max-w-[62ch] text-sm text-muted-foreground leading-relaxed">
                    Ton compte Discord n&apos;est associé à aucune guilde active sur SigilOS et tu n&apos;administres
                    aucun serveur éligible.
                </p>

                {/* Scope `guilds` manquant : recharger ne sert à rien, il faut ré-autoriser. */}
                {needsReconnect ? (
                    <div className="reg-callout mt-6 border-danger/40">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                        <div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Discord n&apos;a pas partagé ta liste de serveurs (autorisation incomplète). Inutile de
                                recharger : reconnecte-toi en cochant l&apos;accès aux serveurs.
                            </p>
                            <button type="button" onClick={reconnectWithGuildsScope} className="reg-link mt-2 text-sm">
                                Reconnecter avec l&apos;accès serveurs
                            </button>
                        </div>
                    </div>
                ) : (
                    rateLimited && (
                        <div className="reg-callout mt-6 border-warning/40">
                            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                            <div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {autoReload
                                        ? "Vérification des accès en cours — Discord met quelques secondes à confirmer tes droits admin. Pas besoin de cliquer : la page re-vérifie automatiquement."
                                        : "Discord met du temps à répondre. La re-vérification automatique est en pause : relance-la manuellement."}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => window.location.reload()}
                                    className="reg-link mt-2 text-sm"
                                >
                                    Relancer la vérification maintenant
                                </button>
                            </div>
                        </div>
                    )
                )}

                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                    <button
                        type="button"
                        onClick={() => setShowModal(true)}
                        className="reg-btn reg-btn-primary"
                    >
                        <Crown className="h-4 w-4" aria-hidden="true" />
                        Installer ou inscrire ma guilde
                    </button>
                    <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="reg-link-quiet text-sm"
                    >
                        Changer de compte
                    </button>
                </div>

                <p className="mt-4 max-w-[62ch] text-xs text-muted-foreground leading-relaxed">
                    Chef de guilde ou administrateur de ton serveur Discord ? L&apos;installation se fait en autonomie,
                    ou accompagnée via un ticket.
                </p>
            </div>

            <AccessRequestModal open={showModal} onClose={() => setShowModal(false)} autoOnboardingOn={autoOnboardingOn} />
        </>
    );
}
