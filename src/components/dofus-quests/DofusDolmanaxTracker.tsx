"use client";

import React, { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { BookOpen, CalendarDays, ExternalLink, Plus, Minus, CheckCircle2, Info } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// Dolmanax Tracker — 365 Almanax pages declarative component
// The Dolmanax is obtained after collecting 365 Almanax pages via daily quests.
// No quest chain to track — just a simple progress declaration.
// ─────────────────────────────────────────────────────────────────────────────

const TOTAL_PAGES = 365;

interface DofusDolmanaxTrackerProps {
    guildId: string;
    /** Current saved page count for this member — from DB (can be null/0 if not set). */
    initialPages?: number;
    /** Callback to persist the value server-side */
    onSave?: (pages: number) => Promise<void>;
}

export function DofusDolmanaxTracker({ guildId, initialPages = 0, onSave }: DofusDolmanaxTrackerProps) {
    const [pages, setPages] = useState<number>(Math.min(Math.max(0, initialPages), TOTAL_PAGES));
    const [isSaving, startSave] = useTransition();
    const [saved, setSaved] = useState(false);

    const pct = Math.round((pages / TOTAL_PAGES) * 100);
    const isDone = pages >= TOTAL_PAGES;

    function adjust(delta: number) {
        setPages(p => Math.min(TOTAL_PAGES, Math.max(0, p + delta)));
        setSaved(false);
    }

    function handleSave() {
        if (!onSave) return;
        startSave(async () => {
            await onSave(pages);
            setSaved(true);
        });
    }

    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="p-5 bg-warning/5 border border-warning/15 rounded-3xl flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-warning/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Info className="w-5 h-5 text-warning" />
                </div>
                <div className="space-y-1">
                    <div className="text-caption font-black text-warning uppercase tracking-widest">Comment obtenir le Dolmanax</div>
                    <p className="text-body-sm text-muted-foreground leading-relaxed">
                        Le <span className="text-foreground font-bold italic">Dolmanax</span> s&apos;obtient après avoir récupéré{" "}
                        <span className="text-warning font-black">365 pages d&apos;Almanax</span> via les quêtes journalières dans n&apos;importe quel temple.
                        Chaque jour, parle au PNJ Almanzor dans un temple de la classe pour recevoir ta page.
                    </p>
                    <Link
                        href={`/dashboard/${guildId}/almanax`}
                        className="inline-flex items-center gap-1.5 text-caption font-black text-warning hover:text-warning mt-1 transition-colors"
                    >
                        <CalendarDays className="w-3.5 h-3.5" />
                        Voir le module Almanax →
                    </Link>
                </div>
            </div>

            {/* Progress bar */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-caption font-black text-muted-foreground uppercase tracking-widest">Progression</span>
                    <span className="text-body-sm font-black text-foreground tabular-nums">
                        <span style={{ color: isDone ? "#10b981" : "#f59e0b" }}>{pages}</span>
                        <span className="text-muted-foreground"> / {TOTAL_PAGES} pages</span>
                    </span>
                </div>
                <div className="w-full h-3 bg-surface rounded-full overflow-hidden">
                    <motion.div
                        className="h-full rounded-full relative"
                        style={{
                            background: isDone
                                ? "linear-gradient(90deg, #10b981, #34d399)"
                                : "linear-gradient(90deg, #f59e0b, #fbbf24)",
                            boxShadow: isDone ? "0 0 20px rgba(16,185,129,0.4)" : "0 0 20px rgba(245,158,11,0.3)",
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>
                <div className="flex items-center justify-between text-caption font-black uppercase tracking-widest">
                    <span className="text-muted-foreground">0</span>
                    <span className={isDone ? "text-success animate-pulse" : "text-muted-foreground"}>
                        {isDone ? "✓ DOLMANAX OBTENU" : `${pct}% — ${TOTAL_PAGES - pages} jours restants`}
                    </span>
                    <span className="text-muted-foreground">365</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
                <div className="flex items-center bg-background/80 border border-border rounded-2xl overflow-hidden">
                    <button
                        onClick={() => adjust(-10)}
                        className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface transition-all border-r border-border text-caption font-black"
                    >
                        -10
                    </button>
                    <button
                        onClick={() => adjust(-1)}
                        className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface transition-all border-r border-border"
                    >
                        <Minus className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-20 text-center">
                        <input
                            type="number"
                            min={0}
                            max={TOTAL_PAGES}
                            value={pages}
                            onChange={(e) => {
                                const v = parseInt(e.target.value, 10);
                                if (!isNaN(v)) { setPages(Math.min(TOTAL_PAGES, Math.max(0, v))); setSaved(false); }
                            }}
                            className="w-full bg-transparent text-center text-[16px] font-black text-foreground outline-none tabular-nums"
                        />
                    </div>
                    <button
                        onClick={() => adjust(+1)}
                        className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface transition-all border-l border-border"
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => adjust(+10)}
                        className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface transition-all border-l border-border text-caption font-black"
                    >
                        +10
                    </button>
                </div>

                {onSave && (
                    <Button
                        onClick={handleSave}
                        disabled={isSaving || saved}
                        className={`h-10 px-4 rounded-2xl font-black text-caption uppercase italic tracking-widest transition-all ${
                            saved
                                ? "bg-success/10 text-success border border-success/20"
                                : "bg-background text-foreground hover:bg-surface "
                        }`}
                    >
                        {saved ? <><CheckCircle2 className="w-4 h-4 mr-1.5 inline" /> Sauvegardé</> : isSaving ? "..." : "Sauvegarder"}
                    </Button>
                )}
            </div>

            {/* Milestones */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Quart", target: 91, emoji: "📖" },
                    { label: "Moitié", target: 183, emoji: "📚" },
                    { label: "Final", target: 365, emoji: "🏆" },
                ].map((milestone) => {
                    const reached = pages >= milestone.target;
                    return (
                        <div key={milestone.target}
                            className={`p-3 rounded-2xl border text-center transition-all ${
                                reached ? "bg-warning/10 border-warning/25" : "bg-surface border-border"
                            }`}>
                            <div className="text-xl mb-1">{milestone.emoji}</div>
                            <div className="text-caption font-black uppercase tracking-widest text-muted-foreground">{milestone.label}</div>
                            <div className={`text-label font-black ${reached ? "text-warning" : "text-muted-foreground"}`}>
                                {milestone.target} pages
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
