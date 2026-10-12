"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Sparkles, Users, Award, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { DiscordIcon } from "@/components/shared/icons";

export function SigilOSShowcaseSection() {
    const { t } = useI18n();
    const l10n = t.raidStudio.showcase;

    const [activeMockTab, setActiveMockTab] = useState<"discord" | "dashboard">("discord");

    return (
        <section className="rounded-2xl border border-border bg-gradient-to-b from-surface/80 to-surface/40 p-6 md:p-8 space-y-8">
            {/* Header de la section vitrine */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
                <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent font-mono text-[11px] font-bold uppercase tracking-wider mb-2">
                        <Sparkles className="w-3 h-3" />
                        <span>{l10n.badge}</span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-foreground">
                        {l10n.title}
                    </h2>
                    <p className="mt-1 text-xs md:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                        {l10n.subtitle}
                    </p>
                </div>

                <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground font-bold text-xs shadow-md hover:bg-accent/90 transition-all shrink-0 self-start md:self-auto"
                >
                    <DiscordIcon className="w-4 h-4 fill-current" />
                    <span>{l10n.ctaBtn}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>

            {/* Grille 3 piliers réels SigilOS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border bg-background/50 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center">
                        <DiscordIcon className="w-4 h-4 fill-current" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{l10n.feature1Title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {l10n.feature1Desc}
                    </p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-background/50 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Users className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{l10n.feature2Title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {l10n.feature2Desc}
                    </p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-background/50 space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-warning/20 text-warning flex items-center justify-center">
                        <Award className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{l10n.feature3Title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        {l10n.feature3Desc}
                    </p>
                </div>
            </div>

            {/* Comparateur interactif de mockups réalistes */}
            <div className="rounded-xl border border-border bg-background/40 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/80">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveMockTab("discord")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                                activeMockTab === "discord"
                                    ? "bg-[#5865F2] text-white shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <DiscordIcon className="w-3.5 h-3.5 fill-current" />
                            <span>Vue Discord Bot (Embed Officiel)</span>
                        </button>
                        <button
                            onClick={() => setActiveMockTab("dashboard")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                                activeMockTab === "dashboard"
                                    ? "bg-accent text-accent-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Vue SigilOS Dashboard (Roster & Clôture)</span>
                        </button>
                    </div>

                    <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
                        Synchronisation bidirectionnelle instantanée
                    </span>
                </div>

                <div className="p-4 sm:p-6">
                    {activeMockTab === "discord" ? (
                        /* Mockup Embed Discord réel */
                        <div className="max-w-xl mx-auto rounded-lg border-l-4 border-[#5865F2] bg-[#2B2D31] text-[#DBDEE1] p-4 text-xs space-y-3 font-sans shadow-lg">
                            <div className="flex items-center justify-between text-[11px] text-[#949BA4]">
                                <span>SigilOS BOT • Aujourd'hui à 20:30</span>
                                <span className="bg-[#1E1F22] px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400">
                                    PUBLIÉ
                                </span>
                            </div>

                            <div>
                                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                                    <span>⚔️ RAID OFFICIEL : Sanctuaire des Jardins Éternels</span>
                                </h4>
                                <p className="mt-1 text-[11px] text-[#B5BAC1]">
                                    Organisation 3.6 • Objectif : Clôture 50 000 pts • Départ 21h00 pile • Vocal obligatoire
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#1E1F22] p-2.5 rounded border border-[#35373C]">
                                <div>
                                    <span className="text-[#949BA4]">Capitaine :</span>
                                    <div className="font-bold text-white">Pandawok (Lead)</div>
                                </div>
                                <div>
                                    <span className="text-[#949BA4]">Places :</span>
                                    <div className="font-bold text-emerald-400">14 / 16 Inscrits</div>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-[#949BA4]">File d'attente :</span>
                                    <div className="font-medium text-amber-300">2 en attente (Reserve #1: Cra-Zor, Reserve #2: Elio-Vax)</div>
                                </div>
                            </div>

                            {/* Boutons d'action réels Discord */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    onClick={() => alert("Dans SigilOS, ce bouton enregistre le joueur avec sa classe et le notifie sur Discord.")}
                                    className="px-3 py-1.5 rounded bg-[#248046] hover:bg-[#1A6334] text-white text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                                >
                                    <span>✅ S'inscrire</span>
                                </button>
                                <button
                                    onClick={() => alert("Le joueur peut changer de personnage Dofus instantanément.")}
                                    className="px-3 py-1.5 rounded bg-[#4E5058] hover:bg-[#6D6F78] text-white text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                                >
                                    <span>🎭 Choisir ma classe</span>
                                </button>
                                <button
                                    onClick={() => alert("La désinscription promeut automatiquement le premier joueur de la file d'attente.")}
                                    className="px-3 py-1.5 rounded bg-[#DA373C] hover:bg-[#A12828] text-white text-[11px] font-semibold transition-colors flex items-center gap-1.5"
                                >
                                    <span>❌ Se désinscrire</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Mockup Dashboard SigilOS réel */
                        <div className="max-w-2xl mx-auto rounded-xl border border-border bg-surface p-5 text-xs space-y-4 shadow-md">
                            <div className="flex items-center justify-between border-b border-border pb-3">
                                <div>
                                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-accent" />
                                        <span>Sanctuaire des Jardins Éternels — Gestion du Roster</span>
                                    </h4>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        Capitaine assigné : <strong>Pandawok</strong> • Rôle requis : <code>RAID_OFFICER</code>
                                    </p>
                                </div>
                                <span className="px-2.5 py-1 rounded bg-accent/15 text-accent font-mono text-[10px] font-bold">
                                    PROMOTED_AUTO: ACTIF
                                </span>
                            </div>

                            <div className="space-y-2">
                                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                    Participants validés (14) & Remplaçants (2)
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { name: "Pandawok", cls: "Panda", role: "Lead / Tank", st: "Capitaine" },
                                        { name: "Eni-Heal", cls: "Eniripsa", role: "Soin Aile 1", st: "Confirmé" },
                                        { name: "Feca-Bouclier", cls: "Féca", role: "Anti-Statue", st: "Confirmé" },
                                        { name: "Iop-Burst", cls: "Iop", role: "Débiteur", st: "Confirmé" },
                                    ].map((p, i) => (
                                        <div key={i} className="p-2.5 rounded-lg border border-border bg-background/60 space-y-1">
                                            <div className="font-bold text-foreground truncate">{p.name}</div>
                                            <div className="text-[10px] text-muted-foreground">{p.cls} • {p.role}</div>
                                            <span className="inline-block text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400">
                                                {p.st}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section Clôture de raid */}
                            <div className="p-3 rounded-lg border border-warning/30 bg-warning/5 flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-bold text-foreground flex items-center gap-1.5">
                                        <Award className="w-3.5 h-3.5 text-warning" />
                                        <span>Clôture du raid & Distribution auto</span>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        Distribue +50 XP guilde et 30 Kamas Pourpres aux membres présents pointés par le capitaine.
                                    </div>
                                </div>
                                <button
                                    onClick={() => alert("Dans SigilOS, la fonction completeRaidEvent() crédite automatiquement les profils.")}
                                    className="px-3 py-1.5 rounded-lg bg-warning text-black font-bold text-xs shrink-0 shadow-sm"
                                >
                                    Clôturer & Récompenser
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
