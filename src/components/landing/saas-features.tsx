import {
    Zap,
    Shield,
    Globe,
    BarChart,
    Calendar,
    Target,
    Handshake,
    Sword,
    Sparkles,
    Trophy,
    Layout,
    Activity,
    BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
    {
        title: "Quête Ocre",
        description: "Synchronisation Metamob et matching de doublons automatisé.",
        icon: Target,
        color: "text-accent-teal",
        tags: ["Metamob API", "Anti-doublons"]
    },
    {
        title: "Missions de Guilde",
        description: "Gestion des missions hebdomadaires et validation par capture d’écran.",
        icon: Zap,
        color: "text-amber-400",
        tags: ["OCR Auto", "Discord notifs"]
    },
    {
        title: "Songes Infinis",
        description: "Organisation de parcours avec guides stratégiques intégrés.",
        icon: Sparkles,
        color: "text-purple-400",
        tags: ["LFG intégré", "Suivi de runs"]
    },
    {
        title: "Profil & Annuaire",
        description: "Fiches membres dynamiques et annuaire de guilde.",
        icon: Globe,
        color: "text-blue-400",
        tags: ["Profil public", "Recherche"]
    },
    {
        title: "Administration",
        description: "RBAC granulaire et logs de sécurité.",
        icon: Shield,
        color: "text-rose-400",
        tags: ["Rôles personnalisés", "Audit log"]
    },
    {
        title: "Calendrier",
        description: "Planning des événements communautaires.",
        icon: Calendar,
        color: "text-emerald-400",
        tags: ["Récurrence", "Rappels Discord"]
    },
    {
        title: "Ladder Dofus",
        description: "Classement par succès synchronisé au site officiel.",
        icon: Trophy,
        color: "text-yellow-500",
        tags: ["Sync officielle", "Classement"]
    },
    {
        title: "Services Guilde",
        description: "Demandes de crafts, passages et emprunts d’équipements.",
        icon: Handshake,
        color: "text-cyan-400",
        tags: ["Crafts", "Emprunts"]
    },
    {
        title: "Donjons & Quêtes",
        description: "Plateforme de recherche de groupe intra-guilde.",
        icon: Sword,
        color: "text-red-400",
        tags: ["Groupes", "DJ Finder"]
    },
    {
        title: "Sondages",
        description: "Prises de décisions et votes démocratiques.",
        icon: Activity,
        color: "text-pink-400",
        tags: ["Votes", "Résultats Discord"]
    },
    {
        title: "Vitrine Publique",
        description: "Site de présentation dynamique pour le recrutement.",
        icon: Layout,
        color: "text-indigo-400",
        tags: ["Recrutement", "SEO"]
    },
    {
        title: "Statistiques",
        description: "Analyses de l’évolution de la guilde.",
        icon: BarChart,
        color: "text-accent-gold",
        isDevelopment: true,
        tags: ["En développement"]
    }
];

export function SaasFeatures() {
    return (
        <section id="features" className="py-24 bg-background relative overflow-hidden border-t border-white/5">
            <div className="container px-6 mx-auto">

                {/* Section header */}
                <div className="max-w-2xl mb-14">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-5 font-mono text-[10px] text-emerald-400 uppercase tracking-widest">
                        Fonctionnalités
                    </div>
                    <h2 className="text-3xl font-heading text-white mb-3 leading-snug">
                        L’écosystème pour{" "}
                        <span className="text-accent-gold italic">les guildes sérieuses.</span>
                    </h2>
                    <p className="text-zinc-500 text-sm font-medium font-sans">
                        Tout ce dont vous avez besoin pour dominer votre serveur, rationalisé dans un seul OS.
                    </p>
                </div>

                {/* Uniform 3-column grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {FEATURES.map((feature, idx) => (
                        <div
                            key={idx}
                            className="group relative overflow-hidden rounded-2xl p-6 bg-zinc-900/40 border border-white/5 hover:border-white/10 transition-all duration-300 hover:-translate-y-0.5 hover:bg-zinc-900/60 flex flex-col gap-4"
                        >
                            {/* Top row: icon + dev badge */}
                            <div className="flex items-start justify-between">
                                <div className={cn("p-2.5 rounded-xl bg-white/5 border border-white/5 w-fit group-hover:border-white/10 transition-colors", feature.color)}>
                                    <feature.icon className="w-5 h-5" />
                                </div>
                                {feature.isDevelopment && (
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                                        En développement
                                    </span>
                                )}
                            </div>

                            {/* Content */}
                            <div className="space-y-1.5">
                                <h3 className="text-sm font-bold text-white tracking-tight">{feature.title}</h3>
                                <p className="text-zinc-500 text-xs leading-relaxed font-medium font-sans">
                                    {feature.description}
                                </p>
                            </div>

                            {/* Tags */}
                            {feature.tags && feature.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                                    {feature.tags.map((tag) => (
                                        <span key={tag} className="text-[10px] font-medium text-zinc-600 bg-white/[0.03] border border-white/5 px-2 py-0.5 rounded-full">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Hover glow */}
                            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/[0.02] blur-[40px] rounded-full group-hover:bg-white/[0.04] transition-colors pointer-events-none" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
