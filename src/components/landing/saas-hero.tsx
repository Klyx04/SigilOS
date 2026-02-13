"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ChevronRight, ArrowRight, Shield, Globe, Zap } from "lucide-react";

import { User } from "next-auth";
import { loginWithDiscord } from "@/server/actions/auth-actions";

export function SaasHero({ user }: { user?: User }) {
    return (
        <section className="relative overflow-hidden pt-32 pb-20 lg:pt-48 lg:pb-32">
            {/* Background Effects */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] mix-blend-screen" />
            </div>

            <div className="container relative z-10 px-4 mx-auto text-center">
                {/* Hero Logo - Maximum Visibility */}
                <div className="relative w-64 h-64 mx-auto mb-12 animate-in fade-in zoom-in duration-700">
                    {/* Backlight Glow - Reduced opacity */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-purple-500/10 rounded-full blur-[50px] animate-pulse"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/5 rounded-full blur-[30px]"></div>

                    <Image
                        src="/assets/ui/logo-v2.png"
                        alt="SigilOS Hero Logo"
                        fill
                        className="object-contain drop-shadow-[0_0_40px_rgba(168,85,247,0.4)] brightness-110 animate-pulse-slow relative z-10"
                        priority
                    />
                </div>

                {/* Badge REMOVED */}

                {/* Heading */}
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
                    Gérez votre Guilde <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                        Comme un Pro
                    </span>
                </h1>

                {/* Subheading */}
                <p className="text-lg md:text-xl text-zinc-300 max-w-2xl mx-auto mb-10 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                    Le système d'exploitation ultime pour les guildes Dofus.
                    Gérez vos missions, suivez votre progression et coordonnez vos membres avec précision et style.
                </p>

                {/* CTA Buttons */}
                {user ? (
                    <Button size="lg" className="h-12 px-8 text-base rounded-full bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 transition-all font-bold shadow-lg shadow-indigo-500/25" asChild>
                        <Link href="/dashboard">
                            Accéder au Dashboard
                            <ArrowRight className="ml-2 w-4 h-4" />
                        </Link>
                    </Button>
                ) : (
                    <Button size="lg" className="h-12 px-8 text-base rounded-full bg-white text-black hover:bg-zinc-200 hover:scale-105 transition-all font-bold shadow-lg shadow-white/10" onClick={() => loginWithDiscord()}>
                        Connexion Discord
                        <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                )}
                <Button size="lg" variant="outline" className="h-12 px-8 text-base rounded-full border-white/10 hover:bg-white/5 text-white hover:text-indigo-300 transition-colors" asChild>
                    <Link href="/guilds">
                        Voir l'Annuaire
                    </Link>
                </Button>
            </div>

            {/* Dashboard Preview (Screenshot) */}
            <div className="mt-20 relative max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 group">
                <div className="rounded-xl border border-white/10 bg-zinc-950/50 backdrop-blur-sm shadow-2xl overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10 opacity-50"></div>

                    <Image
                        src="/assets/ui/previsu.png"
                        alt="SigilOS Dashboard Preview"
                        width={1920}
                        height={1080}
                        className="w-full h-auto object-cover opacity-90 transition-all duration-700 group-hover:scale-[1.01] group-hover:opacity-100"
                        priority
                    />
                </div>
            </div>


            {/* Features Grid (Mini) */}
            <div className="container px-4 mx-auto mt-24 border-t border-white/5 pt-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <FeatureItem
                        icon={Globe}
                        title="Multi-Guildes"
                        description="Gérez plusieurs guildes depuis un seul compte avec une navigation fluide."
                    />
                    <FeatureItem
                        icon={Shield}
                        title="Gestion des Rôles"
                        description="Système de permissions granulaire pour les meneurs, bras droits et membres."
                    />
                    <FeatureItem
                        icon={Zap}
                        title="Synchro Temps Réel"
                        description="Mises à jour instantanées pour le suivi des missions et les changements de roster."
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
