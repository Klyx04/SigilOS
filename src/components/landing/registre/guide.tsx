"use client";

import { GuideMockup } from "./guide-mockup";
import { GuildDofusMockup } from "./guild-dofus-mockup";
import { Compass, Swords, Map } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

const OVERLAY_ICONS = [
    { icon: Compass, accent: "text-amber-400" },
    { icon: Swords, accent: "text-rose-400" },
    { icon: Map, accent: "text-emerald-400" },
];

export function LandingGuide() {
    const { t } = useI18n();

    return (
        <section aria-labelledby="guide-titre" className="reg-section">
            <div className="reg-shell">
                {/* En-tête de section */}
                <div>
                    <p className="reg-eyebrow">{t.landing.guideEyebrow}</p>
                    <h2
                        id="guide-titre"
                        className="mt-3 max-w-[28ch] text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                    >
                        {t.landing.guideTitle}
                    </h2>
                    <p className="mt-3 max-w-[66ch] text-base text-muted-foreground leading-relaxed">
                        {t.landing.guideSubtitle}
                    </p>
                </div>

                {/* Grille principale : Mockup Overlay Rush Sylvestre + Présentation des 3 Overlays */}
                <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10 lg:items-center">
                    <GuideMockup />

                    <div className="grid gap-5">
                        {t.landing.overlays.map((item, idx) => {
                            const config = OVERLAY_ICONS[idx] || OVERLAY_ICONS[0];
                            const Icon = config.icon;
                            return (
                                <article
                                    key={item.index}
                                    className="p-4 rounded-xl border border-border bg-surface/60 space-y-2 hover:border-border-strong transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Icon className={`w-4 h-4 ${config.accent}`} />
                                            <span className="reg-mono text-xs font-bold text-foreground">
                                                {item.scope}
                                            </span>
                                        </div>
                                        <span className="reg-mono text-[11px] text-muted-foreground">
                                            {item.index}
                                        </span>
                                    </div>

                                    <h3 className="text-sm font-bold text-foreground leading-snug">
                                        {item.title}
                                    </h3>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {item.detail}
                                    </p>
                                </article>
                            );
                        })}
                    </div>
                </div>

                {/* Bloc Progression & Entraide Guilde */}
                <div className="mt-16 border-t border-border-strong pt-12">
                    <div className="mb-6">
                        <p className="reg-eyebrow">{t.landing.guildDofusSection.eyebrow}</p>
                        <h3 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            {t.landing.guildDofusSection.title}
                        </h3>
                        <p className="mt-2 max-w-[64ch] text-sm text-muted-foreground leading-relaxed">
                            {t.landing.guildDofusSection.description}
                        </p>
                    </div>

                    <GuildDofusMockup />
                </div>
            </div>
        </section>
    );
}
