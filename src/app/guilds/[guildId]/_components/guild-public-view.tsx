"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import {
    Users,
    Calendar,
    Server,
    MessageCircle,
    UserPlus,
    ArrowLeft,
    Swords,
    Sparkles,
    Castle,
    Coins,
    Theater,
    Target,
    Shield,
    Globe,
    Image as ImageIcon,
    Crown,
    Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AVAILABLE_ACTIVITIES } from "@/lib/presentation-constants";
import type { GuildPresentation } from "@/server/actions/presentation-actions";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { GlassPanel } from "@/components/ui/glass-panel";
import { BorderBeam } from "@/components/ui/border-beam";

// Activity icons mapping
const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
    "economie": <Coins className="w-4 h-4" />,
    "pvm": <Swords className="w-4 h-4" />,
    "roleplay": <Theater className="w-4 h-4" />,
    "kolizeum": <Target className="w-4 h-4" />,
    "percepteur": <Shield className="w-4 h-4" />,
};

const getActivityLabel = (id: string) => {
    const activity = AVAILABLE_ACTIVITIES.find(a => a.id === id);
    return activity?.label || id;
};

type Props = {
    guild: GuildPresentation;
    foundedYear: number;
};

// Animation Variants
const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: "easeOut" as const }
    }
};

const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const scaleIn = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { type: "spring" as const, bounce: 0.4 }
    }
};

export function GuildPublicView({ guild, foundedYear }: Props) {
    const headerRef = useRef<HTMLElement>(null);
    const { scrollY } = useScroll();

    // Use the actual founded date or fallback to current year
    // Use strict manual date
    const foundedDate = guild.foundedDate ? new Date(guild.foundedDate) : null;

    // Parallax effect for banner
    const bannerY = useTransform(scrollY, [0, 500], [0, 150]);
    const bannerOpacity = useTransform(scrollY, [0, 300], [1, 0.4]);
    const textY = useTransform(scrollY, [0, 500], [0, 100]); // Slower parallax for text

    return (
        <div className="relative min-h-screen bg-[#020202] text-zinc-100 overflow-x-hidden selection:bg-indigo-500/30">
            <AuroraBackground className="fixed inset-0 z-0 opacity-30 pointer-events-none" />
            {/* Hero Banner with Parallax */}
            <header ref={headerRef} className="relative h-[45vh] md:h-[55vh] min-h-[350px] overflow-hidden">
                {/* Background Parallax Layer */}
                <motion.div
                    style={{ y: bannerY, opacity: bannerOpacity }}
                    className="absolute inset-0 z-0"
                >
                    {guild.bannerType === "custom" && guild.bannerUrl ? (
                        <Image
                            src={guild.bannerUrl}
                            alt={`${guild.name} banner`}
                            fill
                            className="object-cover"
                            priority
                        />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-zinc-900" />
                    )}
                </motion.div>

                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent z-10" />

                {/* Sticky Header Nav */}
                <nav className="fixed top-0 left-0 right-0 z-50 bg-[#020202]/40 backdrop-blur-xl border-b border-white/5 py-4 px-6">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <Link href="/" className="flex items-center gap-3 group">
                            <img src="/assets/ui/logo_sigilos_v2.png" alt="SigilOS" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] group-hover:scale-110 transition-transform" />
                            <span className="text-xl font-black tracking-widest text-white">
                                SIGIL<span className="text-purple-400">OS</span>
                            </span>
                        </Link>
                        <Link
                            href="/guilds"
                            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-all"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Annuaire
                        </Link>
                    </div>
                </nav>

                {/* Guild Identity */}
                <motion.div
                    style={{ y: textY }}
                    className="absolute bottom-0 left-0 right-0 p-6 md:p-12 z-20"
                >
                    <div className="container mx-auto flex flex-col md:flex-row items-end gap-8">
                        {/* Guild Icon with floating effect */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0, y: 50 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{ type: "spring", duration: 0.8, bounce: 0.5 }}
                            className="relative w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-zinc-950 border-4 border-[#10081a] flex items-center justify-center overflow-hidden shrink-0 shadow-2xl shadow-purple-500/20 group"
                        >
                            {guild.iconUrl ? (
                                <Image
                                    src={guild.iconUrl}
                                    alt={`${guild.name} icon`}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                            ) : (
                                <div className="text-4xl">🛡️</div>
                            )}
                            {/* Shine effect */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                        </motion.div>

                        <div className="flex-1 mb-2">
                            <motion.div
                                initial="hidden"
                                animate="visible"
                                variants={staggerContainer}
                            >
                                <motion.div variants={fadeIn} className="flex flex-wrap items-center gap-3 mb-2">
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 backdrop-blur-sm">
                                        Niveau 200
                                    </span>
                                    {guild.server && (
                                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-800/60 text-zinc-300 border border-white/5 backdrop-blur-sm">
                                            <Server className="w-3 h-3" />
                                            {guild.server}
                                        </span>
                                    )}
                                    {guild.foundedDate && (
                                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 backdrop-blur-sm">
                                            <Calendar className="w-3 h-3" />
                                            Guilde fondée le {new Date(guild.foundedDate).toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' })}
                                        </span>
                                    )}
                                </motion.div>

                                <motion.h1 variants={fadeIn} className="text-4xl md:text-6xl font-black text-white tracking-tight mb-2 drop-shadow-lg">
                                    {guild.name}
                                </motion.h1>

                                <motion.div variants={fadeIn} className="flex flex-wrap gap-2 text-sm text-zinc-300">
                                    {guild.activities?.map((activity) => (
                                        <span key={activity} className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5 cursor-default">
                                            {ACTIVITY_ICONS[activity] || <Sparkles className="w-3.5 h-3.5" />}
                                            {getActivityLabel(activity)}
                                        </span>
                                    ))}
                                </motion.div>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>
            </header>

            <main className="container mx-auto px-4 py-8 md:py-16 space-y-8 md:space-y-16 relative z-20">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
                    {/* Left Column - Main Content */}
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: "-50px" }}
                        variants={staggerContainer}
                        className="lg:col-span-2 space-y-8 md:space-y-12"
                    >
                        {/* Team Section */}
                        {(guild.founder || (guild.coLeaders?.length ?? 0) > 0 || (guild.team?.length ?? 0) > 0) && (
                            <motion.section variants={fadeIn} className="space-y-8">
                                <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                                        <Users className="w-6 h-6" />
                                    </div>
                                    L&apos;Équipe
                                </h2>

                                <div className="space-y-6">
                                    {/* Founder */}
                                    {guild.founder && (
                                        <div className="flex justify-center md:justify-start">
                                            <motion.div
                                                whileHover={{ scale: 1.05 }}
                                                className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 to-orange-600/10 rounded-2xl p-4 border border-amber-500/20 shadow-[0_0_30px_-10px_rgba(245,158,11,0.15)] group inline-flex items-center gap-4 pr-8"
                                            >
                                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                                    <Crown className="w-16 h-16 text-amber-500" />
                                                </div>
                                                <div className="w-12 h-12 rounded-full bg-linear-to-br from-amber-400/20 to-amber-600/10 flex items-center justify-center border border-amber-500/30 shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)] shrink-0">
                                                    <Crown className="w-6 h-6 text-amber-400" />
                                                </div>
                                                <div className="relative z-10">
                                                    <span className="block text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-0.5">
                                                        Fondateur
                                                    </span>
                                                    <p className="text-xl font-bold text-white tracking-tight leading-none">{guild.founder}</p>
                                                </div>
                                            </motion.div>
                                        </div>
                                    )}

                                    {/* Co-leaders */}
                                    {(guild.coLeaders ?? []).length > 0 && (
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-widest pl-1">Co-leaders</h3>
                                            <div className="flex flex-wrap gap-3">
                                                {guild.coLeaders?.map((pseudo, index) => (
                                                    <motion.div
                                                        key={`coleader-${index}`}
                                                        whileHover={{ scale: 1.05, backgroundColor: "rgba(250, 204, 21, 0.1)" }}
                                                        className="flex items-center gap-3 bg-zinc-900/40 rounded-full pl-2 pr-4 py-1.5 border border-yellow-500/10 hover:border-yellow-500/30 transition-all group"
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 group-hover:border-yellow-500/40 transition-colors shrink-0">
                                                            <Star className="w-4 h-4 text-yellow-500" />
                                                        </div>
                                                        <p className="font-medium text-white text-sm">{pseudo}</p>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Bras Droits */}
                                    {(guild.team ?? []).length > 0 && (
                                        <div className="space-y-3">
                                            <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-widest pl-1">Bras Droits</h3>
                                            <div className="flex flex-wrap gap-2">
                                                {guild.team?.map((pseudo, index) => (
                                                    <motion.div
                                                        key={`brasdroit-${index}`}
                                                        whileHover={{ scale: 1.05, backgroundColor: "rgba(129, 140, 248, 0.1)" }}
                                                        className="flex items-center gap-2 bg-zinc-900/40 rounded-full pl-2 pr-4 py-1.5 border border-indigo-500/10 hover:border-indigo-500/30 transition-all group"
                                                    >
                                                        <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:border-indigo-500/40 transition-colors shrink-0">
                                                            <Shield className="w-3 h-3 text-indigo-400" />
                                                        </div>
                                                        <p className="text-sm font-medium text-zinc-200">{pseudo}</p>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.section>
                        )}

                        {/* Guild Photo Section */}
                        {guild.photoUrl && (
                            <motion.section variants={fadeIn} className="space-y-6">
                                <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                                        <ImageIcon className="w-6 h-6" />
                                    </div>
                                    La Guilde en Image
                                </h2>
                                <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/5 shadow-2xl shadow-purple-500/5 group">
                                    <Image
                                        src={guild.photoUrl}
                                        alt={`Photo de la guilde ${guild.name}`}
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                    {/* Overlay Gradient */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />
                                </div>
                            </motion.section>
                        )}

                        {/* History Section */}
                        {guild.history && (
                            <motion.section variants={fadeIn} className="space-y-6">
                                <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                                        <Globe className="w-6 h-6" />
                                    </div>
                                    Notre Histoire
                                </h2>
                                <GlassPanel intensity="low" className="p-8 border border-white/5 relative overflow-hidden group">
                                    <BorderBeam className="opacity-30" />
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/10 transition-colors duration-1000" />
                                    <div className="prose prose-invert prose-lg prose-zinc max-w-none relative z-10">
                                        <p className="whitespace-pre-wrap leading-relaxed text-zinc-300">
                                            {guild.history}
                                        </p>
                                    </div>
                                </GlassPanel>
                            </motion.section>
                        )}
                    </motion.div>

                    {/* Right Column - Sidebar */}
                    <div className="space-y-8">
                        {/* Recruitment Card */}
                        <GlassPanel
                            intensity="high"
                            className="bg-[#0a0a0c]/80 border border-white/10 p-6 md:p-8 space-y-8 sticky top-24 shadow-2xl shadow-purple-500/10"
                        >
                            <BorderBeam size={200} duration={12} delay={9} colorFrom="#a855f7" colorTo="#6366f1" />
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                    <Swords className="w-5 h-5 text-pink-400" />
                                    Recrutement
                                </h3>
                                <p className="text-sm text-zinc-400">
                                    Rejoignez l&apos;aventure {guild.name} !
                                </p>
                            </div>

                            <div className="space-y-4">
                                {/* State Badge */}
                                <div className={`flex items-center justify-between p-4 rounded-2xl ${guild.isRecruiting
                                    ? "bg-emerald-500/10 border border-emerald-500/20"
                                    : "bg-red-500/5 border border-red-500/10"
                                    }`}>
                                    <span className="font-medium text-zinc-300">État actuel</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${guild.isRecruiting ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
                                        }`}>
                                        {guild.isRecruiting ? "Ouvert" : "Fermé"}
                                    </span>
                                </div>

                                {guild.isRecruiting && (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            {guild.minLevel && (
                                                <div className="p-3 bg-zinc-800/50 rounded-xl border border-white/5 text-center">
                                                    <p className="text-xs text-zinc-500 mb-1">Niveau Min.</p>
                                                    <p className="text-lg font-bold text-white">{guild.minLevel}</p>
                                                </div>
                                            )}
                                            {guild.minSuccesses && (
                                                <div className="p-3 bg-zinc-800/50 rounded-xl border border-white/5 text-center">
                                                    <p className="text-xs text-zinc-500 mb-1">Succès Min.</p>
                                                    <p className="text-lg font-bold text-white">{guild.minSuccesses}</p>
                                                </div>
                                            )}
                                        </div>



                                        {guild.discordRequired && (
                                            <div className="flex items-center gap-3 p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                                                <MessageCircle className="w-5 h-5 text-indigo-400 shrink-0" />
                                                <span className="text-xs font-medium text-indigo-200">
                                                    Discord obligatoire pour rejoindre
                                                </span>
                                            </div>
                                        )}

                                        {guild.recruitmentRequirements && guild.recruitmentRequirements.trim().length > 0 && (
                                            <div className="p-4 bg-zinc-800/30 rounded-2xl border border-white/5">
                                                <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-2">Pré-requis</p>
                                                <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                                                    {guild.recruitmentRequirements}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {guild.discord && (
                                <Link href={guild.discord} target="_blank" className="block relative group">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200 animate-tilt"></div>
                                    <Button className="relative w-full h-12 bg-black hover:bg-zinc-900 border border-white/10 gap-2 font-bold text-white rounded-xl">
                                        <MessageCircle className="w-5 h-5 text-indigo-400" />
                                        Rejoindre le Discord
                                    </Button>
                                </Link>
                            )}

                            {!guild.isRecruiting && (
                                <p className="text-xs text-center text-zinc-500">
                                    Le recrutement est actuellement fermé, mais vous pouvez toujours venir discuter sur notre Discord !
                                </p>
                            )}
                        </GlassPanel>
                    </div>
                </div>
            </main>
        </div>
    );
}
