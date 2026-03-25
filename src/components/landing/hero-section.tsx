"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AccessRequestModal } from "./AccessRequestModal";
import Image from "next/image";
import { User } from "next-auth";
import Link from "next/link";
import { ChevronRight, LayoutDashboard, Users, Zap, Crown } from "lucide-react";
import { DashboardDrawer } from "@/components/layout/dashboard-drawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { loginWithDiscord } from "@/server/actions/auth-actions";

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

                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4 }}
                    className="text-[clamp(2.25rem,10vw,5rem)] font-black tracking-tighter text-white font-heading leading-[0.95] md:leading-[1.05]"
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
                            L&apos;outil de gestion n°1 <br /><span className="italic text-emerald-400">pour votre guilde Dofus.</span>
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
                        : "Le tableau de bord le plus complet pour piloter votre guilde : quêtes, missions, Songes, sorties et ladder."
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
                                <div className="space-y-6 w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-1000">
                                    <div className="flex flex-col items-center gap-1">
                                        <h3 className="text-sm font-black text-emerald-400 uppercase tracking-[0.3em]">
                                            {userGuilds.length > 1 ? "Mes Guildes" : "Mon Accès Guilde"}
                                        </h3>
                                        <div className="h-px w-12 bg-emerald-500/30" />
                                    </div>

                                    <div className="flex flex-wrap justify-center gap-6 w-full">
                                        {userGuilds.length === 1 ? (
                                            /* Single Guild: Direct Link stay for speed */
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="w-full sm:w-[320px]"
                                            >
                                                <Link
                                                    href={`/dashboard/${userGuilds[0].id}`}
                                                    className="relative flex items-center gap-5 p-5 rounded-[2rem] bg-zinc-900/60 border border-white/10 hover:bg-zinc-900 hover:border-emerald-500/50 transition-all group overflow-hidden shadow-2xl hover:-translate-y-2 h-[100px]"
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    {userGuilds[0].iconUrl ? (
                                                        <Image src={userGuilds[0].iconUrl} alt={userGuilds[0].name} width={56} height={56} className="rounded-2xl relative z-10 border border-white/10" />
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center text-xl font-black shrink-0 shadow-lg">
                                                            {userGuilds[0].name[0]}
                                                        </div>
                                                    )}
                                                    <div className="text-left relative z-10 flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                            <div className="text-[10px] font-black text-emerald-400/80 uppercase tracking-widest leading-none">Entrée Directe</div>
                                                        </div>
                                                        <div className="text-lg font-black text-white group-hover:text-emerald-400 transition-colors truncate tracking-tighter uppercase italic">{userGuilds[0].name}</div>
                                                    </div>
                                                    <ChevronRight className="w-5 h-5 text-zinc-700 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                            </motion.div>
                                        ) : (
                                            /* Multiple Guilds: Combined Stylé Cockpit Access */
                                            <DashboardDrawer>
                                                <motion.button
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="group relative flex items-center gap-6 p-6 rounded-[2.5rem] bg-zinc-900/80 border border-white/10 hover:border-emerald-500/50 transition-all shadow-2xl hover:-translate-y-2 w-full sm:w-auto min-w-[340px]"
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]" />

                                                    <div className="flex -space-x-4 relative z-10">
                                                        {userGuilds.slice(0, 3).map((g, idx) => (
                                                            <div key={g.id} className="relative transition-transform group-hover:scale-110" style={{ zIndex: 10 - idx }}>
                                                                <Avatar className="w-14 h-14 border-[3px] border-zinc-900 rounded-2xl shadow-2xl">
                                                                    <AvatarImage src={g.iconUrl || ""} />
                                                                    <AvatarFallback className="bg-zinc-800 text-zinc-500 font-black">{g.name[0]}</AvatarFallback>
                                                                </Avatar>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="text-left relative z-10">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] leading-none">Gestion Multi-Guilde</div>
                                                        </div>
                                                        <div className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors tracking-tighter uppercase italic">
                                                            Mes {userGuilds.length} Guildes
                                                        </div>
                                                    </div>

                                                    <div className="ml-auto w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-zinc-700 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-inner">
                                                        <LayoutDashboard className="w-6 h-6" />
                                                    </div>
                                                </motion.button>
                                            </DashboardDrawer>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Main CTA: Only show 'Ajouter SigilOS' if they already have guilds (the cards handle the access) */}
                            {userGuilds.length > 0 ? (
                                <button
                                    onClick={() => setShowAccessModal(true)}
                                    className="group relative inline-flex items-center gap-4 px-8 py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-emerald-500/30 text-white/50 hover:text-white transition-all duration-300"
                                >
                                    <div className="flex flex-col items-start leading-none gap-0.5 text-left">
                                        <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">Chef de Guilde ?</span>
                                        <div className="flex items-center gap-2">
                                            <Crown className="w-3.5 h-3.5 text-emerald-400" />
                                            <span className="text-sm font-bold">Inscrire Ma Guilde</span>
                                        </div>
                                    </div>
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowAccessModal(true)}
                                    className="group relative inline-flex items-center gap-4 px-12 py-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.15em] text-base shadow-[0_24px_60px_-8px_rgba(16,185,129,0.5)] transition-all duration-300 hover:scale-[1.04] active:scale-[0.97] overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/25 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                                    <span className="flex flex-col items-start leading-none gap-1 text-left">
                                        <span className="text-[10px] tracking-widest text-emerald-950/60 uppercase font-black">Chef de Guilde ?</span>
                                        <span className="text-lg">Demander l&apos;accès</span>
                                    </span>
                                    <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Logged Out View */
                        <div className="flex flex-col items-center gap-6">
                            {/* Main Connection Button */}
                            <form action={loginWithDiscord}>
                                <button
                                    type="submit"
                                    className="group relative inline-flex items-center gap-5 px-14 py-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-[0.15em] text-lg shadow-[0_24px_60px_-8px_rgba(16,185,129,0.5)] transition-all duration-300 hover:scale-[1.04] active:scale-[0.97] overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/25 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                                    <DiscordIcon className="w-8 h-8 flex-shrink-0 text-[#000]" />
                                    <span className="flex flex-col items-start leading-none gap-1 text-left">
                                        <span className="text-[10px] tracking-widest text-emerald-950/60 uppercase font-black">Accès Membre</span>
                                        <span className="text-xl">Se Connecter</span>
                                    </span>
                                    <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                                </button>
                            </form>

                            {/* Secondary Request Access for Admins */}
                            <button
                                onClick={() => setShowAccessModal(true)}
                                className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-zinc-400 hover:text-white transition-all text-xs font-bold uppercase tracking-widest"
                            >
                                <span className="opacity-60">Chef de Guilde ?</span>
                                <span>Demander l&apos;accès</span>
                                <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Modal */}
            <AccessRequestModal open={showAccessModal} onClose={() => setShowAccessModal(false)} />
        </section>
    );
}
