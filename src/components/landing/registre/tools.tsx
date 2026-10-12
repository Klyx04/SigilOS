"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

export function LandingTools() {
    const { t } = useI18n();

    const localizedTools = [
        {
            name: t.landing.toolsCards.rushTitle,
            gain: t.landing.toolsCards.rushGain,
            cta: t.landing.toolsCards.rushCta,
            href: "/guides/rush-sylvestre",
            icon: "/module-dofus/Dofus_Sylvestre.png",
            tag: t.landing.openToolsTags.quests,
        },
        {
            name: t.landing.toolsCards.bossTitle,
            gain: t.landing.toolsCards.bossGain,
            cta: t.landing.toolsCards.bossCta,
            href: "/boss",
            icon: "/assets/worldmap/dungeon-boss.png",
            tag: t.landing.openToolsTags.dungeons,
        },
        {
            name: t.landing.toolsCards.almanaxTitle,
            gain: t.landing.toolsCards.almanaxGain,
            cta: t.landing.toolsCards.almanaxCta,
            href: "/almanax",
            icon: "/module-dofus/Dofus_Dolmanax.png",
            tag: t.landing.openToolsTags.ephemeris,
        },
        {
            name: t.landing.toolsCards.worldmapTitle,
            gain: t.landing.toolsCards.worldmapGain,
            cta: t.landing.toolsCards.worldmapCta,
            href: "/carte-du-monde",
            icon: "/assets/nav/map.png",
            tag: t.landing.openToolsTags.cartography,
        },
        {
            name: t.landing.toolsCards.raidTitle,
            gain: t.landing.toolsCards.raidGain,
            cta: t.landing.toolsCards.raidCta,
            href: "/raids",
            icon: "/assets/raids/sanctuaire.webp",
            tag: t.landing.openToolsTags.raids,
        },
    ];

    return (
        <section aria-labelledby="outils-titre" className="reg-section reg-section-tight">
            <div className="reg-shell">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
                    <div>
                        <h2 id="outils-titre" className="reg-eyebrow">
                            {t.landing.openToolsTitle}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t.landing.openToolsDesc}
                        </p>
                    </div>

                    <Link
                        href="/modules"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent/80 transition-colors shrink-0"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Voir les 20+ modules de guilde &rarr;</span>
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                    {localizedTools.map((tool) => (
                        <Link
                            key={tool.href}
                            href={tool.href}
                            className="group p-4 rounded-xl border border-border bg-surface/50 hover:bg-surface hover:border-border-strong transition-all flex flex-col justify-between gap-4 shadow-sm"
                        >
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="w-10 h-10 rounded-lg bg-background/80 border border-border flex items-center justify-center p-1.5 group-hover:border-border-strong transition-colors">
                                        <Image
                                            src={tool.icon}
                                            alt=""
                                            width={28}
                                            height={28}
                                            aria-hidden="true"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/50 uppercase">
                                        {tool.tag}
                                    </span>
                                </div>

                                <div>
                                    <h3 className="text-sm font-bold text-foreground group-hover:text-accent transition-colors">
                                        {tool.name}
                                    </h3>
                                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                                        {tool.gain}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-foreground group-hover:text-accent transition-colors">
                                <span>{tool.cta}</span>
                                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
