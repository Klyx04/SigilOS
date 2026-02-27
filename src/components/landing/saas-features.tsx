import Image from "next/image";
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
        className: "md:col-span-2 md:row-span-1 bg-gradient-to-br from-[#13171A] to-[#0E1110] border-accent-teal/20",
        color: "text-accent-teal"
    },
    {
        title: "Missions de Guilde",
        description: "Gestion des missions hebdomadaires et validation par capture d'écran.",
        icon: Zap,
        className: "md:col-span-2",
        color: "text-amber-400"
    },
    {
        title: "Songes Infinis",
        description: "Organisation de parcours avec guides stratégiques intégrés.",
        icon: Sparkles,
        className: "md:col-span-2",
        color: "text-purple-400"
    },
    {
        title: "Profil & Annuaire",
        description: "Fiches membres dynamiques et annuaire de guilde.",
        icon: Globe,
        className: "md:col-span-1",
        color: "text-blue-400"
    },
    {
        title: "Administration",
        description: "RBAC granulaire et logs de sécurité.",
        icon: Shield,
        className: "md:col-span-1",
        color: "text-rose-400"
    },
    {
        title: "Calendrier",
        description: "Planning des événements communautaires.",
        icon: Calendar,
        className: "md:col-span-1",
        color: "text-emerald-400"
    },
    {
        title: "Ladder Dofus",
        description: "Classement par succès synchronisé au site officiel.",
        icon: Trophy,
        className: "md:col-span-1",
        color: "text-yellow-500"
    },
    {
        title: "Services Guilde",
        description: "Demandes de crafts, passages et emprunts d'équipements.",
        icon: Handshake,
        className: "md:col-span-1",
        color: "text-cyan-400"
    },
    {
        title: "Donjons & Quêtes",
        description: "Plateforme de recherche de groupe intra-guilde.",
        icon: Sword,
        className: "md:col-span-1",
        color: "text-red-400"
    },
    {
        title: "Sondages",
        description: "Prises de décisions et votes démocratiques.",
        icon: Activity,
        className: "md:col-span-1",
        color: "text-pink-400"
    },
    {
        title: "Documentation",
        description: "Wiki collaboratif hébergé dans l'écosystème.",
        icon: BookOpen,
        className: "md:col-span-1",
        color: "text-violet-400"
    },
    {
        title: "Vitrine Publique",
        description: "Site de présentation dynamique pour le recrutement.",
        icon: Layout,
        className: "md:col-span-1",
        color: "text-indigo-400"
    },
    {
        title: "Quêtes Dofus",
        description: "Suivi coordonné de la progression neuronale des quêtes.",
        icon: BookOpen,
        className: "md:col-span-1",
        color: "text-amber-400",
        isDevelopment: true
    },
    {
        title: "Carte & Mini-Jeux",
        description: "Map du monde interactive et animations de guilde.",
        icon: Globe,
        className: "md:col-span-1",
        color: "text-cyan-400",
        isDevelopment: true
    },
    {
        title: "Hub Ressources",
        description: "Agrégation de guides, builds et actualités Dofus.",
        icon: BookOpen,
        className: "md:col-span-1",
        color: "text-violet-400",
        isDevelopment: true
    },
    {
        title: "Statistiques",
        description: "Analyses de l'évolution de la guilde.",
        icon: BarChart,
        className: "md:col-span-1",
        color: "text-accent-gold",
        isDevelopment: true
    }
];

export function SaasFeatures() {
    return (
        <section className="py-24 bg-background relative overflow-hidden border-t border-white/5">
            <div className="container px-6 mx-auto">
                <div className="max-w-2xl mb-16 px-4">
                    <h2 className="text-4xl font-heading text-white mb-4">L'écosystème pour <br /><span className="text-accent-gold italic">les guildes sérieuses.</span></h2>
                    <p className="text-zinc-500 font-medium font-sans">Tout ce dont vous avez besoin pour dominer votre serveur, rationalisé dans un seul OS.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {FEATURES.map((feature, idx) => (
                        <div
                            key={idx}
                            className={cn(
                                "group relative overflow-hidden rounded-[2rem] p-8 glass-premium border border-white/5 transition-all duration-500 hover:-translate-y-1 flex flex-col justify-between",
                                feature.className
                            )}
                        >
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div className={cn("p-4 rounded-2xl bg-white/5 border border-white/5 w-fit transition-all group-hover:scale-110", feature.color)}>
                                        <feature.icon className="w-8 h-8" />
                                    </div>
                                    {feature.isDevelopment && (
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                                            En développement
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-xl font-heading text-white mb-3 tracking-tight">{feature.title}</h3>
                                <p className="text-zinc-500 text-sm leading-relaxed font-medium font-sans max-w-[200px] relative z-20">
                                    {feature.description}
                                </p>
                            </div>

                            {/* Ocre Dofus Image for the specific card */}
                            {feature.title === "Quête Ocre" && (
                                <div className="absolute top-1/2 right-4 -translate-y-1/2 w-44 h-44 opacity-40 group-hover:opacity-80 group-hover:scale-110 transition-all duration-700 pointer-events-none">
                                    <Image
                                        src="/assets/icons/ocre.png"
                                        alt="Dofus Ocre"
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                            )}

                            {/* Mission Preview Image */}
                            {feature.title === "Missions de Guilde" && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-80 h-48 opacity-20 group-hover:opacity-60 group-hover:-translate-x-4 transition-all duration-700 pointer-events-none rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 rotate-3">
                                    <Image
                                        src="/assets/landing/mission-preview.png"
                                        alt="Missions Preview"
                                        fill
                                        className="object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#0a0a0b]/90" />
                                </div>
                            )}

                            {/* Songes Preview Image */}
                            {feature.title === "Songes Infinis" && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-80 h-48 opacity-20 group-hover:opacity-60 group-hover:-translate-x-4 transition-all duration-700 pointer-events-none rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10 -rotate-2">
                                    <Image
                                        src="/assets/landing/songes-preview.png"
                                        alt="Songes Preview"
                                        fill
                                        className="object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#0a0a0b]/90" />
                                </div>
                            )}

                            {/* Decorative background glow */}
                            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 blur-[50px] rounded-full group-hover:bg-white/10 transition-colors pointer-events-none" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
