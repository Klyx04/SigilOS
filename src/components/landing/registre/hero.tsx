"use client";

/**
 * Landing — premier écran (composition 5/7 alignée à gauche).
 *
 * Ce qui a été retiré volontairement : badge en pilule, très grand titre centré
 * avec un mot coloré, double CTA violet + vert de poids équivalent, rangée de
 * chips, image d'ambiance assombrie occupant tout l'écran.
 *
 * Ce qui le remplace : une phrase, une action principale, un lien secondaire,
 * et à droite un **écran réel du produit** légendé (pas une illustration).
 */

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { PublicLandingScreen } from "@/server/actions/landing-screen-actions";
import type { PublicGuildShowcase } from "@/server/actions/presentation-actions";
import { getGuildSlug } from "@/lib/presentation-constants";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import { DiscordIcon } from "@/components/shared/icons";
import { AccessRequestModal } from "../AccessRequestModal";

interface LandingHeroProps {
    /** Capture God de la section « hero » ; repli sur la capture par défaut. */
    screen?: PublicLandingScreen | null;
    /** Guilde publique mise en avant pour le lien secondaire. */
    guild?: PublicGuildShowcase | null;
    clientId?: string;
    /** Kill-switch God : OFF = pas de promesse d'autonomie dans la modale. */
    autoOnboardingOn?: boolean;
}

const FALLBACK_SCREEN: PublicLandingScreen = {
    id: "hero-default",
    label: "SigilOS",
    title: "Tableau de bord de guilde",
    description: null,
    imageUrl: "/assets/screenshots/screenshot1.png",
    alt: "Tableau de bord SigilOS : sorties, progression et membres d'une guilde Dofus",
    sortOrder: 0,
};

export function LandingHero({ screen, guild, clientId = "", autoOnboardingOn = true }: LandingHeroProps) {
    const [showAccessModal, setShowAccessModal] = useState(false);
    const figure = screen?.imageUrl ? screen : FALLBACK_SCREEN;
    const guildHref = guild ? `/guilds/${getGuildSlug(guild)}` : "/guilds";

    return (
        <section id="haut" className="border-b border-border">
            <div className="reg-shell grid gap-10 pt-12 pb-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 lg:pt-16 lg:pb-20 lg:items-start">
                <div>
                    <p className="reg-mono flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" aria-hidden="true" />
                        BÊTA OUVERTE · v2.2
                    </p>

                    <h1 className="mt-5 max-w-[13ch] text-[clamp(2rem,4.2vw,3.1rem)] font-bold leading-[1.06] tracking-tight text-foreground">
                        Le tableau de bord de ta guilde Dofus.
                    </h1>

                    <p className="mt-5 max-w-[34rem] text-base text-muted-foreground leading-relaxed">
                        Sorties, quêtes et progression au même endroit. Les membres passent par Discord&nbsp;; SigilOS ne
                        demande aucun accès au compte Ankama.
                    </p>

                    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                        <form action={loginWithDiscord}>
                            <button type="submit" className="reg-btn reg-btn-primary">
                                <DiscordIcon className="w-4 h-4" aria-hidden="true" />
                                Se connecter avec Discord
                            </button>
                        </form>
                        <Link href={guildHref} className="reg-link">
                            Voir {guild?.name ?? "l'annuaire des guildes"}
                        </Link>
                    </div>

                    <p className="mt-5 text-xs text-muted-foreground">
                        Gratuit · sans publicité · outils ouverts accessibles sans compte
                    </p>

                    <p className="mt-2 text-xs text-muted-foreground">
                        Besoin d&apos;aide pour installer ?{" "}
                        <button
                            type="button"
                            onClick={() => setShowAccessModal(true)}
                            className="reg-link-quiet text-xs"
                        >
                            Ouvrir un ticket Discord
                        </button>
                    </p>
                </div>

                {/* Écran réel, affiché à une taille lisible, jamais assombri. */}
                <figure className="reg-screen">
                    <figcaption className="reg-mono flex items-center justify-between gap-4 border-b border-border bg-muted px-3 py-2 text-xs">
                        <span className="text-foreground">{figure.label || "SigilOS"}</span>
                        <span className="text-muted-foreground">Capture de l&apos;interface</span>
                    </figcaption>
                    <Image
                        src={figure.imageUrl}
                        alt={figure.alt || figure.title || "Interface SigilOS"}
                        width={1440}
                        height={900}
                        priority
                        sizes="(max-width: 1024px) 100vw, 640px"
                        className="w-full h-auto"
                    />
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
