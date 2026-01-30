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
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8 w-full">

                {/* V2 Logo - Hero Centerpiece */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative w-24 h-24 md:w-32 md:h-32 mx-auto mb-6 pointer-events-none"
                >
                    <div className="absolute inset-0 bg-purple-500/20 blur-[50px] rounded-full animate-pulse-slow"></div>
                    <img
                        src="/assets/ui/logo-v2.png"
                        alt="SigilOS Void Egg"
                        className="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(168,85,247,0.4)] relative z-10"
                    />
                </motion.div>

                {/* Badge Info - Bêta Privée */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 backdrop-blur-md mx-auto"
                >
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-xs font-mono text-indigo-300 uppercase tracking-wider font-bold">
                        Bêta Privée - Accès Restreint
                    </span>
                </motion.div>

                {/* Main Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4 }}
                    className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-white font-heading"
                >
                    L'Operating System des <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-200 to-fuchsia-400">
                        Guildes d'Élite
                    </span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4 }}
                    className="text-base md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed"
                >
                    Gérez vos missions, songes et membres avec une précision militaire.
                    <br className="hidden md:block" />
                    Sécurité maximale, design immersif, performance absolue.
                </motion.p>

                {/* Beta Gate Component & Directory Link */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.6 }}
                    className="pt-8 w-full space-y-4"
                >
                    <BetaGate />

                    <div className="flex justify-center">
                        <Link
                            href="/guilds"
                            className="group relative inline-flex items-center gap-2 px-6 py-2 rounded-full border border-white/5 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all text-sm font-bold uppercase tracking-widest overflow-hidden"
                        >
                            <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <Users className="w-4 h-4 text-purple-400" />
                            Consulter l&apos;Annuaire des Guildes
                        </Link>
                    </div>
                </motion.div>

            </div>
        </section>
    );
}
