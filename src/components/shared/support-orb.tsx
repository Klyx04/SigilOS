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
                    "group flex items-center gap-3 px-4 py-2.5 rounded-2xl",
                    "bg-card/95 dark:bg-[#0b1220]/95 backdrop-blur-xl border border-emerald-500/30 hover:border-emerald-500/70",
                    "shadow-lg shadow-black/10 dark:shadow-2xl dark:shadow-black/70 hover:shadow-emerald-500/15",
                    "transition-all duration-200 ease-out cursor-pointer hover:bg-card active:scale-[0.98]"
                )}
            >
                {/* Clean Icon Container with vibrant Emerald Heart */}
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/25 group-hover:border-emerald-500/50 transition-colors">
                    <Heart className="w-4 h-4 text-emerald-600 dark:text-emerald-400 fill-emerald-500/30 group-hover:fill-emerald-500 group-hover:scale-110 transition-all" />
                </div>

                {/* Text Block */}
                <div className="flex flex-col text-left">
                    <span className="text-caption font-black text-foreground uppercase tracking-wider leading-none">
                        Soutenir <span className="text-emerald-600 dark:text-emerald-400 font-black">SigilOS</span>
                    </span>
                    <span className="text-caption font-bold text-muted-foreground mt-1 flex items-center gap-1.5 leading-none">
                        <Coffee className="w-3 h-3 text-amber-500 dark:text-amber-400 shrink-0" />
                        <span className="text-amber-600/90 dark:text-amber-400/90">Donation Ko-fi</span>
                    </span>
                </div>

                {/* CTA Arrow */}
                <div className="pl-2 border-l border-border/80 dark:border-border flex items-center">
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                </div>
            </a>
        </div>
    );
}
