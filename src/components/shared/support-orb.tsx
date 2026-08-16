"use client";

import { Heart, ExternalLink, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SupportOrb component
 * A crisp, professional SaaS dashboard widget to encourage donations on Ko-fi.
 * Clean, sharp design without over-the-top AI effects or heavy blurs.
 */
export function SupportOrb() {
    const stripeLink = "https://ko-fi.com/wylan"; 

    return (
        <div className="support-orb fixed bottom-6 right-6 z-[100]">
            <a
                href={stripeLink}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                    "group flex items-center gap-3 px-3.5 py-2 rounded-xl",
                    "bg-[#0a0d14]/95 backdrop-blur-xl border border-white/10 hover:border-emerald-500/40 shadow-xl shadow-black/50",
                    "transition-all duration-200 ease-out cursor-pointer hover:bg-zinc-900/90 active:scale-[0.98]"
                )}
            >
                {/* Clean Icon Container */}
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30 transition-colors">
                    <Heart className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400/20 group-hover:fill-emerald-400 transition-colors" />
                </div>

                {/* Text Block */}
                <div className="flex flex-col text-left">
                    <span className="text-caption font-bold text-white uppercase tracking-wider leading-none">
                        Soutenir <span className="text-emerald-400">SigilOS</span>
                    </span>
                    <span className="text-caption font-medium text-zinc-400 mt-1 flex items-center gap-1 leading-none">
                        <Coffee className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                        Donation Ko-fi
                    </span>
                </div>

                {/* CTA Arrow */}
                <div className="pl-2 border-l border-white/10 flex items-center">
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                </div>
            </a>
        </div>
    );
}
