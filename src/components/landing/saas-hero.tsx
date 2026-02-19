"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowRight, Shield, Globe, Zap, Crown, MessageSquare } from "lucide-react";
import { LandingCarousel } from "./landing-carousel";
import { DiscordIcon } from "@/components/shared/icons";

import { User } from "next-auth";
import { loginWithDiscord } from "@/server/actions/auth-actions";

export function SaasHero({ user }: { user?: User }) {
    return (
        <section className="relative overflow-hidden pt-32 pb-4 lg:pt-48 bg-background">
            {/* Ambient Noise Overlay */}
            <div className="absolute inset-0 noise-overlay opacity-[0.05] pointer-events-none" />

            <div className="container relative z-10 px-6 mx-auto">
                <div className="max-w-4xl mx-auto text-center mb-20 fade-in-up">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-gold/10 border border-accent-gold/20 mb-8">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-gold">Beta Privée Ouverte</span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-5xl md:text-7xl font-heading text-white mb-8 leading-[1.1] tracking-tight">
                        <span className="text-accent-gold italic">Votre Guilde mérite mieux qu'un tableur excel.</span>
                    </h1>

                    {/* Subheadline */}
                    <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
                        SigilOS centralise vos missions, vos membres et vos données Ocre dans une interface premium. Automatisez la gestion, vivez l'aventure.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        {user ? (
                            <Button size="lg" className="h-14 px-10 rounded-full bg-accent-teal text-bg-primary hover:bg-accent-teal/90 font-bold uppercase tracking-wider teal-glow group" asChild>
                                <Link href="/dashboard">
                                    Accéder au Dashboard
                                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </Button>
                        ) : (
                            <Button size="lg" className="h-14 px-10 rounded-full bg-accent-teal text-bg-primary hover:bg-accent-teal/90 font-bold uppercase tracking-wider teal-glow group flex items-center gap-3" onClick={() => loginWithDiscord()}>
                                <DiscordIcon className="w-5 h-5 group-hover:rotate-12 transition-transform duration-500" />
                                Connexion Discord
                                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        )}
                        <Button size="lg" variant="outline" className="h-14 px-10 rounded-full border-white/10 hover:border-white/20 hover:bg-white/5 text-zinc-300 hover:text-white transition-all font-bold uppercase tracking-wider backdrop-blur-sm" asChild>
                            <Link href="/guilds">
                                Voir l'Annuaire
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
}

// FeatureItem and other helpers stay at bottom if they are still needed elsewhere, but SaasHero is cleaned up.

function FeatureItem({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
    return (
        <div className="flex flex-col items-center text-center p-4">
            <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-white/10">
                <Icon className="w-6 h-6 text-zinc-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
            <p className="text-sm text-zinc-500 leading-relaxed">{description}</p>
        </div>
    );
}
