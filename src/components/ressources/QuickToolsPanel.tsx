"use client";

import { ExternalLink } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tool {
    title: string;
    emoji: string;
    url: string;
    desc: string;
    badge?: string;
}

interface ToolSection {
    label: string;
    color: string;
    tools: Tool[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SECTIONS: ToolSection[] = [
    {
        label: "📜 Quêtes",
        color: "#f59e0b",
        tools: [
            {
                title: "DPNL",
                emoji: "📖",
                url: "https://www.dofuspourlesnoobs.com",
                desc: "Le site #1 pour les guides de quêtes",
                badge: "Incontournable",
            },
            {
                title: "DofusDB",
                emoji: "🔍",
                url: "https://www.dofusdb.fr",
                desc: "Chercher une quête précise, un PNJ, un objet",
            },
            {
                title: "Almanax Tracker",
                emoji: "📅",
                url: "https://www.krosmoz.com/fr/almanax",
                desc: "Calendrier Almanax officiel Ankama",
            },
        ],
    },
    {
        label: "⚔️ Combat & Builds",
        color: "#ef4444",
        tools: [
            {
                title: "Dofensive",
                emoji: "🛡️",
                url: "https://dofensive.com",
                desc: "Sorts et résistances précises par monstre",
            },
            {
                title: "DofusBook",
                emoji: "📗",
                url: "https://www.dofusbook.net",
                desc: "Simulateur d'équipement complet",
            },
            {
                title: "DofusRoom",
                emoji: "🏠",
                url: "https://www.dofusroom.com",
                desc: "Calculateur de builds et stats",
            },
        ],
    },
    {
        label: "🌍 Navigation & Éco",
        color: "#10b981",
        tools: [
            {
                title: "Dofus-Map",
                emoji: "🗺️",
                url: "https://dofus-map.com",
                desc: "Nœuds de récolte, monstres par zone",
            },
            {
                title: "Encyclopédie",
                emoji: "📚",
                url: "https://www.dofus.com/fr/mmorpg/encyclopedia",
                desc: "Base officielle objets & crafts",
                badge: "Officiel",
            },
        ],
    },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickToolsPanel() {
    return (
        <div
            className="h-full flex flex-col rounded-2xl overflow-hidden"
            style={{
                background: "linear-gradient(160deg, #0f1114 0%, #0a0d0a 100%)",
                border: "1px solid rgba(255,255,255,0.06)",
            }}
        >
            {/* Header */}
            <div className="px-4 py-3.5 flex items-center gap-2.5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                <h3 className="text-caption font-black uppercase tracking-widest text-muted-foreground">
                    Outils Rapides
                </h3>
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto divide-y divide-border" style={{ maxHeight: 460 }}>
                {SECTIONS.map((section) => (
                    <div key={section.label} className="px-3 py-3 space-y-1">
                        {/* Section label */}
                        <div className="text-caption font-black uppercase tracking-widest mb-2 px-1"
                            style={{ color: section.color }}>
                            {section.label}
                        </div>

                        {/* Tools */}
                        {section.tools.map((tool) => (
                            <a
                                key={tool.url}
                                href={tool.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all duration-200 cursor-pointer"
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = `${section.color}08`;
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = "transparent";
                                }}
                            >
                                {/* Emoji icon */}
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base transition-transform duration-200 group-"
                                    style={{ background: `${section.color}12`, border: `1px solid ${section.color}20` }}
                                >
                                    {tool.emoji}
                                </div>

                                {/* Text */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-foreground group-hover:opacity-80 transition-opacity">
                                            {tool.title}
                                        </span>
                                        {tool.badge && (
                                            <span
                                                className="text-caption font-black uppercase tracking-widest px-1 py-0.5 rounded"
                                                style={
                                                    tool.badge === "Officiel"
                                                        ? { background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }
                                                        : { background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }
                                                }
                                            >
                                                {tool.badge}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-caption text-muted-foreground leading-tight truncate">{tool.desc}</p>
                                </div>

                                <ExternalLink
                                    className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
                                    style={{ color: section.color }}
                                />
                            </a>
                        ))}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 text-caption text-muted-foreground font-medium"
                style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                Voir tous les sites ↓
            </div>
        </div>
    );
}
