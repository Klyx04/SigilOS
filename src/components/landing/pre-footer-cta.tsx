"use client";

import { Button } from "@/components/ui/button";
import { loginWithDiscord } from "@/server/actions/auth-actions";

export function PreFooterCta() {
    return (
        <section className="py-32 bg-background relative overflow-hidden">
            <div className="container px-6 mx-auto">
                <div className="relative group p-12 md:p-20 rounded-[3rem] bg-gradient-to-br from-bg-secondary to-bg-primary border border-white/10 overflow-hidden text-center ">
                    {/* Decorative Teal Beam */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-teal/50 to-transparent" />

                    <div className="relative z-10 max-w-2xl mx-auto">
                        <h2 className="text-4xl md:text-6xl font-heading text-white mb-8 leading-tight">
                            Prêt à passer à <br />
                            <span className="text-accent-teal italic text-5xl md:text-7xl">la version supérieure ?</span>
                        </h2>
                        <p className="text-zinc-400 text-lg mb-12 font-medium font-sans">
                            Gagnez des dizaines d'heures de gestion chaque mois. Centralisez, automatisez, gagnez.
                        </p>
                        <Button
                            size="lg"
                            className="h-16 px-12 rounded-2xl bg-white text-black hover:scale-105 active:scale-95 font-semibold uppercase tracking-wider transition-all  shadow-white/10 text-[11px]"
                            onClick={() => loginWithDiscord()}
                        >
                            Démarrer l&apos;Aventure SigilOS
                        </Button>
                        <p className="mt-8 text-zinc-600 text-[11px] font-bold uppercase tracking-wider">
                            Intégration Discord instantanée
                        </p>
                    </div>

                    {/* Background Texture */}
                    <div className="absolute inset-0 noise-overlay opacity-[0.05] pointer-events-none" />
                </div>
            </div>
        </section>
    );
}
