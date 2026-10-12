"use client";

/**
 * Landing — premier écran (composition 5/7 alignée à gauche).
 *
 * Ce qui a été retiré volontairement : badge en pilule, très grand titre centré
 * avec un mot coloré, double CTA violet + vert de poids équivalent, rangée de
 * chips, image d'ambiance assombrie occupant tout l'écran.
 *
 * Ce qui le remplace : une phrase, une action principale, un lien secondaire,
 * et à droite une **reproduction vectorielle du produit** (`./dashboard-mockup`).
 * Aucun upload en base, aucune capture d'écran à maintenir : les PNG légendés,
 * `src/lib/landing-figures.ts` et les outils de capture de figures ont été
 * retirés le 20/09/2026.
 */

import { useState } from "react";
import Link from "next/link";
import { DashboardMockup } from "./dashboard-mockup";
import type { PublicGuildShowcase } from "@/server/actions/presentation-actions";
import { getGuildSlug } from "@/lib/presentation-constants";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import { DiscordIcon } from "@/components/shared/icons";
import { AccessRequestModal } from "../AccessRequestModal";
import { useI18n } from "@/lib/i18n/client";

interface LandingHeroProps {
    /** Guilde publique mise en avant pour le lien secondaire. */
    guild?: PublicGuildShowcase | null;
    clientId?: string;
    /** Kill-switch God : OFF = pas de promesse d'autonomie dans la modale. */
    autoOnboardingOn?: boolean;
}

export function LandingHero({ guild, clientId = "", autoOnboardingOn = true }: LandingHeroProps) {
    const { t } = useI18n();
    const [showAccessModal, setShowAccessModal] = useState(false);
    const guildHref = guild ? `/guilds/${getGuildSlug(guild)}` : "/guilds";

    return (
        <section id="haut" className="border-b border-border">
            <div className="reg-shell grid gap-10 pt-12 pb-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 lg:pt-16 lg:pb-20 lg:items-start">
                <div>
                    <p className="reg-mono flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true" />
                        {t.landing.badge}
                    </p>

                    <h1 className="mt-5 max-w-[13ch] text-[clamp(2rem,4.2vw,3.1rem)] font-bold leading-[1.06] tracking-tight text-foreground">
                        {t.landing.heroTitle}
                    </h1>

                    <p className="mt-5 max-w-[34rem] text-base text-muted-foreground leading-relaxed">
                        {t.landing.heroDesc}
                    </p>

                    <div className="mt-8 flex flex-wrap items-center gap-4">
                        <form action={loginWithDiscord}>
                            <button type="submit" className="reg-btn reg-btn-primary cursor-pointer">
                                <DiscordIcon className="w-4 h-4" aria-hidden="true" />
                                {t.landing.ctaConfigure}
                            </button>
                        </form>
                        <Link
                            href="/modules"
                            className="px-4 py-2 text-sm font-semibold text-foreground hover:text-accent border border-border hover:border-border-strong rounded-lg bg-surface/40 transition-colors"
                        >
                            {t.landing.ctaModules}
                        </Link>
                    </div>

                    {/* Étapes réelles et factuelles de mise en route */}
                    <div className="mt-6 pt-5 border-t border-border/60 space-y-2 text-xs text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px]">
                            <span className="text-foreground font-semibold">{t.landing.setupStepsTitle}</span>
                            <span>{t.landing.setupStep1}</span>
                            <span>&bull;</span>
                            <span>{t.landing.setupStep2}</span>
                            <span>&bull;</span>
                            <span>{t.landing.setupStep3}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400">
                            {t.landing.setupEstimate}
                        </p>
                    </div>
                </div>

                {/* Écran réel, affiché à une taille lisible, jamais assombri. */}
                <figure className="reg-screen">
                    <DashboardMockup />
                </figure>
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
