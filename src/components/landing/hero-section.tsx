"use client";

import { motion } from "framer-motion";
import { siteConfig } from "@/config/site-config";
import { BetaGate } from "./beta-gate";
import Link from "next/link";
import { Users } from "lucide-react";

export function HeroSection() {
    return (
        <section className="relative min-h-[95vh] flex flex-col items-center justify-center overflow-hidden px-4 md:px-6">

            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8 w-full">


                {/* Badge Info - Bêta Privée */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-md mx-auto"
                >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-mono text-emerald-300 uppercase tracking-wider font-bold">
                        Bêta Privée Ouverte
                    </span>
                </motion.div>

                {/* Main Title (SEO H1) */}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4 }}
                    className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-white font-heading"
                >
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-amber-200 to-emerald-400">
                        Arrêtez les fichiers Excel, <br /> Passez sur un outil <span className="italic">Professionnel</span> et <span className="italic">sécurisé</span>.
                    </span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4 }}
                    className="text-base md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed"
                >
                    SigilOS est le grimoire numérique ultime pour les chefs de guilde exigeants.
                    Centralisez vos missions, suivez l'Ocre et gérez vos membres avec la précision d'un Xélor.
                    <br className="hidden md:block" />
                    Moins de tableurs, plus de victoires.
                </motion.p>

                {/* Beta Gate Component & Directory Link */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.6 }}
                    className="pt-8 w-full space-y-4"
                >
                    <BetaGate />
                </motion.div>

            </div>
        </section>
    );
}
