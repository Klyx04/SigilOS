"use client";
import {
    Zap,
    Calendar,
    Target,
    Sparkles,
    Trophy,
    Gamepad2,
    Map as MapIcon,
    BarChart3,
    Library,
    Network,
    ShieldAlert,
    ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const FEATURES = [
    {
        title: "Missions de Guilde",
        description: "Gérez et suivez les objectifs hebdomadaires de vos membres. Un cockpit centralisé pour coordonner l'effort collectif et booster votre progression.",
        icon: Target,
        color: "text-emerald-400",
        className: "lg:col-span-2",
        tags: ["Gestion", "Tracking"]
    },
    {
        title: "Calendrier & Coordination",
        description: "Synchronisez vos sorties donjons, percepteurs et sessions XP. Planification intelligente pour maximiser la participation.",
        icon: Calendar,
        color: "text-amber-400",
        className: "lg:col-span-1",
        tags: ["Raids", "Events"]
    },
    {
        title: "Map Interactive V2",
        description: "Navigation HD avec recherche de zones, positions d'avis de recherche et switch de mondes (Enutrosor, Srambad...).",
        icon: MapIcon,
        color: "text-cyan-400",
        className: "lg:col-span-1",
        tags: ["Navigation HD"]
    },
    {
        title: "Encyclopédie & Ressources",
        description: "Accès instantané aux monstres, items et ressources. Intégration Almanax et flux d'actualités communautaires.",
        icon: Library,
        color: "text-indigo-400",
        className: "lg:col-span-2",
        tags: ["Data Explorer", "Almanax"]
    },
    {
        title: "Chasse aux Avis & Archis",
        description: "Tracker collaboratif pour les avis de recherche et archimonstres. Partagez les positions et optimisez vos captures.",
        icon: ShieldAlert,
        color: "text-rose-500",
        className: "lg:col-span-1",
        tags: ["Tracking", "Bounties"]
    },
    {
        title: "Quête Ocre (Metamob)",
        description: "Synchronisation bidirectionnelle avec Metamob. Matching automatique des doublons pour faciliter les échanges.",
        icon: Sparkles,
        color: "text-blue-400",
        className: "lg:col-span-1",
        tags: ["Metamob Sync"]
    },
    {
        title: "Mini-Jeux de Guilde",
        description: "Divertissez vos membres avec le SigilGuesser et d'autres activités ludiques intégrées au dashboard.",
        icon: Gamepad2,
        color: "text-amber-500",
        className: "lg:col-span-1",
        tags: ["Engagement"]
    },
    {
        title: "GPS Narratif (Bêta)",
        description: "Visualisez vos séries de quêtes sous forme de graphes dynamiques. Ne perdez plus jamais le fil de votre progression.",
        icon: Network,
        color: "text-emerald-400",
        className: "lg:col-span-1",
        tags: ["Graph", "Quêtes"]
    },
    {
        title: "Bot Discord & Alertes",
        description: "Notifications push, commandes slash avancées et monitoring de guilde directement sur votre serveur Discord.",
        icon: Zap,
        color: "text-yellow-400",
        className: "lg:col-span-1",
        tags: ["Integrations"]
    },
    {
        title: "Gouvernance & Votes",
        description: "Prenez des décisions démocratiques pour votre guilde via un système de sondages et de votes sécurisés.",
        icon: BarChart3,
        color: "text-orange-400",
        className: "lg:col-span-1",
        tags: ["Sondages"]
    },
    {
        title: "Ladder & Annuaire",
        description: "Mise en avant de vos succès et vitrine de recrutement premium pour attirer les meilleurs joueurs.",
        icon: Trophy,
        color: "text-emerald-500",
        className: "lg:col-span-2",
        tags: ["Ranking", "Recrutement"]
    }
];

export function SaasFeatures() {
    return (
        <section id="features" className="py-32 bg-background relative overflow-hidden">
            
            {/* Background elements */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5  rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-amber-500/5  rounded-full pointer-events-none" />

            <div className="container px-6 mx-auto relative z-10">

                {/* Section header */}
                <div className="max-w-3xl mb-20">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6 font-mono text-[11px] text-emerald-400 uppercase tracking-wider"
                    >
                        Le Cockpit Ultime
                    </motion.div>
                    <motion.h2 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-5xl font-heading text-white mb-6 leading-tight"
                    >
                        Pensé pour la <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-amber-200">performance</span>, <br />
                        conçu pour le <span className="italic text-white/90">confort.</span>
                    </motion.h2>
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="text-zinc-500 text-lg font-medium max-w-2xl"
                    >
                        Oubliez la gestion manuelle. SigilOS automatise les tâches ingrates pour vous laisser vous concentrer sur ce qui compte : le jeu.
                    </motion.p>
                </div>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {FEATURES.map((feature, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.05 }}
                            className={cn(
                                "group relative overflow-hidden rounded-3xl p-8 bg-zinc-900/40 border border-white/5 hover:border-emerald-500/20 transition-all duration-150 hover:bg-zinc-900/60 flex flex-col gap-6",
                                feature.className
                            )}
                        >
                            {/* Icon & Glow */}
                            <div className="flex items-start justify-between">
                                <div className={cn("p-4 rounded-2xl bg-white/5 border border-white/5 group-hover:scale-110 transition-transform duration-150", feature.color)}>
                                    <feature.icon className="w-6 h-6" />
                                </div>
                                
                                {/* Subtle arrow on hover */}
                                <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                                    <ChevronRight className="w-5 h-5 text-zinc-600" />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="space-y-3">
                                <h3 className="text-xl font-bold text-white tracking-tight">{feature.title}</h3>
                                <p className="text-zinc-500 text-sm leading-relaxed font-medium">
                                    {feature.description}
                                </p>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2 mt-auto">
                                {feature.tags.map((tag) => (
                                    <span key={tag} className="text-[11px] font-bold text-zinc-400 bg-white/5 border border-white/5 px-3 py-1 rounded-full uppercase tracking-wider">
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            {/* Interactive Background Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-transparent to-transparent group-hover:from-emerald-500/5 transition-all duration-150 pointer-events-none" />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
