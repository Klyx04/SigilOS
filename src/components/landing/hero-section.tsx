"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BetaGate } from "./beta-gate";
import { AccessRequestModal } from "./AccessRequestModal";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

export function HeroSection() {
    const [showAccessModal, setShowAccessModal] = useState(false);

    return (
        <section className="relative min-h-[95vh] flex flex-col items-center justify-center overflow-hidden px-4 md:px-6">

            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8 w-full">

                {/* Badge Bêta */}
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

                {/* H1 */}
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
                    transition={{ duration: 0.7, delay: 0.5 }}
                    className="text-base md:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed"
                >
                    SigilOS est le grimoire numérique ultime pour les chefs de guilde exigeants.
                    Centralisez vos missions, suivez l&apos;Ocre et gérez vos membres avec la précision d&apos;un Xélor.
                    <br className="hidden md:block" />
                    Moins de tableurs, plus de victoires.
                </motion.p>

                {/* CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.6 }}
                    className="pt-4 w-full flex flex-col items-center gap-4"
                >
                    {/* PRIMARY CTA — Demander l'accès */}
                    <button
                        onClick={() => setShowAccessModal(true)}
                        className="group relative inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.15em] text-sm shadow-[0_20px_50px_-10px_rgba(16,185,129,0.5)] hover:shadow-[0_20px_60px_-8px_rgba(16,185,129,0.65)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] overflow-hidden"
                    >
                        {/* Shimmer */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                        <DiscordIcon className="w-5 h-5 flex-shrink-0" />
                        Demander l&apos;accès
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3 text-zinc-700 text-[10px] font-bold uppercase tracking-widest w-full max-w-xs">
                        <div className="h-px flex-1 bg-white/5" />
                        <span>Déjà inscrit ?</span>
                        <div className="h-px flex-1 bg-white/5" />
                    </div>

                    {/* SECONDARY CTA — BetaGate (login) */}
                    <div className="w-full max-w-sm">
                        <BetaGate />
                    </div>
                </motion.div>
            </div>

            {/* Modal */}
            <AccessRequestModal open={showAccessModal} onClose={() => setShowAccessModal(false)} />
        </section>
    );
}
