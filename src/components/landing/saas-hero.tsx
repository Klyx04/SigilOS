"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowRight, Shield, Globe, Zap, Crown, MessageSquare } from "lucide-react";
import { LandingCarousel } from "./landing-carousel";

import { User } from "next-auth";
import { loginWithDiscord } from "@/server/actions/auth-actions";

export function SaasHero({ user }: { user?: User }) {
    return (
        <section className="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent">
            {/* Ambient Noise Overlay */}
            <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none" />

            {/* Background Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-screen-2xl z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[1000px] h-[1000px] bg-primary/20 rounded-full blur-[160px] mix-blend-screen animate-pulse-slow active:scale-110 transition-transform duration-[10s]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-[140px] mix-blend-screen animate-pulse-slow delay-1000" />
            </div>

            <div className="container relative z-10 px-4 mx-auto text-center">
                <div className="relative w-64 h-64 md:w-96 md:h-96 mx-auto mb-20 animate-in fade-in zoom-in duration-1000 animate-float">
                    {/* Backlight Glow moved outside to not be affected by float if needed, but keeping it inside is cleaner for the group */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 md:w-80 md:h-80 bg-purple-500/30 rounded-full blur-[80px] animate-pulse shadow-[0_0_120px_rgba(168,85,247,0.4)]"></div>

                    <Image
                        src="/assets/ui/logo-v2.png"
                        alt="SigilOS Hero Logo"
                        fill
                        className="object-contain drop-shadow-[0_0_60px_rgba(168,85,247,0.6)] brightness-125 cursor-pointer relative z-10 hover:scale-110 transition-transform duration-700"
                        priority
                    />
                </div>

                {/* Heading */}
                <h1 className="text-5xl md:text-7xl lg:text-[8rem] font-black tracking-tighter text-white mb-10 animate-in fade-in slide-in-from-bottom-5 duration-1000 leading-[0.85]">
                    Gérez votre Guilde <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)]">
                        Comme un Pro
                    </span>
                </h1>

                {/* Subheading */}
                <p className="text-xl md:text-2xl text-zinc-400 max-w-4xl mx-auto mb-14 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100 font-medium">
                    Déchargez-vous de la gestion qui vous prend plusieurs heures chaque semaine.<br />
                    <span className="text-zinc-200">Missions IA, quêtes Ocre, Calendrier et bien d'autres</span> : SigilOS s&apos;occupe de la logistique, vous vous concentrez sur Dofus.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col items-center gap-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                    <div className="flex flex-wrap items-center justify-center gap-8">
                        {user ? (
                            <Button size="lg" className="h-16 px-12 text-xl rounded-full bg-purple-600 text-white hover:bg-purple-500 hover:scale-105 transition-all font-black uppercase tracking-widest shadow-2xl shadow-purple-500/40 group active:scale-95" asChild>
                                <Link href="/dashboard">
                                    Accéder au Dashboard
                                    <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1.5 transition-transform" />
                                </Link>
                            </Button>
                        ) : (
                            <Button size="lg" className="h-16 px-12 text-xl rounded-full bg-white text-black hover:bg-zinc-100 hover:scale-105 transition-all font-black uppercase tracking-widest shadow-2xl shadow-white/10 group active:scale-95" onClick={() => loginWithDiscord()}>
                                Connexion Discord
                                <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1.5 transition-transform" />
                            </Button>
                        )}
                        <Button size="lg" variant="outline" className="h-16 px-12 text-xl rounded-full border-white/10 hover:border-white/20 hover:bg-white/5 text-zinc-300 hover:text-white transition-all uppercase font-bold tracking-widest backdrop-blur-sm active:scale-95" asChild>
                            <Link href="/guilds">
                                Voir l'Annuaire
                            </Link>
                        </Button>
                    </div>

                    {/* Guild Leader Conversion Callout */}
                    <div className="flex flex-col items-center gap-6 bg-white/[0.02] border border-white/10 p-10 rounded-[3rem] max-w-2xl w-full backdrop-blur-3xl relative overflow-hidden group hover:border-amber-500/40 transition-all duration-700 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
                        {/* Animated Border Beam (Simulated) */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 blur-[80px] -z-10 group-hover:bg-amber-500/20 transition-colors duration-1000" />

                        <div className="flex flex-col items-center gap-2 relative z-10">
                            <div className="p-4 rounded-[1.5rem] bg-amber-500/10 border border-amber-500/20 group-hover:rotate-12 group-hover:scale-110 transition-all duration-500 shadow-xl shadow-amber-900/20">
                                <Crown className="w-8 h-8 text-amber-400" />
                            </div>
                            <h3 className="text-white font-black uppercase tracking-[0.2em] text-2xl mt-4">Chef de Guilde ?</h3>
                        </div>

                        <p className="text-zinc-400 text-lg leading-relaxed max-w-md relative z-10 font-medium">
                            Gagnez un temps précieux. Automatisez vos validations de missions, synchronisez vos quêtes Ocre et gérez vos membres comme jamais auparavant.
                        </p>

                        <Link
                            href="https://discord.gg/uX7G6SUDgN"
                            target="_blank"
                            className="relative z-10 px-8 py-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-[0.3em] flex items-center gap-4 hover:bg-amber-500 hover:text-black transition-all group/link mt-2 shadow-lg active:scale-95"
                        >
                            <MessageSquare className="w-5 h-5 group-hover/link:rotate-12 transition-transform duration-500" />
                            Demander mon accès BETA
                            <ChevronRight className="w-4 h-4 group-hover/link:translate-x-2 transition-transform" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Dashboard Preview (Screenshot) -> Carousel Upgrade */}
            <div className="mt-32 relative max-w-6xl mx-auto px-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
                <LandingCarousel />
            </div>

            {/* Features Grid (Mini) */}
            <div className="container px-4 mx-auto mt-32 border-t border-white/5 pt-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    <FeatureItem
                        icon={Globe}
                        title="Réseau Global"
                        description="Gérez plusieurs guildes depuis un seul compte avec une navigation fluide."
                    />
                    <FeatureItem
                        icon={Shield}
                        title="Audit & Sécurité"
                        description="Système de permissions granulaire pour protéger vos données de guilde."
                    />
                    <FeatureItem
                        icon={Zap}
                        title="Vitesse Solaire"
                        description="Synchro temps réel pour le suivi des missions et les changements de roster."
                    />
                </div>
            </div>
        </section >
    );
}

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
