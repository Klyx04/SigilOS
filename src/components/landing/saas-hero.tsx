"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowRight, Shield, Globe, Zap, Crown, MessageSquare } from "lucide-react";

import { User } from "next-auth";
import { loginWithDiscord } from "@/server/actions/auth-actions";

export function SaasHero({ user }: { user?: User }) {
    return (
        <section className="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-purple-900/10 via-transparent to-transparent">
            {/* Ambient Noise Overlay */}
            <div className="absolute inset-0 noise-overlay opacity-[0.03] pointer-events-none" />

            {/* Background Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[20%] w-[800px] h-[800px] bg-primary/10 rounded-full blur-[140px] mix-blend-screen animate-pulse-slow font-sans" />
                <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[120px] mix-blend-screen" />
            </div>

            <div className="container relative z-10 px-4 mx-auto text-center">
                {/* Hero Logo - Maximum Visibility */}
                <div className="relative w-72 h-72 mx-auto mb-16 animate-in fade-in zoom-in duration-1000">
                    {/* Backlight Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-purple-500/20 rounded-full blur-[70px] animate-pulse shadow-[0_0_100px_rgba(168,85,247,0.3)]"></div>

                    <Image
                        src="/assets/ui/logo-v2.png"
                        alt="SigilOS Hero Logo"
                        fill
                        className="object-contain drop-shadow-[0_0_50px_rgba(168,85,247,0.5)] brightness-125 animate-pulse-slow relative z-10 hover:scale-105 transition-transform duration-700 cursor-pointer"
                        priority
                    />
                </div>

                {/* Heading */}
                <h1 className="text-6xl md:text-8xl font-black tracking-tight text-white mb-8 animate-in fade-in slide-in-from-bottom-5 duration-1000">
                    Gérez votre Guilde <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                        Comme un Pro
                    </span>
                </h1>

                {/* Subheading */}
                <p className="text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto mb-14 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100">
                    Le système d'exploitation ultime pour les guildes Dofus.<br />
                    Missions, progression et roster : maîtrisez tout avec style.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                    <div className="flex flex-wrap items-center justify-center gap-6">
                        {user ? (
                            <Button size="lg" className="h-14 px-10 text-lg rounded-full bg-purple-600 text-white hover:bg-purple-500 hover:scale-105 transition-all font-black uppercase tracking-widest shadow-xl shadow-purple-500/30 group" asChild>
                                <Link href="/dashboard">
                                    Accéder au Dashboard
                                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </Button>
                        ) : (
                            <Button size="lg" className="h-14 px-10 text-lg rounded-full bg-white text-black hover:bg-zinc-100 hover:scale-105 transition-all font-black uppercase tracking-widest shadow-2xl shadow-white/10 group" onClick={() => loginWithDiscord()}>
                                Connexion Discord
                                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        )}
                        <Button size="lg" variant="outline" className="h-14 px-10 text-lg rounded-full border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white transition-all uppercase font-bold tracking-widest backdrop-blur-sm" asChild>
                            <Link href="/guilds">
                                Voir l'Annuaire
                            </Link>
                        </Button>
                    </div>

                    {/* Guild Leader Conversion Callout */}
                    <div className="flex flex-col items-center gap-4 bg-white/5 border border-white/5 p-6 rounded-3xl max-w-xl w-full backdrop-blur-md relative overflow-hidden group hover:border-amber-500/30 transition-all duration-500">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[40px] -z-10 group-hover:bg-amber-500/10 transition-colors" />
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <Crown className="w-5 h-5 text-amber-400" />
                            </div>
                            <h3 className="text-white font-black uppercase tracking-tighter text-lg">Chef de Guilde ?</h3>
                        </div>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                            Automatisez vos missions, gérez votre roster et libérez votre temps pour la conquête.
                        </p>
                        <Link
                            href="https://discord.gg/uX7G6SUDgN"
                            target="_blank"
                            className="text-amber-400 text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:text-amber-300 transition-colors group/link"
                        >
                            <MessageSquare className="w-4 h-4" />
                            Rejoindre la Bêta Privée
                            <ChevronRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Dashboard Preview (Screenshot) */}
            <div className="mt-32 relative max-w-6xl mx-auto px-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500 group">
                {/* Visual Frame */}
                <div className="relative rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur-xl shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10 opacity-60"></div>
                    <div className="absolute inset-0 noise-overlay opacity-[0.02] z-0 pointer-events-none"></div>

                    <Image
                        src="/assets/ui/previsu.png"
                        alt="SigilOS Dashboard Preview"
                        width={1920}
                        height={1080}
                        className="w-full h-auto object-cover opacity-80 transition-all duration-1000 group-hover:scale-[1.02] group-hover:opacity-100"
                        priority
                    />

                    {/* Corner Decoration Glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 blur-[100px] z-20 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 blur-[100px] z-20 pointer-events-none" />
                </div>

                {/* Border Beam Animation for the Card */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/20 leading-none to-indigo-500/20 blur opacity-20 -z-10 group-hover:opacity-40 transition-opacity" />
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
