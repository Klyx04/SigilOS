"use client";

import * as React from "react";
import { Search, Command as CommandIcon } from "lucide-react";

export function SidebarSearch({ guildId }: { guildId: string }) {
    return (
        <div className="px-1 py-1">
            <button
                className="relative h-11 w-full flex items-center justify-start gap-3 rounded-xl border border-white/5 bg-zinc-900/40 px-4 text-[11px] font-black text-white/90 transition-all hover:bg-emerald-500/[0.05] hover:border-emerald-500/40 hover:text-emerald-400 group/searchbtn overflow-hidden shadow-inner"
                onClick={() => document.dispatchEvent(new CustomEvent("open-command-menu"))}
            >
                {/* Active Glow Effect */}
                <div className="absolute -inset-x-20 top-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent opacity-0 group-hover/searchbtn:opacity-100 transition-opacity blur-[1px]" />
                
                <Search className="shrink-0 h-4 w-4 text-emerald-500/60 group-hover/searchbtn:text-emerald-400 group-hover/searchbtn:scale-110 transition-all duration-300" />
                <span className="flex-1 text-left truncate uppercase tracking-[0.2em] font-black group-hover/searchbtn:translate-x-1 transition-transform">Rechercher</span>
                
                <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg bg-zinc-950/50 border border-white/5 text-[9px] font-black group-hover/searchbtn:border-emerald-500/30 group-hover/searchbtn:text-emerald-400 transition-all shadow-xl">
                    <span className="opacity-40">⌘</span>
                    <span className="font-mono">K</span>
                </div>

                {/* Decorative scanning line */}
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.02] to-transparent opacity-0 group-hover/searchbtn:opacity-100 transition-opacity" />
            </button>
        </div>
    );
}
