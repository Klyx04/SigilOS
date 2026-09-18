"use client";

import {
    Swords,
    Users,
    ChevronLeft,
    ChevronRight,
    Sparkles,
} from "lucide-react";

/**
 * CalendarMockup — Reproduction fidèle, sobre et vectorielle du calendrier SigilOS.
 *
 * Palette matte, équilibrée et lisible, sans saturation excessive.
 */
export function CalendarMockup() {
    const days = [
        { key: "LUN", num: 10, isCurrent: true, hasEvent: true },
        { key: "MAR", num: 11, isCurrent: false, hasEvent: false },
        { key: "MER", num: 12, isCurrent: false, hasEvent: false },
        { key: "JEU", num: 13, isCurrent: false, hasEvent: true },
        { key: "VEN", num: 14, isCurrent: false, hasEvent: false },
        { key: "SAM", num: 15, isCurrent: false, hasEvent: false },
        { key: "DIM", num: 16, isCurrent: false, hasEvent: false },
    ];

    return (
        <div className="w-full rounded-lg border border-border-strong bg-surface text-foreground font-sans overflow-hidden shadow-2xl">
            {/* Barre de titre du calendrier — style interne de CalendarGrid */}
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2 font-medium text-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400/80" aria-hidden="true" />
                    <span className="font-semibold text-foreground">Août 2026</span>
                    <span className="text-muted-foreground font-mono text-[11px]">Semaine 33</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-surface border border-border text-foreground font-mono">
                        Semaine
                    </span>
                    <div className="flex items-center gap-0.5 ml-1">
                        <div className="p-1 rounded hover:bg-muted text-muted-foreground">
                            <ChevronLeft className="w-3 h-3" />
                        </div>
                        <div className="p-1 rounded hover:bg-muted text-muted-foreground">
                            <ChevronRight className="w-3 h-3" />
                        </div>
                    </div>
                </div>
            </div>

            {/* En-tête des 7 jours — aligné sur CalendarGrid */}
            <div className="grid grid-cols-7 border-b border-border bg-background/40 text-center text-[11px] font-mono">
                {days.map((day) => (
                    <div
                        key={day.key}
                        className={`py-2 px-1 border-r last:border-r-0 border-border ${
                            day.isCurrent ? "bg-muted/50 font-semibold text-foreground" : "text-muted-foreground"
                        }`}
                    >
                        <div>{day.key}</div>
                        <div className={`text-xs mt-0.5 ${day.isCurrent ? "text-foreground font-bold" : "text-muted-foreground"}`}>
                            {day.num}
                        </div>
                    </div>
                ))}
            </div>

            {/* Cellules des jours avec événement réel */}
            <div className="grid grid-cols-7 min-h-[190px] bg-background/20">
                {/* LUNDI 10 : Événement majeur */}
                <div className="p-1.5 border-r border-border bg-muted/10 flex flex-col justify-between col-span-3 sm:col-span-2">
                    <div className="rounded border border-border-strong bg-surface p-2 text-left space-y-1.5 shadow-sm">
                        <div className="flex items-center justify-between gap-1">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-foreground">
                                <Swords className="w-3 h-3 text-rose-400 shrink-0" />
                                20:00
                            </span>
                            <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-rose-950/40 text-rose-400 border border-rose-900/50">
                                Raid 3.6
                            </span>
                        </div>

                        <div className="font-semibold text-xs text-foreground leading-tight">
                            Raid Gigalodon
                        </div>

                        <div className="pt-1 border-t border-border flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1 text-foreground font-mono">
                                <Users className="w-3 h-3 text-muted-foreground" />
                                3/4
                            </span>
                            <span className="text-amber-400/90 text-[10px] font-medium">
                                Eni requis
                            </span>
                        </div>

                        <div className="pt-1 flex items-center justify-between text-[9px] text-muted-foreground font-mono">
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                #sorties
                            </span>
                            <span className="text-muted-foreground">SigilOS</span>
                        </div>
                    </div>
                </div>

                {/* MARDI 11 : Vide */}
                <div className="hidden sm:block p-1.5 border-r border-border opacity-30"></div>

                {/* MERCREDI 12 : Vide */}
                <div className="hidden sm:block p-1.5 border-r border-border opacity-30"></div>

                {/* JEUDI 13 : Donjon */}
                <div className="p-1.5 border-r border-border col-span-4 sm:col-span-2 flex flex-col justify-start">
                    <div className="rounded border border-border bg-surface/80 p-2 text-left space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                            <span>21:00</span>
                            <span className="text-muted-foreground font-medium">Donjon</span>
                        </div>
                        <div className="font-semibold text-xs text-foreground truncate">
                            Belladone 200
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                            <span className="inline-flex items-center gap-1 font-mono">
                                <Users className="w-2.5 h-2.5" /> 4/4
                            </span>
                            <span className="text-emerald-400 font-medium text-[9px]">Complet</span>
                        </div>
                    </div>
                </div>

                {/* VENDREDI 14 : Vide */}
                <div className="hidden sm:block p-1.5 border-r border-border opacity-30"></div>

                {/* WEEKEND (SAM / DIM) : Vide */}
                <div className="hidden sm:block p-1.5 opacity-30"></div>
            </div>

            {/* Pied de calendrier — filtre actif et statut Discord */}
            <div className="flex items-center justify-between border-t border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground font-mono">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span>Bot Discord synchronisé</span>
                </div>
                <div className="text-muted-foreground">
                    2 sorties cette semaine
                </div>
            </div>
        </div>
    );
}
