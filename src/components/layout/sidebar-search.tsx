"use client";

import * as React from "react";
import { Search, Command as CommandIcon } from "lucide-react";

export function SidebarSearch({ guildId }: { guildId: string }) {
    return (
        <div className="px-1 py-1">
            <button
                className="h-10 w-full flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-zinc-900/60 px-3 text-xs font-semibold text-zinc-400 transition-all hover:bg-white/5 hover:border-white/10 hover:text-zinc-200 group/searchbtn"
                onClick={() => document.dispatchEvent(new CustomEvent("open-command-menu"))}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Search className="shrink-0 h-3.5 w-3.5 text-zinc-500 group-hover/searchbtn:text-zinc-300 transition-colors" />
                    <span className="truncate text-xs font-medium">Rechercher...</span>
                </div>
                
                <kbd className="hidden sm:inline-flex items-center gap-0.5 shrink-0 px-2 py-0.5 rounded-md bg-zinc-950/80 border border-white/10 text-[10px] font-mono font-medium text-zinc-500 group-hover/searchbtn:text-zinc-300 transition-colors">
                    <span className="text-[10px]">⌘</span>K
                </kbd>
            </button>
        </div>
    );
}
