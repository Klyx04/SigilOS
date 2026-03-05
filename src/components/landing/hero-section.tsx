"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AccessRequestModal } from "./AccessRequestModal";
import Image from "next/image";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

export function HeroSection() {
    const [showAccessModal, setShowAccessModal] = useState(false);

    return (
        <section className="relative min-h-[75vh] flex flex-col items-center justify-center overflow-hidden px-4 md:px-6">

            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
                <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
            </div>

            {/* Floating Dofus Icon — LEFT side */}
            <motion.div
                initial={{ opacity: 0, x: -40, rotate: 10 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                transition={{ duration: 1, delay: 0.9 }}
                className="hidden lg:block absolute left-[3%] xl:left-[8%] top-1/2 -translate-y-1/2 z-10"
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-amber-500/15 blur-[60px] rounded-full animate-pulse-slow" />
                    <Image
                        src="/assets/landing/icone-dofus.png"
                        alt="Dofus"
                        width={140}
                        height={140}
                        className="relative drop-shadow-[0_0_40px_rgba(245,158,11,0.3)] hover:scale-110 transition-transform duration-500 lg:w-[100px] lg:h-[100px] xl:w-[130px] xl:h-[130px] -scale-x-100"
                    />
                </div>
            </motion.div>

            {/* Floating Dofus Icon — RIGHT side */}
            <motion.div
                initial={{ opacity: 0, x: 40, rotate: -10 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                transition={{ duration: 1, delay: 0.8 }}
                className="hidden lg:block absolute right-[3%] xl:right-[8%] top-1/2 -translate-y-1/2 z-10"
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-emerald-500/15 blur-[60px] rounded-full animate-pulse-slow" />
                    <Image
                        src="/assets/landing/icone-dofus.png"
                        alt="Dofus"
                        width={140}
                        height={140}
                        className="relative drop-shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:scale-110 transition-transform duration-500 lg:w-[100px] lg:h-[100px] xl:w-[130px] xl:h-[130px]"
                    />
                </div>
            </motion.div>

            <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6 w-full">

                {/* Badge Bêta */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-md mx-auto"
                >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-mono text-emerald-300 uppercase tracking-wider font-bold">
                        Bêta Ouverte !
                    </span>
                </motion.div>

                {/* H1 */}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4 }}
                    className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white font-heading leading-[1.1]"
                >
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-amber-200 to-emerald-400">
                        Fini les tableurs excel : <br /><span className="italic">Le dashboard de gestion de guilde Dofus Unity.</span>
                    </span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.5 }}
                    className="text-base md:text-lg text-zinc-400 max-w-lg mx-auto leading-relaxed"
                >
                    Le dashboard tout-en-un pour guildes Dofus Unity. Missions, membres, events, sondages — centralisés.
                </motion.p>

                {/* CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.6 }}
                    className="pt-2 w-full flex flex-col items-center gap-4"
                >
                    {/* PRIMARY CTA — Demander l'accès */}
                    <button
                        onClick={() => setShowAccessModal(true)}
                        className="group relative inline-flex items-center gap-4 px-14 py-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.15em] text-base shadow-[0_24px_60px_-8px_rgba(16,185,129,0.6)] hover:shadow-[0_28px_70px_-6px_rgba(16,185,129,0.75)] transition-all duration-300 hover:scale-[1.04] active:scale-[0.97] overflow-hidden"
                    >
                        {/* Shimmer */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/25 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                        <DiscordIcon className="w-7 h-7 flex-shrink-0" />
                        <span className="text-lg">Demander l&apos;accès</span>
                    </button>

                </motion.div>
            </div>

            {/* Modal */}
            <AccessRequestModal open={showAccessModal} onClose={() => setShowAccessModal(false)} />
        </section>
    );
}
