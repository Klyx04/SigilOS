"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AccessRequestModal } from "./AccessRequestModal";
import Image from "next/image";
import { User } from "next-auth";
import Link from "next/link";
import { ChevronRight, LayoutDashboard, Users, Zap } from "lucide-react";

const DiscordIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 127.14 96.36" fill="currentColor">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c2.91-27.55-13.48-51.67-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
);

interface HeroSectionProps {
    user?: User;
    userGuilds?: { id: string; name: string; iconUrl: string | null }[];
}

export function HeroSection({ user, userGuilds = [] }: HeroSectionProps) {
    const [showAccessModal, setShowAccessModal] = useState(false);

    return (
        <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden px-4 md:px-6 pt-32 pb-20">

            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 rounded-full blur-[100px]" />
                <div className="absolute inset-0 bg-[url(/noise.svg)] opacity-[0.03] mix-blend-overlay" />
                
                {/* Grid Accent */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
            </div>

            <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8 w-full">

                {/* Status Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl mx-auto"
                >
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">
                        {user ? `Session Active : ${user.name}` : "Système Bêta Ouvert"}
                    </span>
                </motion.div>

                {/* Hero Title */}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4 }}
                    className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight text-white font-heading leading-[1.05]"
                >
                    {user ? (
                        <span>
                            Prenez les commandes <br /> 
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-200">
                                de votre empire Dofus.
                            </span>
                        </span>
                    ) : (
                        <span>
                            L&apos;OS ultime <br /><span className="italic">pour les guildes d&apos;élite.</span>
                        </span>
                    )}
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.5 }}
                    className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto leading-relaxed font-medium"
                >
                    {user 
                        ? "Centralisez la gestion de vos membres, automatisez vos missions et coordonnez vos sorties depuis un cockpit unique."
                        : "Le premier véritable système d'exploitation conçu pour la gestion haute performance de guildes sur Dofus Unity."
                    }
                </motion.p>

                {/* CTAs / Quick Access */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.6 }}
                    className="pt-6 w-full flex flex-col items-center gap-8"
                >
                    {/* Logged In View: Quick Access + Request Access */}
                    {user ? (
                        <div className="w-full max-w-3xl flex flex-col items-center gap-8">
                            {/* Guild Quick Links - Dashboard specialized */}
                            {userGuilds.length > 0 && (
                                <div className="flex flex-wrap justify-center gap-4 w-full">
                                    {userGuilds.slice(0, 3).map((guild, i) => (
                                        <motion.div
                                            key={guild.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: 0.7 + (i * 0.1) }}
                                        >
                                            <Link 
                                                href={`/dashboard/${guild.id}`}
                                                className="flex items-center gap-3 p-2 pr-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-emerald-500/30 transition-all hover:-translate-y-1 group"
                                            >
                                                {guild.iconUrl ? (
                                                    <Image src={guild.iconUrl} alt={guild.name} width={40} height={40} className="rounded-xl" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center text-xs font-black">
                                                        {guild.name[0]}
                                                    </div>
                                                )}
                                                <div className="text-left">
                                                    <div className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none mb-1 text-emerald-400/50">Explorer</div>
                                                    <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{guild.name}</div>
                                                </div>
                                            </Link>
                                        </motion.div>
                                    ))}
                                    {userGuilds.length > 3 && (
                                        <Link href="/dashboard" className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/40 text-xs font-bold" title="Voir toutes mes guildes">
                                            +{userGuilds.length - 3}
                                        </Link>
                                    )}
                                </div>
                            )}

                            {/* Main CTA: Request Access (Always visible for conversion) */}
                            <button
                                onClick={() => setShowAccessModal(true)}
                                className="group relative inline-flex items-center gap-4 px-14 py-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.15em] text-base shadow-[0_24px_60px_-8px_rgba(16,185,129,0.5)] transition-all duration-300 hover:scale-[1.04] active:scale-[0.97] overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/25 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                                <span className="text-lg">Demander l&apos;accès</span>
                                <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                            </button>
                        </div>
                    ) : (
                        /* Logged Out View */
                        <button
                            onClick={() => setShowAccessModal(true)}
                            className="group relative inline-flex items-center gap-4 px-14 py-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.15em] text-base shadow-[0_24px_60px_-8px_rgba(16,185,129,0.5)] transition-all duration-300 hover:scale-[1.04] active:scale-[0.97] overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/25 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                            <DiscordIcon className="w-7 h-7 flex-shrink-0" />
                            <span className="text-lg">Demander l&apos;accès</span>
                            <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                        </button>
                    )}
                </motion.div>
            </div>

            {/* Modal */}
            <AccessRequestModal open={showAccessModal} onClose={() => setShowAccessModal(false)} />
        </section>
    );
}
