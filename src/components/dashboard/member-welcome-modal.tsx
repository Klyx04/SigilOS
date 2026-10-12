"use client";

import { useState, useEffect } from "react";
import { X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markWelcomeAsSeen } from "@/server/actions/onboarding-actions";
import Link from "next/link";

const FEATURES = [
    {
        icon: "/assets/dofus/modules/character.png",
        label: "Ton Profil",
        description: "Renseigne ton pseudo Dofus et ta classe pour être identifié dans la guilde.",
    },
    {
        icon: "/assets/dofus/modules/quest.png",
        label: "Missions",
        description: "Participe aux défis hebdomadaires pour gagner de l'XP et faire grimper la guilde.",
    },
    {
        icon: "/assets/dofus/modules/breach.png",
        label: "Songes Infinis",
        description: "Forme des équipes et progresse ensemble dans les Songes Infinis.",
    },
    {
        icon: "/assets/dofus/modules/ladder.png",
        label: "Ladder XP",
        description: "Chaque action rapporte de l'XP. Grimpe le classement et montre ta contribution !",
    },
];

interface MemberWelcomeModalProps {
    guildId: string;
    guildName: string;
    userName: string;
    show: boolean;
}

export function MemberWelcomeModal({ guildId, guildName, userName, show }: MemberWelcomeModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (show) {
            const timer = setTimeout(() => setIsOpen(true), 600);
            return () => clearTimeout(timer);
        }
    }, [show]);

    const handleClose = async () => {
        setIsOpen(false);
        await markWelcomeAsSeen(guildId);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6">
            {/* Backdrop — cliquable pour passer */}
            <div className="absolute inset-0 bg-black/80" aria-hidden="true" onClick={handleClose} />

            <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-surface rounded-xl border border-border animate-in fade-in zoom-in-95 duration-200">
                <div className="relative p-6 sm:p-10 space-y-6">
                    <button
                        onClick={handleClose}
                        aria-label="Fermer"
                        className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-elevated transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-start gap-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/assets/dofus/modules/character.png"
                            alt=""
                            width={64}
                            height={64}
                            draggable={false}
                            className="w-16 h-16 shrink-0 object-contain"
                        />
                        <div className="space-y-1.5 pt-1">
                            <p className="text-xs font-medium text-muted-foreground">Tu viens de rejoindre {guildName}</p>
                            <h2 className="text-2xl font-bold text-foreground tracking-tight">
                                Bienvenue, {userName} !
                            </h2>
                            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                                Voici les outils à ta disposition sur SigilOS.
                            </p>
                        </div>
                    </div>

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

                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Commence par renseigner ton <span className="text-foreground font-medium">pseudo Dofus</span> et ta{" "}
                        <span className="text-foreground font-medium">classe</span> pour que tes coéquipiers te reconnaissent.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button asChild className="flex-1 h-12 text-sm font-semibold rounded-lg">
                            <Link href={`/dashboard/${guildId}/profile?edit=identity`} onClick={handleClose}>
                                Compléter mon profil
                                <ArrowRight className="ml-2 w-4 h-4" />
                            </Link>
                        </Button>
                        <Button variant="ghost" onClick={handleClose} className="flex-1 h-12 text-sm rounded-lg">
                            Explorer le dashboard
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
