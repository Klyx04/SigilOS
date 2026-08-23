"use client";

import * as React from "react";
import { Search, Command as CommandIcon } from "lucide-react";

export function SidebarSearch({ guildId }: { guildId: string }) {
    return (
        <div className="px-1 py-1">
            <button
                className="h-10 w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-surface/60 px-3 text-xs font-semibold text-muted-foreground transition-all hover:bg-surface hover:border-border hover:text-foreground group/searchbtn"
                onClick={() => document.dispatchEvent(new CustomEvent("open-command-menu"))}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <Search className="shrink-0 h-3.5 w-3.5 text-muted-foreground group-hover/searchbtn:text-foreground transition-colors" />
                    <span className="truncate text-xs font-medium">Rechercher...</span>
                </div>
                
                <kbd className="hidden sm:inline-flex items-center gap-0.5 shrink-0 px-2 py-0.5 rounded-md bg-background/80 border border-border text-caption font-mono font-medium text-muted-foreground group-hover/searchbtn:text-foreground transition-colors">
                    <span className="text-caption">⌘</span>K
                </kbd>
            </button>
        </div>
    );
}
