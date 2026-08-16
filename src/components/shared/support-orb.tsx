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
                    "bg-[#0a0d14]/95 backdrop-blur-xl border border-border hover:border-success/40 shadow-xl shadow-black/50",
                    "transition-all duration-200 ease-out cursor-pointer hover:bg-surface/90 active:scale-[0.98]"
                )}
            >
                {/* Clean Icon Container */}
                <div className="w-7 h-7 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center shrink-0 group-hover:bg-success/20 group-hover:border-success/30 transition-colors">
                    <Heart className="w-3.5 h-3.5 text-success fill-emerald-400/20 group-hover:fill-emerald-400 transition-colors" />
                </div>

                {/* Text Block */}
                <div className="flex flex-col text-left">
                    <span className="text-caption font-bold text-foreground uppercase tracking-wider leading-none">
                        Soutenir <span className="text-success">SigilOS</span>
                    </span>
                    <span className="text-caption font-medium text-muted-foreground mt-1 flex items-center gap-1 leading-none">
                        <Coffee className="w-2.5 h-2.5 text-warning shrink-0" />
                        Donation Ko-fi
                    </span>
                </div>

                {/* CTA Arrow */}
                <div className="pl-2 border-l border-border flex items-center">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-success transition-colors" />
                </div>
            </a>
        </div>
    );
}
