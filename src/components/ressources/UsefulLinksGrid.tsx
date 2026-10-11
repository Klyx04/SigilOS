"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
    getResourceCategories,
} from "@/server/actions/resources-actions";

interface ResourceLink {
    id: string;
    title: string;
    description: string | null;
    url: string;
    emoji: string | null;
    isOfficial: boolean;
    order: number;
}

interface ResourceCategory {
    id: string;
    label: string;
    color: string;
    order: number;
    links: ResourceLink[];
}

/**
 * Déslop + gouvernance 10/10/2026 — vitrine **lecture seule** : l'ajout et l'édition
 * (catégories, liens + modales) vivent côté God, plus ici — ni pour les guildes, ni
 * pour le God sur cette page. Aucune RBAC requise pour lire.
 */
export function UsefulLinksGrid({ guildId }: { guildId: string }) {
    const [categories, setCategories] = useState<ResourceCategory[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        refreshData();
    }, [guildId]);

    async function refreshData() {
        setLoading(true);
        const data = await getResourceCategories(guildId);
        setCategories(data as any);
        setLoading(false);
    }

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[400px]">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-64 rounded-2xl bg-surface border border-border animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.map((cat) => (
                    <div
                        key={cat.id}
                        className="relative overflow-hidden rounded-2xl p-5 space-y-3 bg-surface/60 border border-border"
                    >
                        {/* Category header */}
                        <div
                            className="flex items-center justify-between pb-3 border-b border-border"
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-1.5 h-5 rounded-full flex-shrink-0"
                                    style={{ background: cat.color }}
                                />
                                <h3 className="text-caption font-bold uppercase tracking-widest text-muted-foreground">
                                    {cat.label}
                                </h3>
                            </div>
                        </div>

                        {/* Links - Scrollable area */}
                        <div className="space-y-1 relative max-h-[320px] overflow-y-auto pr-2 custom-scrollbar">
                            {cat.links.length === 0 && (
                                <div className="py-10 text-center text-muted-foreground text-caption font-medium tracking-widest uppercase italic">
                                    Aucun lien pour le moment
                                </div>
                            )}
                            {cat.links.map((link) => (
                                <div key={link.id} className="relative group/link-container">
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group/link flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-border-strong hover:bg-elevated transition-colors"
                                        title={link.title}
                                    >
                                        <div
                                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg bg-elevated border border-border overflow-hidden relative"
                                        >
                                            {(() => {
                                                try {
                                                    const hostname = new URL(link.url).hostname;
                                                    return (
                                                        <img
                                                            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=128`}
                                                            alt={link.title}
                                                            className="w-5 h-5 object-contain"
                                                            loading="lazy"
                                                        />
                                                    );
                                                } catch {
                                                    return <span>{link.emoji || "🔗"}</span>;
                                                }
                                            })()}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-semibold text-foreground truncate">
                                                    {link.title}
                                                </span>
                                                {link.isOfficial && (
                                                    <span
                                                        className="text-caption font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full flex-shrink-0 bg-danger/10 text-danger border border-danger/20"
                                                    >
                                                        Officiel
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground leading-tight truncate">{link.description}</p>
                                        </div>

                                        <ExternalLink
                                            className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                                        />
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
