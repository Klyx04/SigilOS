"use client";

/**
 * Landing — mise en route et questions utiles.
 *
 * Remplace la séquence de trois grandes cartes 01/02/03 (même silhouette que
 * les « trois piliers ») par trois lignes de texte, et la FAQ bordée d'un
 * cadre par une colonne compacte : quatre questions, puis l'aide complète.
 */

import { useState } from "react";
import Link from "next/link";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import { LANDING_FAQ } from "@/lib/landing-faq";
import { AccessRequestModal } from "../AccessRequestModal";

const STEPS = [
    { title: "Connexion Discord", detail: "Identification OAuth2 : aucun mot de passe transmis à SigilOS." },
    { title: "Choix du serveur", detail: "Le Discord de la guilde et les salons utilisés pour les annonces." },
    { title: "Invitation des membres", detail: "Les accès suivent les rôles Discord déjà en place." },
];

interface LandingSetupProps {
    clientId?: string;
    autoOnboardingOn?: boolean;
}

export function LandingSetup({ clientId = "", autoOnboardingOn = true }: LandingSetupProps) {
    const [showAccessModal, setShowAccessModal] = useState(false);

    return (
        <section aria-labelledby="mise-en-route-titre" className="reg-section">
            <div className="reg-shell grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
                {/* Mise en route */}
                <div>
                    <p className="reg-eyebrow">Mise en route</p>
                    <h2
                        id="mise-en-route-titre"
                        className="mt-3 text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                    >
                        Discord suffit pour commencer.
                    </h2>
                    <p className="mt-3 text-base text-muted-foreground leading-relaxed">
                        Un administrateur choisit son serveur, active les modules utiles, puis invite la guilde.
                        En autonomie, ou accompagné si tu préfères être guidé.
                    </p>

                    <div className="mt-6 border-t border-border-strong">
                        {STEPS.map((step, index) => (
                            <div key={step.title} className="reg-step">
                                <span className="reg-mono text-xs text-accent pt-0.5">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                        <form action={loginWithDiscord}>
                            <button type="submit" className="reg-btn reg-btn-primary">
                                Configurer ma guilde
                            </button>
                        </form>
                        <button
                            type="button"
                            onClick={() => setShowAccessModal(true)}
                            className="reg-link-quiet text-sm"
                        >
                            Être accompagné
                        </button>
                    </div>
                </div>

                {/* Questions utiles */}
                <div>
                    <p className="reg-eyebrow">Questions utiles</p>
                    <div className="reg-faq mt-4">
                        {LANDING_FAQ.map((item) => (
                            <details key={item.q}>
                                <summary>{item.q}</summary>
                                <p>{item.a}</p>
                            </details>
                        ))}
                    </div>
                    <p className="mt-4 text-sm">
                        <Link href="/legal/faq" className="reg-link">
                            Consulter l&apos;aide complète
                        </Link>
                    </p>
                </div>
            </div>

            <AccessRequestModal
                open={showAccessModal}
                onClose={() => setShowAccessModal(false)}
                autoOnboardingOn={autoOnboardingOn}
                clientId={clientId}
            />
        </section>
    );
}
