"use client";

/**
 * Écran **de verdict** du portail (`/dashboard`).
 *
 * Il ne s'affiche que lorsque Discord a **répondu** et que le compte n'a aucune
 * guilde (active, en attente ou à déployer) alors que la porte visiteur est
 * fermée. L'attente de vérification vit dans `guild-check-pending.tsx` : cet
 * écran ne prétend donc jamais savoir ce qu'il ne sait pas.
 *
 * Présentation : en-tête gauche-aligné, encadrés `.reg-*`, tokens uniquement
 * (DA de la landing) — aucun dégradé, aucune carte floutée.
 */

import { signOut } from "next-auth/react";
import { Crown } from "lucide-react";
import { useState } from "react";
import { AccessRequestModal } from "@/components/landing/AccessRequestModal";

interface NoGuildMessageProps {
    /** Kill-switch God : OFF = pas de promesse d'autonomie. Défaut true. */
    autoOnboardingOn?: boolean;
}

export function NoGuildMessage({ autoOnboardingOn = true }: NoGuildMessageProps) {
    const [showModal, setShowModal] = useState(false);

    return (
        <>
            <div className="max-w-[56rem]">
                <p className="reg-eyebrow">Portail de guilde</p>
                <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                    Aucune guilde rattachée à ce compte.
                </h1>
                <p className="mt-3 max-w-[62ch] text-sm text-muted-foreground leading-relaxed">
                    Ton compte Discord n&apos;est associé à aucune guilde active sur SigilOS et tu n&apos;administres
                    aucun serveur éligible.
                </p>

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
