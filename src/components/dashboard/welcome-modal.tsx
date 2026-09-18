"use client";

import { useState, useEffect } from "react";
import { X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markWelcomeAsSeen } from "@/server/actions/onboarding-actions";
import Link from "next/link";

// Icônes officielles du jeu (assets curés, servis nus — jamais de tuile teintée).
const FEATURES = [
    {
        icon: "/assets/dofus/icons/chat.png",
        label: "Bot Discord",
        description: "Annonces, validations et rappels directement sur ton serveur.",
    },
    {
        icon: "/assets/dofus/modules/social.png",
        label: "Modules",
        description: "Missions, Songes, Ocre, marché… active ce dont ta guilde a besoin.",
    },
    {
        icon: "/assets/dofus/modules/quest.png",
        label: "Missions",
        description: "Défis hebdomadaires avec preuves et validation par le staff.",
    },
    {
        icon: "/assets/dofus/modules/guide.png",
        label: "Wiki",
        description: "Documentation interne de la guilde, accès par rôle Discord.",
    },
];

interface WelcomeModalProps {
    guildId: string;
    show: boolean;
}

export function WelcomeModal({ guildId, show }: WelcomeModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (show) {
            setIsOpen(true);
        }
    }, [show]);

    const handleClose = async () => {
        setIsOpen(false);
        await markWelcomeAsSeen(guildId);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
            {/* Backdrop — non-cliquable pour forcer l'action */}
            <div className="absolute inset-0 bg-black/80" aria-hidden="true" />

            {/* Panneau plat : asset nu, pas d'ombre portée, pas de verre dépoli */}
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface rounded-xl border border-border animate-in fade-in zoom-in-95 duration-200">
                <div className="relative p-6 sm:p-10 space-y-6">
                    <button
                        onClick={handleClose}
                        aria-label="Fermer"
                        className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* En-tête : blason du jeu nu + eyebrow muet, aligné à gauche */}
                    <div className="flex items-start gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/dofus/modules/guild.png"
                            alt=""
                            width={64}
                            height={64}
                            draggable={false}
                            className="w-16 h-16 shrink-0 object-contain"
                        />
                        <div className="space-y-1.5 pt-1">
                            <p className="text-xs font-medium text-muted-foreground">Ta guilde a son QG</p>
                            <h2 className="text-2xl font-bold text-foreground tracking-tight">
                                Bienvenue sur SigilOS
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                                Configure tes modules, invite tes membres et lance tes premières sorties.
                            </p>
                        </div>
                    </div>

                    {/* Contenu : liste asset + texte, pas de tuiles teintées */}
                    <ul className="divide-y divide-border border-y border-border">
                        {FEATURES.map((feature) => (
                            <li key={feature.label} className="flex items-center gap-4 py-3.5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={feature.icon}
                                    alt=""
                                    width={32}
                                    height={32}
                                    loading="lazy"
                                    draggable={false}
                                    className="w-8 h-8 shrink-0 object-contain"
                                />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground">{feature.label}</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <Button asChild className="w-full h-12 text-sm font-semibold rounded-lg">
                        <Link href={`/dashboard/${guildId}/admin/getting-started`} onClick={handleClose}>
                            Lancer la configuration
                            <ArrowRight className="ml-2 w-4 h-4" />
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
