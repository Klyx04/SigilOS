"use client";

import React, { useState, useTransition } from "react";
import { CalendarDays, Plus, Minus, CheckCircle2, Coins, Gift, Sparkles, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { AlmanaxItem } from "@/server/actions/resources-actions";

const TOTAL_PAGES = 365;

interface DofusDolmanaxTrackerProps {
    guildId: string;
    initialPages?: number;
    upcomingAlmanax?: AlmanaxItem[];
    onSave?: (pages: number) => Promise<void>;
}

export function DofusDolmanaxTracker({ guildId, initialPages = 0, upcomingAlmanax = [], onSave }: DofusDolmanaxTrackerProps) {
    const [pages, setPages] = useState<number>(Math.min(Math.max(0, initialPages), TOTAL_PAGES));
    const [isSaving, startSave] = useTransition();
    const [saved, setSaved] = useState(false);

    const pct = Math.round((pages / TOTAL_PAGES) * 100);
    const isDone = pages >= TOTAL_PAGES;
    const today = upcomingAlmanax[0];
    const nextDays = upcomingAlmanax.slice(1, 8);

    function adjust(delta: number) {
        setPages(p => Math.min(TOTAL_PAGES, Math.max(0, p + delta)));
        setSaved(false);
    }

    function handleSave(targetPages?: number) {
        if (!onSave) return;
        const val = targetPages !== undefined ? targetPages : pages;
        startSave(async () => {
            await onSave(val);
            setSaved(true);
        });
    }

    function handleTodayQuickAdd() {
        const nextVal = Math.min(TOTAL_PAGES, pages + 1);
        setPages(nextVal);
        handleSave(nextVal);
    }

    return (
        <div className="space-y-6">
            {/* 1. SECTION DU JOUR : OFFRANDE & BONUS MÉRYDE */}
            {today && (
                <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                        {today.tribute.item.image_urls?.icon ? (
                            <div className="relative w-14 h-14 rounded-xl bg-background border border-border flex items-center justify-center p-1.5 flex-shrink-0">
                                <Image
                                    src={today.tribute.item.image_urls.icon}
                                    alt={today.tribute.item.name}
                                    width={48}
                                    height={48}
                                    className="object-contain"
                                />
                            </div>
                        ) : null}
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-2">
                                <span className="text-caption font-bold text-foreground uppercase tracking-widest px-2 py-0.5 rounded bg-muted border border-border">
                                    Offrande du jour
                                </span>
                                <span className="text-caption text-muted-foreground font-mono">
                                    {new Date(today.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                                </span>
                            </div>
                            <h3 className="text-base sm:text-lg font-black text-foreground">
                                <span className="text-amber-500 font-bold">{today.tribute.quantity}x</span> {today.tribute.item.name}
                            </h3>
                            <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
                                {today.bonus && (
                                    <span className="flex items-center gap-1 font-medium text-foreground">
                                        <Sparkles className="w-3.5 h-3.5 text-warning" />
                                        {today.bonus.description}
                                    </span>
                                )}
                                {today.reward_kamas ? (
                                    <span className="flex items-center gap-1 font-mono text-warning">
                                        <Coins className="w-3.5 h-3.5" />
                                        {today.reward_kamas.toLocaleString("fr-FR")} k
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                        <Button
                            onClick={handleTodayQuickAdd}
                            disabled={isSaving || isDone}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-caption px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors border border-border"
                        >
                            <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                            +1 Page du Jour
                        </Button>
                    </div>
                </div>
            )}

            {/* 2. PROGRESSION & GESTION DES 365 PAGES */}
            <div className="p-5 rounded-2xl border border-border bg-background/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-warning" />
                        <span className="text-sm font-black text-foreground uppercase tracking-wide">
                            Progression Dolmanax
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-lg font-black tabular-nums text-foreground">
                            <span className={isDone ? "text-success" : "text-warning"}>{pages}</span>
                            <span className="text-muted-foreground text-sm font-normal"> / {TOTAL_PAGES} pages</span>
                        </span>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                    <div className="w-full h-2.5 bg-surface border border-border rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                                width: `${pct}%`,
                                background: isDone ? "#10b981" : "#f59e0b",
                            }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-caption font-bold text-muted-foreground">
                        <span>0 j</span>
                        <span className={isDone ? "text-success font-black" : "text-foreground font-mono"}>
                            {isDone ? "✓ DOLMANAX TERMINÉ" : `${pct}% (${TOTAL_PAGES - pages} jours restants)`}
                        </span>
                        <span>365 j</span>
                    </div>
                </div>

                {/* Contrôles manuels */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
                    <div className="flex items-center bg-surface border border-border rounded-xl overflow-hidden">
                        <button
                            type="button"
                            onClick={() => adjust(-10)}
                            className="px-2.5 py-1.5 text-caption font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 border-r border-border"
                        >
                            -10
                        </button>
                        <button
                            type="button"
                            onClick={() => adjust(-1)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 border-r border-border"
                        >
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                            type="number"
                            min={0}
                            max={TOTAL_PAGES}
                            value={pages}
                            onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                if (!isNaN(v)) { setPages(Math.min(TOTAL_PAGES, Math.max(0, v))); setSaved(false); }
                            }}
                            className="w-16 bg-transparent text-center text-sm font-black text-foreground outline-none tabular-nums"
                        />
                        <button
                            type="button"
                            onClick={() => adjust(+1)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 border-l border-border"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => adjust(+10)}
                            className="px-2.5 py-1.5 text-caption font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 border-l border-border"
                        >
                            +10
                        </button>
                    </div>

                    {onSave && (
                        <Button
                            onClick={() => handleSave()}
                            disabled={isSaving || saved}
                            variant="outline"
                            className={`h-9 px-4 rounded-xl font-bold text-caption transition-all ${
                                saved ? "border-success text-success bg-success/10" : ""
                            }`}
                        >
                            {saved ? <><CheckCircle2 className="w-4 h-4 mr-1 inline" /> Enregistré</> : isSaving ? "..." : "Enregistrer"}
                        </Button>
                    )}
                </div>
            </div>

            {/* 3. CALENDRIER DES 7 PROCHAINS JOURS (Style DPLN épuré) */}
            {nextDays.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">
                            📅 Prochains Jours — Préparer ses offrandes
                        </span>
                        <Link
                            href="/almanax"
                            className="text-caption font-bold text-warning hover:underline inline-flex items-center gap-1"
                        >
                            Calendrier complet <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                        {nextDays.map((item) => {
                            const dateObj = new Date(item.date);
                            const dayName = dateObj.toLocaleDateString("fr-FR", { weekday: "short" });
                            const dayNum = dateObj.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

                            return (
                                <div
                                    key={item.date}
                                    className="p-3 rounded-xl border border-border bg-background flex items-center gap-3 hover:border-warning/40 transition-colors"
                                >
                                    {item.tribute.item.image_urls?.icon ? (
                                        <div className="relative w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center p-1 flex-shrink-0">
                                            <Image
                                                src={item.tribute.item.image_urls.icon}
                                                alt={item.tribute.item.name}
                                                width={32}
                                                height={32}
                                                className="object-contain"
                                            />
                                        </div>
                                    ) : null}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between text-caption font-mono text-muted-foreground">
                                            <span className="font-bold text-foreground capitalize">{dayName}</span>
                                            <span>{dayNum}</span>
                                        </div>
                                        <div className="text-body-sm font-bold text-foreground truncate">
                                            <span className="text-warning font-black">{item.tribute.quantity}x</span> {item.tribute.item.name}
                                        </div>
                                        {item.bonus && (
                                            <div className="text-caption text-muted-foreground truncate" title={item.bonus.description}>
                                                {item.bonus.description}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
