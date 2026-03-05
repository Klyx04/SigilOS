"use client";

import { ExternalLink } from "lucide-react";

interface UsefulLink {
    title: string;
    desc: string;
    url: string;
    emoji: string;
    isOfficial?: boolean;
}

interface UsefulLinksCategory {
    label: string;
    color: string;
    links: UsefulLink[];
}

const CATEGORIES: UsefulLinksCategory[] = [
    {
        label: "Référence & Quêtes",
        color: "#10b981",
        links: [
            {
                title: "Dofus Pour Les Noobs",
                desc: "Le wiki ultime pour toutes les quêtes et donjons",
                url: "https://www.dofuspourlesnoobs.com",
                emoji: "📖",
            },
            {
                title: "Metamob",
                desc: "Outil indispensable pour l'Éternelle Moisson (Ocre)",
                url: "https://www.metamob.fr/",
                emoji: "🐙",
            },
            {
                title: "Barbofus",
                desc: "Aides, quêtes et outils pratiques",
                url: "https://barbofus.com/",
                emoji: "🧔",
            },
            {
                title: "Dofensive",
                desc: "Sorts, IA et résistances précises de chaque monstre",
                url: "https://dofensive.com",
                emoji: "🛡️",
            },
            {
                title: "Ganymède",
                desc: "Application d'outils et gestion de personnages",
                url: "https://ganymede-app.com/about",
                emoji: "🦅",
            },
        ],
    },
    {
        label: "Builds & Solveurs",
        color: "#a855f7",
        links: [
            {
                title: "DofusRoom & Insight",
                desc: "Calculateur de builds avancé et statistiques PvP",
                url: "https://www.dofusroom.com/insightroom",
                emoji: "📈",
            },
            {
                title: "DofusBook",
                desc: "Simulateur d'équipement et de stuff complet",
                url: "https://www.dofusbook.net",
                emoji: "⚔️",
            },
            {
                title: "Comte Harebourg",
                desc: "Solveurs tactiques et mini-jeux Dofus",
                url: "https://www.comteharebourg.com/",
                emoji: "🦉",
            },
        ],
    },
    {
        label: "Économie & Métiers",
        color: "#f59e0b",
        links: [
            {
                title: "Huzounet",
                desc: "Outils de forgemagie, rentabilité et élevage",
                url: "https://huzounet.fr/",
                emoji: "🔨",
            },
            {
                title: "Dofus-Map",
                desc: "Carte interactive des nœuds de récolte par métier",
                url: "https://dofus-map.com",
                emoji: "🗺️",
            },
            {
                title: "XP Familiers",
                desc: "Tableau détaillé de l'expérience des familiers",
                url: "https://www.dofustool.com/tableau-xp-familier-dofus/",
                emoji: "🐾",
            },
            {
                title: "DofusDB",
                desc: "Base complète pour objets, monstres, recettes",
                url: "https://dofusdb.fr/",
                emoji: "📚",
            },
        ],
    },
    {
        label: "Officiel Ankama",
        color: "#ef4444",
        links: [
            {
                title: "Site Officiel Dofus",
                desc: "Portail officiel du jeu et de la communauté",
                url: "https://www.dofus.com/fr",
                emoji: "🌐",
                isOfficial: true,
            },
            {
                title: "Ankama Forum (Discord)",
                desc: "Rejoins le Discord officiel Dofus pour les annonces",
                url: "https://discord.gg/dofus",
                emoji: "💬",
                isOfficial: true,
            },
        ],
    },
];

export function UsefulLinksGrid() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CATEGORIES.map((cat) => (
                <div
                    key={cat.label}
                    className="relative overflow-hidden rounded-2xl p-5 space-y-3 group"
                    style={{
                        background: "linear-gradient(135deg, rgba(19,23,26,0.8), rgba(14,17,16,0.6))",
                        border: `1px solid ${cat.color}18`,
                        backdropFilter: "blur(20px)",
                    }}
                >
                    {/* Ambient glow */}
                    <div
                        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-5 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none"
                        style={{ background: cat.color, transform: "translate(30%, -30%)" }}
                    />

                    {/* Category header */}
                    <div
                        className="flex items-center gap-3 pb-3"
                        style={{ borderBottom: `1px solid ${cat.color}12` }}
                    >
                        <div
                            className="w-1.5 h-5 rounded-full flex-shrink-0"
                            style={{ background: cat.color, boxShadow: `0 0 8px ${cat.color}80` }}
                        />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                            {cat.label}
                        </h3>
                    </div>

                    {/* Links */}
                    <div className="space-y-1 relative">
                        {cat.links.map((link) => (
                            <a
                                key={link.url}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group/link flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200"
                                style={{
                                    border: "1px solid transparent",
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = `${cat.color}08`;
                                    (e.currentTarget as HTMLElement).style.borderColor = `${cat.color}18`;
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = "transparent";
                                    (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                                }}
                            >
                                <div
                                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg transition-transform duration-200 group-hover/link:scale-110"
                                    style={{ background: `${cat.color}10`, border: `1px solid ${cat.color}20` }}
                                >
                                    {link.emoji}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-white group-hover/link:text-white/90 transition-colors truncate">
                                            {link.title}
                                        </span>
                                        {link.isOfficial && (
                                            <span
                                                className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full flex-shrink-0"
                                                style={{
                                                    background: "rgba(239,68,68,0.12)",
                                                    color: "#ef4444",
                                                    border: "1px solid rgba(239,68,68,0.2)",
                                                }}
                                            >
                                                Officiel
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500 leading-tight truncate">{link.desc}</p>
                                </div>

                                <ExternalLink
                                    className="h-3.5 w-3.5 flex-shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity duration-200"
                                    style={{ color: cat.color }}
                                />
                            </a>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
