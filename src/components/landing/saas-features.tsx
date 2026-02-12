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
        gradient: "from-amber-500 to-orange-500"
    },
    {
        title: "Automatisation OCR",
        description: "Validation automatique des screenshots par IA. Plus de saisie manuelle.",
        icon: Bot,
        gradient: "from-emerald-500 to-green-500"
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
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-4">
                        Everything you need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">dominate</span>
                    </h2>
                    <p className="text-zinc-400 text-lg">
                        Une suite d'outils complète conçue spécifiquement pour les guildes Dofus exigentes.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {FEATURES.map((feature, i) => (
                        <div key={i} className="group relative p-8 rounded-2xl bg-zinc-900/40 border border-white/5 hover:border-white/10 transition-all hover:bg-zinc-900/60">
                            <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-[0.03] rounded-2xl transition-opacity`} />

                            <div className="h-12 w-12 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                <feature.icon className="w-6 h-6 text-zinc-100" />
                            </div>

                            <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                            <p className="text-zinc-400 leading-relaxed">
                                {feature.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
