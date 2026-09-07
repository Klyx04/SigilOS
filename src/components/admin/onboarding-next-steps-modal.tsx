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
            aria-label="Prochaines étapes recommandées"
        >
            <div className="w-full max-w-lg rounded-3xl border border-border bg-surface shadow-2xl p-6 md:p-8 space-y-6">
                <div className="space-y-2 text-center">
                    <Rocket className="w-10 h-10 text-success mx-auto" />
                    <h2 className="text-2xl font-black text-foreground tracking-tight">
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

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => dismiss(true)}
                        className="flex-1 h-12 rounded-xl bg-success hover:bg-success text-success-foreground font-black text-sm uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-2"
                    >
                        <X className="w-4 h-4" />
                        Plus tard
                    </button>
                </div>
            </div>
        </div>
    );
}
