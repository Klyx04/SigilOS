"use client";

import { useEffect, useState } from "react";
import { ArrowRight, X, Sparkles } from "lucide-react";
import { MODULE_DOFUS_ASSETS } from "@/lib/module-catalog";

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
            <div className="relative w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl p-6 md:p-8 space-y-6">
                <button
                    type="button"
                    onClick={() => dismiss(true)}
                    aria-label="Fermer et ne plus proposer ces étapes"
                    className="absolute right-3 top-3 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-black/30 hover:text-foreground"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
                <div className="space-y-2 text-center">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <h2 id="onboarding-next-steps-title" className="text-2xl font-bold text-foreground tracking-tight">
                        Base activée — et maintenant ?
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Votre dashboard est débloqué. Voici les prochaines étapes recommandées
                        pour préparer l&apos;arrivée de vos membres :
                    </p>
                </div>

                <div className="grid gap-2.5">
                    {[
                        {
                            asset: MODULE_DOFUS_ASSETS.missions || "guildatons.png",
                            label: "Activer les modules",
                            desc: "Missions, Songes, Ocre, Services…",
                            href: `/dashboard/${guildId}/admin/modules`,
                        },
                        {
                            asset: MODULE_DOFUS_ASSETS.presentation || "guild.png",
                            label: "Page de présentation",
                            desc: "Personnalisez la vitrine de recrutement",
                            href: `/dashboard/${guildId}/admin/presentation`,
                        },
                        {
                            asset: MODULE_DOFUS_ASSETS.donjons || "dofus.png",
                            label: "Premières missions",
                            desc: "Lancez vos premières quêtes de guilde",
                            href: `/dashboard/${guildId}/missions/manage`,
                        },
                    ].map((item) => (
                        <a
                            key={item.href}
                            href={item.href}
                            onClick={() => dismiss(true)}
                            className="flex items-center gap-3.5 p-3.5 rounded-xl border border-border bg-black/20 text-muted-foreground hover:text-foreground hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] transition-all group"
                        >
                            <div className="w-9 h-9 rounded-lg bg-black/40 border border-white/5 flex items-center justify-center shrink-0 p-1">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={`/assets/dofus/modules/${item.asset}`}
                                    alt=""
                                    className="w-7 h-7 object-contain group-hover:scale-105 transition-transform"
                                    loading="lazy"
                                />
                            </div>
                            <span className="flex-1 min-w-0">
                                <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                                <span className="block text-xs text-muted-foreground">{item.desc}</span>
                            </span>
                            <ArrowRight className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                        </a>
                    ))}
                </div>

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
