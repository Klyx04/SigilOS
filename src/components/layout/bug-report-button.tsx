"use client";

import { MessageSquareWarning, X } from "lucide-react";
import { useState } from "react";

const DISCORD_INVITE = "https://discord.gg/uX7G6SUDgN";

export function BugReportButton() {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
            {expanded && (
                <div className="bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl p-4 w-64 animate-in slide-in-from-bottom-4 fade-in duration-200">
                    <p className="text-xs font-semibold text-zinc-300 mb-1">Vous avez trouvé un bug ?</p>
                    <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed">
                        Rejoignez le Discord SigilOS et postez dans <span className="text-emerald-400 font-mono">#bugs-beta</span>.
                    </p>
                    <a
                        href={DISCORD_INVITE}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full h-9 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold transition-all active:scale-95"
                        onClick={() => setExpanded(false)}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.04.033.05a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                        </svg>
                        Rejoindre Discord
                    </a>
                </div>
            )}

            <button
                onClick={() => setExpanded(v => !v)}
                title="Rapporter un bug"
                aria-label="Rapporter un bug"
                className="group flex items-center gap-2 h-11 px-4 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl hover:border-amber-500/40 hover:bg-zinc-800 transition-all duration-200 active:scale-95"
            >
                {expanded
                    ? <X className="w-4 h-4 text-zinc-400" />
                    : <MessageSquareWarning className="w-4 h-4 text-amber-400" />
                }
                <span className="text-xs font-semibold text-zinc-300 group-hover:text-white transition-colors">
                    Bug ?
                </span>
            </button>
        </div>
    );
}
