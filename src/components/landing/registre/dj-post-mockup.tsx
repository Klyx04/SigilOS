"use client";

import {
    Swords,
    Users,
    Calendar,
    MessageSquare,
    ArrowRight,
} from "lucide-react";
import Image from "next/image";
import { useI18n } from "@/lib/i18n/client";

/**
 * DjPostMockup — Reproduction fidèle au pixel près de la carte Donjon & Quête réelle (DjPostCard).
 */
export function DjPostMockup() {
    const { t } = useI18n();
    const d = t.landing.djPostMockup;
    const dm = t.landing.discordEmbedMockup;

    return (
        <div className="w-full max-w-[420px] mx-auto rounded-xl border border-border-strong bg-surface text-foreground font-sans overflow-hidden shadow-2xl p-4 space-y-3.5">
            {/* 1. Header du post : Boss + Badge Ouvert */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#1c202f] to-[#10131d] border border-[#2b3346] flex items-center justify-center overflow-hidden shrink-0 p-1 shadow-md">
                        <Image
                            src="/images/songes-bosses/3835_Vortex.png"
                            alt="Vortex"
                            width={44}
                            height={44}
                            className="w-full h-full object-contain drop-shadow"
                        />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-foreground tracking-tight">
                            {dm.dungeonName}
                        </h4>
                        <p className="text-[11px] text-muted-foreground font-mono uppercase">
                            {d.dungeonLevel}
                        </p>
                    </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    {d.statusOpen}
                </span>
            </div>

            {/* 2. Badges Mode & Places */}
            <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-1 rounded bg-muted/60 border border-border text-foreground">
                    <Swords className="w-3.5 h-3.5 text-muted-foreground" />
                    {d.badgeDungeon}
                </span>

                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground bg-muted/40 border border-border/50 px-2.5 py-1 rounded">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <strong className="text-foreground">2 / 4</strong>
                    <span className="text-amber-400 font-semibold">+2</span>
                </span>
            </div>

            {/* 3. Date et Heure de la sortie */}
            <div className="rounded-lg border border-border bg-background/60 px-3 py-2 flex items-center gap-2 text-xs font-mono text-zinc-300">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="font-semibold uppercase text-foreground">
                    {d.dateSchedule}
                </span>
            </div>

            {/* 4. Avatars des membres inscrits avec badges de classe */}
            <div className="flex items-center gap-2 pt-0.5">
                <div className="flex items-center -space-x-2">
                    {/* Avatar 1 (Créateur) */}
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full border-2 border-surface bg-zinc-800 flex items-center justify-center text-xs font-bold text-amber-300">
                            A
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-950 border border-amber-600/60 text-[9px] font-bold text-amber-300 flex items-center justify-center font-mono">
                            Fo
                        </span>
                    </div>

                    {/* Avatar 2 */}
                    <div className="relative">
                        <div className="w-8 h-8 rounded-full border-2 border-surface bg-zinc-800 flex items-center justify-center text-xs font-bold text-cyan-300">
                            V
                        </div>
                    </div>

                    {/* Slot libre 1 */}
                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-border bg-muted/20 flex items-center justify-center text-[10px] text-muted-foreground font-mono">
                        ?
                    </div>

                    {/* Slot libre 2 */}
                    <div className="w-8 h-8 rounded-full border-2 border-dashed border-border bg-muted/20 flex items-center justify-center text-[10px] text-muted-foreground font-mono">
                        ?
                    </div>
                </div>

                <span className="text-[11px] text-amber-400/90 font-medium font-mono pl-2">
                    {d.neededClasses}
                </span>
            </div>

            {/* 5. Message du meneur de groupe */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 text-xs text-muted-foreground italic leading-relaxed">
                &ldquo;{d.quote}&rdquo;
            </div>

            {/* 6. Footer : Créateur et Actions */}
            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-semibold text-foreground">Ardamire</span>
                    <span className="text-[10px] font-mono opacity-60">{d.timeAgo}</span>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="p-1.5 rounded bg-muted/60 border border-border text-muted-foreground" title="Notifié sur Discord">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <button
                        type="button"
                        className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 border border-border text-xs font-semibold text-foreground transition-colors"
                    >
                        {d.details}
                    </button>
                    <button
                        type="button"
                        className="px-3 py-1 rounded bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-bold transition-colors inline-flex items-center gap-1"
                    >
                        <span>{d.join}</span>
                        <ArrowRight className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </div>
    );
}
