"use client";

import { InfinityIcon, Sparkles } from "lucide-react";

export function SongesHeader() {
    return (
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-900/50 via-indigo-900/50 to-blue-900/50 border border-purple-500/30 p-6">
            {/* Background effects */}
            <div className="absolute inset-0 bg-[url(/grid.svg)] opacity-10" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl" />

            <div className="relative flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-400/30">
                    <InfinityIcon className="w-8 h-8 text-purple-400" />
                </div>

                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        Songes Infinis
                        <Sparkles className="w-5 h-5 text-amber-400" />
                    </h1>

                </div>
            </div>

            {/* Stats row */}
            <div className="relative mt-4 flex gap-6 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-white/70">Runs actives</span>
                </div>
                <div className="flex items-center gap-2 text-white/50">
                    26 étages • 5 paliers • 10 difficultés
                </div>
            </div>
        </div>
    );
}
