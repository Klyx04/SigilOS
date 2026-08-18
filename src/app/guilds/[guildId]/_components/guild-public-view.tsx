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
    Star,
    LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AVAILABLE_ACTIVITIES } from "@/lib/presentation-constants";
import type { GuildPresentation } from "@/server/actions/presentation-actions";
import { AuroraBackground } from "@/components/ui/aurora-background";
import { GlassPanel } from "@/components/ui/glass-panel";
import { BorderBeam } from "@/components/ui/border-beam";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import type { User } from "next-auth";

// Activity icons mapping
const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
    "economie": <Coins className="w-4 h-4" />,
    "pvm": <Swords className="w-4 h-4" />,
    "roleplay": <Theater className="w-4 h-4" />,
    "kolizeum": <Target className="w-4 h-4" />,
    "percepteur": <Shield className="w-4 h-4" />,
    "raids": <Swords className="w-4 h-4" />,
};

const getActivityLabel = (id: string) => {
    const activity = AVAILABLE_ACTIVITIES.find(a => a.id === id);
    return activity?.label || id;
};

type Props = {
    guild: GuildPresentation;
    foundedYear: number;
    isMember?: boolean;
    /** #142 — session utilisateur : le header public affiche le profil connecté au lieu du bouton « Connexion ». */
    user?: User;
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

export function GuildPublicView({ guild, foundedYear, isMember, user }: Props) {
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
        <div className="relative min-h-screen bg-background text-foreground selection:bg-accent-teal/30 font-sans flex flex-col overflow-x-hidden">
            {/* Ambient Background Layer (2026 Standard) - Fixed container prevents double scrollbar from Aurora's -inset overflow */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="w-full h-full opacity-5 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.03),transparent_70%)]" />
                <AuroraBackground className="w-full h-full opacity-5 saturate-100 blur-3xl scale-125" />
            </div>

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
                        <div className="absolute inset-0 bg-background" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
                </motion.div>
            </div>

            {/* Sticky Header Nav (Consistent with Directory) */}
            <PublicHeader backHref="/guilds" backLabel="Annuaire" isMember={isMember} user={user} />

            {/* Guild Header Content (Overlapping Hero) — le badge membre est intégré
                ici (1er bloc du conteneur) pour ne plus empiéter sur la présentation (#83). */}
            <div className="relative z-20 -mt-32 md:-mt-40 max-w-7xl mx-auto px-6 md:px-8 pb-12">
                {isMember && (
                    <div className="mb-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-success/10 border border-success/30 backdrop-blur-md">
                            <div className="flex items-center gap-3">
                                <span className="relative flex h-2.5 w-2.5 shrink-0">
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
                                </span>
                                <p className="text-sm font-semibold text-success">
                                    Vous êtes membre de cette guilde
                                </p>
                            </div>
                            <Link href={`/dashboard/${guild.discordGuildId}`}>
                                <Button className="h-9 px-4 bg-success hover:bg-success text-success-foreground font-bold text-sm rounded-lg transition-colors flex items-center gap-2">
                                    <LayoutDashboard className="w-4 h-4" />
                                    Ouvrir le Dashboard
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}
                <div className="flex flex-col md:flex-row items-end gap-8">
                    {/* Guild Icon */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        className="relative w-32 h-32 md:w-48 md:h-48 rounded-3xl bg-surface border-4 border-background shadow-2xl overflow-hidden shrink-0"
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
                            <div className="w-full h-full flex items-center justify-center text-4xl bg-elevated text-muted-foreground">
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
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-elevated text-foreground text-xs font-bold uppercase tracking-wider border border-border backdrop-blur-md">
                                        <Server className="w-3 h-3" />
                                        {guild.server}
                                    </span>
                                )}
                                {guild.foundedDate && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-surface/50 text-muted-foreground text-xs font-medium border border-border backdrop-blur-md">
                                        <Calendar className="w-3 h-3" />
                                        Fondée le {new Date(guild.foundedDate).toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </span>
                                )}
                            </motion.div>

                            <motion.h1 variants={fadeIn} className="text-4xl md:text-6xl font-black text-foreground tracking-tight drop-shadow-xl">
                                {guild.name}
                            </motion.h1>

                            <motion.div variants={fadeIn} className="flex flex-wrap gap-2 pt-1">
                                {guild.activities?.map((activity) => (
                                    <span key={activity} className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface rounded-full border border-border text-xs font-medium text-foreground">
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
                                <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-surface text-info border border-border">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    État-Major
                                </h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Founder Card */}
                                    {guild.founder && (
                                        <div className="md:col-span-2 bg-surface/50 border border-warning/20 rounded-xl p-5 flex items-center gap-4 relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-gradient-to-r from-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center border border-warning/20 text-warning shrink-0">
                                                <Crown className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <p className="text-caption font-bold text-warning uppercase tracking-widest">Fondateur</p>
                                                <p className="text-xl font-bold text-foreground">{guild.founder}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Co-leaders */}
                                    {(guild.coLeaders ?? []).map((pseudo, idx) => (
                                        <div key={idx} className="bg-surface/30 border border-border rounded-xl p-4 flex items-center gap-3 hover:bg-surface/50 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 border border-yellow-500/10">
                                                <Star className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-caption font-bold text-muted-foreground uppercase">Co-Leader</p>
                                                <p className="font-medium text-foreground">{pseudo}</p>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Team */}
                                    {(guild.team ?? []).map((pseudo, idx) => (
                                        <div key={idx} className="bg-surface/30 border border-border rounded-xl p-4 flex items-center gap-3 hover:bg-surface/50 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-info/10 flex items-center justify-center text-info border border-info/10">
                                                <Shield className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <p className="text-caption font-bold text-muted-foreground uppercase">Bras Droit</p>
                                                <p className="font-medium text-foreground">{pseudo}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* History / Description */}
                        {guild.history && (
                            <section className="space-y-6">
                                <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-surface text-info border border-border">
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    Manifeste
                                </h2>
                                <div className="bg-surface/30 border border-border rounded-2xl p-8 leading-relaxed text-foreground text-lg">
                                    <p className="whitespace-pre-wrap break-words">{guild.history}</p>
                                </div>
                            </section>
                        )}

                        {/* Guild Photo */}
                        {guild.photoUrl && (
                            <section className="space-y-6">
                                <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-surface text-pink-400 border border-border">
                                        <ImageIcon className="w-5 h-5" />
                                    </div>
                                    Galerie
                                </h2>
                                <div className="rounded-2xl border border-border overflow-hidden aspect-video relative group">
                                    <Image
                                        src={guild.photoUrl}
                                        alt={`Photo de la guilde ${guild.name}`}
                                        fill
                                        className="object-cover transition-transform duration-300 group-"
                                        unoptimized={true}
                                    />
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Right Column (Sidebar - Recruitment) */}
                    <aside className="space-y-8">
                        <div className="sticky top-24 space-y-6">
                            <div className="bg-surface/80 backdrop-blur-md border border-border rounded-2xl p-6 shadow-xl">
                                <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                                    <Swords className="w-5 h-5 text-info" />
                                    Centre de Recrutement
                                </h3>

                                <div className="space-y-6">
                                    {/* Founded Date */}
                                    {guild.foundedDate && (
                                        <div className="flex items-center justify-between p-4 rounded-xl border bg-warning/5 border-warning/20">
                                            <span className="text-sm font-medium text-muted-foreground">Fondation</span>
                                            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-warning">
                                                <Calendar className="w-4 h-4" />
                                                {new Date(guild.foundedDate).toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </span>
                                        </div>
                                    )}

                                    {/* Member Count */}
                                    {guild.memberCount !== null && guild.memberCount !== undefined && (
                                        <div className="flex items-center justify-between p-4 rounded-xl border bg-info/5 border-info/20">
                                            <span className="text-sm font-medium text-muted-foreground">Membres</span>
                                            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-info">
                                                <Users className="w-4 h-4" />
                                                {guild.memberCount} / 350
                                            </span>
                                        </div>
                                    )}

                                    {/* Status */}
                                    <div className={`flex items-center justify-between p-4 rounded-xl border ${guild.isRecruiting
                                        ? "bg-success/5 border-success/20"
                                        : "bg-danger/5 border-danger/20"
                                        }`}>
                                        <span className="text-sm font-medium text-muted-foreground">Statut</span>
                                        <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${guild.isRecruiting ? "text-success" : "text-danger"
                                            }`}>
                                            <span className={`w-2 h-2 rounded-full ${guild.isRecruiting ? "bg-success animate-pulse" : "bg-danger"}`} />
                                            {guild.isRecruiting ? "Ouvert" : "Fermé"}
                                        </span>
                                    </div>

                                    {guild.isRecruiting && (
                                        <>
                                            <div className="grid grid-cols-2 gap-3">
                                                {guild.minLevel && (
                                                    <div className="p-3 bg-surface rounded-xl border border-border text-center">
                                                        <p className="text-caption text-muted-foreground uppercase tracking-wider font-bold mb-1">Niveau Min</p>
                                                        <p className="text-xl font-bold text-foreground">{guild.minLevel}</p>
                                                    </div>
                                                )}
                                                {guild.minSuccesses && (
                                                    <div className="p-3 bg-surface rounded-xl border border-border text-center">
                                                        <p className="text-caption text-muted-foreground uppercase tracking-wider font-bold mb-1">Succès Min</p>
                                                        <p className="text-xl font-bold text-foreground">{guild.minSuccesses}</p>
                                                    </div>
                                                )}
                                            </div>

                                            {guild.recruitmentRequirements && (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pré-requis</p>
                                                    <div className="text-sm text-foreground p-4 bg-surface rounded-xl border border-border leading-relaxed">
                                                        {guild.recruitmentRequirements}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {guild.discord && (
                                        <Link href={guild.discord} target="_blank" className="block pt-2">
                                            <Button className="w-full h-12 bg-info hover:bg-info text-info-foreground font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] flex items-center gap-2">
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

            <GalacticFooter isMember={isMember} />
        </div>
    );
}
