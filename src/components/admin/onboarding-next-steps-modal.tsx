"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Puzzle, Rocket, Swords, X } from "lucide-react";

/**
 * 2e modale (optionnel) : s'affiche UNE fois par navigateur quand l'onboarding
 * obligatoire vient d'être complété mais que les modules ne sont pas configurés.
 * Persistée en localStorage (pas de colonne BDD pour ça) : "Plus tard" ne
 * re-prompt plus, la mise en route reste accessible via la Console.
 */
export function OnboardingNextStepsModal({ guildId }: { guildId: string }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        try {
            if (!window.localStorage.getItem(`sigilos-optional-seen-${guildId}`)) {
                setOpen(true);
            }
        } catch {
            setOpen(true);
        }
    }, [guildId]);

    if (!open) return null;

    const dismiss = (remember: boolean) => {
        if (remember) {
            try {
                window.localStorage.setItem(`sigilos-optional-seen-${guildId}`, "1");
            } catch { /* stockage indisponible — on ferme quand même */ }
        }
        setOpen(false);
    };

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-next-steps-title"
        >
            <div className="relative w-full max-w-lg rounded-3xl border border-border bg-surface shadow-2xl p-6 md:p-8 space-y-6">
                {/* Fermeture explicite : même effet que « Plus tard » (la modale ne revient
                    plus pour ce navigateur). */}
                <button
                    type="button"
                    onClick={() => dismiss(true)}
                    aria-label="Fermer et ne plus proposer ces étapes"
                    className="absolute right-3 top-3 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
                <div className="space-y-2 text-center">
                    <Rocket className="w-10 h-10 text-success mx-auto" />
                    <h2 id="onboarding-next-steps-title" className="text-2xl font-black text-foreground tracking-tight">
                        Base activée — et maintenant ?
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Votre dashboard est débloqué. Ces étapes recommandées
                        restent disponibles à tout moment dans la Console.
                    </p>
                </div>

                <div className="grid gap-2">
                    {[
                        { icon: Puzzle, label: "Activer des modules", desc: "Missions, Songes, Ocre…", href: `/dashboard/${guildId}/admin/modules` },
                        { icon: BookOpen, label: "Page de présentation", desc: "Recrutement public", href: `/dashboard/${guildId}/admin/presentation` },
                        { icon: Swords, label: "Premières missions", desc: "Lancer l'activité", href: `/dashboard/${guildId}/missions/manage` },
                    ].map((item) => (
                        <a
                            key={item.href}
                            href={item.href}
                            onClick={() => dismiss(true)}
                            className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-black/20 text-muted-foreground hover:text-foreground hover:border-border-strong transition-all"
                        >
                            <item.icon className="w-4 h-4 shrink-0 text-success" />
                            <span className="flex-1 min-w-0">
                                <span className="block text-sm font-bold">{item.label}</span>
                                <span className="block text-caption text-muted-foreground">{item.desc}</span>
                            </span>
                            <ArrowRight className="w-4 h-4 shrink-0" />
                        </a>
                    ))}
                </div>

                {/* « Plus tard » est un REFUS, pas une réussite : bouton discret (le vert
                    primaire est réservé aux 3 vraies portes d'entrée ci-dessus) et sans
                    croix — la croix est une fermeture, elle vit en haut à droite. */}
                <div className="flex items-center justify-center pt-1">
                    <button
                        type="button"
                        onClick={() => dismiss(true)}
                        className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground py-1"
                    >
                        Plus tard — ne plus afficher
                    </button>
                </div>
            </div>
        </div>
    );
}
