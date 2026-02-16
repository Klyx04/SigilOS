"use client";

import {
    LayoutDashboard,
    ShieldCheck,
    Zap,
    Users,
    BarChart3,
    Bot,
    Globe2,
    CalendarCheck
} from "lucide-react";

const FEATURES = [
    {
        title: "Suivi des Missions",
        description: "Suivez l'avancement de vos membres sur l'Ocre, le Vulbis et l'Abyssal en temps réel.",
        icon: LayoutDashboard,
        gradient: "from-blue-500 to-cyan-500"
    },
    {
        title: "Gestion des Rôles",
        description: "Synchronisation automatique des rôles avec Discord. Gestion fine des permissions.",
        icon: ShieldCheck,
        gradient: "from-purple-500 to-pink-500"
    },
    {
        title: "Créateur de Roster",
        description: "Créez des compositions d'équipe optimisées pour les Songes et les donjons.",
        icon: Users,
        gradient: "from-amber-500 to-orange-500",
        isComingSoon: true
    },
    {
        title: "Automatisation OCR",
        description: "Validation automatique des screenshots par IA. Plus de saisie manuelle.",
        icon: Bot,
        gradient: "from-emerald-500 to-green-500",
        isComingSoon: true
    },
    {
        title: "Statistiques",
        description: "Visualisez la croissance de votre guilde avec des graphiques détaillés.",
        icon: BarChart3,
        gradient: "from-indigo-500 to-violet-500"
    },
    {
        title: "Almanax & Événements",
        description: "Planifiez vos sorties en fonction des bonus Almanax et du calendrier.",
        icon: CalendarCheck,
        gradient: "from-rose-500 to-red-500"
    }
];

export function SaasFeatures() {
    return (
        <section className="py-24 bg-zinc-950/50">
            <div className="container px-4 mx-auto">
                <div className="text-center max-w-4xl mx-auto mb-24">
                    <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6 uppercase">
                        Libérez le potentiel de votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-400 to-indigo-400">guilde</span>
                    </h2>
                    <p className="text-zinc-400 text-xl max-w-3xl mx-auto leading-relaxed font-medium">
                        De l&apos;automatisation des missions à la coordination de vos rosters, SigilOS centralise tous les services dont votre guilde a besoin pour dominer le Monde des Douze.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {FEATURES.map((feature, i) => (
                        <div key={i} className="group relative p-10 rounded-[2.5rem] bg-zinc-900/40 border border-white/5 hover:border-white/15 transition-all duration-500 hover:-translate-y-2 shadow-2xl overflow-hidden">
                            {/* Inner Glow/Beam Effect */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-[0.08] transition-opacity duration-700`} />

                            {/* Animated Border Beam (Simulated with scale) */}
                            <div className={`absolute -inset-[1px] bg-gradient-to-r ${feature.gradient} rounded-[2.5rem] opacity-0 group-hover:opacity-30 blur-[1px] transition-opacity duration-500`} />
                            <div className="absolute inset-[1px] bg-zinc-950 rounded-[2.5rem] z-0" />

                            {/* Decorative Corner Glow */}
                            <div className={`absolute -top-12 -right-12 w-24 h-24 bg-gradient-to-br ${feature.gradient} blur-[40px] opacity-0 group-hover:opacity-20 transition-opacity duration-700`} />

                            <div className="relative z-10">
                                <div className="h-16 w-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-2xl shadow-black">
                                    <feature.icon className="w-8 h-8 text-white" />
                                </div>

                                <h3 className="text-2xl font-black text-white mb-4 tracking-tight flex items-center justify-between gap-3">
                                    {feature.title}
                                    {feature.isComingSoon && (
                                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] uppercase tracking-[0.2em] text-zinc-400 font-black whitespace-nowrap">
                                            En cours de développement
                                        </span>
                                    )}
                                </h3>
                                <p className="text-zinc-400 text-lg leading-relaxed font-medium opacity-80 group-hover:opacity-100 transition-opacity">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
