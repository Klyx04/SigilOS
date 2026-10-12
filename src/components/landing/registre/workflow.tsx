"use client";

import { useState } from "react";
import { DjPostMockup } from "./dj-post-mockup";
import { DiscordEmbedMockup } from "./discord-embed-mockup";
import { MessageSquare, LayoutDashboard, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

export function LandingWorkflow() {
    const { t } = useI18n();
    const [view, setView] = useState<"discord" | "web">("discord");

    return (
        <section aria-labelledby="sortie-titre" className="reg-section">
            <div className="reg-shell">
                <div>
                    <p className="reg-eyebrow">{t.landing.workflowEyebrow}</p>
                    <h2
                        id="sortie-titre"
                        className="mt-3 max-w-[26ch] text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                    >
                        {t.landing.workflowTitle}
                    </h2>
                    <p className="mt-3 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                        {t.landing.workflowSubtitle}
                    </p>
                </div>

                <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-10 lg:items-start">
                    {/* Bloc visuel avec sélecteur Discord / Web */}
                    <div className="space-y-3">
                        {/* Commutateur de vue */}
                        <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-surface border border-border">
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setView("discord")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        view === "discord"
                                            ? "bg-[#5865f2] text-white shadow"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                    }`}
                                >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>{t.landing.workflowTabs.discord}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setView("web")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                        view === "web"
                                            ? "bg-accent text-accent-foreground shadow"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                    }`}
                                >
                                    <LayoutDashboard className="w-3.5 h-3.5" />
                                    <span>{t.landing.workflowTabs.web}</span>
                                </button>
                            </div>

                            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 pr-2">
                                <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: "8s" }} />
                                <span>Sync live</span>
                            </div>
                        </div>

                        {/* Rendu dynamique : Embed Discord ou Carte Web */}
                        <div className="p-3 sm:p-5 rounded-2xl border border-border-strong bg-[#0e1017] min-h-[380px] flex items-center justify-center shadow-xl">
                            {view === "discord" ? <DiscordEmbedMockup /> : <DjPostMockup />}
                        </div>
                    </div>

                    {/* Liste des 5 étapes */}
                    <ol className="border-t border-border-strong">
                        {t.landing.workflowSteps.map((step, index) => (
                            <li
                                key={step.title}
                                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-1 py-3.5 border-b border-border"
                            >
                                <span className="reg-mono text-xs text-accent pt-0.5">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                                        {step.detail}
                                    </p>
                                </div>
                                <span className="col-start-2 reg-mono text-[0.6875rem] text-subtle-foreground">
                                    {step.surface}
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    );
}
