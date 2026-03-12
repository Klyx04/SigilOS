"use client";
import {
    Zap,
    Shield,
    Calendar,
    Target,
    Sparkles,
    Trophy,
    Layout,
    Activity,
    ChevronRight,
    Gamepad2,
    Map as MapIcon,
    BarChart3,
    Library,
    Compass,
    Network
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const FEATURES = [
    {
        title: "Missions de Guilde & OCR",
        description: "Gestion des missions hebdomadaires avec validation par capture d'écran via IA.",
        icon: Target,
        color: "text-emerald-400",
        className: "lg:col-span-2",
        tags: ["OCR Auto", "Validation IA"]
    },
    {
        title: "Calendrier & Raids",
        description: "Planifiez vos sorties donjons, percepteurs et sessions XP communautaires.",
        icon: Calendar,
        color: "text-amber-400",
        className: "lg:col-span-1",
        tags: ["Coordination"]
    },
    {
        title: "Quête Ocre (Metamob)",
        description: "Synchronisation Metamob et matching de doublons automatisé entre membres.",
        icon: Sparkles,
        color: "text-blue-400",
        className: "lg:col-span-1",
        tags: ["Metamob API"]
    },
    {
        title: "Module Ressources & Actus",
        description: "Encyclopédie, Almanax, flux Streamers et actus Ankama centralisés.",
        icon: Library,
        color: "text-indigo-400",
        className: "lg:col-span-2",
        tags: ["Encyclopédie", "Almanax"]
    },
    {
        title: "Mini-Jeux Sigil",
        description: "Animez votre guilde avec SigilGuesser, Skribbl et d'autres jeux exclusifs.",
        icon: Gamepad2,
        color: "text-rose-400",
        className: "lg:col-span-1",
        tags: ["Divertissement"]
    },
    {
        title: "Map Interactive V2",
        description: "Explorez le Monde des Douze avec recherche avancée et switch de monde.",
        icon: MapIcon,
        color: "text-cyan-400",
        className: "lg:col-span-1",
        tags: ["Navigation"]
    },
    {
        title: "Songes Infinis",
        description: "Optimisez vos runs de songes et suivez l'évolution de vos services.",
        icon: Compass,
        color: "text-fuchsia-400",
        className: "lg:col-span-1",
        tags: ["Stratégies"]
    },
    {
        title: "GPS Narratif (Bêta)",
        description: "Graphe de quêtes dynamique et UI neuronale pour tracker vos séries de quêtes.",
        icon: Network,
        color: "text-emerald-400",
        className: "lg:col-span-1",
        tags: ["Graph", "Quêtes"]
    },
    {
        title: "Sondages & Vote",
        description: "Prenez des décisions collectives avec des sondages intégrés au dashboard.",
        icon: BarChart3,
        color: "text-orange-400",
        className: "lg:col-span-1",
        tags: ["Gouvernance"]
    },
    {
        title: "Bot Discord & Alertes",
        description: "Notifications intelligentes, commandes slash et alertes temps réel.",
        icon: Zap,
        color: "text-amber-400",
        className: "lg:col-span-1",
        tags: ["Intégration Pro"]
    },
    {
        title: "Ladder & Annuaire",
        description: "Ladder succès temps réel et vitrine premium pour booster vos recrutements.",
        icon: Trophy,
        color: "text-emerald-500",
        className: "lg:col-span-2",
        tags: ["Recrutement"]
    }
];

export function SaasFeatures() {
    return (
        <section id="features" className="py-32 bg-background relative overflow-hidden">
            
            {/* Background elements */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-amber-500/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="container px-6 mx-auto relative z-10">

                {/* Section header */}
                <div className="max-w-3xl mb-20">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6 font-mono text-[10px] text-emerald-400 uppercase tracking-widest"
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
                                "group relative overflow-hidden rounded-3xl p-8 bg-zinc-900/40 border border-white/5 hover:border-emerald-500/20 transition-all duration-500 hover:bg-zinc-900/60 flex flex-col gap-6",
                                feature.className
                            )}
                        >
                            {/* Icon & Glow */}
                            <div className="flex items-start justify-between">
                                <div className={cn("p-4 rounded-2xl bg-white/5 border border-white/5 group-hover:scale-110 transition-transform duration-500", feature.color)}>
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
                                    <span key={tag} className="text-[10px] font-bold text-zinc-400 bg-white/5 border border-white/5 px-3 py-1 rounded-full uppercase tracking-wider">
                                        {tag}
                                    </span>
                                ))}
                            </div>

                            {/* Interactive Background Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-transparent to-transparent group-hover:from-emerald-500/5 transition-all duration-500 pointer-events-none" />
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
