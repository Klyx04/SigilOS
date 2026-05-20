"use client";

import { Bug, X, Sparkles, MessageSquare } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const DISCORD_INVITE = "https://discord.gg/uX7G6SUDgN";

export function BugReportButton() {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="relative z-50 flex flex-col items-end gap-2">
            {expanded && (
                <div className="absolute bottom-[calc(100%+12px)] right-0 bg-[#080808]/90 border border-white/10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 w-72 animate-in slide-in-from-bottom-4 fade-in duration-300 backdrop-blur-2xl ring-1 ring-white/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                            <Bug className="w-4 h-4 text-amber-500" />
                        </div>
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                            Assistance Technique
                        </h4>
                    </div>
                    
                    <p className="text-[12px] text-zinc-400 mb-5 leading-relaxed font-medium">
                        Un dysfonctionnement ? Nos équipes interviennent sur Discord via le salon <span className="text-amber-400/80 font-mono bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10">#bugs-beta</span>.
                    </p>

                    <a
                        href={DISCORD_INVITE}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/btn flex items-center justify-between px-5 w-full h-12 rounded-2xl bg-white text-black hover:bg-amber-400 transition-all active:scale-95 shadow-[0_10px_20px_rgba(255,255,255,0.05)] overflow-hidden relative"
                        onClick={() => setExpanded(false)}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                        <span className="text-[10px] font-black uppercase tracking-widest relative z-10">Ouvrir un ticket</span>
                        <MessageSquare className="w-4 h-4 relative z-10" />
                    </a>
                </div>
            )}

            <button
                onClick={() => setExpanded(v => !v)}
                title="Rapporter un bug"
                className={cn(
                    "group flex items-center gap-3 h-10 px-5 rounded-full border transition-all duration-500 active:scale-95 relative overflow-hidden",
                    expanded 
                        ? "bg-white border-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                        : "bg-white/5 border-white/10 text-zinc-400 hover:border-amber-500/50 hover:bg-white/10 hover:text-white"
                )}
            >
                {/* Status Glow */}
                {!expanded && (
                    <div className="absolute -left-4 -top-4 w-12 h-12 bg-amber-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                )}

                {expanded ? (
                    <X className="w-3.5 h-3.5" strokeWidth={3} />
                ) : (
                    <Bug className="w-3.5 h-3.5 text-amber-500 group-hover:animate-bounce-slow" strokeWidth={2} />
                )}
                
                <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
                    {expanded ? "Fermer" : "Signaler un bug"}
                </span>
            </button>
        </div>
    );
}
