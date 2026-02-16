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
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";

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
        <div className="relative min-h-screen bg-black text-white selection:bg-indigo-500/30 font-sans flex flex-col overflow-x-hidden">
            {/* Ambient Background Layer (2026 Standard) */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-5 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.03),transparent_70%)]" />
            <AuroraBackground className="absolute inset-0 z-0 h-full w-full pointer-events-none opacity-5 saturate-100 blur-3xl scale-125" />

            {/* Hero Image / Banner */}
            <div className="relative h-[40vh] md:h-[50vh] min-h-[350px] overflow-hidden">
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
                            unoptimized={true}
                        />
                    ) : (
                        <div className="absolute inset-0 bg-zinc-950" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
                </motion.div>
            </div>

            {/* Sticky Header Nav (Consistent with Directory) */}
            <PublicHeader backHref="/guilds" backLabel="Annuaire" />

            {/* Guild Header Content (Overlapping Hero) */}
            <div className="relative z-20 -mt-32 md:-mt-40 max-w-7xl mx-auto px-6 md:px-8 pb-12">
                <div className="flex flex-col md:flex-row items-end gap-8">
                    {/* Guild Icon */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        className="relative w-32 h-32 md:w-48 md:h-48 rounded-3xl bg-zinc-900 border-4 border-zinc-950 shadow-2xl overflow-hidden shrink-0"
                    >
                        {guild.iconUrl ? (
                            <Image
                                src={guild.iconUrl}
                                alt={`${guild.name} icon`}
                                fill
                                className="object-cover"
                                unoptimized={true}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl bg-zinc-800 text-zinc-600">
                                {guild.name.charAt(0)}
                            </div>
                        )}
                    </motion.div>

                    <div className="flex-1 space-y-4 pb-2">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={staggerContainer}
                            className="space-y-2"
                        >
                            <motion.div variants={fadeIn} className="flex flex-wrap items-center gap-3">
                                {guild.server && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/10 text-white text-xs font-bold uppercase tracking-wider border border-white/5 backdrop-blur-md">
                                        <Server className="w-3 h-3" />
                                        {guild.server}
                                    </span>
                                )}
                                {guild.foundedDate && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-zinc-900/50 text-zinc-400 text-xs font-medium border border-white/5 backdrop-blur-md">
                                        <Calendar className="w-3 h-3" />
                                        Fondée en {new Date(guild.foundedDate).getFullYear()}
                                    </span>
                                )}
                            </motion.div>

                            <motion.h1 variants={fadeIn} className="text-4xl md:text-6xl font-black text-white tracking-tight drop-shadow-xl">
                                {guild.name}
                            </motion.h1>

                            <motion.div variants={fadeIn} className="flex flex-wrap gap-2 pt-1">
                                {guild.activities?.map((activity) => (
                                    <span key={activity} className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-900 rounded-full border border-white/10 text-xs font-medium text-zinc-300">
                                        {ACTIVITY_ICONS[activity] || <Sparkles className="w-3.5 h-3.5" />}
                                        {getActivityLabel(activity)}
                                    </span>
                                ))}
                            </motion.div>
                        </motion.div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <main className="max-w-7xl mx-auto px-6 md:px-8 pb-24 relative z-20">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">

                    {/* Left Column (Main Info) */}
                    <div className="lg:col-span-2 space-y-12">

                        {/* Team Section */}
                        {(guild.founder || (guild.coLeaders?.length ?? 0) > 0 || (guild.team?.length ?? 0) > 0) && (
                            <section className="space-y-6">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-white/5 text-purple-400 border border-white/10">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    État-Major
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Founder Card */}
                                    {guild.founder && (
                                        <div className="md:col-span-2 bg-zinc-900/50 border border-amber-500/20 rounded-xl p-5 flex items-center gap-4 relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 shrink-0">
                                                <Crown className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Fondateur</p>
                                                <p className="text-xl font-bold text-white">{guild.founder}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Co-leaders */}
                                    {(guild.coLeaders ?? []).map((pseudo, idx) => (
                                        <div key={idx} className="bg-zinc-900/30 border border-white/5 rounded-xl p-4 flex items-center gap-3 hover:bg-zinc-900/50 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/10">
                                                <Star className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-zinc-500 uppercase">Co-Leader</p>
                                                <p className="font-medium text-zinc-200">{pseudo}</p>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Team */}
                                    {(guild.team ?? []).map((pseudo, idx) => (
                                        <div key={idx} className="bg-zinc-900/30 border border-white/5 rounded-xl p-4 flex items-center gap-3 hover:bg-zinc-900/50 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/10">
                                                <Shield className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-zinc-500 uppercase">Bras Droit</p>
                                                <p className="font-medium text-zinc-200">{pseudo}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* History / Description */}
                        {guild.history && (
                            <section className="space-y-6">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-white/5 text-indigo-400 border border-white/10">
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    Manifeste
                                </h2>
                                <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-8 leading-relaxed text-zinc-300 text-lg">
                                    <p className="whitespace-pre-wrap">{guild.history}</p>
                                </div>
                            </section>
                        )}

                        {/* Guild Photo */}
                        {guild.photoUrl && (
                            <section className="space-y-6">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-white/5 text-pink-400 border border-white/10">
                                        <ImageIcon className="w-5 h-5" />
                                    </div>
                                    Galerie
                                </h2>
                                <div className="rounded-2xl border border-white/5 overflow-hidden aspect-video relative group">
                                    <Image
                                        src={guild.photoUrl}
                                        alt={`Photo de la guilde ${guild.name}`}
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                                        unoptimized={true}
                                    />
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Right Column (Sidebar - Recruitment) */}
                    <aside className="space-y-8">
                        <div className="sticky top-24 space-y-6">
                            <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl">
                                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <Swords className="w-5 h-5 text-indigo-400" />
                                    Centre de Recrutement
                                </h3>

                                <div className="space-y-6">
                                    {/* Status */}
                                    <div className={`flex items-center justify-between p-4 rounded-xl border ${guild.isRecruiting
                                        ? "bg-emerald-500/5 border-emerald-500/20"
                                        : "bg-red-500/5 border-red-500/20"
                                        }`}>
                                        <span className="text-sm font-medium text-zinc-400">Statut</span>
                                        <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${guild.isRecruiting ? "text-emerald-400" : "text-red-400"
                                            }`}>
                                            <span className={`w-2 h-2 rounded-full ${guild.isRecruiting ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                                            {guild.isRecruiting ? "Ouvert" : "Fermé"}
                                        </span>
                                    </div>

                                    {guild.isRecruiting && (
                                        <>
                                            <div className="grid grid-cols-2 gap-3">
                                                {guild.minLevel && (
                                                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                                                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Niveau Min</p>
                                                        <p className="text-xl font-bold text-white">{guild.minLevel}</p>
                                                    </div>
                                                )}
                                                {guild.minSuccesses && (
                                                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                                                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-1">Succès Min</p>
                                                        <p className="text-xl font-bold text-white">{guild.minSuccesses}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {guild.recruitmentRequirements && (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Pré-requis</p>
                                                    <div className="text-sm text-zinc-300 p-4 bg-white/5 rounded-xl border border-white/5 leading-relaxed">
                                                        {guild.recruitmentRequirements}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {guild.discord && (
                                        <Link href={guild.discord} target="_blank" className="block pt-2">
                                            <Button className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] flex items-center gap-2">
                                                <MessageCircle className="w-5 h-5" />
                                                Rejoindre le Discord
                                            </Button>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}
