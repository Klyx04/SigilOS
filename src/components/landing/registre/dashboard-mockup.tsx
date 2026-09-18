"use client";

import {
    Sparkles,
    Vote,
    Gift,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

/**
 * DashboardMockup — Reproduction fidèle, sobre et vectorielle du tableau de bord SigilOS.
 */
export function DashboardMockup() {
    const { t } = useI18n();
    const d = t.landing.dashboardMockup;

    return (
        <div className="w-full rounded-lg border border-border-strong bg-surface text-foreground font-sans overflow-hidden shadow-2xl">
            {/* Barre d'en-tête de fenêtre */}
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3.5 py-2 text-xs">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{d.title}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        {d.activeGuild}
                    </span>
                </div>
            </div>

            <div className="p-3.5 space-y-2.5 bg-background/50">
                {/* 1. Bandeau contextuel « Aujourd'hui » */}
                <div className="rounded border border-border bg-surface px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400/80" />
                        {d.today}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                            <Vote className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-foreground">{d.activePoll}</span>
                            <span className="text-accent font-medium ml-0.5">{d.vote}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Gift className="w-3.5 h-3.5 text-amber-400/80" />
                            <span>{d.almanaxItem}</span>
                            <span className="text-amber-300 font-medium ml-0.5">{d.offering}</span>
                        </span>
                    </div>
                </div>

                {/* 2. Événement majeur — Carte sobre et contrastée */}
                <div className="rounded border border-border-strong bg-surface/90 p-3 flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] uppercase font-semibold text-rose-400 bg-rose-950/40 border border-rose-900/50 px-1.5 py-0.5 rounded">
                                {d.majorEvent}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">{d.inTime}</span>
                        </div>
                        <div className="font-semibold text-xs text-foreground truncate">
                            {d.eventTitle}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="shrink-0 text-xs px-3 py-1 rounded bg-muted hover:bg-muted/80 border border-border text-foreground font-medium transition-colors"
                    >
                        {d.register}
                    </button>
                </div>

                {/* 3. Agenda & Groupes Donjons en grille */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {/* Colonne Agenda */}
                    <div className="rounded border border-border bg-surface p-2.5 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground border-b border-border pb-1.5">
                            <span className="font-semibold text-foreground">{d.schedule}</span>
                            <span className="text-[10px] text-muted-foreground">{d.mySchedule}</span>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] p-2 rounded bg-background/50 border border-border">
                                <span className="font-medium text-foreground truncate">{d.eventKralamoure}</span>
                                <span className="font-mono text-[10px] text-muted-foreground shrink-0">{d.registeredCount}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] p-2 rounded bg-background/30 border border-border/50">
                                <span className="font-medium text-muted-foreground truncate">{d.eventBelladone}</span>
                                <span className="font-mono text-[10px] text-emerald-400 shrink-0">4/4</span>
                            </div>
                        </div>
                    </div>

                    {/* Colonne Groupes actifs */}
                    <div className="rounded border border-border bg-surface p-2.5 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground border-b border-border pb-1.5">
                            <span className="font-semibold text-foreground">{d.dungeonGroups}</span>
                            <span className="text-[10px] text-muted-foreground">{d.activeGroupsCount}</span>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] p-2 rounded bg-background/50 border border-border">
                                <div className="truncate">
                                    <div className="font-medium text-foreground truncate">{d.vortexDungeon}</div>
                                    <div className="text-[10px] text-muted-foreground">{d.vortexBy}</div>
                                </div>
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border-strong text-foreground font-semibold shrink-0">
                                    3/4
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] p-2 rounded bg-background/30 border border-border/50">
                                <div className="truncate">
                                    <div className="font-medium text-muted-foreground truncate">{d.whaleDungeon}</div>
                                    <div className="text-[10px] text-muted-foreground">{d.whaleBy}</div>
                                </div>
                                <span className="font-mono text-[10px] text-emerald-400 shrink-0 font-medium">
                                    {d.fullBadge}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pied du dashboard */}
            <div className="flex items-center justify-between border-t border-border bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground font-mono">
                <span>{d.footerQG}</span>
                <span className="text-emerald-400">{d.inGameMembers}</span>
            </div>
        </div>
    );
}
